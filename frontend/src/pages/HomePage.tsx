import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  ArrowUpRight,
  Plus,
  Camera,
  ShoppingCart,
  Receipt,
  RotateCcw,
  Clock,
  ChevronRight
} from 'lucide-react';
import { Product, Sale } from '../types/database';
import { supabase, formatCurrency, formatDate } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface HomePageProps {
  products: Product[];
  onNavigateToStock: () => void;
  onNavigateToSales?: () => void;
  onNavigateToHistory: () => void;
  onSelectProduct: (product: Product) => void;
  onQuickScan: () => void;
  onOpenCreateModal: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  products,
  onNavigateToStock,
  onNavigateToSales,
  onNavigateToHistory,
  onSelectProduct,
  onQuickScan,
  onOpenCreateModal
}) => {
  const { currentInventory } = useAuth();
  const isBusiness = currentInventory?.inventory_type !== 'PERSONAL';
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // Cargar últimas ventas registradas
  useEffect(() => {
    if (!currentInventory) return;
    setLoadingSales(true);
    supabase
      .from('sales')
      .select(`
        *,
        items:sale_items(*)
      `)
      .eq('inventory_id', currentInventory.id)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (!error && data) {
          setRecentSales(data);
        }
        setLoadingSales(false);
      });
  }, [currentInventory]);

  // KPIs Técnicos
  const metrics = useMemo(() => {
    const totalSkus = products.length;
    const totalUnits = products.reduce((acc, p) => acc + (p.stock || 0), 0);
    const lowStockCount = products.filter(
      p => p.status === 'ACTIVE' && p.stock <= (p.min_stock || 1)
    ).length;
    const totalValue = products.reduce(
      (acc, p) => acc + ((p.price || 0) * (p.stock || 0)),
      0
    );

    return { totalSkus, totalUnits, lowStockCount, totalValue };
  }, [products]);

  // Últimos ítems añadidos ordenados por fecha
  const recentProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6);
  }, [products]);

  return (
    <div className="space-y-6 pb-28 sm:pb-16 max-w-[1440px] mx-auto font-normal text-black selection:bg-black selection:text-white">
      
      {/* =========================================================
          1. CABECERA & KPIS (MANIFIESTO TÉCNICO FREITAG)
         ========================================================= */}
      <div className="border border-[#cacaca] bg-white p-4 sm:p-6 transition-all">
        {/* Eyebrow y Título Principal */}
        <div className="border-b border-[#cacaca] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-black inline-block" />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#616161]">
                INVENTORY MANIFEST // SPECIFICATION SHEET
              </p>
            </div>
            <h1 className="text-xl sm:text-2xl font-normal uppercase tracking-tight text-black">
              RESUMEN GENERAL & OPERACIONES
            </h1>
          </div>

          {/* Accesos rápidos de acción en píldora */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onQuickScan}
              className="min-h-[40px] px-4 rounded-full border border-[#cacaca] hover:border-black text-black text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <Camera className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>ESCANEAR</span>
            </button>
            <button
              onClick={onOpenCreateModal}
              className="min-h-[40px] px-5 rounded-full bg-black hover:bg-[#1a1b1e] text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 stroke-[1.5]" />
              <span>NUEVO ÍTEM</span>
            </button>
          </div>
        </div>

        {/* Retícula de KPIs 2x2 delimitada por líneas de 1px en #cacaca */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 border-t border-[#cacaca] divide-y sm:divide-y-0 sm:divide-x divide-[#cacaca] font-mono mt-4">
          
          {/* KPI 1: TOTAL SKUS REGISTRADOS */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-[10px] text-[#616161] uppercase tracking-[0.15em] block">
              TOTAL SKUS REGISTRADOS
            </span>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-normal tabular-nums text-black block tracking-tight">
                {metrics.totalSkus.toString().padStart(4, '0')}
              </span>
              <span className="text-[10px] text-[#616161] uppercase tracking-wider block mt-0.5">
                REFERENCIAS EN SISTEMA
              </span>
            </div>
          </div>

          {/* KPI 2: UNIDADES DISPONIBLES */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-[10px] text-[#616161] uppercase tracking-[0.15em] block">
              UNIDADES DISPONIBLES
            </span>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-normal tabular-nums text-black block tracking-tight">
                {metrics.totalUnits.toLocaleString('es-PE')} <span className="text-sm text-[#616161]">UDS</span>
              </span>
              <span className="text-[10px] text-[#616161] uppercase tracking-wider block mt-0.5">
                EXISTENCIAS FÍSICAS TOTALES
              </span>
            </div>
          </div>

          {/* KPI 3: STOCK BAJO / ALERTA (Con badge píldora en fondo #ffdd00) */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-[10px] text-[#616161] uppercase tracking-[0.15em] block">
              STOCK BAJO / ALERTA
            </span>
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-mono tracking-wider ${
                  metrics.lowStockCount > 0
                    ? 'bg-[#ffdd00] text-black border border-black'
                    : 'border border-[#cacaca] text-black'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-black mr-2 inline-block animate-pulse" />
                  {metrics.lowStockCount} {metrics.lowStockCount === 1 ? 'ÍTEM' : 'ÍTEMS'}
                </span>
              </div>
              <span className="text-[10px] text-[#616161] uppercase tracking-wider block mt-1.5">
                REQUIEREN REABASTECIMIENTO
              </span>
            </div>
          </div>

          {/* KPI 4: VALUACIÓN DE STOCK */}
          <div className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-[10px] text-[#616161] uppercase tracking-[0.15em] block">
              VALUACIÓN DE STOCK
            </span>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-normal tabular-nums text-black block tracking-tight">
                {formatCurrency(metrics.totalValue, currentInventory?.currency)}
              </span>
              <span className="text-[10px] text-[#616161] uppercase tracking-wider block mt-0.5">
                VALOR COMERCIAL EN DEPÓSITO
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================
          2. ACCESOS DIRECTOS // NAVEGACIÓN RÁPIDA A STOCK Y POS
         ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
        <button
          onClick={onNavigateToStock}
          className="p-4 border border-[#cacaca] hover:border-black bg-white hover:bg-[#fafafa] flex items-center justify-between text-left transition-all group"
        >
          <div>
            <span className="text-[10px] text-[#616161] uppercase tracking-[0.15em] block">
              MÓDULO DE CATÁLOGO
            </span>
            <span className="text-sm uppercase tracking-wide text-black block mt-0.5 group-hover:underline">
              VER CATÁLOGO COMPLETO // STOCK
            </span>
          </div>
          <div className="w-8 h-8 rounded-full border border-black flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </button>

        {isBusiness && onNavigateToSales && (
          <button
            onClick={onNavigateToSales}
            className="p-4 border border-[#cacaca] hover:border-black bg-white hover:bg-[#fafafa] flex items-center justify-between text-left transition-all group"
          >
            <div>
              <span className="text-[10px] text-[#616161] uppercase tracking-[0.15em] block">
                TERMINAL DE COBRO
              </span>
              <span className="text-sm uppercase tracking-wide text-black block mt-0.5 group-hover:underline">
                NUEVA VENTA // REGISTRO RÁPIDO
              </span>
            </div>
            <div className="w-8 h-8 rounded-full border border-black flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </button>
        )}
      </div>

      {/* =========================================================
          3. ACTIVIDAD RECIENTE (ESTILO MANIFIESTO DE TEXTO PURO)
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LISTA A: ÚLTIMAS VENTAS / SALIDAS */}
        <div className="border border-[#cacaca] bg-white p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#cacaca] font-mono">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-black" />
                <h3 className="text-xs uppercase tracking-wider text-black">
                  ÚLTIMAS VENTAS / SALIDAS
                </h3>
              </div>
              <button
                onClick={onNavigateToHistory}
                className="text-[10px] uppercase tracking-wider text-[#616161] hover:text-black transition-colors"
              >
                VER TODO &gt;
              </button>
            </div>

            {/* Manifiesto de filas en texto puro con bordes de 1px */}
            <div className="divide-y divide-[#cacaca] font-mono text-xs">
              {loadingSales ? (
                <div className="py-8 text-center text-[#616161] uppercase text-xs">
                  CARGANDO MANIFIESTO DE TRANSACCIONES...
                </div>
              ) : recentSales.length === 0 ? (
                <div className="py-8 text-center text-[#616161] uppercase text-xs">
                  SIN REGISTROS DE VENTAS RECIENTES
                </div>
              ) : (
                recentSales.map((sale) => {
                  const itemsCount = sale.items?.reduce((acc, it) => acc + it.quantity, 0) || 0;
                  const firstItem = sale.items?.[0]?.product_name || 'MERCANCÍA';
                  const summaryText = sale.items && sale.items.length > 1
                    ? `${sale.items[0].quantity}X ${firstItem} (+${sale.items.length - 1} MÁS)`
                    : `${sale.items?.[0]?.quantity || 1}X ${firstItem}`;

                  const receiptCode = `TRX-${sale.id.slice(0, 8).toUpperCase()}`;

                  return (
                    <div
                      key={sale.id}
                      onClick={onNavigateToHistory}
                      className="py-3 hover:bg-[#fafafa] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1 group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[11px] text-black uppercase tracking-wider block truncate group-hover:underline">
                          {receiptCode} // {summaryText.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-[#616161] uppercase tracking-widest block mt-0.5">
                          {formatDate(sale.created_at)} // MÉTODO: {sale.payment_method?.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs sm:text-sm font-normal tabular-nums text-black block tracking-tight">
                          {formatCurrency(sale.total_amount, currentInventory?.currency)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[#cacaca] mt-3">
            <button
              onClick={onNavigateToHistory}
              className="w-full min-h-[38px] px-4 rounded-full border border-[#cacaca] hover:border-black text-black text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>IR AL HISTORIAL DE TRANSACCIONES</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* LISTA B: ÚLTIMOS ÍTEMS AÑADIDOS */}
        <div className="border border-[#cacaca] bg-white p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#cacaca] font-mono">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-black" />
                <h3 className="text-xs uppercase tracking-wider text-black">
                  ÚLTIMOS ÍTEMS AÑADIDOS
                </h3>
              </div>
              <button
                onClick={onNavigateToStock}
                className="text-[10px] uppercase tracking-wider text-[#616161] hover:text-black transition-colors"
              >
                VER CATÁLOGO &gt;
              </button>
            </div>

            {/* Manifiesto de filas en texto puro con bordes de 1px */}
            <div className="divide-y divide-[#cacaca] font-mono text-xs">
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
                      className="py-3 hover:bg-[#fafafa] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1 group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[11px] text-black uppercase tracking-wider block truncate group-hover:underline">
                          REF-{prod.code} // {prod.name.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-[#616161] uppercase tracking-widest block mt-0.5">
                          {formatDate(prod.created_at)} // CAT: {prod.categories?.name?.toUpperCase() || 'GENERAL'}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                        <span className="text-xs font-normal tabular-nums text-black">
                          +{prod.stock} UDS
                        </span>
                        <span className="text-[10px] text-[#616161] tabular-nums">
                          {formatCurrency(prod.price, currentInventory?.currency)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[#cacaca] mt-3">
            <button
              onClick={onNavigateToStock}
              className="w-full min-h-[38px] px-4 rounded-full border border-[#cacaca] hover:border-black text-black text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
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
