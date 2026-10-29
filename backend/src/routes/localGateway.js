import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, queryLocalDb, ensureUserDefaultInventory, hashPassword } from '../config/datasource.local.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const ALLOWED_TABLES = new Set([
  'users',
  'profiles',
  'inventories',
  'inventory_users',
  'inventory_invitations',
  'categories',
  'subcategories',
  'locations',
  'products',
  'product_locations',
  'sales',
  'sale_items',
  'coupons',
  'audit_logs'
]);

/**
 * Mantiene la consistencia entre products.stock y SUM(product_locations.quantity)
 * cuando el stock global disminuye (ej. por venta o retiro/merma).
 */
async function reconcileProductLocationsWithTotalStock(client, productId, newTotalStock) {
  const locRowsRes = await client.query(
    `SELECT id, quantity, location_id
     FROM public.product_locations
     WHERE product_id = $1 AND quantity > 0
     ORDER BY updated_at ASC, created_at ASC
     FOR UPDATE`,
    [productId]
  );

  const totalAssigned = locRowsRes.rows.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  let excess = Number((totalAssigned - Number(newTotalStock || 0)).toFixed(4));
  if (excess <= 0.0001) return;

  for (const row of locRowsRes.rows) {
    if (excess <= 0.0001) break;
    const rowQty = Number(row.quantity || 0);
    if (rowQty <= excess + 0.0001) {
      await client.query(`DELETE FROM public.product_locations WHERE id = $1`, [row.id]);
      excess = Number((excess - rowQty).toFixed(4));
    } else {
      const updatedQty = Number((rowQty - excess).toFixed(4));
      await client.query(
        `UPDATE public.product_locations SET quantity = $1, updated_at = NOW() WHERE id = $2`,
        [updatedQty, row.id]
      );
      excess = 0;
    }
  }
}

// ============================================================================
// HELPERS DE TOKENS JWT LOCALES Y FORMATO DE USUARIO SUPABASE
// ============================================================================

function createLocalToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      aud: 'authenticated',
      user_metadata: {
        full_name: user.full_name || user.email.split('@')[0]
      },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', 'local-postgres-secret')
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function decodeLocalToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

function formatSupabaseUser(dbUser) {
  const fullName = dbUser.full_name || dbUser.raw_user_meta_data?.full_name || dbUser.email.split('@')[0];
  return {
    id: dbUser.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: dbUser.email,
    email_confirmed_at: dbUser.created_at || new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {
      full_name: fullName
    },
    identities: [],
    created_at: dbUser.created_at || new Date().toISOString(),
    updated_at: dbUser.updated_at || new Date().toISOString()
  };
}

function buildSessionResponse(dbUser) {
  const formattedUser = formatSupabaseUser(dbUser);
  const accessToken = createLocalToken(dbUser);
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 604800,
    expires_at: Math.floor(Date.now() / 1000) + 604800,
    refresh_token: accessToken,
    user: formattedUser
  };
}

async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const decoded = decodeLocalToken(token);
  if (!decoded || !decoded.sub) return null;

  const { rows } = await queryLocalDb(`SELECT * FROM public.users WHERE id = $1 LIMIT 1`, [decoded.sub]);
  return rows[0] || null;
}

// ============================================================================
// 1. ENDPOINTS DE AUTENTICACIÓN LOCAL (/auth/v1/*)
// ============================================================================

/**
 * POST /auth/v1/signup
 * Registra un nuevo usuario directamente en PostgreSQL local (pruebaLocalWeb)
 */
