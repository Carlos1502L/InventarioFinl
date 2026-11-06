import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  History,
  Search,
  Camera,
  Package,
  User,
  Clock,
  ArrowRightLeft,
  ArrowUpRight,
  TrendingDown,
  ShoppingCart,
  PlusCircle,
  Edit3,
  Trash2,
  Loader2,
  CheckCircle2,
  Filter,
  RotateCcw
} from 'lucide-react';
import { Product, AuditLog } from '../../types/database';
import { supabase, formatDate } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { matchesAnyField, normalizeText } from '../../utils/searchUtils';

interface ProductAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialProductId?: string | null;
}

/**
 * Normaliza y formatea el nombre o alias legible del usuario responsable
 */
function formatUserAlias(email?: string | null, userId?: string | null): string {
  if (!email || email === 'sistema' || email === 'anonimo@usuario.com') {
    return 'Sistema';
  }
  const cleanEmail = email.trim();
  const namePart = cleanEmail.split('@')[0];
  // Si contiene puntos (ej. carlos.gonzalez), capitalizar
  if (namePart.includes('.')) {
    return namePart
      .split('.')
      .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');
  }
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}

/**
 * Traduce y resume el diferencial (Diff) exacto de la acción en formato editorial
 */
function formatActionDiff(
  log: AuditLog,
  allLogs: AuditLog[] = [],
  index = 0
): {
  headline: string;
  badgeText: string;
  badgeColor: string;
  icon: React.ReactNode;
} {
  const meta = log.metadata || {};

  switch (log.action_type) {
    case 'UPDATE': {
      // 1. Si viene diff_summary en metadata
      if (Array.isArray(meta.diff_summary) && meta.diff_summary.length > 0) {
        const headline = meta.diff_summary.join(' • ');
        const hasRename = !!meta.previous_name && meta.previous_name !== meta.new_name;
        const hasCategory = !!meta.previous_category || !!meta.new_category;
        const badgeText = hasRename ? 'Renombre' : hasCategory ? 'Categoría' : 'Edición';
        const badgeColor = hasRename
          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
          : hasCategory
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
        return {
          headline,
          badgeText,
          badgeColor,
          icon: <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        };
      }

      // 2. Si details ya contiene un resumen de cambios (contiene • o Renombró)
      if (log.details && (log.details.includes('Renombró') || log.details.includes('Cambió categoría') || log.details.includes(' • '))) {
        const isRename = log.details.includes('Renombró');
        return {
          headline: log.details,
          badgeText: isRename ? 'Renombre' : 'Edición',
          badgeColor: isRename
            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
            : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
          icon: <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        };
      }

      // 3. Si vienen previous_name y new_name en metadata
      if (meta.previous_name && meta.new_name && meta.previous_name !== meta.new_name) {
        let headline = `Renombró '${meta.previous_name}' por '${meta.new_name}'`;
        if (meta.new_category) {
          headline += ` • Categoría: '${meta.new_category}'`;
        }
        return {
          headline,
          badgeText: 'Renombre',
          badgeColor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
          icon: <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        };
      }

      // 4. Si cambió categoría en metadata
      if (meta.previous_category || meta.new_category) {
        const headline = meta.previous_category && meta.new_category
          ? `Cambió categoría: de '${meta.previous_category}' a '${meta.new_category}'`
          : `Asignó categoría '${meta.new_category || meta.previous_category}'`;
        return {
          headline,
          badgeText: 'Categoría',
          badgeColor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          icon: <Edit3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        };
      }

      // 5. Inferencia retrospectiva para logs legados (comparando con el evento anterior de este producto)
      if (allLogs && index < allLogs.length - 1) {
        const olderLog = allLogs.slice(index + 1).find(l => l.product_id === log.product_id && l.product_name);
        if (olderLog && olderLog.product_name && olderLog.product_name.trim() !== (log.product_name || '').trim()) {
          return {
            headline: `Renombró '${olderLog.product_name}' por '${log.product_name}'`,
            badgeText: 'Renombre',
            badgeColor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
            icon: <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          };
        }
      }

      // 6. Cambio de precio
      if (meta.previous_price !== undefined && meta.new_price !== undefined && Number(meta.previous_price) !== Number(meta.new_price)) {
        return {
          headline: `Actualización de precio: de S/ ${meta.previous_price} a S/ ${meta.new_price}`,
          badgeText: 'Precio',
          badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          icon: <Edit3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        };
      }

      // 7. Cambio de stock por ajuste directo
      if (meta.previous_stock !== undefined && meta.new_stock !== undefined && Number(meta.previous_stock) !== Number(meta.new_stock)) {
        const diff = Number(meta.new_stock) - Number(meta.previous_stock);
        const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
        return {
          headline: `Ajuste de stock: ${diffLabel} unidades (Anterior: ${meta.previous_stock}, Nuevo: ${meta.new_stock})`,
          badgeText: 'Ajuste Stock',
          badgeColor: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
          icon: <ArrowRightLeft className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
        };
      }

      // 8. Sanitización de texto legado
      let headline = log.details || 'Ficha técnica actualizada';
      if (headline.includes('Producto actualizado por')) {
        headline = 'Actualización de ficha técnica y parámetros del producto';
      }

      return {
        headline,
        badgeText: 'Edición',
        badgeColor: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
        icon: <Edit3 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
      };
    }

    default:
      return {
        headline: log.details || 'Movimiento registrado en auditoría',
        badgeText: log.action_type || 'Registro',
        badgeColor: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
        icon: <History className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
      };
  }
}

