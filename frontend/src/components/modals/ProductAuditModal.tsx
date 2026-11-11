import React, { useState, useEffect, useMemo } from 'react';
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
  CheckCircle2
} from 'lucide-react';
import { Product, AuditLog } from '../../types/database';
import { supabase, formatDate } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { CancelButton } from '../common/CancelButton';
import { matchesAnyField, normalizeText } from '../../utils/searchUtils';
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  modalFieldInputClass
} from './ModalShell';

interface ProductAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialProductId?: string | null;
}

/**
 * Resuelve el nombre completo registrado del usuario responsable
 */
function resolveUserDisplayName(
  log: AuditLog,
  userNamesMap: Record<string, string>,
  currentUser?: any
): string {
  // 1. Si viene en metadata.user_full_name
  if (log.metadata?.user_full_name && typeof log.metadata.user_full_name === 'string' && log.metadata.user_full_name.trim()) {
    return log.metadata.user_full_name.trim();
  }

  // 2. Si coincide con el usuario actualmente autenticado
  if (currentUser) {
    const isCurrentUser = (log.user_id && log.user_id === currentUser.id) ||
      (log.user_email && log.user_email.toLowerCase() === currentUser.email?.toLowerCase());
    if (isCurrentUser) {
      const metaName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name;
      if (metaName && typeof metaName === 'string' && metaName.trim()) {
        return metaName.trim();
      }
    }
  }

  // 3. Buscar en el mapa de perfiles cargados por ID
  if (log.user_id && userNamesMap[log.user_id]) {
    return userNamesMap[log.user_id];
  }

  // 4. Buscar en el mapa de perfiles cargados por Email
  if (log.user_email && userNamesMap[log.user_email.toLowerCase()]) {
    return userNamesMap[log.user_email.toLowerCase()];
  }

  // 5. Casos especiales de sistema / anónimo
  if (!log.user_email || log.user_email === 'sistema' || log.user_email === 'anonimo@usuario.com') {
    return 'Sistema';
  }

  // 6. Si no hay nombre registrado disponible, capitalizar nombre derivado del correo
  const cleanEmail = log.user_email.trim();
  const namePart = cleanEmail.split('@')[0];
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
 * Garantiza estructura uniforme sea realizada por dueño o colaborador
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
    case 'CREATE': {
      let headline = log.details || 'Producto registrado en el catálogo';
      headline = headline.replace(/\s+por\s+[\w.-]+@[\w.-]+/gi, '');
      return {
        headline,
        badgeText: 'Creación',
        badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        icon: <PlusCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      };
    }

    case 'RESTOCK': {
      let headline = log.details || 'Reingreso de mercancía al stock';
      headline = headline.replace(/\s+por\s+[\w.-]+@[\w.-]+/gi, '');
      return {
        headline,
        badgeText: 'Reabastecimiento',
        badgeColor: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        icon: <ArrowUpRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
      };
    }

    case 'WITHDRAW': {
      let headline = log.details || 'Salida de mercancía o merma descontada';
      headline = headline.replace(/\s+por\s+[\w.-]+@[\w.-]+/gi, '');
      return {
        headline,
        badgeText: 'Descuento / Merma',
        badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        icon: <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
      };
    }

    case 'MOVE': {
      let headline = log.details || 'Traslado físico de ubicación';
      headline = headline.replace(/\s+por\s+[\w.-]+@[\w.-]+/gi, '');
      return {
        headline,
        badgeText: 'Traslado',
        badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        icon: <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400 shrink-0" />
      };
    }

    case 'SALE': {
      let headline = log.details || 'Venta registrada en punto de venta';
      headline = headline.replace(/\s+por\s+[\w.-]+@[\w.-]+/gi, '');
      return {
        headline,
        badgeText: 'Venta',
        badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        icon: <ShoppingCart className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      };
    }

    case 'DELETE': {
      let headline = log.details || 'Producto eliminado del catálogo';
      headline = headline.replace(/\s+por\s+[\w.-]+@[\w.-]+/gi, '');
      return {
        headline,
        badgeText: 'Baja',
        badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        icon: <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
      };
    }

    case 'UPDATE': {
      // 1. Si viene diff_summary en metadata
      if (Array.isArray(meta.diff_summary) && meta.diff_summary.length > 0) {
        const headline = meta.diff_summary.join(' • ');
        const hasRename = !!meta.previous_name && meta.previous_name !== meta.new_name;
        const hasCategory = !!meta.previous_category || !!meta.new_category;
        const badgeText = hasRename ? 'Renombre' : hasCategory ? 'Categoría' : 'Edición';
        const badgeColor = hasRename
          ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
          : hasCategory
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-slate-800 text-slate-300 border-slate-700';
        return {
          headline,
          badgeText,
          badgeColor,
          icon: <Edit3 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        };
      }

      // 2. Si details ya contiene un resumen de cambios (contiene • o Renombró)
      if (log.details && (log.details.includes('Renombró') || log.details.includes('Cambió categoría') || log.details.includes(' • '))) {
        const isRename = log.details.includes('Renombró');
        let headline = log.details.replace(/\s+por\s+[\w.-]+@[\w.-]+/gi, '');
        return {
          headline,
          badgeText: isRename ? 'Renombre' : 'Edición',
          badgeColor: isRename
            ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
            : 'bg-slate-800 text-slate-300 border-slate-700',
          icon: <Edit3 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
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
          badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
          icon: <Edit3 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
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
          badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          icon: <Edit3 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        };
      }

      // 5. Inferencia retrospectiva para logs legados (comparando con el evento anterior de este producto)
      if (allLogs && index < allLogs.length - 1) {
        const olderLog = allLogs.slice(index + 1).find(l => l.product_id === log.product_id && l.product_name);
        if (olderLog && olderLog.product_name && olderLog.product_name.trim() !== (log.product_name || '').trim()) {
          return {
            headline: `Renombró '${olderLog.product_name}' por '${log.product_name}'`,
            badgeText: 'Renombre',
            badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
            icon: <Edit3 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          };
        }
      }

      // 6. Cambio de precio
      if (meta.previous_price !== undefined && meta.new_price !== undefined && Number(meta.previous_price) !== Number(meta.new_price)) {
        return {
          headline: `Actualización de precio: de S/ ${meta.previous_price} a S/ ${meta.new_price}`,
          badgeText: 'Precio',
          badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          icon: <Edit3 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        };
      }

      // 7. Cambio de stock por ajuste directo
      if (meta.previous_stock !== undefined && meta.new_stock !== undefined && Number(meta.previous_stock) !== Number(meta.new_stock)) {
        const diff = Number(meta.new_stock) - Number(meta.previous_stock);
        const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
        return {
          headline: `Ajuste de stock: ${diffLabel} unidades (Anterior: ${meta.previous_stock}, Nuevo: ${meta.new_stock})`,
          badgeText: 'Ajuste Stock',
          badgeColor: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
          icon: <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        };
      }

      // 8. Sanitización de texto legado
      let headline = log.details || 'Ficha técnica actualizada';
      if (headline.includes('Producto actualizado por') || headline.includes('Actualización de ficha técnica por')) {
        headline = 'Actualización de ficha técnica y parámetros del producto';
      }
      headline = headline.replace(/\s+por\s+[\w.-]+@[\w.-]+/gi, '');

      return {
        headline,
        badgeText: 'Edición',
        badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
        icon: <Edit3 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      };
    }

    default: {
      let headline = log.details || 'Movimiento registrado en auditoría';
      headline = headline.replace(/\s+por\s+[\w.-]+@[\w.-]+/gi, '');
      return {
        headline,
        badgeText: log.action_type || 'Registro',
        badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
        icon: <History className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      };
    }
  }
}