router.post('/auth/v1/signup', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    const fullName =
      req.body.data?.full_name ||
      req.body.user_metadata?.full_name ||
      email.split('@')[0];

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const existing = await queryLocalDb(`SELECT * FROM public.users WHERE LOWER(email) = $1 LIMIT 1`, [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'User already registered' });
    }

    const passwordHash = hashPassword(password);
    const meta = JSON.stringify({ full_name: fullName });

    const insertRes = await queryLocalDb(
      `INSERT INTO public.users (email, password_hash, full_name, raw_user_meta_data)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [email, passwordHash, fullName, meta]
    );

    const newUser = insertRes.rows[0];
    await ensureUserDefaultInventory(newUser.id, newUser.email, fullName);

    const sessionPayload = buildSessionResponse(newUser);
    return res.status(200).json(sessionPayload);
  } catch (err) {
    console.error('Error en /auth/v1/signup local:', err);
    return res.status(500).json({ message: err.message || 'Error creando usuario en BD local' });
  }
});

/**
 * POST /auth/v1/token
 * Inicio de sesión y refresco de sesión contra PostgreSQL local (pruebaLocalWeb)
 */
router.post('/auth/v1/token', async (req, res) => {
  try {
    const grantType = req.query.grant_type || 'password';

    if (grantType === 'refresh_token') {
      const refreshToken = req.body.refresh_token;
      const decoded = decodeLocalToken(refreshToken);
      if (!decoded) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid refresh token' });
      }
      const { rows } = await queryLocalDb(`SELECT * FROM public.users WHERE id = $1 LIMIT 1`, [decoded.sub]);
      if (rows.length === 0) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'User not found' });
      }
      return res.status(200).json(buildSessionResponse(rows[0]));
    }

    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!email || !password) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid login credentials' });
    }

    let { rows } = await queryLocalDb(`SELECT * FROM public.users WHERE LOWER(email) = $1 LIMIT 1`, [email]);

    // Si usa la cuenta demo por primera vez en local, auto-crearla en pruebaLocalWeb
    if (rows.length === 0 && email === 'demo@inventariocoop.com') {
      const demoHash = hashPassword(password);
      const demoRes = await queryLocalDb(
        `INSERT INTO public.users (email, password_hash, full_name, raw_user_meta_data)
         VALUES ($1, $2, 'Usuario Demo Local', '{"full_name": "Usuario Demo Local"}'::jsonb)
         RETURNING *`,
        [email, demoHash]
      );
      rows = demoRes.rows;
    }

    if (rows.length === 0) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid login credentials',
        message: 'Invalid login credentials'
      });
    }

    const dbUser = rows[0];
    const expectedHash = hashPassword(password);
    if (dbUser.password_hash !== expectedHash) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid login credentials',
        message: 'Invalid login credentials'
      });
    }

    await ensureUserDefaultInventory(dbUser.id, dbUser.email, dbUser.full_name);

    return res.status(200).json(buildSessionResponse(dbUser));
  } catch (err) {
    console.error('Error en /auth/v1/token local:', err);
    return res.status(500).json({ message: err.message });
  }
});

/**
 * GET /auth/v1/user
 * Devuelve el usuario autenticado actual desde PostgreSQL local
 */
router.get('/auth/v1/user', async (req, res) => {
  try {
    const dbUser = await getUserFromRequest(req);
    if (!dbUser) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(200).json(formatSupabaseUser(dbUser));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * POST /auth/v1/logout
 */
router.post('/auth/v1/logout', (req, res) => {
  return res.status(204).send();
});

// ============================================================================
// 2. ENDPOINTS DE FUNCIONES RPC LOCALES (/rest/v1/rpc/:fn)
// ============================================================================

router.post('/rest/v1/rpc/:fn', async (req, res) => {
  const { fn } = req.params;
  try {
    if (fn === 'initialize_user_inventory') {
      const dbUser = await getUserFromRequest(req);
      if (!dbUser) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }
      const invId = await ensureUserDefaultInventory(dbUser.id, dbUser.email, dbUser.full_name);
      return res.status(200).json(invId);
    }

    if (fn === 'is_inventory_member') {
      const { inv_id } = req.body || {};
      const dbUser = await getUserFromRequest(req);
      if (!dbUser || !inv_id) return res.status(200).json(false);

      const { rows } = await queryLocalDb(
        `SELECT 1 FROM public.inventories WHERE id = $1 AND owner_id = $2
         UNION
         SELECT 1 FROM public.inventory_users WHERE inventory_id = $1 AND user_id = $2`,
        [inv_id, dbUser.id]
      );
      return res.status(200).json(rows.length > 0);
    }

    if (fn === 'transfer_inventory_ownership') {
      const { p_inventory_id, p_new_owner_id } = req.body;
      const dbUser = await getUserFromRequest(req);
      if (!dbUser) return res.status(401).json({ message: 'Usuario no autenticado' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE public.inventories SET owner_id = $1, updated_at = NOW() WHERE id = $2`,
          [p_new_owner_id, p_inventory_id]
        );
        await client.query(
          `INSERT INTO public.inventory_users (inventory_id, user_id, role)
           VALUES ($1, $2, 'owner')
           ON CONFLICT (inventory_id, user_id) DO UPDATE SET role = 'owner'`,
          [p_inventory_id, p_new_owner_id]
        );
        await client.query(
          `UPDATE public.inventory_users SET role = 'collaborator' WHERE inventory_id = $1 AND user_id = $2`,
          [p_inventory_id, dbUser.id]
        );
        await client.query('COMMIT');
        return res.status(200).json(true);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    if (fn === 'delete_inventory') {
      const { p_inventory_id, p_confirmation } = req.body;
      if (p_confirmation !== 'DELETE-INVENTORY') {
        return res.status(400).json({ message: 'Palabra de seguridad inválida. Debe escribir DELETE-INVENTORY' });
      }
      await queryLocalDb(`DELETE FROM public.inventories WHERE id = $1`, [p_inventory_id]);
      return res.status(200).json(true);
    }

    if (fn === 'process_pos_sale') {
      const {
        p_inventory_id,
        p_seller_id,
        p_seller_email,
        p_total_amount,
        p_payment_method,
        p_customer_name,
        p_customer_contact,
        p_notes,
        p_items,
        p_coupon_code,
        p_discount_amount
      } = req.body;

      const items = Array.isArray(p_items) ? p_items : JSON.parse(p_items || '[]');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (const item of items) {
          const prodRes = await client.query(
            `SELECT stock, name FROM public.products WHERE id = $1 AND inventory_id = $2 FOR UPDATE`,
            [item.product_id, p_inventory_id]
          );
          if (prodRes.rows.length === 0) {
            throw new Error(`El producto "${item.product_name}" no existe en este inventario.`);
          }
          if (Number(prodRes.rows[0].stock) + 0.0002 < Number(item.quantity)) {
            throw new Error(
              `Stock insuficiente para "${prodRes.rows[0].name}". Disponible: ${Number(Number(prodRes.rows[0].stock).toFixed(2))}, Solicitado: ${Number(Number(item.quantity).toFixed(2))}.`
            );
          }
        }

        const finalNotes =
          p_coupon_code && String(p_coupon_code).trim() !== ''
            ? `${p_notes ? p_notes + ' ' : ''}[Cupón: ${p_coupon_code} (-${p_discount_amount})]`
            : p_notes || null;

        const saleRes = await client.query(
          `INSERT INTO public.sales (
             inventory_id, seller_id, seller_email, total_amount, payment_method,
             customer_name, customer_contact, notes
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            p_inventory_id,
            p_seller_id,
            p_seller_email,
            p_total_amount,
            p_payment_method,
            p_customer_name,
            p_customer_contact,
            finalNotes
          ]
        );
        const saleId = saleRes.rows[0].id;

        for (const item of items) {
          const updatedProdRes = await client.query(
            `UPDATE public.products
             SET stock = GREATEST(0, ROUND((stock - $1::numeric), 4)),
                 last_modified_by = $2,
                 last_modified_by_email = $3,
                 updated_at = NOW()
             WHERE id = $4
             RETURNING stock`,
            [item.quantity, p_seller_id, p_seller_email, item.product_id]
          );

          if (updatedProdRes.rows[0]) {
            await reconcileProductLocationsWithTotalStock(
              client,
              item.product_id,
              updatedProdRes.rows[0].stock
            );
          }

          await client.query(
            `INSERT INTO public.sale_items (
               sale_id, product_id, product_name, product_code,
               quantity, unit_price, cost_price, subtotal
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              saleId,
              item.product_id,
              item.product_name,
              item.product_code,
              item.quantity,
              item.unit_price,
              item.cost_price || 0,
              item.subtotal
            ]
          );
        }

        await client.query('COMMIT');
        return res.status(200).json({ success: true, sale_id: saleId });
      } catch (e) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: e.message });
      } finally {
        client.release();
      }
    }

    // RPC: Asignación por lotes de productos a una Ubicación Física (Con validación estricta de Stock Pendiente)
    if (fn === 'assign_product_locations_batch') {
      const {
        p_inventory_id,
        p_location_id,
        p_items,
        p_user_id,
        p_user_email
      } = req.body || {};

      const items = Array.isArray(p_items) ? p_items : JSON.parse(p_items || '[]');
      if (!p_inventory_id || !p_location_id || items.length === 0) {
        return res.status(400).json({
          message: 'Se requiere seleccionar la ubicación destino y al menos un producto para asignar.'
        });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const locRes = await client.query(
          `SELECT id, name, code FROM public.locations WHERE id = $1 AND inventory_id = $2 LIMIT 1`,
          [p_location_id, p_inventory_id]
        );
        if (locRes.rows.length === 0) {
          throw new Error('La ubicación de destino seleccionada no existe en este inventario.');
        }
        const targetLoc = locRes.rows[0];

        for (const item of items) {
          const qtyToAssign = Number(Number(item.quantity || 0).toFixed(4));
          if (qtyToAssign <= 0) {
            throw new Error('La cantidad a asignar debe ser mayor a 0.');
          }

          // Bloquear fila del producto para evitar inconsistencias en concurrencia
          const prodRes = await client.query(
            `SELECT id, name, code, stock, unit_type, units_per_box, location_id
             FROM public.products
             WHERE id = $1 AND inventory_id = $2
             FOR UPDATE`,
            [item.product_id, p_inventory_id]
          );

          if (prodRes.rows.length === 0) {
            throw new Error(`El producto solicitado no existe en el inventario.`);
          }
          const prod = prodRes.rows[0];

          const assignedRes = await client.query(
            `SELECT COALESCE(SUM(quantity), 0) AS assigned
             FROM public.product_locations
             WHERE product_id = $1`,
            [prod.id]
          );

          const totalStock = Number(prod.stock || 0);
          const alreadyAssigned = Number(assignedRes.rows[0]?.assigned || 0);
          const pendingStock = Math.max(0, Number((totalStock - alreadyAssigned).toFixed(4)));

          if (qtyToAssign > pendingStock + 0.0002) {
            throw new Error(
              `No hay más unidades pendientes por ubicar para el producto "${prod.name}" (Pendiente máx: ${pendingStock}, Solicitado: ${qtyToAssign}).`
            );
          }

          await client.query(
            `INSERT INTO public.product_locations (inventory_id, product_id, location_id, quantity, updated_at)
             VALUES ($1, $2, $3, $4::numeric, NOW())
             ON CONFLICT (product_id, location_id)
             DO UPDATE SET
               quantity = ROUND((public.product_locations.quantity + EXCLUDED.quantity)::numeric, 4),
               updated_at = NOW()`,
            [p_inventory_id, prod.id, targetLoc.id, qtyToAssign]
          );

          await client.query(
            `UPDATE public.products
             SET location_id = COALESCE(location_id, $1),
                 last_modified_by = $2,
                 last_modified_by_email = $3,
                 updated_at = NOW()
             WHERE id = $4`,
            [targetLoc.id, p_user_id || null, p_user_email || 'sistema', prod.id]
          );

          const unitLabel = prod.unit_type === 'BOX' ? 'cajas' : 'unidades';
          const newPending = Math.max(0, Number((pendingStock - qtyToAssign).toFixed(4)));

          await client.query(
            `INSERT INTO public.audit_logs (
               inventory_id, product_id, product_name, user_id, user_email, action_type, details, metadata
             ) VALUES ($1, $2, $3, $4, $5, 'ASSIGN', $6, $7::jsonb)`,
            [
              p_inventory_id,
              prod.id,
              prod.name,
              p_user_id || null,
              p_user_email || 'sistema',
              `Asignadas ${qtyToAssign} ${unitLabel} a la ubicación "${targetLoc.name} (${targetLoc.code})". Stock pendiente por ubicar restante: ${newPending} ${unitLabel}.`,
              JSON.stringify({
                location_id: targetLoc.id,
                location_name: targetLoc.name,
                location_code: targetLoc.code,
                quantity_assigned: qtyToAssign,
                remaining_unassigned: newPending
              })
            ]
          );
        }

        await client.query('COMMIT');
        return res.status(200).json({ success: true });
      } catch (e) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: e.message });
      } finally {
        client.release();
      }
    }

    // RPC: Traslado atómico de stock entre ubicaciones (Origen -> Destino)
    if (fn === 'move_product_location') {
      const {
        p_inventory_id,
        p_product_id,
        p_from_location_id,
        p_to_location_id,
        p_quantity,
        p_reason,
        p_user_id,
        p_user_email
      } = req.body || {};

      const qtyToMove = Number(Number(p_quantity || 0).toFixed(4));
      if (!p_inventory_id || !p_product_id || !p_from_location_id || !p_to_location_id || qtyToMove <= 0) {
        return res.status(400).json({
          message: 'Datos incompletos para realizar el traslado entre ubicaciones.'
        });
      }
      if (p_from_location_id === p_to_location_id) {
        return res.status(400).json({
          message: 'La ubicación de destino debe ser distinta a la ubicación de origen.'
        });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const prodRes = await client.query(
          `SELECT id, name, code, stock, unit_type, units_per_box
           FROM public.products
           WHERE id = $1 AND inventory_id = $2
           FOR UPDATE`,
          [p_product_id, p_inventory_id]
        );
        if (prodRes.rows.length === 0) {
          throw new Error('El producto seleccionado no existe en el inventario.');
        }
        const prod = prodRes.rows[0];

        const locsRes = await client.query(
          `SELECT id, name, code FROM public.locations WHERE inventory_id = $1 AND id IN ($2, $3)`,
          [p_inventory_id, p_from_location_id, p_to_location_id]
        );
        const fromLoc = locsRes.rows.find(l => l.id === p_from_location_id);
        const toLoc = locsRes.rows.find(l => l.id === p_to_location_id);
        if (!fromLoc || !toLoc) {
          throw new Error('La ubicación de origen o destino no es válida.');
        }

        const sourceRowRes = await client.query(
          `SELECT id, quantity
           FROM public.product_locations
           WHERE product_id = $1 AND location_id = $2
           FOR UPDATE`,
          [p_product_id, p_from_location_id]
        );

        const currentSourceQty = Number(sourceRowRes.rows[0]?.quantity || 0);
        if (!sourceRowRes.rows[0] || currentSourceQty + 0.0002 < qtyToMove) {
          throw new Error(
            `Stock insuficiente en la ubicación de origen "${fromLoc.name}". Disponible: ${currentSourceQty}, Solicitado: ${qtyToMove}.`
          );
        }

        const remainingSourceQty = Number((currentSourceQty - qtyToMove).toFixed(4));
        if (remainingSourceQty <= 0.0001) {
          await client.query(
            `DELETE FROM public.product_locations WHERE id = $1`,
            [sourceRowRes.rows[0].id]
          );
        } else {
          await client.query(
            `UPDATE public.product_locations
             SET quantity = $1::numeric, updated_at = NOW()
             WHERE id = $2`,
            [remainingSourceQty, sourceRowRes.rows[0].id]
          );
        }

        await client.query(
          `INSERT INTO public.product_locations (inventory_id, product_id, location_id, quantity, updated_at)
           VALUES ($1, $2, $3, $4::numeric, NOW())
           ON CONFLICT (product_id, location_id)
           DO UPDATE SET
             quantity = ROUND((public.product_locations.quantity + EXCLUDED.quantity)::numeric, 4),
             updated_at = NOW()`,
          [p_inventory_id, p_product_id, p_to_location_id, qtyToMove]
        );

        await client.query(
          `UPDATE public.products
           SET location_id = $1,
               last_modified_by = $2,
               last_modified_by_email = $3,
               updated_at = NOW()
           WHERE id = $4`,
          [p_to_location_id, p_user_id || null, p_user_email || 'sistema', p_product_id]
        );

        const unitLabel = prod.unit_type === 'BOX' ? 'cajas' : 'unidades';
        await client.query(
          `INSERT INTO public.audit_logs (
             inventory_id, product_id, product_name, user_id, user_email, action_type, details, metadata
           ) VALUES ($1, $2, $3, $4, $5, 'MOVE', $6, $7::jsonb)`,
          [
            p_inventory_id,
            prod.id,
            prod.name,
            p_user_id || null,
            p_user_email || 'sistema',
            `Traslado de ${qtyToMove} ${unitLabel} desde "${fromLoc.name} (${fromLoc.code})" hacia "${toLoc.name} (${toLoc.code})". Saldo restante en origen: ${Math.max(0, remainingSourceQty)} ${unitLabel}.${p_reason ? ` Motivo: ${p_reason}` : ''}`,
            JSON.stringify({
              from_location_id: fromLoc.id,
              from_location_name: fromLoc.name,
              to_location_id: toLoc.id,
              to_location_name: toLoc.name,
              quantity_moved: qtyToMove,
              remaining_source_stock: Math.max(0, remainingSourceQty),
              reason: p_reason || null
            })
          ]
        );

        await client.query('COMMIT');
        return res.status(200).json({ success: true });
      } catch (e) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: e.message });
      } finally {
        client.release();
      }
    }

    return res.status(404).json({ code: '42883', message: `Function ${fn} does not exist` });
  } catch (err) {
    console.error(`Error en RPC ${fn}:`, err);
    return res.status(500).json({ message: err.message });
  }
});

