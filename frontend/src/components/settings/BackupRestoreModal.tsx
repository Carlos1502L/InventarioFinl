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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white border border-[#E5E7EB] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl font-sans">
        
        {/* Cabecera de Alerta Crítica */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-100 bg-rose-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-bold text-rose-900 text-sm sm:text-base uppercase tracking-tight">
                ⚠️ Advertencia de Sobreescritura
              </h3>
              <p className="text-xs text-rose-700">Restauración Crítica de Base de Datos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-8 h-8 rounded-full flex items-center justify-center text-rose-400 hover:text-rose-800 hover:bg-rose-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido y Advertencia */}
        <div className="p-6 space-y-4 text-xs sm:text-sm text-neutral-700">
          <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-xs leading-relaxed space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5 text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              Esta operación no se puede revertir.
            </p>
            <p>
              Esta acción sincronizará y actualizará los productos, categorías, ubicaciones, existencias y registros de venta del inventario con los datos contenidos en el archivo:
            </p>
            <p className="font-mono font-bold text-rose-950 bg-white/70 px-2 py-1 rounded border border-rose-200/60 truncate">
              {fileName}
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider">
              Para confirmar, escribe <span className="font-mono font-bold text-rose-600">RESTAURAR</span> a continuación:
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Escribe RESTAURAR"
              disabled={isLoading}
              className="w-full h-11 px-3.5 bg-neutral-50 border border-neutral-300 focus:border-rose-600 focus:bg-white rounded-xl text-sm font-mono tracking-widest text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition-all uppercase"
              autoFocus
            />
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="h-10 px-4 rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 text-xs font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmed || isLoading}
            className={`h-10 px-5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              isConfirmed && !isLoading
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm active:scale-95 cursor-pointer'
                : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Restaurando...</span>
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                <span>Confirmar y Restaurar Datos</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
