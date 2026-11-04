import React, { useState, useEffect } from 'react';
import {
  Coins,
  RefreshCw,
  Clock,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  HelpCircle,
  Save,
  ArrowRight
} from 'lucide-react';
import { Inventory } from '../../types/database';
import { supabase, getApiUrl, formatDate } from '../../services/supabase';
import { showAppToast } from '../ui';

interface CurrencyExchangeCardProps {
  inventory: Inventory | null;
  onUpdated: () => void;
  className?: string;
}

const SUPPORTED_CURRENCIES = [
  { code: 'PEN', name: 'Sol Peruano (PEN)', symbol: 'S/' },
  { code: 'USD', name: 'Dólar Estadounidense (USD)', symbol: '$' },
  { code: 'EUR', name: 'Euro (EUR)', symbol: '€' }
];

export const CurrencyExchangeCard: React.FC<CurrencyExchangeCardProps> = ({
  inventory,
  onUpdated,
  className = ''
}) => {
  const [selectedCurrency, setSelectedCurrency] = useState(inventory?.currency || 'PEN');
  const [rateInput, setRateInput] = useState<string>(
    inventory?.exchange_rate ? String(inventory.exchange_rate) : '1.000'
  );

  const [isSavingCurrencyOnly, setIsSavingCurrencyOnly] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    if (inventory) {
      setSelectedCurrency(inventory.currency || 'PEN');
      setRateInput(inventory.exchange_rate ? String(inventory.exchange_rate) : '1.000');
    }
  }, [inventory]);

  const currentRate = Number(inventory?.exchange_rate) || 1.0;
  const parsedNewRate = parseFloat(rateInput);
  const isValidRate = !isNaN(parsedNewRate) && parsedNewRate > 0;

  // Cálculo del ratio de conversión para previsualización
  const ratio = isValidRate && currentRate > 0 ? parsedNewRate / currentRate : 1.0;

  // Guardar solo Moneda y Tasa (Sin recalcular precios de catálogo)
  const handleSaveCurrencyOnly = async () => {
    if (!inventory?.id) return;
    if (!isValidRate) {
      showAppToast('Ingresa una tasa de cambio numérica válida (ej. 3.750).', 'warning');
      return;
    }

    setIsSavingCurrencyOnly(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('inventories')
        .update({
          currency: selectedCurrency,
          exchange_rate: Number(parsedNewRate.toFixed(3)),
          exchange_rate_updated_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', inventory.id);

      if (error) throw error;

      showAppToast('Configuración de divisa y tasa guardada con éxito.', 'success');
      onUpdated();
    } catch (err: any) {
      console.error('Error guardando divisa:', err);
      showAppToast(err.message || 'No se pudo guardar la configuración.', 'error');
    } finally {
      setIsSavingCurrencyOnly(false);
    }
  };

  // Disparar recálculo masivo transaccional
  const handleExecuteRecalculate = async () => {
    if (!inventory?.id) return;
    if (!isValidRate) {
      showAppToast('Ingresa una tasa de cambio válida.', 'warning');
      return;
    }

    setIsRecalculating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No hay sesión de autenticación activa.');

      const res = await fetch(getApiUrl('/backup/recalculate-prices'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          inventory_id: inventory.id,
          new_rate: Number(parsedNewRate.toFixed(3)),
          new_currency: selectedCurrency
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al recalcular precios del inventario.');
      }

      setConfirmModalOpen(false);
      showAppToast(
        `Precios recalculados con éxito (${data.affected_products || 0} productos actualizados).`,
        'success',
        6000
      );

      // Despachar evento para sincronizar vistas de productos
      try {
        window.dispatchEvent(new CustomEvent('stockly_inventory_data_updated'));
      } catch (e) {}

      onUpdated();
    } catch (err: any) {
      console.error('Error recalculando precios:', err);
      showAppToast(err.message || 'No se pudo completar el recálculo masivo.', 'error');
    } finally {
      setIsRecalculating(false);
    }
  };

  const lastUpdatedDisplay = inventory?.exchange_rate_updated_at
    ? formatDate(inventory.exchange_rate_updated_at)
    : inventory?.updated_at
    ? formatDate(inventory.updated_at)
    : 'Sin cambios registrados';

  return (
    <>
      <div className={`bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5 ${className}`}>
        {/* Cabecera de la sección */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5 text-[#1E3A5F]" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#1E3A5F] uppercase tracking-tight">
                Moneda y Tipo de Cambio
              </h3>
              <p className="text-xs text-[#616161] font-light">
                Divisa operativa del depósito y recálculo masivo de precios del catálogo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#616161] bg-[#F8F9FA] px-3 py-1.5 rounded-full border border-[#E5E7EB] shrink-0 self-start sm:self-center">
            <Clock className="w-3.5 h-3.5 text-[#E8B4A0]" />
            <span>Última act.: {lastUpdatedDisplay}</span>
          </div>
        </div>

        {/* Formulario de Moneda y Tasa */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-1">
          {/* Moneda del Inventario */}
          <div className="sm:col-span-6 space-y-1.5">
            <label className="text-xs font-semibold text-[#1E3A5F] block">
              Moneda del Inventario
            </label>
            <div className="relative">
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-neutral-50 border border-[#E5E7EB] focus:border-[#1E3A5F] text-xs font-semibold text-[#1E3A5F] focus:outline-none transition-all shadow-2xs"
              >
                {SUPPORTED_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code} className="text-neutral-900 bg-white">
                    {curr.name} ({curr.symbol})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-[#616161] font-light">
              Divisa en la que se calculan los precios, costos y balances.
            </p>
          </div>

          {/* Tasa de Cambio Operativa (exchange_rate) */}
          <div className="sm:col-span-6 space-y-1.5">
            <label className="text-xs font-semibold text-[#1E3A5F] flex items-center justify-between">
              <span>Tasa de Cambio Operativa</span>
              <span className="text-[10px] font-mono text-neutral-400">Hasta 3 decimales</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.001"
                min="0.001"
                max="99999.999"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder="Ej. 3.750"
                className="w-full h-11 px-3.5 rounded-xl bg-neutral-50 border border-[#E5E7EB] focus:border-[#1E3A5F] text-xs font-mono font-bold text-[#1E3A5F] focus:outline-none transition-all shadow-2xs"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-semibold text-neutral-400 pointer-events-none">
                TASA
              </div>
            </div>
            <p className="text-[11px] text-[#616161] font-light">
              Tasa operativa de conversión (actual: {currentRate.toFixed(3)}).
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="pt-2 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          {/* Botón 1: Guardar Divisa / Tasa sin recalcular */}
          <button
            type="button"
            onClick={handleSaveCurrencyOnly}
            disabled={isSavingCurrencyOnly || isRecalculating || !isValidRate}
            className="h-10 px-4 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] hover:bg-neutral-100 text-[#1E3A5F] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {isSavingCurrencyOnly ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1E3A5F]" />
            ) : (
              <Save className="w-3.5 h-3.5 text-[#1E3A5F]" />
            )}
            <span>Guardar Divisa / Tasa</span>
          </button>

          {/* Botón 2: Actualizar Tipo de Cambio y Recalcular Precios */}
          <button
            type="button"
            onClick={() => {
              if (!isValidRate) {
                showAppToast('Ingresa una tasa de cambio válida antes de continuar.', 'warning');
                return;
              }
              setConfirmModalOpen(true);
            }}
            disabled={isSavingCurrencyOnly || isRecalculating || !isValidRate}
            className="h-10 px-4 rounded-xl bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#E8B4A0]" />
            <span>Actualizar Tipo de Cambio y Recalcular Precios</span>
          </button>
        </div>
      </div>

      {/* Modal de Confirmación Transaccional de Recálculo Masivo */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-neutral-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm sm:text-base text-neutral-900">
                  ¿Confirmar Recálculo Masivo de Precios?
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Operación transaccional sobre el catálogo de productos
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-700 space-y-2">
              <p>
                Se recalcularán los precios de venta y costos de todos los productos activos según la nueva tasa{' '}
                <strong className="text-[#1E3A5F] font-mono">{parsedNewRate.toFixed(3)}</strong>.
              </p>
              
              <div className="pt-2 border-t border-neutral-200 text-[11px] font-mono space-y-1 text-neutral-600">
                <div className="flex items-center justify-between">
                  <span>Tasa actual:</span>
                  <span className="font-bold">{currentRate.toFixed(3)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Nueva tasa:</span>
                  <span className="font-bold text-[#1E3A5F]">{parsedNewRate.toFixed(3)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Factor proporcional aplicado:</span>
                  <span className="font-bold text-amber-700">×{ratio.toFixed(4)}</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 leading-normal">
              Fórmula atómica:{' '}
              <span className="font-mono bg-neutral-100 px-1 py-0.5 rounded text-neutral-800">
                Nuevo = Anterior × ({parsedNewRate.toFixed(3)} / {currentRate.toFixed(3)})
              </span>
              . Los montos se redondearán a 2 decimales y el evento se registrará en los registros de auditoría.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={isRecalculating}
                className="h-10 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteRecalculate}
                disabled={isRecalculating}
                className="h-10 px-4 rounded-xl bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isRecalculating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E8B4A0]" />
                    <span>Recalculando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-[#E8B4A0]" />
                    <span>Sí, Recalcular Precios</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