// ============================================================================
// 3. MOTOR REST / POSTGREST LOCAL (/rest/v1/:table) CON JOINS AUTOMÁTICOS
// ============================================================================

function buildWhereClause(queryObj, startParamIndex = 1) {
  const clauses = [];
  const values = [];
  let idx = startParamIndex;

  const reserved = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

  for (const [col, rawExpr] of Object.entries(queryObj)) {
    if (reserved.has(col)) continue;
    if (!/^[a-zA-Z0-9_]+$/.test(col)) continue;

    const expr = Array.isArray(rawExpr) ? rawExpr[0] : String(rawExpr);

    if (expr.startsWith('eq.')) {
      clauses.push(`"${col}" = $${idx++}`);
      values.push(expr.slice(3));
    } else if (expr.startsWith('neq.')) {
      clauses.push(`"${col}" <> $${idx++}`);
      values.push(expr.slice(4));
    } else if (expr.startsWith('gt.')) {
      clauses.push(`"${col}" > $${idx++}`);
      values.push(expr.slice(3));
    } else if (expr.startsWith('gte.')) {
      clauses.push(`"${col}" >= $${idx++}`);
      values.push(expr.slice(4));
    } else if (expr.startsWith('lt.')) {
      clauses.push(`"${col}" < $${idx++}`);
      values.push(expr.slice(3));
    } else if (expr.startsWith('lte.')) {
      clauses.push(`"${col}" <= $${idx++}`);
      values.push(expr.slice(4));
    } else if (expr.startsWith('ilike.')) {
      clauses.push(`"${col}" ILIKE $${idx++}`);
      values.push(expr.slice(6).replace(/\*/g, '%'));
    } else if (expr.startsWith('is.')) {
      const target = expr.slice(3).toLowerCase();
      if (target === 'null') clauses.push(`"${col}" IS NULL`);
      else if (target === 'true') clauses.push(`"${col}" IS TRUE`);
      else if (target === 'false') clauses.push(`"${col}" IS FALSE`);
    } else if (expr.startsWith('in.(') && expr.endsWith(')')) {
      const inner = expr.slice(4, -1);
      const list = inner
        .split(',')
        .map(s => s.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
      clauses.push(`"${col}"::text = ANY($${idx++})`);
      values.push(list);
    }
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
    nextIndex: idx
  };
}

/**
 * Hidrata relaciones anidadas solicitadas en ?select=... (ej: categories(...), locations(...), product_locations(*), sale_items(*))
 */
async function enrichRelationalRows(table, rows, selectParam = '') {
  if (!rows || rows.length === 0) return rows;

  // 1. Productos -> categories, subcategories, locations, y distribución multi-ubicación product_locations
  if (table === 'products') {
    const wantsCat = !selectParam || selectParam.includes('categories');
    const wantsSub = !selectParam || selectParam.includes('subcategories');
    const wantsLoc = !selectParam || selectParam.includes('locations');

    const invIds = [...new Set(rows.map(r => r.inventory_id).filter(Boolean))];
    const prodIds = [...new Set(rows.map(r => r.id).filter(Boolean))];

    const [catsRes, subsRes, locsRes, prodLocsRes] = await Promise.all([
      wantsCat && invIds.length > 0
        ? queryLocalDb(`SELECT id, name, color FROM public.categories WHERE inventory_id::text = ANY($1)`, [invIds])
        : { rows: [] },
      wantsSub && invIds.length > 0
        ? queryLocalDb(`SELECT id, name FROM public.subcategories WHERE inventory_id::text = ANY($1)`, [invIds])
        : { rows: [] },
      invIds.length > 0
        ? queryLocalDb(`SELECT id, name, code, description FROM public.locations WHERE inventory_id::text = ANY($1)`, [invIds])
        : { rows: [] },
      prodIds.length > 0
        ? queryLocalDb(
            `SELECT id, inventory_id, product_id, location_id, quantity, created_at, updated_at
             FROM public.product_locations
             WHERE product_id::text = ANY($1) AND quantity > 0
             ORDER BY updated_at DESC`,
            [prodIds]
          )
        : { rows: [] }
    ]);

    const catMap = new Map(catsRes.rows.map(c => [c.id, c]));
    const subMap = new Map(subsRes.rows.map(s => [s.id, s]));
    const locMap = new Map(locsRes.rows.map(l => [l.id, l]));

    const prodLocsByProd = new Map();
    for (const pl of prodLocsRes.rows) {
      if (!prodLocsByProd.has(pl.product_id)) {
        prodLocsByProd.set(pl.product_id, []);
      }
      const locInfo = locMap.get(pl.location_id) || null;
      prodLocsByProd.get(pl.product_id).push({
        ...pl,
        quantity: Number(pl.quantity || 0),
        locations: locInfo
      });
    }

    return rows.map(r => {
      const pLocs = prodLocsByProd.get(r.id) || [];
      const assignedStock = Number(
        pLocs.reduce((acc, item) => acc + Number(item.quantity || 0), 0).toFixed(4)
      );
      const totalStock = Number(r.stock || 0);
      const unassignedStock = Math.max(0, Number((totalStock - assignedStock).toFixed(4)));
      const primaryLocation =
        pLocs.length > 0
          ? pLocs[0].locations
          : r.location_id
            ? locMap.get(r.location_id) || null
            : null;

      return {
        ...r,
        product_locations: pLocs,
        assigned_stock: assignedStock,
        unassigned_stock: unassignedStock,
        ...(wantsCat ? { categories: catMap.get(r.category_id) || null } : {}),
        ...(wantsSub ? { subcategories: subMap.get(r.subcategory_id) || null } : {}),
        ...(wantsLoc ? { locations: pLocs.length > 0 ? primaryLocation : null } : {})
      };
    });
  }

  // 1.b product_locations -> locations, products
  if (table === 'product_locations') {
    const locIds = [...new Set(rows.map(r => r.location_id).filter(Boolean))];
    const locsRes =
      locIds.length > 0
        ? await queryLocalDb(`SELECT id, name, code, description FROM public.locations WHERE id::text = ANY($1)`, [locIds])
        : { rows: [] };
    const locMap = new Map(locsRes.rows.map(l => [l.id, l]));
    return rows.map(r => ({
      ...r,
      quantity: Number(r.quantity || 0),
      locations: locMap.get(r.location_id) || null
    }));
  }

  // 2. inventory_users -> inventories, profiles
  if (table === 'inventory_users') {
    const wantsInv = selectParam.includes('inventories');
    const wantsProf = selectParam.includes('profiles');

    const invIds = [...new Set(rows.map(r => r.inventory_id).filter(Boolean))];
    const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];

    const [invsRes, profsRes] = await Promise.all([
      wantsInv && invIds.length > 0
        ? queryLocalDb(`SELECT * FROM public.inventories WHERE id::text = ANY($1)`, [invIds])
        : { rows: [] },
      wantsProf && userIds.length > 0
        ? queryLocalDb(`SELECT id, email, full_name, avatar_url FROM public.profiles WHERE id::text = ANY($1)`, [userIds])
        : { rows: [] }
    ]);

    const invMap = new Map(invsRes.rows.map(i => [i.id, i]));
    const profMap = new Map(profsRes.rows.map(p => [p.id, p]));

    return rows.map(r => ({
      ...r,
      ...(wantsInv ? { inventories: invMap.get(r.inventory_id) || null } : {}),
      ...(wantsProf ? { profiles: profMap.get(r.user_id) || null } : {})
    }));
  }

  // 3. inventory_invitations -> inventories
  if (table === 'inventory_invitations' && selectParam.includes('inventories')) {
    const invIds = [...new Set(rows.map(r => r.inventory_id).filter(Boolean))];
    const invsRes =
      invIds.length > 0
        ? await queryLocalDb(`SELECT id, name, description, currency, owner_id FROM public.inventories WHERE id::text = ANY($1)`, [invIds])
        : { rows: [] };
    const invMap = new Map(invsRes.rows.map(i => [i.id, i]));
    return rows.map(r => ({
      ...r,
      inventories: invMap.get(r.inventory_id) || null
    }));
  }

  // 4. sales -> items:sale_items(*)
  if (table === 'sales' && selectParam.includes('sale_items')) {
    const saleIds = [...new Set(rows.map(r => r.id).filter(Boolean))];
    const itemsRes =
      saleIds.length > 0
        ? await queryLocalDb(`SELECT * FROM public.sale_items WHERE sale_id::text = ANY($1) ORDER BY created_at ASC`, [saleIds])
        : { rows: [] };

    const itemsBySale = new Map();
    for (const item of itemsRes.rows) {
      if (!itemsBySale.has(item.sale_id)) itemsBySale.set(item.sale_id, []);
      itemsBySale.get(item.sale_id).push(item);
    }

    return rows.map(r => ({
      ...r,
      items: itemsBySale.get(r.id) || [],
      sale_items: itemsBySale.get(r.id) || []
    }));
  }

  // 5. locations -> inventories
  if (table === 'locations' && selectParam.includes('inventories')) {
    const invIds = [...new Set(rows.map(r => r.inventory_id).filter(Boolean))];
    const invsRes =
      invIds.length > 0
        ? await queryLocalDb(`SELECT id, name FROM public.inventories WHERE id::text = ANY($1)`, [invIds])
        : { rows: [] };
    const invMap = new Map(invsRes.rows.map(i => [i.id, i]));
    return rows.map(r => ({
      ...r,
      inventories: invMap.get(r.inventory_id) || null
    }));
  }

  return rows;
}

