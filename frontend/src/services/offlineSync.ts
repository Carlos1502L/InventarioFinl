import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '../lib/supabase';
import { showAppToast } from '../components/ui/ToastNotification';

// =========================================================
// ESQUEMAS Y TIPOS DE INDEXEDDB (pos_offline_db v2)
// =========================================================

export interface QueuedSalePayload {
  p_inventory_id: string;
  p_seller_id: string;
  p_seller_email?: string | null;
  p_total_amount: number;
  p_payment_method: string;
  p_customer_name?: string | null;
  p_customer_contact?: string | null;
  p_notes?: string | null;
  p_items: any[];
  p_coupon_code?: string | null;
  p_discount_amount?: number;
}

export interface QueuedSale {
  local_id?: number;
  payload: QueuedSalePayload;
  status: 'PENDING' | 'SYNCED' | 'FAILED_STOCK';
  created_at: string; // ISO String
  synced_at?: string | null;
  error_message?: string | null;
}

export interface QueuedProduct {
  local_temp_id: string; // Generado con crypto.randomUUID()
  product_data: {
    inventory_id: string;
    name: string;
    sku: string;
    code?: string;
    description?: string;
    category_id?: string;
    sub_category_id?: string;
    subcategory_id?: string;
    cost_price?: number;
    price?: number;
    unit_type?: 'UNIT' | 'BOX';
    units_per_box?: number;
    stock?: number;
    min_stock_alert?: number;
    min_stock?: number;
    location_id?: string | null;
    is_variant?: boolean;
    parent_id?: string | null;
    variant_attributes?: Record<string, string>;
    status?: 'ACTIVE';
    last_modified_by?: string;
    last_modified_by_email?: string;
  };
  // Archivos binarios de fotos procesadas en frontend
  images_blobs: Array<{
    filename: string;
    blob: Blob; // Comprimido WebP < 300KB
  }>;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR';
  created_at: string; // ISO String
  synced_at?: string | null;
  real_product_id?: string | null;
  error_message?: string | null;
}

export interface QueuedWithdrawalItem {
  product_id: string;
  variant_id?: string | null;
  quantity_units: number;
  quantity_boxes?: number;
  product_name?: string;
  unit_type?: 'UNIT' | 'BOX';
  units_per_box?: number | null;
}

export interface QueuedWithdrawal {
  local_id?: number; // Auto-incremental
  inventory_id: string;
  reason: string;
  notes?: string;
  user_id?: string;
  user_email?: string;
  items: QueuedWithdrawalItem[];
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED_STOCK';
  created_at: string; // ISO String
  synced_at?: string | null;
  error_message?: string | null;
}

interface PosOfflineDB extends DBSchema {
  sales_queue: {
    key: number;
    value: QueuedSale;
    indexes: {
      'by-status': string;
      'by-created_at': string;
    };
  };
  products_queue: {
    key: string;
    value: QueuedProduct;
    indexes: {
      'by-status': string;
      'by-created_at': string;
    };
  };
  withdrawals_queue: {
    key: number;
    value: QueuedWithdrawal;
    indexes: {
      'by-status': string;
      'by-created_at': string;
    };
  };
}

const DB_NAME = 'pos_offline_db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<PosOfflineDB>> | null = null;

// Mapa en memoria para correlacionar IDs temporales locales con IDs definitivos de Supabase
export const offlineTempIdMap = new Map<string, string>();

export function getDB(): Promise<IDBPDatabase<PosOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PosOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sales_queue')) {
          const store = db.createObjectStore('sales_queue', {
            keyPath: 'local_id',
            autoIncrement: true
          });
          store.createIndex('by-status', 'status');
          store.createIndex('by-created_at', 'created_at');
        }

        if (!db.objectStoreNames.contains('products_queue')) {
          const prodStore = db.createObjectStore('products_queue', {
            keyPath: 'local_temp_id'
          });
          prodStore.createIndex('by-status', 'status');
          prodStore.createIndex('by-created_at', 'created_at');
        }

        if (!db.objectStoreNames.contains('withdrawals_queue')) {
          const withStore = db.createObjectStore('withdrawals_queue', {
            keyPath: 'local_id',
            autoIncrement: true
          });
          withStore.createIndex('by-status', 'status');
          withStore.createIndex('by-created_at', 'created_at');
        }
      }
    });
  }
  return dbPromise;
}

