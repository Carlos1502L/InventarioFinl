import React, { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, Database, ShieldAlert, ArrowRightLeft } from 'lucide-react';
import { CancelButton } from '../common/CancelButton';
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  modalFieldInputClass,
  modalFieldLabelClass,
  modalDangerButtonClass
} from '../modals/ModalShell';

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
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      disableDismiss={isLoading}
      onSubmitShortcut={handleConfirm}
    >
      <ModalHeader
        title="Restaurar copia de seguridad"
        subtitle="Reemplazo total de datos del inventario"
        icon={<ShieldAlert className="w-4 h-4 lg:w-5 lg:h-5" />}
        iconTone="rose"
        onClose={onClose}
        closeDisabled={isLoading}
      />

      <ModalBody className="space-y-4 text-xs text-slate-300">
        {/* Advertencia Wipe & Restore (RF-4.1 & RF-4.2) */}
        <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/30 leading-relaxed space-y-2">
          <p className="font-semibold flex items-start gap-2 text-rose-200 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>
              Esta acción vaciará los datos actuales de este inventario y los reemplazará al 100% con los datos de la copia de seguridad.
            </span>
          </p>
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 block">Archivo a procesar:</span>
            <p className="font-mono font-semibold text-slate-100 bg-slate-950/75 px-2.5 py-1.5 rounded-lg border border-slate-800 truncate">
              {fileName}
            </p>
          </div>
        </div>

        {/* Detección de Discrepancia de Moneda (RF-3.1) */}
        {hasCurrencyMismatch && (
          <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/30 leading-relaxed space-y-3">
            <div className="flex items-center gap-2 font-semibold text-amber-300 text-xs">
              <ArrowRightLeft className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Monedas distintas detectadas</span>
            </div>
            <p className="text-xs text-slate-200">
              El respaldo original está en <strong className="font-mono text-white">{normSource}</strong> y este inventario opera en <strong className="font-mono text-white">{normTarget}</strong>.
            </p>

            <div className="space-y-2">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                  applyConversion
                    ? 'bg-slate-900/90 border-indigo-500/70 ring-1 ring-indigo-500/30'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="currency_conversion_choice"
                  checked={applyConversion}
                  onChange={() => setApplyConversion(true)}
                  className="mt-0.5 accent-indigo-400"
                />
                <div className="flex-1 space-y-2 min-w-0">
                  <span className="font-semibold text-xs text-slate-100 block">
                    Convertir automáticamente por tipo de cambio
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 shrink-0">Tasa de cambio:</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={customRate}
                      onChange={(e) => setCustomRate(parseFloat(e.target.value) || 1)}
                      disabled={!applyConversion || isLoading}
                      className="w-28 h-9 px-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono font-bold tabular-nums text-slate-100 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 tabular-nums">
                    {isDivide ? (
                      <>Precios en {normSource} ÷ {customRate} → {normTarget} (Ej: {normSource === 'PEN' ? 'S/' : ''} {exampleSourceVal}.00 → {normTarget === 'USD' ? '$' : '€'} {exampleConvertedVal})</>
                    ) : (
                      <>Precios en {normSource} × {customRate} → {normTarget} (Ej: {normSource === 'USD' ? '$' : '€'} {exampleSourceVal}.00 → {normTarget === 'PEN' ? 'S/' : ''} {exampleConvertedVal})</>
                    )}
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                  !applyConversion
                    ? 'bg-slate-900/90 border-indigo-500/70 ring-1 ring-indigo-500/30'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="currency_conversion_choice"
                  checked={!applyConversion}
                  onChange={() => setApplyConversion(false)}
                  className="mt-0.5 accent-indigo-400"
                />
                <div>
                  <span className="font-semibold text-xs text-slate-100 block">
                    Mantener valores nominales
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Conserva los números brutos del archivo sin conversiones matemáticas.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Confirmación Crítica mediante la palabra RESTAURAR (RF-4.2) */}
        <div className="space-y-1.5 pt-1">
          <label className={modalFieldLabelClass}>
            Para desbloquear la restauración, escribe{' '}
            <span className="font-mono font-bold text-rose-300 bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/30">
              RESTAURAR
            </span>
            :
          </label>
          <input
            type="text"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder="Escribe RESTAURAR"
            disabled={isLoading}
            className={`${modalFieldInputClass} font-mono tracking-widest uppercase`}
            autoFocus
          />
        </div>
      </ModalBody>

      <ModalFooter shortcutLabel="para restaurar">
        <CancelButton onClick={onClose} disabled={isLoading} />
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isConfirmed || isLoading}
          className={modalDangerButtonClass}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Restaurando...</span>
            </>
          ) : (
            <>
              <Database className="w-4 h-4" />
              <span>Confirmar y restaurar</span>
            </>
          )}
        </button>
      </ModalFooter>
    </ModalShell>
  );
};
