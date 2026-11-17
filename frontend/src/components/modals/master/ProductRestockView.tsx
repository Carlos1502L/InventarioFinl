import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Loader2, Eye, AlertCircle, Layers } from 'lucide-react';
import { Product } from '../../../types/database';
import {
  supabase,
  logAuditAction,
  formatCurrency,
  formatCleanDecimal,
  formatStockDisplay,
  getBoxBreakdown
} from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { CancelButton } from '../../common/CancelButton';

interface ProductRestockViewProps {
  product: Product;
  onCancel: () => void;
  onViewDetails?: () => void;
  onUseCodeAnyway?: (code: string) => void;
  onSuccess: (updatedProduct: Product) => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

export const ProductRestockView: React.FC<ProductRestockViewProps> = ({
  product,
  onCancel,
  onViewDetails,
  onUseCodeAnyway,
  onSuccess,
  onSubmittingChange
}) => {
  const { currentInventory, user } = useAuth();

  const [unitsToAdd, setUnitsToAdd] = useState<string>('1');
  const [boxesToAdd, setBoxesToAdd] = useState<string>('1');
  const [looseUnitsToAdd, setLooseUnitsToAdd] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setUnitsToAdd('1');
    setBoxesToAdd('1');
    setLooseUnitsToAdd('0');
    setErrorMsg(null);
  }, [product.id]);

  const setSubmitting = (next: boolean) => {
    setIsSubmitting(next);
    onSubmittingChange?.(next);
  };

  const isBox = product.unit_type === 'BOX' && Number(product.units_per_box) > 0;
  const unitsPerBox = Number(product.units_per_box || 1);
  const currentStock = Number(product.stock || 0);

  const calculation = useMemo(() => {
    if (isBox) {
      const parsedBoxes = Math.max(0, parseFloat(boxesToAdd) || 0);
      const parsedLoose = Math.max(0, parseInt(looseUnitsToAdd, 10) || 0);
      const deltaBoxes = parsedBoxes + parsedLoose / unitsPerBox;
      const cleanDelta = Number(deltaBoxes.toFixed(4));
      const newStockVal = Number((currentStock + cleanDelta).toFixed(4));
      const totalAddedUnits = Math.round(parsedBoxes * unitsPerBox) + parsedLoose;
      return { deltaStock: cleanDelta, newStock: newStockVal, totalAddedUnits };
    }

    const parsedUnits = Math.max(0, parseInt(unitsToAdd, 10) || 0);
    return {
      deltaStock: parsedUnits,
      newStock: Math.round(currentStock + parsedUnits),
      totalAddedUnits: parsedUnits
    };
  }, [isBox, boxesToAdd, looseUnitsToAdd, unitsToAdd, unitsPerBox, currentStock]);

  const currentBreakdown = getBoxBreakdown(product);
  const previewNewBreakdown = getBoxBreakdown({
    stock: calculation.newStock,
    unit_type: product.unit_type,
    units_per_box: product.units_per_box
  });

  const handleConfirmRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !user) return;

    if (calculation.deltaStock <= 0) {
      setErrorMsg(
        isBox
          ? 'Ingresa al menos 1 caja o 1 unidad suelta para añadir al inventario.'
          : 'La cantidad de unidades a añadir debe ser mayor a 0.'
      );
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const updatedAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock: calculation.newStock,
          last_modified_by: user.id,
          last_modified_by_email: user.email,
          updated_at: updatedAt
        })
        .eq('id', product.id);

      if (updateError) throw updateError;

      const auditDetails = isBox
        ? `Reingreso de stock (CAJA): +${formatCleanDecimal(calculation.deltaStock, 2)} cajas (Cajas: ${parseFloat(boxesToAdd) || 0}, Unidades sueltas: ${parseInt(looseUnitsToAdd, 10) || 0}, Equiv: 1 caja = ${unitsPerBox} und). Nuevo balance: ${formatCleanDecimal(calculation.newStock, 2)} cajas.`
        : `Reingreso de stock (UNIDAD): +${calculation.deltaStock} und. Nuevo balance: ${calculation.newStock} und.`;

      await logAuditAction({
        inventoryId: currentInventory.id,
        productId: product.id,
        productName: product.name,
        actionType: 'RESTOCK',
        details: auditDetails,
        metadata: {
          unit_type: product.unit_type || 'UNIT',
          units_per_box: product.units_per_box || null,
          added_stock: calculation.deltaStock,
          previous_stock: currentStock,
          new_stock: calculation.newStock
        }
      });

      onSuccess({
        ...product,
        stock: calculation.newStock,
        updated_at: updatedAt
      });
    } catch (err: any) {
      console.error('Error en reingreso de stock:', err);
      setErrorMsg(err.message || 'Error al actualizar las existencias del producto.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleConfirmRestock} className="flex flex-col flex-1 min-h-0">
      <div className="p-6 max-md:px-5 max-md:py-4 overflow-y-auto flex-1 min-h-0 overscroll-contain space-y-4 font-mono custom-scrollbar">
        <p className="mobile-flat-section text-xs text-[#17191c] font-sans font-medium bg-[#fafafb] border border-[#ececec] rounded-xl p-3">
          Confirma las existencias a sumar al inventario del ítem seleccionado.
        </p>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 font-sans">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Ficha Resumen del Producto */}
        <div className="mobile-flat-row p-4 bg-[#fafafb] rounded-xl border border-[#ececec] text-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-[#17191c] text-sm uppercase truncate">{product.name}</p>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#17191c] text-white uppercase shrink-0 font-mono">
              {isBox ? 'CAJA (BOX)' : 'UNIDAD (UNIT)'}
            </span>
          </div>
          <p className="text-[#777b86]">
            SKU / REF: <strong className="text-[#17191c] tabular-nums">{product.code}</strong>
          </p>
          <div className="flex items-center justify-between pt-1 border-t border-[#ececec]/80">
            <span className="text-[#777b86]">Stock actual:</span>
            <div className="text-right">
              <strong className="text-[#17191c] text-sm tabular-nums">{formatStockDisplay(product)}</strong>
              {isBox && currentBreakdown.breakdownLabel && (
                <span className="block text-[10px] text-[#777b86] tabular-nums">{currentBreakdown.breakdownLabel}</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#777b86]">Precio unitario:</span>
            <strong className="text-[#17191c] tabular-nums">
              {formatCurrency(product.price, currentInventory?.currency)}
            </strong>
          </div>
        </div>

        {/* Inputs según tipo de unidad */}
        {!isBox ? (
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#17191c]">
              Unidades a añadir: <span className="text-[#e7000b]">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={unitsToAdd}
              onChange={e => setUnitsToAdd(e.target.value)}
              required
              className="w-full min-h-[44px] bg-white border border-[#ececec] focus:border-[#17191c] rounded-xl px-4 py-2 text-sm font-mono tabular-nums text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
            />
            <div className="p-3 bg-[#fafafb] border border-[#ececec] rounded-xl flex items-center justify-between text-xs">
              <span className="text-[#777b86]">Nuevo Stock Resultante:</span>
              <strong className="text-[#17191c] text-sm tabular-nums font-mono">
                {currentStock} + {Math.max(0, parseInt(unitsToAdd, 10) || 0)} = {calculation.newStock} und
              </strong>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-800">
              <span className="flex items-center gap-1.5 font-semibold tabular-nums">
                <Layers className="w-3.5 h-3.5 text-[#17191c]" />
                Equivalencia: 1 caja = {unitsPerBox} unidades
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#17191c] mb-1">
                  Cajas a ingresar:
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={boxesToAdd}
                  onChange={e => setBoxesToAdd(e.target.value)}
                  placeholder="0"
                  className="w-full min-h-[44px] bg-white border border-[#ececec] focus:border-[#17191c] rounded-xl px-3.5 py-2 text-sm font-mono tabular-nums text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#17191c] mb-1">
                  Unidades sueltas a ingresar:
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={looseUnitsToAdd}
                  onChange={e => setLooseUnitsToAdd(e.target.value)}
                  placeholder="0"
                  className="w-full min-h-[44px] bg-white border border-[#ececec] focus:border-[#17191c] rounded-xl px-3.5 py-2 text-sm font-mono tabular-nums text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                />
              </div>
            </div>

            <div className="p-3.5 bg-[#fafafb] border border-[#ececec] rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#777b86]">Ingreso consolidado (Δ Cajas):</span>
                <strong className="text-[#17191c] tabular-nums">
                  +{formatCleanDecimal(calculation.deltaStock, 2)} {calculation.deltaStock === 1 ? 'caja' : 'cajas'}
                </strong>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#ececec]">
                <span className="text-[#777b86]">Nuevo Stock Total:</span>
                <div className="text-right">
                  <strong className="text-[#17191c] text-sm tabular-nums">
                    {formatCleanDecimal(calculation.newStock, 2)} {calculation.newStock === 1 ? 'caja' : 'cajas'}
                  </strong>
                  {previewNewBreakdown.breakdownLabel && (
                    <span className="block text-[10px] text-[#777b86] tabular-nums">
                      ({previewNewBreakdown.breakdownLabel})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Fijo con Padding Limpio */}
      <div className="px-6 py-4 max-md:px-5 max-md:py-3.5 border-t border-[#ececec] bg-white shrink-0 space-y-2.5">
        <button
          type="submit"
          disabled={isSubmitting || calculation.deltaStock <= 0}
          className="mobile-primary-btn w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 bg-[#17191c] hover:bg-black text-white text-xs font-mono uppercase tracking-wider font-semibold rounded-full shadow-sm active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer tabular-nums"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Actualizando Stock...</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 text-white" />
              <span>
                Sumar +{isBox ? `${formatCleanDecimal(calculation.deltaStock, 2)} cajas` : `${calculation.deltaStock} und`} al Stock
              </span>
            </>
          )}
        </button>

        <div className="flex max-md:flex-col items-center justify-between gap-2">
          {onViewDetails ? (
            <button
              type="button"
              onClick={onViewDetails}
              className="inline-flex items-center gap-1.5 text-xs text-[#17191c] hover:underline font-medium cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver ficha técnica</span>
            </button>
          ) : onUseCodeAnyway ? (
            <button
              type="button"
              onClick={() => onUseCodeAnyway(product.code)}
              className="text-xs text-[#777b86] hover:text-[#17191c] transition-colors cursor-pointer"
            >
              Usar código de todas formas
            </button>
          ) : (
            <span />
          )}

          <CancelButton onClick={onCancel} />
        </div>
      </div>
    </form>
  );
};
