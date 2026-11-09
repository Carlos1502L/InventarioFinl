import React, { useState } from 'react';
import { Mail, Check, X, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const PendingInvitationsBanner: React.FC = () => {
  const { pendingInvitations, acceptInvitation, rejectInvitation } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!pendingInvitations || pendingInvitations.length === 0) return null;

  return (
    <div className="mb-6 space-y-2 font-sans">
      {pendingInvitations.map((inv) => (
        <div
          key={inv.id}
          className="p-4 bg-white border border-gray-100 rounded-2xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] text-[#15803D] flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-[#15803D]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#0F291E]">
                Invitación para colaborar en:{' '}
                <span className="underline decoration-[#BBF7D0]">{inv.inventories?.name || 'Inventario'}</span>
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Rol: <span className="font-medium text-neutral-800 capitalize">{inv.role === 'owner' ? 'Propietario' : 'Colaborador'}</span> · ¿Confirmas tu ingreso a este depósito?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={async () => {
                setProcessingId(inv.id);
                await rejectInvitation(inv.id);
                setProcessingId(null);
              }}
              disabled={processingId === inv.id}
              className="flex-1 sm:flex-none min-h-[36px] px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-neutral-600 hover:text-neutral-900 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 inline mr-1" /> Rechazar
            </button>
            <button
              type="button"
              onClick={async () => {
                setProcessingId(inv.id);
                await acceptInvitation(inv.id, inv.inventory_id, inv.role);
                setProcessingId(null);
              }}
              disabled={processingId === inv.id}
              className="flex-1 sm:flex-none min-h-[36px] px-5 rounded-xl bg-[#0F291E] hover:bg-[#1B3D2F] text-white text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            >
              {processingId === inv.id ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> Procesando...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-[#BBF7D0]" /> Aceptar Invitación
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
