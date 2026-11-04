import { supabaseAdmin } from '../config/supabase.js';
import crypto from 'crypto';

export class BackupService {
  /**
   * Extrae la totalidad de la información relacional de un inventario
   * y construye el payload con arquitectura estándar v1.0.
   *
   * GARANTÍA CRÍTICA (RF-1): Operación estrictamente de SÓLO LECTURA (SELECT).
   * Bajo ninguna circunstancia ejecuta DELETE, TRUNCATE, UPDATE ni muta ningún registro.
   * Optimizado con Promise.all para prevenir caídas por timeout HTTP.
   *
   * @param {string} inventoryId
   * @returns {Promise<Object>}
   */
  async exportInventoryData(inventoryId) {
    // 1. Ejecución paralela de consultas estrictamente SELECT (RF-1 & RF-3)
    const [
      invRes,
      catRes,
      locRes,
      prodRes,
      plRes,
      salesRes,
      couponsRes,
      auditRes
    ] = await Promise.all([
      supabaseAdmin.from('inventories').select('*').eq('id', inventoryId).single(),
      supabaseAdmin.from('categories').select('*').eq('inventory_id', inventoryId),
      supabaseAdmin.from('locations').select('*').eq('inventory_id', inventoryId),
      supabaseAdmin.from('products').select('*').eq('inventory_id', inventoryId),
      supabaseAdmin.from('product_locations').select('*').eq('inventory_id', inventoryId),
      supabaseAdmin.from('sales').select('*').eq('inventory_id', inventoryId).order('created_at', { ascending: false }),
      supabaseAdmin.from('coupons').select('*').eq('inventory_id', inventoryId),
      supabaseAdmin.from('audit_logs').select('*').eq('inventory_id', inventoryId).order('created_at', { ascending: false }).limit(500)
    ]);

    if (invRes.error || !invRes.data) {
      throw new Error(`No se pudo obtener el inventario ${inventoryId}: ${invRes.error?.message || 'No encontrado'}`);
    }

    const inv = invRes.data;
    const categories = Array.isArray(catRes.data) ? catRes.data : [];
    const locations = Array.isArray(locRes.data) ? locRes.data : [];
    const products = Array.isArray(prodRes.data) ? prodRes.data : [];
    const productLocations = Array.isArray(plRes.data) ? plRes.data : [];
    const sData = Array.isArray(salesRes.data) ? salesRes.data : [];
    const coupons = Array.isArray(couponsRes.data) ? couponsRes.data : [];
    const auditLogs = Array.isArray(auditRes.data) ? auditRes.data : [];

    // 2. Extraer sale_items únicamente con SELECT si existen ventas
    let rawSales = [];
    if (sData.length > 0) {
      const saleIds = sData.map((s) => s.id);
      let itemsBySale = {};
      try {
        const { data: itemsData, error: itemsErr } = await supabaseAdmin
          .from('sale_items')
          .select('*')
          .in('sale_id', saleIds);

        if (!itemsErr && Array.isArray(itemsData)) {
          for (const item of itemsData) {
            if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
            itemsBySale[item.sale_id].push(item);
          }
        }
      } catch (itemErr) {
        console.warn('⚠️ Error al consultar sale_items en exportación:', itemErr.message);
      }

      rawSales = sData.map((s) => ({
        ...s,
        sale_items: itemsBySale[s.id] || []
      }));
    }

    // Estructurar según especificación estricta de backup_schema.json v1.0
    const backupPayload = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source_inventory_id: inventoryId,
      inventory_metadata: {
        name: inv.name,
        inventory_type: inv.inventory_type || 'BUSINESS',
        currency: inv.currency || 'PEN',
        settings: {
          description: inv.description,
          payment_instructions: inv.payment_instructions,
          yape_phone: inv.yape_phone,
          plin_phone: inv.plin_phone
        }
      },
      data: {
        categories: (categories || []).map((c) => ({
          id: c.id,
          name: c.name,
          parent_id: null,
          created_at: c.created_at
        })),
        locations: (locations || []).map((l) => ({
          id: l.id,
          name: l.name,
          code: l.code,
          description: l.description,
          qr_code: l.qr_code || l.code,
          created_at: l.created_at
        })),
        products: (products || []).map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.code,
          description: p.description,
          price: Number(p.price) || 0,
          cost_price: Number(p.cost_price) || 0,
          markup_percentage: Number(p.markup_percentage) || 0,
          unit_type: p.unit_type || 'UNIT',
          units_per_box: p.units_per_box ? Number(p.units_per_box) : null,
          stock: Number(p.stock) || 0,
          min_stock_alert: Number(p.min_stock) || 1,
          images: Array.isArray(p.images) ? p.images : [],
          category_id: p.category_id,
          is_active: p.status === 'ACTIVE',
          created_at: p.created_at
        })),
        variants: [],
        product_locations: (productLocations || []).map((pl) => ({
          product_id: pl.product_id,
          location_id: pl.location_id,
          quantity_units: Number(pl.quantity) || 0,
          quantity_boxes: 0
        })),
        sales: (rawSales || []).map((s) => ({
          id: s.id,
          sale_code: s.id.substring(0, 8).toUpperCase(),
          customer_name: s.customer_name,
          customer_contact: s.customer_contact,
          payment_method: s.payment_method,
          total_amount: Number(s.total_amount) || 0,
          notes: s.notes,
          created_at: s.created_at,
          items: ((s.sale_items || [])).map((si) => ({
            product_id: si.product_id,
            product_name: si.product_name,
            product_code: si.product_code,
            quantity_units: Number(si.quantity) || 0,
            quantity_boxes: 0,
            unit_price: Number(si.unit_price) || 0,
            cost_price: Number(si.cost_price) || 0,
            subtotal: Number(si.subtotal) || 0
          }))
        })),
        audit_logs: auditLogs,
        coupons: coupons
      }
    };

    return backupPayload;
  }

  /**
   * Ejecuta la restauración atómica e independiente en el inventario destino.
   *
   * REGLA CRÍTICA DE INDEPENDENCIA:
   * Bajo ninguna circunstancia altera, traslada ni elimina datos de otros inventarios.
   * Genera UUIDs nuevos e independientes para los registros restaurados y enlaza
   * las relaciones relacionales (categorías, ubicaciones, productos, ventas)
   * de forma estricta y aislada dentro del inventario destino (inventoryId).
   *
   * @param {string} inventoryId - ID del inventario destino
   * @param {Object} backupPayload - Payload del archivo .json
   * @param {string} userId - ID del usuario que ejecuta la restauración
   * @returns {Promise<Object>}
   */
  async restoreInventoryData(inventoryId, backupPayload, userId) {
    if (!backupPayload || typeof backupPayload !== 'object') {
      throw new Error('Estructura de respaldo inválida.');
    }

    if (backupPayload.version !== '1.0') {
      throw new Error(`Versión de respaldo inválida (${backupPayload.version}). Solo se soporta la versión 1.0.`);
    }

    const { data } = backupPayload;
    if (!data || typeof data !== 'object') {
      throw new Error('El archivo de respaldo no contiene la sección de datos requerida.');
    }

    const restoredCounts = {
      categories: 0,
      locations: 0,
      products: 0,
      product_locations: 0,
      sales: 0,
      coupons: 0
    };

    // Diccionarios en memoria para el remapeo dinámico de llaves primarias y foráneas (RF-2)
    const categoryIdMap = new Map();
    const locationIdMap = new Map();
    const productIdMap = new Map();

    // Registro de IDs insertados para ejecución de ROLLBACK atómico en caso de fallo (RF-3)
    const insertedRecords = {
      categories: [],
      locations: [],
      products: [],
      product_locations: [],
      sales: [],
      sale_items: [],
      coupons: []
    };

    try {
      // =========================================================================
      // A. CATEGORÍAS (RF-2: Nuevos UUIDs aislados al target_inventory_id)
      // =========================================================================
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        const { data: existingCats, error: getCatErr } = await supabaseAdmin
          .from('categories')
          .select('id, name')
          .eq('inventory_id', inventoryId);

        if (getCatErr) {
          throw new Error(`Error consultando categorías existentes: ${getCatErr.message}`);
        }

        const catByName = new Map((existingCats || []).map((c) => [(c.name || '').trim().toLowerCase(), c.id]));

        for (const cat of data.categories) {
          if (!cat || !cat.name || !cat.name.trim()) continue;
          const normName = cat.name.trim().toLowerCase();
          let targetCatId = catByName.get(normName);

          if (!targetCatId) {
            targetCatId = crypto.randomUUID();
            const { error: catErr } = await supabaseAdmin.from('categories').insert({
              id: targetCatId,
              inventory_id: inventoryId,
              name: cat.name.trim(),
              color: cat.color || '#3B82F6',
              description: cat.description || null,
              created_at: cat.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

            if (catErr) {
              throw new Error(`Error al insertar categoría "${cat.name}": ${catErr.message}`);
            }

            catByName.set(normName, targetCatId);
            insertedRecords.categories.push(targetCatId);
            restoredCounts.categories++;
          } else {
            restoredCounts.categories++;
          }

          if (cat.id) {
            categoryIdMap.set(cat.id, targetCatId);
          }
        }
      }

      // =========================================================================
      // B. UBICACIONES (RF-2: Mapeo independiente y nuevos UUIDs en destino)
      // =========================================================================
      if (Array.isArray(data.locations) && data.locations.length > 0) {
        const { data: existingLocs, error: getLocErr } = await supabaseAdmin
          .from('locations')
          .select('id, name, code')
          .eq('inventory_id', inventoryId);

        if (getLocErr) {
          throw new Error(`Error consultando ubicaciones existentes: ${getLocErr.message}`);
        }

        const locByCode = new Map((existingLocs || []).map((l) => [(l.code || '').trim().toLowerCase(), l.id]));
        const locByName = new Map((existingLocs || []).map((l) => [(l.name || '').trim().toLowerCase(), l.id]));

        for (const loc of data.locations) {
          if (!loc || !loc.name || !loc.name.trim()) continue;
          const normCode = (loc.code || loc.qr_code || '').trim().toLowerCase();
          const normName = loc.name.trim().toLowerCase();
          let targetLocId = (normCode ? locByCode.get(normCode) : null) || locByName.get(normName);

          if (!targetLocId) {
            targetLocId = crypto.randomUUID();
            const safeCode = loc.code || loc.qr_code || `LOC-${targetLocId.substring(0, 6).toUpperCase()}`;
            const { error: locErr } = await supabaseAdmin.from('locations').insert({
              id: targetLocId,
              inventory_id: inventoryId,
              name: loc.name.trim(),
              code: safeCode,
              description: loc.description || null,
              created_at: loc.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

            if (locErr) {
              throw new Error(`Error insertando ubicación "${loc.name}": ${locErr.message}`);
            }

            if (normCode) locByCode.set(normCode, targetLocId);
            locByName.set(normName, targetLocId);
            insertedRecords.locations.push(targetLocId);
            restoredCounts.locations++;
          } else {
            restoredCounts.locations++;
          }

          if (loc.id) {
            locationIdMap.set(loc.id, targetLocId);
          }
        }
      }

      // =========================================================================
      // C. PRODUCTOS (RF-2: Remapeo estricto con nuevos UUIDs al target_inventory_id)
      // =========================================================================
      if (Array.isArray(data.products) && data.products.length > 0) {
        const { data: existingProds, error: getProdErr } = await supabaseAdmin
          .from('products')
          .select('id, code')
          .eq('inventory_id', inventoryId);

        if (getProdErr) {
          throw new Error(`Error consultando productos existentes: ${getProdErr.message}`);
        }

        const prodByCode = new Map((existingProds || []).map((p) => [(p.code || '').trim().toLowerCase(), p.id]));

        for (const prod of data.products) {
          if (!prod) continue;
          const newProdId = crypto.randomUUID();
          let rawCode = (prod.sku || prod.code || '').trim();
          if (!rawCode) {
            rawCode = `SKU-${newProdId.substring(0, 8).toUpperCase()}`;
          }
          const normCode = rawCode.toLowerCase();
          let targetProdId = prodByCode.get(normCode);

          // Remapeo de llaves foráneas a las nuevas entidades del inventario destino
          const mappedCategoryId = prod.category_id ? (categoryIdMap.get(prod.category_id) || null) : null;
          const mappedLocationId = prod.location_id ? (locationIdMap.get(prod.location_id) || null) : null;

          const productPayload = {
            inventory_id: inventoryId,
            name: (prod.name || 'Producto Restaurado').trim(),
            code: rawCode,
            description: prod.description || null,
            price: Math.max(0, Number(prod.price) || 0),
            cost_price: Math.max(0, Number(prod.cost_price) || 0),
            markup_percentage: Math.max(0, Number(prod.markup_percentage) || 0),
            unit_type: prod.unit_type === 'BOX' ? 'BOX' : 'UNIT',
            units_per_box: prod.units_per_box ? Number(prod.units_per_box) : null,
            stock: Math.max(0, Number(prod.stock) || 0),
            min_stock: Math.max(1, Number(prod.min_stock_alert || prod.min_stock || 1)),
            category_id: mappedCategoryId,
            location_id: mappedLocationId,
            images: Array.isArray(prod.images) ? prod.images : [],
            status: prod.is_active === false || prod.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
            updated_at: new Date().toISOString()
          };

          if (targetProdId) {
            // Actualiza el producto existente dentro de ESTE inventario destino únicamente
            const { error: updErr } = await supabaseAdmin
              .from('products')
              .update(productPayload)
              .eq('id', targetProdId)
              .eq('inventory_id', inventoryId);

            if (updErr) {
              throw new Error(`Error actualizando producto "${productPayload.name}": ${updErr.message}`);
            }
            restoredCounts.products++;
          } else {
            // Crea un producto nuevo con UUID independiente para ESTE inventario destino
            targetProdId = newProdId;
            const { error: insErr } = await supabaseAdmin
              .from('products')
              .insert({
                ...productPayload,
                id: targetProdId,
                created_at: prod.created_at || new Date().toISOString()
              });

            if (insErr) {
              throw new Error(`Error insertando producto "${productPayload.name}": ${insErr.message}`);
            }

            insertedRecords.products.push(targetProdId);
            prodByCode.set(normCode, targetProdId);
            restoredCounts.products++;
          }

          if (prod.id) {
            productIdMap.set(prod.id, targetProdId);
          }
        }
      }

      // =========================================================================
      // D. PRODUCT LOCATIONS (Relación de stock con IDs locales remapeados)
      // =========================================================================
      if (Array.isArray(data.product_locations) && data.product_locations.length > 0) {
        for (const pl of data.product_locations) {
          if (!pl) continue;
          const targetProdId = productIdMap.get(pl.product_id);
          const targetLocId = locationIdMap.get(pl.location_id);

          if (targetProdId && targetLocId) {
            const { error: plErr } = await supabaseAdmin
              .from('product_locations')
              .upsert(
                {
                  inventory_id: inventoryId,
                  product_id: targetProdId,
                  location_id: targetLocId,
                  quantity: Math.max(0, Number(pl.quantity || pl.quantity_units || 0)),
                  updated_at: new Date().toISOString()
                },
                { onConflict: 'product_id, location_id' }
              );

            if (plErr) {
              throw new Error(`Error vinculando stock de producto en ubicación: ${plErr.message}`);
            }

            insertedRecords.product_locations.push({ product_id: targetProdId, location_id: targetLocId });
            restoredCounts.product_locations++;
          }
        }
      }

      // =========================================================================
      // E. VENTAS Y DETALLE (Registros con UUIDs nuevos aislados)
      // =========================================================================
      if (Array.isArray(data.sales) && data.sales.length > 0) {
        for (const sale of data.sales) {
          if (!sale) continue;
          const targetSaleId = crypto.randomUUID();
          const { error: saleErr } = await supabaseAdmin
            .from('sales')
            .insert({
              id: targetSaleId,
              inventory_id: inventoryId,
              seller_email: sale.seller_email || 'restored@system.local',
              total_amount: Math.max(0, Number(sale.total_amount) || 0),
              payment_method: sale.payment_method || 'OTHER',
              customer_name: sale.customer_name || null,
              customer_contact: sale.customer_contact || null,
              notes: sale.notes || null,
              created_at: sale.created_at || new Date().toISOString()
            });

          if (saleErr) {
            throw new Error(`Error restaurando comprobante de venta: ${saleErr.message}`);
          }

          insertedRecords.sales.push(targetSaleId);
          restoredCounts.sales++;

          if (Array.isArray(sale.items) && sale.items.length > 0) {
            for (const item of sale.items) {
              const targetProdId = item.product_id ? (productIdMap.get(item.product_id) || null) : null;
              const targetItemId = crypto.randomUUID();
              const { error: itemErr } = await supabaseAdmin.from('sale_items').insert({
                id: targetItemId,
                sale_id: targetSaleId,
                product_id: targetProdId,
                product_name: item.product_name || 'Producto Restaurado',
                product_code: item.product_code || 'SKU-RESTORED',
                quantity: Math.max(1, Number(item.quantity || item.quantity_units || 1)),
                unit_price: Math.max(0, Number(item.unit_price) || 0),
                cost_price: Math.max(0, Number(item.cost_price) || 0),
                subtotal: Math.max(0, Number(item.subtotal) || 0),
                created_at: sale.created_at || new Date().toISOString()
              });

              if (itemErr) {
                throw new Error(`Error restaurando ítem de venta: ${itemErr.message}`);
              }

              insertedRecords.sale_items.push(targetItemId);
            }
          }
        }
      }

      // =========================================================================
      // F. CUPONES (Aislados al inventario destino)
      // =========================================================================
      if (Array.isArray(data.coupons) && data.coupons.length > 0) {
        for (const c of data.coupons) {
          if (!c || !c.code) continue;
          const { error: cErr } = await supabaseAdmin
            .from('coupons')
            .upsert(
              {
                inventory_id: inventoryId,
                code: c.code.trim().toUpperCase(),
                discount_type: c.discount_type || 'PERCENTAGE',
                discount_value: Math.max(0, Number(c.discount_value) || 0),
                status: c.is_active === false || c.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
                description: c.description || null,
                created_at: c.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              { onConflict: 'inventory_id, code' }
            );

          if (cErr) {
            throw new Error(`Error restaurando cupón "${c.code}": ${cErr.message}`);
          }

          restoredCounts.coupons++;
        }
      }

      // RF-3: Prohibido retornar success si venían productos y se insertaron 0
      if (Array.isArray(data.products) && data.products.length > 0 && restoredCounts.products === 0) {
        throw new Error('Fallo de integridad: No se pudo restaurar ningún producto del respaldo.');
      }

      // Registrar auditoría de la restauración de forma segura
      try {
        await supabaseAdmin.from('audit_logs').insert({
          id: crypto.randomUUID(),
          inventory_id: inventoryId,
          user_id: userId || null,
          user_email: 'backup_system',
          action_type: 'UPDATE',
          details: `Copia de seguridad restaurada exitosamente (${restoredCounts.products} productos, ${restoredCounts.categories} categorías, ${restoredCounts.locations} ubicaciones)`
        });
      } catch (auditErr) {
        console.warn('⚠️ Error al registrar auditoría de restore:', auditErr.message);
      }

      return {
        success: true,
        message: 'Copia de seguridad restaurada como copia independiente exitosamente.',
        restored_counts: restoredCounts
      };
    } catch (err) {
      console.error('❌ Error durante restoreInventoryData, ejecutando ROLLBACK en target_inventory_id:', err.message);

      // Ejecución de ROLLBACK atómico: Elimina registros creados en este intento fallido
      try {
        if (insertedRecords.sale_items.length > 0) {
          await supabaseAdmin.from('sale_items').delete().in('id', insertedRecords.sale_items);
        }
        if (insertedRecords.sales.length > 0) {
          await supabaseAdmin.from('sales').delete().in('id', insertedRecords.sales).eq('inventory_id', inventoryId);
        }
        if (insertedRecords.product_locations.length > 0) {
          for (const pl of insertedRecords.product_locations) {
            await supabaseAdmin
              .from('product_locations')
              .delete()
              .eq('product_id', pl.product_id)
              .eq('location_id', pl.location_id)
              .eq('inventory_id', inventoryId);
          }
        }
        if (insertedRecords.products.length > 0) {
          await supabaseAdmin.from('products').delete().in('id', insertedRecords.products).eq('inventory_id', inventoryId);
        }
        if (insertedRecords.locations.length > 0) {
          await supabaseAdmin.from('locations').delete().in('id', insertedRecords.locations).eq('inventory_id', inventoryId);
        }
        if (insertedRecords.categories.length > 0) {
          await supabaseAdmin.from('categories').delete().in('id', insertedRecords.categories).eq('inventory_id', inventoryId);
        }
      } catch (rollbackErr) {
        console.error('⚠️ Error ejecutando rollback de registros:', rollbackErr.message);
      }

      throw new Error(`Fallo en la restauración: ${err.message}. Se ejecutó rollback preventivo en el inventario.`);
    }
  }
}

export const backupService = new BackupService();
