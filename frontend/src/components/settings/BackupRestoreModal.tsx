import React, { useState } from 'react';
import { X, AlertTriangle, Loader2, Database, ShieldAlert } from 'lucide-react';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  fileName,
  onConfirm,
  isLoading
}) => {
  const [confirmationText, setConfirmationText] = useState('');

  if (!isOpen) return null;

  const isConfirmed = confirmationText.trim().toUpperCase() === 'RESTAURAR';

  const handleConfirm = async () => {
    if (!isConfirmed || isLoading) return;
    await onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 max-md:bg-black/75 backdrop-blur-sm p-3 sm:p-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in fade-in">
      <div className="mobile-dark-modal bg-white border border-[#E5E7EB] rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl flex flex-col font-sans">
        
        {/* Cabecera Limpia */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rose-100 bg-rose-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-bold text-rose-900 text-base uppercase tracking-tight">
                Restaurar Copia
              </h3>
              <p className="text-xs text-rose-600">Acción crítica irreversible</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#616161] hover:text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido y Advertencia */}
        <div className="p-5 space-y-4 text-xs text-neutral-700 overflow-y-auto">
          <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 leading-relaxed space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5 text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              Esta operación no se puede revertir.
            </p>
            <p>
              Se actualizarán los productos, existencias, categorías, ubicaciones y ventas con el archivo:
            </p>
            <p className="font-mono font-bold text-rose-950 bg-white/80 px-2 py-1 rounded border border-rose-200/60 truncate">
              {fileName}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-800">
              Para confirmar, escribe <span className="font-mono font-bold text-rose-600">RESTAURAR</span>:
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Escribe RESTAURAR"
              disabled={isLoading}
              className="w-full h-11 px-3.5 bg-neutral-100 border border-transparent focus:border-rose-600 focus:bg-white rounded-xl text-sm font-mono tracking-widest text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition-all uppercase"
              autoFocus
            />
          </div>
        </div>

        {/* Botones de Acción (Stacking en móvil para evitar desbordes) */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 px-5 py-4 border-t border-neutral-100 bg-neutral-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="h-11 px-4 rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 text-xs font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmed || isLoading}
            className={`h-11 px-5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              isConfirmed && !isLoading
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm active:scale-95 cursor-pointer'
                : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Restaurando...</span>
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                <span>Confirmar y Restaurar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