// =========================================================
// MÉTODOS DE COLA DE VENTAS (sales_queue)
// =========================================================

/**
 * Inserta una venta en la cola local con estado 'PENDING'.
 */
export async function saveSaleLocally(payload: QueuedSalePayload): Promise<number> {
  const db = await getDB();
  const sale: QueuedSale = {
    payload,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    synced_at: null,
    error_message: null
  };
  const localId = await db.add('sales_queue', sale);
  return localId as number;
}

/**
 * Retorna todas las ventas con estado 'PENDING' ordenadas por created_at ASC (FIFO).
 */
export async function getPendingSales(): Promise<QueuedSale[]> {
  try {
    const db = await getDB();
    const all = await db.getAll('sales_queue');
    return all
      .filter((item) => item.status === 'PENDING')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } catch (err) {
    console.error('[OfflineDB] Error obteniendo ventas pendientes:', err);
    return [];
  }
}

/**
 * Retorna la cantidad de ventas pendientes por sincronizar.
 */
export async function getPendingSalesCount(): Promise<number> {
  const pending = await getPendingSales();
  return pending.length;
}

/**
 * Actualiza el estado de una venta a 'SYNCED'.
 */
export async function markSaleSynced(localId: number, serverResponse?: any): Promise<void> {
  try {
    const db = await getDB();
    const item = await db.get('sales_queue', localId);
    if (item) {
      item.status = 'SYNCED';
      item.synced_at = new Date().toISOString();
      await db.put('sales_queue', item);
    }
  } catch (err) {
    console.error(`[OfflineDB] Error marcando venta #${localId} como sincronizada:`, err);
  }
}

/**
 * Actualiza el estado de una venta a 'FAILED_STOCK' para evitar bucles infinitos.
 */
export async function markSaleFailed(localId: number, errorMessage: string): Promise<void> {
  try {
    const db = await getDB();
    const item = await db.get('sales_queue', localId);
    if (item) {
      item.status = 'FAILED_STOCK';
      item.error_message = errorMessage;
      await db.put('sales_queue', item);
    }
  } catch (err) {
    console.error(`[OfflineDB] Error marcando venta #${localId} como fallida:`, err);
  }
}

/**
 * Retorna todas las ventas en la cola local de IndexedDB.
 */
export async function getAllQueuedSales(): Promise<QueuedSale[]> {
  try {
    const db = await getDB();
    return await db.getAll('sales_queue');
  } catch (err) {
    console.error('[OfflineDB] Error obteniendo todas las ventas de la cola:', err);
    return [];
  }
}

/**
 * RN-HIST-01: Persiste una venta offline rechazada (quiebre de stock) directamente
 * en el Historial de Ventas (tablas 'sales' y 'sale_items') sin descontar inventario.
 */
