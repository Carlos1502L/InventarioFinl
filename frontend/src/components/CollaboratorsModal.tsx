import React, { useState, useEffect } from 'react';
import { X, Users, UserPlus, Mail, Shield, Trash2, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, API_BASE_URL, formatDate } from '../lib/supabase';
import { InventoryInvitation } from '../types/database';

interface CollaboratorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CollaboratorsModal: React.FC<CollaboratorsModalProps> = ({ isOpen, onClose }) => {
  const { currentInventory, user, session } = useAuth();
  const [emailToInvite, setEmailToInvite] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<InventoryInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isOwner = currentInventory?.owner_id === user?.id;

  const loadCollaborators = async () => {
    if (!currentInventory) return;
    try {
      setLoading(true);

      // Cargar miembros
      const { data: memberData } = await supabase
        .from('inventory_users')
        .select(`
          id,
          role,
          created_at,
          user_id,
          profiles (
            id,
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('inventory_id', currentInventory.id);

      // Cargar invitaciones pendientes
      const { data: invData } = await supabase
        .from('inventory_invitations')
        .select('*')
        .eq('inventory_id', currentInventory.id)
        .eq('status', 'pending');

      setMembers(memberData || []);
      setInvitations(invData || []);
    } catch (err) {
      console.error('Error cargando colaboradores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentInventory) {
      loadCollaborators();
      setEmailToInvite('');
      setFeedbackMsg(null);
    }
  }, [isOpen, currentInventory]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !emailToInvite.trim() || !user) return;

    try {
      setIsInviting(true);
      setFeedbackMsg(null);

      // Intentar vía endpoint backend de Render primero
      const token = session?.access_token;
      let success = false;

      if (token) {
        try {
          const resp = await fetch(`${API_BASE_URL}/api/collaborators/invite`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              inventory_id: currentInventory.id,
              email: emailToInvite.trim().toLowerCase(),
              role: 'collaborator'
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            setFeedbackMsg({ text: data.message, type: 'success' });
            success = true;
          }
        } catch {
          // Si el backend Render aún no responde o está en reposo, recurrimos a Supabase directo
        }
      }

      if (!success) {
        // Inserción directa en tabla de invitaciones
        const { error: invError } = await supabase.from('inventory_invitations').insert({
          inventory_id: currentInventory.id,
          email: emailToInvite.trim().toLowerCase(),
          role: 'collaborator',
          invited_by: user.id
        });

        if (invError) {
          if (invError.code === '23505') {
            throw new Error('Ya existe una invitación pendiente para este correo.');
          }
          throw invError;
        }

        setFeedbackMsg({
          text: `Invitación registrada para ${emailToInvite}. El usuario tendrá acceso al ingresar.`,
          type: 'success'
        });
      }

      setEmailToInvite('');
      loadCollaborators();
    } catch (err: any) {
      console.error('Error invitando:', err);
      setFeedbackMsg({ text: err.message || 'Error al enviar la invitación.', type: 'error' });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (membershipId: string, memberUserId: string) => {
    if (memberUserId === currentInventory?.owner_id) {
      alert('No puedes remover al dueño del inventario.');
      return;
    }
    if (!confirm('¿Seguro de remover este colaborador? Perderá acceso a este inventario.')) return;

    try {
      const { error } = await supabase.from('inventory_users').delete().eq('id', membershipId);
      if (error) throw error;
      loadCollaborators();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleCancelInvitation = async (invId: string) => {
    try {
      const { error } = await supabase.from('inventory_invitations').delete().eq('id', invId);
      if (error) throw error;
      loadCollaborators();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Equipo y Colaboradores</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Trabajo colaborativo multi-usuario en tiempo real</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 overflow-y-auto space-y-6">
          {feedbackMsg && (
            <div
              className={`p-3 rounded-xl text-xs border ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400'
              }`}
            >
              {feedbackMsg.text}
            </div>
          )}

          {/* Formulario de Invitación */}
          <form onSubmit={handleInvite} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> Invitar Nuevo Colaborador
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Invita a un miembro por su correo electrónico. Tendrá acceso completo a consultar, crear, mover y retirar productos en este inventario.
            </p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="email"
                  value={emailToInvite}
                  onChange={e => setEmailToInvite(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
              <button
                type="submit"
                disabled={isInviting || !emailToInvite.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all active:scale-95 whitespace-nowrap"
              >
                {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                Invitar
              </button>
            </div>
          </form>

          {/* Miembros Activos */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
              Miembros con Acceso ({members.length})
            </span>

            {loading ? (
              <p className="text-xs text-slate-400 text-center py-4">Cargando equipo...</p>
            ) : (
              members.map(m => {
                const profile = m.profiles || {};
                const isMemberOwner = m.role === 'owner';

                return (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                        {(profile.full_name || profile.email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {profile.full_name || profile.email}
                          </h4>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${
                              isMemberOwner
                                ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                                : 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                            }`}
                          >
                            <Shield className="w-2.5 h-2.5" />
                            {isMemberOwner ? 'Dueño' : 'Colaborador'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{profile.email}</p>
                      </div>
                    </div>

                    {isOwner && !isMemberOwner && (
                      <button
                        onClick={() => handleRemoveMember(m.id, m.user_id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                        title="Remover colaborador"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Invitaciones Pendientes */}
          {invitations.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" /> Invitaciones Pendientes ({invitations.length})
              </span>

              {invitations.map(inv => (
                <div
                  key={inv.id}
                  className="p-3 bg-amber-50/50 dark:bg-amber-500/5 rounded-2xl border border-amber-200 dark:border-amber-500/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{inv.email}</p>
                      <span className="text-[10px] text-amber-700 dark:text-amber-400/80">
                        Esperando inicio de sesión o registro • {formatDate(inv.created_at)}
                      </span>
                    </div>
                  </div>

                  {isOwner && (
                    <button
                      onClick={() => handleCancelInvitation(inv.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                      title="Cancelar invitación"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
