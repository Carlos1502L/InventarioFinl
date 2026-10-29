import React, { useState, useEffect, useMemo } from 'react';
import { X, Archive, AlertTriangle, Loader2, Check, Layers } from 'lucide-react';
import { Product } from '../../types/database';
import {
  supabase,
  logAuditAction,
  formatCleanDecimal,
  formatStockDisplay,
  getBoxBreakdown
} from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { MinimalDropdown } from '../ui/MinimalDropdown';

interface WithdrawProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onWithdrawn: () => void;
}

export const WithdrawProductModal: React.FC<WithdrawProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onWithdrawn
}) => {
  const { currentInventory, user } = useAuth();
  const [withdrawMode, setWithdrawMode] = useState<'partial' | 'full'>('partial');

  // Modo UNIT
  const [quantity, setQuantity] = useState<string>('1');

  // Modo BOX (permite descontar cajas y/o unidades sueltas por merma/consumo)
  const [boxesToWithdraw, setBoxesToWithdraw] = useState<string>('0');
  const [looseUnitsToWithdraw, setLooseUnitsToWithdraw] = useState<string>('1');

  const [reason, setReason] = useState<string>('Merma o pérdida');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      setWithdrawMode('partial');
      setQuantity('1');
      setBoxesToWithdraw('0');
      setLooseUnitsToWithdraw('1');
      setErrorMsg(null);
    }
  }, [isOpen, product]);

  const isBox = product?.unit_type === 'BOX' && Number(product?.units_per_box) > 0;
  const unitsPerBox = Number(product?.units_per_box || 1);
  const maxStock = Number(product?.stock || 0);

  // Cálculo reactivo de descuento de existencias / mermas
  const calculation = useMemo(() => {
    if (!product) {
      return { deltaStock: 0, remainingStock: 0 };
    }

    if (isBox) {
      const parsedBoxes = Math.max(0, parseFloat(boxesToWithdraw) || 0);
      const parsedLoose = Math.max(0, parseInt(looseUnitsToWithdraw, 10) || 0);
      const deltaBoxes = Number((parsedBoxes + parsedLoose / unitsPerBox).toFixed(4));
      const remaining = Number((maxStock - deltaBoxes).toFixed(4));
      return {
        deltaStock: deltaBoxes,
        remainingStock: remaining
      };
    } else {
      const parsedUnits = Math.max(0, parseInt(quantity, 10) || 0);
      return {
        deltaStock: parsedUnits,
        remainingStock: Math.round(maxStock - parsedUnits)
      };
    }
  }, [product, isBox, boxesToWithdraw, looseUnitsToWithdraw, quantity, unitsPerBox, maxStock]);

  if (!isOpen || !product) return null;

  const currentBreakdown = getBoxBreakdown(product);
  const remainingBreakdown = getBoxBreakdown({
    stock: Math.max(0, calculation.remainingStock),
    unit_type: product.unit_type,
    units_per_box: product.units_per_box
  });

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !user) return;

    const finalReason = reason === 'Otro' ? (customReason || 'Sin especificar') : reason;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      if (withdrawMode === 'partial') {
        if (calculation.deltaStock <= 0) {
          setErrorMsg(
            isBox
              ? 'Ingresa al menos 1 unidad suelta o fracción de caja para descontar.'
              : 'La cantidad a retirar debe ser al menos 1 unidad.'
          );
          setIsSubmitting(false);
          return;
        }

        if (calculation.remainingStock < -0.0001) {
          setErrorMsg(
            isBox
              ? `El descuento solicitado (${formatCleanDecimal(calculation.deltaStock, 2)} cajas) supera el stock disponible (${formatStockDisplay(product)}).`
              : `La cantidad a retirar debe estar entre 1 y ${maxStock} und.`
          );
          setIsSubmitting(false);
          return;
        }

        const safeNewStock = Math.max(0, calculation.remainingStock);

        const { error: updateError } = await supabase
          .from('products')
          .update({
            stock: safeNewStock,
            last_modified_by: user.id,
            last_modified_by_email: user.email,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id);

        if (updateError) throw updateError;

        const detailsMsg = isBox
          ? `Descuento por merma/consumo (CAJA): -${formatCleanDecimal(calculation.deltaStock, 2)} cajas (Cajas: ${parseFloat(boxesToWithdraw) || 0}, Unidades sueltas: ${parseInt(looseUnitsToWithdraw, 10) || 0} / ${unitsPerBox} und) por motivo: "${finalReason}". Stock restante: ${formatCleanDecimal(safeNewStock, 2)} cajas.`
          : `Retiro de ${calculation.deltaStock} und por motivo: "${finalReason}". Stock restante: ${safeNewStock} und.`;

        await logAuditAction({
          inventoryId: currentInventory.id,
          productId: product.id,
          productName: product.name,
          actionType: 'WITHDRAW',
          details: detailsMsg,
          metadata: {
            withdrawn_quantity: calculation.deltaStock,
            previous_stock: maxStock,
            new_stock: safeNewStock,
            unit_type: product.unit_type || 'UNIT',
            units_per_box: product.units_per_box || null,
            reason: finalReason
          }
        });
      } else {
        // Retiro / Baja Total del Inventario -> Estado INACTIVO
        let archiveError: any = null;

        const { error: errInactive } = await supabase
          .from('products')
          .update({
            status: 'INACTIVE',
            withdrawal_reason: finalReason,
            last_modified_by: user.id,
            last_modified_by_email: user.email,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id);

        if (errInactive) {
          const { error: errWithdrawn } = await supabase
            .from('products')
            .update({
              status: 'WITHDRAWN',
              withdrawal_reason: finalReason,
              last_modified_by: user.id,
              last_modified_by_email: user.email,
              updated_at: new Date().toISOString()
            })
            .eq('id', product.id);

          archiveError = errWithdrawn;
        }

        if (archiveError) throw archiveError;

        await logAuditAction({
          inventoryId: currentInventory.id,
          productId: product.id,
          productName: product.name,
          actionType: 'WITHDRAW',
          details: `Producto dado de baja: estado cambiado a Inactivo. Motivo: "${finalReason}".`,
          metadata: {
            reason: finalReason,
            previous_stock: maxStock,
            status: 'INACTIVE',
            decommissioned: true
          }
        });
      }

      onWithdrawn();
      onClose();
    } catch (err: any) {
      console.error('Error al retirar producto:', err);
      setErrorMsg(err.message || 'Error al procesar el retiro del producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 max-md:bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="mobile-dark-modal bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-md overflow-hidden shadow-xl flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#ffffff]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
              <Archive className="w-5 h-5 text-[#1E3A5F]" />
            </div>
            <div>
              <h3 className="font-bold text-[#1E3A5F] text-base uppercase tracking-tight">Retirar o Descontar Stock</h3>
              <p className="text-[11px] text-[#616161]">Salida de existencias, consumo y control de mermas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleWithdraw} className="p-6 space-y-4 font-mono">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* Resumen del producto */}
          <div className="mobile-flat-row p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-[#1E3A5F] uppercase truncate">{product.name}</p>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#1E3A5F] text-white uppercase shrink-0">
                {isBox ? 'CAJA' : 'UNIDAD'}
              </span>
            </div>
            <p className="text-xs text-[#616161] font-mono">REF: {product.code}</p>
            <p className="text-xs text-[#1E3A5F] pt-1">
              Stock disponible: <strong className="font-bold">{formatStockDisplay(product)}</strong>
              {isBox && currentBreakdown.breakdownLabel && (
                <span className="text-[11px] text-[#616161] ml-1.5">({currentBreakdown.breakdownLabel})</span>
              )}
            </p>
          </div>

          {/* Selector de Modo */}
          <div className="mobile-segmented grid grid-cols-2 gap-2 p-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl text-xs">
            <button
              type="button"
              onClick={() => setWithdrawMode('partial')}
              className={`min-h-[40px] uppercase tracking-wider rounded-xl transition-all font-bold ${
                withdrawMode === 'partial'
                  ? 'bg-[#1E3A5F] text-white shadow-sm mobile-pill-active'
                  : 'text-[#616161] hover:text-[#1E3A5F] max-md:text-neutral-400'
              }`}
            >
              Descontar Merma / Uso
            </button>
            <button
              type="button"
              onClick={() => setWithdrawMode('full')}
              className={`min-h-[40px] uppercase tracking-wider rounded-xl transition-all font-bold ${
                withdrawMode === 'full'
                  ? 'bg-rose-700 text-white shadow-sm mobile-pill-active'
                  : 'text-[#616161] hover:text-rose-700 max-md:text-neutral-400'
              }`}
            >
              Dar de Baja Total
            </button>
          </div>

          {/* Cantidad a retirar (si es parcial) */}
          {withdrawMode === 'partial' ? (
            !isBox ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                  CANTIDAD DE UNIDADES A DESCONTAR <span className="text-[#E8B4A0]">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={maxStock}
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    required
                    className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                  />
                  <span className="text-xs text-[#616161] whitespace-nowrap">de {maxStock} und</span>
                </div>
              </div>
            ) : (
              /* Descuento por Mermas / Consumo para Productos Tipo Caja (BOX) */
              <div className="space-y-3">
                <div className="px-3 py-2 rounded-xl bg-[#1E3A5F]/5 border border-[#1E3A5F]/15 flex items-center justify-between text-xs text-[#1E3A5F]">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Layers className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    Equivalencia: 1 caja = {unitsPerBox} unidades
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1E3A5F] mb-1">
                      Unidades sueltas a descontar
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={looseUnitsToWithdraw}
                      onChange={e => setLooseUnitsToWithdraw(e.target.value)}
                      className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1E3A5F] mb-1">
                      Cajas a descontar
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={boxesToWithdraw}
                      onChange={e => setBoxesToWithdraw(e.target.value)}
                      className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                    />
                  </div>
                </div>

                <div className="p-3 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#616161]">Fracción a restar:</span>
                    <strong className="text-rose-700">
                      -{formatCleanDecimal(calculation.deltaStock, 2)} cajas
                    </strong>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#E5E7EB]">
                    <span className="text-[#616161]">Balance resultante:</span>
                    <div className="text-right">
                      <strong className="text-[#1E3A5F]">
                        {formatCleanDecimal(Math.max(0, calculation.remainingStock), 2)} cajas
                      </strong>
                      {remainingBreakdown.breakdownLabel && (
                        <span className="block text-[10px] text-[#616161]">
                          ({remainingBreakdown.breakdownLabel})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-800">
                El producto se marcará como <strong>RETIRADO</strong> y dejará de figurar en el inventario activo de ventas.
              </p>
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
              MOTIVO DEL RETIRO / MERMA
            </label>
            <div className="mb-2">
              <MinimalDropdown
                value={reason}
                onChange={(val) => setReason(val)}
                options={[
                  { value: 'Merma o pérdida', label: 'Merma o pérdida' },
                  { value: 'Consumo / Fracción abierta', label: 'Consumo / Fracción abierta' },
                  { value: 'Dañado / Defectuoso', label: 'Dañado / Defectuoso' },
                  { value: 'Vencido / Expirado', label: 'Vencido / Expirado' },
                  { value: 'Venta regular', label: 'Venta regular' },
                  { value: 'Uso interno', label: 'Uso interno de la empresa' },
                  { value: 'Otro', label: 'Otro motivo personalizado...' }
                ]}
              />
            </div>

            {reason === 'Otro' && (
              <input
                type="text"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Escribe el motivo detallado..."
                required
                className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm text-[#1E3A5F] placeholder:text-[#616161]/50 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
              />
            )}
          </div>

          {/* Acciones */}
          <div className="pt-3 border-t border-[#E5E7EB] max-md:border-0 flex max-md:flex-col-reverse justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="mobile-cancel-btn min-h-[44px] px-5 text-xs uppercase tracking-wider text-[#1E3A5F] hover:bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (withdrawMode === 'partial' && maxStock <= 0)}
              className="min-h-[44px] inline-flex items-center gap-2 px-6 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider font-medium rounded-xl shadow-sm disabled:opacity-50 transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-[#E8B4A0]" />
                  <span>Confirmar Descuento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
