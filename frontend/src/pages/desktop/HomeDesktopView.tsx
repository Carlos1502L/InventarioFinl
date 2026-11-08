import { Skeleton } from '../../components/ui/Skeleton';
import React from 'react';
import {
  Camera,
  Plus,
  ArrowUpRight,
  ShoppingCart,
  Receipt,
  Package,
  ChevronRight
} from 'lucide-react';
import { Product, Sale, Inventory } from '../../types/database';
import { formatCurrency, formatDate, formatStockDisplay, formatCleanDecimal } from '../../lib/supabase';

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
  onSelectProduct,
  isBusiness,
  loadingSales,
  recentSales,
  recentProducts,
  currentInventory
}) => {
  return (
    <div className="space-y-6 pb-28 lg:pb-16 max-w-[1440px] mx-auto text-[#1E3A5F]">
      {/* 1. CABECERA & BLOQUE DE KPIS */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="border-b border-[#E5E7EB] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-[#1E3A5F] inline-block" />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#616161]">
                INVENTORY MANIFEST // SPECIFICATION SHEET
              </p>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E3A5F] uppercase">
              RESUMEN GENERAL & OPERACIONES
            </h1>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onQuickScan}
              className="min-h-[40px] px-4 rounded-full border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 stroke-[1.5] text-white" />
              <span>ESCANEAR</span>
            </button>
            <button
              onClick={onOpenCreateModal}
              className="min-h-[40px] px-5 rounded-full bg-[#1E3A5F] hover:bg-[#172E4C] text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-[0.98] shadow-sm"
            >
              <Plus className="w-4 h-4 stroke-[1.5]" />
              <span>NUEVO ÍTEM</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-0 border-t border-[#E5E7EB] sm:divide-x divide-[#E5E7EB] font-mono mt-4 pt-3 sm:pt-0">
          <div className="p-3 sm:p-5 bg-[#F8F9FA] sm:bg-transparent rounded-xl sm:rounded-none border sm:border-0 border-[#E5E7EB] flex flex-col justify-between">
            <span className="text-[9px] sm:text-[10px] text-[#616161] uppercase tracking-[0.12em] sm:tracking-[0.15em] block">
              TOTAL SKUS REGISTRADOS
            </span>
            <div className="mt-2 sm:mt-3">
              <span className="text-2xl sm:text-4xl font-bold tabular-nums text-[#1E3A5F] block tracking-tight">
                {metrics.totalSkus.toString().padStart(4, '0')}
              </span>
              <span className="text-[9px] sm:text-[10px] text-[#616161] uppercase tracking-wider block mt-1 font-sans">
                REFERENCIAS ACTIVAS
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-5 bg-[#F8F9FA] sm:bg-transparent rounded-xl sm:rounded-none border sm:border-0 border-[#E5E7EB] flex flex-col justify-between">
            <span className="text-[9px] sm:text-[10px] text-[#616161] uppercase tracking-[0.12em] sm:tracking-[0.15em] block">
              UNIDADES DISPONIBLES
            </span>
            <div className="mt-2 sm:mt-3">
              <span className="text-2xl sm:text-4xl font-bold tabular-nums text-[#1E3A5F] block tracking-tight">
                {formatCleanDecimal(metrics.totalUnits, 2)} <span className="text-xs sm:text-base text-[#616161] font-normal">STOCK</span>
              </span>
              <span className="text-[9px] sm:text-[10px] text-[#616161] uppercase tracking-wider block mt-1 font-sans">
                EXISTENCIAS FÍSICAS
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-5 bg-[#F8F9FA] sm:bg-transparent rounded-xl sm:rounded-none border sm:border-0 border-[#E5E7EB] flex flex-col justify-between">
            <span className="text-[9px] sm:text-[10px] text-[#616161] uppercase tracking-[0.12em] sm:tracking-[0.15em] block">
              STOCK BAJO / ALERTA
            </span>
            <div className="mt-2 sm:mt-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-mono font-bold tracking-wider ${
                  metrics.lowStockCount > 0
                    ? 'bg-[#E8B4A0] text-[#1E3A5F] border border-[#1E3A5F]/15'
                    : 'border border-[#E5E7EB] text-[#1E3A5F]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${
                    metrics.lowStockCount > 0 ? 'bg-[#1E3A5F] animate-pulse' : 'bg-[#E5E7EB]'
                  }`} />
                  {metrics.lowStockCount} {metrics.lowStockCount === 1 ? 'ÍTEM' : 'ÍTEMS'}
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-[#616161] uppercase tracking-wider block mt-2 font-sans">
                POR REABASTECER
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-5 bg-[#F8F9FA] sm:bg-transparent rounded-xl sm:rounded-none border sm:border-0 border-[#E5E7EB] flex flex-col justify-between">
            <span className="text-[9px] sm:text-[10px] text-[#616161] uppercase tracking-[0.12em] sm:tracking-[0.15em] block">
              VALUACIÓN DE STOCK
            </span>
            <div className="mt-2 sm:mt-3">
              <span className="text-xl sm:text-4xl font-bold tabular-nums text-[#1E3A5F] block tracking-tight truncate">
                {formatCurrency(metrics.totalValue, currentInventory?.currency)}
              </span>
              <span className="text-[9px] sm:text-[10px] text-[#616161] uppercase tracking-wider block mt-1 font-sans">
                VALOR EN DEPÓSITO
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ACCESOS DIRECTOS */}
      <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
        <button
          onClick={onNavigateToStock}
          className="p-5 border border-[#E5E7EB] hover:border-[#1E3A5F] bg-white rounded-2xl flex items-center justify-between text-left transition-all group shadow-sm"
        >
          <div>
            <span className="text-[10px] text-[#E8B4A0] uppercase tracking-[0.15em] block font-semibold">
              MÓDULO DE STOCK
            </span>
            <span className="text-sm font-bold uppercase tracking-wide text-[#1E3A5F] block mt-0.5 group-hover:underline">
              VER CATÁLOGO COMPLETO // STOCK
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#F8F9FA] border border-[#E5E7EB] group-hover:bg-[#1E3A5F] group-hover:text-white flex items-center justify-center transition-colors">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </button>

        {isBusiness && onNavigateToSales && (
          <button
            onClick={onNavigateToSales}
            className="p-5 border border-[#E5E7EB] hover:border-[#1E3A5F] bg-white rounded-2xl flex items-center justify-between text-left transition-all group shadow-sm"
          >
            <div>
              <span className="text-[10px] text-[#E8B4A0] uppercase tracking-[0.15em] block font-semibold">
                TERMINAL DE COBRO
              </span>
              <span className="text-sm font-bold uppercase tracking-wide text-[#1E3A5F] block mt-0.5 group-hover:underline">
                NUEVA VENTA // REGISTRO RÁPIDO
              </span>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#F8F9FA] border border-[#E5E7EB] group-hover:bg-[#1E3A5F] group-hover:text-white flex items-center justify-center transition-colors">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </button>
        )}
      </div>

      {/* 3. ACTIVIDAD RECIENTE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isBusiness && (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB] font-mono">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#1E3A5F]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F]">
                    ÚLTIMAS VENTAS / SALIDAS
                  </h3>
                </div>
                <button
                  onClick={onNavigateToHistory}
                  className="text-[10px] uppercase tracking-wider text-[#616161] hover:text-[#1E3A5F] transition-colors"
                >
                  VER TODO &gt;
                </button>
              </div>

              <div className="divide-y divide-[#E5E7EB] font-mono text-xs">
                {loadingSales ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center justify-between py-2">
                        <div className="space-y-1.5">
                          <Skeleton className="w-36 h-4" />
                          <Skeleton className="w-24 h-3" />
                        </div>
                        <Skeleton className="w-16 h-5" />
                      </div>
                    ))}
                  </div>
                ) : recentSales.length === 0 ? (
                  <div className="py-8 text-center text-[#616161] uppercase text-xs">
                    SIN REGISTROS DE VENTAS RECIENTES
                  </div>
                ) : (
                  recentSales.map((sale) => {
                    const firstItem = sale.items?.[0]?.product_name || 'MERCANCÍA';
                    const summaryText = sale.items && sale.items.length > 1
                      ? `${sale.items[0].quantity}X ${firstItem} (+${sale.items.length - 1} MÁS)`
                      : `${sale.items?.[0]?.quantity || 1}X ${firstItem}`;

                    const receiptCode = `TRX-${sale.id.slice(0, 8).toUpperCase()}`;

                    return (
                      <div
                        key={sale.id}
                        onClick={onNavigateToHistory}
                        className="py-3 hover:bg-[#F8F9FA] px-1 rounded-lg transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1 group"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[11px] text-[#1E3A5F] uppercase tracking-wider block truncate group-hover:underline">
                            <span className="font-mono text-[#616161]">{receiptCode} //</span> <span className="font-bold text-[#1E3A5F]">{summaryText.toUpperCase()}</span>
                          </span>
                          <span className="text-[10px] text-[#616161] uppercase tracking-widest block mt-0.5">
                            {formatDate(sale.created_at)} // MÉTODO: {sale.payment_method?.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs sm:text-sm font-bold tabular-nums text-[#1E3A5F] block tracking-tight">
                            {formatCurrency(sale.total_amount, currentInventory?.currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E7EB] mt-3">
              <button
                onClick={onNavigateToHistory}
                className="w-full min-h-[38px] px-4 rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] text-[#1E3A5F] text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors bg-white"
              >
                <span>IR AL HISTORIAL DE TRANSACCIONES</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div
          className={`bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 flex-col justify-between shadow-sm ${
            isBusiness ? 'hidden lg:flex' : 'flex lg:col-span-2'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB] font-mono">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#1E3A5F]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F]">
                  ÚLTIMOS ÍTEMS AÑADIDOS
                </h3>
              </div>
              <button
                onClick={onNavigateToStock}
                className="text-[10px] uppercase tracking-wider text-[#616161] hover:text-[#1E3A5F] transition-colors"
              >
                VER CATÁLOGO &gt;
              </button>
            </div>

            <div className="divide-y divide-[#E5E7EB] font-mono text-xs">
              {recentProducts.length === 0 ? (
                <div className="py-8 text-center text-[#616161] uppercase text-xs">
                  SIN REGISTROS EN CATÁLOGO
                </div>
              ) : (
                recentProducts.map((prod) => {
                  return (
                    <div
                      key={prod.id}
                      onClick={() => onSelectProduct(prod)}
                      className="py-3 hover:bg-[#F8F9FA] px-1 rounded-lg transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1 group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[11px] text-[#1E3A5F] uppercase tracking-wider block truncate group-hover:underline">
                          <span className="font-mono text-[#616161]">REF-{prod.code} //</span> <span className="font-bold text-[#1E3A5F]">{prod.name.toUpperCase()}</span>
                        </span>
                        <span className="text-[10px] text-[#616161] uppercase tracking-widest block mt-0.5">
                          {formatDate(prod.created_at)} // CAT: {prod.categories?.name?.toUpperCase() || 'GENERAL'}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                        <span className="text-xs font-bold tabular-nums text-[#1E3A5F]">
                          +{formatStockDisplay(prod)}
                        </span>
                        <span className="text-[10px] text-[#616161] tabular-nums font-semibold">
                          {formatCurrency(prod.price, currentInventory?.currency)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] mt-3">
            <button
              onClick={onNavigateToStock}
              className="w-full min-h-[38px] px-4 rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] text-[#1E3A5F] text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors bg-white"
            >
              <span>EXPLORAR CATÁLOGO COMPLETO</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeDesktopView;
