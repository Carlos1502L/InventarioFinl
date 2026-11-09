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
    <div className="space-y-7 pb-28 lg:pb-16 max-w-[1440px] mx-auto text-[#17191c]">
      {/* 1. ENCABEZADO EDITORIAL */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
        <div>
          <span className="text-xs uppercase tracking-wider text-[#777b86] font-medium block mb-1.5">
            Visión global del depósito
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-normal text-[#17191c] tracking-tight">
            Resumen &amp; <span className="italic font-serif">operaciones</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onQuickScan}
            className="min-h-[42px] px-5 rounded-full bg-[#f2f2f3] hover:bg-[#e8e8ea] text-[#17191c] text-xs font-medium flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            title="Escanear código"
          >
            <Camera className="w-4 h-4 stroke-[1.8]" />
            <span>Escanear</span>
          </button>
          <button
            onClick={onOpenCreateModal}
            className="min-h-[42px] px-6 rounded-full bg-[#17191c] hover:bg-black text-white text-xs font-medium flex items-center gap-2 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            <span>Nuevo producto</span>
          </button>
        </div>
      </div>

      {/* 2. MATRIZ DE 4 TARJETAS INDEPENDIENTES (RADIUS 24px) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: SKUs */}
        <div className="p-6 bg-white border border-[#ececec] rounded-3xl shadow-steep-subtle flex flex-col justify-between">
          <span className="text-xs text-[#777b86] font-medium tracking-tight">Total referencias</span>
          <div className="mt-4">
            <span className="text-3xl sm:text-4xl font-normal tabular-nums text-[#17191c] block tracking-tight">
              {metrics.totalSkus.toLocaleString()}
            </span>
            <span className="text-xs text-[#979799] block mt-1">SKUs activos en catálogo</span>
          </div>
        </div>

        {/* Card 2: Unidades disponibles */}
        <div className="p-6 bg-white border border-[#ececec] rounded-3xl shadow-steep-subtle flex flex-col justify-between">
          <span className="text-xs text-[#777b86] font-medium tracking-tight">Existencias totales</span>
          <div className="mt-4">
            <span className="text-3xl sm:text-4xl font-normal tabular-nums text-[#17191c] block tracking-tight">
              {formatCleanDecimal(metrics.totalUnits, 2)} <span className="text-sm font-normal text-[#777b86]">unid</span>
            </span>
            <span className="text-xs text-[#979799] block mt-1">Unidades físicas en depósito</span>
          </div>
        </div>

        {/* Card 3: Stock bajo (Blush Peach si > 0) */}
        {metrics.lowStockCount > 0 ? (
          <div className="p-6 bg-[#fbe1d1] border border-[#f5c7ae] rounded-3xl shadow-steep-subtle flex flex-col justify-between text-[#5d2a1a]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#5d2a1a]/80 font-medium tracking-tight">Stock bajo alerta</span>
              <span className="w-2 h-2 rounded-full bg-[#5d2a1a] animate-pulse" />
            </div>
            <div className="mt-4">
              <span className="text-3xl sm:text-4xl font-normal tabular-nums text-[#5d2a1a] block tracking-tight">
                {metrics.lowStockCount} <span className="text-sm font-normal text-[#5d2a1a]/80">{metrics.lowStockCount === 1 ? 'ítem' : 'ítems'}</span>
              </span>
              <span className="text-xs text-[#5d2a1a]/80 block mt-1">Requieren reabastecimiento</span>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-white border border-[#ececec] rounded-3xl shadow-steep-subtle flex flex-col justify-between">
            <span className="text-xs text-[#777b86] font-medium tracking-tight">Estado de existencias</span>
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-2xl font-normal text-[#17191c] tracking-tight">Saludable</span>
              </div>
              <span className="text-xs text-[#979799] block mt-1">Sin alertas de inventario</span>
            </div>
          </div>
        )}

        {/* Card 4: Valuación */}
        <div className="p-6 bg-white border border-[#ececec] rounded-3xl shadow-steep-subtle flex flex-col justify-between">
          <span className="text-xs text-[#777b86] font-medium tracking-tight">Valuación estimada</span>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-normal tabular-nums text-[#17191c] block tracking-tight truncate">
              {formatCurrency(metrics.totalValue, currentInventory?.currency)}
            </span>
            <span className="text-xs text-[#979799] block mt-1">Valor activo en almacén</span>
          </div>
        </div>
      </div>

      {/* 3. ACCESOS DIRECTOS MODULARES */}
      <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 gap-5">
        <button
          onClick={onNavigateToStock}
          className="p-6 bg-white border border-[#ececec] hover:border-[#17191c] rounded-3xl flex items-center justify-between text-left transition-all group shadow-steep-subtle cursor-pointer"
        >
          <div>
            <span className="text-xs text-[#777b86] font-medium block">
              Catálogo &amp; Existencias
            </span>
            <span className="text-base font-medium text-[#17191c] block mt-1 group-hover:underline">
              Explorar inventario completo
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#f2f2f3] group-hover:bg-[#17191c] group-hover:text-white text-[#17191c] flex items-center justify-center transition-colors">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </button>

        {isBusiness && onNavigateToSales && (
          <button
            onClick={onNavigateToSales}
            className="p-6 bg-white border border-[#ececec] hover:border-[#17191c] rounded-3xl flex items-center justify-between text-left transition-all group shadow-steep-subtle cursor-pointer"
          >
            <div>
              <span className="text-xs text-[#777b86] font-medium block">
                Terminal de cobro
              </span>
              <span className="text-base font-medium text-[#17191c] block mt-1 group-hover:underline">
                Registrar nueva venta
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#f2f2f3] group-hover:bg-[#17191c] group-hover:text-white text-[#17191c] flex items-center justify-center transition-colors">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </button>
        )}
      </div>

      {/* 4. ACTIVIDAD RECIENTE (TABLAS MODULARES EN TARJETAS 24px) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bloque: Ventas recientes */}
        {isBusiness && (
          <div className="bg-white border border-[#ececec] rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-steep-subtle">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#ececec]">
                <div className="flex items-center gap-2.5">
                  <Receipt className="w-4 h-4 text-[#17191c]" />
                  <h3 className="text-sm font-semibold text-[#17191c]">
                    Últimas transacciones
                  </h3>
                </div>
                <button
                  onClick={onNavigateToHistory}
                  className="text-xs text-[#777b86] hover:text-[#17191c] font-medium transition-colors cursor-pointer"
                >
                  Ver todo &rarr;
                </button>
              </div>

              <div className="divide-y divide-[#f2f2f3] text-xs">
                {loadingSales ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center justify-between py-2.5">
                        <div className="space-y-1.5">
                          <Skeleton className="w-36 h-4" />
                          <Skeleton className="w-24 h-3" />
                        </div>
                        <Skeleton className="w-16 h-5" />
                      </div>
                    ))}
                  </div>
                ) : recentSales.length === 0 ? (
                  <div className="py-10 text-center text-[#777b86] text-xs">
                    Sin registros de ventas recientes
                  </div>
                ) : (
                  recentSales.map((sale) => {
                    const firstItem = sale.items?.[0]?.product_name || 'Mercancía';
                    const summaryText = sale.items && sale.items.length > 1
                      ? `${sale.items[0].quantity}x ${firstItem} (+${sale.items.length - 1} más)`
                      : `${sale.items?.[0]?.quantity || 1}x ${firstItem}`;

                    const receiptCode = `TRX-${sale.id.slice(0, 8).toUpperCase()}`;

                    return (
                      <div
                        key={sale.id}
                        onClick={onNavigateToHistory}
                        className="py-3.5 hover:bg-[#fafafb] px-2 rounded-xl transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1 group"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-xs text-[#17191c] font-medium block truncate group-hover:underline">
                            <span className="text-[#777b86] font-normal">{receiptCode} · </span>
                            {summaryText}
                          </span>
                          <span className="text-[11px] text-[#777b86] block mt-0.5">
                            {formatDate(sale.created_at)} · {sale.payment_method?.toLowerCase()}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-sm font-semibold tabular-nums text-[#17191c] block">
                            {formatCurrency(sale.total_amount, currentInventory?.currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-5 border-t border-[#ececec] mt-4">
              <button
                onClick={onNavigateToHistory}
                className="w-full min-h-[40px] px-4 rounded-full bg-[#f2f2f3] hover:bg-[#e8e8ea] text-[#17191c] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Ir al historial de transacciones</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Bloque: Catálogo reciente */}
        <div
          className={`bg-white border border-[#ececec] rounded-3xl p-6 sm:p-7 flex-col justify-between shadow-steep-subtle ${
            isBusiness ? 'hidden lg:flex' : 'flex lg:col-span-2'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#ececec]">
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4 text-[#17191c]" />
                <h3 className="text-sm font-semibold text-[#17191c]">
                  Últimos ítems añadidos
                </h3>
              </div>
              <button
                onClick={onNavigateToStock}
                className="text-xs text-[#777b86] hover:text-[#17191c] font-medium transition-colors cursor-pointer"
              >
                Ver catálogo &rarr;
              </button>
            </div>

            <div className="divide-y divide-[#f2f2f3] text-xs">
              {recentProducts.length === 0 ? (
                <div className="py-10 text-center text-[#777b86] text-xs">
                  Sin registros en catálogo
                </div>
              ) : (
                recentProducts.map((prod) => {
                  return (
                    <div
                      key={prod.id}
                      onClick={() => onSelectProduct(prod)}
                      className="py-3.5 hover:bg-[#fafafb] px-2 rounded-xl transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1 group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs text-[#17191c] font-medium block truncate group-hover:underline">
                          <span className="text-[#777b86] font-normal">{prod.code} · </span>
                          {prod.name}
                        </span>
                        <span className="text-[11px] text-[#777b86] block mt-0.5">
                          {formatDate(prod.created_at)} · {prod.categories?.name || 'General'}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5">
                        <span className="text-xs font-semibold tabular-nums text-[#17191c]">
                          +{formatStockDisplay(prod)}
                        </span>
                        <span className="text-[11px] text-[#777b86] tabular-nums">
                          {formatCurrency(prod.price, currentInventory?.currency)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-5 border-t border-[#ececec] mt-4">
            <button
              onClick={onNavigateToStock}
              className="w-full min-h-[40px] px-4 rounded-full bg-[#f2f2f3] hover:bg-[#e8e8ea] text-[#17191c] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Explorar catálogo completo</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeDesktopView;
