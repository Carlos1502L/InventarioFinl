import { createClient } from '@supabase/supabase-js';

function cleanSupabaseUrl(url: string): string {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tu-proyecto.supabase.co';
const supabaseUrl = cleanSupabaseUrl(rawUrl);
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'tu-anon-key-placeholder').trim();

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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
 */
export async function uploadProductImage(file: File, inventoryId: string): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const filePath = `${inventoryId}/${cleanFileName}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, {
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
  actionType: 'CREATE' | 'UPDATE' | 'MOVE' | 'WITHDRAW' | 'RESTOCK' | 'DELETE';
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
