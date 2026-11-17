import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Package,
  ArrowRight,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Search
} from 'lucide-react';
import { Product, Location } from '../../types/database';
import { formatCurrency } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

export interface StocktakeDiscrepancyItem {
  product: Product;
  expectedQty: number; // Stock teórico en BD para esta ubicación
  countedQty: number;  // Stock físico escaneado por el operario
  differenceQty: number; // countedQty - expectedQty
  unitCost: number;
  totalCostImpact: number; // differenceQty * unitCost
  type: 'DEFICIT' | 'SURPLUS' | 'MATCH';
  isUnscanned: boolean; // Si estaba en BD con stock > 0 pero no fue escaneado
}

interface StocktakeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: Location;
  sessionCode?: string;
  discrepancies: StocktakeDiscrepancyItem[];
  isCommitting: boolean;
  onConfirmAdjust: () => void;
  onContinueCounting: () => void;
}

export const StocktakeReviewModal: React.FC<StocktakeReviewModalProps> = ({
  isOpen,
  onClose,
  location,
  sessionCode = 'BRR-0001',
  discrepancies,
  isCommitting,
  onConfirmAdjust,
  onContinueCounting
}) => {
  const { currentInventory } = useAuth();
  const currency = currentInventory?.currency || 'PEN';

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'DEFICIT' | 'SURPLUS' | 'MATCH'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Métricas consolidadas
  const summary = useMemo(() => {
    let deficitUnits = 0;
    let deficitCost = 0;
    let deficitCount = 0;

    let surplusUnits = 0;
    let surplusCost = 0;
    let surplusCount = 0;

    let matchCount = 0;

    discrepancies.forEach((item) => {
      if (item.type === 'DEFICIT') {
        deficitCount++;
        deficitUnits += Math.abs(item.differenceQty);
        deficitCost += Math.abs(item.totalCostImpact);
      } else if (item.type === 'SURPLUS') {
        surplusCount++;
        surplusUnits += item.differenceQty;
        surplusCost += item.totalCostImpact;
      } else {
        matchCount++;
      }
    });

    const netCostImpact = surplusCost - deficitCost;

    return {
      totalItems: discrepancies.length,
      deficitCount,
      deficitUnits: Number(deficitUnits.toFixed(4)),
      deficitCost: Number(deficitCost.toFixed(2)),
      surplusCount,
      surplusUnits: Number(surplusUnits.toFixed(4)),
      surplusCost: Number(surplusCost.toFixed(2)),
      matchCount,
      netCostImpact: Number(netCostImpact.toFixed(2))
    };
  }, [discrepancies]);

  // Lista filtrada
  const filteredItems = useMemo(() => {
    return discrepancies.filter((item) => {
      if (activeFilter !== 'ALL' && item.type !== activeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.product.name.toLowerCase().includes(q);
        const matchesCode = item.product.code.toLowerCase().includes(q);
        return matchesName || matchesCode;
      }
      return true;
    });
  }, [discrepancies, activeFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm select-none overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal Sheet de Cierre */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-neutral-200/80 overflow-hidden z-10 max-h-[92dvh] flex flex-col my-auto"
        >
          {/* Manija táctil móvil */}
          <div className="w-12 h-1.5 bg-neutral-300 rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />

          {/* Header Superior Fijo */}
          <div className="px-5 pt-3 pb-3 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                  Conciliación de Ajuste · {sessionCode}
                </span>
              </div>
              <h2 className="text-base font-bold text-neutral-900 truncate">
                {location.name} <span className="text-xs font-mono font-medium text-neutral-400">({location.code})</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isCommitting}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Contenedor Scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Tarjetas de Resumen KPI (Faltantes, Sobrantes, Cuadrados) */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* Faltantes (Rojo) */}
              <div
                onClick={() => setActiveFilter(activeFilter === 'DEFICIT' ? 'ALL' : 'DEFICIT')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  activeFilter === 'DEFICIT'
                    ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400'
                    : 'bg-rose-50/50 border-rose-100 hover:border-rose-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-rose-700 text-xs font-bold">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Faltantes</span>
                </div>
                <div className="mt-1">
                  <span className="text-base font-mono font-bold text-rose-800 tabular-nums">
                    -{summary.deficitUnits}
                  </span>
                  <span className="text-[11px] text-rose-600 font-medium block truncate">
                    -{formatCurrency(summary.deficitCost, currency)}
                  </span>
                </div>
              </div>

              {/* Sobrantes (Ámbar) */}
              <div
                onClick={() => setActiveFilter(activeFilter === 'SURPLUS' ? 'ALL' : 'SURPLUS')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  activeFilter === 'SURPLUS'
                    ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400'
                    : 'bg-amber-50/50 border-amber-100 hover:border-amber-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Sobrantes</span>
                </div>
                <div className="mt-1">
                  <span className="text-base font-mono font-bold text-amber-800 tabular-nums">
                    +{summary.surplusUnits}
                  </span>
                  <span className="text-[11px] text-amber-600 font-medium block truncate">
                    +{formatCurrency(summary.surplusCost, currency)}
                  </span>
                </div>
              </div>

              {/* Validados (Verde) */}
              <div
                onClick={() => setActiveFilter(activeFilter === 'MATCH' ? 'ALL' : 'MATCH')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  activeFilter === 'MATCH'
                    ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400'
                    : 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Validados</span>
                </div>
                <div className="mt-1">
                  <span className="text-base font-mono font-bold text-emerald-800 tabular-nums">
                    {summary.matchCount}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-medium block truncate">
                    0 dif.
                  </span>
                </div>
              </div>
            </div>

            {/* Búsqueda rápida de productos conciliados */}
            <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200/60 rounded-xl px-3 py-2 text-xs">
              <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por nombre o código..."
                className="w-full bg-transparent outline-none text-neutral-800 placeholder:text-neutral-400"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="text-neutral-400 hover:text-neutral-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Lista de Ítems Conciliados */}
            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-neutral-400">
                  No hay productos en esta vista de filtro.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isDeficit = item.type === 'DEFICIT';
                  const isSurplus = item.type === 'SURPLUS';
                  const isMatch = item.type === 'MATCH';

                  return (
                    <div
                      key={item.product.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        isDeficit
                          ? 'bg-rose-50/40 border-rose-200/80'
                          : isSurplus
                          ? 'bg-amber-50/40 border-amber-200/80'
                          : 'bg-emerald-50/30 border-emerald-200/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {item.isUnscanned && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-600 text-white uppercase tracking-wider">
                                No Escaneado
                              </span>
                            )}
                            <p className="text-xs font-bold text-neutral-900 truncate">
                              {item.product.name}
                            </p>
                          </div>
                          <p className="text-[11px] font-mono text-neutral-400 mt-0.5 truncate">
                            SKU: {item.product.code} · Costo: {formatCurrency(item.unitCost, currency)}
                          </p>
                        </div>

                        {/* Badge de Diferencia */}
                        <div className="text-right shrink-0">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-lg text-xs font-mono font-bold tabular-nums ${
                              isDeficit
                                ? 'bg-rose-100 text-rose-800'
                                : isSurplus
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isSurplus ? '+' : ''}{item.differenceQty} unds
                          </span>
                        </div>
                      </div>

                      {/* Desglose Teórico vs Contado */}
                      <div className="mt-2 pt-2 border-t border-neutral-100/80 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-3 text-neutral-500">
                          <span>Teórico: <strong className="text-neutral-700 font-mono">{item.expectedQty}</strong></span>
                          <span>→</span>
                          <span>Físico: <strong className="text-neutral-900 font-mono font-bold">{item.countedQty}</strong></span>
                        </div>

                        {item.differenceQty !== 0 && (
                          <span className={`font-mono text-[11px] font-semibold ${
                            isDeficit ? 'text-rose-700' : 'text-amber-700'
                          }`}>
                            Impacto: {isSurplus ? '+' : '-'}{formatCurrency(Math.abs(item.totalCostImpact), currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Barra de Acciones Fija Inferior */}
          <div className="p-4 border-t border-neutral-100 bg-white shrink-0 space-y-2">
            <button
              type="button"
              onClick={onConfirmAdjust}
              disabled={isCommitting}
              className="w-full py-4 rounded-2xl bg-neutral-950 hover:bg-neutral-900 text-white font-bold text-sm shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isCommitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Aplicando ajuste en base de datos...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>Confirmar y Ajustar en Kardex ({discrepancies.length} productos)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onContinueCounting}
              disabled={isCommitting}
              className="w-full py-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-40"
            >
              Seguir Contando (Volver al Barrido)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
