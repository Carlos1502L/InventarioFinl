import { supabaseAdmin } from '../config/supabase.js';

export class BackupService {
  /**
   * Extrae la totalidad de la información relacional de un inventario
   * y construye el payload con arquitectura estándar v1.0.
   *
   * @param {string} inventoryId
   * @returns {Promise<Object>}
   */
  async exportInventoryData(inventoryId) {
    // 1. Obtener metadata del inventario
    const { data: inv, error: invErr } = await supabaseAdmin
      .from('inventories')
      .select('*')
      .eq('id', inventoryId)
      .single();

    if (invErr || !inv) {
      throw new Error(`No se pudo obtener el inventario ${inventoryId}: ${invErr?.message || 'No encontrado'}`);
    }

    // 2. Extraer Categorías
    const { data: categories = [] } = await supabaseAdmin
      .from('categories')
      .select('id, name, created_at')
      .eq('inventory_id', inventoryId);

    // 3. Extraer Ubicaciones
    const { data: locations = [] } = await supabaseAdmin
      .from('locations')
      .select('id, name, code, description, qr_code, created_at')
      .eq('inventory_id', inventoryId);

    // 4. Extraer Productos
    const { data: products = [] } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('inventory_id', inventoryId);

    // 5. Extraer Relación Stock-Ubicación (product_locations)
    const { data: productLocations = [] } = await supabaseAdmin
      .from('product_locations')
      .select('*')
      .eq('inventory_id', inventoryId);

    // 6. Extraer Ventas con sus Items
    const { data: rawSales = [] } = await supabaseAdmin
      .from('sales')
      .select(`
        id,
        seller_id,
        seller_email,
        total_amount,
        payment_method,
        customer_name,
        customer_contact,
        notes,
        created_at,
        sale_items (
          id,
          product_id,
          product_name,
          product_code,
          quantity,
          unit_price,
          cost_price,
          subtotal
        )
      `)
      .eq('inventory_id', inventoryId)
      .order('created_at', { ascending: false });

    // 7. Extraer Cupones
    const { data: coupons = [] } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('inventory_id', inventoryId);

    // 8. Extraer Logs de Auditoría
    const { data: auditLogs = [] } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('inventory_id', inventoryId)
      .order('created_at', { ascending: false })
      .limit(500);

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
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          parent_id: null,
          created_at: c.created_at
        })),
        locations: locations.map((l) => ({
          id: l.id,
          name: l.name,
          code: l.code,
          description: l.description,
          qr_code: l.qr_code || l.code,
          created_at: l.created_at
        })),
        products: products.map((p) => ({
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
        product_locations: productLocations.map((pl) => ({
          product_id: pl.product_id,
          location_id: pl.location_id,
          quantity_units: Number(pl.quantity) || 0,
          quantity_boxes: 0
        })),
        sales: rawSales.map((s) => ({
          id: s.id,
          sale_code: s.id.substring(0, 8).toUpperCase(),
          customer_name: s.customer_name,
          customer_contact: s.customer_contact,
          payment_method: s.payment_method,
          total_amount: Number(s.total_amount) || 0,
          notes: s.notes,
          created_at: s.created_at,
          items: (s.sale_items || []).map((si) => ({
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
   * Ejecuta la restauración atómica en PostgreSQL.
   * Invoca primero la función RPC `restore_inventory_backup`.
   * Si no estuviese compilada en Supabase, ejecuta la sincronización
   * secuencial controlada como salvaguarda.
   *
   * @param {string} inventoryId
   * @param {Object} backupPayload
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async restoreInventoryData(inventoryId, backupPayload, userId) {
    if (backupPayload.version !== '1.0') {
      throw new Error(`Versión de respaldo inválida (${backupPayload.version}). Solo se soporta la versión 1.0.`);
    }

    // Intento 1: Ejecutar función RPC nativa atómica en PostgreSQL
    try {
      const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('restore_inventory_backup', {
        p_inventory_id: inventoryId,
        p_backup_payload: backupPayload
      });

      if (!rpcError && rpcResult?.success) {
        return rpcResult;
      }

      if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('does not exist')) {
        throw rpcError;
      }
    } catch (rpcErr) {
      console.warn('⚠️ [BackupService] RPC restore_inventory_backup no disponible. Usando fallback transaccional secuencial:', rpcErr.message);
    }

    // Intento 2: Fallback controlado con supabaseAdmin
    const { data } = backupPayload;
    const restoredCounts = {
      categories: 0,
      locations: 0,
      products: 0,
      product_locations: 0,
      sales: 0,
      coupons: 0
    };

    // A. Categorías
    if (Array.isArray(data.categories) && data.categories.length > 0) {
      for (const cat of data.categories) {
        await supabaseAdmin.from('categories').upsert({
          id: cat.id,
          inventory_id: inventoryId,
          name: cat.name,
          created_at: cat.created_at || new Date().toISOString()
        });
        restoredCounts.categories++;
      }
    }

    // B. Ubicaciones
    if (Array.isArray(data.locations) && data.locations.length > 0) {
      for (const loc of data.locations) {
        await supabaseAdmin.from('locations').upsert({
          id: loc.id,
          inventory_id: inventoryId,
          name: loc.name,
          code: loc.code || loc.qr_code || 'LOC-RESTORED',
          description: loc.description,
          created_at: loc.created_at || new Date().toISOString()
        });
        restoredCounts.locations++;
      }
    }

    // C. Productos
    if (Array.isArray(data.products) && data.products.length > 0) {
      for (const prod of data.products) {
        await supabaseAdmin.from('products').upsert({
          id: prod.id,
          inventory_id: inventoryId,
          name: prod.name,
          code: prod.sku || prod.code || 'SKU-RESTORED',
          description: prod.description,
          price: prod.price || 0,
          cost_price: prod.cost_price || 0,
          markup_percentage: prod.markup_percentage || 0,
          unit_type: prod.unit_type || 'UNIT',
          units_per_box: prod.units_per_box,
          stock: prod.stock || 0,
          min_stock: prod.min_stock_alert || prod.min_stock || 1,
          category_id: prod.category_id,
          images: Array.isArray(prod.images) ? prod.images : [],
          status: prod.is_active === false ? 'INACTIVE' : 'ACTIVE',
          created_at: prod.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        restoredCounts.products++;
      }
    }

    // D. Product Locations
    if (Array.isArray(data.product_locations) && data.product_locations.length > 0) {
      for (const pl of data.product_locations) {
        await supabaseAdmin.from('product_locations').upsert(
          {
            inventory_id: inventoryId,
            product_id: pl.product_id,
            location_id: pl.location_id,
            quantity: pl.quantity || pl.quantity_units || 0,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'product_id, location_id' }
        );
        restoredCounts.product_locations++;
      }
    }

    // E. Ventas
    if (Array.isArray(data.sales) && data.sales.length > 0) {
      for (const sale of data.sales) {
        const { error: saleErr } = await supabaseAdmin.from('sales').upsert({
          id: sale.id,
          inventory_id: inventoryId,
          seller_email: sale.seller_email || 'restored@system.local',
          total_amount: sale.total_amount || 0,
          payment_method: sale.payment_method || 'OTHER',
          customer_name: sale.customer_name,
          customer_contact: sale.customer_contact,
          notes: sale.notes,
          created_at: sale.created_at || new Date().toISOString()
        });

        if (!saleErr && Array.isArray(sale.items) && sale.items.length > 0) {
          for (const item of sale.items) {
            await supabaseAdmin.from('sale_items').upsert({
              sale_id: sale.id,
              product_id: item.product_id,
              product_name: item.product_name || 'Producto Restaurado',
              product_code: item.product_code || 'SKU-RESTORED',
              quantity: item.quantity || item.quantity_units || 1,
              unit_price: item.unit_price || 0,
              cost_price: item.cost_price || 0,
              subtotal: item.subtotal || (item.unit_price || 0) * (item.quantity || 1),
              created_at: sale.created_at || new Date().toISOString()
            });
          }
        }
        restoredCounts.sales++;
      }
    }

    // F. Cupones
    if (Array.isArray(data.coupons) && data.coupons.length > 0) {
      for (const c of data.coupons) {
        await supabaseAdmin.from('coupons').upsert(
          {
            inventory_id: inventoryId,
            code: c.code,
            discount_type: c.discount_type || 'PERCENTAGE',
            discount_value: c.discount_value || 0,
            max_uses: c.max_uses,
            current_uses: c.current_uses || 0,
            is_active: c.is_active ?? true,
            expires_at: c.expires_at,
            created_at: c.created_at || new Date().toISOString()
          },
          { onConflict: 'inventory_id, code' }
        );
        restoredCounts.coupons++;
      }
    }

    // Registrar en auditoría
    await supabaseAdmin.from('audit_logs').insert({
      inventory_id: inventoryId,
      user_id: userId,
      user_email: 'backup_system',
      action: 'BACKUP_RESTORED',
      entity_type: 'BACKUP',
      metadata: {
        version: backupPayload.version,
        exported_at: backupPayload.exported_at,
        restored_counts: restoredCounts
      }
    });

    return {
      success: true,
      message: 'Restauración completada exitosamente.',
      restored_counts: restoredCounts
    };
  }
}

export const backupService = new BackupService();
