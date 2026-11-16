import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Search,
  MapPin,
  QrCode,
  History,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  X,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ClipboardList
} from 'lucide-react';
import { Product, Location, StocktakeSession } from '../../types/database';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { matchesAnyField, normalizeText } from '../../utils/searchUtils';
import { BarcodeScannerModal } from '../modals/BarcodeScannerModal';
import { StocktakeQuantityModal } from './StocktakeQuantityModal';
import { StocktakeReviewModal, StocktakeDiscrepancyItem } from './StocktakeReviewModal';
import { StocktakeHistoryModal } from './StocktakeHistoryModal';
import { showAppToast } from '../ui/ToastNotification';
import { saveStocktakeLocally } from '../../services/offlineSync';

interface StocktakeViewProps {
  products: Product[];
  locations: Location[];
  onRefresh: () => void;
  onExitStocktake?: () => void;
}

export interface CountedProductEntry {
  product: Product;
  countedQty: number; // En unidades operativas
  lastUpdated: string;
}

export const StocktakeView: React.FC<StocktakeViewProps> = ({
  products,
  locations,
  onRefresh,
  onExitStocktake
}) => {
  const { currentInventory, user } = useAuth();

  // Estados de la Sesión
  const [activeSession, setActiveSession] = useState<{
    id?: string;
    code: string;
    location: Location;
  } | null>(null);

  // Estante escaneado físicamente (QR obligatorio para iniciar)
  const [scannedLocation, setScannedLocation] = useState<Location | null>(null);

  // Modales
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [cameraScanTarget, setCameraScanTarget] = useState<'location' | 'product'>('location');
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
  const [selectedProductForCount, setSelectedProductForCount] = useState<Product | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Conteo Físico en la Sesión (Blind Count: Almacena producto_id -> CountedProductEntry)
  const [countedEntries, setCountedEntries] = useState<Map<string, CountedProductEntry>>(new Map());

  // Búsqueda Manual de Producto (Buscador sin bordes, insensible a acentos)
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Productos sugeridos por el buscador manual (durante el barrido ciego)
  const productSuggestions = useMemo(() => {
    if (!searchProductQuery.trim()) return [];
    return products
      .filter((p) => p.status === 'ACTIVE' && matchesAnyField([p.name, p.code, p.sku], searchProductQuery))
      .slice(0, 8);
  }, [products, searchProductQuery]);

  // Total de unidades contadas en la sesión
  const totalCountedUnits = useMemo(() => {
    let sum = 0;
    countedEntries.forEach((entry) => {
      sum += entry.countedQty;
    });
    return Number(sum.toFixed(4));
  }, [countedEntries]);

  // Iniciar Sesión de Barrido para una Ubicación
  const handleStartSession = async (location: Location) => {
    if (!currentInventory) return;
    try {
      // Si estamos online, intentar crear sesión en Supabase
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const { data, error } = await supabase.rpc('create_stocktake_session', {
          p_inventory_id: currentInventory.id,
          p_location_id: location.id,
          p_user_id: user?.id || null,
          p_user_email: user?.email || null,
          p_notes: 'Barrido móvil'
        });

        if (error) throw error;

        setActiveSession({
          id: data.session_id,
          code: data.code,
          location
        });
      } else {
        // Modo offline
        const localCode = `BRR-${Date.now().toString().slice(-4)}`;
        setActiveSession({
          code: localCode,
          location
        });
      }

      setScannedLocation(null);
      setCountedEntries(new Map());
      showAppToast(`Barrido iniciado en ${location.name} (${location.code})`, 'success', 3000);
    } catch (err: any) {
      console.error('Error al iniciar barrido:', err);
      // Fallback local
      const localCode = `BRR-${Date.now().toString().slice(-4)}`;
      setActiveSession({
        code: localCode,
        location
      });
      setScannedLocation(null);
      setCountedEntries(new Map());
      showAppToast(`Barrido iniciado localmente en ${location.name}`, 'info', 3000);
    }
  };

  // Procesar escaneo de QR de Ubicación (Obligatorio para iniciar)
  const handleLocationScanSuccess = (decodedText: string) => {
    const cleanCode = decodedText.trim();
    // Buscar ubicación por código exacto o case-insensitive
    const matchedLoc = locations.find(
      (l) => l.code.toUpperCase() === cleanCode.toUpperCase() || cleanCode.toUpperCase().includes(l.code.toUpperCase())
    );

    if (matchedLoc) {
      setScannedLocation(matchedLoc);
      showAppToast(`Estante detectado: ${matchedLoc.name} (${matchedLoc.code})`, 'success', 3000);
    } else {
      showAppToast(`No se encontró ningún estante con el código "${cleanCode}"`, 'error', 4000);
    }
  };

  // Procesar escaneo de Código de Barras / SKU de Producto
  const handleProductScanSuccess = (decodedText: string) => {
    const cleanCode = decodedText.trim();
    const matchedProd = products.find(
      (p) => p.code.toUpperCase() === cleanCode.toUpperCase() ||
             (p.sku && p.sku.toUpperCase() === cleanCode.toUpperCase())
    );

    if (matchedProd) {
      setSelectedProductForCount(matchedProd);
      setIsQuantityModalOpen(true);
    } else {
      showAppToast(`Producto "${cleanCode}" no encontrado en el catálogo`, 'error', 4000);
    }
  };

  // Confirmar cantidad de un producto (Sumar o Reemplazar)
  const handleConfirmQuantity = (product: Product, quantity: number, mode: 'replace' | 'add') => {
    setCountedEntries((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      const currentQty = existing ? existing.countedQty : 0;
      const newQty = mode === 'add'
        ? Number((currentQty + quantity).toFixed(4))
        : Number(quantity.toFixed(4));

      next.set(product.id, {
        product,
        countedQty: newQty,
        lastUpdated: new Date().toISOString()
      });
      return next;
    });

    showAppToast(`${product.name}: ${quantity} unds registradas`, 'success', 2000);
    setSearchProductQuery('');
  };

  // Eliminar un producto del conteo actual
  const handleRemoveCountedItem = (productId: string) => {
    setCountedEntries((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
  };

  // Preparar discrepancias para el modal de conciliación
  const [discrepanciesList, setDiscrepanciesList] = useState<StocktakeDiscrepancyItem[]>([]);

  const handleOpenReview = async () => {
    if (!activeSession || !currentInventory) return;
    setIsCommitting(true);

    try {
      // 1. Consultar stock teórico en BD para esta ubicación
      let dbLocationsStock: Array<{ product_id: string; quantity: number }> = [];

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const { data, error } = await supabase
          .from('product_locations')
          .select('product_id, quantity')
          .eq('location_id', activeSession.location.id);

        if (!error && data) {
          dbLocationsStock = data;
        }
      }

      // Mapa de stock teórico por producto
      const theoreticalStockMap = new Map<string, number>();
      dbLocationsStock.forEach((row) => {
        theoreticalStockMap.set(row.product_id, Number(row.quantity || 0));
      });

      const list: StocktakeDiscrepancyItem[] = [];
      const processedProductIds = new Set<string>();

      // A. Procesar ítems que fueron escaneados en esta sesión
      countedEntries.forEach((entry, productId) => {
        processedProductIds.add(productId);
        const expected = theoreticalStockMap.get(productId) || 0;
        const counted = entry.countedQty;
        const diff = Number((counted - expected).toFixed(4));
        const unitCost = Number(entry.product.cost_price || 0);
        const totalImpact = Number((diff * unitCost).toFixed(2));

        let type: 'DEFICIT' | 'SURPLUS' | 'MATCH' = 'MATCH';
        if (diff < -0.0001) type = 'DEFICIT';
        else if (diff > 0.0001) type = 'SURPLUS';

        list.push({
          product: entry.product,
          expectedQty: expected,
          countedQty: counted,
          differenceQty: diff,
          unitCost,
          totalCostImpact: totalImpact,
          type,
          isUnscanned: false
        });
      });

      // B. Procesar ítems que figuraban en BD para ese estante con stock > 0 y NO fueron escaneados
      theoreticalStockMap.forEach((qty, productId) => {
        if (!processedProductIds.has(productId) && qty > 0.0001) {
          const prod = products.find((p) => p.id === productId);
          if (prod) {
            const unitCost = Number(prod.cost_price || 0);
            const diff = -qty;
            list.push({
              product: prod,
              expectedQty: qty,
              countedQty: 0,
              differenceQty: diff,
              unitCost,
              totalCostImpact: Number((diff * unitCost).toFixed(2)),
              type: 'DEFICIT',
              isUnscanned: true
            });
          }
        }
      });

      setDiscrepanciesList(list);
      setIsReviewModalOpen(true);
    } catch (err) {
      console.error('Error calculando conciliación:', err);
      showAppToast('Error al preparar la conciliación.', 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  // Confirmar y Ajustar en BD (Cierre definitivo)
  const handleCommitAdjustments = async () => {
    if (!activeSession || !currentInventory) return;
    setIsCommitting(true);

    try {
      const itemsPayload = Array.from(countedEntries.values()).map((entry) => ({
        product_id: entry.product.id,
        counted_qty: entry.countedQty,
        unit_cost_snapshot: Number(entry.product.cost_price || 0)
      }));

      // Si hay conexión y sesión remota, llamar a la RPC commit_stocktake_session
      if (typeof navigator !== 'undefined' && navigator.onLine && activeSession.id) {
        // 1. Guardar o actualizar ítems contados en stocktake_items
        if (itemsPayload.length > 0) {
          const rowsToUpsert = itemsPayload.map((it) => ({
            session_id: activeSession.id,
            product_id: it.product_id,
            counted_qty: it.counted_qty,
            unit_cost_snapshot: it.unit_cost_snapshot
          }));

          const { error: upsertErr } = await supabase
            .from('stocktake_items')
            .upsert(rowsToUpsert, { onConflict: 'session_id,product_id' });

          if (upsertErr) throw upsertErr;
        }

        // 2. Ejecutar RPC transaccional commit_stocktake_session
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('commit_stocktake_session', {
          p_session_id: activeSession.id,
          p_user_id: user?.id || null,
          p_user_email: user?.email || null
        });

        if (rpcErr) throw rpcErr;

        showAppToast(
          `Barrido ${activeSession.code} conciliado: ${rpcRes.adjusted_count} productos ajustados en Kardex.`,
          'success',
          5000
        );
      } else {
        // Guardar en cola offline de IndexedDB (stocktake_queue)
        await saveStocktakeLocally({
          session_id: activeSession.id,
          inventory_id: currentInventory.id,
          location_id: activeSession.location.id,
          code: activeSession.code,
          user_id: user?.id,
          user_email: user?.email,
          notes: 'Barrido guardado sin conexión',
          items: itemsPayload
        });

        showAppToast(
          `Barrido ${activeSession.code} guardado localmente en cola offline. Se sincronizará al conectar.`,
          'info',
          5000
        );
      }

      // Limpiar sesión y refrescar catálogo
      setIsReviewModalOpen(false);
      setActiveSession(null);
      setCountedEntries(new Map());
      onRefresh();
    } catch (err: any) {
      console.error('Error al confirmar barrido:', err);
      showAppToast(`Error al aplicar ajuste: ${err?.message || 'Error de base de datos'}`, 'error', 5000);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden bg-white text-neutral-900">
      {/* VISTA 1: ESCANEAR ESTANTE OBLIGATORIO / INICIAR BARRIDO */}
      {!activeSession ? (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-4 pb-32 space-y-4">
          {/* Card Informativa con Título y Botón de Historial al lado */}
          <div className="p-4 rounded-3xl bg-neutral-950 text-white shadow-xl space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold tracking-tight text-white">
                Ajuste de inventario
              </h2>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                className="py-1.5 px-3.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition-colors active:scale-95 border border-neutral-700/60 shrink-0"
              >
                <History className="w-3.5 h-3.5 text-neutral-300" />
                <span>Historial</span>
              </button>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Para garantizar la máxima fidelidad, es obligatorio escanear físicamente el código QR del estante antes de comenzar. Durante la toma no se mostrarán las existencias del sistema.
            </p>
          </div>

          {/* Tarjeta de Ubicación Escaneada (Si ya se escaneó el QR) */}
          {scannedLocation ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-3xl bg-neutral-50 border-2 border-neutral-900/10 shadow-lg space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Estante verificado físicamente
                </span>
                <button
                  type="button"
                  onClick={() => setScannedLocation(null)}
                  className="p-1 rounded-full hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 transition-colors"
                  title="Cambiar estante"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <MapPin className="w-6 h-6 stroke-[1.8] text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold block">
                    Ubicación escaneada
                  </span>
                  <h3 className="text-base font-bold text-neutral-950 truncate">
                    {scannedLocation.name}
                  </h3>
                  <div className="mt-1">
                    <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md bg-neutral-200/80 text-neutral-800">
                      CÓDIGO: {scannedLocation.code}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleStartSession(scannedLocation)}
                  className="w-full py-4 px-5 rounded-2xl bg-neutral-950 hover:bg-neutral-900 active:scale-[0.98] text-white text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Iniciar barrido en este estante</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCameraScanTarget('location');
                    setIsCameraScannerOpen(true);
                  }}
                  className="w-full py-2.5 text-center text-xs font-semibold text-neutral-500 hover:text-neutral-800 transition-colors"
                >
                  Escanear otro estante QR
                </button>
              </div>
            </motion.div>
          ) : (
            /* Botón Principal y Único: Escaneo QR de Ubicación */
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setCameraScanTarget('location');
                  setIsCameraScannerOpen(true);
                }}
                className="w-full p-5 rounded-3xl bg-neutral-900 hover:bg-neutral-800 text-white flex items-center justify-between gap-3 shadow-md active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center text-white shrink-0">
                    <QrCode className="w-6 h-6 stroke-[1.8] text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">Escanear Estante (QR)</p>
                    <p className="text-xs text-neutral-400">Lectura de etiqueta física ISO/IEC 7810</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-neutral-300 bg-neutral-800 px-3 py-1.5 rounded-full shrink-0">
                  Cámara
                </span>
              </button>

              <div className="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
                <div className="text-xs text-neutral-600 leading-relaxed">
                  <strong className="text-neutral-800 font-semibold block">Verificación de presencia física:</strong>
                  Para iniciar un ajuste es obligatorio escanear el código QR del estante físico. La selección manual desde listas está deshabilitada para asegurar que el operario esté presente en el lugar.
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VISTA 2: BARRIDO CIEGO EN PROGRESO (BLIND COUNT) */
        <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
          {/* Sub-Header Fijo: Información de la Sesión y Conteo */}
          <div className="shrink-0 bg-neutral-900 text-white px-5 pt-3 pb-3 border-b border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block">
                  {activeSession.code} · Barrido Ciego
                </span>
                <h3 className="text-sm font-bold text-white truncate max-w-[220px]">
                  {activeSession.location.name} <span className="text-neutral-400 text-xs font-mono">({activeSession.location.code})</span>
                </h3>
              </div>

              {/* Botón de Salir / Cancelar Sesión */}
              <button
                type="button"
                onClick={() => {
                  if (countedEntries.size > 0) {
                    if (confirm('¿Deseas salir del barrido? Los ítems escaneados se conservarán hasta finalizar.')) {
                      setActiveSession(null);
                    }
                  } else {
                    setActiveSession(null);
                  }
                }}
                className="py-1 px-2.5 rounded-full bg-neutral-800 text-neutral-400 hover:text-white text-xs font-medium transition-colors"
              >
                Pausar
              </button>
            </div>

            {/* Badges de Conteo en Vivo */}
            <div className="flex items-center gap-2 pt-1 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-200 font-medium">
                SKUs contados: <strong className="text-white tabular-nums font-mono">{countedEntries.size}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-200 font-medium">
                Unidades físicas: <strong className="text-amber-300 tabular-nums font-mono">{totalCountedUnits}</strong>
              </span>
            </div>
          </div>

          {/* Barra Fija de Búsqueda y Escáner de Producto */}
          <div className="shrink-0 bg-white px-5 pt-3 pb-2 space-y-2 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 flex items-center gap-2.5 bg-neutral-50 border border-neutral-200/70 rounded-2xl px-3.5 py-3 focus-within:border-neutral-950 focus-within:bg-white transition-all">
                <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchProductQuery}
                  onChange={(e) => setSearchProductQuery(e.target.value)}
                  placeholder="Escanear o buscar producto..."
                  className="w-full bg-transparent border-0 outline-none p-0 text-xs text-neutral-900 placeholder:text-neutral-400 font-medium"
                />
                {searchProductQuery && (
                  <button type="button" onClick={() => setSearchProductQuery('')} className="text-neutral-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setCameraScanTarget('product');
                  setIsCameraScannerOpen(true);
                }}
                className="w-12 h-12 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-sm cursor-pointer"
                title="Escanear con Cámara"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Sugerencias de búsqueda manual */}
            {productSuggestions.length > 0 && (
              <div className="bg-neutral-50 border border-neutral-100 rounded-2xl px-3 max-h-48 overflow-y-auto divide-y divide-neutral-100 shadow-lg">
                {productSuggestions.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => {
                      setSelectedProductForCount(prod);
                      setIsQuantityModalOpen(true);
                      setSearchProductQuery('');
                    }}
                    className="w-full py-2.5 flex items-center justify-between text-left active:opacity-70"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-neutral-900 truncate">{prod.name}</p>
                      <p className="text-[10px] font-mono text-neutral-400 truncate">SKU: {prod.code}</p>
                    </div>
                    <span className="text-[11px] font-bold text-neutral-900 bg-white px-2 py-0.5 rounded-full border border-neutral-200 shrink-0">
                      + Contar
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Listado de Productos Contados en esta Sesión (Scroll Aislado) */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-3 pb-32 space-y-2.5">
            {countedEntries.size === 0 ? (
              <div className="text-center py-12 px-4 space-y-2">
                <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                  <ClipboardList className="w-6 h-6 stroke-[1.8]" />
                </div>
                <p className="text-xs font-semibold text-neutral-700">
                  Ningún producto contado aún en este estante
                </p>
                <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">
                  Apunta la cámara a los códigos de barra o usa el buscador superior para registrar cada artículo presente físicamente.
                </p>
              </div>
            ) : (
              Array.from(countedEntries.values()).map((entry) => {
                const imageUrl = Array.isArray(entry.product.images) && entry.product.images.length > 0
                  ? (typeof entry.product.images[0] === 'string' ? entry.product.images[0] : (entry.product.images[0] as any)?.url)
                  : null;

                return (
                  <div
                    key={entry.product.id}
                    onClick={() => {
                      setSelectedProductForCount(entry.product);
                      setIsQuantityModalOpen(true);
                    }}
                    className="p-3 rounded-2xl bg-white border border-neutral-200/70 shadow-xs flex items-center justify-between gap-3 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-neutral-100 border border-neutral-200/60 flex items-center justify-center overflow-hidden shrink-0">
                        {imageUrl ? (
                          <img src={imageUrl} alt={entry.product.name} className="w-full h-full object-contain" />
                        ) : (
                          <Package className="w-5 h-5 text-neutral-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-900 truncate">
                          {entry.product.name}
                        </p>
                        <p className="text-[11px] font-mono text-neutral-400 truncate">
                          SKU: {entry.product.code}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-mono font-bold text-neutral-950 bg-neutral-100 px-2.5 py-1 rounded-xl tabular-nums">
                        {entry.countedQty} unds
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCountedItem(entry.product.id);
                        }}
                        className="w-7 h-7 rounded-full text-neutral-300 hover:text-rose-600 flex items-center justify-center transition-colors"
                        title="Eliminar del conteo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Barra Fija Inferior de Cierre (con margen seguro sobre la cápsula de navegación) */}
          <div className="fixed bottom-20 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-neutral-100 z-30 flex items-center justify-center">
            <button
              type="button"
              disabled={countedEntries.size === 0}
              onClick={handleOpenReview}
              className="w-full max-w-lg py-4 rounded-2xl bg-neutral-950 hover:bg-neutral-900 text-white font-bold text-sm shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              <span>Finalizar Barrido ({countedEntries.size} SKUs · {totalCountedUnits} unds)</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: Escáner de Cámara */}
      <BarcodeScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        qrBoxType={cameraScanTarget === 'location' ? 'square' : 'barcode'}
        title={cameraScanTarget === 'location' ? 'Escanear Etiqueta de Estante' : 'Escanear Producto'}
        instructions={
          cameraScanTarget === 'location'
            ? 'Apunta la cámara al código QR de la tarjeta de ubicación ISO/IEC 7810.'
            : 'Apunta la cámara al código de barras o QR del producto para agregarlo al conteo.'
        }
        onScanSuccess={(decoded) => {
          if (cameraScanTarget === 'location') {
            handleLocationScanSuccess(decoded);
          } else {
            handleProductScanSuccess(decoded);
          }
        }}
      />

      {/* MODAL 2: Ingreso Numérico Táctil */}
      <StocktakeQuantityModal
        isOpen={isQuantityModalOpen}
        onClose={() => {
          setIsQuantityModalOpen(false);
          setSelectedProductForCount(null);
        }}
        product={selectedProductForCount}
        existingCountedQty={selectedProductForCount ? (countedEntries.get(selectedProductForCount.id)?.countedQty || 0) : 0}
        onConfirm={handleConfirmQuantity}
      />

      {/* MODAL 3: Conciliación y Ajuste en Kardex */}
      {activeSession && (
        <StocktakeReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          location={activeSession.location}
          sessionCode={activeSession.code}
          discrepancies={discrepanciesList}
          isCommitting={isCommitting}
          onConfirmAdjust={handleCommitAdjustments}
          onContinueCounting={() => setIsReviewModalOpen(false)}
        />
      )}

      {/* MODAL 4: Historial de Barridos */}
      <StocktakeHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelectSessionToResume={(session) => {
          // Reanudar sesión
          setActiveSession({
            id: session.id,
            code: session.code,
            location: session.locations
          });
          // Reconstruir mapa de ítems previamente contados
          const map = new Map<string, CountedProductEntry>();
          (session.stocktake_items || []).forEach((it: any) => {
            if (it.products) {
              map.set(it.products.id, {
                product: it.products,
                countedQty: Number(it.counted_qty || 0),
                lastUpdated: session.started_at
              });
            }
          });
          setCountedEntries(map);
        }}
      />
    </div>
  );
};
