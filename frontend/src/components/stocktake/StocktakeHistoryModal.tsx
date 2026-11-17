import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  History,
  Calendar,
  Clock,
  User,
  MapPin,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Package
} from 'lucide-react';
import { supabase, formatCurrency } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { useModalEscape } from '../modals/modalMotion';

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

  useModalEscape(isOpen, onClose);

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return { date: 'Fecha no registrada', time: '--:--' };
    const d = new Date(dateStr);
    const dateFormatted = d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeFormatted = d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return { date: dateFormatted, time: timeFormatted };
  };

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
          created_by,
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

      // Obtener perfiles de los usuarios que realizaron los barridos
      const userIds = Array.from(
        new Set((data || []).map((s: any) => s.created_by).filter(Boolean))
      ) as string[];

      const profilesMap = new Map<string, { email: string; full_name: string | null }>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);
        (profs || []).forEach((p: any) => profilesMap.set(p.id, p));
      }

      // Enriquecer sesiones con información de operador
      const enriched = (data || []).map((s: any) => {
        const prof = s.created_by ? profilesMap.get(s.created_by) : null;
        const operatorName = prof?.full_name || prof?.email || 'Operador del sistema';
        return {
          ...s,
          operatorName,
          operatorEmail: prof?.email
        };
      });

      setSessions(enriched);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 pb-20 sm:pb-6 bg-black/60 backdrop-blur-sm select-none overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-neutral-200/70 overflow-hidden z-10 max-h-[88dvh] sm:max-h-[90dvh] flex flex-col my-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Manija táctil móvil */}
          <div className="w-12 h-1.5 bg-neutral-300 rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />

          {/* Header */}
          <div className="px-5 pt-3 pb-3 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-800">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  Historial de Ajustes
                </h2>
                <p className="text-xs text-neutral-400">
                  Registro de ejecutor, fecha y hora de cada ajuste físico
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-950" />
                <span className="text-xs">Cargando historial de ajustes...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-xs text-neutral-400">
                Aún no hay ajustes físicos registrados en este inventario.
              </div>
            ) : selectedSessionDetail ? (
              // Vista de detalle de una sesión específica
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSelectedSessionDetail(null)}
                  className="text-xs font-bold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
                >
                  ← Volver al listado
                </button>

                {(() => {
                  const { date: detailDate, time: detailTime } = formatDateTime(
                    selectedSessionDetail.completed_at || selectedSessionDetail.started_at
                  );
                  return (
                    <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-neutral-950">
                          {selectedSessionDetail.code}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          selectedSessionDetail.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {selectedSessionDetail.status === 'COMPLETED' ? 'Finalizado' : 'En progreso'}
                        </span>
                      </div>

                      {/* Quién */}
                      <div className="flex items-center gap-1.5 text-xs text-neutral-800">
                        <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>Realizado por: <strong className="text-neutral-950">{selectedSessionDetail.operatorName}</strong></span>
                      </div>

                      {/* Cuándo y Hora */}
                      <div className="flex items-center gap-4 text-xs text-neutral-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{detailDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="font-mono font-medium">{detailTime}</span>
                        </div>
                      </div>

                      {/* Estante */}
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>Estante: <strong>{selectedSessionDetail.locations?.name || 'Ubicación'}</strong> ({selectedSessionDetail.locations?.code})</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-neutral-700 block">
                    Productos verificados ({selectedSessionDetail.stocktake_items?.length || 0}):
                  </span>

                  {/* Recuadro con scroll interno para productos verificados */}
                  <div className="space-y-1.5 max-h-[340px] sm:max-h-[420px] overflow-y-auto overscroll-contain pr-1">
                    {(selectedSessionDetail.stocktake_items || []).map((item: any) => {
                      const diff = Number(item.difference_qty || 0);
                      const isDeficit = diff < 0;
                      const isSurplus = diff > 0;

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
                            {isSurplus ? '+' : ''}{diff} unds
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              // Listado de sesiones con scroll interno
              <div className="space-y-2.5 max-h-[440px] sm:max-h-[520px] overflow-y-auto overscroll-contain pr-1">
                {sessions.map((sess) => {
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

                  const { date: sessDate, time: sessTime } = formatDateTime(sess.completed_at || sess.started_at);

                  return (
                    <div
                      key={sess.id}
                      onClick={() => setSelectedSessionDetail(sess)}
                      className="p-3.5 rounded-2xl bg-white border border-neutral-200/70 hover:border-neutral-900/40 transition-all cursor-pointer active:scale-[0.99] space-y-2.5 shadow-xs"
                    >
                      {/* Fila 1: Código + Estado */}
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

                      {/* Fila 2: Quién realizó el ajuste */}
                      <div className="flex items-center gap-1.5 text-xs text-neutral-800">
                        <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">
                          Realizado por: <strong className="text-neutral-950 font-semibold">{sess.operatorName}</strong>
                        </span>
                      </div>

                      {/* Fila 3: Cuándo (Fecha) y A qué hora (Hora) */}
                      <div className="flex items-center gap-4 text-[11px] text-neutral-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{sessDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="font-mono tabular-nums font-semibold text-neutral-700">{sessTime}</span>
                        </div>
                      </div>

                      {/* Fila 4: Estante */}
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600 truncate">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">
                          Estante: <strong className="text-neutral-900">{sess.locations?.name || 'Ubicación'}</strong> ({sess.locations?.code})
                        </span>
                      </div>

                      {/* Fila 5: Resumen de Ajuste */}
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-[11px] text-neutral-500">
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
                          className="w-full mt-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          Reanudar este Barrido
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
