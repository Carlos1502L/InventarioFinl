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
          className="p-4 bg-white border border-slate-200 rounded-2xl shadow-ui-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                Invitación para colaborar en <span className="underline decoration-slate-300 underline-offset-2">{inv.inventories?.name || 'Inventario'}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Rol asignado: <span className="font-mono font-medium text-slate-700">{inv.role === 'owner' ? 'Propietario' : 'Colaborador'}</span> · Confirma tu ingreso a este depósito
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
            <button
              onClick={async () => {
                setProcessingId(inv.id);
                await rejectInvitation(inv.id);
                setProcessingId(null);
              }}
              disabled={processingId === inv.id}
              className="flex-1 sm:flex-none min-h-[36px] px-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Rechazar
            </button>
            <button
              onClick={async () => {
                setProcessingId(inv.id);
                await acceptInvitation(inv.id, inv.inventory_id, inv.role);
                setProcessingId(null);
              }}
              disabled={processingId === inv.id}
              className="flex-1 sm:flex-none min-h-[36px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {processingId === inv.id ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> Procesando...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Aceptar invitación
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
