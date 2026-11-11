import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useIsDesktop } from '../hooks/useDevice';
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
const BarcodeScannerModal = React.lazy(() => import('../components/modals/BarcodeScannerModal').then(m => ({ default: m.BarcodeScannerModal })));
import { isSaleRejected } from '../lib/supabase';
import { InventoryCardsSkeleton } from '../components/ui/Skeleton';
import { LazyModalSlot } from '../components/common/LazyModalSlot';
import { useBackdropDismiss, useLatestValue, useModalEscape, useModalMotion } from '../components/modals/modalMotion';

interface QuickConsultModalProps {
  data: { found: boolean; product?: Product; code: string } | null;
  currency?: string;
  onClose: () => void;
}

const QuickConsultModal: React.FC<QuickConsultModalProps> = ({ data, currency, onClose }) => {
  const activeData = useLatestValue(data);
  const { backdropMotion, panelMotion } = useModalMotion();
  const backdropDismiss = useBackdropDismiss(onClose, Boolean(data));
  useModalEscape(Boolean(data), onClose);

  return (
    <AnimatePresence>
      {data && activeData && (
        <motion.div
          {...backdropMotion}
          {...backdropDismiss}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
        >
          <motion.div
            {...panelMotion}
            onClick={(e) => e.stopPropagation()}
            className="mobile-dark-modal w-full max-w-sm rounded-[1.75rem] max-h-[85vh] flex flex-col overflow-hidden bg-white shadow-2xl"
          >
            <div className="bg-white px-5 pt-5 pb-3.5 border-b border-neutral-100 shrink-0 relative">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold tracking-tight text-neutral-900 truncate">
                    {activeData.found && activeData.product
                      ? activeData.product.name
                      : 'Producto no existente'}
                  </h3>
                  <p className="text-xs text-neutral-400 font-normal mt-0.5">
                    Consulta rápida · Código {activeData.code}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-900 flex items-center justify-center flex-shrink-0"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-white px-5 py-4 pb-6 overflow-y-auto flex-1 overscroll-contain">
              {activeData.found && activeData.product ? (
                <div>
                  <div className="divide-y divide-neutral-100">
                    <div className="py-3.5 flex items-center justify-between border-b border-neutral-100">
                      <span className="text-xs font-semibold text-neutral-700">
                        Precio unitario
                      </span>
                      <span className="text-base font-bold text-neutral-900 tabular-nums">
                        {formatCurrency(activeData.product.price, currency)}
                      </span>
                    </div>

                    <div className="py-3.5 flex items-center justify-between border-b border-neutral-100">
                      <span className="text-xs font-semibold text-neutral-700">
                        Cantidad disponible
                      </span>
                      <span className="text-base font-bold text-neutral-900 tabular-nums">
                        {formatStockDisplay(activeData.product)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3.5 bg-neutral-950 text-white font-semibold rounded-2xl text-sm shadow-md active:scale-[0.98] transition-transform mt-4 mb-2"
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-neutral-600 py-3.5 border-b border-neutral-100 leading-relaxed">
                    El código <span className="font-mono font-semibold text-neutral-900">{activeData.code}</span> no se encuentra registrado en este inventario.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
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
  );
};

interface HomePageProps {
  products: Product[];
  onNavigateToStock: () => void;
  onNavigateToSales?: () => void;
  onNavigateToHistory: () => void;
  onSelectProduct: (product: Product) => void;
  onQuickScan: () => void;
  onOpenCreateModal: () => void;
}

const HomeDesktopView = React.lazy(() => import('./desktop/HomeDesktopView'));

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
  const isDesktop = useIsDesktop();
  const isBusiness = currentInventory?.inventory_type !== 'PERSONAL';
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // Estado reactivo de conectividad para el indicador del Home (Online / Offline)
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  // Construcción de las tarjetas apiladas (Apple Wallet Card Stack) con estilo Glassmorphism
  const walletCards = useMemo(() => {
    const themes = [
      // Glassmorphism 1: Frost Ice con borde translúcido y relieve luminoso
      'bg-white/[0.09] backdrop-blur-2xl border border-white/20 shadow-[0_16px_36px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-1px_1px_rgba(0,0,0,0.2)]',
      // Glassmorphism 2: Frost Cobalt con halo sutil zafiro
      'bg-sky-500/[0.09] backdrop-blur-2xl border border-sky-300/25 shadow-[0_16px_36px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-1px_1px_rgba(0,0,0,0.2)]',
      // Glassmorphism 3: Frost Emerald con halo sutil esmeralda
      'bg-emerald-500/[0.09] backdrop-blur-2xl border border-emerald-300/25 shadow-[0_16px_36px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-1px_1px_rgba(0,0,0,0.2)]'
    ];

    const list = inventories && inventories.length > 0 ? inventories : currentInventory ? [currentInventory] : [];
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

  // Mostrar únicamente 2 tarjetas como máximo para evitar desbordamiento en móviles
  const visibleStackCards = useMemo(() => walletCards.slice(0, 2), [walletCards]);
  const hasMultipleCards = visibleStackCards.length > 1;

  if (isDesktop) {
    return (
      <div className="hidden md:block">
        <Suspense
          fallback={
            <div className="p-8 text-center text-xs font-mono text-[#616161]">
              CARGANDO RESUMEN DE ESCRITORIO...
            </div>
          }
        >
          <HomeDesktopView
            metrics={metrics}
            onQuickScan={onQuickScan}
            onOpenCreateModal={onOpenCreateModal}
            onNavigateToStock={onNavigateToStock}
            onNavigateToSales={onNavigateToSales}
            onNavigateToHistory={onNavigateToHistory}
            onSelectProduct={onSelectProduct}
            isBusiness={isBusiness}
            loadingSales={loadingSales}
            recentSales={recentSales}
            recentProducts={recentProducts}
            currentInventory={currentInventory}
          />
        </Suspense>

        <LazyModalSlot open={homeScannerOpen}>
          <BarcodeScannerModal
            isOpen={homeScannerOpen}
            onClose={() => setHomeScannerOpen(false)}
            onScanSuccess={handleHomeQuickConsult}
            title="Consulta Rápida de Producto"
            instructions="Escanea el código de barras o QR para consultar precio y disponibilidad."
          />
        </LazyModalSlot>

        <QuickConsultModal
          data={consultModalData}
          currency={currentInventory?.currency}
          onClose={() => setConsultModalData(null)}
        />
      </div>
    );
  }

  return (
    <>
      {/* =========================================================
          VISTA MÓVIL ULTRA MINIMALISTA (ESTILO FINANZAS PREMIUM + APPLE WALLET)
          Visible únicamente en dispositivos móviles (< 768px / md:hidden)
         ========================================================= */}
      <div
        className="block md:hidden fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col overflow-hidden bg-white text-neutral-900"
        onClick={() => {
          if (peekCardId) setPeekCardId(null);
        }}
      >
        
        {/* CAPA 1: Header Oscuro Principal (Fijo / shrink-0) con Iluminación Ambiental Glassmorphism */}
        <header className="shrink-0 bg-neutral-950 text-white rounded-b-[2.5rem] z-20 select-none px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 transition-all duration-300 relative overflow-hidden">
          {/* Orbes de luz ambiental de fondo que potencian la refracción del Glassmorphism */}
          <div className="absolute -top-12 -right-8 w-52 h-52 rounded-full bg-sky-500/20 blur-3xl pointer-events-none" />
          <div className="absolute top-1/4 -left-12 w-56 h-56 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 right-1/4 w-48 h-48 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
          
          {/* Fila superior: Bienvenida + Correo y Acciones mínimas (Cámara y +) */}
          <div className="flex items-center justify-between gap-4 relative z-10">
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
                className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white flex items-center justify-center transition-colors active:scale-95 shadow-xs cursor-pointer"
              >
                <Camera className="w-4 h-4 stroke-[1.75] text-white" />
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
            {visibleStackCards.length === 0 ? (
              <InventoryCardsSkeleton />
            ) : (
              visibleStackCards.map((card, stackIndex) => {
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
                  } shadow-2xl select-none transition-all duration-300 ease-out flex flex-col justify-between overflow-hidden ${
                    isFront
                      ? 'opacity-100 brightness-100 cursor-default ring-1 ring-white/25'
                      : isPeeking
                        ? 'opacity-95 brightness-100 cursor-pointer ring-1 ring-white/40 shadow-[0_20px_45px_rgba(0,0,0,0.6)]'
                        : 'opacity-85 brightness-90 hover:opacity-95 cursor-pointer'
                  }`}
                >
                  {/* Reflejo especular diagonal característico de cristal pulido (Glass Specular Sheen) */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.14] via-transparent to-transparent pointer-events-none" />

                  {/* Fila superior de la tarjeta: Punto indicador Online/Offline + Nombre del inventario + Chip de Tipo */}
                  <div className="flex items-center justify-between gap-3 relative z-10">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        title={isOnline ? 'En línea' : 'Sin conexión (Offline)'}
                        className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
                          isOnline
                            ? isFront
                              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                              : isPeeking
                                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                                : 'bg-emerald-400/80'
                            : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse'
                        }`}
                      />
                      <span className="text-xs font-semibold text-white truncate tracking-wide drop-shadow-sm">
                        {card.nombre}
                      </span>
                      {!isOnline && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 flex-shrink-0 font-medium">
                          Offline
                        </span>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 backdrop-blur-md shadow-xs ${
                        card.tipo === 'PERSONAL'
                          ? 'bg-sky-400/20 text-sky-200 border border-sky-400/30'
                          : 'bg-white/10 text-white/90 border border-white/20'
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
                  <div className="my-auto pt-1 relative z-10">
                    <span className="text-[11px] text-neutral-300/80 font-normal tracking-wide block">
                      Valuación de Stock
                    </span>
                    <p className="text-3xl font-semibold tracking-tight text-white tabular-nums mt-0.5 drop-shadow-sm">
                      {formatCurrency(card.valuacion, card.currency)}
                    </p>
                  </div>

                  {/* Pie de Tarjeta: Alerta de Stock Bajo y Total de SKUs / Existencias */}
                  <div className="pt-3 border-t border-white/[0.14] flex items-center justify-between gap-3 relative z-10">
                    <div>
                      <span className="text-[11px] text-neutral-300/80 block mb-1">
                        Stock Bajo / Alerta
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 backdrop-blur-md text-amber-300 border border-amber-400/30 text-[10px] font-semibold tracking-wider uppercase shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {card.alertaCount} {card.alertaCount === 1 ? 'ÍTEM' : 'ÍTEMS'}
                      </span>
                    </div>

                    <div className="text-right space-y-0.5">
                      <p className="text-xs text-neutral-300">
                        <span className="font-semibold text-white tabular-nums drop-shadow-sm">
                          {card.skusCount.toString().padStart(4, '0')}
                        </span>{' '}
                        <span className="text-neutral-300/80">Referencias activas</span>
                      </p>
                      <p className="text-xs text-neutral-300">
                        <span className="font-semibold text-white tabular-nums drop-shadow-sm">
                          {formatCleanDecimal(card.totalUnits, 2)}
                        </span>{' '}
                        <span className="text-neutral-300/80">Existencias físicas</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            }))}
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
                    <div className="py-2 space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="py-3 flex items-center justify-between gap-3 animate-pulse">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 shrink-0" />
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="w-32 h-4 rounded bg-neutral-200 dark:bg-neutral-800" />
                              <div className="w-20 h-3 rounded bg-neutral-100 dark:bg-neutral-850" />
                            </div>
                          </div>
                          <div className="w-16 h-5 rounded bg-neutral-200 dark:bg-neutral-800 shrink-0" />
                        </div>
                      ))}
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
                            <span className={`text-sm font-normal tabular-nums ${isSaleRejected(sale) ? 'text-red-600' : 'text-emerald-600'}`}>
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

      {/* Escáner de Consulta Rápida (Exclusivo Home Mobile) */}
      <LazyModalSlot open={homeScannerOpen}>
        <BarcodeScannerModal
          isOpen={homeScannerOpen}
          onClose={() => setHomeScannerOpen(false)}
          onScanSuccess={handleHomeQuickConsult}
          title="Consulta Rápida de Producto"
          instructions="Escanea el código de barras o QR para consultar precio y disponibilidad."
        />
      </LazyModalSlot>

      {/* Modal / Tarjeta Flotante de Resultado de Consulta Rápida */}
      <QuickConsultModal
        data={consultModalData}
        currency={currentInventory?.currency}
        onClose={() => setConsultModalData(null)}
      />
    </>
  );
};

export default HomePage;
