import React, { useState } from 'react';
import { Mail, Check, X, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const PendingInvitationsBanner: React.FC = () => {
  const { pendingInvitations, acceptInvitation, rejectInvitation } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!pendingInvitations || pendingInvitations.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {pendingInvitations.map((inv) => (
        <div
          key={inv.id}
          className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Invitación para colaborar en: <span className="text-blue-600 dark:text-blue-400 font-extrabold">{inv.inventories?.name || 'Inventario'}</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Has sido invitado con rol de <span className="font-semibold">{inv.role === 'owner' ? 'Dueño' : 'Colaborador'}</span>. ¿Deseas unirte a este inventario?
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
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors disabled:opacity-50"
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
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {processingId === inv.id ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Procesando...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Aceptar Invitación
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
