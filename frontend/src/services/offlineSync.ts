import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '../lib/supabase';

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

interface PosOfflineDB extends DBSchema {
  sales_queue: {
    key: number;
    value: QueuedSale;
    indexes: {
      'by-status': string;
      'by-created_at': string;
    };
  };
}

const DB_NAME = 'pos_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'sales_queue';

let dbPromise: Promise<IDBPDatabase<PosOfflineDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<PosOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PosOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'local_id',
            autoIncrement: true
          });
          store.createIndex('by-status', 'status');
          store.createIndex('by-created_at', 'created_at');
        }
      }
    });
  }
  return dbPromise;
}

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
  const localId = await db.add(STORE_NAME, sale);
  return localId as number;
}

/**
 * Retorna todas las ventas con estado 'PENDING' ordenadas por created_at ASC (FIFO).
 */
export async function getPendingSales(): Promise<QueuedSale[]> {
  try {
    const db = await getDB();
    const all = await db.getAll(STORE_NAME);
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
    const item = await db.get(STORE_NAME, localId);
    if (item) {
      item.status = 'SYNCED';
      item.synced_at = new Date().toISOString();
      await db.put(STORE_NAME, item);
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
    const item = await db.get(STORE_NAME, localId);
    if (item) {
      item.status = 'FAILED_STOCK';
      item.error_message = errorMessage;
      await db.put(STORE_NAME, item);
    }
  } catch (err) {
    console.error(`[OfflineDB] Error marcando venta #${localId} como fallida:`, err);
  }
}

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

let isSyncInProgress = false;

/**
 * Sincronizador Silencioso en Background:
 * Recorre las ventas pendientes en orden FIFO y ejecuta la RPC process_pos_sale.
 */
export async function syncPendingSalesSilently(
  onBatchSuccess?: (syncedCount: number) => void
): Promise<{ synced: number; failed: number }> {
  if (isSyncInProgress) {
    return { synced: 0, failed: 0 };
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  isSyncInProgress = true;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const pendingSales = await getPendingSales();
    if (!pendingSales || pendingSales.length === 0) {
      return { synced: 0, failed: 0 };
    }

    for (const sale of pendingSales) {
      // Si la red se cae a mitad del proceso, detener inmediatamente el lote
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        break;
      }

      const localId = sale.local_id;
      if (localId === undefined) continue;

      try {
        const { data: rpcRes, error: rpcError } = await supabase.rpc('process_pos_sale', {
          p_inventory_id: sale.payload.p_inventory_id,
          p_seller_id: sale.payload.p_seller_id,
          p_seller_email: sale.payload.p_seller_email || null,
          p_total_amount: sale.payload.p_total_amount,
          p_payment_method: sale.payload.p_payment_method,
          p_customer_name: sale.payload.p_customer_name || null,
          p_customer_contact: sale.payload.p_customer_contact || null,
          p_notes: sale.payload.p_notes || null,
          p_items: sale.payload.p_items,
          p_coupon_code: sale.payload.p_coupon_code || null,
          p_discount_amount: sale.payload.p_discount_amount || 0
        });

        if (rpcError) {
          if (isNetworkOrOfflineError(rpcError)) {
            // Pausar el lote hasta la próxima reconexión
            break;
          }

          // Error de regla de negocio (ej. stock insuficiente, conflicto de concurrencia)
          console.warn(`[OfflineSync] Venta local #${localId} rechazada por base de datos:`, rpcError.message);
          await markSaleFailed(localId, rpcError.message || 'Error de procesamiento');
          failedCount++;
          continue;
        }

        // Éxito: marcar como sincronizada
        await markSaleSynced(localId, rpcRes);
        syncedCount++;
      } catch (err: any) {
        if (isNetworkOrOfflineError(err)) {
          break;
        }
        console.warn(`[OfflineSync] Error inesperado en venta #${localId}:`, err);
        await markSaleFailed(localId, err?.message || 'Error de sincronización');
        failedCount++;
      }
    }

    if (syncedCount > 0 && onBatchSuccess) {
      onBatchSuccess(syncedCount);
    }

    return { synced: syncedCount, failed: failedCount };
  } finally {
    isSyncInProgress = false;
  }
}
