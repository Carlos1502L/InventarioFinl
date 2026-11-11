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
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { supabase, getApiUrl } from '../../services/supabase';
import { CancelButton } from '../common/CancelButton';
import { useModalEscape, useModalMotion } from './modalMotion';

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
  const { backdropMotion, panelMotion, tabContentMotion } = useModalMotion();

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

  useModalEscape(isOpen, handleClose, isDeleting);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          {...backdropMotion}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 max-md:bg-black/75 backdrop-blur-sm p-3 sm:p-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <motion.div
            {...panelMotion}
            className="mobile-dark-modal bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-md max-h-[85dvh] overflow-hidden shadow-2xl flex flex-col font-sans"
          >
            {/* Cabecera Limpia */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm tracking-tight">
                    Eliminar cuenta
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Baja permanente y purga de información
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={isDeleting}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuerpo de la Ventana Flotante */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Advertencia Destructiva */}
              <div className="p-4 bg-red-50/70 border border-red-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 text-red-700 font-semibold text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
                  <span>Confirmación de seguridad</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Se eliminará permanentemente la cuenta de <strong className="text-slate-900 font-mono">{user?.email}</strong>, junto con toda la información existente. Esta acción es irreversible.
                </p>
              </div>

              {/* Formulario de Contraseña (RF-UI-AUTH-009) */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-medium text-slate-700 block">
                  Ingresa tu contraseña para autorizar
                </label>
                <div className="relative w-full">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 z-10">
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
                    className="modal-password-input w-full h-12 !pl-12 !pr-12 pl-12 pr-12 bg-zinc-100 dark:bg-zinc-800 text-neutral-900 dark:text-zinc-100 placeholder:text-zinc-400 rounded-2xl border-0 box-border focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition-all text-sm font-sans"
                    style={{ paddingLeft: '3rem', paddingRight: '3rem' }}
                    autoComplete="current-password"
                  />

                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center z-10">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      disabled={isDeleting}
                      className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0" />}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-[#616161] font-light">
                  Por tu seguridad, solicitamos tu contraseña para verificar la titularidad antes de procesar la baja.
                </p>
              </div>

              {/* Mensaje de Error */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    {...tabContentMotion}
                    className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span className="leading-snug">{errorMsg}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Pie de Acciones: Acción Principal y Cancelar Plano (RF-UI-ACTION-010 & RNF-UX-HIERARCHY-006) */}
            <div className="flex flex-col items-center gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50/60 shrink-0">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={!password.trim() || isDeleting}
                className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-600 disabled:cursor-not-allowed text-white text-xs font-semibold transition-[background-color,transform] duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
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
              <CancelButton onClick={handleClose} disabled={isDeleting} className="w-full" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
