import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
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
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from './ModalShell';
import { CancelButton } from '../common/CancelButton';

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

  const lastProductRef = useRef<Product | null>(product);
  if (product) lastProductRef.current = product;
  const activeProduct = product ?? lastProductRef.current;

  const showModal = Boolean(isOpen && activeProduct);
  const photos = activeProduct?.images && activeProduct.images.length > 0 ? activeProduct.images : [];
  const currentLocation = locations.find(l => l.id === activeProduct?.location_id);
  const isInactive = activeProduct ? activeProduct.status === 'INACTIVE' || activeProduct.status === 'WITHDRAWN' : false;
  const isLowStock = activeProduct
    ? !isInactive &&
      activeProduct.stock < (activeProduct.min_stock !== undefined && activeProduct.min_stock !== null ? activeProduct.min_stock : 1)
    : false;
  const totalItemValuation = activeProduct ? (activeProduct.price || 0) * (activeProduct.stock || 0) : 0;
  const boxBreakdown = activeProduct ? getBoxBreakdown(activeProduct) : { isBox: false, breakdownLabel: '' };
  void currentLocation;

  return (
    <>
      <ModalShell
        isOpen={showModal}
        onClose={onClose}
        maxWidth="4xl"
        ariaLabel={activeProduct ? `Ficha técnica: ${activeProduct.name}` : 'Ficha técnica de producto'}
      >
        {activeProduct && (
          <>
            <ModalHeader
              title={activeProduct.name}
              subtitle={
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[11px] text-slate-300">{activeProduct.code}</span>
                  <span className="text-slate-600">·</span>
                  <span className="font-mono text-[11px] text-slate-300">
                    {activeProduct.unit_type === 'BOX' ? `BOX · ${activeProduct.units_per_box || 1} UND` : 'UNIT'}
                  </span>
                  <span className="text-slate-600">·</span>
                  {isInactive ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-medium">
                      Retirado
                    </span>
                  ) : isLowStock ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      Stock crítico
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Activo
                    </span>
                  )}
                </span>
              }
              icon={<Package className="w-5 h-5" />}
              iconTone={isInactive ? 'amber' : isLowStock ? 'rose' : 'indigo'}
              onClose={onClose}
              rightSlot={
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRestockModalOpen(true)}
                    className="min-h-[44px] lg:min-h-[34px] px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-[background-color,transform] duration-150 active:scale-[0.97] cursor-pointer"
                    title="Añadir más existencias (Reingreso de Stock)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reingreso</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(activeProduct)}
                    className="min-h-[44px] lg:min-h-[34px] px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer"
                    title="Modificar especificación técnica"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                </div>
              }
            />

            <ModalBody className="space-y-6">
              {/* Alerta de Retiro / Inactividad */}
              {isInactive && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start sm:items-center gap-2.5 text-rose-200">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5 sm:mt-0" />
                    <span className="font-medium leading-snug">
                      Mercancía dada de baja
                      {activeProduct.withdrawal_reason ? ` · Motivo: "${activeProduct.withdrawal_reason}"` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReactivateProduct}
                    disabled={isReactivating}
                    className="shrink-0 min-h-[44px] lg:min-h-[36px] px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.97] cursor-pointer"
                  >
                    {isReactivating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5 text-white" />
                    )}
                    <span>Reactivar ítem</span>
                  </button>
                </div>
              )}

              {/* Grilla Principal 50/50 Desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* COLUMNA IZQUIERDA: GALERÍA */}
                <div className="space-y-3">
                  <div className="relative aspect-[4/3] bg-slate-950/70 border border-slate-800/80 rounded-2xl flex items-center justify-center overflow-hidden">
                    {photos.length > 0 ? (
                      <img
                        src={photos[activePhotoIdx]}
                        alt={activeProduct.name}
                        className="w-full h-full object-contain p-2.5"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="text-center p-6 text-slate-400">
                        <Package className="w-12 h-12 stroke-[1.25] text-slate-600 mx-auto mb-2.5" />
                        <p className="text-xs font-mono text-slate-400">
                          Sin muestra fotográfica registrada
                        </p>
                      </div>
                    )}

                    {photos.length > 1 && (
                      <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between pointer-events-none">
                        <button
                          type="button"
                          onClick={() => setActivePhotoIdx(prev => (prev > 0 ? prev - 1 : photos.length - 1))}
                          className="pointer-events-auto min-h-[40px] min-w-[40px] lg:min-h-[34px] lg:min-w-[34px] rounded-full bg-slate-900/90 backdrop-blur-sm border border-slate-700/80 hover:bg-indigo-600 hover:border-indigo-500 text-slate-100 flex items-center justify-center transition-[background-color,border-color,transform] duration-150 cursor-pointer"
                          aria-label="Imagen anterior"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="font-mono text-[11px] tabular-nums px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 text-slate-100">
                          {activePhotoIdx + 1} / {photos.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActivePhotoIdx(prev => (prev < photos.length - 1 ? prev + 1 : 0))}
                          className="pointer-events-auto min-h-[40px] min-w-[40px] lg:min-h-[34px] lg:min-w-[34px] rounded-full bg-slate-900/90 backdrop-blur-sm border border-slate-700/80 hover:bg-indigo-600 hover:border-indigo-500 text-slate-100 flex items-center justify-center transition-[background-color,border-color,transform] duration-150 cursor-pointer"
                          aria-label="Siguiente imagen"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {photos.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                      {photos.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActivePhotoIdx(i)}
                          className={`w-16 h-16 rounded-xl border flex-shrink-0 transition-[border-color,opacity] duration-150 p-0.5 bg-slate-950/70 overflow-hidden cursor-pointer ${
                            activePhotoIdx === i
                              ? 'border-indigo-400 ring-2 ring-indigo-500/25'
                              : 'border-slate-800 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={url} alt={`Muestra ${i + 1}`} className="w-full h-full object-cover rounded-lg" loading="lazy" decoding="async" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Código de Identificación */}
                  <div className="border border-slate-800/80 rounded-xl px-4 py-3 bg-slate-950/60 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-medium text-slate-400 block">
                        Código de identificación
                      </span>
                      <span className="font-mono text-sm font-semibold text-slate-100 tracking-wide">
                        {activeProduct.code}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-700/80 text-slate-200 flex items-center gap-1.5 font-medium">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      {activeProduct.unit_type === 'BOX' ? `BOX · ${activeProduct.units_per_box || 1}` : 'UNIT'}
                    </span>
                  </div>
                </div>

                {/* COLUMNA DERECHA: ESPECIFICACIONES TÉCNICAS */}
                <div className="space-y-5">
                  <div>
                    <p className="font-mono text-xs text-indigo-300 mb-1 font-medium">
                      {activeProduct.categories?.name || 'Catálogo general'}
                    </p>
                    <h4 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 leading-tight">
                      {activeProduct.name}
                    </h4>
                    {activeProduct.description && (
                      <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed border-l-2 border-indigo-500/40 pl-3 py-0.5">
                        {activeProduct.description}
                      </p>
                    )}
                  </div>

                  {/* Matriz de Parámetros Técnicos */}
                  <div className="border border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-800/70 bg-slate-950/50 text-xs">
                    <div className="px-4 py-3 flex items-center justify-between gap-4">
                      <span className="text-slate-400 font-medium">Precio de salida</span>
                      <span className="font-mono text-base sm:text-lg font-bold tabular-nums text-slate-100">
                        {formatCurrency(activeProduct.price, currentInventory?.currency)}
                      </span>
                    </div>

                    <div className="px-4 py-3 flex items-center justify-between gap-4">
                      <span className="text-slate-400 font-medium">Unidad de medida</span>
                      <span className="font-mono text-slate-100 font-semibold text-right">
                        {activeProduct.unit_type === 'BOX'
                          ? `Caja (1 caja = ${activeProduct.units_per_box || 1} unidades)`
                          : 'Unidad (UND)'}
                      </span>
                    </div>

                    <div className="px-4 py-3 flex items-center justify-between gap-4">
                      <span className="text-slate-400 font-medium">Volumen en almacén</span>
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-mono text-base font-bold tabular-nums text-slate-100">
                            {formatStockDisplay(activeProduct)}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-slate-400">
                            (Mín: {activeProduct.min_stock || 1})
                          </span>
                        </div>
                        {boxBreakdown.isBox && boxBreakdown.breakdownLabel && (
                          <span className="font-mono text-[11px] text-indigo-300 block mt-0.5">
                            {boxBreakdown.breakdownLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-4 py-3 flex items-center justify-between gap-4">
                      <span className="text-slate-400 font-medium">Valor total de existencias</span>
                      <span className="font-mono text-sm font-bold tabular-nums text-emerald-300">
                        {formatCurrency(totalItemValuation, currentInventory?.currency)}
                      </span>
                    </div>

                    {/* Distribución Física Multi-Ubicación */}
                    <div className="px-4 py-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 font-medium">Distribución física</span>
                        {getPendingLocationStock(activeProduct) > 0.0001 && onAssignLocation && (
                          <button
                            type="button"
                            onClick={() => onAssignLocation(activeProduct)}
                            className="text-[11px] font-semibold text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            + Asignar ubicación
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {(activeProduct.product_locations || [])
                          .filter(pl => Number(pl.quantity || 0) > 0.0001)
                          .map(pl => (
                            <div
                              key={pl.id}
                              className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs"
                            >
                              <span className="text-slate-200 font-medium flex items-center gap-1.5 min-w-0 truncate">
                                <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="truncate">{pl.locations?.name || 'Estante'}</span>
                                <span className="font-mono text-[11px] text-slate-400 shrink-0">
                                  [{pl.locations?.code || 'LOC'}]
                                </span>
                              </span>
                              <span className="font-mono font-semibold tabular-nums text-slate-100 shrink-0 pl-2">
                                {formatLocationQuantity(pl.quantity, activeProduct)}
                              </span>
                            </div>
                          ))}

                        {getPendingLocationStock(activeProduct) > 0.0001 && (
                          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
                            <span className="text-amber-200 font-medium">
                              Sin ubicación asignada / En recepción
                            </span>
                            <span className="font-mono font-semibold tabular-nums text-amber-200 shrink-0 pl-2">
                              {formatLocationQuantity(getPendingLocationStock(activeProduct), activeProduct)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-4 py-3 flex items-center justify-between gap-4">
                      <span className="text-slate-400 font-medium">Clasificación técnica</span>
                      <span className="text-slate-100 font-semibold text-right">
                        {activeProduct.categories?.name || 'General'}
                        {activeProduct.subcategories?.name && ` · ${activeProduct.subcategories.name}`}
                      </span>
                    </div>
                  </div>

                  {/* Botones de Acción Operativa */}
                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => onMove(activeProduct)}
                      className="flex-1 min-h-[44px] lg:min-h-[40px] px-4 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Trasladar ubicación</span>
                    </button>

                    {!isInactive ? (
                      <button
                        type="button"
                        onClick={() => onWithdraw(activeProduct)}
                        className="flex-1 min-h-[44px] lg:min-h-[40px] px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-200 text-xs font-semibold flex items-center justify-center gap-2 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5 text-rose-400" />
                        <span>Descontar / Merma</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleReactivateProduct}
                        disabled={isReactivating}
                        className="flex-1 min-h-[44px] lg:min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.97] cursor-pointer"
                      >
                        {isReactivating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>Reactivar mercancía</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* VARIACIONES ASOCIADAS */}
              {relatedVariants.length > 0 && (
                <div className="border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3 bg-slate-950/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <GitBranch className="w-4 h-4 text-indigo-400" />
                      Variantes registradas de la familia ({relatedVariants.length})
                    </span>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Selecciona para cambiar de ficha
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {relatedVariants.map(v => {
                      const vInactive = v.status === 'INACTIVE' || v.status === 'WITHDRAWN';
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => onSelectProduct?.(v)}
                          className="p-3 border border-slate-800/80 hover:border-indigo-500/50 rounded-xl bg-slate-900/70 hover:bg-slate-900 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] flex items-center justify-between group cursor-pointer"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-semibold text-slate-100 group-hover:text-indigo-300 truncate transition-colors">
                              {v.name}
                            </p>
                            <span className="font-mono text-[11px] text-slate-400 block mt-0.5">
                              REF: {v.code}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono text-xs tabular-nums text-slate-200 block">
                              {formatCurrency(v.price, currentInventory?.currency)}
                            </span>
                            <span
                              className={`font-mono text-[11px] inline-block mt-0.5 tabular-nums ${
                                vInactive
                                  ? 'text-slate-400'
                                  : v.stock < (v.min_stock !== undefined && v.min_stock !== null ? v.min_stock : 1)
                                    ? 'text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded-md font-semibold border border-rose-500/30'
                                    : 'text-slate-300'
                              }`}
                            >
                              {vInactive ? 'Baja' : formatStockDisplay(v)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter>
              <CancelButton
                onClick={onClose}
                label="Cerrar ficha"
                className="w-full sm:w-auto sm:min-w-[140px]"
              />
            </ModalFooter>
          </>
        )}
      </ModalShell>

      {/* Modal de Reingreso de Stock desde la Ficha Técnica */}
      <RestockProductModal
        product={activeProduct}
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