function rewriteLocalStorageUrlsForHost(row, baseOrigin) {
  if (!row || !baseOrigin) {
    return row;
  }
  const localStorageRegex = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|[\w-]+\.lhr\.life)(:\d+)?\/storage\//i;
  const cloned = { ...row };
  if (Array.isArray(cloned.images)) {
    cloned.images = cloned.images.map(img =>
      typeof img === 'string'
        ? img.replace(localStorageRegex, `${baseOrigin}/storage/`)
        : img
    );
  }
  if (typeof cloned.yape_qr_url === 'string') {
    cloned.yape_qr_url = cloned.yape_qr_url.replace(
      localStorageRegex,
      `${baseOrigin}/storage/`
    );
  }
  if (typeof cloned.plin_qr_url === 'string') {
    cloned.plin_qr_url = cloned.plin_qr_url.replace(
      localStorageRegex,
      `${baseOrigin}/storage/`
    );
  }
  return cloned;
}

function sendPostgrestResponse(req, res, rows, totalCount = null, status = 200) {
  const accept = req.headers.accept || '';
  const prefer = req.headers.prefer || '';
  const originHeader = req.headers.origin || (req.headers.host ? `http://${req.headers.host}` : '');
  const normalizedRows = Array.isArray(rows)
    ? rows.map(r => rewriteLocalStorageUrlsForHost(r, originHeader))
    : rows;

  if (prefer.includes('count=exact')) {
    const count = totalCount !== null ? totalCount : normalizedRows.length;
    res.setHeader('Content-Range', `0-${Math.max(0, normalizedRows.length - 1)}/${count}`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Range-Unit');
  }

  if (accept.includes('application/vnd.pgrst.object+json')) {
    if (!normalizedRows || normalizedRows.length === 0) {
      return res.status(406).json({
        code: 'PGRST116',
        details: 'The result contains 0 rows',
        hint: null,
        message: 'JSON object requested, multiple (or no) rows returned'
      });
    }
    return res.status(status).json(normalizedRows[0]);
  }

  return res.status(status).json(normalizedRows);
}

/**
 * GET /rest/v1/:table
 */
router.get('/rest/v1/:table', async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(404).json({ message: `Table ${table} not found` });
  }

  try {
    const { whereSql, values } = buildWhereClause(req.query, 1);

    let orderSql = '';
    if (req.query.order) {
      const orderParts = String(req.query.order).split(',');
      const parsedOrders = [];
      for (const part of orderParts) {
        const [col, dir] = part.split('.');
        if (/^[a-zA-Z0-9_]+$/.test(col)) {
          parsedOrders.push(`"${col}" ${dir && dir.toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`);
        }
      }
      if (parsedOrders.length > 0) {
        orderSql = `ORDER BY ${parsedOrders.join(', ')}`;
      }
    }

    let limitSql = '';
    let offsetSql = '';

    if (req.headers.range) {
      const match = String(req.headers.range).match(/(\d+)-(\d+)/);
      if (match) {
        const start = Number(match[1]);
        const end = Number(match[2]);
        offsetSql = `OFFSET ${start}`;
        limitSql = `LIMIT ${Math.max(1, end - start + 1)}`;
      }
    } else {
      if (req.query.limit) limitSql = `LIMIT ${Number(req.query.limit)}`;
      if (req.query.offset) offsetSql = `OFFSET ${Number(req.query.offset)}`;
    }

    const sql = `SELECT * FROM public."${table}" ${whereSql} ${orderSql} ${limitSql} ${offsetSql}`;
    const { rows } = await queryLocalDb(sql, values);

    let totalCount = rows.length;
    if ((req.headers.prefer || '').includes('count=exact')) {
      const countRes = await queryLocalDb(`SELECT COUNT(*)::int AS total FROM public."${table}" ${whereSql}`, values);
      totalCount = countRes.rows[0]?.total ?? rows.length;
    }

    const enriched = await enrichRelationalRows(table, rows, String(req.query.select || ''));
    return sendPostgrestResponse(req, res, enriched, totalCount, 200);
  } catch (err) {
    console.error(`Error en GET /rest/v1/${table}:`, err);
    return res.status(400).json({ code: err.code || '400', message: err.message });
  }
});

