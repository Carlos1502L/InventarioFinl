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
    <div className="space-y-6 pb-28 lg:pb-16 max-w-[1440px] mx-auto text-slate-900 font-sans">
      {/* 1. ENCABEZADO DE OPERACIONES (Sin eyebrow kicker, jerarquía limpia) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-slate-900">
            Resumen general
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Estado operativo del depósito, salud de stock y actividad reciente.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onQuickScan}
            className="min-h-[38px] px-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 text-xs font-medium flex items-center gap-2 transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] cursor-pointer"
            title="Escanear código"
          >
            <Camera className="w-4 h-4 stroke-[1.8]" />
            <span>Escanear</span>
          </button>

          <button
            onClick={onOpenCreateModal}
            className="min-h-[38px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center gap-2 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            <span>Nuevo producto</span>
          </button>
        </div>
      </div>

      {/* 2. MATRIZ DE 4 KPI CARDS (Industrial Slate, tabular-nums) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: SKUs */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-ui-card desktop-hover-lift flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Total referencias
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
              SKU
            </span>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-semibold tabular-nums text-slate-900 block tracking-[-0.03em]">
              {metrics.totalSkus.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 block mt-1">
              Artículos activos indexados
            </span>
          </div>
        </div>

        {/* Card 2: Unidades disponibles */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-ui-card desktop-hover-lift flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Existencias físicas
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
              QTY
            </span>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-semibold tabular-nums text-slate-900 block tracking-[-0.03em]">
              {formatCleanDecimal(metrics.totalUnits, 2)}{' '}
              <span className="text-sm font-normal text-slate-500">und</span>
            </span>
            <span className="text-xs text-slate-500 block mt-1">
              Unidades contabilizadas en piso
            </span>
          </div>
        </div>

        {/* Card 3: Stock bajo alerta */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-ui-card desktop-hover-lift flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Salud de inventario
            </span>
            {metrics.lowStockCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-[11px] font-medium text-red-700">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                Atención
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Estable
              </span>
            )}
          </div>
          <div className="mt-3">
            <span className={`text-3xl font-semibold tabular-nums block tracking-[-0.03em] ${metrics.lowStockCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {metrics.lowStockCount}{' '}
              <span className="text-sm font-normal text-slate-500">
                {metrics.lowStockCount === 1 ? 'ítem' : 'ítems'}
              </span>
            </span>
            <span className="text-xs text-slate-500 block mt-1">
              {metrics.lowStockCount > 0 ? 'Por debajo del mínimo requerido' : 'Sin quiebres ni reposición urgente'}
            </span>
          </div>
        </div>

        {/* Card 4: Valuación */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-ui-card desktop-hover-lift flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Valuación estimada
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
              {currentInventory?.currency || 'PEN'}
            </span>
          </div>
          <div className="mt-3 min-w-0">
            <span
              title={formatCurrency(metrics.totalValue, currentInventory?.currency)}
              className="text-2xl sm:text-[28px] font-semibold tabular-nums text-slate-900 block tracking-[-0.03em] truncate"
            >
              {formatCurrency(metrics.totalValue, currentInventory?.currency)}
            </span>
            <span className="text-xs text-slate-500 block mt-1">
              Valorizado a precio catálogo activo
            </span>
          </div>
        </div>
      </div>

      {/* 3. ACCESOS DIRECTOS OPERATIVOS */}
      <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={onNavigateToStock}
          className="p-4 sm:p-5 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl flex items-center justify-between text-left transition-[transform,border-color,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99] desktop-hover-lift group shadow-ui-card cursor-pointer"
        >
          <div className="min-w-0 pr-3">
            <span className="text-xs text-slate-500 font-medium block">
              Catálogo y existencias
            </span>
            <span className="text-sm font-semibold text-slate-900 block mt-0.5 truncate">
              Explorar inventario completo
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-700 flex items-center justify-center transition-colors duration-150 shrink-0">
            <ArrowUpRight className="w-4 h-4 stroke-[1.8]" />
          </div>
        </button>

        {isBusiness && onNavigateToSales && (
          <button
            onClick={onNavigateToSales}
            className="p-4 sm:p-5 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl flex items-center justify-between text-left transition-[transform,border-color,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99] desktop-hover-lift group shadow-ui-card cursor-pointer"
          >
            <div className="min-w-0 pr-3">
              <span className="text-xs text-slate-500 font-medium block">
                Terminal de cobro
              </span>
              <span className="text-sm font-semibold text-slate-900 block mt-0.5 truncate">
                Abrir punto de venta
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-700 flex items-center justify-center transition-colors duration-150 shrink-0">
              <ShoppingCart className="w-4 h-4 stroke-[1.8]" />
            </div>
          </button>
        )}
      </div>

      {/* 4. ACTIVIDAD RECIENTE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bloque: Ventas recientes */}
        {isBusiness && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-ui-card">
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-700 stroke-[1.8]" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Últimas transacciones
                  </h3>
                </div>
                <button
                  onClick={onNavigateToHistory}
                  className="text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors duration-150 cursor-pointer"
                >
                  Ver todo &rarr;
                </button>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
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
                  <div className="py-10 text-center text-slate-400 text-xs">
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
                        className="py-2.5 hover:bg-slate-50 px-2.5 -mx-1 rounded-lg transition-colors duration-150 cursor-pointer flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0 flex-1">
                          <span title={summaryText} className="text-xs text-slate-900 font-medium block truncate group-hover:text-slate-700">
                            <span className="font-mono text-[11px] text-slate-500 font-normal mr-1.5">{receiptCode}</span>
                            {summaryText}
                          </span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {formatDate(sale.created_at)} · <span className="capitalize">{sale.payment_method?.toLowerCase()}</span>
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs font-semibold tabular-nums text-slate-900 block">
                            {formatCurrency(sale.total_amount, currentInventory?.currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-3.5 border-t border-slate-100 mt-3">
              <button
                onClick={onNavigateToHistory}
                className="w-full min-h-[36px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-900 text-xs font-medium flex items-center justify-center gap-1.5 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer"
              >
                <span>Ir al historial de transacciones</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Bloque: Catálogo reciente */}
        <div
          className={`bg-white border border-slate-200 rounded-2xl p-5 flex-col justify-between shadow-ui-card ${
            isBusiness ? 'hidden lg:flex' : 'flex lg:col-span-2'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-700 stroke-[1.8]" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Últimos ítems añadidos
                </h3>
              </div>
              <button
                onClick={onNavigateToStock}
                className="text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors duration-150 cursor-pointer"
              >
                Ver catálogo &rarr;
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {recentProducts.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  Sin registros en catálogo
                </div>
              ) : (
                recentProducts.map((prod) => {
                  return (
                    <div
                      key={prod.id}
                      onClick={() => onSelectProduct(prod)}
                      className="py-2.5 hover:bg-slate-50 px-2.5 -mx-1 rounded-lg transition-colors duration-150 cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <span title={prod.name} className="text-xs text-slate-900 font-medium block truncate group-hover:text-slate-700">
                          <span className="font-mono text-[11px] text-slate-500 font-normal mr-1.5">{prod.code}</span>
                          {prod.name}
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5 truncate">
                          {formatDate(prod.created_at)} · {prod.categories?.name || 'General'}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end justify-center gap-0.5">
                        <span className="text-xs font-semibold tabular-nums text-emerald-700">
                          +{formatStockDisplay(prod)}
                        </span>
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          {formatCurrency(prod.price, currentInventory?.currency)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3.5 border-t border-slate-100 mt-3">
            <button
              onClick={onNavigateToStock}
              className="w-full min-h-[36px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-900 text-xs font-medium flex items-center justify-center gap-1.5 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer"
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
