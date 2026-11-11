import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Barcode, Plus, Loader2, Eye, AlertCircle, Layers } from 'lucide-react';
import { Product } from '../../types/database';
import {
  supabase,
  logAuditAction,
  formatCurrency,
  formatCleanDecimal,
  formatStockDisplay,
  getBoxBreakdown
} from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { CancelButton } from '../common/CancelButton';
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  modalFieldInputClass,
  modalFieldLabelClass,
  modalSurfaceCardClass,
  modalPrimaryButtonClass
} from './ModalShell';

interface RestockProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onRestocked: () => void;
  onViewDetails?: (product: Product) => void;
  onUseCodeAnyway?: (code: string) => void;
}

export const RestockProductModal: React.FC<RestockProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onRestocked,
  onViewDetails,
  onUseCodeAnyway
}) => {
  const { currentInventory, user } = useAuth();
  const lastProductRef = useRef<Product | null>(null);
  if (product) {
    lastProductRef.current = product;
  }
  const activeProduct = product || lastProductRef.current;

  // Estado para producto tipo UNIT
  const [unitsToAdd, setUnitsToAdd] = useState<string>('1');

  // Estados para producto tipo BOX (interfaz dual combinable)
  const [boxesToAdd, setBoxesToAdd] = useState<string>('0');
  const [looseUnitsToAdd, setLooseUnitsToAdd] = useState<string>('0');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      setUnitsToAdd('1');
      setBoxesToAdd('1');
      setLooseUnitsToAdd('0');
      setErrorMsg(null);
    }
  }, [isOpen, product]);

  const isBox = activeProduct?.unit_type === 'BOX' && Number(activeProduct?.units_per_box) > 0;
  const unitsPerBox = Number(activeProduct?.units_per_box || 1);
  const currentStock = Number(activeProduct?.stock || 0);

  // Cálculo de ingreso consolidado en tiempo real
  const calculation = useMemo(() => {
    if (!activeProduct) {
      return { deltaStock: 0, newStock: 0, totalAddedUnits: 0 };
    }

    if (isBox) {
      const parsedBoxes = Math.max(0, parseFloat(boxesToAdd) || 0);
      const parsedLoose = Math.max(0, parseInt(looseUnitsToAdd, 10) || 0);
      const deltaBoxes = parsedBoxes + parsedLoose / unitsPerBox;
      const cleanDelta = Number(deltaBoxes.toFixed(4));
      const newStockVal = Number((currentStock + cleanDelta).toFixed(4));
      const totalAddedUnits = Math.round(parsedBoxes * unitsPerBox) + parsedLoose;
      return {
        deltaStock: cleanDelta,
        newStock: newStockVal,
        totalAddedUnits
      };
    } else {
      const parsedUnits = Math.max(0, parseInt(unitsToAdd, 10) || 0);
      return {
        deltaStock: parsedUnits,
        newStock: Math.round(currentStock + parsedUnits),
        totalAddedUnits: parsedUnits
      };
    }
  }, [activeProduct, isBox, boxesToAdd, looseUnitsToAdd, unitsToAdd, unitsPerBox, currentStock]);

  const currentBreakdown = activeProduct ? getBoxBreakdown(activeProduct) : { isBox: false, breakdownLabel: '' };
  const previewNewBreakdown = activeProduct
    ? getBoxBreakdown({
        stock: calculation.newStock,
        unit_type: activeProduct.unit_type,
        units_per_box: activeProduct.units_per_box
      })
    : { isBox: false, breakdownLabel: '' };

  const handleConfirmRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !user || !activeProduct) return;

    if (calculation.deltaStock <= 0) {
      setErrorMsg(
        isBox
          ? 'Ingresa al menos 1 caja o 1 unidad suelta para añadir al inventario.'
          : 'La cantidad de unidades a añadir debe ser mayor a 0.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock: calculation.newStock,
          last_modified_by: user.id,
          last_modified_by_email: user.email,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeProduct.id);

      if (updateError) throw updateError;

      const auditDetails = isBox
        ? `Reingreso de stock (CAJA): +${formatCleanDecimal(calculation.deltaStock, 2)} cajas (Cajas: ${ parseFloat(boxesToAdd) || 0 }, Unidades sueltas: ${ parseInt(looseUnitsToAdd, 10) || 0 }, Equiv: 1 caja = ${unitsPerBox} und). Nuevo balance: ${formatCleanDecimal(calculation.newStock, 2)} cajas.`
        : `Reingreso de stock (UNIDAD): +${calculation.deltaStock} und. Nuevo balance: ${calculation.newStock} und.`;

      await logAuditAction({
        inventoryId: currentInventory.id,
        productId: activeProduct.id,
        productName: activeProduct.name,
        actionType: 'RESTOCK',
        details: auditDetails,
        metadata: {
          unit_type: activeProduct.unit_type || 'UNIT',
          units_per_box: activeProduct.units_per_box || null,
          added_stock: calculation.deltaStock,
          previous_stock: currentStock,
          new_stock: calculation.newStock
        }
      });

      onRestocked();
      onClose();
    } catch (err: any) {
      console.error('Error en reingreso de stock:', err);
      setErrorMsg(err.message || 'Error al actualizar las existencias del producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={Boolean(isOpen && activeProduct)}
      onClose={onClose}
      maxWidth="sm"
      disableDismiss={isSubmitting}
      formId="restock-product-form"
    >
      <ModalHeader
        title="Reingreso de existencias"
        subtitle={activeProduct ? `Modo ${isBox ? 'caja (BOX)' : 'unidad (UNIT)'}` : undefined}
        icon={<Barcode className="w-4 h-4 lg:w-5 lg:h-5" />}
        iconTone="emerald"
        onClose={onClose}
        closeDisabled={isSubmitting}
      />

      {activeProduct && (
        <form
          id="restock-product-form"
          onSubmit={handleConfirmRestock}
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
        >
          <ModalBody className="space-y-4">
            <p className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800/80 rounded-xl px-3.5 py-2.5 leading-relaxed">
              Este producto ya existe en el sistema. Ajusta la cantidad adicional para sumarla al balance actual.
            </p>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Ficha Resumen del Producto */}
            <div className={`${modalSurfaceCardClass} space-y-2 text-xs`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-100 text-sm truncate">{activeProduct.name}</p>
                <span className="font-mono px-2 py-0.5 rounded-md text-[10px] bg-slate-800 border border-slate-700 text-slate-200 font-semibold shrink-0">
                  {isBox ? 'BOX' : 'UNIT'}
                </span>
              </div>
              <p className="text-slate-400 font-mono text-[11px]">
                SKU: <strong className="text-slate-200">{activeProduct.code}</strong>
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="text-slate-400">Stock actual</span>
                <div className="text-right font-mono tabular-nums">
                  <strong className="text-slate-100 text-sm">{formatStockDisplay(activeProduct)}</strong>
                  {isBox && currentBreakdown.breakdownLabel && (
                    <span className="block text-[10px] text-slate-400">{currentBreakdown.breakdownLabel}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Precio unitario</span>
                <strong className="font-mono tabular-nums text-slate-100">
                  {formatCurrency(activeProduct.price, currentInventory?.currency)}
                </strong>
              </div>
            </div>

            {/* Inputs según tipo de unidad (UNIT vs BOX) */}
            {!isBox ? (
              <div className="space-y-2.5">
                <div>
                  <label className={modalFieldLabelClass}>
                    Unidades a añadir <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={unitsToAdd}
                    onChange={e => setUnitsToAdd(e.target.value)}
                    required
                    autoFocus
                    className={`${modalFieldInputClass} font-mono tabular-nums font-semibold`}
                  />
                </div>
                <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-400">Nuevo stock resultante</span>
                  <strong className="font-mono tabular-nums text-emerald-300 text-sm">
                    {currentStock} + {Math.max(0, parseInt(unitsToAdd, 10) || 0)} = {calculation.newStock} und
                  </strong>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 text-xs text-slate-200">
                  <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-mono tabular-nums">
                    Equivalencia: <strong>1 caja = {unitsPerBox} unidades</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={modalFieldLabelClass}>Cajas a ingresar</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={boxesToAdd}
                      onChange={e => setBoxesToAdd(e.target.value)}
                      placeholder="0"
                      className={`${modalFieldInputClass} font-mono tabular-nums`}
                    />
                  </div>

                  <div>
                    <label className={modalFieldLabelClass}>Unidades sueltas</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={looseUnitsToAdd}
                      onChange={e => setLooseUnitsToAdd(e.target.value)}
                      placeholder="0"
                      className={`${modalFieldInputClass} font-mono tabular-nums`}
                    />
                  </div>
                </div>

                <div className={`${modalSurfaceCardClass} space-y-1.5 text-xs`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Ingreso consolidado</span>
                    <strong className="font-mono tabular-nums text-emerald-300">
                      +{formatCleanDecimal(calculation.deltaStock, 2)} {calculation.deltaStock === 1 ? 'caja' : 'cajas'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                    <span className="text-slate-400">Nuevo stock total</span>
                    <div className="text-right font-mono tabular-nums">
                      <strong className="text-slate-100 text-sm">
                        {formatCleanDecimal(calculation.newStock, 2)} {calculation.newStock === 1 ? 'caja' : 'cajas'}
                      </strong>
                      {previewNewBreakdown.breakdownLabel && (
                        <span className="block text-[10px] text-slate-400">
                          ({previewNewBreakdown.breakdownLabel})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(onViewDetails || onUseCodeAnyway) && (
              <div className="pt-1 flex justify-start">
                {onViewDetails ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewDetails(activeProduct);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 hover:underline font-medium cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver ficha técnica completa</span>
                  </button>
                ) : onUseCodeAnyway ? (
                  <button
                    type="button"
                    onClick={() => {
                      onUseCodeAnyway(activeProduct.code);
                      onClose();
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                  >
                    Usar código de todas formas
                  </button>
                ) : null}
              </div>
            )}
          </ModalBody>

          <ModalFooter shortcutLabel="para confirmar">
            <CancelButton onClick={onClose} disabled={isSubmitting} />
            <button
              type="submit"
              disabled={isSubmitting || calculation.deltaStock <= 0}
              className={modalPrimaryButtonClass}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Actualizando stock...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span className="tabular-nums">
                    Sumar +{isBox ? `${formatCleanDecimal(calculation.deltaStock, 2)} cajas` : `${calculation.deltaStock} und`}
                  </span>
                </>
              )}
            </button>
          </ModalFooter>
        </form>
      )}
    </ModalShell>
  );
};
