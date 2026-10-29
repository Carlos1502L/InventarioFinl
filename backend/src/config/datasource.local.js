import pg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env.local si existe
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const { Pool } = pg;

// Convertir automáticamente columnas NUMERIC/DECIMAL de PostgreSQL (OID 1700) a Number de JavaScript (ej. 1.5, 2, 20)
pg.types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

/**
 * Convierte una URL JDBC o PostgreSQL estándar al formato de conexión de pg
 * Ejemplo soportado: jdbc:postgresql://localhost:5432/pruebaLocalWeb
 */
function parseDatabaseConfig() {
  const rawUrl = process.env.DB_URL || 'jdbc:postgresql://localhost:5432/pruebaLocalWeb';
  const cleanUrl = rawUrl.replace(/^jdbc:/i, '').trim();

  const username = process.env.DB_USERNAME || 'postgres';
  const password = process.env.DB_PASSWORD || 'admin';

  try {
    const parsed = new URL(cleanUrl);
    return {
      host: parsed.hostname || 'localhost',
      port: Number(parsed.port || 5432),
      database: parsed.pathname.replace(/^\//, '') || 'pruebaLocalWeb',
      user: decodeURIComponent(parsed.username || username),
      password: decodeURIComponent(parsed.password || password),
      ddlAuto: process.env.DDL_AUTO || 'update',
      showSql: process.env.SHOW_SQL === 'true'
    };
  } catch {
    return {
      host: 'localhost',
      port: 5432,
      database: 'pruebaLocalWeb',
      user: username,
      password: password,
      ddlAuto: process.env.DDL_AUTO || 'update',
      showSql: process.env.SHOW_SQL === 'true'
    };
  }
}

export const dbConfig = parseDatabaseConfig();

export const pool = new Pool({
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  password: dbConfig.password
});

/**
 * Helper para ejecutar consultas SQL (respeta show-sql si está activo)
 */
export async function queryLocalDb(sql, params = []) {
  if (dbConfig.showSql) {
    console.log('📝 [SQL Local]:', sql, params);
  }
  return pool.query(sql, params);
}

/**
 * Equivalente a spring.jpa.hibernate.ddl-auto = update
 * Crea o actualiza automáticamente todas las tablas del sistema en PostgreSQL local (pgAdmin 4)
 * sin traer ningún dato de Supabase Cloud.
 */
export async function initializeLocalSchema() {
  const client = await pool.connect();
  try {
    console.log(`🔌 [Datasource Local] Conectado a PostgreSQL -> jdbc:postgresql://${dbConfig.host}:${dbConfig.port}/${dbConfig.database} (usuario: ${dbConfig.user})`);

    if (dbConfig.ddlAuto !== 'update' && dbConfig.ddlAuto !== 'create') {
      return;
    }

    console.log('🛠️  [DDL-Auto: update] Sincronizando tablas en la base de datos local (pruebaLocalWeb)...');

    await client.query('BEGIN');

    // Extensiones necesarias para generación de UUIDs
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // 1. Tabla de Usuarios Locales (public.users) visible directamente en pgAdmin 4 -> Schemas -> public -> Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Tabla: profiles
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        full_name TEXT,
        avatar_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. Tabla: inventories
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.inventories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        inventory_type VARCHAR(20) NOT NULL DEFAULT 'BUSINESS' CHECK (inventory_type IN ('PERSONAL', 'BUSINESS')),
        yape_phone TEXT,
        yape_qr_url TEXT,
        plin_phone TEXT,
        plin_qr_url TEXT,
        payment_instructions TEXT,
        owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 4. Tabla: inventory_users
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (inventory_id, user_id)
      );
    `);

    // 5. Tabla: inventory_invitations
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator')),
        invited_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (inventory_id, email)
      );
    `);

    // 6. Tabla: categories
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        color VARCHAR(30) NOT NULL DEFAULT '#3B82F6',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 7. Tabla: subcategories
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.subcategories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
        category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 8. Tabla: locations
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (inventory_id, code)
      );
    `);

    // 9. Tabla: products (Con soporte de Unidad de Medida Dual: UNIT y BOX fraccionable, y stock desacoplado de ubicación)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        description TEXT,
        price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        markup_percentage NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
        unit_type VARCHAR(10) NOT NULL DEFAULT 'UNIT' CHECK (unit_type IN ('UNIT', 'BOX')),
        units_per_box INTEGER NULL,
        stock NUMERIC(12, 4) NOT NULL DEFAULT 0,
        min_stock INTEGER NOT NULL DEFAULT 1,
        category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
        subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
        location_id UUID NULL REFERENCES public.locations(id) ON DELETE SET NULL,
        images JSONB NOT NULL DEFAULT '[]'::jsonb,
        parent_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
        is_variant BOOLEAN NOT NULL DEFAULT FALSE,
        variant_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'WITHDRAWN', 'ARCHIVED')),
        withdrawal_reason TEXT,
        last_modified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
        last_modified_by_email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (inventory_id, code)
      );
    `);

    // Migración automática DDL-Auto: update para tablas products existentes en pruebaLocalWeb
    await client.query(`
      ALTER TABLE public.products
        ADD COLUMN IF NOT EXISTS unit_type VARCHAR(10) NOT NULL DEFAULT 'UNIT' CHECK (unit_type IN ('UNIT', 'BOX')),
        ADD COLUMN IF NOT EXISTS units_per_box INTEGER NULL;
    `);
    await client.query(`
      ALTER TABLE public.products
        ALTER COLUMN stock TYPE NUMERIC(12, 4) USING stock::numeric(12, 4),
        ALTER COLUMN location_id DROP NOT NULL;
    `);

    // 9.b Tabla intermedia de distribución física multi-ubicación: product_locations
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.product_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
        location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
        quantity NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (product_id, location_id)
      );
    `);

    // 10. Tabla: sales
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.sales (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
        seller_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
        seller_email TEXT NOT NULL,
        total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'YAPE', 'PLIN', 'CARD', 'TRANSFER', 'OTHER')),
        customer_name TEXT,
        customer_contact TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 11. Tabla: sale_items
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.sale_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
        product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
        product_name TEXT NOT NULL,
        product_code TEXT NOT NULL,
        quantity NUMERIC(12, 4) NOT NULL CHECK (quantity > 0),
        unit_price NUMERIC(12, 2) NOT NULL,
        cost_price NUMERIC(12, 2) DEFAULT 0.00,
        subtotal NUMERIC(12, 2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE public.sale_items
        ALTER COLUMN quantity TYPE NUMERIC(12, 4) USING quantity::numeric(12, 4);
    `);

    // 12. Tabla: coupons
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.coupons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
        code VARCHAR(50) NOT NULL,
        discount_type VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE' CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
        discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_value >= 0),
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (inventory_id, code)
      );
    `);

    // 13. Tabla: audit_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
        product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
        product_name TEXT,
        user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
        user_email TEXT NOT NULL,
        action_type TEXT NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'MOVE', 'ASSIGN', 'WITHDRAW', 'RESTOCK', 'DELETE', 'SALE')),
        details TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE public.audit_logs
        DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;
      ALTER TABLE public.audit_logs
        ADD CONSTRAINT audit_logs_action_type_check
        CHECK (action_type IN ('CREATE', 'UPDATE', 'MOVE', 'ASSIGN', 'WITHDRAW', 'RESTOCK', 'DELETE', 'SALE'));
    `);

    // Índices de rendimiento
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_local_inv_users_user ON public.inventory_users(user_id);
      CREATE INDEX IF NOT EXISTS idx_local_inv_users_inv ON public.inventory_users(inventory_id);
      CREATE INDEX IF NOT EXISTS idx_local_products_inv ON public.products(inventory_id);
      CREATE INDEX IF NOT EXISTS idx_local_products_code ON public.products(code);
      CREATE INDEX IF NOT EXISTS idx_local_prod_locs_prod ON public.product_locations(product_id);
      CREATE INDEX IF NOT EXISTS idx_local_prod_locs_loc ON public.product_locations(location_id);
      CREATE INDEX IF NOT EXISTS idx_local_prod_locs_inv ON public.product_locations(inventory_id);
      CREATE INDEX IF NOT EXISTS idx_local_sales_inv ON public.sales(inventory_id);
      CREATE INDEX IF NOT EXISTS idx_local_sale_items_sale ON public.sale_items(sale_id);
      CREATE INDEX IF NOT EXISTS idx_local_audit_inv ON public.audit_logs(inventory_id);
    `);

    await client.query('COMMIT');
    console.log('✅ [DDL-Auto: update] 14 tablas verificadas y listas en pruebaLocalWeb (pgAdmin 4).');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [DDL-Auto Error] Error inicializando esquema en PostgreSQL local:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Inicializa el inventario predeterminado para un usuario local recién creado o sin inventarios
 */
export async function ensureUserDefaultInventory(userId, email, fullName) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Asegurar perfil
    await client.query(
      `INSERT INTO public.profiles (id, email, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name)`,
      [userId, email, fullName || email.split('@')[0]]
    );

    // Verificar si ya posee o participa en algún inventario
    const existingOwn = await client.query(
      `SELECT id FROM public.inventories WHERE owner_id = $1 LIMIT 1`,
      [userId]
    );
    if (existingOwn.rows.length > 0) {
      await client.query('COMMIT');
      return existingOwn.rows[0].id;
    }

    const existingMember = await client.query(
      `SELECT inventory_id FROM public.inventory_users WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (existingMember.rows.length > 0) {
      await client.query('COMMIT');
      return existingMember.rows[0].inventory_id;
    }

    // Crear inventario principal por defecto
    const invRes = await client.query(
      `INSERT INTO public.inventories (name, description, currency, inventory_type, owner_id)
       VALUES ('Mi Inventario Principal', 'Inventario local generado automáticamente', 'PEN', 'BUSINESS', $1)
       RETURNING id`,
      [userId]
    );
    const newInvId = invRes.rows[0].id;

    await client.query(
      `INSERT INTO public.inventory_users (inventory_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (inventory_id, user_id) DO NOTHING`,
      [newInvId, userId]
    );

    // Ubicaciones iniciales
    await client.query(
      `INSERT INTO public.locations (inventory_id, name, code, description) VALUES
       ($1, 'Almacén Central', 'LOC-ALM-001', 'Área física principal de almacenamiento'),
       ($1, 'Estante A', 'LOC-EST-A01', 'Estantería de fácil acceso')
       ON CONFLICT DO NOTHING`,
      [newInvId]
    );

    // Categorías iniciales
    const catGenRes = await client.query(
      `INSERT INTO public.categories (inventory_id, name, color, description)
       VALUES ($1, 'General', '#3B82F6', 'Categoría general de productos')
       RETURNING id`,
      [newInvId]
    );
    const catHerrRes = await client.query(
      `INSERT INTO public.categories (inventory_id, name, color, description)
       VALUES ($1, 'Herramientas y Equipos', '#10B981', 'Materiales y herramientas')
       RETURNING id`,
      [newInvId]
    );

    await client.query(
      `INSERT INTO public.subcategories (inventory_id, category_id, name) VALUES
       ($1, $2, 'Suministros'),
       ($1, $3, 'Manuales')`,
      [newInvId, catGenRes.rows[0].id, catHerrRes.rows[0].id]
    );

    await client.query('COMMIT');
    return newInvId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Hash de contraseña simple con SHA-256 para entorno local
 */
export function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}
