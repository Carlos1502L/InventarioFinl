import React, { useState } from 'react';
import { X, Archive, AlertTriangle, Loader2, Check } from 'lucide-react';
import { Product } from '../../types/database';
import { supabase, logAuditAction } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

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
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>('Venta regular');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const maxStock = product.stock || 0;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !user) return;

    const finalReason = reason === 'Otro' ? (customReason || 'Sin especificar') : reason;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      if (withdrawMode === 'partial') {
        if (quantity <= 0 || quantity > maxStock) {
          setErrorMsg(`La cantidad a retirar debe estar entre 1 y ${maxStock}.`);
          setIsSubmitting(false);
          return;
        }

        const newStock = maxStock - quantity;

        const { error: updateError } = await supabase
          .from('products')
          .update({
            stock: newStock,
            last_modified_by: user.id,
            last_modified_by_email: user.email
          })
          .eq('id', product.id);

        if (updateError) throw updateError;

        await logAuditAction({
          inventoryId: currentInventory.id,
          productId: product.id,
          productName: product.name,
          actionType: 'WITHDRAW',
          details: `Retiro de ${quantity} unidades por motivo: "${finalReason}". Stock restante: ${newStock} uds.`,
          metadata: {
            withdrawn_quantity: quantity,
            previous_stock: maxStock,
            new_stock: newStock,
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
          // Si la base de datos aún no tiene la migración para 'INACTIVE', intentar 'WITHDRAWN'
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
          details: `Producto dado de baja: estado cambiado a Inactivo. Motivo: "${finalReason}". Puede reactivarse en cualquier momento desde su ficha.`,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-md overflow-hidden shadow-xl flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#ffffff]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
              <Archive className="w-5 h-5 text-[#1E3A5F]" />
            </div>
            <div>
              <h3 className="font-light text-[#1E3A5F] text-base uppercase tracking-tight">Retirar o Dar de Baja</h3>
              <p className="text-[11px] text-[#616161]">Salida de stock y control de mermas</p>
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
          <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] space-y-1">
            <p className="text-sm font-medium text-[#1E3A5F] uppercase">{product.name}</p>
            <p className="text-xs text-[#616161] font-mono">REF: {product.code}</p>
            <p className="text-xs text-[#1E3A5F] pt-1">
              Stock disponible: <strong className="font-semibold">{maxStock} unidades</strong>
            </p>
          </div>

          {/* Selector de Modo */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl text-xs">
            <button
              type="button"
              onClick={() => setWithdrawMode('partial')}
              className={`min-h-[40px] uppercase tracking-wider rounded-xl transition-all ${
                withdrawMode === 'partial'
                  ? 'bg-[#1E3A5F] text-white shadow-sm'
                  : 'text-[#616161] hover:text-[#1E3A5F]'
              }`}
            >
              Descontar Unidades
            </button>
            <button
              type="button"
              onClick={() => setWithdrawMode('full')}
              className={`min-h-[40px] uppercase tracking-wider rounded-xl transition-all ${
                withdrawMode === 'full'
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'text-[#616161] hover:text-rose-700'
              }`}
            >
              Dar de Baja Total
            </button>
          </div>

          {/* Cantidad a retirar (si es parcial) */}
          {withdrawMode === 'partial' ? (
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                CANTIDAD DE UNIDADES A RETIRAR <span className="text-[#E8B4A0]">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={maxStock}
                  value={quantity}
                  onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
                  required
                  className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                />
                <span className="text-xs text-[#616161] whitespace-nowrap">de {maxStock} uds</span>
              </div>
            </div>
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
            <label className="block text-xs uppercase tracking-wider text-[#1E3A5F] mb-1.5">
              MOTIVO DEL RETIRO / BAJA
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] mb-2"
            >
              <option value="Venta regular">Venta regular</option>
              <option value="Dañado / Defectuoso">Dañado / Defectuoso</option>
              <option value="Vencido / Expirado">Vencido / Expirado</option>
              <option value="Merma o pérdida">Merma o pérdida</option>
              <option value="Uso interno">Uso interno de la empresa</option>
              <option value="Otro">Otro motivo personalizado...</option>
            </select>

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
          <div className="pt-3 border-t border-[#E5E7EB] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 text-xs uppercase tracking-wider text-[#1E3A5F] hover:bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || maxStock <= 0}
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
                  <span>Confirmar Retiro</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