/**
 * POST /rest/v1/:table (Insert & Upsert)
 */
router.post('/rest/v1/:table', async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(404).json({ message: `Table ${table} not found` });
  }

  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (items.length === 0) return res.status(201).json([]);

    const onConflictCols = req.query.on_conflict
      ? String(req.query.on_conflict)
          .split(',')
          .map(c => c.trim())
          .filter(c => /^[a-zA-Z0-9_]+$/.test(c))
      : [];
    const isUpsert =
      onConflictCols.length > 0 || (req.headers.prefer || '').includes('resolution=merge-duplicates');

    const insertedRows = [];
    for (const rawItem of items) {
      const item = { ...rawItem };

      // Validación Técnica de Unidad de Medida Dual (UNIT / BOX) en productos
      if (table === 'products') {
        const unitType = item.unit_type || 'UNIT';
        item.unit_type = unitType;

        if (unitType === 'BOX') {
          const upb = Number(item.units_per_box);
          if (!Number.isInteger(upb) || upb <= 0) {
            return res.status(400).json({
              code: '22023',
              message: 'Para productos tipo Caja (BOX), units_per_box es obligatorio y debe ser un número entero mayor a 0.'
            });
          }
          item.units_per_box = upb;
          const baseBoxes = Number(item.stock || 0);
          const looseUnits = Number(item.loose_units || 0);
          delete item.loose_units;
          item.stock = Number((baseBoxes + looseUnits / upb).toFixed(4));
        } else {
          item.unit_type = 'UNIT';
          item.units_per_box = null;
          delete item.loose_units;
          item.stock = Math.round(Number(item.stock || 0));
        }
      }

      const cols = Object.keys(item).filter(k => /^[a-zA-Z0-9_]+$/.test(k) && item[k] !== undefined);
      const vals = cols.map(k => {
        const v = item[k];
        if (v !== null && typeof v === 'object') return JSON.stringify(v);
        return v;
      });
      const placeholders = cols.map((_, i) => `$${i + 1}`);

      let conflictSql = '';
      if (isUpsert && onConflictCols.length > 0) {
        const updateSet = cols
          .filter(c => !onConflictCols.includes(c))
          .map(c => `"${c}" = EXCLUDED."${c}"`)
          .join(', ');
        conflictSql = updateSet
          ? `ON CONFLICT (${onConflictCols.map(c => `"${c}"`).join(', ')}) DO UPDATE SET ${updateSet}`
          : `ON CONFLICT (${onConflictCols.map(c => `"${c}"`).join(', ')}) DO NOTHING`;
      }

      const sql = `
        INSERT INTO public."${table}" (${cols.map(c => `"${c}"`).join(', ')})
        VALUES (${placeholders.join(', ')})
        ${conflictSql}
        RETURNING *
      `;
      const { rows } = await queryLocalDb(sql, vals);
      if (rows[0]) insertedRows.push(rows[0]);
    }

    const enriched = await enrichRelationalRows(table, insertedRows, String(req.query.select || ''));
    return sendPostgrestResponse(req, res, enriched, enriched.length, 201);
  } catch (err) {
    console.error(`Error en POST /rest/v1/${table}:`, err);
    return res.status(400).json({ code: err.code || '400', message: err.message });
  }
});

