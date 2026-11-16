import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  History,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Loader2,
  Package
} from 'lucide-react';
import { supabase, formatCurrency, formatDate } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { StocktakeSession } from '../../types/database';

interface StocktakeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSessionToResume?: (session: any) => void;
}

export const StocktakeHistoryModal: React.FC<StocktakeHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectSessionToResume
}) => {
  const { currentInventory } = useAuth();
  const currency = currentInventory?.currency || 'PEN';

  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<any | null>(null);

  const fetchHistory = async () => {
    if (!currentInventory) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('stocktake_sessions')
        .select(`
          id,
          code,
          status,
          started_at,
          completed_at,
          notes,
          location_id,
          locations (
            id,
            name,
            code
          ),
          stocktake_items (
            id,
            expected_qty,
            counted_qty,
            difference_qty,
            unit_cost_snapshot,
            products (
              id,
              name,
              code
            )
          )
        `)
        .eq('inventory_id', currentInventory.id)
        .order('started_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Error fetching stocktake history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      setSelectedSessionDetail(null);
    }
  }, [isOpen, currentInventory]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-neutral-950/70 backdrop-blur-xs select-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        <motion.div
          initial={{ y: '100%', opacity: 0.9 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative w-full max-w-xl bg-white rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl border border-neutral-200/80 overflow-hidden z-10 max-h-[90dvh] flex flex-col"
        >
          {/* Manija táctil */}
          <div className="w-12 h-1.5 bg-neutral-300 rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />

          {/* Header */}
          <div className="px-5 pt-3 pb-3 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-800">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  Historial de Barridos
                </h2>
                <p className="text-xs text-neutral-400">
                  Conteos cíclicos y tomas físicas registradas
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-950" />
                <span className="text-xs">Cargando historial de barridos...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-xs text-neutral-400">
                Aún no hay barridos físicos registrados en este inventario.
              </div>
            ) : selectedSessionDetail ? (
              // Vista de detalle de una sesión específica
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSelectedSessionDetail(null)}
                  className="text-xs font-bold text-neutral-600 hover:text-neutral-900 flex items-center gap-1"
                >
                  ← Volver al listado
                </button>

                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-neutral-900">
                      {selectedSessionDetail.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedSessionDetail.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedSessionDetail.status === 'IN_PROGRESS'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-neutral-100 text-neutral-700'
                    }`}>
                      {selectedSessionDetail.status === 'COMPLETED' ? 'Finalizado' : 'En progreso'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Estante: <strong>{selectedSessionDetail.locations?.name || 'Ubicación'}</strong> ({selectedSessionDetail.locations?.code})</span>
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Fecha: {formatDate(selectedSessionDetail.started_at)}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-neutral-700 block">
                    Productos verificados ({selectedSessionDetail.stocktake_items?.length || 0}):
                  </span>

                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {(selectedSessionDetail.stocktake_items || []).map((item: any) => {
                      const diff = Number(item.difference_qty || 0);
                      const isDeficit = diff < 0;
                      const isSurplus = diff > 0;
                      const isMatch = diff === 0;

                      return (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl border border-neutral-100 bg-white flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-neutral-900 truncate">
                              {item.products?.name || 'Producto'}
                            </p>
                            <p className="text-[11px] text-neutral-400 font-mono">
                              SKU: {item.products?.code} · Teórico: {item.expected_qty} → Físico: {item.counted_qty}
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold shrink-0 ${
                            isDeficit
                              ? 'bg-rose-50 text-rose-700'
                              : isSurplus
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {isSurplus ? '+' : ''}{diff}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              // Listado de sesiones
              sessions.map((sess) => {
                const totalItems = sess.stocktake_items?.length || 0;
                let adjustedCount = 0;
                let netCostImpact = 0;

                (sess.stocktake_items || []).forEach((it: any) => {
                  const diff = Number(it.difference_qty || 0);
                  const cost = Number(it.unit_cost_snapshot || 0);
                  if (diff !== 0) {
                    adjustedCount++;
                    netCostImpact += (diff * cost);
                  }
                });

                return (
                  <div
                    key={sess.id}
                    onClick={() => setSelectedSessionDetail(sess)}
                    className="p-3.5 rounded-2xl bg-white border border-neutral-200/70 hover:border-neutral-900/40 transition-all cursor-pointer active:scale-[0.99] space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-neutral-950 bg-neutral-100 px-2 py-0.5 rounded-md">
                          {sess.code}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sess.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {sess.status === 'COMPLETED' ? 'Finalizado' : 'En Progreso'}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-400" />
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-600">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="font-semibold text-neutral-900 truncate">
                          {sess.locations?.name || 'Ubicación'}
                        </span>
                        <span className="text-[11px] font-mono text-neutral-400">
                          ({sess.locations?.code})
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-400 shrink-0">
                        {formatDate(sess.started_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-[11px] text-neutral-500">
                      <span>{totalItems} productos verificados · {adjustedCount} ajustados</span>
                      {adjustedCount > 0 && (
                        <span className={`font-mono font-semibold ${
                          netCostImpact < 0 ? 'text-rose-600' : 'text-amber-600'
                        }`}>
                          {netCostImpact < 0 ? '-' : '+'}{formatCurrency(Math.abs(netCostImpact), currency)}
                        </span>
                      )}
                    </div>

                    {sess.status === 'IN_PROGRESS' && onSelectSessionToResume && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSessionToResume(sess);
                          onClose();
                        }}
                        className="w-full mt-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors"
                      >
                        Reanudar este Barrido
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
