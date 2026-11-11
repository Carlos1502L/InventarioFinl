import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Users, UserPlus, Mail, Shield, Trash2, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, getApiUrl, formatDate } from '../../services/supabase';
import { InventoryInvitation } from '../../types/database';
import { PillOption } from '../common/PillOption';
import { CancelButton } from '../common/CancelButton';
import {
  ModalShell,
  ModalHeader,
  ModalTabsBar,
  ModalBody,
  ModalFooter,
  modalFieldCompactInputClass,
  modalSurfaceCardClass,
  modalPrimaryButtonClass
} from './ModalShell';

interface CollaboratorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CollaboratorsModal: React.FC<CollaboratorsModalProps> = ({ isOpen, onClose }) => {
  const { currentInventory, user, session } = useAuth();
  const [emailToInvite, setEmailToInvite] = useState('');
  const [activeTab, setActiveTab] = useState<'invite' | 'members'>('invite');
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<InventoryInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isOwner = Boolean(
    currentInventory && user && (
      currentInventory.owner_id === user.id ||
      currentInventory.is_owner ||
      currentInventory.role === 'owner'
    )
  );

  const loadCollaborators = async () => {
    if (!currentInventory) return;
    try {
      setLoading(true);

      // Cargar miembros con fallback robusto para evitar que aparezca vacío
      let memberList: any[] = [];
      
      // Intento 1: Join directo a profiles
      const { data: memberData, error: errJoin } = await supabase
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

      if (!errJoin && memberData && memberData.length > 0 && memberData.some(m => m.profiles)) {
        memberList = memberData;
      } else {
        // Intento 2: Consulta separada a inventory_users y luego a profiles
        const { data: rawUsers } = await supabase
          .from('inventory_users')
          .select('id, role, created_at, user_id')
          .eq('inventory_id', currentInventory.id);

        if (rawUsers && rawUsers.length > 0) {
          const userIds = rawUsers.map(u => u.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url')
            .in('id', userIds);

          const profMap = new Map((profilesData || []).map(p => [p.id, p]));
          memberList = rawUsers.map(u => ({
            ...u,
            profiles: profMap.get(u.user_id) || {
              id: u.user_id,
              email: (user && u.user_id === user.id) ? (user.email || 'Colaborador') : 'Colaborador',
              full_name: null
            }
          }));
        }
      }

      // Si el dueño no figura explícitamente en inventory_users, agregarlo para asegurar visibilidad
      const hasOwnerInList = memberList.some(m => m.user_id === currentInventory.owner_id || m.role === 'owner');
      if (!hasOwnerInList && currentInventory.owner_id) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url')
          .eq('id', currentInventory.owner_id)
          .maybeSingle();

        memberList.unshift({
          id: `owner-${currentInventory.owner_id}`,
          role: 'owner',
          created_at: currentInventory.created_at,
          user_id: currentInventory.owner_id,
          profiles: ownerProfile || {
            id: currentInventory.owner_id,
            email: (user && currentInventory.owner_id === user.id) ? (user.email || 'Dueño') : 'Dueño',
            full_name: 'Dueño del Inventario'
          }
        });
      }

      // Cargar invitaciones pendientes
      const { data: invData } = await supabase
        .from('inventory_invitations')
        .select('*')
        .eq('inventory_id', currentInventory.id)
        .eq('status', 'pending');

      setMembers(memberList);
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
          const resp = await fetch(getApiUrl('/collaborators/invite'), {
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

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      disableDismiss={isInviting}
      formId={activeTab === 'invite' ? 'invite-collaborator-form' : undefined}
    >
      <ModalHeader
        title="Equipo y colaboradores"
        subtitle="Trabajo colaborativo multi-usuario en tiempo real"
        icon={<Users className="w-4 h-4 lg:w-5 lg:h-5" />}
        iconTone="indigo"
        onClose={onClose}
        closeDisabled={isInviting}
      />

      <ModalTabsBar>
        <PillOption
          active={activeTab === 'invite'}
          onClick={() => setActiveTab('invite')}
          icon={<UserPlus className="w-3.5 h-3.5" />}
        >
          Invitar
        </PillOption>
        <PillOption
          active={activeTab === 'members'}
          onClick={() => setActiveTab('members')}
          icon={<Users className="w-3.5 h-3.5" />}
          badge={members.length}
        >
          Miembros
        </PillOption>
      </ModalTabsBar>

      <ModalBody className="space-y-4">
        {feedbackMsg && (
          <div
            className={`p-3 rounded-xl text-xs border ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
            }`}
          >
            {feedbackMsg.text}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'invite' ? (
            <motion.form
              key="collab-invite"
              id="invite-collaborator-form"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              onSubmit={handleInvite}
              className={`${modalSurfaceCardClass} space-y-4`}
            >
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-indigo-400" /> Invitar nuevo colaborador
                </span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Invitación mediante correo electrónico. La persona invitada tendrá acceso operativo a este inventario.
                </p>
              </div>

              <div className="space-y-3">
                <div className="relative w-full">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={emailToInvite}
                    onChange={e => setEmailToInvite(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    required
                    className={`${modalFieldCompactInputClass} pl-10`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isInviting || !emailToInvite.trim()}
                  className={`${modalPrimaryButtonClass} w-full`}
                >
                  {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>Enviar invitación</span>
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="collab-members"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300 tabular-nums block">
                  Participantes con acceso ({members.length})
                </span>

                {loading ? (
                  <p className="text-xs text-slate-400 text-center py-6">Cargando equipo...</p>
                ) : members.length === 0 ? (
                  <div className="p-4 text-center rounded-2xl bg-slate-950/45 border border-dashed border-slate-800">
                    <p className="text-xs text-slate-400">No hay otros colaboradores en este inventario.</p>
                  </div>
                ) : (
                  members.map(m => {
                    const profile = m.profiles || {};
                    const isMemberOwner = m.role === 'owner';

                    return (
                      <div
                        key={m.id}
                        className="p-3 bg-slate-950/55 rounded-xl border border-slate-800/80 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-semibold text-xs shrink-0">
                            {(profile.full_name || profile.email || 'U')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-semibold text-slate-100 truncate">
                                {profile.full_name || profile.email}
                              </h4>
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${
                                  isMemberOwner
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                }`}
                              >
                                <Shield className="w-2.5 h-2.5" />
                                {isMemberOwner ? 'Dueño' : 'Colaborador'}
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                              {profile.email}
                            </p>
                          </div>
                        </div>

                        {isOwner && !isMemberOwner && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.id, m.user_id)}
                            className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600 rounded-lg transition-colors border border-rose-500/30 active:scale-95 shrink-0 cursor-pointer"
                            title="Retirar colaborador del inventario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Retirar</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {invitations.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-800/80">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> Invitaciones pendientes ({invitations.length})
                  </span>

                  {invitations.map(inv => (
                    <div
                      key={inv.id}
                      className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/25 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-100 truncate">{inv.email}</p>
                          <span className="text-[11px] text-amber-200/80 font-mono tabular-nums block truncate">
                            Pendiente · {formatDate(inv.created_at)}
                          </span>
                        </div>
                      </div>

                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleCancelInvitation(inv.id)}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Cancelar invitación"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </ModalBody>

      <ModalFooter>
        <CancelButton onClick={onClose} label="Cerrar" className="min-w-[120px]" />
      </ModalFooter>
    </ModalShell>
  );
};
