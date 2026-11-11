import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRightLeft,
  Barcode,
  Edit,
  Layers,
  Package,
  Plus,
  X
} from 'lucide-react';
import { Category, Location, Product, Subcategory } from '../../types/database';
import { formatStockDisplay, logAuditAction, supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { useBackdropDismiss, useModalEscape } from './modalMotion';
import { ProductDetailView } from './master/ProductDetailView';
import { ProductRestockView } from './master/ProductRestockView';
import { ProductEditView } from './master/ProductEditView';
import { ProductMoveView } from './master/ProductMoveView';

export type ProductModalView = 'DETAIL' | 'RESTOCK' | 'EDIT' | 'MOVE';

export interface ProductMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  initialView?: ProductModalView;
  categories?: Category[];
  subcategories?: Subcategory[];
  locations?: Location[];
  products?: Product[];
  onSelectProduct?: (product: Product) => void;
  onSaved?: (savedProduct?: Product) => void;
  onUpdated?: () => void;
  onRestocked?: () => void;
  onMoved?: () => void;
  onWithdraw?: (product: Product) => void;
  onAssignLocation?: (product: Product) => void;
  onRedirectToStock?: (product: Product) => void;
  onUseCodeAnyway?: (code: string) => void;
}

const VIEW_WIDTH_CLASS: Record<ProductModalView, string> = {
  DETAIL: 'max-w-4xl w-full',
  RESTOCK: 'max-w-lg w-full',
  EDIT: 'max-w-5xl w-full',
  MOVE: 'max-w-xl w-full'
};

const SUBVIEW_META: Record<
  Exclude<ProductModalView, 'DETAIL'>,
  { title: string; subtitle: string }
> = {
  RESTOCK: {
    title: 'Reingreso de Existencias',
    subtitle: 'Suma de stock físico al manifiesto'
  },
  EDIT: {
    title: 'Modificar Producto',
    subtitle: 'Edición de especificación en catálogo'
  },
  MOVE: {
    title: 'Trasladar Ubicación',
    subtitle: 'Reubicación atómica entre zonas'
  }
};

