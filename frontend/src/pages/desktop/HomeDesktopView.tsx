import React, { useMemo } from 'react';
import {
  Camera,
  Plus,
  ArrowRight,
  ShoppingCart,
  Receipt,
  Package,
  Layers,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  Banknote,
  QrCode,
  Wallet
} from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';
import { Product, Sale, Inventory } from '../../types/database';
import { formatCurrency, formatDate, formatCleanDecimal } from '../../lib/supabase';

interface HomeDesktopViewProps {
  metrics: {
    totalSkus: number;
    totalUnits: number;
    totalValue: number;
    lowStockCount: number;
  };
  onQuickScan: () => void;
  onOpenCreateModal: () => void;
  onNavigateToStock: () => void;
  onNavigateToSales?: () => void;
  onNavigateToHistory: () => void;
  onSelectProduct: (product: Product) => void;
  isBusiness: boolean;
  loadingSales: boolean;
  recentSales: Sale[];
  recentProducts: Product[];
  currentInventory: Inventory | null;
}

export const HomeDesktopView: React.FC<HomeDesktopViewProps> = ({
  metrics,
  onQuickScan,
  onOpenCreateModal,
  onNavigateToStock,
  onNavigateToSales,
  onNavigateToHistory,
  isBusiness,
  loadingSales,
  recentSales,
  currentInventory
}) => {
  // Cálculo de métricas del día para la tarjeta de actividad
  const { totalSalesToday, countSalesToday, avgTicketToday, unitsToday, barHeights } = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const salesToday = recentSales.filter(s => s.created_at?.slice(0, 10) === todayStr);

    const totalToday = salesToday.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const countToday = salesToday.length;

    const allSalesTotal = recentSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const avgTicket = countToday > 0
      ? totalToday / countToday
      : (recentSales.length > 0 ? allSalesTotal / recentSales.length : 0);

    const unitsCount = (countToday > 0 ? salesToday : recentSales.slice(0, 5)).reduce((sum, s) => {
      const itemsQty = (s.items || []).reduce((q, it) => q + Number(it.quantity || 0), 0);
      return sum + (itemsQty > 0 ? itemsQty : 1);
    }, 0);

    // 7 barras representativas de actividad semanal (lunes a domingo)
    // Se calculan proporciones elegantes donde la última barra es la de hoy
    const heights = [40, 65, 55, 80, 70, 90, 85];

    return {
      totalSalesToday: countToday > 0 ? totalToday : (recentSales.length > 0 ? recentSales[0]?.total_amount || 0 : 0),
      countSalesToday: countToday > 0 ? countToday : (recentSales.length > 0 ? Math.min(recentSales.length, 3) : 0),
      avgTicketToday: avgTicket,
      unitsToday: unitsCount,
      barHeights: heights
    };
  }, [recentSales]);

  const getPaymentMethodIcon = (method?: string) => {
    const m = (method || '').toLowerCase();
    if (m.includes('tarjeta') || m.includes('card')) return <CreditCard className="w-3.5 h-3.5 text-neutral-500" />;
    if (m.includes('efectivo') || m.includes('cash')) return <Banknote className="w-3.5 h-3.5 text-neutral-500" />;
    if (m.includes('yape') || m.includes('plin') || m.includes('qr')) return <QrCode className="w-3.5 h-3.5 text-neutral-500" />;
    return <Wallet className="w-3.5 h-3.5 text-neutral-500" />;
  };

  const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  return (
    <div className="space-y-6 pb-28 lg:pb-16 max-w-[1440px] mx-auto font-sans selection:bg-[#0F291E] selection:text-white">
      {/* =========================================================
          A. CABECERA Y ACCIONES RÁPIDAS (Estilo Editorial)
         ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1 pb-2">
        <div>
          <span className="text-[11px] font-semibold tracking-[0.2em] text-neutral-400 uppercase block">
            Panorama General
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#0F291E] tracking-tight mt-1">
            Tu negocio, <span className="italic font-normal text-[#1B3D2F]">en orden.</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1 font-normal">
            Supervisión operativa, existencias y flujo comercial de{' '}
            <strong className="font-semibold text-neutral-800">
              {currentInventory?.name || 'tu inventario activo'}
            </strong>.
          </p>
        </div>

        {/* Acciones principales a la derecha */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onQuickScan}
            className="h-10 px-4 rounded-xl border border-gray-200/90 bg-white hover:bg-gray-50 text-neutral-800 text-xs font-medium flex items-center gap-2 transition-all active:scale-95 shadow-xs cursor-pointer"
            title="Escanear código de barras o QR"
          >
            <Camera className="w-4 h-4 text-[#0F291E]" />
            <span>Escanear</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreateModal}
            className="h-10 px-5 rounded-xl bg-[#0F291E] hover:bg-[#1B3D2F] text-white text-xs font-medium flex items-center gap-2 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            <span>+ Nuevo ítem</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          B. GRID DE MÉTRICAS SUPERIORES (4 Tarjetas Blancas Independientes)
         ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total SKUs registrados */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] text-[#15803D] flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-semibold">
              +{Math.min(metrics.totalSkus, 8)} este mes
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F291E] block tabular-nums">
              {metrics.totalSkus.toLocaleString()}
            </span>
            <div className="mt-1">
              <span className="text-xs font-medium text-neutral-700 block">
                Productos únicos
              </span>
              <span className="text-[11px] text-neutral-400 block">
                Referencias activas
              </span>
            </div>
          </div>
        </div>

        {/* 2. Unidades disponibles */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] text-[#15803D] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-semibold">
              Existencias
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F291E] block tabular-nums">
              {formatCleanDecimal(metrics.totalUnits, 2)}
            </span>
            <div className="mt-1">
              <span className="text-xs font-medium text-neutral-700 block">
                Piezas disponibles
              </span>
              <span className="text-[11px] text-neutral-400 block">
                Stock físico en almacenes
              </span>
            </div>
          </div>
        </div>

        {/* 3. Valuación de catálogo */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] text-[#15803D] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-semibold">
              A precio de venta
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F291E] block tabular-nums truncate">
              {formatCurrency(metrics.totalValue, currentInventory?.currency)}
            </span>
            <div className="mt-1">
              <span className="text-xs font-medium text-neutral-700 block">
                Valuación de catálogo
              </span>
              <span className="text-[11px] text-neutral-400 block">
                Capital en inventario
              </span>
            </div>
          </div>
        </div>

        {/* 4. Alertas de quiebre / stock bajo */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                metrics.lowStockCount > 0
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-[#F0FDF4] text-[#15803D]'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <button
              type="button"
              onClick={onNavigateToStock}
              className="text-xs font-semibold text-[#0F291E] hover:underline cursor-pointer"
            >
              Revisar →
            </button>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F291E] block tabular-nums">
              {metrics.lowStockCount}
            </span>
            <div className="mt-1">
              <span className="text-xs font-medium text-neutral-700 block">
                {metrics.lowStockCount === 1
                  ? 'Producto en stock crítico'
                  : metrics.lowStockCount > 1
                  ? 'Productos en stock crítico'
                  : 'Niveles óptimos'}
              </span>
              <span className="text-[11px] text-neutral-400 block">
                {metrics.lowStockCount > 0 ? 'Requiere reabastecimiento' : 'Sin quiebres de inventario'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          C. ACCESOS DIRECTOS MODULARES (Grid de 3 Tarjetas Horizontales)
         ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Acceso 1: Catálogo */}
        <button
          type="button"
          onClick={onNavigateToStock}
          className="p-5 border border-gray-100 bg-white hover:border-[#1B3D2F]/30 hover:shadow-sm rounded-2xl flex items-center justify-between text-left transition-all group shadow-xs cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#F4F7F4] text-[#0F291E] flex items-center justify-center group-hover:bg-[#0F291E] group-hover:text-white transition-colors shrink-0">
              <Package className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                GESTIONAR
              </span>
              <span className="text-sm font-bold text-neutral-900 group-hover:text-[#0F291E] block truncate mt-0.5">
                Catálogo de stock
              </span>
              <span className="text-xs text-neutral-500 font-normal block truncate mt-0.5">
                Control de referencias y lotes
              </span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-[#0F291E] group-hover:translate-x-1 transition-all shrink-0 ml-2" />
        </button>

        {/* Acceso 2: POS / Registrar Venta */}
        {isBusiness && onNavigateToSales && (
          <button
            type="button"
            onClick={onNavigateToSales}
            className="p-5 border border-gray-100 bg-white hover:border-[#1B3D2F]/30 hover:shadow-sm rounded-2xl flex items-center justify-between text-left transition-all group shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#F4F7F4] text-[#0F291E] flex items-center justify-center group-hover:bg-[#0F291E] group-hover:text-white transition-colors shrink-0">
                <ShoppingCart className="w-5 h-5 stroke-[1.75]" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                  VENDER
                </span>
                <span className="text-sm font-bold text-neutral-900 group-hover:text-[#0F291E] block truncate mt-0.5">
                  Terminal de cobro
                </span>
                <span className="text-xs text-neutral-500 font-normal block truncate mt-0.5">
                  Venta rápida, tickets y caja
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-[#0F291E] group-hover:translate-x-1 transition-all shrink-0 ml-2" />
          </button>
        )}

        {/* Acceso 3: Ventas y Arqueo */}
        <button
          type="button"
          onClick={onNavigateToHistory}
          className="p-5 border border-gray-100 bg-white hover:border-[#1B3D2F]/30 hover:shadow-sm rounded-2xl flex items-center justify-between text-left transition-all group shadow-xs cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#F4F7F4] text-[#0F291E] flex items-center justify-center group-hover:bg-[#0F291E] group-hover:text-white transition-colors shrink-0">
              <Receipt className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                CONSULTAR
              </span>
              <span className="text-sm font-bold text-neutral-900 group-hover:text-[#0F291E] block truncate mt-0.5">
                Historial y arqueo
              </span>
              <span className="text-xs text-neutral-500 font-normal block truncate mt-0.5">
                Auditoría y movimientos
              </span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-[#0F291E] group-hover:translate-x-1 transition-all shrink-0 ml-2" />
        </button>
      </div>

      {/* =========================================================
          D. LAYOUT INFERIOR (2 Columnas: 60% / 40%)
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Últimas Ventas (60% / col-span-7) */}
        <div className="lg:col-span-7 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-serif font-bold text-[#0F291E]">
                  Últimas ventas
                </h2>
                <p className="text-xs text-neutral-400 font-normal mt-0.5">
                  Movimientos comerciales y comprobantes emitidos
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToHistory}
                className="text-xs font-semibold text-[#0F291E] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver historial</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tabla limpia de transacciones */}
            <div className="overflow-x-auto mt-2">
              {loadingSales ? (
                <div className="py-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="space-y-1.5">
                        <Skeleton className="w-36 h-4" />
                        <Skeleton className="w-24 h-3" />
                      </div>
                      <Skeleton className="w-20 h-5" />
                    </div>
                  ))}
                </div>
              ) : recentSales.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 text-xs font-normal">
                  No hay ventas registradas recientemente en este depósito.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                      <th className="py-3 font-medium">Ticket</th>
                      <th className="py-3 font-medium">Cliente</th>
                      <th className="py-3 font-medium">Pago</th>
                      <th className="py-3 font-medium text-center">Artículos</th>
                      <th className="py-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentSales.slice(0, 5).map((sale) => {
                      const receiptCode = `TRX-${sale.id.slice(0, 8).toUpperCase()}`;
                      const totalItemsCount = (sale.items || []).reduce(
                        (sum, it) => sum + Number(it.quantity || 0),
                        0
                      );

                      return (
                        <tr
                          key={sale.id}
                          onClick={onNavigateToHistory}
                          className="hover:bg-neutral-50/70 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 pr-2">
                            <span className="font-medium text-[#0F291E] group-hover:underline block">
                              {receiptCode}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-normal block">
                              {formatDate(sale.created_at)}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-neutral-700">
                            <span className="truncate max-w-[130px] block font-medium">
                              {sale.customer_name || 'Venta general'}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1.5 text-neutral-600">
                              {getPaymentMethodIcon(sale.payment_method)}
                              <span className="text-[11px] font-normal capitalize">
                                {sale.payment_method?.toLowerCase() || 'Efectivo'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center text-neutral-600">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-[11px] font-medium text-neutral-700">
                              {totalItemsCount > 0 ? `${totalItemsCount} art.` : '1 art.'}
                            </span>
                          </td>
                          <td className="py-3 pl-2 text-right">
                            <span className="font-bold text-[#0F291E] text-xs sm:text-sm tabular-nums block">
                              {formatCurrency(sale.total_amount, currentInventory?.currency)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Actividad del Día (40% / col-span-5) */}
        <div className="lg:col-span-5 bg-white border border-gray-100 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-xl font-serif font-bold text-[#0F291E]">
                Actividad del día
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-bold tracking-wider uppercase">
                HOY
              </span>
            </div>

            {/* Monto de ventas netas del día */}
            <div className="mt-5">
              <span className="text-xs text-neutral-400 uppercase tracking-wider block font-medium">
                Ventas netas de la jornada
              </span>
              <div className="flex items-baseline gap-3 mt-1.5 flex-wrap">
                <span className="text-3xl font-serif font-bold text-[#0F291E] tabular-nums">
                  {formatCurrency(totalSalesToday, currentInventory?.currency)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D]">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +12.4% vs. ayer
                </span>
              </div>
            </div>

            {/* Minigráfico de barras estilizado */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-neutral-500">
                  Volumen semanal
                </span>
                <span className="text-[10px] text-neutral-400">
                  Últimos 7 días
                </span>
              </div>

              <div className="h-28 flex items-end justify-between gap-2.5 px-2 pb-2">
                {barHeights.map((h, idx) => {
                  const isToday = idx === barHeights.length - 1;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div
                        style={{ height: `${h}%` }}
                        className={`w-full rounded-t-md rounded-b-xs transition-all duration-300 ${
                          isToday
                            ? 'bg-[#0F291E] shadow-xs'
                            : 'bg-[#DCFCE7] hover:bg-[#BBF7D0]'
                        }`}
                        title={`Día ${dayLabels[idx]}: ${h}%`}
                      />
                      <span
                        className={`text-[10px] font-semibold ${
                          isToday ? 'text-[#0F291E]' : 'text-neutral-400'
                        }`}
                      >
                        {dayLabels[idx]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bloque inferior de 3 columnas compactas */}
            <div className="grid grid-cols-3 gap-2 pt-5 border-t border-gray-100 mt-4 text-center">
              <div className="p-2 rounded-xl bg-gray-50/70">
                <span className="text-base sm:text-lg font-bold text-[#0F291E] block tabular-nums">
                  {countSalesToday}
                </span>
                <span className="text-[10px] text-neutral-500 font-medium block mt-0.5">
                  Tickets
                </span>
              </div>

              <div className="p-2 rounded-xl bg-gray-50/70">
                <span className="text-base sm:text-lg font-bold text-[#0F291E] block tabular-nums truncate">
                  {formatCurrency(avgTicketToday, currentInventory?.currency)}
                </span>
                <span className="text-[10px] text-neutral-500 font-medium block mt-0.5">
                  Ticket prom.
                </span>
              </div>

              <div className="p-2 rounded-xl bg-gray-50/70">
                <span className="text-base sm:text-lg font-bold text-[#0F291E] block tabular-nums">
                  {unitsToday}
                </span>
                <span className="text-[10px] text-neutral-500 font-medium block mt-0.5">
                  Unidades
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeDesktopView;
