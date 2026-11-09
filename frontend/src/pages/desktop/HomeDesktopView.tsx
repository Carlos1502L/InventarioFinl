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
    <div className="space-y-6 pb-28 lg:pb-16 max-w-[1440px] mx-auto text-[#0a0a0a] font-sans">
      {/* 1. ENCABEZADO CLÍNICO MINIMALISTA (Geist Display) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div>
          <span className="text-[12px] uppercase tracking-[0.05em] text-[#737373] font-medium block mb-1">
            Métricas & Operaciones
          </span>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.04em] text-[#0a0a0a]">
            Resumen General
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onQuickScan}
            className="min-h-[36px] px-4 rounded-[18px] bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] text-xs font-medium flex items-center gap-2 transition-colors active:scale-95 cursor-pointer"
            title="Escanear código"
          >
            <Camera className="w-4 h-4 stroke-[1.8]" />
            <span>Escanear</span>
          </button>
          <button
            onClick={onOpenCreateModal}
            className="min-h-[36px] px-4 rounded-[18px] bg-[#0a0a0a] hover:bg-[#171717] text-[#fafafa] text-xs font-medium flex items-center gap-2 transition-colors active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            <span>Nuevo producto</span>
          </button>
        </div>
      </div>

      {/* 2. MATRIZ DE 4 STAT BLOCKS / CARDS (RADIUS 24px) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: SKUs */}
        <div className="p-5 bg-white border border-[#e5e5e5] rounded-3xl shadow-ui-card flex flex-col justify-between">
          <span className="text-[12px] uppercase tracking-[0.05em] text-[#737373] font-medium">
            Total Referencias
          </span>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-semibold tabular-nums text-[#0a0a0a] block tracking-[-0.04em]">
              {metrics.totalSkus.toLocaleString()}
            </span>
            <span className="text-xs text-[#737373] block mt-1">
              SKUs activos indexados
            </span>
          </div>
        </div>

        {/* Card 2: Unidades disponibles */}
        <div className="p-5 bg-white border border-[#e5e5e5] rounded-3xl shadow-ui-card flex flex-col justify-between">
          <span className="text-[12px] uppercase tracking-[0.05em] text-[#737373] font-medium">
            Existencias Físicas
          </span>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-semibold tabular-nums text-[#0a0a0a] block tracking-[-0.04em]">
              {formatCleanDecimal(metrics.totalUnits, 2)} <span className="text-sm font-normal text-[#737373]">unid</span>
            </span>
            <span className="text-xs text-[#737373] block mt-1">
              Unidades en depósito
            </span>
          </div>
        </div>

        {/* Card 3: Stock bajo alerta (Ember status dot) */}
        <div className="p-5 bg-white border border-[#e5e5e5] rounded-3xl shadow-ui-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12px] uppercase tracking-[0.05em] text-[#737373] font-medium">
              Alerta de Stock
            </span>
            {metrics.lowStockCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[18px] bg-[#f5f5f5] border border-[#e5e5e5] text-[11px] font-medium text-[#0a0a0a]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e7000b] animate-pulse" />
                Atención
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[18px] bg-[#f5f5f5] text-[11px] font-medium text-[#737373]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Saludable
              </span>
            )}
          </div>
          <div className="mt-3">
            <span className={`text-3xl sm:text-4xl font-semibold tabular-nums block tracking-[-0.04em] ${metrics.lowStockCount > 0 ? 'text-[#0a0a0a]' : 'text-[#0a0a0a]'}`}>
              {metrics.lowStockCount} <span className="text-sm font-normal text-[#737373]">{metrics.lowStockCount === 1 ? 'ítem' : 'ítems'}</span>
            </span>
            <span className="text-xs text-[#737373] block mt-1">
              {metrics.lowStockCount > 0 ? 'Por debajo del mínimo' : 'Existencias estables'}
            </span>
          </div>
        </div>

        {/* Card 4: Valuación */}
        <div className="p-5 bg-white border border-[#e5e5e5] rounded-3xl shadow-ui-card flex flex-col justify-between">
          <span className="text-[12px] uppercase tracking-[0.05em] text-[#737373] font-medium">
            Valuación Estimada
          </span>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-semibold tabular-nums text-[#0a0a0a] block tracking-[-0.03em] truncate">
              {formatCurrency(metrics.totalValue, currentInventory?.currency)}
            </span>
            <span className="text-xs text-[#737373] block mt-1">
              Valor en libros activo
            </span>
          </div>
        </div>
      </div>

      {/* 3. ACCESOS DIRECTOS MODULARES (24px radius) */}
      <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={onNavigateToStock}
          className="p-5 bg-white border border-[#e5e5e5] hover:border-[#0a0a0a] rounded-3xl flex items-center justify-between text-left transition-colors group shadow-ui-card cursor-pointer"
        >
          <div>
            <span className="text-xs text-[#737373] font-medium block">
              Catálogo &amp; Existencias
            </span>
            <span className="text-sm font-medium text-[#0a0a0a] block mt-0.5 group-hover:underline">
              Explorar inventario completo
            </span>
          </div>
          <div className="w-8 h-8 rounded-[18px] bg-[#f5f5f5] group-hover:bg-[#0a0a0a] group-hover:text-[#fafafa] text-[#0a0a0a] flex items-center justify-center transition-colors">
            <ArrowUpRight className="w-4 h-4 stroke-[1.8]" />
          </div>
        </button>

        {isBusiness && onNavigateToSales && (
          <button
            onClick={onNavigateToSales}
            className="p-5 bg-white border border-[#e5e5e5] hover:border-[#0a0a0a] rounded-3xl flex items-center justify-between text-left transition-colors group shadow-ui-card cursor-pointer"
          >
            <div>
              <span className="text-xs text-[#737373] font-medium block">
                Terminal de Cobro
              </span>
              <span className="text-sm font-medium text-[#0a0a0a] block mt-0.5 group-hover:underline">
                Registrar nueva venta
              </span>
            </div>
            <div className="w-8 h-8 rounded-[18px] bg-[#f5f5f5] group-hover:bg-[#0a0a0a] group-hover:text-[#fafafa] text-[#0a0a0a] flex items-center justify-center transition-colors">
              <ShoppingCart className="w-4 h-4 stroke-[1.8]" />
            </div>
          </button>
        )}
      </div>

      {/* 4. ACTIVIDAD RECIENTE (TABLAS EN TARJETAS 24px) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bloque: Ventas recientes */}
        {isBusiness && (
          <div className="bg-white border border-[#e5e5e5] rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-ui-card">
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-[#e5e5e5]">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#0a0a0a] stroke-[1.8]" />
                  <h3 className="text-sm font-medium text-[#0a0a0a]">
                    Últimas transacciones
                  </h3>
                </div>
                <button
                  onClick={onNavigateToHistory}
                  className="text-xs text-[#737373] hover:text-[#0a0a0a] font-medium transition-colors cursor-pointer"
                >
                  Ver todo &rarr;
                </button>
              </div>

              <div className="divide-y divide-[#e5e5e5] text-xs">
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
                  <div className="py-10 text-center text-[#737373] text-xs">
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
                        className="py-3 hover:bg-[#fafafa] px-2 rounded-[10px] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1 group"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-xs text-[#0a0a0a] font-medium block truncate group-hover:underline">
                            <span className="text-[#737373] font-normal">{receiptCode} · </span>
                            {summaryText}
                          </span>
                          <span className="text-[11px] text-[#737373] block mt-0.5">
                            {formatDate(sale.created_at)} · {sale.payment_method?.toLowerCase()}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs font-semibold tabular-nums text-[#0a0a0a] block">
                            {formatCurrency(sale.total_amount, currentInventory?.currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#e5e5e5] mt-3">
              <button
                onClick={onNavigateToHistory}
                className="w-full min-h-[36px] px-4 rounded-[18px] bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Ir al historial de transacciones</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Bloque: Catálogo reciente */}
        <div
          className={`bg-white border border-[#e5e5e5] rounded-3xl p-5 sm:p-6 flex-col justify-between shadow-ui-card ${
            isBusiness ? 'hidden lg:flex' : 'flex lg:col-span-2'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-[#e5e5e5]">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#0a0a0a] stroke-[1.8]" />
                <h3 className="text-sm font-medium text-[#0a0a0a]">
                  Últimos ítems añadidos
                </h3>
              </div>
              <button
                onClick={onNavigateToStock}
                className="text-xs text-[#737373] hover:text-[#0a0a0a] font-medium transition-colors cursor-pointer"
              >
                Ver catálogo &rarr;
              </button>
            </div>

            <div className="divide-y divide-[#e5e5e5] text-xs">
              {recentProducts.length === 0 ? (
                <div className="py-10 text-center text-[#737373] text-xs">
                  Sin registros en catálogo
                </div>
              ) : (
                recentProducts.map((prod) => {
                  return (
                    <div
                      key={prod.id}
                      onClick={() => onSelectProduct(prod)}
                      className="py-3 hover:bg-[#fafafa] px-2 rounded-[10px] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1 group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs text-[#0a0a0a] font-medium block truncate group-hover:underline">
                          <span className="text-[#737373] font-normal">{prod.code} · </span>
                          {prod.name}
                        </span>
                        <span className="text-[11px] text-[#737373] block mt-0.5">
                          {formatDate(prod.created_at)} · {prod.categories?.name || 'General'}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1">
                        <span className="text-xs font-semibold tabular-nums text-[#0a0a0a]">
                          +{formatStockDisplay(prod)}
                        </span>
                        <span className="text-[11px] text-[#737373] tabular-nums">
                          {formatCurrency(prod.price, currentInventory?.currency)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[#e5e5e5] mt-3">
            <button
              onClick={onNavigateToStock}
              className="w-full min-h-[36px] px-4 rounded-[18px] bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