export const ProductMasterModal: React.FC<ProductMasterModalProps> = ({
  isOpen,
  onClose,
  product,
  initialView,
  categories = [],
  subcategories = [],
  locations = [],
  products = [],
  onSelectProduct,
  onSaved,
  onUpdated,
  onRestocked,
  onMoved,
  onWithdraw,
  onAssignLocation,
  onRedirectToStock,
  onUseCodeAnyway
}) => {
  const { currentInventory, user } = useAuth();

  const resolvedInitialView: ProductModalView = initialView ?? (product ? 'DETAIL' : 'EDIT');
  const [view, setView] = useState<ProductModalView>(resolvedInitialView);
  const [overrideProduct, setOverrideProduct] = useState<Product | null>(null);
  const [cancelReturnsToDetail, setCancelReturnsToDetail] = useState<boolean>(
    resolvedInitialView === 'DETAIL'
  );
  const [isReactivating, setIsReactivating] = useState(false);
  const [isViewSubmitting, setIsViewSubmitting] = useState(false);
  const [isNestedSubModalOpen, setIsNestedSubModalOpen] = useState(false);

  // Sincronizar vista y producto al abrir o cambiar producto externo
  useEffect(() => {
    if (!isOpen) return;
    const nextStartView: ProductModalView = initialView ?? (product ? 'DETAIL' : 'EDIT');
    setOverrideProduct(null);
    setView(nextStartView);
    setCancelReturnsToDetail(nextStartView === 'DETAIL');
    setIsViewSubmitting(false);
    setIsNestedSubModalOpen(false);
  }, [isOpen, product?.id, initialView]);

  const baseProduct = overrideProduct ?? product;

  const liveProduct = useMemo(() => {
    if (!baseProduct) return null;
    const fromCatalog = products.find(p => p.id === baseProduct.id);
    if (!fromCatalog) return baseProduct;
    if (
      baseProduct.updated_at &&
      fromCatalog.updated_at &&
      new Date(baseProduct.updated_at).getTime() > new Date(fromCatalog.updated_at).getTime()
    ) {
      return baseProduct;
    }
    return fromCatalog;
  }, [baseProduct, products]);

  const resolvedProduct = liveProduct;
  const activeView: ProductModalView =
    !resolvedProduct && view !== 'EDIT' ? 'EDIT' : view;

  const relatedVariants = useMemo(() => {
    if (!resolvedProduct || products.length === 0) return [];
    return products.filter(p => {
      if (p.id === resolvedProduct.id) return false;
      if (resolvedProduct.parent_id && p.parent_id === resolvedProduct.parent_id) return true;
      if (resolvedProduct.parent_id && p.id === resolvedProduct.parent_id) return true;
      if (!resolvedProduct.parent_id && p.parent_id === resolvedProduct.id) return true;
      return false;
    });
  }, [resolvedProduct, products]);

  const isBusy = isReactivating || isViewSubmitting || isNestedSubModalOpen;
  useModalEscape(isOpen, onClose, isBusy);
  const backdropDismiss = useBackdropDismiss(onClose, isOpen && !isBusy);

  const goToSubview = (targetView: Exclude<ProductModalView, 'DETAIL'>) => {
    if (activeView === 'DETAIL') {
      setCancelReturnsToDetail(true);
    }
    setView(targetView);
  };

  const handleReturnToDetail = () => {
    if (resolvedProduct) {
      setView('DETAIL');
    } else {
      onClose();
    }
  };

  const handleSubViewCancel = () => {
    if (resolvedProduct && cancelReturnsToDetail) {
      setView('DETAIL');
    } else {
      onClose();
    }
  };

  const handleReactivateProduct = async () => {
    if (!resolvedProduct || !currentInventory) return;
    const confirmReactivation = window.confirm(
      `¿Confirmas reactivar la mercancía [REF: ${resolvedProduct.code}] "${resolvedProduct.name}" en el catálogo activo?`
    );
    if (!confirmReactivation) return;

    try {
      setIsReactivating(true);

      const updatedAt = new Date().toISOString();
      const { error } = await supabase
        .from('products')
        .update({
          status: 'ACTIVE',
          withdrawal_reason: null,
          last_modified_by: user?.id,
          last_modified_by_email: user?.email,
          updated_at: updatedAt
        })
        .eq('id', resolvedProduct.id);

      if (error) throw error;

      await logAuditAction({
        inventoryId: currentInventory.id,
        productId: resolvedProduct.id,
        productName: resolvedProduct.name,
        actionType: 'UPDATE',
        details: 'Producto reactivado en catálogo activo.',
        metadata: {
          previous_status: resolvedProduct.status,
          new_status: 'ACTIVE',
          reactivated_by: user?.email
        }
      });

      onUpdated?.();
      onClose();
    } catch (err: any) {
      console.error('Error reactivando producto:', err);
      alert('Error reactivando el producto: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsReactivating(false);
    }
  };

  const isInactive =
    resolvedProduct?.status === 'INACTIVE' || resolvedProduct?.status === 'WITHDRAWN';
  const isLowStock = Boolean(
    resolvedProduct &&
      !isInactive &&
      resolvedProduct.stock <
        (resolvedProduct.min_stock !== undefined && resolvedProduct.min_stock !== null
          ? resolvedProduct.min_stock
          : 1)
  );

  const subMeta =
    activeView === 'DETAIL'
      ? null
      : activeView === 'EDIT' && !resolvedProduct
        ? {
            title: 'Crear Nuevo Producto',
            subtitle: 'Nuevo registro en catálogo'
          }
        : SUBVIEW_META[activeView];

  const renderHeaderIcon = () => {
    if (activeView === 'RESTOCK') return <Barcode className="w-4 h-4 text-[#17191c]" />;
    if (activeView === 'MOVE') return <ArrowRightLeft className="w-4 h-4 text-[#17191c]" />;
    if (activeView === 'EDIT') return <Package className="w-4 h-4 text-[#17191c]" />;
    return null;
  };

  if (!isOpen) return null;

  return (
    <div
      {...backdropDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 max-md:bg-black/75 backdrop-blur-sm p-3 sm:p-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-y-auto"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`mobile-dark-modal relative bg-[#ffffff] border border-[#ececec] rounded-2xl md:rounded-3xl ${VIEW_WIDTH_CLASS[activeView]} my-auto overflow-hidden flex flex-col max-h-[94vh] shadow-xl`}
      >
            {/* CABECERA ADAPTATIVA UNIFICADA */}
            <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-[#ececec] bg-white shrink-0 z-20">
              {activeView === 'DETAIL' && resolvedProduct ? (
                <>
                  <div className="min-w-0">
                    <div className="md:hidden mb-1">
                      <h3 className="text-lg font-bold tracking-tight text-neutral-900 truncate">
                        {resolvedProduct.name}
                      </h3>
                      <p className="text-xs text-neutral-500 tabular-nums">
                        SKU {resolvedProduct.code} · {formatStockDisplay(resolvedProduct)}
                      </p>
                    </div>
                    <div className="hidden md:flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-800 px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 font-semibold tabular-nums">
                        {resolvedProduct.code}
                      </span>
                      <span className="font-mono text-[10px] px-2.5 py-1 rounded-md bg-slate-900 text-white flex items-center gap-1 font-medium tabular-nums">
                        <Layers className="w-3 h-3 text-white" />
                        {resolvedProduct.unit_type === 'BOX'
                          ? `BOX · ${resolvedProduct.units_per_box || 1} UND`
                          : 'UNIT'}
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
                      type="button"
                      onClick={() => goToSubview('RESTOCK')}
                      className="mobile-header-tab min-h-[38px] max-md:min-h-0 max-md:h-8 max-md:px-3 max-md:bg-neutral-100 max-md:text-neutral-800 max-md:border-0 px-3.5 rounded-full bg-[#17191c] hover:bg-black text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                      title="Añadir más existencias (Reingreso de Stock)"
                    >
                      <Plus className="w-3.5 h-3.5 text-white max-md:text-neutral-800" />
                      <span className="hidden sm:inline">REINGRESO</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => goToSubview('EDIT')}
                      className="mobile-header-tab min-h-[38px] max-md:min-h-0 max-md:h-8 max-md:px-3 max-md:bg-neutral-100 max-md:text-neutral-800 max-md:border-0 px-4 rounded-full border border-[#ececec] hover:border-[#17191c] text-[#17191c] text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors bg-white shadow-sm cursor-pointer"
                      title="Modificar especificación técnica"
                    >
                      <Edit className="w-3.5 h-3.5 text-[#17191c] max-md:text-neutral-800" />
                      <span className="hidden sm:inline">EDITAR</span>
                    </button>
                    <kbd className="hidden lg:inline-flex items-center px-2 py-1 text-[10px] font-mono font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-md select-none">
                      Esc
                    </kbd>
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-h-[38px] min-w-[38px] rounded-full border border-[#ececec] hover:border-[#17191c] text-[#17191c] flex items-center justify-center transition-colors bg-white shadow-sm cursor-pointer"
                      title="Cerrar ficha"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    {resolvedProduct ? (
                      <button
                        type="button"
                        onClick={handleReturnToDetail}
                        disabled={isViewSubmitting}
                        className="mobile-header-tab inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f5f5f5] hover:bg-[#e5e5e5] border border-[#ececec] text-[#17191c] text-xs font-medium transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                        title="Volver a la ficha"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Volver a la ficha</span>
                      </button>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#f5f5f5] border border-[#ececec] flex items-center justify-center shrink-0">
                        {renderHeaderIcon()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-bold text-[#17191c] text-base sm:text-lg uppercase tracking-tight truncate">
                        {subMeta?.title}
                      </h3>
                      <p className="text-[11px] text-[#777b86] truncate">
                        {subMeta?.subtitle}
                        {resolvedProduct ? ` · ${resolvedProduct.code}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <kbd className="hidden lg:inline-flex items-center px-2 py-1 text-[10px] font-mono font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-md select-none">
                      Esc
                    </kbd>
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-h-[38px] min-w-[38px] rounded-full border border-[#ececec] hover:border-[#17191c] text-[#17191c] flex items-center justify-center transition-colors bg-white shadow-sm cursor-pointer"
                      title="Cerrar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* CUERPO DIRECTO SIN ANIMACIÓN DE TRANSICIÓN */}
            <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
              {activeView === 'DETAIL' && resolvedProduct && (
                <div className="flex flex-col flex-1 min-h-0 w-full">
                  <ProductDetailView
                    product={resolvedProduct}
                    currency={currentInventory?.currency}
                    relatedVariants={relatedVariants}
                    isReactivating={isReactivating}
                    onReactivate={handleReactivateProduct}
                    onSelectProduct={nextProd => {
                      setOverrideProduct(nextProd);
                      onSelectProduct?.(nextProd);
                    }}
                    onGoToMove={() => goToSubview('MOVE')}
                    onAssignLocation={prod => onAssignLocation?.(prod)}
                    onWithdraw={prod => onWithdraw?.(prod)}
                  />
                </div>
              )}

              {activeView === 'RESTOCK' && resolvedProduct && (
                <div className="flex flex-col flex-1 min-h-0 w-full">
                  <ProductRestockView
                    product={resolvedProduct}
                    onCancel={handleSubViewCancel}
                    onViewDetails={() => setView('DETAIL')}
                    onUseCodeAnyway={
                      onUseCodeAnyway
                        ? code => {
                            onUseCodeAnyway(code);
                            onClose();
                          }
                        : undefined
                    }
                    onSubmittingChange={setIsViewSubmitting}
                    onSuccess={updatedProd => {
                      setOverrideProduct(updatedProd);
                      onRestocked?.();
                      onUpdated?.();
                      if (cancelReturnsToDetail) {
                        setView('DETAIL');
                      } else {
                        onClose();
                      }
                    }}
                  />
                </div>
              )}

              {activeView === 'EDIT' && (
                <div className="flex flex-col flex-1 min-h-0 w-full">
                  <ProductEditView
                    productToEdit={resolvedProduct}
                    categories={categories}
                    subcategories={subcategories}
                    locations={locations}
                    products={products}
                    onCancel={handleSubViewCancel}
                    onCloseEntireModal={onClose}
                    onRedirectToStock={onRedirectToStock}
                    onSwitchToRestockProduct={target => {
                      setOverrideProduct(target);
                      setCancelReturnsToDetail(false);
                      setView('RESTOCK');
                    }}
                    onSubmittingChange={setIsViewSubmitting}
                    onSubModalOpenChange={setIsNestedSubModalOpen}
                    onSuccess={savedProd => {
                      onSaved?.(savedProd);
                      if (resolvedProduct && cancelReturnsToDetail) {
                        if (savedProd) setOverrideProduct(savedProd);
                        setView('DETAIL');
                      } else {
                        onClose();
                      }
                    }}
                  />
                </div>
              )}

              {activeView === 'MOVE' && resolvedProduct && (
                <div className="flex flex-col flex-1 min-h-0 w-full">
                  <ProductMoveView
                    product={resolvedProduct}
                    locations={locations}
                    onCancel={handleSubViewCancel}
                    onSubmittingChange={setIsViewSubmitting}
                    onSubModalOpenChange={setIsNestedSubModalOpen}
                    onSuccess={() => {
                      onMoved?.();
                      onUpdated?.();
                      if (cancelReturnsToDetail) {
                        setView('DETAIL');
                      } else {
                        onClose();
                      }
                    }}
                  />
                </div>
              )}
            </div>
      </div>
    </div>
  );
};

export default ProductMasterModal;
