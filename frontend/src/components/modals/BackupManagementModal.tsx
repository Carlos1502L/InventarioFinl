import React from 'react';
import { X, Database } from 'lucide-react';
import { BackupManagementCard } from '../settings/BackupManagementCard';

interface BackupManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreCompleted?: () => void;
}

export const BackupManagementModal: React.FC<BackupManagementModalProps> = ({
  isOpen,
  onClose,
  onRestoreCompleted
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in">
      <div className="bg-white border border-[#E5E7EB] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl font-sans">
        
        {/* Cabecera del Modal Móvil */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1E3A5F] text-[#E8B4A0] flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#1E3A5F] text-sm sm:text-base uppercase tracking-tight">
                Copias de Seguridad (Backups)
              </h3>
              <p className="text-[11px] text-[#616161]">Respaldo manual, programado y restauración</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#616161] hover:text-[#1E3A5F] hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <BackupManagementCard
            className="border-0 shadow-none"
            onRestoreCompleted={() => {
              if (onRestoreCompleted) onRestoreCompleted();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
};