/**
 * PATCH /rest/v1/:table (Update)
 */
router.patch('/rest/v1/:table', async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(404).json({ message: `Table ${table} not found` });
  }

  try {
    const updates = { ...(req.body || {}) };

    // Validación Técnica de Unidad de Medida Dual (UNIT / BOX) en actualización de productos
    if (table === 'products') {
      if (updates.unit_type === 'BOX') {
        const upb = Number(updates.units_per_box);
        if (!Number.isInteger(upb) || upb <= 0) {
          return res.status(400).json({
            code: '22023',
            message: 'Para productos tipo Caja (BOX), units_per_box es obligatorio y debe ser un número entero mayor a 0.'
          });
        }
        updates.units_per_box = upb;
      } else if (updates.unit_type === 'UNIT') {
        updates.units_per_box = null;
        if (updates.stock !== undefined) {
          updates.stock = Math.round(Number(updates.stock || 0));
        }
      }
      if (updates.stock !== undefined) {
        updates.stock = Number(Number(updates.stock).toFixed(4));
      }
    }

    const updateCols = Object.keys(updates).filter(k => /^[a-zA-Z0-9_]+$/.test(k) && updates[k] !== undefined);
    if (updateCols.length === 0) {
      return res.status(200).json([]);
    }

    const setClauses = [];
    const setValues = [];
    let paramIdx = 1;

    for (const col of updateCols) {
      setClauses.push(`"${col}" = $${paramIdx++}`);
      const v = updates[col];
      setValues.push(v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
    }

    const { whereSql, values: whereValues } = buildWhereClause(req.query, paramIdx);
    const sql = `
      UPDATE public."${table}"
      SET ${setClauses.join(', ')}
      ${whereSql}
      RETURNING *
    `;

    const { rows } = await queryLocalDb(sql, [...setValues, ...whereValues]);

    if (table === 'products' && updates.stock !== undefined && rows.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const r of rows) {
          await reconcileProductLocationsWithTotalStock(client, r.id, r.stock);
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }

    const enriched = await enrichRelationalRows(table, rows, String(req.query.select || ''));
    return sendPostgrestResponse(req, res, enriched, enriched.length, 200);
  } catch (err) {
    console.error(`Error en PATCH /rest/v1/${table}:`, err);
    return res.status(400).json({ code: err.code || '400', message: err.message });
  }
});

