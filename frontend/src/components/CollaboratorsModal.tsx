import React, { useState, useEffect } from 'react';
import { X, Users, UserPlus, Mail, Shield, Trash2, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, API_BASE_URL, formatDate } from '../lib/supabase';
import { InventoryUser, InventoryInvitation } from '../types/database';

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
          // Fallback a Supabase directo si el backend aún no está activo
        }
      }

      if (!success) {
        // Fallback: Inserción directa en inventory_invitations de Supabase
        const cleanEmail = emailToInvite.trim().toLowerCase();

        // Verificar si el usuario ya existe en perfiles
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (existingProfile) {
          const { error: addErr } = await supabase
            .from('inventory_users')
            .insert({
              inventory_id: currentInventory.id,
              user_id: existingProfile.id,
              role: 'collaborator'
            });

          if (addErr) throw addErr;
          setFeedbackMsg({
            text: `El usuario ${cleanEmail} ya tenía cuenta y fue añadido directamente.`,
            type: 'success'
          });
        } else {
          const { error: invErr } = await supabase
            .from('inventory_invitations')
            .upsert({
              inventory_id: currentInventory.id,
              email: cleanEmail,
              role: 'collaborator',
              status: 'pending',
              invited_by: user.id
            });

          if (invErr) throw invErr;
          setFeedbackMsg({
            text: `Invitación enviada a ${cleanEmail}. Se vinculará cuando cree su cuenta.`,
            type: 'success'
          });
        }
      }

      setEmailToInvite('');
      await loadCollaborators();
    } catch (err: any) {
      console.error('Error al invitar colaborador:', err);
      setFeedbackMsg({
        text: err.message || 'Error al procesar la invitación.',
        type: 'error'
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!currentInventory || !isOwner) return;
    if (!confirm('¿Estás seguro de que deseas revocar el acceso a este colaborador?')) return;

    try {
      const { error } = await supabase
        .from('inventory_users')
        .delete()
        .eq('inventory_id', currentInventory.id)
        .eq('user_id', memberUserId);

      if (error) throw error;
      await loadCollaborators();
    } catch (err: any) {
      alert('Error eliminando colaborador: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Equipo y Colaboradores</h3>
              <p className="text-xs text-slate-400">
                Inventario: <span className="text-white font-medium">{currentInventory?.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Formulario de Invitación */}
          <form onSubmit={handleInvite} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Invitar Colaborador por Correo Electrónico
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="email"
                  value={emailToInvite}
                  onChange={e => setEmailToInvite(e.target.value)}
                  placeholder="ejemplo@empresa.com"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
              <button
                type="submit"
                disabled={isInviting || !emailToInvite.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all active:scale-95 whitespace-nowrap"
              >
                {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                Invitar
              </button>
            </div>

            {feedbackMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedbackMsg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}
              >
                {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {feedbackMsg.text}
              </div>
            )}
          </form>

          {/* Lista de Miembros Actuales */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Miembros Activos ({members.length})
            </h4>

            {loading ? (
              <div className="text-center py-6 text-xs text-slate-500">Cargando equipo...</div>
            ) : (
              <div className="space-y-2">
                {members.map(m => {
                  const isCurrentOwner = m.role === 'owner' || m.user_id === currentInventory?.owner_id;
                  const isSelf = m.user_id === user?.id;

                  return (
                    <div
                      key={m.id}
                      className="p-3 bg-slate-800/60 rounded-xl border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                          {m.profiles?.full_name?.charAt(0) || m.profiles?.email?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white">
                              {m.profiles?.full_name || m.profiles?.email}
                            </span>
                            {isSelf && (
                              <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded">Tú</span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono block">
                            {m.profiles?.email}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            isCurrentOwner
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {isCurrentOwner ? 'Dueño' : 'Colaborador'}
                        </span>

                        {isOwner && !isCurrentOwner && !isSelf && (
                          <button
                            onClick={() => handleRemoveMember(m.user_id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Remover colaborador"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Invitaciones Pendientes */}
          {invitations.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Invitaciones Pendientes ({invitations.length})
              </h4>
              <div className="space-y-1.5">
                {invitations.map(inv => (
                  <div
                    key={inv.id}
                    className="p-2.5 bg-amber-950/20 border border-amber-900/40 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="text-slate-200 font-medium">{inv.email}</span>
                      <span className="text-[10px] text-amber-400/80 block">
                        Esperando registro • Rol: {inv.role}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">{formatDate(inv.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
