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
        exchange_rate: Number(inv.exchange_rate) || 1.000,
        exported_at: new Date().toISOString(),
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
  async restoreInventoryData(inventoryId, backupPayload, userId, currencyConversion = null) {
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

    // Factor de conversión de divisa (RF-3.1)
    let convFactor = 1;
    if (currencyConversion && currencyConversion.enabled && Number(currencyConversion.rate) > 0) {
      const rateNum = Number(currencyConversion.rate);
      if (currencyConversion.operation === 'DIVIDE') {
        convFactor = 1 / rateNum;
      } else if (currencyConversion.operation === 'MULTIPLY') {
        convFactor = rateNum;
      } else {
        const src = (currencyConversion.source_currency || '').toUpperCase();
        const tgt = (currencyConversion.target_currency || '').toUpperCase();
        if (src === 'PEN' && (tgt === 'USD' || tgt === 'EUR')) {
          convFactor = 1 / rateNum;
        } else if ((src === 'USD' || src === 'EUR') && tgt === 'PEN') {
          convFactor = rateNum;
        } else {
          convFactor = 1 / rateNum;
        }
      }
    }

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
      // RF-4.1: MODO WIPE & RESTORE (REEMPLAZO TOTAL LIMPIO)
      // Purgar en cascada únicamente los registros asociados al inventario destino
      // =========================================================================
      const { data: targetSales } = await supabaseAdmin
        .from('sales')
        .select('id')
        .eq('inventory_id', inventoryId);
      const targetSaleIds = (targetSales || []).map((s) => s.id);

      if (targetSaleIds.length > 0) {
        await supabaseAdmin.from('sale_items').delete().in('sale_id', targetSaleIds);
        await supabaseAdmin.from('sales').delete().eq('inventory_id', inventoryId);
      }

      const { data: targetProds } = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('inventory_id', inventoryId);
      const targetProdIds = (targetProds || []).map((p) => p.id);

      if (targetProdIds.length > 0) {
        await supabaseAdmin.from('product_locations').delete().in('product_id', targetProdIds);
      }
      try {
        await supabaseAdmin.from('product_locations').delete().eq('inventory_id', inventoryId);
      } catch (_) {}

      await supabaseAdmin.from('products').delete().eq('inventory_id', inventoryId);
      await supabaseAdmin.from('categories').delete().eq('inventory_id', inventoryId);
      await supabaseAdmin.from('locations').delete().eq('inventory_id', inventoryId);
      await supabaseAdmin.from('coupons').delete().eq('inventory_id', inventoryId);

      // =========================================================================
      // A. CATEGORÍAS (RF-2: Nuevos UUIDs aislados al target_inventory_id)
      // =========================================================================
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        for (const cat of data.categories) {
          if (!cat || !cat.name || !cat.name.trim()) continue;
          const targetCatId = crypto.randomUUID();

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

          insertedRecords.categories.push(targetCatId);
          restoredCounts.categories++;

          if (cat.id) {
            categoryIdMap.set(cat.id, targetCatId);
          }
        }
      }

      // =========================================================================
      // B. UBICACIONES (RF-2: Mapeo independiente y nuevos UUIDs en destino)
      // =========================================================================
      if (Array.isArray(data.locations) && data.locations.length > 0) {
        for (const loc of data.locations) {
          if (!loc || !loc.name || !loc.name.trim()) continue;
          const targetLocId = crypto.randomUUID();
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

          insertedRecords.locations.push(targetLocId);
          restoredCounts.locations++;

          if (loc.id) {
            locationIdMap.set(loc.id, targetLocId);
          }
        }
      }

      // =========================================================================
      // C. PRODUCTOS (RF-2: Remapeo estricto con nuevos UUIDs al target_inventory_id y conversión de divisa)
      // =========================================================================
      if (Array.isArray(data.products) && data.products.length > 0) {
        for (const prod of data.products) {
          if (!prod) continue;
          const targetProdId = crypto.randomUUID();
          let rawCode = (prod.sku || prod.code || '').trim();
          if (!rawCode) {
            rawCode = `SKU-${targetProdId.substring(0, 8).toUpperCase()}`;
          }

          // Remapeo de llaves foráneas a las nuevas entidades del inventario destino
          const mappedCategoryId = prod.category_id ? (categoryIdMap.get(prod.category_id) || null) : null;
          const mappedLocationId = prod.location_id ? (locationIdMap.get(prod.location_id) || null) : null;

          // Conversión de divisa matemática (RF-3.1)
          const rawPrice = Math.max(0, Number(prod.price) || 0);
          const rawCost = Math.max(0, Number(prod.cost_price) || 0);
          const finalPrice = convFactor !== 1 ? Math.round(rawPrice * convFactor * 100) / 100 : rawPrice;
          const finalCost = convFactor !== 1 ? Math.round(rawCost * convFactor * 100) / 100 : rawCost;

          const productPayload = {
            id: targetProdId,
            inventory_id: inventoryId,
            name: (prod.name || 'Producto Restaurado').trim(),
            code: rawCode,
            description: prod.description || null,
            price: finalPrice,
            cost_price: finalCost,
            markup_percentage: Math.max(0, Number(prod.markup_percentage) || 0),
            unit_type: prod.unit_type === 'BOX' ? 'BOX' : 'UNIT',
            units_per_box: prod.units_per_box ? Number(prod.units_per_box) : null,
            stock: Math.max(0, Number(prod.stock) || 0),
            min_stock: Math.max(1, Number(prod.min_stock_alert || prod.min_stock || 1)),
            category_id: mappedCategoryId,
            location_id: mappedLocationId,
            images: Array.isArray(prod.images) ? prod.images : [],
            status: prod.is_active === false || prod.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
            created_at: prod.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { error: insErr } = await supabaseAdmin.from('products').insert(productPayload);
          if (insErr) {
            throw new Error(`Error insertando producto "${productPayload.name}": ${insErr.message}`);
          }

          insertedRecords.products.push(targetProdId);
          restoredCounts.products++;

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
      // E. VENTAS Y DETALLE (Registros con UUIDs nuevos aislados y conversión)
      // =========================================================================
      if (Array.isArray(data.sales) && data.sales.length > 0) {
        for (const sale of data.sales) {
          if (!sale) continue;
          const targetSaleId = crypto.randomUUID();
          const rawTotal = Math.max(0, Number(sale.total_amount) || 0);
          const finalTotal = convFactor !== 1 ? Math.round(rawTotal * convFactor * 100) / 100 : rawTotal;

          const { error: saleErr } = await supabaseAdmin
            .from('sales')
            .insert({
              id: targetSaleId,
              inventory_id: inventoryId,
              seller_email: sale.seller_email || 'restored@system.local',
              total_amount: finalTotal,
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
              const rawUnitPrice = Math.max(0, Number(item.unit_price) || 0);
              const rawCostPrice = Math.max(0, Number(item.cost_price) || 0);
              const rawSubtotal = Math.max(0, Number(item.subtotal) || 0);

              const finalUnitPrice = convFactor !== 1 ? Math.round(rawUnitPrice * convFactor * 100) / 100 : rawUnitPrice;
              const finalCostPrice = convFactor !== 1 ? Math.round(rawCostPrice * convFactor * 100) / 100 : rawCostPrice;
              const finalSubtotal = convFactor !== 1 ? Math.round(rawSubtotal * convFactor * 100) / 100 : rawSubtotal;

              const { error: itemErr } = await supabaseAdmin.from('sale_items').insert({
                id: targetItemId,
                sale_id: targetSaleId,
                product_id: targetProdId,
                product_name: item.product_name || 'Producto Restaurado',
                product_code: item.product_code || 'SKU-RESTORED',
                quantity: Math.max(1, Number(item.quantity || item.quantity_units || 1)),
                unit_price: finalUnitPrice,
                cost_price: finalCostPrice,
                subtotal: finalSubtotal,
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
            .insert({
              inventory_id: inventoryId,
              code: c.code.trim().toUpperCase(),
              discount_type: c.discount_type || 'PERCENTAGE',
              discount_value: Math.max(0, Number(c.discount_value) || 0),
              status: c.is_active === false || c.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
              description: c.description || null,
              created_at: c.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

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
        let details = `Copia de seguridad restaurada exitosamente (Wipe & Restore: ${restoredCounts.products} productos, ${restoredCounts.categories} categorías, ${restoredCounts.locations} ubicaciones)`;
        if (convFactor !== 1) {
          details += ` [Conversión de divisa aplicada: factor ${convFactor.toFixed(4)}]`;
        }

        await supabaseAdmin.from('audit_logs').insert({
          id: crypto.randomUUID(),
          inventory_id: inventoryId,
          user_id: userId || null,
          user_email: 'backup_system',
          action_type: 'UPDATE',
          details
        });
      } catch (auditErr) {
        console.warn('⚠️ Error al registrar auditoría de restore:', auditErr.message);
      }

      return {
        success: true,
        message: 'Copia de seguridad restaurada con reemplazo total (Wipe & Restore) exitosamente.',
        restored_counts: restoredCounts,
        currency_converted: convFactor !== 1
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

  /**
   * Recalcula masivamente los precios de venta y costos de los productos de un inventario
   * en función de la variación de la tasa de cambio (RF-1.2).
   *
   * @param {string} inventoryId - ID del inventario destino
   * @param {number} newRate - Nueva tasa de cambio operativa
   * @param {string} userId - ID del usuario que ejecuta la acción
   * @param {string} [newCurrency] - Nueva moneda si también se actualizó
   * @returns {Promise<Object>}
   */
  async recalculateInventoryPrices(inventoryId, newRate, userId, newCurrency = null) {
    if (!inventoryId) throw new Error('ID de inventario requerido.');
    const targetRate = Number(newRate);
    if (!targetRate || targetRate <= 0) {
      throw new Error('La tasa de cambio debe ser un número positivo mayor a 0.');
    }

    const { data: inv, error: invErr } = await supabaseAdmin
      .from('inventories')
      .select('id, name, currency, exchange_rate')
      .eq('id', inventoryId)
      .single();

    if (invErr || !inv) {
      throw new Error(`Inventario no encontrado: ${invErr?.message || ''}`);
    }

    const prevRate = Number(inv.exchange_rate) || 1.000;
    const ratio = targetRate / prevRate;

    // 1. Recalcular precios de venta y costos de productos activos tomando en cuenta el valor de costo y markup
    const { data: prods, error: pErr } = await supabaseAdmin
      .from('products')
      .select('id, name, price, cost_price, markup_percentage')
      .eq('inventory_id', inventoryId);

    if (pErr) throw new Error(`Error consultando productos: ${pErr.message}`);

    let updatedCount = 0;
    if (Array.isArray(prods) && prods.length > 0) {
      for (const p of prods) {
        const oldCost = Number(p.cost_price) || 0;
        const oldPrice = Number(p.price) || 0;
        const markup = Number(p.markup_percentage) || 0;

        const newCost = Math.round(oldCost * ratio * 100) / 100;
        const newPrice = markup > 0 && newCost > 0
          ? Math.round(newCost * (1 + markup / 100) * 100) / 100
          : Math.round(oldPrice * ratio * 100) / 100;

        const { error: updErr } = await supabaseAdmin
          .from('products')
          .update({
            price: newPrice,
            cost_price: newCost,
            updated_at: new Date().toISOString()
          })
          .eq('id', p.id)
          .eq('inventory_id', inventoryId);

        if (!updErr) {
          updatedCount++;
        }
      }
    }

    // 2. Actualizar inventario con nueva tasa y fecha
    const invUpdate = {
      exchange_rate: targetRate,
      exchange_rate_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (newCurrency && typeof newCurrency === 'string' && newCurrency.trim().length >= 2) {
      invUpdate.currency = newCurrency.trim().toUpperCase();
    }

    const { error: updInvErr } = await supabaseAdmin
      .from('inventories')
      .update(invUpdate)
      .eq('id', inventoryId);

    if (updInvErr) throw new Error(`Error actualizando tasa del inventario: ${updInvErr.message}`);

    const finalCurrency = newCurrency || inv.currency || 'PEN';

    // 3. Registrar en audit_logs
    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: crypto.randomUUID(),
        inventory_id: inventoryId,
        user_id: userId || null,
        user_email: 'currency_system',
        action_type: 'BULK_PRICE_CURRENCY_UPDATE',
        details: `Ajuste masivo de precios por tipo de cambio de ${prevRate.toFixed(3)} a ${targetRate.toFixed(3)} (${finalCurrency}). ${updatedCount} productos actualizados.`,
        created_at: new Date().toISOString()
      });
    } catch (auditErr) {
      console.warn('⚠️ Error al registrar auditoría de recálculo:', auditErr.message);
    }

    return {
      success: true,
      updated_products: updatedCount,
      previous_rate: prevRate,
      new_rate: targetRate,
      currency: finalCurrency,
      ratio
    };
  }
}

export const backupService = new BackupService();