/**
 * DELETE /rest/v1/:table
 */
router.delete('/rest/v1/:table', async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(404).json({ message: `Table ${table} not found` });
  }

  try {
    const { whereSql, values } = buildWhereClause(req.query, 1);
    const sql = `DELETE FROM public."${table}" ${whereSql} RETURNING *`;
    const { rows } = await queryLocalDb(sql, values);
    return sendPostgrestResponse(req, res, rows, rows.length, 200);
  } catch (err) {
    console.error(`Error en DELETE /rest/v1/${table}:`, err);
    return res.status(400).json({ code: err.code || '400', message: err.message });
  }
});

// ============================================================================
// 4. STORAGE LOCAL PARA IMÁGENES DE PRODUCTOS Y QRS (/storage/v1/*)
// ============================================================================

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

router.all('/storage/v1/object/:bucket/*', express.raw({ type: '*/*', limit: '20mb' }), async (req, res, next) => {
  const { bucket } = req.params;
  if (bucket === 'public') return next();

  if (req.method !== 'POST' && req.method !== 'PUT') return next();

  try {
    const subPath = req.params[0] || `${Date.now()}.jpg`;
    const destPath = path.join(UPLOADS_ROOT, bucket, subPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, req.body);

    return res.status(200).json({
      Key: `${bucket}/${subPath}`
    });
  } catch (err) {
    console.error('Error guardando imagen en storage local:', err);
    return res.status(500).json({ message: err.message });
  }
});

router.use('/storage/v1/object/public', express.static(UPLOADS_ROOT));

export default router;
