import React, { useState } from 'react';
import { Mail, Check, X, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const PendingInvitationsBanner: React.FC = () => {
  const { pendingInvitations, acceptInvitation, rejectInvitation } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!pendingInvitations || pendingInvitations.length === 0) return null;

  return (
    <div className="mb-6 space-y-2 font-mono">
      {pendingInvitations.map((inv) => (
        <div
          key={inv.id}
          className="p-4 bg-[#ffffff] border border-[#E5E7EB] rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs uppercase"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-[#1E3A5F]" />
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-[#1E3A5F]">
                INVITACIÓN PARA COLABORAR EN: <span className="underline decoration-[#E8B4A0]">{inv.inventories?.name || 'INVENTARIO'}</span>
              </p>
              <p className="text-[10px] text-[#616161] tracking-wider mt-0.5">
                ROL: {inv.role === 'owner' ? 'PROPIETARIO' : 'COLABORADOR'} // ¿Confirmas tu ingreso a este depósito?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={async () => {
                setProcessingId(inv.id);
                await rejectInvitation(inv.id);
                setProcessingId(null);
              }}
              disabled={processingId === inv.id}
              className="flex-1 sm:flex-none min-h-[36px] px-4 rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] text-[#616161] hover:text-[#1E3A5F] text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5 inline mr-1" /> Rechazar
            </button>
            <button
              onClick={async () => {
                setProcessingId(inv.id);
                await acceptInvitation(inv.id, inv.inventory_id, inv.role);
                setProcessingId(null);
              }}
              disabled={processingId === inv.id}
              className="flex-1 sm:flex-none min-h-[36px] px-5 rounded-full bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
            >
              {processingId === inv.id ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> Procesando...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-[#E8B4A0]" /> Aceptar Invitación
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
