import { createClient } from '@supabase/supabase-js';
import { compressImage } from '../utils/imageCompression';

function cleanSupabaseUrl(url: string): string {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

/**
 * Si el proyecto corre en red local (ej. desde un móvil en http://192.168.x.x:3000)
 * y la URL configurada apunta a localhost / 127.0.0.1, reemplaza automáticamente
 * el host por la IP de la máquina en la red Wi-Fi para evitar errores "Failed to fetch".
 */
function resolveLocalNetworkUrl(url: string): string {
  const cleaned = cleanSupabaseUrl(url);
  if (
    typeof window !== 'undefined' &&
    window.location.hostname &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?/i.test(cleaned)
  ) {
    return window.location.origin;
  }
  return cleaned;
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tu-proyecto.supabase.co';
const supabaseUrl = resolveLocalNetworkUrl(rawUrl);
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'tu-anon-key-placeholder').trim();

export const API_BASE_URL = resolveLocalNetworkUrl(import.meta.env.VITE_API_URL || 'http://localhost:4000');

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('tu-proyecto')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

/**
 * Sube una fotografía al bucket 'product-images' en Supabase Storage
 * Comprime y redimensiona automáticamente la foto antes de subir (RNF-04)
 */
export async function uploadProductImage(file: File, inventoryId: string): Promise<string> {
  // RNF-04: Compresión automática antes de subir
  const optimizedFile = await compressImage(file, 1200, 1200, 0.75);

  const fileExt = optimizedFile.name.split('.').pop() || 'jpg';
  const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const filePath = `${inventoryId}/${cleanFileName}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(filePath, optimizedFile, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Error al subir la imagen: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Registra una acción de trazabilidad/auditoría
 */
export async function logAuditAction({
  inventoryId,
  productId = null,
  productName = null,
  actionType,
  details,
  metadata = {}
}: {
  inventoryId: string;
  productId?: string | null;
  productName?: string | null;
  actionType: 'CREATE' | 'UPDATE' | 'MOVE' | 'ASSIGN' | 'WITHDRAW' | 'RESTOCK' | 'DELETE' | 'SALE';
  details: string;
  metadata?: Record<string, any>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from('audit_logs').insert({
    inventory_id: inventoryId,
    product_id: productId,
    product_name: productName,
    user_id: user.id,
    user_email: user.email || 'anonimo@usuario.com',
    action_type: actionType,
    details,
    metadata
  });

  if (error) {
    console.error('Error registrando log de auditoría:', error);
  }
}

/**
 * Formateador de moneda dinámico
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  if (currency === 'PEN') {
    return `S/ ${Number(amount).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (currency === 'EUR') {
    return `€ ${Number(amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$ ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formatea fechas a formato legible con hora
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

/**
 * Formatea un número decimal eliminando ceros finales innecesarios
 * Ej: 2.00 -> "2", 1.50 -> "1.5", 1.25 -> "1.25"
 */
export function formatCleanDecimal(value: number | string | null | undefined, maxDecimals = 2): string {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  return Number(num.toFixed(maxDecimals)).toString();
}

/**
 * Formatea el stock de un producto según su unidad de medida (UNIT o BOX)
 * - UNIT -> "20 und"
 * - BOX  -> "2 cajas", "1 caja", "1.5 cajas"
 */
export function formatStockDisplay(product: {
  stock?: number | string | null;
  unit_type?: 'UNIT' | 'BOX' | string | null;
  units_per_box?: number | null;
}): string {
  const numStock = Number(product?.stock || 0);
  if (product?.unit_type === 'BOX') {
    const cleanVal = formatCleanDecimal(numStock, 2);
    const suffix = Number(cleanVal) === 1 ? 'caja' : 'cajas';
    return `${cleanVal} ${suffix}`;
  }
  return `${Math.round(numStock)} und`;
}

/**
 * Calcula el desglose exacto de cajas completas y unidades sueltas para productos tipo BOX
 * Ej: stock = 1.5, units_per_box = 50 -> totalUnits = 75, fullBoxes = 1, looseUnits = 25 ("1 caja + 25 unidades")
 */
export function getBoxBreakdown(product: {
  stock?: number | string | null;
  unit_type?: 'UNIT' | 'BOX' | string | null;
  units_per_box?: number | null;
}): {
  isBox: boolean;
  totalUnits: number;
  fullBoxes: number;
  looseUnits: number;
  hasFraction: boolean;
  breakdownLabel: string | null;
  equivalenceLabel: string | null;
} {
  const numStock = Number(product?.stock || 0);
  const upb = Number(product?.units_per_box || 0);

  if (product?.unit_type !== 'BOX' || upb <= 0) {
    return {
      isBox: false,
      totalUnits: Math.round(numStock),
      fullBoxes: 0,
      looseUnits: 0,
      hasFraction: false,
      breakdownLabel: null,
      equivalenceLabel: null
    };
  }

  const totalUnits = Math.round(numStock * upb);
  const fullBoxes = Math.floor(totalUnits / upb);
  const looseUnits = totalUnits % upb;
  const hasFraction = looseUnits > 0;
  const equivalenceLabel = `1 caja = ${upb} unidades`;
  const breakdownLabel = hasFraction
    ? `${fullBoxes} ${fullBoxes === 1 ? 'caja' : 'cajas'} + ${looseUnits} ${looseUnits === 1 ? 'unidad' : 'unidades'}`
    : `${totalUnits} und (${upb} und/caja)`;

  return {
    isBox: true,
    totalUnits,
    fullBoxes,
    looseUnits,
    hasFraction,
    breakdownLabel,
    equivalenceLabel
  };
}

/**
 * Obtiene la suma total de stock ya asignado a ubicaciones físicas (product_locations)
 */
export function getAssignedLocationStock(product: {
  product_locations?: Array<{ quantity?: number | string | null }>;
  assigned_stock?: number;
}): number {
  if (Array.isArray(product?.product_locations)) {
    const sum = product.product_locations.reduce((acc, pl) => acc + Number(pl.quantity || 0), 0);
    return Number(sum.toFixed(4));
  }
  return Number(Number(product?.assigned_stock || 0).toFixed(4));
}

/**
 * Calcula el Stock Pendiente por ubicar:
 * Stock Pendiente = Stock Total - Suma(Stock ya ubicado en almacenes)
 */
export function getPendingLocationStock(product: {
  stock?: number | string | null;
  product_locations?: Array<{ quantity?: number | string | null }>;
  assigned_stock?: number;
  unassigned_stock?: number;
}): number {
  const total = Number(product?.stock || 0);
  const assigned = getAssignedLocationStock(product);
  return Math.max(0, Number((total - assigned).toFixed(4)));
}

/**
 * Formatea una cantidad específica (en ubicación o pendiente) según la unidad de medida y factor de conversión del producto
 * Ejemplo UNIT: "3 unidades", "1 unidad"
 * Ejemplo BOX: "1 caja / 12 unidades" o "1.5 cajas (1 caja + 6 unidades / 18 unidades)"
 */
export function formatLocationQuantity(
  quantity: number | string | null | undefined,
  product: { unit_type?: 'UNIT' | 'BOX' | string | null; units_per_box?: number | null }
): string {
  const numQty = Number(quantity || 0);
  if (product?.unit_type === 'BOX') {
    const upb = Number(product?.units_per_box || 1);
    const cleanBoxes = formatCleanDecimal(numQty, 2);
    const boxWord = Number(cleanBoxes) === 1 ? 'caja' : 'cajas';
    const totalUnits = Math.round(numQty * upb);
    const fullBoxes = Math.floor(totalUnits / upb);
    const looseUnits = totalUnits % upb;
    const unitWord = totalUnits === 1 ? 'unidad' : 'unidades';
    if (looseUnits > 0) {
      return `${cleanBoxes} ${boxWord} (${fullBoxes} ${fullBoxes === 1 ? 'caja' : 'cajas'} + ${looseUnits} und / ${totalUnits} ${unitWord})`;
    }
    return `${cleanBoxes} ${boxWord} / ${totalUnits} ${unitWord}`;
  }
  const rounded = Math.round(numQty);
  return `${rounded} ${rounded === 1 ? 'unidad' : 'unidades'}`;
}

/**
 * Devuelve una etiqueta resumida de ubicación para las tarjetas/tablas del catálogo
 */
export function getProductLocationBadgeLabel(product: {
  stock?: number | string | null;
  product_locations?: Array<{
    quantity?: number | string | null;
    locations?: { name?: string; code?: string } | null;
  }>;
  locations?: { name?: string; code?: string } | null;
}): string {
  const locs = (product?.product_locations || []).filter(pl => Number(pl.quantity || 0) > 0);
  const pending = getPendingLocationStock(product);

  if (locs.length === 0) {
    return 'SIN UBICAR (EN RECEPCIÓN)';
  }
  if (locs.length === 1) {
    const locName = locs[0].locations?.name || 'UBICADO';
    return pending > 0.0001 ? `${locName} (+PENDIENTE)` : locName;
  }
  return `${locs.length} UBICACIONES${pending > 0.0001 ? ' (+PENDIENTE)' : ''}`;
}
