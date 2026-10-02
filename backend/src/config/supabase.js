import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ [Supabase Config] SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configurados en el entorno.');
}

// Cliente con Service Role para operaciones administrativas y generación de reportes protegidos
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper para crear cliente con token de usuario autenticado (para respetar RLS del usuario)
export const createScopedClient = (token) => {
  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || supabaseServiceKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
};
