import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  ArrowUpRight,
  Plus,
  Camera,
  ShoppingCart,
  Receipt,
  ChevronRight,
  Briefcase,
  User,
  X,
  AlertCircle
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Product, Sale } from '../types/database';
import { supabase, formatCurrency, formatDate, formatStockDisplay, formatCleanDecimal } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BarcodeScannerModal } from '../components/modals/BarcodeScannerModal';

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
  const { currentInventory, inventories, selectInventory, user, profile } = useAuth();
  const isBusiness = currentInventory?.inventory_type !== 'PERSONAL';
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // Resumen de métricas por inventario para alimentar todas las tarjetas del Wallet Stack
  const [inventorySummaries, setInventorySummaries] = useState<
    Record<string, { valuacion: number; skusCount: number; alertaCount: number; totalUnits: number }>
  >({});

  const displayName =
    profile?.full_name?.trim() ||
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    user?.email?.split('@')[0] ||
    'Usuario';
  const userEmail = user?.email || '';

  // Cargar últimas ventas registradas del inventario activo
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

  // Cargar resumen de productos para todas las tarjetas de inventarios del usuario
  useEffect(() => {
    if (!inventories || inventories.length === 0) return;
    const invIds = inventories.map((i) => i.id);
    supabase
      .from('products')
      .select('id, inventory_id, price, stock, min_stock, status')
      .in('inventory_id', invIds)
      .then(({ data, error }) => {
        if (error || !data) return;
        const map: Record<
          string,
          { valuacion: number; skusCount: number; alertaCount: number; totalUnits: number }
        > = {};

        for (const invId of invIds) {
          map[invId] = { valuacion: 0, skusCount: 0, alertaCount: 0, totalUnits: 0 };
        }

        for (const p of data) {
          const bucket = map[p.inventory_id] || {
            valuacion: 0,
            skusCount: 0,
            alertaCount: 0,
            totalUnits: 0
          };
          const stockNum = Number(p.stock || 0);
          const priceNum = Number(p.price || 0);
          const minThreshold =
            p.min_stock !== undefined && p.min_stock !== null ? Number(p.min_stock) : 1;

          bucket.skusCount += 1;
          bucket.totalUnits += stockNum;
          bucket.valuacion += priceNum * stockNum;
          if (p.status === 'ACTIVE' && stockNum < minThreshold) {
            bucket.alertaCount += 1;
          }
          map[p.inventory_id] = bucket;
        }

        setInventorySummaries(map);
      });
  }, [inventories, products]);

  // KPIs Técnicos del inventario activo
  const metrics = useMemo(() => {
    const totalSkus = products.length;
    const totalUnits = products.reduce((acc, p) => acc + (p.stock || 0), 0);
    const lowStockCount = products.filter(
      p => p.status === 'ACTIVE' && p.stock < (p.min_stock !== undefined && p.min_stock !== null ? p.min_stock : 1)
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

  // Estado de previsualización ("peek") en el primer toque de una tarjeta trasera del stack
  const [peekCardId, setPeekCardId] = useState<string | null>(null);

  // Escáner de consulta rápida exclusivo del Home (Vista Mobile)
  const [homeScannerOpen, setHomeScannerOpen] = useState(false);
  const [consultModalData, setConsultModalData] = useState<{
    found: boolean;
    product?: Product;
    code: string;
  } | null>(null);

  const handleHomeQuickConsult = (scannedCode: string) => {
    const cleanCode = scannedCode.trim();
    setHomeScannerOpen(false);
    if (!cleanCode) return;

    const matched = products.find(
      (p) => p.code.trim().toLowerCase() === cleanCode.toLowerCase()
    );

    if (matched) {
      setConsultModalData({
        found: true,
        product: matched,
        code: cleanCode
      });
    } else {
      setConsultModalData({
        found: false,
        code: cleanCode
      });
    }
  };

  useEffect(() => {
    setPeekCardId(null);
  }, [currentInventory?.id]);

  // Construcción de las tarjetas apiladas (Apple Wallet Card Stack)
  const walletCards = useMemo(() => {
    const themes = [
      'bg-neutral-900 border border-neutral-800',
      'bg-neutral-800 border border-neutral-700/90',
      'bg-zinc-800 border border-zinc-700/90'
    ];

    const list = inventories.length > 0 ? inventories : currentInventory ? [currentInventory] : [];
    const mapped = list.map((inv, idx) => {
      const isActive = inv.id === currentInventory?.id;
      const summary = isActive
        ? {
            valuacion: metrics.totalValue,
            skusCount: metrics.totalSkus,
            alertaCount: metrics.lowStockCount,
            totalUnits: metrics.totalUnits
          }
        : inventorySummaries[inv.id] || {
            valuacion: 0,
            skusCount: 0,
            alertaCount: 0,
            totalUnits: 0
          };

      return {
        id: inv.id,
        inventory: inv,
        nombre: inv.name || 'Depósito',
        tipo: (inv.inventory_type || 'BUSINESS') as 'BUSINESS' | 'PERSONAL',
        currency: inv.currency || 'PEN',
        valuacion: summary.valuacion,
        skusCount: summary.skusCount,
        alertaCount: summary.alertaCount,
        totalUnits: summary.totalUnits,
        tema: themes[idx % themes.length],
        isActive
      };
    });

    // Ordenar para que la tarjeta activa esté al frente (stackIndex = 0) y las secundarias detrás
    const activeCard = mapped.find((c) => c.isActive);
    const backCards = mapped.filter((c) => !c.isActive);
    return activeCard ? [activeCard, ...backCards] : mapped;
  }, [inventories, currentInventory, metrics, inventorySummaries]);

  const visibleStackCards = useMemo(() => walletCards.slice(0, 3), [walletCards]);
  const hasMultipleCards = visibleStackCards.length > 1;

  return (
    <>
      {/* =========================================================
          VISTA MÓVIL ULTRA MINIMALISTA (ESTILO FINANZAS PREMIUM + APPLE WALLET)
          Visible únicamente en dispositivos móviles (< 768px / md:hidden)
         ========================================================= */}
      <div
        className="md:hidden fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col overflow-hidden bg-white text-neutral-900"
        onClick={() => {
          if (peekCardId) setPeekCardId(null);
        }}
      >
        
        {/* CAPA 1: Header Oscuro Principal (Fijo / shrink-0) */}
        <header className="shrink-0 bg-neutral-950 text-white rounded-b-[2.5rem] z-20 select-none px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 transition-all duration-300">
          
          {/* Fila superior: Bienvenida + Correo y Acciones mínimas (Cámara y +) */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-white truncate">
                Hola {displayName}
              </h1>
              <p className="text-xs text-neutral-400 truncate mt-0.5">
                {userEmail}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setHomeScannerOpen(true)}
                aria-label="Consulta rápida por código de barras o QR"
                title="Consulta rápida de producto"
                className="w-10 h-10 rounded-full bg-neutral-800/70 hover:bg-neutral-800 text-neutral-200 flex items-center justify-center transition-colors active:scale-95"
              >
                <Camera className="w-4 h-4 stroke-[1.75]" />
              </button>
              <button
                type="button"
                onClick={onOpenCreateModal}
                aria-label="Nuevo ítem"
                title="Nuevo ítem"
                className="w-10 h-10 rounded-full bg-neutral-800/70 hover:bg-neutral-800 text-neutral-200 flex items-center justify-center transition-colors active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[1.75]" />
              </button>
            </div>
          </div>

          {/* WALLET CARD STACK (Top Peek: la tarjeta secundaria asoma por la parte superior) */}
          <div
            className={`relative w-full h-[205px] ${
              hasMultipleCards ? 'mt-12' : 'mt-6'
            } transition-all duration-300`}
          >
            {visibleStackCards.map((card, stackIndex) => {
              const isFront = stackIndex === 0;
              const isPeeking = !isFront && peekCardId === card.id;

              // Apilamiento hacia arriba (Top Peek):
              // - Activa (al frente): z-20, scale 1, translateY 0px
              // - Secundaria en reposo: z-10, scale 0.95, translateY -26px (asoma el encabezado superior)
              // - Secundaria en 1er toque (Peek): z-10, scale 0.98, translateY -42px (se eleva mostrando completo su encabezado)
              const zIndexVal = isFront ? 20 : 20 - stackIndex * 10;
              const scaleVal = isFront ? 1 : isPeeking ? 0.98 : Math.max(0.9, 1 - stackIndex * 0.05);
              const translateYVal = isFront ? 0 : isPeeking ? -(stackIndex * 24 + 18) : -(stackIndex * 26);

              return (
                <div
                  key={card.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isFront) {
                      if (peekCardId) setPeekCardId(null);
                      return;
                    }
                    // Interacción en 2 toques:
                    // 1er toque: eleva la tarjeta trasera hacia arriba (Peek)
                    // 2do toque: la trae al frente y cambia el inventario activo
                    if (peekCardId !== card.id) {
                      setPeekCardId(card.id);
                    } else {
                      setPeekCardId(null);
                      selectInventory(card.inventory);
                    }
                  }}
                  style={{
                    zIndex: zIndexVal,
                    transform: `translateY(${translateYVal}px) scale(${scaleVal})`,
                    transformOrigin: 'top center'
                  }}
                  className={`absolute inset-0 ${card.tema} rounded-3xl px-5 ${
                    isFront ? 'pt-4 pb-5' : 'pt-2.5 pb-5'
                  } shadow-2xl select-none transition-all duration-300 ease-out flex flex-col justify-between ${
                    isFront
                      ? 'opacity-100 brightness-100 cursor-default'
                      : isPeeking
                        ? 'opacity-95 brightness-95 cursor-pointer ring-1 ring-white/25'
                        : 'opacity-80 brightness-75 hover:opacity-90 cursor-pointer'
                  }`}
                >
                  {/* Fila superior de la tarjeta: Punto indicador + Nombre del inventario + Chip de Tipo */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isFront ? 'bg-emerald-400' : isPeeking ? 'bg-emerald-400' : 'bg-emerald-400/70'
                        }`}
                      />
                      <span className="text-xs font-semibold text-white truncate tracking-wide">
                        {card.nombre}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 ${
                        card.tipo === 'PERSONAL'
                          ? 'bg-sky-400/15 text-sky-300 border border-sky-400/20'
                          : 'bg-white/10 text-neutral-200 border border-white/10'
                      }`}
                    >
                      {card.tipo === 'PERSONAL' ? (
                        <>
                          <User className="w-2.5 h-2.5" />
                          <span>Personal</span>
                        </>
                      ) : (
                        <>
                          <Briefcase className="w-2.5 h-2.5" />
                          <span>Negocio</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Valuación de Stock del Depósito */}
                  <div className="my-auto pt-1">
                    <span className="text-[11px] text-neutral-400 font-normal tracking-wide block">
                      Valuación de Stock
                    </span>
                    <p className="text-3xl font-semibold tracking-tight text-white tabular-nums mt-0.5">
                      {formatCurrency(card.valuacion, card.currency)}
                    </p>
                  </div>

                  {/* Pie de Tarjeta: Alerta de Stock Bajo y Total de SKUs / Existencias */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] text-neutral-400 block mb-1">
                        Stock Bajo / Alerta
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-semibold tracking-wider uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {card.alertaCount} {card.alertaCount === 1 ? 'ÍTEM' : 'ÍTEMS'}
                      </span>
                    </div>

                    <div className="text-right space-y-0.5">
                      <p className="text-xs text-neutral-300">
                        <span className="font-semibold text-white tabular-nums">
                          {card.skusCount.toString().padStart(4, '0')}
                        </span>{' '}
                        <span className="text-neutral-400">Referencias activas</span>
                      </p>
                      <p className="text-xs text-neutral-300">
                        <span className="font-semibold text-white tabular-nums">
                          {formatCleanDecimal(card.totalUnits, 2)}
                        </span>{' '}
                        <span className="text-neutral-400">Existencias físicas</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </header>

        {/* CAPA 2: Contenedor Blanco Global (flex-1 flex flex-col overflow-hidden) */}
        <section className="flex-1 min-h-0 w-full bg-white flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {isBusiness ? (
              <motion.div
                key={`business-feed-${currentInventory?.id || 'default'}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex-1 min-h-0 w-full flex flex-col overflow-hidden"
              >
                {/* SUB-CAPA 2A: Barra Fija de Título (NUNCA SE MUEVE NI HACE SCROLL) */}
                <div className="shrink-0 w-full bg-white px-5 pt-4 pb-2 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-neutral-900 tracking-tight">
                    Últimas ventas / Salidas
                  </h2>
                  <button
                    type="button"
                    onClick={onNavigateToHistory}
                    className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                  >
                    Ver todo
                  </button>
                </div>

                {/* SUB-CAPA 2B: Contenedor de Datos con Scroll Aislado */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 divide-y divide-neutral-100 pb-28">
                  {loadingSales ? (
                    <div className="py-10 text-center text-xs text-neutral-400">
                      Cargando transacciones...
                    </div>
                  ) : recentSales.length === 0 ? (
                    <div className="py-10 text-center text-xs text-neutral-400">
                      Sin registros de ventas recientes
                    </div>
                  ) : (
                    recentSales.map((sale) => {
                      const firstItem = (sale.items?.[0]?.product_name || 'MERCANCÍA').toUpperCase();
                      const productLabel =
                        sale.items && sale.items.length > 1
                          ? `${firstItem} (+${sale.items.length - 1})`
                          : firstItem;
                      const shortTrx = `TRX-${sale.id.slice(0, 4).toUpperCase()}`;
                      const timeStr = new Date(sale.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      const paymentLabel = (sale.payment_method || 'CASH').toUpperCase();

                      return (
                        <div
                          key={sale.id}
                          onClick={onNavigateToHistory}
                          className="py-4 flex items-center justify-between gap-3 cursor-pointer active:opacity-70 transition-opacity"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center flex-shrink-0">
                              <ArrowUpRight className="w-3.5 h-3.5 stroke-[1.75]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900 truncate">
                                {productLabel}
                              </p>
                              <p className="text-xs text-neutral-400 truncate mt-0.5">
                                {shortTrx} · {timeStr} // {paymentLabel}
                              </p>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className="text-sm font-normal text-neutral-900 tabular-nums">
                              {formatCurrency(sale.total_amount, currentInventory?.currency)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`personal-feed-${currentInventory?.id || 'default'}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex-1 min-h-0 w-full flex flex-col overflow-hidden"
              >
                {/* SUB-CAPA 2A: Barra Fija de Título (NUNCA SE MUEVE NI HACE SCROLL) */}
                <div className="shrink-0 w-full bg-white px-5 pt-4 pb-2 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-neutral-900 tracking-tight">
                    Últimos ítems añadidos
                  </h2>
                  <button
                    type="button"
                    onClick={onNavigateToStock}
                    className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors"
                  >
                    Ver todo
                  </button>
                </div>

                {/* SUB-CAPA 2B: Contenedor de Datos con Scroll Aislado */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 divide-y divide-neutral-100 pb-28">
                  {recentProducts.length === 0 ? (
                    <div className="py-10 text-center text-xs text-neutral-400">
                      Sin registros en catálogo
                    </div>
                  ) : (
                    recentProducts.map((prod) => {
                      const dateTimeStr = new Date(prod.created_at).toLocaleString([], {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      return (
                        <div
                          key={prod.id}
                          onClick={() => onSelectProduct(prod)}
                          className="py-4 flex items-center justify-between gap-3 cursor-pointer active:opacity-70 transition-opacity"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center flex-shrink-0">
                              <Package className="w-3.5 h-3.5 stroke-[1.75]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900 truncate">
                                {prod.name.toUpperCase()}
                              </p>
                              <p className="text-xs text-neutral-400 truncate mt-0.5">
                                REF-{prod.code} · {dateTimeStr}
                              </p>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className="text-sm font-semibold text-neutral-900 tabular-nums">
                              +{formatStockDisplay(prod)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* =========================================================
          VISTA DE ESCRITORIO (>= 768px / hidden md:block)
         ========================================================= */}
      <div className="hidden md:block space-y-6 pb-28 lg:pb-16 max-w-[1440px] mx-auto text-[#1E3A5F]">
      
      {/* =========================================================
          1. CABECERA & BLOQUE DE KPIS (EXCLUSIVO DEL HOME)
         ========================================================= */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* Eyebrow y Título Principal */}
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

          {/* Accesos rápidos en píldora */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onQuickScan}
              className="min-h-[40px] px-4 rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] text-[#1E3A5F] text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors bg-white"
            >
              <Camera className="w-3.5 h-3.5 stroke-[1.5]" />
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

        {/* Retícula de KPIs 4 columnas en escritorio */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-0 border-t border-[#E5E7EB] sm:divide-x divide-[#E5E7EB] font-mono mt-4 pt-3 sm:pt-0">
          
          {/* KPI 1: TOTAL SKUS REGISTRADOS */}
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

          {/* KPI 2: UNIDADES DISPONIBLES */}
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

          {/* KPI 3: STOCK BAJO / ALERTA (Con badge píldora en fondo Nude #E8B4A0) */}
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

          {/* KPI 4: VALUACIÓN DE STOCK */}
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

      {/* =========================================================
          2. ACCESOS DIRECTOS // NAVEGACIÓN RÁPIDA (SOLO DESKTOP >= lg)
         ========================================================= */}
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

      {/* =========================================================
          3. ACTIVIDAD RECIENTE (DESKTOP)
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LISTA A: ÚLTIMAS VENTAS / SALIDAS (Solo en inventarios tipo NEGOCIO) */}
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

              {/* Manifiesto de filas en texto puro con bordes de 1px */}
              <div className="divide-y divide-[#E5E7EB] font-mono text-xs">
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

        {/* LISTA B: ÚLTIMOS ÍTEMS AÑADIDOS */}
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

            {/* Manifiesto de filas en texto puro con bordes de 1px */}
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

      {/* Escáner de Consulta Rápida (Exclusivo Home Mobile) */}
      <BarcodeScannerModal
        isOpen={homeScannerOpen}
        onClose={() => setHomeScannerOpen(false)}
        onScanSuccess={handleHomeQuickConsult}
        title="Consulta Rápida de Producto"
        instructions="Escanea el código de barras o QR para consultar precio y disponibilidad."
      />

      {/* Modal / Tarjeta Flotante de Resultado de Consulta Rápida */}
      <AnimatePresence>
        {consultModalData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConsultModalData(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="mobile-dark-modal w-full max-w-sm rounded-[1.75rem] max-h-[85vh] flex flex-col overflow-hidden bg-white shadow-2xl"
            >
              {/* Cabecera Limpia */}
              <div className="bg-white px-5 pt-5 pb-3.5 border-b border-neutral-100 shrink-0 relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold tracking-tight text-neutral-900 truncate">
                      {consultModalData.found && consultModalData.product
                        ? consultModalData.product.name
                        : 'Producto no existente'}
                    </h3>
                    <p className="text-xs text-neutral-400 font-normal mt-0.5">
                      Consulta rápida · Código {consultModalData.code}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConsultModalData(null)}
                    className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-900 flex items-center justify-center flex-shrink-0"
                    aria-label="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bloque 2: Cuerpo Operativo Blanco Puro */}
              <div className="bg-white px-5 py-4 pb-6 overflow-y-auto flex-1 overscroll-contain">
                {consultModalData.found && consultModalData.product ? (
                  <div>
                    <div className="divide-y divide-neutral-100">
                      <div className="py-3.5 flex items-center justify-between border-b border-neutral-100">
                        <span className="text-xs font-semibold text-neutral-700">
                          Precio unitario
                        </span>
                        <span className="text-base font-bold text-neutral-900 tabular-nums">
                          {formatCurrency(consultModalData.product.price, currentInventory?.currency)}
                        </span>
                      </div>

                      <div className="py-3.5 flex items-center justify-between border-b border-neutral-100">
                        <span className="text-xs font-semibold text-neutral-700">
                          Cantidad disponible
                        </span>
                        <span className="text-base font-bold text-neutral-900 tabular-nums">
                          {formatStockDisplay(consultModalData.product)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConsultModalData(null)}
                      className="w-full py-3.5 bg-neutral-950 text-white font-semibold rounded-2xl text-sm shadow-md active:scale-[0.98] transition-transform mt-4 mb-2"
                    >
                      Cerrar
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-neutral-600 py-3.5 border-b border-neutral-100 leading-relaxed">
                      El código <span className="font-mono font-semibold text-neutral-900">{consultModalData.code}</span> no se encuentra registrado en este inventario.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConsultModalData(null)}
                      className="w-full py-3.5 bg-neutral-950 text-white font-semibold rounded-2xl text-sm shadow-md active:scale-[0.98] transition-transform mt-4 mb-2"
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