export async function persistRejectedSaleToRemote(
  sale: QueuedSale,
  errorMessage: string
): Promise<string | null> {
  const p = sale.payload;
  const localId = sale.local_id;
  const rejectedNotes = `[RECHAZADA_STOCK] local-queue-${localId ?? 'na'} | ${errorMessage}`;

  try {
    // 1. Intentar inserción con status: 'REJECTED_STOCK'
    let insertRes = await supabase
      .from('sales')
      .insert({
        inventory_id: p.p_inventory_id,
        seller_id: p.p_seller_id || null,
        seller_email: p.p_seller_email || 'offline@pos',
        total_amount: p.p_total_amount,
        payment_method: p.p_payment_method || 'CASH',
        customer_name: p.p_customer_name || null,
        customer_contact: p.p_customer_contact || null,
        notes: rejectedNotes,
        status: 'REJECTED_STOCK',
        created_at: sale.created_at || new Date().toISOString()
      })
      .select('id')
      .single();

    // 2. Fallback sin columna status si no existe en la base de datos remota
    if (
      insertRes.error &&
      insertRes.error.message?.toLowerCase().includes('column') &&
      insertRes.error.message?.toLowerCase().includes('status')
    ) {
      insertRes = await supabase
        .from('sales')
        .insert({
          inventory_id: p.p_inventory_id,
          seller_id: p.p_seller_id || null,
          seller_email: p.p_seller_email || 'offline@pos',
          total_amount: p.p_total_amount,
          payment_method: p.p_payment_method || 'CASH',
          customer_name: p.p_customer_name || null,
          customer_contact: p.p_customer_contact || null,
          notes: rejectedNotes,
          created_at: sale.created_at || new Date().toISOString()
        })
        .select('id')
        .single();
    }

    if (insertRes.error) {
      console.warn('[OfflineSync] Error insertando venta rechazada en Supabase sales:', insertRes.error);
      return null;
    }

    const saleId = insertRes.data?.id;

    // 3. Persistir sale_items asociados para auditoría e inspección en el modal
    if (saleId && p.p_items && p.p_items.length > 0) {
      const itemsData = p.p_items.map((it: any) => ({
        sale_id: saleId,
        product_id: it.product_id && !String(it.product_id).startsWith('temp-') ? it.product_id : null,
        product_name: it.product_name || 'Producto',
        product_code: it.product_code || 'S/C',
        quantity: it.quantity || 1,
        unit_price: it.unit_price || 0,
        cost_price: it.cost_price || 0,
        subtotal: it.subtotal || 0
      }));

      const { error: itemsErr } = await supabase.from('sale_items').insert(itemsData);
      if (itemsErr) {
        console.warn('[OfflineSync] Error insertando sale_items para venta rechazada:', itemsErr);
      }
    }

    return saleId;
  } catch (err) {
    console.warn('[OfflineSync] Excepción al persistir venta rechazada en historial:', err);
    return null;
  }
}

// =========================================================
// MÉTODOS DE COLA DE PRODUCTOS (products_queue)
// =========================================================

/**
 * Guarda un producto creado sin conexión en products_queue.
 */
export async function saveProductLocally(
  product: Omit<QueuedProduct, 'status' | 'created_at'> & {
    status?: QueuedProduct['status'];
    created_at?: string;
  }
): Promise<string> {
  const db = await getDB();
  const queuedProduct: QueuedProduct = {
    ...product,
    status: product.status || 'PENDING',
    created_at: product.created_at || new Date().toISOString()
  };
  await db.put('products_queue', queuedProduct);
  return queuedProduct.local_temp_id;
}

/**
 * Retorna todos los productos pendientes de sincronizar en orden FIFO.
 */
export async function getPendingProducts(): Promise<QueuedProduct[]> {
  try {
    const db = await getDB();
    const all = await db.getAll('products_queue');
    return all
      .filter((p) => p.status === 'PENDING')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } catch (err) {
    console.error('[OfflineDB] Error obteniendo productos pendientes:', err);
    return [];
  }
}

/**
 * Retorna el número de productos pendientes de sincronizar.
 */
export async function getPendingProductsCount(): Promise<number> {
  const pending = await getPendingProducts();
  return pending.length;
}

/**
 * Marca un producto como sincronizado y guarda el id definitivo generado por PostgreSQL.
 */
export async function markProductSynced(localTempId: string, realProductId?: string): Promise<void> {
  try {
    const db = await getDB();
    const item = await db.get('products_queue', localTempId);
    if (item) {
      item.status = 'SYNCED';
      item.synced_at = new Date().toISOString();
      if (realProductId) {
        item.real_product_id = realProductId;
        offlineTempIdMap.set(localTempId, realProductId);
      }
      await db.put('products_queue', item);
    }
  } catch (err) {
    console.error(`[OfflineDB] Error marcando producto ${localTempId} como sincronizado:`, err);
  }
}

