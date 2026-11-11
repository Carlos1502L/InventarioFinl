import React, { useState, useEffect, useMemo } from 'react';
import { X, Archive, AlertTriangle, Loader2, Check, Layers } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { CancelButton } from '../common/CancelButton';
import { useLatestValue, useModalEscape, useModalMotion } from './modalMotion';

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

  const activeProduct = useLatestValue(product);
  const showModal = Boolean(isOpen && activeProduct);
  const { backdropMotion, panelMotion, tabContentMotion } = useModalMotion();
  useModalEscape(showModal, onClose, isSubmitting);

  const currentBreakdown = activeProduct ? getBoxBreakdown(activeProduct) : { isBox: false, breakdownLabel: '' };
  const remainingBreakdown = activeProduct
    ? getBoxBreakdown({
        stock: Math.max(0, calculation.remainingStock),
        unit_type: activeProduct.unit_type,
        units_per_box: activeProduct.units_per_box
      })
    : { isBox: false, breakdownLabel: '' };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !user || !product) return;

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
    <AnimatePresence>
      {showModal && activeProduct && (
        <motion.div
          {...backdropMotion}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 max-md:bg-black/75 backdrop-blur-sm p-4"
        >
          <motion.div
            {...panelMotion}
            className="mobile-dark-modal bg-[#ffffff] border border-[#ececec] rounded-2xl md:rounded-3xl w-full max-w-md overflow-hidden shadow-xl flex flex-col"
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ececec] bg-[#ffffff]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#17191c]/10 text-[#17191c] flex items-center justify-center">
                  <Archive className="w-5 h-5 text-[#17191c]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#17191c] text-base uppercase tracking-tight">Retirar o Descontar Stock</h3>
                  <p className="text-[11px] text-[#777b86]">Salida de existencias, consumo y control de mermas</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#17191c] hover:bg-[#fafafb] border border-[#ececec] transition-colors"
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
              <div className="mobile-flat-row p-4 bg-[#fafafb] rounded-xl border border-[#ececec] space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#17191c] uppercase truncate">{activeProduct.name}</p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#17191c] text-white uppercase shrink-0">
                    {isBox ? 'CAJA' : 'UNIDAD'}
                  </span>
                </div>
                <p className="text-xs text-[#777b86] font-mono">REF: {activeProduct.code}</p>
                <p className="text-xs text-[#17191c] pt-1">
                  Stock disponible: <strong className="font-bold">{formatStockDisplay(activeProduct)}</strong>
                  {isBox && currentBreakdown.breakdownLabel && (
                    <span className="text-[11px] text-[#777b86] ml-1.5">({currentBreakdown.breakdownLabel})</span>
                  )}
                </p>
              </div>

              {/* Selector de Modo */}
              <div className="mobile-segmented grid grid-cols-2 gap-2 p-1 bg-[#fafafb] border border-[#ececec] rounded-2xl text-xs">
                <button
                  type="button"
                  onClick={() => setWithdrawMode('partial')}
                  className={`min-h-[40px] uppercase tracking-wider rounded-xl transition-all font-bold ${
                    withdrawMode === 'partial'
                      ? 'bg-[#17191c] text-white shadow-sm mobile-pill-active'
                      : 'text-[#777b86] hover:text-[#17191c] max-md:text-neutral-400'
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
                      : 'text-[#777b86] hover:text-rose-700 max-md:text-neutral-400'
                  }`}
                >
                  Dar de Baja Total
                </button>
              </div>

              {/* Cantidad a retirar (si es parcial) */}
              <AnimatePresence mode="wait" initial={false}>
                {withdrawMode === 'partial' ? (
                  <motion.div key="withdraw-partial" {...tabContentMotion}>
                    {!isBox ? (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#17191c] mb-1.5">
                          CANTIDAD DE UNIDADES A DESCONTAR <span className="text-[#e7000b]">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={maxStock}
                            value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                            required
                            className="w-full min-h-[44px] bg-white border border-[#ececec] rounded-xl px-4 py-2 text-sm text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                          />
                          <span className="text-xs text-[#777b86] whitespace-nowrap">de {maxStock} und</span>
                        </div>
                      </div>
                    ) : (
                      /* Descuento por Mermas / Consumo para Productos Tipo Caja (BOX) */
                      <div className="space-y-3">
                        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-800">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <Layers className="w-3.5 h-3.5 text-[#17191c]" />
                            Equivalencia: 1 caja = {unitsPerBox} unidades
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#17191c] mb-1">
                              Unidades sueltas a descontar
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={looseUnitsToWithdraw}
                              onChange={e => setLooseUnitsToWithdraw(e.target.value)}
                              className="w-full min-h-[44px] bg-white border border-[#ececec] rounded-xl px-3.5 py-2 text-sm text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#17191c] mb-1">
                              Cajas a descontar
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={boxesToWithdraw}
                              onChange={e => setBoxesToWithdraw(e.target.value)}
                              className="w-full min-h-[44px] bg-white border border-[#ececec] rounded-xl px-3.5 py-2 text-sm text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                            />
                          </div>
                        </div>

                        <div className="p-3 bg-[#fafafb] border border-[#ececec] rounded-xl space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[#777b86]">Fracción a restar:</span>
                            <strong className="text-rose-700">
                              -{formatCleanDecimal(calculation.deltaStock, 2)} cajas
                            </strong>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-[#ececec]">
                            <span className="text-[#777b86]">Balance resultante:</span>
                            <div className="text-right">
                              <strong className="text-[#17191c]">
                                {formatCleanDecimal(Math.max(0, calculation.remainingStock), 2)} cajas
                              </strong>
                              {remainingBreakdown.breakdownLabel && (
                                <span className="block text-[10px] text-[#777b86]">
                                  ({remainingBreakdown.breakdownLabel})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="withdraw-full"
                    {...tabContentMotion}
                    className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-800">
                      El producto se marcará como <strong>RETIRADO</strong> y dejará de figurar en el inventario activo de ventas.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Motivo */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#17191c] mb-1.5">
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

                <AnimatePresence>
                  {reason === 'Otro' && (
                    <motion.div {...tabContentMotion}>
                      <input
                        type="text"
                        value={customReason}
                        onChange={e => setCustomReason(e.target.value)}
                        placeholder="Escribe el motivo detallado..."
                        required
                        className="w-full min-h-[44px] bg-white border border-[#ececec] rounded-xl px-4 py-2 text-sm text-[#17191c] placeholder:text-[#777b86]/50 focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Acciones */}
              <div className="pt-3 border-t border-[#ececec] max-md:border-0 flex max-md:flex-col-reverse justify-end gap-2.5">
                <CancelButton onClick={onClose} />
                <button
                  type="submit"
                  disabled={isSubmitting || (withdrawMode === 'partial' && maxStock <= 0)}
                  className="min-h-[44px] inline-flex items-center gap-2 px-6 bg-[#17191c] hover:bg-black text-white text-xs uppercase tracking-wider font-medium rounded-xl shadow-sm disabled:opacity-50 transition-all active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Confirmar Descuento</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
