import React, { useState, useEffect, useMemo } from 'react';
import { X, Barcode, Plus, Package, Loader2, Eye, AlertCircle, Layers } from 'lucide-react';
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

  const isBox = product?.unit_type === 'BOX' && Number(product?.units_per_box) > 0;
  const unitsPerBox = Number(product?.units_per_box || 1);
  const currentStock = Number(product?.stock || 0);

  // Cálculo de ingreso consolidado en tiempo real
  const calculation = useMemo(() => {
    if (!product) {
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
  }, [product, isBox, boxesToAdd, looseUnitsToAdd, unitsToAdd, unitsPerBox, currentStock]);

  if (!isOpen || !product) return null;

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
        .eq('id', product.id);

      if (updateError) throw updateError;

      const auditDetails = isBox
        ? `Reingreso de stock (CAJA): +${formatCleanDecimal(calculation.deltaStock, 2)} cajas (Cajas: ${ parseFloat(boxesToAdd) || 0 }, Unidades sueltas: ${ parseInt(looseUnitsToAdd, 10) || 0 }, Equiv: 1 caja = ${unitsPerBox} und). Nuevo balance: ${formatCleanDecimal(calculation.newStock, 2)} cajas.`
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 max-md:bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="mobile-dark-modal bg-white border border-[#E5E7EB] rounded-2xl w-full max-w-md overflow-hidden shadow-xl flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#E8B4A0]/25 text-[#1E3A5F] border border-[#E8B4A0] flex items-center justify-center flex-shrink-0">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#E8B4A0] block font-bold">
                REINGRESO DE EXISTENCIAS // {isBox ? 'MODO CAJA' : 'MODO UNIDAD'}
              </span>
              <h4 className="font-bold text-[#1E3A5F] text-sm sm:text-base uppercase tracking-tight">
                Producto Existente
              </h4>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <form onSubmit={handleConfirmRestock} className="p-6 space-y-4 font-mono">
          <p className="mobile-flat-section text-xs text-[#1E3A5F] font-sans font-medium bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl p-3">
            El producto ya existe en el sistema. ¿Deseas añadir más existencias?
          </p>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Ficha Resumen del Producto */}
          <div className="mobile-flat-row p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-[#1E3A5F] text-sm uppercase truncate">{product.name}</p>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#1E3A5F] text-white uppercase shrink-0">
                {isBox ? 'CAJA (BOX)' : 'UNIDAD (UNIT)'}
              </span>
            </div>
            <p className="text-[#616161]">
              SKU / REF: <strong className="text-[#1E3A5F]">{product.code}</strong>
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-[#E5E7EB]/80">
              <span className="text-[#616161]">Stock actual:</span>
              <div className="text-right">
                <strong className="text-[#1E3A5F] text-sm">{formatStockDisplay(product)}</strong>
                {isBox && currentBreakdown.breakdownLabel && (
                  <span className="block text-[10px] text-[#616161]">{currentBreakdown.breakdownLabel}</span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#616161]">Precio unitario:</span>
              <strong className="text-[#1E3A5F]">{formatCurrency(product.price, currentInventory?.currency)}</strong>
            </div>
          </div>

          {/* Inputs según tipo de unidad (UNIT vs BOX) */}
          {!isBox ? (
            /* FLUJO TIPO UNIT */
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#1E3A5F]">
                Unidades a añadir: <span className="text-[#E8B4A0]">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={unitsToAdd}
                onChange={e => setUnitsToAdd(e.target.value)}
                required
                className="w-full min-h-[44px] bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl px-4 py-2 text-sm font-mono text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
              />
              <div className="p-3 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl flex items-center justify-between text-xs">
                <span className="text-[#616161]">Nuevo Stock Resultante:</span>
                <strong className="text-[#1E3A5F] text-sm">
                  {currentStock} + {Math.max(0, parseInt(unitsToAdd, 10) || 0)} = {calculation.newStock} und
                </strong>
              </div>
            </div>
          ) : (
            /* FLUJO TIPO BOX (INTERFAZ DUAL COMBINABLE) */
            <div className="space-y-3">
              <div className="px-3 py-2 rounded-xl bg-[#1E3A5F]/5 border border-[#1E3A5F]/15 flex items-center justify-between text-xs text-[#1E3A5F]">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Layers className="w-3.5 h-3.5 text-[#1E3A5F]" />
                  Equivalencia: 1 caja = {unitsPerBox} unidades
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1E3A5F] mb-1">
                    Cajas a ingresar:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={boxesToAdd}
                    onChange={e => setBoxesToAdd(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[44px] bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl px-3.5 py-2 text-sm font-mono text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1E3A5F] mb-1">
                    Unidades sueltas a ingresar:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={looseUnitsToAdd}
                    onChange={e => setLooseUnitsToAdd(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[44px] bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl px-3.5 py-2 text-sm font-mono text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                  />
                </div>
              </div>

              {/* Resumen de Conversión Consolidada */}
              <div className="p-3.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#616161]">Ingreso consolidado (Δ Cajas):</span>
                  <strong className="text-[#1E3A5F]">
                    +{formatCleanDecimal(calculation.deltaStock, 2)} {calculation.deltaStock === 1 ? 'caja' : 'cajas'}
                  </strong>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#E5E7EB]">
                  <span className="text-[#616161]">Nuevo Stock Total:</span>
                  <div className="text-right">
                    <strong className="text-[#1E3A5F] text-sm">
                      {formatCleanDecimal(calculation.newStock, 2)} {calculation.newStock === 1 ? 'caja' : 'cajas'}
                    </strong>
                    {previewNewBreakdown.breakdownLabel && (
                      <span className="block text-[10px] text-[#616161]">
                        ({previewNewBreakdown.breakdownLabel})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting || calculation.deltaStock <= 0}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider font-semibold rounded-full shadow-sm active:scale-95 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Actualizando Stock...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-[#E8B4A0]" />
                  <span>
                    Sumar +{isBox ? `${formatCleanDecimal(calculation.deltaStock, 2)} cajas` : `${calculation.deltaStock} und`} al Stock
                  </span>
                </>
              )}
            </button>

            <div className="flex max-md:flex-col items-center justify-between gap-2 pt-2 border-t border-[#E5E7EB] max-md:border-0">
              {onViewDetails ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewDetails(product);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#1E3A5F] hover:underline font-medium"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver ficha técnica</span>
                </button>
              ) : onUseCodeAnyway ? (
                <button
                  type="button"
                  onClick={() => {
                    onUseCodeAnyway(product.code);
                    onClose();
                  }}
                  className="text-xs text-[#616161] hover:text-[#1E3A5F] transition-colors"
                >
                  Usar código de todas formas
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={onClose}
                className="mobile-cancel-btn px-4 py-1.5 text-xs font-medium text-[#1E3A5F] hover:bg-[#F8F9FA] rounded-full border border-[#E5E7EB] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
