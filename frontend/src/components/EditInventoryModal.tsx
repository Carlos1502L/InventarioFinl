import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Settings,
  DollarSign,
  UserCheck,
  AlertTriangle,
  Trash2,
  Loader2,
  Check,
  Shield,
  Layers,
  QrCode,
  Smartphone,
  Upload,
  Briefcase,
  User
} from 'lucide-react';
import { Inventory, InventoryType } from '../types/database';
import { supabase, uploadProductImage } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface EditInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Inventory | null;
  onUpdated: () => void;
}

export const EditInventoryModal: React.FC<EditInventoryModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onUpdated
}) => {
  const { user, selectInventory, refreshInventories, inventories } = useAuth();

  const [activeTab, setActiveTab] = useState<'general' | 'payments' | 'transfer' | 'danger'>('general');

  // Datos Generales
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [inventoryType, setInventoryType] = useState<InventoryType>('BUSINESS');
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // Pagos Yape / Plin (RF-06.3)
  const [yapePhone, setYapePhone] = useState('');
  const [yapeQrUrl, setYapeQrUrl] = useState('');
  const [plinPhone, setPlinPhone] = useState('');
  const [plinQrUrl, setPlinQrUrl] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [isUploadingYape, setIsUploadingYape] = useState(false);
  const [isUploadingPlin, setIsUploadingPlin] = useState(false);
  const [isSavingPayments, setIsSavingPayments] = useState(false);
  const yapeFileRef = useRef<HTMLInputElement>(null);
  const plinFileRef = useRef<HTMLInputElement>(null);

  // Transferencia de Dueño
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Eliminación
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Feedback
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isOwner = inventory ? (inventory.owner_id === user?.id || inventory.is_owner || inventory.role === 'owner') : false;

  useEffect(() => {
    if (inventory && isOpen) {
      setName(inventory.name || '');
      setDescription(inventory.description || '');
      setCurrency(inventory.currency || 'USD');
      setInventoryType(inventory.inventory_type || 'BUSINESS');
      setYapePhone(inventory.yape_phone || '');
      setYapeQrUrl(inventory.yape_qr_url || '');
      setPlinPhone(inventory.plin_phone || '');
      setPlinQrUrl(inventory.plin_qr_url || '');
      setPaymentInstructions(inventory.payment_instructions || '');
      setActiveTab('general');
      setDeleteConfirmationInput('');
      setSelectedNewOwnerId('');
      setFeedbackMsg(null);

      // Cargar colaboradores para la pestaña de transferencia
      if (isOwner) {
        setLoadingCollaborators(true);
        supabase
          .from('inventory_users')
          .select(`
            id,
            role,
            user_id,
            profiles (
              id,
              email,
              full_name
            )
          `)
          .eq('inventory_id', inventory.id)
          .neq('user_id', user?.id)
          .then(({ data, error }) => {
            if (!error && data) {
              setCollaborators(data);
              if (data.length > 0) {
                setSelectedNewOwnerId(data[0].user_id);
              }
            }
            setLoadingCollaborators(false);
          });
      }
    }
  }, [inventory, isOpen, user]);

  if (!isOpen || !inventory) return null;

  // 1. Guardar Cambios Generales (Nombre, Descripción, Moneda, Tipo)
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedbackMsg({ text: 'El nombre del inventario no puede estar vacío.', type: 'error' });
      return;
    }

    try {
      setIsSavingGeneral(true);
      setFeedbackMsg(null);

      const { error } = await supabase
        .from('inventories')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          currency: currency,
          inventory_type: inventoryType,
          updated_at: new Date().toISOString()
        })
        .eq('id', inventory.id);

      if (error) throw error;

      setFeedbackMsg({ text: 'Detalles del inventario actualizados exitosamente.', type: 'success' });
      await refreshInventories();
      onUpdated();
    } catch (err: any) {
      console.error('Error al actualizar inventario:', err);
      setFeedbackMsg({ text: err.message || 'Error al actualizar el inventario.', type: 'error' });
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // 2. Subir QR de Yape / Plin
  const handleUploadPaymentQr = async (type: 'yape' | 'plin', file: File) => {
    try {
      if (type === 'yape') setIsUploadingYape(true);
      else setIsUploadingPlin(true);
      setFeedbackMsg(null);

      const url = await uploadProductImage(file, inventory.id);
      if (type === 'yape') {
        setYapeQrUrl(url);
      } else {
        setPlinQrUrl(url);
      }
    } catch (err: any) {
      console.error('Error subiendo QR:', err);
      setFeedbackMsg({ text: 'Error al subir la imagen del QR.', type: 'error' });
    } finally {
      if (type === 'yape') setIsUploadingYape(false);
      else setIsUploadingPlin(false);
    }
  };

  // Guardar Métodos de Pago
  const handleSavePayments = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingPayments(true);
      setFeedbackMsg(null);

      const { error } = await supabase
        .from('inventories')
        .update({
          yape_phone: yapePhone.trim() || null,
          yape_qr_url: yapeQrUrl || null,
          plin_phone: plinPhone.trim() || null,
          plin_qr_url: plinQrUrl || null,
          payment_instructions: paymentInstructions.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', inventory.id);

      if (error) throw error;

      setFeedbackMsg({ text: 'Pasarela de pagos configurada exitosamente.', type: 'success' });
      await refreshInventories();
      onUpdated();
    } catch (err: any) {
      console.error('Error al guardar pasarela de pagos:', err);
      setFeedbackMsg({ text: err.message || 'Error al guardar los datos de pago.', type: 'error' });
    } finally {
      setIsSavingPayments(false);
    }
  };

  // 3. Transferir Propiedad a un Colaborador (RF-02.2)
  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNewOwnerId) {
      setFeedbackMsg({ text: 'Selecciona un colaborador para transferir la propiedad.', type: 'error' });
      return;
    }

    const selectedMember = collaborators.find(c => c.user_id === selectedNewOwnerId);
    const targetName = selectedMember?.profiles?.full_name || selectedMember?.profiles?.email || 'este usuario';

    if (!confirm(`¿Estás seguro de transferir la propiedad a ${targetName}? Dejarás de ser el dueño de este inventario y pasarás a ser colaborador.`)) {
      return;
    }

    try {
      setIsTransferring(true);
      setFeedbackMsg(null);

      const { error: rpcError } = await supabase.rpc('transfer_inventory_ownership', {
        p_inventory_id: inventory.id,
        p_new_owner_id: selectedNewOwnerId
      });

      if (rpcError) {
        // Fallback: Actualización directa si aún no se corrió la función RPC
        const { error: updateError } = await supabase
          .from('inventories')
          .update({ owner_id: selectedNewOwnerId })
          .eq('id', inventory.id);
        if (updateError) throw updateError;

        await supabase
          .from('inventory_users')
          .update({ role: 'owner' })
          .eq('inventory_id', inventory.id)
          .eq('user_id', selectedNewOwnerId);

        if (user) {
          await supabase
            .from('inventory_users')
            .update({ role: 'collaborator' })
            .eq('inventory_id', inventory.id)
            .eq('user_id', user.id);
        }
      }

      setFeedbackMsg({ text: `Propiedad transferida exitosamente a ${targetName}.`, type: 'success' });
      await refreshInventories();
      onUpdated();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error al transferir propiedad:', err);
      setFeedbackMsg({ text: err.message || 'Error al transferir la propiedad del inventario.', type: 'error' });
    } finally {
      setIsTransferring(false);
    }
  };

  // 4. Eliminar Inventario con Palabra de Seguridad (RF-02.3)
  const handleDeleteInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmationInput !== 'DELETE-INVENTORY') {
      setFeedbackMsg({ text: 'Debes escribir exactamente "DELETE-INVENTORY" para confirmar.', type: 'error' });
      return;
    }

    try {
      setIsDeleting(true);
      setFeedbackMsg(null);

      const { error: rpcErr } = await supabase.rpc('delete_inventory', {
        p_inventory_id: inventory.id,
        p_confirmation: 'DELETE-INVENTORY'
      });

      if (rpcErr) {
        const { error: deleteErr } = await supabase
          .from('inventories')
          .delete()
          .eq('id', inventory.id);
        if (deleteErr) throw deleteErr;
      }

      const remaining = inventories.filter(i => i.id !== inventory.id);
      if (remaining.length > 0) {
        selectInventory(remaining[0]);
      } else {
        await supabase.rpc('initialize_user_inventory');
      }

      await refreshInventories();
      onUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error al eliminar inventario:', err);
      setFeedbackMsg({ text: err.message || 'Error al eliminar el inventario.', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/85 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Gestión del Inventario
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {inventory.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-3 px-3 min-w-[90px] flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'general'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/5'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" /> Detalles
          </button>

          {inventoryType !== 'PERSONAL' && (
            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              className={`flex-1 py-3 px-3 min-w-[100px] flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'payments'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/5'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4" /> Yape / Plin
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('transfer')}
              className={`flex-1 py-3 px-3 min-w-[110px] flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'transfer'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/5'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4" /> Cambiar Dueño
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('danger')}
              className={`flex-1 py-3 px-3 min-w-[90px] flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'danger'
                  ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-500/5'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
          )}
        </div>

        {/* Contenido */}
        <div className="p-5 overflow-y-auto space-y-4">
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

          {/* TAB 1: DETALLES GENERALES (RF-01 Y RF-02.1) */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveGeneral} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Inventario <span className="text-blue-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Depósito Central, Colección Personal..."
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              {/* Selector de Tipo de Inventario (RF-01.1 vs RF-01.2) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tipo de Inventario
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setInventoryType('BUSINESS')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      inventoryType === 'BUSINESS'
                        ? 'bg-blue-50/80 dark:bg-blue-600/10 border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase className={`w-4 h-4 ${inventoryType === 'BUSINESS' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                      <span className="font-bold text-xs text-slate-900 dark:text-white">Negocio / Venta</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Precios de costo, markup %, caja y módulo de ventas.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInventoryType('PERSONAL')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      inventoryType === 'PERSONAL'
                        ? 'bg-blue-50/80 dark:bg-blue-600/10 border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <User className={`w-4 h-4 ${inventoryType === 'PERSONAL' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                      <span className="font-bold text-xs text-slate-900 dark:text-white">Personal / Colección</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Control propio de objetos con precio base y valorización.
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Notas adicionales o dirección..."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Moneda Predeterminada
                </label>
                <div className="relative">
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                  >
                    <option value="USD">Dólar Estadounidense ($ USD)</option>
                    <option value="PEN">Soles Peruanos (S/ PEN)</option>
                    <option value="EUR">Euros (€ EUR)</option>
                    <option value="MXN">Pesos Mexicanos ($ MXN)</option>
                    <option value="COP">Pesos Colombianos ($ COP)</option>
                    <option value="CLP">Pesos Chilenos ($ CLP)</option>
                    <option value="ARS">Pesos Argentinos ($ ARS)</option>
                    <option value="BOB">Bolivianos (Bs. BOB)</option>
                    <option value="BRL">Reales Brasileños (R$ BRL)</option>
                  </select>
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingGeneral}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  {isSavingGeneral ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Guardar Cambios
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: PASARELA DE PAGOS YAPE / PLIN (RF-06.3) */}
          {activeTab === 'payments' && inventoryType !== 'PERSONAL' && (
            <form onSubmit={handleSavePayments} className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-600/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <Smartphone className="w-4 h-4" /> Cobro Rápido con Yape y Plin
                </div>
                <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90">
                  Configura tu número de teléfono y tus códigos QR para que los clientes puedan escanear y pagar directamente desde la pantalla de venta.
                </p>
              </div>

              {/* Yape */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="font-bold text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4" /> Configuración de Yape
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Teléfono Yape
                    </label>
                    <input
                      type="text"
                      value={yapePhone}
                      onChange={e => setYapePhone(e.target.value)}
                      placeholder="Ej: 999 123 456"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Foto de tu QR Yape
                    </label>
                    <input
                      ref={yapeFileRef}
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadPaymentQr('yape', e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => yapeFileRef.current?.click()}
                        disabled={isUploadingYape}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                      >
                        {isUploadingYape ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {yapeQrUrl ? 'Cambiar QR' : 'Subir QR'}
                      </button>
                      {yapeQrUrl && (
                        <img src={yapeQrUrl} alt="QR Yape" className="w-9 h-9 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Plin */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="font-bold text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4" /> Configuración de Plin
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Teléfono Plin
                    </label>
                    <input
                      type="text"
                      value={plinPhone}
                      onChange={e => setPlinPhone(e.target.value)}
                      placeholder="Ej: 999 123 456"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Foto de tu QR Plin
                    </label>
                    <input
                      ref={plinFileRef}
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadPaymentQr('plin', e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => plinFileRef.current?.click()}
                        disabled={isUploadingPlin}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all"
                      >
                        {isUploadingPlin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {plinQrUrl ? 'Cambiar QR' : 'Subir QR'}
                      </button>
                      {plinQrUrl && (
                        <img src={plinQrUrl} alt="QR Plin" className="w-9 h-9 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Instrucciones adicionales */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Instrucciones o Cuentas Bancarias Adicionales
                </label>
                <textarea
                  value={paymentInstructions}
                  onChange={e => setPaymentInstructions(e.target.value)}
                  placeholder="Ej: BCP Soles: 191-..., titular Carlos L. Enviar captura al WhatsApp..."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPayments}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  {isSavingPayments ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Guardar Métodos de Pago
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: TRANSFERIR PROPIEDAD (RF-02.2) */}
          {activeTab === 'transfer' && isOwner && (
            <form onSubmit={handleTransferOwnership} className="space-y-4">
              <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Transferencia de Propiedad
                </div>
                <p className="text-xs text-indigo-600/90 dark:text-indigo-300/80 leading-relaxed">
                  Al transferir la propiedad, el colaborador seleccionado pasará a ser el <strong>Dueño legítimo</strong> del inventario con control de eliminación y tú mantendrás acceso completo como <strong>Colaborador</strong>.
                </p>
              </div>

              {loadingCollaborators ? (
                <div className="text-center py-6 text-xs text-slate-400">Cargando colaboradores disponibles...</div>
              ) : collaborators.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    No tienes colaboradores activos en este inventario a quienes transferir la propiedad.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Primero invita al nuevo usuario por correo electrónico desde la sección <strong>"Equipo y Colaboradores"</strong>.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Seleccionar Nuevo Dueño:
                  </label>
                  <select
                    value={selectedNewOwnerId}
                    onChange={e => setSelectedNewOwnerId(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                  >
                    {collaborators.map(c => (
                      <option key={c.id} value={c.user_id}>
                        {c.profiles?.full_name ? `${c.profiles.full_name} (${c.profiles.email})` : c.profiles?.email}
                      </option>
                    ))}
                  </select>

                  <div className="pt-4 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isTransferring || !selectedNewOwnerId}
                      className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all active:scale-95"
                    >
                      {isTransferring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                      Transferir Propiedad
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {/* TAB 4: ZONA DE PELIGRO (ELIMINAR INVENTARIO - RF-02.3) */}
          {activeTab === 'danger' && isOwner && (
            <form onSubmit={handleDeleteInventory} className="space-y-4">
              <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  Advertencia de Eliminación Permanente
                </div>
                <p className="text-xs text-rose-600/90 dark:text-rose-300/80 leading-relaxed">
                  Esta acción es irreversible. Se eliminarán permanentemente el inventario <strong>"{inventory.name}"</strong>, todos sus productos, fotos asociadas, categorías, ubicaciones y el registro histórico de auditoría.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Para confirmar, escribe exactamente <span className="font-mono text-rose-600 dark:text-rose-400 font-bold select-all bg-rose-50 dark:bg-rose-500/20 px-1.5 py-0.5 rounded">DELETE-INVENTORY</span>:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={e => setDeleteConfirmationInput(e.target.value)}
                  placeholder="DELETE-INVENTORY"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isDeleting || deleteConfirmationInput !== 'DELETE-INVENTORY'}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-600/20 disabled:opacity-40 transition-all active:scale-95"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Eliminar este Inventario Definitivamente
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
