import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Package,
  ArrowRightLeft,
  Archive,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { Product } from '../../../types/database';
import {
  formatCurrency,
  formatStockDisplay,
  getBoxBreakdown,
  getPendingLocationStock,
  formatLocationQuantity
} from '../../../services/supabase';

interface ProductDetailViewProps {
  product: Product;
  currency?: string;
  relatedVariants: Product[];
  isReactivating: boolean;
  onReactivate: () => void;
  onSelectProduct?: (product: Product) => void;
  onGoToMove: () => void;
  onAssignLocation?: (product: Product) => void;
  onWithdraw: (product: Product) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  currency,
  relatedVariants,
  isReactivating,
  onReactivate,
  onSelectProduct,
  onGoToMove,
  onAssignLocation,
  onWithdraw
}) => {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  useEffect(() => {
    setActivePhotoIdx(0);
  }, [product.id]);

  const photos = product.images && product.images.length > 0 ? product.images : [];
  const isInactive = product.status === 'INACTIVE' || product.status === 'WITHDRAWN';
  const totalItemValuation = (product.price || 0) * (product.stock || 0);
  const boxBreakdown = getBoxBreakdown(product);

  return (
    <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 overscroll-contain space-y-6 custom-scrollbar">
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
            onClick={onReactivate}
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

      {/* Grilla Principal 12 Columnas Desktop: 5 izq Media+SKU+Variantes / 7 der Ficha+Acciones */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda */}
        <div className="lg:col-span-5 min-w-0 flex flex-col gap-3.5">
          <div className="relative aspect-square sm:aspect-[4/3] lg:max-h-72 bg-[#fafafb] border border-[#ececec] rounded-2xl flex items-center justify-center overflow-hidden">
            {photos.length > 0 ? (
              <img
                src={photos[activePhotoIdx] || photos[0]}
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

            {photos.length > 1 && (
              <div className="absolute inset-x-2 bottom-2 flex items-center justify-between pointer-events-none">
                <button
                  type="button"
                  onClick={() => setActivePhotoIdx(prev => (prev > 0 ? prev - 1 : photos.length - 1))}
                  className="pointer-events-auto min-h-[36px] min-w-[36px] rounded-full bg-white/90 backdrop-blur-sm border border-[#ececec] hover:bg-[#17191c] hover:text-white text-[#17191c] flex items-center justify-center transition-all shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-[10px] px-3 py-1 rounded-full bg-[#17191c] text-white tabular-nums">
                  {activePhotoIdx + 1} / {photos.length}
                </span>
                <button
                  type="button"
                  onClick={() => setActivePhotoIdx(prev => (prev < photos.length - 1 ? prev + 1 : 0))}
                  className="pointer-events-auto min-h-[36px] min-w-[36px] rounded-full bg-white/90 backdrop-blur-sm border border-[#ececec] hover:bg-[#17191c] hover:text-white text-[#17191c] flex items-center justify-center transition-all shadow-sm"
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
                  className={`w-16 h-16 rounded-xl border flex-shrink-0 transition-[border-color,opacity] duration-150 p-0.5 bg-white overflow-hidden cursor-pointer ${
                    activePhotoIdx === i
                      ? 'border-slate-900 ring-2 ring-slate-900/15'
                      : 'border-slate-200 opacity-65 hover:opacity-100'
                  }`}
                >
                  <img
                    src={url}
                    alt={`Muestra ${i + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Código de Identificación */}
          <div className="border border-[#ececec] rounded-xl p-3.5 bg-[#fafafb] font-mono text-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] text-[#777b86] uppercase tracking-wider block">
                CÓDIGO DE IDENTIFICACIÓN
              </span>
              <span className="text-[#17191c] font-semibold uppercase tracking-wider tabular-nums">
                {product.code}
              </span>
            </div>
          </div>

          {/* Variantes Registradas de la Familia (Columna Izquierda) */}
          {relatedVariants.length > 0 && (
            <div className="border border-[#ececec] rounded-2xl p-3.5 sm:p-4 space-y-2.5 bg-[#fafafb]/70">
              <div className="flex items-center justify-between gap-2 font-mono">
                <span className="text-[11px] uppercase tracking-wider text-[#17191c] flex items-center gap-1.5 font-semibold truncate">
                  <GitBranch className="w-3.5 h-3.5 text-[#17191c] shrink-0" />
                  <span className="truncate">Variantes de la familia ({relatedVariants.length})</span>
                </span>
                <span className="text-[10px] text-[#777b86] uppercase shrink-0">Toca para cambiar</span>
              </div>

              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1 font-mono">
                {relatedVariants.map(v => {
                  const vInactive = v.status === 'INACTIVE' || v.status === 'WITHDRAWN';
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onSelectProduct?.(v)}
                      className="w-full p-2.5 border border-[#ececec] hover:border-[#17191c] rounded-xl bg-white hover:bg-[#fafafb] text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] flex items-center justify-between gap-2.5 group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-wide text-[#17191c] group-hover:underline truncate font-bold">
                          {v.name}
                        </p>
                        <span className="text-[10px] text-[#777b86] uppercase tracking-wider block mt-0.5 truncate">
                          REF: {v.code}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-semibold tabular-nums text-[#17191c] block">
                          {formatCurrency(v.price, currency)}
                        </span>
                        <span
                          className={`inline-block mt-0.5 text-[10px] tabular-nums ${
                            vInactive
                              ? 'text-[#777b86]'
                              : v.stock < (v.min_stock !== undefined && v.min_stock !== null ? v.min_stock : 1)
                                ? 'text-red-700 bg-red-50 px-1.5 py-0.5 rounded-md font-semibold border border-red-200'
                                : 'text-slate-700'
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

        {/* Columna Derecha */}
        <div className="lg:col-span-7 min-w-0 flex flex-col gap-5">
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

          <div className="mobile-flat-section border border-[#ececec] rounded-2xl overflow-hidden divide-y divide-[#E5E7EB] max-md:divide-neutral-100 font-mono text-xs shadow-sm">
            <div className="mobile-flat-row p-3.5 flex items-center justify-between bg-white">
              <span className="text-[10px] text-[#777b86] uppercase tracking-wider">
                PRECIO DE SALIDA
              </span>
              <span className="text-base sm:text-lg font-bold tabular-nums text-[#17191c]">
                {formatCurrency(product.price, currency)}
              </span>
            </div>

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

            <div className="mobile-flat-row p-3.5 flex items-center justify-between bg-white">
              <span className="text-[10px] text-[#777b86] uppercase tracking-wider">
                VOLUMEN EN ALMACÉN
              </span>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-base font-bold tabular-nums text-[#17191c]">
                    {formatStockDisplay(product)}
                  </span>
                  <span className="text-[10px] text-[#777b86] uppercase tabular-nums">
                    (MÍN: {product.min_stock || 1})
                  </span>
                </div>
                {boxBreakdown.isBox && boxBreakdown.breakdownLabel && (
                  <span className="text-[10px] text-[#777b86] block tabular-nums">
                    {boxBreakdown.breakdownLabel}
                  </span>
                )}
              </div>
            </div>

            <div className="mobile-flat-row p-3.5 flex items-center justify-between bg-white">
              <span className="text-[10px] text-[#777b86] uppercase tracking-wider">
                VALOR TOTAL DE EXISTENCIAS
              </span>
              <span className="text-sm font-bold tabular-nums text-[#17191c]">
                {formatCurrency(totalItemValuation, currency)}
              </span>
            </div>

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
                      <span className="font-bold tabular-nums text-[#17191c]">
                        {formatLocationQuantity(pl.quantity, product)}
                      </span>
                    </div>
                  ))}

                {getPendingLocationStock(product) > 0.0001 && (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-xs">
                    <span className="text-[#17191c] font-bold uppercase">
                      Sin Ubicación Asignada / En Recepción
                    </span>
                    <span className="font-bold tabular-nums text-[#17191c]">
                      {formatLocationQuantity(getPendingLocationStock(product), product)}
                    </span>
                  </div>
                )}
              </div>
            </div>

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
          <div className="pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onGoToMove}
                className="mobile-primary-btn w-full min-h-[44px] px-4 rounded-xl border border-slate-900 hover:bg-slate-900 hover:text-white text-slate-900 text-xs font-semibold flex items-center justify-center gap-2 transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Trasladar ubicación</span>
              </button>

              {!isInactive ? (
                <button
                  type="button"
                  onClick={() => onWithdraw(product)}
                  className="w-full min-h-[44px] px-5 rounded-full max-md:rounded-2xl border border-[#ececec] hover:border-[#17191c] text-[#777b86] hover:text-[#17191c] text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-white shadow-sm"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>DESCONTAR / MERMA</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onReactivate}
                  disabled={isReactivating}
                  className="w-full min-h-[44px] px-5 rounded-full max-md:rounded-2xl bg-[#17191c] hover:bg-black text-white text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm"
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
    </div>
  );
};