export const ProductAuditModal: React.FC<ProductAuditModalProps> = ({
  isOpen,
  onClose,
  products,
  initialProductId = null
}) => {
  const { currentInventory, user } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [userNamesMap, setUserNamesMap] = useState<Record<string, string>>({});
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

    query.then(async ({ data, error }) => {
      clearTimeout(debounceTimer);
      if (!isMounted) return;
      if (!error && data) {
        setAuditLogs(data as AuditLog[]);

        // Cargar nombres completos registrados desde la tabla profiles
        const ids = Array.from(new Set(data.map((l: any) => l.user_id).filter(Boolean))) as string[];
        const emails = Array.from(new Set(data.map((l: any) => l.user_email).filter((e: any) => e && e.includes('@')))) as string[];

        try {
          const newMap: Record<string, string> = {};

          if (user) {
            const myFullName = user.user_metadata?.full_name || user.user_metadata?.name;
            if (myFullName) {
              newMap[user.id] = myFullName;
              if (user.email) newMap[user.email.toLowerCase()] = myFullName;
            }
          }

          if (ids.length > 0) {
            const { data: profsById } = await supabase
              .from('profiles')
              .select('id, email, full_name')
              .in('id', ids);

            if (profsById) {
              profsById.forEach(p => {
                if (p.full_name) {
                  newMap[p.id] = p.full_name;
                  if (p.email) newMap[p.email.toLowerCase()] = p.full_name;
                }
              });
            }
          }

          if (emails.length > 0) {
            const { data: profsByEmail } = await supabase
              .from('profiles')
              .select('id, email, full_name')
              .in('email', emails);

            if (profsByEmail) {
              profsByEmail.forEach(p => {
                if (p.full_name) {
                  newMap[p.id] = p.full_name;
                  if (p.email) newMap[p.email.toLowerCase()] = p.full_name;
                }
              });
            }
          }

          if (isMounted && Object.keys(newMap).length > 0) {
            setUserNamesMap(prev => ({ ...prev, ...newMap }));
          }
        } catch (err) {
          console.warn('Error resolviendo perfiles de auditoría:', err);
        }
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

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="lg"
        ariaLabel="Auditoría y trazabilidad de producto"
      >
        <ModalHeader
          title="Auditoría & Trazabilidad"
          subtitle={
            selectedProduct
              ? 'Kardex de movimientos del producto seleccionado'
              : 'Consulta de trazabilidad por producto'
          }
          icon={<History className="w-5 h-5" />}
          iconTone="indigo"
          onClose={onClose}
        />

        {/* Bloque Fijo de Herramientas: Buscador y Botón de Escáner */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800/80 bg-slate-950/40 shrink-0 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                className={`${modalFieldInputClass} pl-10 pr-10`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              title="Escanear código de barras con la cámara"
              aria-label="Escanear código de barras"
              className="min-h-[44px] lg:min-h-[40px] px-3.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border border-indigo-500/30 flex items-center gap-1.5 text-xs font-semibold transition-[background-color,transform] duration-150 active:scale-[0.97] shrink-0 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-indigo-300 shrink-0" />
              <span className="hidden sm:inline">Escanear</span>
            </button>
          </div>

          {scanNotification && (
            <div className="px-3.5 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-xs text-indigo-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-400" />
              <span className="truncate">{scanNotification}</span>
            </div>
          )}

          {isSearchingInput && matchingProducts.length > 0 && !selectedProduct && (
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-800/80 max-h-48 overflow-y-auto custom-scrollbar-dark">
              {matchingProducts.map(prod => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => handleSelectProduct(prod)}
                  className="w-full min-h-[44px] px-4 py-2.5 text-left flex items-center justify-between hover:bg-slate-800/70 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-slate-100 truncate">
                      {prod.name}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400 truncate">
                      REF: {prod.code || prod.sku || 'SIN SKU'}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] font-medium text-sky-300 shrink-0 bg-sky-500/15 px-2.5 py-0.5 rounded-full border border-sky-500/30 tabular-nums">
                    Stock: {prod.stock}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selectedProduct && (
            <div className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-100 truncate">
                    {selectedProduct.name}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 truncate tabular-nums">
                    REF: {selectedProduct.code || selectedProduct.sku || 'N/A'} · Stock: {selectedProduct.stock}{' '}
                    {selectedProduct.unit_type === 'BOX' ? 'cajas' : 'und'}
                  </p>
                </div>
              </div>

              <div className="shrink-0 pl-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 font-mono text-[11px] font-semibold text-slate-200 whitespace-nowrap tabular-nums">
                  Eventos: {auditLogs.length}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Panel de Trazabilidad y Auditoría (Kardex Detallado) */}
        <ModalBody className="space-y-3">
          {showDebouncedLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2.5">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              <span className="text-xs font-mono text-slate-400">
                Consultando Kardex...
              </span>
            </div>
          ) : !selectedProduct ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/70 flex items-center justify-center text-slate-400 border border-slate-700/70">
                <Search className="w-6 h-6 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-100">
                  Consulta de trazabilidad
                </p>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Escribe el nombre o SKU en la barra de búsqueda, o usa la cámara para escanear el código de barras y auditar su historial.
                </p>
              </div>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/70 flex items-center justify-center text-slate-400 border border-slate-700/70">
                <History className="w-6 h-6 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-100">
                  Sin movimientos registrados
                </p>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  No se encontraron eventos ni movimientos registrados para{' '}
                  <strong className="text-slate-200 font-semibold">{selectedProduct.name}</strong>.
                </p>
              </div>
            </div>
          ) : (
            auditLogs.map((log, index) => {
              const diff = formatActionDiff(log, auditLogs, index);
              const userFullName = resolveUserDisplayName(log, userNamesMap, user);

              return (
                <div
                  key={log.id}
                  className="border border-slate-800/80 bg-slate-950/60 hover:bg-slate-900/75 rounded-2xl p-3.5 space-y-2 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${diff.badgeColor} shrink-0`}
                    >
                      {diff.icon}
                      <span>{diff.badgeText}</span>
                    </span>
                    {!selectedProduct && log.product_name && (
                      <span className="text-xs font-medium text-slate-300 truncate max-w-[180px]">
                        · {log.product_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium text-slate-200 text-left min-w-0">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <strong className="font-semibold truncate">{userFullName}</strong>
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400 shrink-0 text-right tabular-nums">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      {formatDate(log.created_at)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm font-medium text-slate-200 leading-snug">
                    {diff.headline}
                  </p>
                </div>
              );
            })
          )}
        </ModalBody>

        <ModalFooter>
          <CancelButton
            onClick={onClose}
            label="Cerrar"
            className="w-full sm:w-auto sm:min-w-[140px]"
          />
        </ModalFooter>
      </ModalShell>

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
