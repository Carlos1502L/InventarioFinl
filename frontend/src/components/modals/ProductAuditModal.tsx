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
function formatActionDiff(log: AuditLog): {
  headline: string;
  badgeText: string;
  badgeColor: string;
  icon: React.ReactNode;
} {
  const meta = log.metadata || {};

  switch (log.action_type) {
    case 'UPDATE': {
      // Caso 1: Renombre de producto
      if (meta.previous_name && meta.new_name && meta.previous_name !== meta.new_name) {
        return {
          headline: `Renombró '${meta.previous_name}' por '${meta.new_name}'`,
          badgeText: 'Renombre',
          badgeColor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
          icon: <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        };
      }
      // Caso 2: Cambio de stock por ajuste directo
      if (meta.previous_stock !== undefined && meta.new_stock !== undefined && meta.previous_stock !== meta.new_stock) {
        const diff = Number(meta.new_stock) - Number(meta.previous_stock);
        const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
        return {
          headline: `Ajuste de stock: ${diffLabel} unidades (Anterior: ${meta.previous_stock}, Nuevo: ${meta.new_stock})`,
          badgeText: 'Ajuste Stock',
          badgeColor: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
          icon: <ArrowRightLeft className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
        };
      }
      // Caso 3: Cambio de precio
      if (meta.previous_price !== undefined && meta.new_price !== undefined && meta.previous_price !== meta.new_price) {
        return {
          headline: `Actualización de precio: de S/ ${meta.previous_price} a S/ ${meta.new_price}`,
          badgeText: 'Precio',
          badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          icon: <Edit3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        };
      }
      return {
        headline: log.details || 'Ficha técnica actualizada',
        badgeText: 'Edición',
        badgeColor: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
        icon: <Edit3 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
      };
    }

    case 'WITHDRAW': {
      const qty = meta.withdrawn_quantity || (log.details.match(/-?(\d+(\.\d+)?)/)?.[1] ?? 1);
      const unit = meta.unit_type === 'BOX' ? 'cajas' : 'unidades';
      const reason = meta.reason
        ? ` (Motivo: ${meta.reason})`
        : log.details.includes('motivo:')
        ? ` (Motivo: ${log.details.split('motivo:')[1]?.trim().replace(/["\.]/g, '')})`
        : '';
      return {
        headline: `Descuento por merma: ${qty} ${unit}${reason}`,
        badgeText: 'Merma / Baja',
        badgeColor: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        icon: <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
      };
    }

    case 'SALE': {
      const qty = meta.quantity || 1;
      const unit = meta.unit_type === 'BOX' ? 'cajas' : 'unidad';
      const ticket =
        meta.ticket_number ||
        meta.receipt_number ||
        (meta.sale_id ? String(meta.sale_id).slice(-4) : 'POS');
      return {
        headline: `Venta registrada: -${qty} ${unit} (Ticket #${ticket})`,
        badgeText: 'Venta',
        badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        icon: <ShoppingCart className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      };
    }

    case 'MOVE': {
      const qty = meta.quantity_moved || 1;
      const unit = meta.unit_type === 'BOX' ? 'cajas' : 'unidades';
      const fromLoc = meta.from_location_name || 'Origen';
      const toLoc = meta.to_location_name || 'Destino';
      const reason = meta.reason ? ` (Motivo: ${meta.reason})` : '';
      return {
        headline: `Traslado: ${qty} ${unit} de '${fromLoc}' a '${toLoc}'${reason}`,
        badgeText: 'Traslado',
        badgeColor: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200 dark:border-violet-800',
        icon: <ArrowRightLeft className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
      };
    }

    case 'RESTOCK': {
      const qty = meta.quantity || meta.added_quantity || 1;
      const unit = meta.unit_type === 'BOX' ? 'cajas' : 'unidades';
      return {
        headline: `Ingreso de stock: +${qty} ${unit}`,
        badgeText: 'Reabastecimiento',
        badgeColor: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        icon: <ArrowUpRight className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
      };
    }

    case 'CREATE': {
      return {
        headline: `Alta de producto en catálogo (Stock inicial: ${meta.initial_stock ?? 0})`,
        badgeText: 'Creación',
        badgeColor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        icon: <PlusCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
      };
    }

    case 'DELETE': {
      return {
        headline: log.details || 'Mercancía dada de baja o eliminada del inventario',
        badgeText: 'Baja Total',
        badgeColor: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800',
        icon: <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
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

  // Carga de historial cuando cambia el producto seleccionado o se abre el modal
  useEffect(() => {
    if (!isOpen || !currentInventory) return;

    let isMounted = true;
    setLoading(true);

    // Feedback visual sutil solo si la consulta demora más de 200ms
    const debounceTimer = setTimeout(() => {
      if (isMounted) setShowDebouncedLoading(true);
    }, 200);

    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('inventory_id', currentInventory.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (selectedProduct) {
      query = query.eq('product_id', selectedProduct.id);
    }

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

  // Sugerencias de productos coincidentes mientras se tipea
  const matchingProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return products
      .filter(p => {
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCode = (p.code || '').toLowerCase().includes(q);
        const matchesSku = (p.sku || '').toLowerCase().includes(q);
        return matchesName || matchesCode || matchesSku;
      })
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
                    : 'Historial global de operaciones en stock'}
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
                    setSearchQuery(e.target.value);
                    setIsSearchingInput(true);
                    if (!e.target.value.trim() && selectedProduct) {
                      setSelectedProduct(null);
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
              <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#1E3A5F]/10 dark:bg-white/10 text-[#1E3A5F] dark:text-zinc-200 flex items-center justify-center shrink-0">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {selectedProduct.name}
                    </p>
                    <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                      REF: {selectedProduct.code || selectedProduct.sku || 'N/A'} • Stock: {selectedProduct.stock} {selectedProduct.unit_type === 'BOX' ? 'cajas' : 'und'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 px-2 py-1 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-700 transition-colors ml-2 shrink-0"
                >
                  Ver todos
                </button>
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
            ) : auditLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-500 space-y-2 text-center">
                <div className="w-12 h-12 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-300 dark:text-zinc-600">
                  <History className="w-6 h-6 stroke-[1.25]" />
                </div>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {selectedProduct
                    ? 'No hay registros de movimientos para este producto.'
                    : 'No hay eventos de auditoría registrados en este inventario.'}
                </p>
                <p className="text-[11px] text-zinc-400 max-w-xs">
                  Las ventas, traslados, mermas y reabastecimientos se reflejarán automáticamente aquí.
                </p>
              </div>
            ) : (
              auditLogs.map(log => {
                const diff = formatActionDiff(log);
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
              {auditLogs.length} {auditLogs.length === 1 ? 'registro' : 'registros'} indexados
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
