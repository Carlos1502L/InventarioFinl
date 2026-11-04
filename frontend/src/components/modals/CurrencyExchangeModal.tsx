import React from 'react';
import { X, Coins } from 'lucide-react';
import { Inventory } from '../../types/database';
import { CurrencyExchangeCard } from '../settings/CurrencyExchangeCard';

interface CurrencyExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Inventory | null;
  onUpdated: () => void;
}

export const CurrencyExchangeModal: React.FC<CurrencyExchangeModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onUpdated
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-[#F8F9FA]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] text-[#E8B4A0] flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wide">
                Moneda y Tipo de Cambio
              </h3>
              <p className="text-[11px] text-neutral-500 font-light">
                {inventory?.name || 'Depósito'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 overflow-y-auto">
          <CurrencyExchangeCard
            inventory={inventory}
            onUpdated={() => {
              onUpdated();
            }}
            className="border-0 shadow-none p-0 sm:p-0"
          />
        </div>
      </div>
    </div>
  );
};