/**
 * Marca un producto con error permanente.
 */
export async function markProductError(localTempId: string, errorMessage: string): Promise<void> {
  try {
    const db = await getDB();
    const item = await db.get('products_queue', localTempId);
    if (item) {
      item.status = 'ERROR';
      item.error_message = errorMessage;
      await db.put('products_queue', item);
    }
  } catch (err) {
    console.error(`[OfflineDB] Error marcando producto ${localTempId} con error:`, err);
  }
}

// =========================================================
// MÉTODOS DE COLA DE RETIROS MASIVOS (withdrawals_queue)
// =========================================================

/**
 * Guarda una orden de salida masiva en withdrawals_queue.
 */
export async function saveWithdrawalLocally(
  withdrawal: Omit<QueuedWithdrawal, 'local_id' | 'status' | 'created_at'> & {
    status?: QueuedWithdrawal['status'];
    created_at?: string;
  }
): Promise<number> {
  const db = await getDB();
  const queued: QueuedWithdrawal = {
    ...withdrawal,
    status: withdrawal.status || 'PENDING',
    created_at: withdrawal.created_at || new Date().toISOString()
  };
  const localId = await db.add('withdrawals_queue', queued);
  return localId as number;
}

/**
 * Retorna todas las salidas masivas pendientes en orden FIFO.
 */
export async function getPendingWithdrawals(): Promise<QueuedWithdrawal[]> {
  try {
    const db = await getDB();
    const all = await db.getAll('withdrawals_queue');
    return all
      .filter((w) => w.status === 'PENDING')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } catch (err) {
    console.error('[OfflineDB] Error obteniendo retiros pendientes:', err);
    return [];
  }
}

/**
 * Retorna el número de salidas masivas pendientes.
 */
export async function getPendingWithdrawalsCount(): Promise<number> {
  const pending = await getPendingWithdrawals();
  return pending.length;
}

/**
 * Marca una orden de retiro masivo como sincronizada.
 */
export async function markWithdrawalSynced(localId: number): Promise<void> {
  try {
    const db = await getDB();
    const item = await db.get('withdrawals_queue', localId);
    if (item) {
      item.status = 'SYNCED';
      item.synced_at = new Date().toISOString();
      await db.put('withdrawals_queue', item);
    }
  } catch (err) {
    console.error(`[OfflineDB] Error marcando retiro #${localId} como sincronizado:`, err);
  }
}

/**
 * Marca una orden de retiro masivo como fallida por stock u otro error de negocio.
 */
export async function markWithdrawalFailed(localId: number, errorMessage: string): Promise<void> {
  try {
    const db = await getDB();
    const item = await db.get('withdrawals_queue', localId);
    if (item) {
      item.status = 'FAILED_STOCK';
      item.error_message = errorMessage;
      await db.put('withdrawals_queue', item);
    }
  } catch (err) {
    console.error(`[OfflineDB] Error marcando retiro #${localId} como fallido:`, err);
  }
}

// =========================================================
// VALIDACIÓN DE RED Y ERRORES DE CONECTIVIDAD
// =========================================================

/**
 * Determina si un error corresponde a falla de conectividad de red / offline / timeout.
 */
export function isNetworkOrOfflineError(error: any): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  if (!error) return false;

  const msg = (error.message || error.error_description || String(error)).toLowerCase();
  const name = (error.name || '').toLowerCase();

  return (
    name === 'aborterror' ||
    (name === 'typeerror' && msg.includes('fetch')) ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('fetch failed') ||
    msg.includes('connection refused') ||
    msg.includes('offline') ||
    msg.includes('timeout') ||
    msg.includes('internet disconnected') ||
    error.status === 0
  );
}

// =========================================================
// MOTOR DE SINCRONIZACIÓN AUTOMÁTICA (SYNC ENGINE)
// =========================================================

let isSyncInProgress = false;

