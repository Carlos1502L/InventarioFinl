import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  MapPin,
  Package,
  ArrowRightLeft,
  Archive,
  Edit,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  RotateCcw,
  Loader2,
  Plus,
  Layers
} from 'lucide-react';
import { Product, Location } from '../../types/database';
import {
  supabase,
  formatCurrency,
  logAuditAction,
  formatStockDisplay,
  getBoxBreakdown,
  getPendingLocationStock,
  formatLocationQuantity
} from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { RestockProductModal } from './RestockProductModal';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onMove: (product: Product) => void;
  onAssignLocation?: (product: Product) => void;
  onWithdraw: (product: Product) => void;
  locations: Location[];
  allProducts?: Product[];
  onSelectProduct?: (product: Product) => void;
  onUpdated?: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onEdit,
  onMove,
  onAssignLocation,
  onWithdraw,
  locations,
  allProducts = [],
  onSelectProduct,
  onUpdated
}) => {
  const { currentInventory, user } = useAuth();
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isReactivating, setIsReactivating] = useState(false);
  const [restockModalOpen, setRestockModalOpen] = useState(false);

  useEffect(() => {
    if (product && isOpen) {
      setActivePhotoIdx(0);
    }
  }, [product, isOpen]);

  const relatedVariants = useMemo(() => {
    if (!product || !allProducts || allProducts.length === 0) return [];
    return allProducts.filter(p => {
      if (p.id === product.id) return false;
      if (product.parent_id && p.parent_id === product.parent_id) return true;
      if (product.parent_id && p.id === product.parent_id) return true;
      if (!product.parent_id && p.parent_id === product.id) return true;
      return false;
    });
  }, [product, allProducts]);

  const handleReactivateProduct = async () => {
    if (!product || !currentInventory) return;
    const confirmReactivation = window.confirm(
      `¿Confirmas reactivar la mercancía [REF: ${product.code}] "${product.name}" en el catálogo activo?`
    );
    if (!confirmReactivation) return;

    try {
      setIsReactivating(true);

      const { error } = await supabase
        .from('products')
        .update({
          status: 'ACTIVE',
          withdrawal_reason: null,
          last_modified_by: user?.id,
          last_modified_by_email: user?.email,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);

      if (error) throw error;

      await logAuditAction({
        inventoryId: currentInventory.id,
        productId: product.id,
        productName: product.name,
        actionType: 'UPDATE',
        details: 'Producto reactivado en catálogo activo.',
        metadata: {
          previous_status: product.status,
          new_status: 'ACTIVE',
          reactivated_by: user?.email
        }
      });

      if (onUpdated) onUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error reactivando producto:', err);
      alert('Error reactivando el producto: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsReactivating(false);
    }
  };

  if (!isOpen || !product) return null;

  const photos = product.images && product.images.length > 0 ? product.images : [];
  const currentLocation = locations.find(l => l.id === product.location_id);
  const isInactive = product.status === 'INACTIVE' || product.status === 'WITHDRAWN';
  const isLowStock =
    !isInactive &&
    product.stock < (product.min_stock !== undefined && product.min_stock !== null ? product.min_stock : 1);
  const totalItemValuation = (product.price || 0) * (product.stock || 0);
  const boxBreakdown = getBoxBreakdown(product);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 max-md:bg-black/75 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
        <div className="mobile-dark-modal bg-[#ffffff] border border-[#ececec] rounded-2xl md:rounded-3xl w-full max-w-4xl my-auto overflow-hidden flex flex-col max-h-[94vh] shadow-xl">
          {/* =========================================================
              HEADER // MODAL HEADER
             ========================================================= */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#ececec] bg-white sticky top-0 z-20">
            <div className="min-w-0">
              <div className="md:hidden mb-1">
                <h3 className="text-lg font-bold tracking-tight text-neutral-900 truncate">{product.name}</h3>
                <p className="text-xs text-neutral-500">SKU {product.code} · {formatStockDisplay(product)}</p>
              </div>
              <div className="hidden md:flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-800 px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 font-semibold">
                  {product.code}
                </span>
                <span className="font-mono text-[10px] px-2.5 py-1 rounded-md bg-slate-900 text-white flex items-center gap-1 font-medium">
                  <Layers className="w-3 h-3 text-white" />
                  {product.unit_type === 'BOX' ? `BOX · ${product.units_per_box || 1} UND` : 'UNIT'}
                </span>
                {isInactive ? (
                  <span className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-600 font-medium">
                    Retirado
                  </span>
                ) : isLowStock ? (
                  <span className="text-[11px] px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                    Stock crítico
                  </span>
                ) : (
                  <span className="text-[11px] px-2.5 py-1 rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Activo
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setRestockModalOpen(true)}
                className="mobile-header-tab min-h-[38px] max-md:min-h-0 max-md:h-8 max-md:px-3 max-md:bg-neutral-100 max-md:text-neutral-800 max-md:border-0 px-3.5 rounded-full bg-[#17191c] hover:bg-black text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm"
                title="Añadir más existencias (Reingreso de Stock)"
              >
                <Plus className="w-3.5 h-3.5 text-white max-md:text-neutral-800" />
                <span className="hidden sm:inline">REINGRESO</span>
              </button>
              <button
                onClick={() => onEdit(product)}
                className="mobile-header-tab min-h-[38px] max-md:min-h-0 max-md:h-8 max-md:px-3 max-md:bg-neutral-100 max-md:text-neutral-800 max-md:border-0 px-4 rounded-full border border-[#ececec] hover:border-[#17191c] text-[#17191c] text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors bg-white shadow-sm"
                title="Modificar especificación técnica"
              >
                <Edit className="w-3.5 h-3.5 text-[#17191c] max-md:text-neutral-800" />
                <span className="hidden sm:inline">EDITAR</span>
              </button>
              <button
                onClick={onClose}
                className="min-h-[38px] min-w-[38px] rounded-full border border-[#ececec] hover:border-[#17191c] text-[#17191c] flex items-center justify-center transition-colors bg-white shadow-sm"
                title="Cerrar ficha"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* =========================================================
              BODY // 50/50 MODULAR SPLIT (MOBILE FIRST STACK)
             ========================================================= */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
            {/* Alerta de Retiro / Inactividad */}
            {isInactive && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono uppercase tracking-wider">
                <div className="flex items-start sm:items-center gap-2 text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5 sm:mt-0" />
                  <span>
                    MERCANCÍA DADA DE BAJA {product.withdrawal_reason ? `// MOTIVO: "${product.withdrawal_reason}"` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleReactivateProduct}
                  disabled={isReactivating}
                  className="shrink-0 min-h-[38px] px-5 bg-[#17191c] hover:bg-black text-white rounded-full flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  {isReactivating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 text-white" />
                  )}
                  <span>REACTIVAR ÍTEM</span>
                </button>
              </div>
            )}

            {/* Grilla Principal 50/50 Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* COLUMNA IZQUIERDA: GALERÍA */}
              <div className="space-y-3">
                <div className="relative aspect-square sm:aspect-[4/3] bg-[#fafafb] border border-[#ececec] rounded-2xl flex items-center justify-center overflow-hidden">
                  {photos.length > 0 ? (
                    <img
                      src={photos[activePhotoIdx]}
                      alt={product.name}
                      className="w-full h-full object-contain p-2"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="text-center p-6 font-mono text-[#777b86]">
                      <Package className="w-12 h-12 stroke-[1] text-[#17191c]/30 mx-auto mb-2" />
                      <p className="text-[10px] uppercase tracking-widest text-[#777b86]">
                        SIN MUESTRA FOTOGRÁFICA REGISTRADA
                      </p>
                    </div>
                  )}

                  {/* Controles de navegación en galería */}
                  {photos.length > 1 && (
                    <div className="absolute inset-x-2 bottom-2 flex items-center justify-between pointer-events-none">
                      <button
                        onClick={() => setActivePhotoIdx(prev => (prev > 0 ? prev - 1 : photos.length - 1))}
                        className="pointer-events-auto min-h-[36px] min-w-[36px] rounded-full bg-white/90 backdrop-blur-sm border border-[#ececec] hover:bg-[#17191c] hover:text-white text-[#17191c] flex items-center justify-center transition-all shadow-sm"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="font-mono text-[10px] px-3 py-1 rounded-full bg-[#17191c] text-white">
                        {activePhotoIdx + 1} / {photos.length}
                      </span>
                      <button
                        onClick={() => setActivePhotoIdx(prev => (prev < photos.length - 1 ? prev + 1 : 0))}
                        className="pointer-events-auto min-h-[36px] min-w-[36px] rounded-full bg-white/90 backdrop-blur-sm border border-[#ececec] hover:bg-[#17191c] hover:text-white text-[#17191c] flex items-center justify-center transition-all shadow-sm"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Thumbnails en Píldora / Hairline */}
                {photos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                    {photos.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setActivePhotoIdx(i)}
                        className={`w-16 h-16 rounded-xl border flex-shrink-0 transition-[border-color,opacity] duration-150 p-0.5 bg-white overflow-hidden cursor-pointer ${
                          activePhotoIdx === i
                            ? 'border-slate-900 ring-2 ring-slate-900/15'
                            : 'border-slate-200 opacity-65 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt={`Muestra ${i + 1}`} className="w-full h-full object-cover rounded-lg" loading="lazy" decoding="async" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Código de Identificación */}
                <div className="border border-[#ececec] rounded-xl p-3 bg-[#fafafb] font-mono text-xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#777b86] uppercase tracking-wider block">
                      CÓDIGO DE IDENTIFICACIÓN
                    </span>
                    <span className="text-[#17191c] font-semibold uppercase tracking-wider">{product.code}</span>
                  </div>

                </div>
              </div>

              {/* COLUMNA DERECHA: ESPECIFICACIONES TÉCNICAS */}
              <div className="space-y-5">
                <div>
                  <p className="font-mono text-[11px] text-slate-500 mb-1 font-medium">
                    {product.categories?.name || 'Catálogo general'}
                  </p>
                  <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-[#17191c]">
                    {product.name}
                  </h2>
                  {product.description && (
                    <p className="text-xs text-[#777b86] mt-2 font-light leading-relaxed uppercase border-l-2 border-[#e5e5e5] pl-3 py-0.5">
                      {product.description}
                    </p>
                  )}
                </div>

                {/* Matriz de Parámetros Técnicos */}
                <div className="mobile-flat-section border border-[#ececec] rounded-2xl overflow-hidden divide-y divide-[#E5E7EB] max-md:divide-neutral-100 font-mono text-xs shadow-sm">
                  {/* Precio Unitario */}
                  <div className="mobile-flat-row p-3.5 flex items-center justify-between bg-white">
                    <span className="text-[10px] text-[#777b86] uppercase tracking-wider">
                      PRECIO DE SALIDA
                    </span>
                    <span className="text-base sm:text-lg font-bold tabular-nums text-[#17191c]">
                      {formatCurrency(product.price, currentInventory?.currency)}
                    </span>
                  </div>

                  {/* Unidad de Medida */}
                  <div className="mobile-flat-row p-3.5 flex items-center justify-between bg-white">
                    <span className="text-[10px] text-[#777b86] uppercase tracking-wider">
                      UNIDAD DE MEDIDA
                    </span>
                    <span className="text-[#17191c] font-bold uppercase">
                      {product.unit_type === 'BOX'
                        ? `CAJA (1 caja = ${product.units_per_box || 1} unidades)`
                        : 'UNIDAD (UND)'}
                    </span>
                  </div>

                  {/* Stock Actual y Alerta */}
                  <div className="mobile-flat-row p-3.5 flex items-center justify-between bg-white">
                    <span className="text-[10px] text-[#777b86] uppercase tracking-wider">
                      VOLUMEN EN ALMACÉN
                    </span>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-base font-bold tabular-nums text-[#17191c]">
                          {formatStockDisplay(product)}
                        </span>
                        <span className="text-[10px] text-[#777b86] uppercase">
                          (MÍN: {product.min_stock || 1})
                        </span>
                      </div>
                      {boxBreakdown.isBox && boxBreakdown.breakdownLabel && (
                        <span className="text-[10px] text-[#777b86] block">
                          {boxBreakdown.breakdownLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Valuación Total del Ítem */}
                  <div className="mobile-flat-row p-3.5 flex items-center justify-between bg-white">
                    <span className="text-[10px] text-[#777b86] uppercase tracking-wider">
                      VALOR TOTAL DE EXISTENCIAS
                    </span>
                    <span className="text-sm font-bold tabular-nums text-[#17191c]">
                      {formatCurrency(totalItemValuation, currentInventory?.currency)}
                    </span>
                  </div>

                  {/* Distribución Física Multi-Ubicación */}
                  <div className="mobile-flat-row p-3.5 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#777b86] uppercase tracking-wider">
                        DISTRIBUCIÓN FÍSICA // ALMACENES
                      </span>
                      {getPendingLocationStock(product) > 0.0001 && onAssignLocation && (
                        <button
                          type="button"
                          onClick={() => onAssignLocation(product)}
                          className="mobile-inline-btn text-[10px] font-bold uppercase text-[#17191c] bg-[#f5f5f5] hover:bg-[#f5f5f5]/50 px-2.5 py-0.5 rounded-full transition-colors"
                        >
                          + Asignar Ubicación
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {(product.product_locations || [])
                        .filter(pl => Number(pl.quantity || 0) > 0.0001)
                        .map(pl => (
                          <div
                            key={pl.id}
                            className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#fafafb] border border-[#ececec] text-xs"
                          >
                            <span className="text-[#17191c] font-bold uppercase flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[#17191c]" />
                              {pl.locations?.name || 'Estante'} [{pl.locations?.code || 'LOC'}]
                            </span>
                            <span className="font-bold text-[#17191c]">
                              {formatLocationQuantity(pl.quantity, product)}
                            </span>
                          </div>
                        ))}

                      {getPendingLocationStock(product) > 0.0001 && (
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-xs">
                          <span className="text-[#17191c] font-bold uppercase">
                            Sin Ubicación Asignada / En Recepción
                          </span>
                          <span className="font-bold text-[#17191c]">
                            {formatLocationQuantity(getPendingLocationStock(product), product)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Categoría y Subcategoría */}
                  <div className="mobile-flat-row p-3.5 flex items-center justify-between bg-white">
                    <span className="text-[10px] text-[#777b86] uppercase tracking-wider">
                      CLASIFICACIÓN TÉCNICA
                    </span>
                    <span className="text-[#17191c] uppercase font-bold">
                      {product.categories?.name || 'GENERAL'}
                      {product.subcategories?.name && ` // ${product.subcategories.name}`}
                    </span>
                  </div>
                </div>

                {/* Botones de Acción Operativa */}
                <div className="space-y-2 pt-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => onMove(product)}
                      className="mobile-primary-btn flex-1 min-h-[42px] px-4 rounded-xl border border-slate-900 hover:bg-slate-900 hover:text-white text-slate-900 text-xs font-semibold flex items-center justify-center gap-2 transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Trasladar ubicación</span>
                    </button>

                    {!isInactive ? (
                      <button
                        onClick={() => onWithdraw(product)}
                        className="flex-1 min-h-[44px] px-5 rounded-full max-md:rounded-2xl border border-[#ececec] hover:border-[#17191c] text-[#777b86] hover:text-[#17191c] text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-white shadow-sm"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>DESCONTAR / MERMA</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleReactivateProduct}
                        disabled={isReactivating}
                        className="flex-1 min-h-[44px] px-5 rounded-full max-md:rounded-2xl bg-[#17191c] hover:bg-black text-white text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm"
                      >
                        {isReactivating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>REACTIVAR MERCANCÍA</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* =========================================================
                VARIACIONES ASOCIADAS (SI APLICA)
               ========================================================= */}
            {relatedVariants.length > 0 && (
              <div className="border border-[#ececec] rounded-2xl p-4 sm:p-5 space-y-3 bg-[#ffffff] shadow-sm">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-xs uppercase tracking-wider text-[#17191c] flex items-center gap-1.5 font-medium">
                    <GitBranch className="w-4 h-4 text-[#17191c]" />
                    VARIANTES REGISTRADAS DE LA FAMILIA ({relatedVariants.length})
                  </span>
                  <span className="text-[10px] text-[#777b86] uppercase">TOCA PARA CAMBIAR DE FICHA</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
                  {relatedVariants.map(v => {
                    const vInactive = v.status === 'INACTIVE' || v.status === 'WITHDRAWN';
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => onSelectProduct?.(v)}
                        className="p-3 border border-[#ececec] hover:border-[#17191c] rounded-xl bg-white hover:bg-[#fafafb] text-left transition-all active:scale-[0.98] flex items-center justify-between group shadow-sm"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs uppercase tracking-wide text-[#17191c] group-hover:underline truncate font-bold">
                            {v.name}
                          </p>
                          <span className="text-[10px] text-[#777b86] uppercase tracking-wider block mt-0.5">
                            REF: {v.code}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-light tabular-nums text-[#17191c] block">
                            {formatCurrency(v.price, currentInventory?.currency)}
                          </span>
                          <span
                            className={`text-[10px] ${
                              vInactive
                                ? 'text-[#777b86]'
                                : v.stock < (v.min_stock !== undefined && v.min_stock !== null ? v.min_stock : 1)
                                  ? 'text-red-700 bg-red-50 px-2 py-0.5 rounded-md font-semibold border border-red-200 tabular-nums'
                                  : 'text-slate-900 tabular-nums'
                            }`}
                          >
                            {vInactive ? 'BAJA' : formatStockDisplay(v)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Reingreso de Stock desde la Ficha Técnica */}
      <RestockProductModal
        product={product}
        isOpen={restockModalOpen}
        onClose={() => setRestockModalOpen(false)}
        onRestocked={() => {
          setRestockModalOpen(false);
          if (onUpdated) onUpdated();
          onClose();
        }}
      />
    </>
  );
};
