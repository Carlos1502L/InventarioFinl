import React, { useState } from 'react';
import {
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
import { CancelButton } from '../common/CancelButton';
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  modalFieldInputClass,
  modalFieldLabelClass,
  modalDangerButtonClass
} from './ModalShell';

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
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      disableDismiss={isDeleting}
      onSubmitShortcut={() => {
        if (password.trim() && !isDeleting) handleConfirmDelete();
      }}
    >
      <ModalHeader
        title="Eliminar cuenta"
        subtitle="Baja permanente y purga de información"
        icon={<Trash2 className="w-4 h-4 lg:w-5 lg:h-5" />}
        iconTone="rose"
        onClose={handleClose}
        closeDisabled={isDeleting}
      />

      <ModalBody className="space-y-4">
        {/* Advertencia Destructiva */}
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-1.5">
          <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>Confirmación de seguridad</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Se eliminará permanentemente la cuenta de{' '}
            <strong className="text-white font-mono break-all">{user?.email}</strong>, junto con toda
            la información existente. Esta acción es irreversible.
          </p>
        </div>

        {/* Formulario de Contraseña */}
        <div className="space-y-1.5">
          <label className={modalFieldLabelClass}>
            Ingresa tu contraseña para autorizar
          </label>
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password.trim() && !isDeleting) {
                  handleConfirmDelete();
                }
              }}
              className={`${modalFieldInputClass} pl-11 pr-11`}
              autoComplete="current-password"
            />

            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                disabled={isDeleting}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0" />}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Solicitamos tu contraseña para verificar titularidad antes de procesar la baja.
          </p>
        </div>

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}
      </ModalBody>

      <ModalFooter shortcutLabel="para eliminar">
        <CancelButton onClick={handleClose} disabled={isDeleting} className="w-full sm:w-auto" />
        <button
          type="button"
          onClick={handleConfirmDelete}
          disabled={!password.trim() || isDeleting}
          className={`${modalDangerButtonClass} w-full sm:w-auto`}
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
      </ModalFooter>
    </ModalShell>
  );
};