/**
 * Sincronizador de ventas POS individuales en background.
 */
export async function syncPendingSalesSilently(
  onBatchSuccess?: (syncedCount: number) => void
): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;

  try {
    const pendingSales = await getPendingSales();
    if (!pendingSales || pendingSales.length === 0) {
      return { synced: 0, failed: 0 };
    }

    for (const sale of pendingSales) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        break;
      }

      const localId = sale.local_id;
      if (localId === undefined) continue;

      try {
        // Mapear product_ids en caso de que pertenezcan a creaciones offline
        const mappedItems = (sale.payload.p_items || []).map((item) => {
          if (item && item.product_id && offlineTempIdMap.has(item.product_id)) {
            return {
              ...item,
              product_id: offlineTempIdMap.get(item.product_id)!
            };
          }
          return item;
        });

        const { data: rpcRes, error: rpcError } = await supabase.rpc('process_pos_sale', {
          p_inventory_id: sale.payload.p_inventory_id,
          p_seller_id: sale.payload.p_seller_id,
          p_seller_email: sale.payload.p_seller_email || null,
          p_total_amount: sale.payload.p_total_amount,
          p_payment_method: sale.payload.p_payment_method,
          p_customer_name: sale.payload.p_customer_name || null,
          p_customer_contact: sale.payload.p_customer_contact || null,
          p_notes: sale.payload.p_notes || null,
          p_items: mappedItems,
          p_coupon_code: sale.payload.p_coupon_code || null,
          p_discount_amount: sale.payload.p_discount_amount || 0
        });

        if (rpcError) {
          if (isNetworkOrOfflineError(rpcError)) {
            break;
          }

          console.warn(`[OfflineSync] Venta local #${localId} rechazada por base de datos:`, rpcError.message);
          
          // RN-HIST-01: Persistir la venta diferida rechazada en el Historial de Ventas
          await persistRejectedSaleToRemote(sale, rpcError.message || 'Sin stock disponible');
          await markSaleFailed(localId, rpcError.message || 'Sin stock disponible');
          failedCount++;

          // Alerta al usuario: Notificación discreta de "Sin Stock Disponible"
          showAppToast('Sin Stock Disponible: Venta rechazada por falta de unidades.', 'error');

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('stockly_sales_data_updated'));
          }
          continue;
        }

        await markSaleSynced(localId, rpcRes);
        syncedCount++;

        // Alerta al usuario: Notificación discreta de sincronización
        showAppToast('Venta sincronizada correctamente.', 'success');

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('stockly_sales_data_updated'));
        }
      } catch (err: any) {
        if (isNetworkOrOfflineError(err)) {
          break;
        }
        console.warn(`[OfflineSync] Error inesperado en venta #${localId}:`, err);
        const errMsg = err?.message || 'Error de sincronización';
        await persistRejectedSaleToRemote(sale, errMsg);
        await markSaleFailed(localId, errMsg);
        failedCount++;

        showAppToast('Sin Stock Disponible: Venta rechazada por falta de unidades.', 'error');

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('stockly_sales_data_updated'));
        }
      }
    }

    if ((syncedCount > 0 || failedCount > 0) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('stockly_sales_data_updated'));
    }

    if (syncedCount > 0 && onBatchSuccess) {
      onBatchSuccess(syncedCount);
    }

    return { synced: syncedCount, failed: failedCount };
  } catch (err) {
    console.error('[OfflineSync] Error en syncPendingSalesSilently:', err);
    return { synced: syncedCount, failed: failedCount };
  }
}

/**
 * Sincronizador Integral en Cascada (Fase 1: Productos -> Fase 2: Retiros -> Fase 3: Ventas)
 */