export const ProductAuditModal: React.FC<ProductAuditModalProps> = ({
  isOpen,
  onClose,
  products,
  initialProductId = null
}) => {
  const { currentInventory } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDebouncedLoading, setShowDebouncedLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isSearchingInput, setIsSearchingInput] = useState(false);
  const [scanNotification, setScanNotification] = useState<string | null>(null);

  // Auto-selección si se pasa un ID inicial al abrir
  useEffect(() => {
    if (isOpen) {
      if (initialProductId) {
        const found = products.find(p => p.id === initialProductId);
        if (found) {
          setSelectedProduct(found);
          setSearchQuery(found.name);
        }
      } else {
        setSelectedProduct(null);
        setSearchQuery('');
      }
    }
  }, [isOpen, initialProductId, products]);

  // Carga de historial SOLO cuando hay un producto seleccionado (sin pre-carga global)
  useEffect(() => {
    if (!isOpen || !currentInventory || !selectedProduct) {
      setAuditLogs([]);
      setLoading(false);
      setShowDebouncedLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    // Feedback visual sutil solo si la consulta demora más de 200ms
    const debounceTimer = setTimeout(() => {
      if (isMounted) setShowDebouncedLoading(true);
    }, 200);

    const query = supabase
      .from('audit_logs')
      .select('*')
      .eq('inventory_id', currentInventory.id)
      .eq('product_id', selectedProduct.id)
      .order('created_at', { ascending: false })
      .limit(50);

    query.then(({ data, error }) => {
      clearTimeout(debounceTimer);
      if (!isMounted) return;
      if (!error && data) {
        setAuditLogs(data as AuditLog[]);
      } else {
        setAuditLogs([]);
      }
      setLoading(false);
      setShowDebouncedLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(debounceTimer);
    };
  }, [isOpen, currentInventory, selectedProduct]);

  // Sugerencias de productos coincidentes mientras se tipea (RF-SEARCH-016: Tolerancia a acentos)
  const matchingProducts = useMemo(() => {
    const norm = normalizeText(searchQuery);
    if (!norm) return [];
    return products
      .filter(p => matchesAnyField([p.name, p.code, p.sku], norm))
      .slice(0, 5);
  }, [searchQuery, products]);

  // Selección de producto
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setIsSearchingInput(false);
  };

  // Limpiar selección de producto y volver a ver auditoría general
  const handleClearSelection = () => {
    setSelectedProduct(null);
    setSearchQuery('');
    setIsSearchingInput(false);
    setAuditLogs([]);
  };

  // Manejo de lectura exitosa desde la cámara
  const handleScanSuccess = async (decodedText: string) => {
    const raw = decodedText.trim();
    setScannerOpen(false);

    // 1. Buscar en lista en memoria
    const match = products.find(p => {
      const c = (p.code || '').toLowerCase();
      const s = (p.sku || '').toLowerCase();
      const target = raw.toLowerCase();
      return c === target || s === target || p.id === raw;
    });

    if (match) {
      setSelectedProduct(match);
      setSearchQuery(match.name);
      setScanNotification(`Producto detectado: ${match.name}`);
      setTimeout(() => setScanNotification(null), 3000);
      return;
    }

    // 2. Fallback de red en Supabase si no estaba en la página cargada
    if (currentInventory) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('inventory_id', currentInventory.id)
        .eq('code', raw)
        .maybeSingle();

      if (data) {
        setSelectedProduct(data as Product);
        setSearchQuery(data.name);
        setScanNotification(`Producto indexado: ${data.name}`);
        setTimeout(() => setScanNotification(null), 3000);
      } else {
        setScanNotification(`No se encontró mercancía para el código "${raw}"`);
        setTimeout(() => setScanNotification(null), 3500);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in select-none">
        <div className="mobile-dark-modal bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-t-[2.5rem] sm:rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85dvh] font-sans">
          
          {/* Cabecera Fija */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1E3A5F]/10 dark:bg-white/10 text-[#1E3A5F] dark:text-zinc-100 flex items-center justify-center shadow-xs">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight text-[#1E3A5F] dark:text-white">
                  Auditoría & Trazabilidad
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">
                  {selectedProduct
                    ? 'Kardex de movimientos del producto seleccionado'
                    : 'Consulta de trazabilidad por producto'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Bloque Fijo de Herramientas: Buscador Plano y Botón de Escáner al Mismo Nivel */}
          <div className="p-4 sm:p-5 border-b border-[#E5E7EB] dark:border-zinc-800 bg-[#F8F9FA]/60 dark:bg-zinc-900/60 shrink-0 space-y-3">
            <div className="flex items-center gap-2.5">
              
              {/* Input de Búsqueda Plano */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    setIsSearchingInput(true);
                    if (!val.trim()) {
                      setSelectedProduct(null);
                      setAuditLogs([]);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && matchingProducts.length > 0) {
                      handleSelectProduct(matchingProducts[0]);
                    }
                  }}
                  onFocus={() => setIsSearchingInput(true)}
                  placeholder="Buscar por nombre o SKU..."
                  className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 h-11 text-sm border-0 focus:outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 box-border transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                    title="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Botón de Escáner al Mismo Nivel Horizontal */}
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                title="Escanear código de barras con la cámara"
                aria-label="Escanear código de barras"
                className="h-11 w-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer shadow-xs border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                <Camera className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {/* Notificación tras escaneo */}
            {scanNotification && (
              <div className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span className="truncate">{scanNotification}</span>
              </div>
            )}

            {/* Desplegable de Sugerencias de Autocompletado */}
            {isSearchingInput && matchingProducts.length > 0 && !selectedProduct && (
              <div className="bg-white dark:bg-zinc-800 border border-[#E5E7EB] dark:border-zinc-700 rounded-2xl shadow-xl overflow-hidden divide-y divide-[#E5E7EB] dark:divide-zinc-700/60 max-h-48 overflow-y-auto z-30">
                {matchingProducts.map(prod => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleSelectProduct(prod)}
                    className="w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {prod.name}
                      </p>
                      <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                        REF: {prod.code || prod.sku || 'SIN SKU'}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-[#1E3A5F] dark:text-sky-300 shrink-0 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-900">
                      Stock: {prod.stock}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Cápsula de Producto Activo Seleccionado */}
            {selectedProduct && (
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 text-xs">
                <div className="w-7 h-7 rounded-lg bg-[#1E3A5F]/10 dark:bg-white/10 text-[#1E3A5F] dark:text-zinc-200 flex items-center justify-center shrink-0">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {selectedProduct.name}
                  </p>
                  <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                    REF: {selectedProduct.code || selectedProduct.sku || 'N/A'} • Stock: {selectedProduct.stock} {selectedProduct.unit_type === 'BOX' ? 'cajas' : 'und'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Panel de Trazabilidad y Auditoría (Kardex Detallado) con Scroll Independiente */}
          <div className="flex-1 overflow-y-auto overscroll-contain max-h-[60dvh] p-4 sm:p-5 space-y-3 bg-white dark:bg-zinc-900">
            {showDebouncedLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400 space-y-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#1E3A5F] dark:text-zinc-300" />
                <span className="text-xs font-mono uppercase tracking-wider">
                  Consultando Kardex...
                </span>
              </div>
            ) : !selectedProduct ? (
              <div className="flex flex-col items-center justify-center py-14 px-4 text-center space-y-3">
                <div className="w-14 h-14 rounded-3xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 border border-zinc-200/60 dark:border-zinc-700/60 shadow-xs">
                  <Search className="w-6 h-6 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Consulta de Trazabilidad
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">
                    Escribe el nombre o SKU en la barra de búsqueda, o usa la cámara para escanear el código de barras y auditar su historial.
                  </p>
                </div>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-4 text-center space-y-3">
                <div className="w-14 h-14 rounded-3xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 border border-zinc-200/60 dark:border-zinc-700/60">
                  <History className="w-6 h-6 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Sin movimientos registrados
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">
                    No se encontraron eventos ni movimientos registrados para{' '}
                    <strong className="text-zinc-700 dark:text-zinc-300 font-semibold">{selectedProduct.name}</strong>.
                  </p>
                </div>
              </div>
            ) : (
              auditLogs.map((log, index) => {
                const diff = formatActionDiff(log, auditLogs, index);
                const userAlias = formatUserAlias(log.user_email, log.user_id);

                return (
                  <div
                    key={log.id}
                    className="border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-800/40 rounded-2xl p-3.5 space-y-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition-colors shadow-2xs"
                  >
                    {/* Fila Superior: Badge de Acción, Usuario y Hora */}
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${diff.badgeColor}`}
                        >
                          {diff.icon}
                          <span>{diff.badgeText}</span>
                        </span>
                        {!selectedProduct && log.product_name && (
                          <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]">
                            • {log.product_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-zinc-400" />
                          <strong className="font-semibold text-zinc-700 dark:text-zinc-300">
                            {userAlias}
                          </strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Acción Exacta y Diferencial (Diff) */}
                    <p className="text-xs sm:text-sm font-medium text-zinc-800 dark:text-zinc-200 leading-snug">
                      {diff.headline}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Pie del Modal con contador de eventos */}
          <div className="px-6 py-3 border-t border-[#E5E7EB] dark:border-zinc-800 bg-[#F8F9FA]/80 dark:bg-zinc-900/80 flex items-center justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400 shrink-0">
            <span>
              {selectedProduct ? `${auditLogs.length} ${auditLogs.length === 1 ? 'registro' : 'registros'} indexados` : 'Esperando selección'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-medium transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Modal Secundario de Escáner de Cámara */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        title="ESCANEAR CÓDIGO DE AUDITORÍA"
        instructions="Enfoca el código de barras o QR para auditar la trazabilidad de la mercancía."
      />
    </>
  );
};
