import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, AlertTriangle, Loader2, Check, Layers } from 'lucide-react';
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
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  modalFieldInputClass,
  modalFieldLabelClass,
  modalSurfaceCardClass,
  modalPrimaryButtonClass,
  modalDangerButtonClass
} from './ModalShell';

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
  const lastProductRef = useRef<Product | null>(null);
  if (product) {
    lastProductRef.current = product;
  }
  const activeProduct = product || lastProductRef.current;

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

  const isBox = activeProduct?.unit_type === 'BOX' && Number(activeProduct?.units_per_box) > 0;
  const unitsPerBox = Number(activeProduct?.units_per_box || 1);
  const maxStock = Number(activeProduct?.stock || 0);

  // Cálculo reactivo de descuento de existencias / mermas
  const calculation = useMemo(() => {
    if (!activeProduct) {
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
  }, [activeProduct, isBox, boxesToWithdraw, looseUnitsToWithdraw, quantity, unitsPerBox, maxStock]);

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
    if (!currentInventory || !user || !activeProduct) return;

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
              ? `El descuento solicitado (${formatCleanDecimal(calculation.deltaStock, 2)} cajas) supera el stock disponible (${formatStockDisplay(activeProduct)}).`
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
          .eq('id', activeProduct.id);

        if (updateError) throw updateError;

        const detailsMsg = isBox
          ? `Descuento por merma/consumo (CAJA): -${formatCleanDecimal(calculation.deltaStock, 2)} cajas (Cajas: ${parseFloat(boxesToWithdraw) || 0}, Unidades sueltas: ${parseInt(looseUnitsToWithdraw, 10) || 0} / ${unitsPerBox} und) por motivo: "${finalReason}". Stock restante: ${formatCleanDecimal(safeNewStock, 2)} cajas.`
          : `Retiro de ${calculation.deltaStock} und por motivo: "${finalReason}". Stock restante: ${safeNewStock} und.`;

        await logAuditAction({
          inventoryId: currentInventory.id,
          productId: activeProduct.id,
          productName: activeProduct.name,
          actionType: 'WITHDRAW',
          details: detailsMsg,
          metadata: {
            withdrawn_quantity: calculation.deltaStock,
            previous_stock: maxStock,
            new_stock: safeNewStock,
            unit_type: activeProduct.unit_type || 'UNIT',
            units_per_box: activeProduct.units_per_box || null,
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
          .eq('id', activeProduct.id);

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
            .eq('id', activeProduct.id);

          archiveError = errWithdrawn;
        }

        if (archiveError) throw archiveError;

        await logAuditAction({
          inventoryId: currentInventory.id,
          productId: activeProduct.id,
          productName: activeProduct.name,
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
    <ModalShell
      isOpen={Boolean(isOpen && activeProduct)}
      onClose={onClose}
      maxWidth="sm"
      disableDismiss={isSubmitting}
      formId="withdraw-product-form"
    >
      <ModalHeader
        title="Retirar o descontar stock"
        subtitle="Salida de existencias, consumo y control de mermas"
        icon={<Archive className="w-4 h-4 lg:w-5 lg:h-5" />}
        iconTone={withdrawMode === 'full' ? 'rose' : 'amber'}
        onClose={onClose}
        closeDisabled={isSubmitting}
      />

      {activeProduct && (
        <form
          id="withdraw-product-form"
          onSubmit={handleWithdraw}
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
        >
          <ModalBody className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-200">
                {errorMsg}
              </div>
            )}

            {/* Resumen del producto */}
            <div className={`${modalSurfaceCardClass} space-y-1.5`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-100 truncate">{activeProduct.name}</p>
                <span className="font-mono px-2 py-0.5 rounded-md text-[10px] bg-slate-800 border border-slate-700 text-slate-200 font-semibold shrink-0">
                  {isBox ? 'BOX' : 'UNIT'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">REF: {activeProduct.code}</p>
              <p className="text-xs text-slate-300 pt-1">
                Stock disponible:{' '}
                <strong className="font-mono tabular-nums text-slate-100">
                  {formatStockDisplay(activeProduct)}
                </strong>
                {isBox && currentBreakdown.breakdownLabel && (
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 ml-1.5">
                    ({currentBreakdown.breakdownLabel})
                  </span>
                )}
              </p>
            </div>

            {/* Selector de Modo */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/75 border border-slate-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setWithdrawMode('partial')}
                className={`min-h-[42px] lg:min-h-[36px] px-3 rounded-lg transition-colors font-semibold cursor-pointer ${
                  withdrawMode === 'partial'
                    ? 'bg-slate-100 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Descontar merma
              </button>
              <button
                type="button"
                onClick={() => setWithdrawMode('full')}
                className={`min-h-[42px] lg:min-h-[36px] px-3 rounded-lg transition-colors font-semibold cursor-pointer ${
                  withdrawMode === 'full'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-rose-300'
                }`}
              >
                Dar de baja total
              </button>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {withdrawMode === 'partial' ? (
                <motion.div
                  key="withdraw-partial"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14 }}
                >
                  {!isBox ? (
                    <div>
                      <label className={modalFieldLabelClass}>
                        Cantidad de unidades a descontar <span className="text-rose-400">*</span>
                      </label>
                      <div className="flex items-center gap-2.5">
                        <input
                          type="number"
                          min="1"
                          max={maxStock}
                          value={quantity}
                          onChange={e => setQuantity(e.target.value)}
                          required
                          className={`${modalFieldInputClass} font-mono tabular-nums`}
                        />
                        <span className="text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap shrink-0">
                          de {maxStock} und
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 text-xs text-slate-200">
                        <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="font-mono tabular-nums">
                          Equivalencia: <strong>1 caja = {unitsPerBox} unidades</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={modalFieldLabelClass}>Unidades sueltas</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={looseUnitsToWithdraw}
                            onChange={e => setLooseUnitsToWithdraw(e.target.value)}
                            className={`${modalFieldInputClass} font-mono tabular-nums`}
                          />
                        </div>

                        <div>
                          <label className={modalFieldLabelClass}>Cajas a descontar</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={boxesToWithdraw}
                            onChange={e => setBoxesToWithdraw(e.target.value)}
                            className={`${modalFieldInputClass} font-mono tabular-nums`}
                          />
                        </div>
                      </div>

                      <div className={`${modalSurfaceCardClass} space-y-1.5 text-xs`}>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Fracción a restar</span>
                          <strong className="font-mono tabular-nums text-rose-300">
                            -{formatCleanDecimal(calculation.deltaStock, 2)} cajas
                          </strong>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                          <span className="text-slate-400">Balance resultante</span>
                          <div className="text-right font-mono tabular-nums">
                            <strong className="text-slate-100">
                              {formatCleanDecimal(Math.max(0, calculation.remainingStock), 2)} cajas
                            </strong>
                            {remainingBreakdown.breakdownLabel && (
                              <span className="block text-[10px] text-slate-400">
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
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14 }}
                  className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-200 leading-relaxed">
                    El producto se marcará como <strong className="font-mono text-white">INACTIVE</strong> y dejará de figurar en el inventario activo de ventas.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Motivo */}
            <div>
              <label className={modalFieldLabelClass}>Motivo del retiro / merma</label>
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
                  className={modalFieldInputClass}
                />
              )}
            </div>
          </ModalBody>

          <ModalFooter shortcutLabel="para confirmar">
            <CancelButton onClick={onClose} disabled={isSubmitting} />
            <button
              type="submit"
              disabled={isSubmitting || (withdrawMode === 'partial' && maxStock <= 0)}
              className={withdrawMode === 'full' ? modalDangerButtonClass : modalPrimaryButtonClass}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{withdrawMode === 'full' ? 'Confirmar baja total' : 'Confirmar descuento'}</span>
                </>
              )}
            </button>
          </ModalFooter>
        </form>
      )}
    </ModalShell>
  );
};