export async function syncAllOfflineDataSilently(
  onSummary?: (summary: {
    syncedProducts: number;
    syncedWithdrawals: number;
    syncedSales: number;
  }) => void
): Promise<{
  syncedProducts: number;
  syncedWithdrawals: number;
  syncedSales: number;
  errors: number;
}> {
  if (isSyncInProgress) {
    return { syncedProducts: 0, syncedWithdrawals: 0, syncedSales: 0, errors: 0 };
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedProducts: 0, syncedWithdrawals: 0, syncedSales: 0, errors: 0 };
  }

  isSyncInProgress = true;
  let syncedProducts = 0;
  let syncedWithdrawals = 0;
  let syncedSales = 0;
  let errors = 0;

  try {
    // =========================================================
    // FASE 1: Creación de Productos (products_queue)
    // =========================================================
    const pendingProducts = await getPendingProducts();
    for (const prod of pendingProducts) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;

      try {
        // 1. Subir Blobs de imágenes a Supabase Storage
        const uploadedUrls: string[] = [];
        for (const imgBlob of prod.images_blobs || []) {
          const fileExt = imgBlob.filename?.split('.').pop() || 'webp';
          const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
          const filePath = `${prod.product_data.inventory_id}/${cleanFileName}`;

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, imgBlob.blob, {
              cacheControl: '31536000',
              contentType: imgBlob.blob.type || 'image/webp',
              upsert: false
            });

          if (uploadError) {
            if (isNetworkOrOfflineError(uploadError)) throw uploadError;
            console.warn(`[SyncEngine] Error subiendo imagen de ${prod.local_temp_id}:`, uploadError);
          } else {
            const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
            if (data?.publicUrl) {
              uploadedUrls.push(data.publicUrl);
            }
          }
        }

        // 2. Insertar registro en PostgreSQL
        const insertPayload: any = {
          inventory_id: prod.product_data.inventory_id,
          name: prod.product_data.name,
          code: prod.product_data.sku || prod.product_data.code,
          description: prod.product_data.description || null,
          price: prod.product_data.price || 0,
          cost_price: prod.product_data.cost_price || 0,
          markup_percentage: (prod.product_data as any).markup_percentage || 0,
          unit_type: prod.product_data.unit_type || 'UNIT',
          units_per_box: prod.product_data.units_per_box || null,
          stock: prod.product_data.stock ?? 0,
          min_stock: prod.product_data.min_stock_alert || prod.product_data.min_stock || 1,
          category_id: prod.product_data.category_id || null,
          subcategory_id: prod.product_data.sub_category_id || prod.product_data.subcategory_id || null,
          location_id: prod.product_data.location_id || null,
          images: uploadedUrls,
          is_variant: !!prod.product_data.is_variant,
          parent_id: prod.product_data.parent_id || null,
          variant_attributes: prod.product_data.variant_attributes || {},
          status: 'ACTIVE',
          last_modified_by: prod.product_data.last_modified_by || null,
          last_modified_by_email: prod.product_data.last_modified_by_email || null
        };

        const { data: newProd, error: insertError } = await supabase
          .from('products')
          .insert(insertPayload)
          .select()
          .single();

        if (insertError) {
          if (isNetworkOrOfflineError(insertError)) throw insertError;
          console.warn(`[SyncEngine] Error insertando producto ${prod.local_temp_id}:`, insertError);
          await markProductError(prod.local_temp_id, insertError.message);
          errors++;
          continue;
        }

        // 3. Mapear ID temporal -> ID definitivo en memoria y marcar SYNCED
        if (newProd?.id) {
          offlineTempIdMap.set(prod.local_temp_id, newProd.id);
        }
        await markProductSynced(prod.local_temp_id, newProd?.id);
        syncedProducts++;
      } catch (err: any) {
        if (isNetworkOrOfflineError(err)) break;
        console.warn(`[SyncEngine] Error procesando producto ${prod.local_temp_id}:`, err);
        await markProductError(prod.local_temp_id, err?.message || 'Error desconocido');
        errors++;
      }
    }

    // =========================================================
    // FASE 2: Retiros Masivos (withdrawals_queue)
    // =========================================================
    const pendingWithdrawals = await getPendingWithdrawals();
    for (const w of pendingWithdrawals) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;
      if (w.local_id === undefined) continue;

      try {
        let hasStockConflict = false;
        let conflictMessage = '';

        for (const item of w.items) {
          // Si el ID correspondía a un producto creado offline, resolver su ID definitivo
          const targetId = offlineTempIdMap.get(item.product_id) || item.product_id;

          const { data: currentProduct, error: fetchErr } = await supabase
            .from('products')
            .select('id, name, stock, unit_type, units_per_box')
            .eq('id', targetId)
            .single();

          if (fetchErr || !currentProduct) {
            hasStockConflict = true;
            conflictMessage = `Producto no encontrado en inventario (${item.product_name || targetId})`;
            break;
          }

          const currentStock = Number(currentProduct.stock || 0);
          const isBox = currentProduct.unit_type === 'BOX' && Number(currentProduct.units_per_box) > 0;
          const upb = Number(currentProduct.units_per_box || 1);

          let delta = 0;
          if (isBox) {
            delta = Number(((item.quantity_boxes || 0) + (item.quantity_units || 0) / upb).toFixed(4));
          } else {
            delta = Math.round(item.quantity_units || 0);
          }

          const newStock = Number((currentStock - delta).toFixed(4));
          if (newStock < -0.0001) {
            hasStockConflict = true;
            conflictMessage = `Stock insuficiente para ${currentProduct.name} (Disponible: ${currentStock}, Requerido: ${delta})`;
            break;
          }

          const safeStock = Math.max(0, newStock);

          const { error: updateErr } = await supabase
            .from('products')
            .update({
              stock: safeStock,
              updated_at: new Date().toISOString(),
              ...(w.user_id ? { last_modified_by: w.user_id } : {}),
              ...(w.user_email ? { last_modified_by_email: w.user_email } : {})
            })
            .eq('id', targetId);

          if (updateErr) {
            if (isNetworkOrOfflineError(updateErr)) throw updateErr;
            hasStockConflict = true;
            conflictMessage = updateErr.message;
            break;
          }

          // Registrar log de auditoría
          try {
            await supabase.from('audit_logs').insert({
              inventory_id: w.inventory_id,
              product_id: targetId,
              product_name: currentProduct.name,
              action_type: 'WITHDRAW',
              details: `Salida masiva offline sincronizada: -${delta} ${isBox ? 'cajas' : 'und'}. Motivo: ${w.reason}. ${w.notes ? `Nota: ${w.notes}` : ''}`,
              user_id: w.user_id || null,
              user_email: w.user_email || null,
              metadata: {
                previous_stock: currentStock,
                new_stock: safeStock,
                withdrawn: delta,
                reason: w.reason,
                notes: w.notes || null,
                synced_offline: true
              }
            });
          } catch (auditErr) {
            console.warn('[SyncEngine] Error guardando audit_log:', auditErr);
          }
        }

        if (hasStockConflict) {
          await markWithdrawalFailed(w.local_id, conflictMessage);
          errors++;
        } else {
          await markWithdrawalSynced(w.local_id);
          syncedWithdrawals++;
        }
      } catch (err: any) {
        if (isNetworkOrOfflineError(err)) break;
        console.warn(`[SyncEngine] Error en retiro #${w.local_id}:`, err);
        await markWithdrawalFailed(w.local_id, err?.message || 'Error desconocido');
        errors++;
      }
    }

    // =========================================================
    // FASE 3: Ventas POS (sales_queue)
    // =========================================================
    const salesRes = await syncPendingSalesSilently();
    syncedSales = salesRes.synced;
    errors += salesRes.failed;

    const totalSynced = syncedProducts + syncedWithdrawals + syncedSales;
    if (totalSynced > 0 && onSummary) {
      onSummary({
        syncedProducts,
        syncedWithdrawals,
        syncedSales
      });
    }

    return {
      syncedProducts,
      syncedWithdrawals,
      syncedSales,
      errors
    };
  } finally {
    isSyncInProgress = false;
  }
}
