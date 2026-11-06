import React, { useState } from 'react';
import {
  X,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, getApiUrl } from '../../services/supabase';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmDelete = async () => {
    if (!password.trim() || !user?.email) {
      setErrorMsg('Por favor ingresa tu contraseña actual para continuar.');
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMsg(null);

      // 1. Validar la contraseña contra Supabase Auth re-autenticando
      const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password.trim()
      });

      if (authError) {
        if (
          authError.message?.toLowerCase().includes('invalid login credentials') ||
          authError.status === 400
        ) {
          throw new Error('Contraseña incorrecta. Por favor verifica tus credenciales.');
        }
        throw new Error(authError.message || 'Error al validar las credenciales de la cuenta.');
      }

      // 2. Obtener el access_token recién autenticado
      const token = signInData?.session?.access_token;
      if (!token) {
        throw new Error('No se pudo verificar la sesión de autenticación.');
      }

      // 3. Solicitar la baja en cascada al backend
      const res = await fetch(getApiUrl('/users/me'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || 'Error al procesar la baja de la cuenta.');
      }

      // 4. Limpieza exhaustiva de almacenamiento local y bases de datos IndexedDB
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.warn('Error clearing browser storage:', e);
      }

      if (typeof window !== 'undefined' && window.indexedDB && window.indexedDB.databases) {
        try {
          const dbs = await window.indexedDB.databases();
          for (const db of dbs) {
            if (db.name) {
              window.indexedDB.deleteDatabase(db.name);
            }
          }
        } catch (e) {
          console.warn('Error purging IndexedDB:', e);
        }
      }

      // 5. Redirección forzosa al login
      window.location.replace('/login');
    } catch (err: any) {
      console.error('Error al eliminar la cuenta:', err);
      setErrorMsg(err.message || 'Ocurrió un error inesperado al procesar la eliminación.');
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setPassword('');
      setErrorMsg(null);
      setShowPassword(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 max-md:bg-black/75 backdrop-blur-sm p-3 sm:p-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in fade-in">
      <div className="mobile-dark-modal bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col font-sans animate-in zoom-in-95 duration-150">
        
        {/* Cabecera Limpia */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] bg-[#ffffff] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-bold text-[#1E3A5F] text-base uppercase tracking-tight">
                Eliminar Cuenta
              </h3>
              <p className="text-[11px] text-[#616161]">
                Baja permanente y purga de información
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#616161] hover:text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo de la Ventana Flotante */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Advertencia Destructiva */}
          <div className="p-4 bg-rose-50/60 border border-rose-200/80 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>Confirmación de seguridad</span>
            </div>
            <p className="text-xs text-[#616161] leading-relaxed">
              Esta acción es irreversible. Se eliminará permanentemente la cuenta de <strong className="text-[#1E3A5F] font-mono">{user?.email}</strong>, junto con tus inventarios propios, catálogo de existencias, historial y cachés locales.
            </p>
          </div>

          {/* Formulario de Contraseña (RF-UI-AUTH-007) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-[#1E3A5F] block">
              Ingresa tu contraseña para autorizar
            </label>
            <div className="relative flex items-center w-full">
              <div className="absolute left-3.5 pointer-events-none text-[#616161] flex items-center justify-center">
                <Lock className="w-4 h-4 shrink-0" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Contraseña actual"
                disabled={isDeleting}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && password.trim() && !isDeleting) {
                    handleConfirmDelete();
                  }
                }}
                className="w-full h-11 pl-10 pr-10 bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] focus:bg-white rounded-2xl text-xs text-[#1E3A5F] placeholder:text-neutral-400 focus:outline-none transition-all box-border"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                disabled={isDeleting}
                className="absolute right-3.5 text-[#616161] hover:text-[#1E3A5F] transition-colors cursor-pointer flex items-center justify-center p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0" />}
              </button>
            </div>
            <p className="text-[11px] text-[#616161] font-light">
              Por tu seguridad, solicitamos tu contraseña para verificar la titularidad antes de procesar la baja.
            </p>
          </div>

          {/* Mensaje de Error */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Pie de Acciones: Botón Eliminar cuenta ocupando todo el ancho, y abajo Cancelar */}
        <div className="flex flex-col gap-2.5 px-5 py-4 border-t border-[#E5E7EB] bg-[#F8F9FA]/50 shrink-0">
          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={!password.trim() || isDeleting}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Eliminando cuenta...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Eliminar cuenta</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="w-full py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-white text-[#616161] hover:text-[#1E3A5F] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 text-center"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
