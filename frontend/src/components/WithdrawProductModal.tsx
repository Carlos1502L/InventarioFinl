import React, { useState } from 'react';
import { X, Archive, AlertTriangle, Loader2, Check } from 'lucide-react';
import { Product } from '../types/database';
import { supabase, logAuditAction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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
        // Retiro / Baja Total del Inventario
        const { error: archiveError } = await supabase
          .from('products')
          .update({
            status: 'WITHDRAWN',
            withdrawal_reason: finalReason,
            last_modified_by: user.id,
            last_modified_by_email: user.email
          })
          .eq('id', product.id);

        if (archiveError) throw archiveError;

        await logAuditAction({
          inventoryId: currentInventory.id,
          productId: product.id,
          productName: product.name,
          actionType: 'WITHDRAW',
          details: `Producto dado de baja completamente del inventario activo. Motivo: "${finalReason}".`,
          metadata: {
            reason: finalReason,
            previous_stock: maxStock,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-600/20 text-rose-400 rounded-lg">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Retirar o Dar de Baja</h3>
              <p className="text-xs text-slate-400">Salida de stock y control de mermas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleWithdraw} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {errorMsg}
            </div>
          )}

          {/* Resumen del producto */}
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <p className="text-sm font-bold text-white">{product.name}</p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Código: {product.code}</p>
            <p className="text-xs text-slate-300 mt-1">
              Stock disponible: <strong className="text-blue-400">{maxStock} unidades</strong>
            </p>
          </div>

          {/* Selector de Modo */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setWithdrawMode('partial')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                withdrawMode === 'partial'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Descontar Cantidad
            </button>
            <button
              type="button"
              onClick={() => setWithdrawMode('full')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                withdrawMode === 'full'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dar de Baja Total
            </button>
          </div>

          {/* Cantidad a retirar (si es parcial) */}
          {withdrawMode === 'partial' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Cantidad de unidades a retirar <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={maxStock}
                  value={quantity}
                  onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <span className="text-xs text-slate-400 whitespace-nowrap">de {maxStock} uds</span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                El producto se marcará como <strong>RETIRADO</strong> y dejará de figurar en el inventario activo de ventas.
              </p>
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Motivo del Retiro / Baja
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500 mb-2"
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
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            )}
          </div>

          {/* Acciones */}
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || maxStock <= 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-600/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Procesando...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Confirmar Retiro
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
