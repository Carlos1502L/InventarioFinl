import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2, Database, ShieldAlert, ArrowRightLeft, DollarSign } from 'lucide-react';
import { CancelButton } from '../common/CancelButton';

export interface CurrencyConversionOptions {
  enabled: boolean;
  rate: number;
  operation: 'DIVIDE' | 'MULTIPLY';
  source_currency: string;
  target_currency: string;
}

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  onConfirm: (conversionOptions?: CurrencyConversionOptions) => Promise<void>;
  isLoading: boolean;
  sourceCurrency?: string;
  targetCurrency?: string;
  backupExchangeRate?: number;
  inventoryExchangeRate?: number;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  fileName,
  onConfirm,
  isLoading,
  sourceCurrency = 'PEN',
  targetCurrency = 'PEN',
  backupExchangeRate,
  inventoryExchangeRate
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  
  // Detección automática de discrepancia de moneda (RF-3.1)
  const normSource = (sourceCurrency || 'PEN').toUpperCase();
  const normTarget = (targetCurrency || 'PEN').toUpperCase();
  const hasCurrencyMismatch = normSource !== normTarget;

  // Estado de opción de conversión: por defecto true si hay discrepancia
  const [applyConversion, setApplyConversion] = useState(true);

  // Tasa precargada
  const initialRate = Number(backupExchangeRate || inventoryExchangeRate || 3.75);
  const [customRate, setCustomRate] = useState<number>(initialRate > 0 ? initialRate : 3.75);

  useEffect(() => {
    if (isOpen) {
      setConfirmationText('');
      setApplyConversion(hasCurrencyMismatch);
      const r = Number(backupExchangeRate || inventoryExchangeRate || 3.75);
      setCustomRate(r > 0 ? r : 3.75);
    }
  }, [isOpen, hasCurrencyMismatch, backupExchangeRate, inventoryExchangeRate]);

  if (!isOpen) return null;

  const isConfirmed = confirmationText.trim().toUpperCase() === 'RESTAURAR';

  // Determinación de operación según par de divisas
  const isDivide = normSource === 'PEN' && (normTarget === 'USD' || normTarget === 'EUR');
  const operation: 'DIVIDE' | 'MULTIPLY' = isDivide ? 'DIVIDE' : 'MULTIPLY';

  const handleConfirm = async () => {
    if (!isConfirmed || isLoading) return;

    if (hasCurrencyMismatch) {
      await onConfirm({
        enabled: applyConversion,
        rate: Math.max(0.001, customRate),
        operation,
        source_currency: normSource,
        target_currency: normTarget
      });
    } else {
      await onConfirm();
    }
  };

  // Cálculo de ejemplo dinámico
  const exampleSourceVal = isDivide ? 140 : 40;
  const exampleConvertedVal = isDivide 
    ? (exampleSourceVal / (customRate || 1)).toFixed(2)
    : (exampleSourceVal * (customRate || 1)).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 max-md:bg-black/75 backdrop-blur-sm p-3 sm:p-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in fade-in">
      <div className="mobile-dark-modal bg-white border border-[#E5E7EB] rounded-2xl w-full max-w-lg max-h-[92vh] overflow-hidden shadow-2xl flex flex-col font-sans">
        
        {/* Cabecera Limpia */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rose-100 bg-rose-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-bold text-rose-900 text-base uppercase tracking-tight">
                Restaurar Copia de Seguridad
              </h3>
              <p className="text-xs text-rose-600">Reemplazo total · Acción crítica</p>
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
        <div className="p-5 space-y-4 text-xs text-neutral-700 overflow-y-auto custom-scrollbar">
          
          {/* Advertencia Wipe & Restore (RF-4.1 & RF-4.2) */}
          <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 leading-relaxed space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              Esta acción vaciará los datos actuales de este inventario y los reemplazará al 100% con los datos de la copia de seguridad.
            </p>
            <p className="text-[11px] text-rose-700">
              Archivo a procesar:
            </p>
            <p className="font-mono font-bold text-rose-950 bg-white/80 px-2 py-1 rounded border border-rose-200/60 truncate">
              {fileName}
            </p>
          </div>

          {/* Detección de Discrepancia de Moneda (RF-3.1) */}
          {hasCurrencyMismatch && (
            <div className="p-3.5 bg-amber-50/90 rounded-xl border border-amber-200 text-amber-950 leading-relaxed space-y-2.5 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-amber-800 text-xs">
                <ArrowRightLeft className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Monedas distintas detectadas</span>
              </div>
              <p className="text-xs text-amber-900">
                El respaldo original está en <strong>{normSource}</strong> y este inventario opera en <strong>{normTarget}</strong>.
              </p>

              {/* Opciones obligatorias */}
              <div className="space-y-2 pt-1">
                <label className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  applyConversion 
                    ? 'bg-white border-[#1E3A5F] ring-1 ring-[#1E3A5F]/20 shadow-2xs' 
                    : 'bg-white/60 border-neutral-200 hover:bg-white'
                }`}>
                  <input
                    type="radio"
                    name="currency_conversion_choice"
                    checked={applyConversion}
                    onChange={() => setApplyConversion(true)}
                    className="mt-0.5 text-[#1E3A5F] focus:ring-[#1E3A5F]"
                  />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <span className="font-semibold text-xs text-neutral-900 block">
                      Convertir automáticamente por Tipo de Cambio
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-neutral-600 shrink-0">Tasa de cambio:</span>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={customRate}
                        onChange={(e) => setCustomRate(parseFloat(e.target.value) || 1)}
                        disabled={!applyConversion || isLoading}
                        className="w-28 h-8 px-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-mono font-bold text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                      />
                    </div>
                    <p className="text-[10px] text-neutral-600 font-mono bg-neutral-100/70 p-1.5 rounded border border-neutral-200/50">
                      {isDivide ? (
                        <>Precios en {normSource} ÷ {customRate} → {normTarget} (Ej: {normSource === 'PEN' ? 'S/' : ''} {exampleSourceVal}.00 → {normTarget === 'USD' ? '$' : '€'} {exampleConvertedVal})</>
                      ) : (
                        <>Precios en {normSource} × {customRate} → {normTarget} (Ej: {normSource === 'USD' ? '$' : '€'} {exampleSourceVal}.00 → {normTarget === 'PEN' ? 'S/' : ''} {exampleConvertedVal})</>
                      )}
                    </p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  !applyConversion 
                    ? 'bg-white border-[#1E3A5F] ring-1 ring-[#1E3A5F]/20 shadow-2xs' 
                    : 'bg-white/60 border-neutral-200 hover:bg-white'
                }`}>
                  <input
                    type="radio"
                    name="currency_conversion_choice"
                    checked={!applyConversion}
                    onChange={() => setApplyConversion(false)}
                    className="mt-0.5 text-[#1E3A5F] focus:ring-[#1E3A5F]"
                  />
                  <div>
                    <span className="font-semibold text-xs text-neutral-900 block">
                      Mantener valores nominales
                    </span>
                    <p className="text-[11px] text-neutral-500">
                      Conserva los números brutos del archivo sin conversiones matemáticas.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Confirmación Crítica mediante la palabra RESTAURAR (RF-4.2) */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-semibold text-neutral-800">
              Para desbloquear la restauración, escribe <span className="font-mono font-bold text-rose-600">RESTAURAR</span>:
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
          <CancelButton onClick={onClose} disabled={isLoading} />
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
