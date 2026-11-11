import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Settings,
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
  User,
  Coins,
  RefreshCw,
  Clock,
  Info,
  Save
} from 'lucide-react';
import { Inventory, InventoryType } from '../../types/database';
import { supabase, uploadProductImage, getApiUrl, formatDate } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { MinimalDropdown } from '../ui/MinimalDropdown';
import { CancelButton } from '../common/CancelButton';
import { PillOption } from '../common/PillOption';
import { showAppToast } from '../ui';
import {
  ModalShell,
  ModalHeader,
  ModalTabsBar,
  ModalBody,
  ModalFooter,
  modalFieldCompactInputClass,
  modalFieldLabelClass,
  modalSurfaceCardClass,
  modalPrimaryButtonClass,
  modalSecondaryButtonClass,
  modalDangerButtonClass
} from './ModalShell';

interface EditInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Inventory | null;
  onUpdated: () => void;
  mode?: 'info' | 'payments';
}

const SUPPORTED_CURRENCIES = [
  { value: 'PEN', label: 'Sol Peruano (S/ PEN)' },
  { value: 'USD', label: 'Dólar Estadounidense ($ USD)' },
  { value: 'EUR', label: 'Euro (€ EUR)' },
  { value: 'MXN', label: 'Pesos Mexicanos ($ MXN)' },
  { value: 'COP', label: 'Pesos Colombianos ($ COP)' },
  { value: 'CLP', label: 'Pesos Chilenos ($ CLP)' },
  { value: 'ARS', label: 'Pesos Argentinos ($ ARS)' },
  { value: 'BOB', label: 'Bolivianos (Bs. BOB)' },
  { value: 'BRL', label: 'Reales Brasileños (R$ BRL)' }
];

export const EditInventoryModal: React.FC<EditInventoryModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onUpdated,
  mode = 'info'
}) => {
  const { user, selectInventory, refreshInventories, inventories } = useAuth();

  const [activeTab, setActiveTab] = useState<'general' | 'currency' | 'payments' | 'transfer' | 'danger'>('general');

  // Datos Generales
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('PEN');
  const [exchangeRate, setExchangeRate] = useState('1.000');
  const [inventoryType, setInventoryType] = useState<InventoryType>('BUSINESS');
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingCurrencyOnly, setIsSavingCurrencyOnly] = useState(false);

  // Recálculo Masivo de Precios
  const [isRecalculating, setIsRecalculating] = useState(false);

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

  const isOwner = inventory
    ? (inventory.owner_id === user?.id ||
       inventory.is_owner === true ||
       inventory.role?.toLowerCase() === 'owner' ||
       !inventory.role)
    : false;

  useEffect(() => {
    if (inventory && isOpen) {
      setName(inventory.name || '');
      setDescription(inventory.description || '');
      setCurrency(inventory.currency || 'PEN');
      setExchangeRate(inventory.exchange_rate ? String(inventory.exchange_rate) : '1.000');
      setInventoryType(inventory.inventory_type || 'BUSINESS');
      setYapePhone(inventory.yape_phone || '');
      setYapeQrUrl(inventory.yape_qr_url || '');
      setPlinPhone(inventory.plin_phone || '');
      setPlinQrUrl(inventory.plin_qr_url || '');
      setPaymentInstructions(inventory.payment_instructions || '');
      setActiveTab(mode === 'payments' ? 'payments' : 'general');
      setDeleteConfirmationInput('');
      setSelectedNewOwnerId('');
      setFeedbackMsg(null);

      // Cargar colaboradores para la pestaña de transferencia (Solo si es dueño)
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
  }, [inventory, isOpen, user, mode, isOwner]);

  if (!inventory) return null;

  const currentRate = Number(inventory?.exchange_rate) || 1.0;
  const parsedNewRate = parseFloat(exchangeRate);
  const isValidRate = !isNaN(parsedNewRate) && parsedNewRate > 0;
  const ratio = isValidRate && currentRate > 0 ? parsedNewRate / currentRate : 1.0;

  // 1. Guardar Cambios Generales de Detalles (Solo Dueño)
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    if (!name.trim()) {
      setFeedbackMsg({ text: 'El nombre del inventario no puede estar vacío.', type: 'error' });
      return;
    }

    try {
      setIsSavingGeneral(true);
      setFeedbackMsg(null);

      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from('inventories')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          inventory_type: inventoryType,
          updated_at: nowIso
        })
        .eq('id', inventory.id);

      if (error) throw error;

      setFeedbackMsg({ text: 'Detalles del inventario actualizados exitosamente.', type: 'success' });
      showAppToast('Detalles del inventario guardados.', 'success');
      await refreshInventories();
      onUpdated();
    } catch (err: any) {
      console.error('Error al actualizar inventario:', err);
      setFeedbackMsg({ text: err.message || 'Error al actualizar el inventario.', type: 'error' });
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // 2. Guardar Solo Moneda y Tasa (Sin recalcular catálogo de productos)
  const handleSaveCurrencyOnly = async () => {
    if (!isOwner) return;
    if (!isValidRate) {
      setFeedbackMsg({ text: 'Ingresa una tasa de cambio numérica válida (ej. 3.750).', type: 'error' });
      return;
    }

    try {
      setIsSavingCurrencyOnly(true);
      setFeedbackMsg(null);

      const nowIso = new Date().toISOString();
      const rateNumber = Number(parsedNewRate.toFixed(3));
      const hasRateChanged = rateNumber !== currentRate;

      const { error } = await supabase
        .from('inventories')
        .update({
          currency: currency,
          exchange_rate: rateNumber,
          exchange_rate_updated_at: hasRateChanged ? nowIso : (inventory.exchange_rate_updated_at || nowIso),
          updated_at: nowIso
        })
        .eq('id', inventory.id);

      if (error) throw error;

      setFeedbackMsg({ text: 'Moneda y tasa de cambio guardadas correctamente.', type: 'success' });
      showAppToast('Moneda y tasa de cambio actualizadas.', 'success');
      await refreshInventories();
      onUpdated();
    } catch (err: any) {
      console.error('Error guardando moneda/tasa:', err);
      setFeedbackMsg({ text: err.message || 'Error al guardar la moneda y tasa.', type: 'error' });
    } finally {
      setIsSavingCurrencyOnly(false);
    }
  };

  // 3. Recálculo Masivo de Precios (Botón "Actualizar precios") con Triple Red de Seguridad
  const handleExecuteRecalculate = async () => {
    if (!isOwner || !inventory?.id) return;
    if (!isValidRate) {
      showAppToast('Ingresa una tasa de cambio válida.', 'warning');
      return;
    }

    setIsRecalculating(true);
    try {
      const targetRate = Number(parsedNewRate.toFixed(3));
      let updatedCount = 0;

      // Intento 1: Llamada a la API del backend
      let apiSucceeded = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('No hay sesión de usuario activa.');

        const res = await fetch(getApiUrl('/backup/recalculate-prices'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            inventory_id: inventory.id,
            new_exchange_rate: targetRate,
            new_rate: targetRate,
            currency: currency,
            new_currency: currency
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          updatedCount = data.result?.updated_products ?? data.affected_products ?? 0;
          apiSucceeded = true;
        } else {
          throw new Error(data.message || 'El servidor backend retornó error.');
        }
      } catch (apiErr: any) {
        console.warn('⚠️ [Actualizar precios] Backend no disponible o falló:', apiErr.message);
      }

      // Intento 2: Fallback directo a la función RPC en Supabase
      if (!apiSucceeded) {
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('recalculate_inventory_prices', {
            p_inventory_id: inventory.id,
            p_new_rate: targetRate,
            p_new_currency: currency
          });

          if (!rpcErr && rpcData?.success) {
            updatedCount = rpcData.updated_products || 0;
            apiSucceeded = true;
          } else if (rpcErr) {
            console.warn('⚠️ [Actualizar precios] RPC falló:', rpcErr.message);
          }
        } catch (rpcCatch: any) {
          console.warn('⚠️ [Actualizar precios] Excepción en RPC:', rpcCatch.message);
        }
      }

      // Intento 3: Fallback de recálculo directo en cliente sobre Supabase
      if (!apiSucceeded) {
        const { data: prods, error: pErr } = await supabase
          .from('products')
          .select('id, price, cost_price, markup_percentage')
          .eq('inventory_id', inventory.id);

        if (pErr) throw pErr;

        if (Array.isArray(prods) && prods.length > 0) {
          for (const p of prods) {
            const oldCost = Number(p.cost_price) || 0;
            const oldPrice = Number(p.price) || 0;
            const markup = Number(p.markup_percentage) || 0;

            const newCost = Math.round(oldCost * ratio * 100) / 100;
            const newPrice = markup > 0 && newCost > 0
              ? Math.round(newCost * (1 + markup / 100) * 100) / 100
              : Math.round(oldPrice * ratio * 100) / 100;

            await supabase
              .from('products')
              .update({
                price: newPrice,
                cost_price: newCost,
                updated_at: new Date().toISOString()
              })
              .eq('id', p.id)
              .eq('inventory_id', inventory.id);

            updatedCount++;
          }
        }

        const nowIso = new Date().toISOString();
        await supabase
          .from('inventories')
          .update({
            exchange_rate: targetRate,
            currency: currency,
            exchange_rate_updated_at: nowIso,
            updated_at: nowIso
          })
          .eq('id', inventory.id);
      }

      showAppToast(
        `Precios y costos actualizados con éxito (${updatedCount} productos actualizados a la tasa ${targetRate.toFixed(3)}).`,
        'success',
        6000
      );

      try {
        window.dispatchEvent(new CustomEvent('stockly_inventory_data_updated'));
      } catch (e) {}

      await refreshInventories();
      onUpdated();
    } catch (err: any) {
      console.error('Error actualizando precios:', err);
      showAppToast(err.message || 'No se pudo completar la actualización de precios.', 'error');
    } finally {
      setIsRecalculating(false);
    }
  };

  // 4. Subir QR de Yape / Plin
  const handleUploadPaymentQr = async (type: 'yape' | 'plin', file: File) => {
    if (!isOwner) return;
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
    if (!isOwner) return;

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

  // 5. Transferir Propiedad a un Colaborador
  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

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

  // 6. Eliminar Inventario con Palabra de Seguridad
  const handleDeleteInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

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

      const remaining = (inventories || []).filter(i => i.id !== inventory.id);
      if (remaining.length > 0) {
        selectInventory(remaining[0]);
      } else {
        selectInventory(null);
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

  const rateLastUpdated = inventory.exchange_rate_updated_at
    ? formatDate(inventory.exchange_rate_updated_at)
    : inventory.updated_at
    ? formatDate(inventory.updated_at)
    : 'Sin actualizaciones registradas';

  const isBusy = isSavingGeneral || isSavingCurrencyOnly || isRecalculating || isSavingPayments || isTransferring || isDeleting;
  const activeFormId =
    mode === 'payments' || activeTab === 'payments'
      ? isOwner
        ? 'edit-inv-payments-form'
        : undefined
      : activeTab === 'general' && isOwner
      ? 'edit-inv-general-form'
      : activeTab === 'transfer' && isOwner && collaborators.length > 0
      ? 'edit-inv-transfer-form'
      : activeTab === 'danger' && isOwner
      ? 'edit-inv-danger-form'
      : undefined;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      disableDismiss={isBusy}
      formId={activeFormId}
    >
      <ModalHeader
        title={
          mode === 'payments'
            ? 'Pasarela de pagos'
            : isOwner
            ? 'Editar información'
            : 'Información de inventario'
        }
        subtitle={inventory.name}
        icon={
          mode === 'payments' ? (
            <QrCode className="w-4 h-4 lg:w-5 lg:h-5" />
          ) : isOwner ? (
            <Settings className="w-4 h-4 lg:w-5 lg:h-5" />
          ) : (
            <Info className="w-4 h-4 lg:w-5 lg:h-5" />
          )
        }
        iconTone={mode === 'payments' ? 'emerald' : 'indigo'}
        onClose={onClose}
        closeDisabled={isBusy}
      />

      {mode !== 'payments' && (
        <ModalTabsBar>
          <PillOption
            active={activeTab === 'general'}
            onClick={() => setActiveTab('general')}
            icon={<Layers className="w-3.5 h-3.5" />}
          >
            Detalles
          </PillOption>
          <PillOption
            active={activeTab === 'currency'}
            onClick={() => setActiveTab('currency')}
            icon={<Coins className="w-3.5 h-3.5" />}
          >
            Moneda
          </PillOption>
          {isOwner && (
            <PillOption
              active={activeTab === 'transfer'}
              onClick={() => setActiveTab('transfer')}
              icon={<UserCheck className="w-3.5 h-3.5" />}
            >
              Propietario
            </PillOption>
          )}
          {isOwner && (
            <PillOption
              active={activeTab === 'danger'}
              onClick={() => setActiveTab('danger')}
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Eliminar
            </PillOption>
          )}
        </ModalTabsBar>
      )}

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
          {mode !== 'payments' && activeTab === 'general' && (
            <motion.div
              key="edit-general"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
            >
              {!isOwner ? (
                <div className="space-y-4">
                  <div className={`${modalSurfaceCardClass} space-y-2`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-slate-400">Depósito activo</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-[10px] font-mono font-semibold uppercase">
                        {inventory.inventory_type === 'PERSONAL' ? (
                          <>
                            <User className="w-3 h-3" /> PERSONAL
                          </>
                        ) : (
                          <>
                            <Briefcase className="w-3 h-3" /> BUSINESS
                          </>
                        )}
                      </span>
                    </div>
                    <h4 className="text-base font-semibold text-slate-100">{inventory.name}</h4>
                  </div>

                  <div>
                    <label className={modalFieldLabelClass}>Descripción del inventario</label>
                    <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-300 min-h-[70px] leading-relaxed">
                      {inventory.description || 'Sin notas descriptivas establecidas por el dueño.'}
                    </div>
                  </div>
                </div>
              ) : (
                <form id="edit-inv-general-form" onSubmit={handleSaveGeneral} className="space-y-4">
                  <div>
                    <label className={modalFieldLabelClass}>
                      Nombre del inventario <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Ej: Depósito Central, Colección Personal..."
                      required
                      className={modalFieldCompactInputClass}
                    />
                  </div>

                  <div>
                    <label className={modalFieldLabelClass}>Tipo de inventario</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setInventoryType('BUSINESS')}
                        className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          inventoryType === 'BUSINESS'
                            ? 'bg-slate-800/80 border-indigo-500/70 ring-1 ring-indigo-500/30'
                            : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <Briefcase className={`w-4 h-4 ${inventoryType === 'BUSINESS' ? 'text-indigo-400' : 'text-slate-400'}`} />
                            <span className="font-semibold text-xs text-slate-100">Negocio / Venta</span>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                            BUSINESS
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Costos, margen %, caja y módulo POS.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setInventoryType('PERSONAL')}
                        className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          inventoryType === 'PERSONAL'
                            ? 'bg-slate-800/80 border-indigo-500/70 ring-1 ring-indigo-500/30'
                            : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <User className={`w-4 h-4 ${inventoryType === 'PERSONAL' ? 'text-indigo-400' : 'text-slate-400'}`} />
                            <span className="font-semibold text-xs text-slate-100">Personal</span>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                            PERSONAL
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Control propio de artículos y valorización.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={modalFieldLabelClass}>Descripción del inventario</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Notas descriptivas o dirección del depósito..."
                      rows={3}
                      className="w-full bg-slate-950/75 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm lg:text-xs text-slate-100 placeholder:text-slate-400/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                    />
                  </div>
                </form>
              )}
            </motion.div>
          )}

          {mode !== 'payments' && activeTab === 'currency' && (
            <motion.div
              key="edit-currency"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              className="space-y-4"
            >
              {!isOwner ? (
                <div className={`${modalSurfaceCardClass} space-y-3`}>
                  <div className="flex items-center gap-2 text-slate-100 font-semibold text-xs">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span>Moneda y tipo de cambio operativo</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Moneda base</span>
                      <strong className="text-sm font-mono text-slate-100 block mt-0.5">
                        {inventory.currency || 'PEN'}
                      </strong>
                    </div>

                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Tasa operativa</span>
                      <strong className="text-sm font-mono tabular-nums text-slate-100 block mt-0.5">
                        {Number(inventory.exchange_rate || 1.000).toFixed(3)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums pt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Última actualización: {rateLastUpdated}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={`${modalSurfaceCardClass} space-y-4`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span>Moneda y tipo de cambio</span>
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        Ratio: {ratio.toFixed(3)}x
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className={modalFieldLabelClass}>Moneda del inventario</label>
                        <MinimalDropdown
                          value={currency}
                          onChange={(val) => setCurrency(val)}
                          options={SUPPORTED_CURRENCIES}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-slate-300">Tasa de cambio</label>
                          <span className="text-[10px] font-mono text-slate-400">3 decimales</span>
                        </div>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          max="99999.999"
                          value={exchangeRate}
                          onChange={e => setExchangeRate(e.target.value)}
                          placeholder="Ej. 3.750"
                          className={`${modalFieldCompactInputClass} font-mono tabular-nums font-semibold`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-800/80">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Última act.:</span>
                      </span>
                      <span className="text-slate-200 tabular-nums">{rateLastUpdated}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={handleExecuteRecalculate}
                      disabled={isSavingCurrencyOnly || isRecalculating || !isValidRate}
                      className={`${modalPrimaryButtonClass} w-full`}
                    >
                      {isRecalculating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Actualizando precios y costos...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Actualizar precios de todo el catálogo</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveCurrencyOnly}
                      disabled={isSavingCurrencyOnly || isRecalculating || !isValidRate}
                      className={`${modalSecondaryButtonClass} w-full`}
                    >
                      {isSavingCurrencyOnly ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>Guardar moneda / tasa (sin recalcular)</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {(mode === 'payments' || activeTab === 'payments') && (
            <motion.form
              key="edit-payments"
              id="edit-inv-payments-form"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              onSubmit={handleSavePayments}
              className="space-y-4"
            >
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-200 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-emerald-300">
                  <Smartphone className="w-4 h-4" />
                  <span>Cobro rápido con Yape y Plin</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Configura tu teléfono y tus códigos QR para mostrarlos en el punto de venta al cobrar.
                </p>
              </div>

              <div className={`${modalSurfaceCardClass} space-y-3`}>
                <span className="font-semibold text-xs text-purple-300 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4" /> Configuración de Yape
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={modalFieldLabelClass}>Teléfono Yape</label>
                    <input
                      type="text"
                      value={yapePhone}
                      onChange={e => setYapePhone(e.target.value)}
                      placeholder="Ej: 999 123 456"
                      disabled={!isOwner}
                      className={`${modalFieldCompactInputClass} font-mono tabular-nums disabled:opacity-60`}
                    />
                  </div>

                  <div>
                    <label className={modalFieldLabelClass}>Foto de tu QR Yape</label>
                    <input
                      ref={yapeFileRef}
                      type="file"
                      accept="image/*"
                      disabled={!isOwner}
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadPaymentQr('yape', e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => yapeFileRef.current?.click()}
                          disabled={isUploadingYape}
                          className={`${modalSecondaryButtonClass} flex-1 min-h-[38px]`}
                        >
                          {isUploadingYape ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-purple-300" />}
                          <span>{yapeQrUrl ? 'Cambiar QR' : 'Subir QR'}</span>
                        </button>
                      )}
                      {yapeQrUrl && (
                        <img
                          src={yapeQrUrl}
                          alt="QR Yape"
                          className="w-10 h-10 object-cover rounded-lg border border-slate-700 bg-white shrink-0"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${modalSurfaceCardClass} space-y-3`}>
                <span className="font-semibold text-xs text-sky-300 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4" /> Configuración de Plin
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={modalFieldLabelClass}>Teléfono Plin</label>
                    <input
                      type="text"
                      value={plinPhone}
                      onChange={e => setPlinPhone(e.target.value)}
                      placeholder="Ej: 999 123 456"
                      disabled={!isOwner}
                      className={`${modalFieldCompactInputClass} font-mono tabular-nums disabled:opacity-60`}
                    />
                  </div>

                  <div>
                    <label className={modalFieldLabelClass}>Foto de tu QR Plin</label>
                    <input
                      ref={plinFileRef}
                      type="file"
                      accept="image/*"
                      disabled={!isOwner}
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadPaymentQr('plin', e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => plinFileRef.current?.click()}
                          disabled={isUploadingPlin}
                          className={`${modalSecondaryButtonClass} flex-1 min-h-[38px]`}
                        >
                          {isUploadingPlin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-sky-300" />}
                          <span>{plinQrUrl ? 'Cambiar QR' : 'Subir QR'}</span>
                        </button>
                      )}
                      {plinQrUrl && (
                        <img
                          src={plinQrUrl}
                          alt="QR Plin"
                          className="w-10 h-10 object-cover rounded-lg border border-slate-700 bg-white shrink-0"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.form>
          )}

          {activeTab === 'transfer' && isOwner && (
            <motion.form
              key="edit-transfer"
              id="edit-inv-transfer-form"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              onSubmit={handleTransferOwnership}
              className="space-y-4"
            >
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <span>Transferencia de propiedad</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Al transferir la propiedad, el colaborador seleccionado pasará a ser el <strong>Dueño legítimo</strong> del inventario y tú mantendrás acceso como <strong>Colaborador</strong>.
                </p>
              </div>

              {loadingCollaborators ? (
                <div className="text-center py-6 text-xs text-slate-400">Cargando colaboradores disponibles...</div>
              ) : collaborators.length === 0 ? (
                <div className={`${modalSurfaceCardClass} text-center space-y-2`}>
                  <p className="text-xs text-slate-300">
                    No tienes colaboradores activos en este inventario a quienes transferir la propiedad.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Primero invita al nuevo usuario desde la sección "Equipo y colaboradores".
                  </p>
                </div>
              ) : (
                <div>
                  <label className={modalFieldLabelClass}>Seleccionar nuevo dueño</label>
                  <MinimalDropdown
                    value={selectedNewOwnerId}
                    onChange={(val) => setSelectedNewOwnerId(val)}
                    placeholder="Seleccionar colaborador..."
                    options={collaborators.map((c) => ({
                      value: c.user_id,
                      label: c.profiles?.full_name || c.profiles?.email || 'Colaborador',
                      badge: c.profiles?.full_name ? c.profiles.email : undefined
                    }))}
                  />
                </div>
              )}
            </motion.form>
          )}

          {activeTab === 'danger' && isOwner && (
            <motion.form
              key="edit-danger"
              id="edit-inv-danger-form"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              onSubmit={handleDeleteInventory}
              className="space-y-4"
            >
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Advertencia de eliminación permanente</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Se eliminará permanentemente el inventario <strong className="text-white">"{inventory.name}"</strong> y toda su información existente. Esta acción es irreversible.
                </p>
              </div>

              <div>
                <label className={modalFieldLabelClass}>
                  Para confirmar, escribe exactamente{' '}
                  <span className="font-mono text-rose-300 font-bold select-all bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded">
                    DELETE-INVENTORY
                  </span>
                  :
                </label>
                <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={e => setDeleteConfirmationInput(e.target.value)}
                  placeholder="DELETE-INVENTORY"
                  required
                  className={`${modalFieldCompactInputClass} font-mono tracking-wider`}
                />
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </ModalBody>

      <ModalFooter shortcutLabel={activeFormId ? 'para confirmar' : undefined}>
        <CancelButton
          onClick={onClose}
          label={isOwner && activeFormId ? 'Cancelar' : 'Cerrar'}
          disabled={isBusy}
        />

        {activeTab === 'general' && mode !== 'payments' && isOwner && (
          <button
            type="submit"
            form="edit-inv-general-form"
            disabled={isSavingGeneral}
            className={modalPrimaryButtonClass}
          >
            {isSavingGeneral ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Guardar cambios</span>
          </button>
        )}

        {(mode === 'payments' || activeTab === 'payments') && isOwner && (
          <button
            type="submit"
            form="edit-inv-payments-form"
            disabled={isSavingPayments}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:opacity-45 cursor-pointer"
          >
            {isSavingPayments ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Guardar métodos de pago</span>
          </button>
        )}

        {activeTab === 'transfer' && isOwner && collaborators.length > 0 && (
          <button
            type="submit"
            form="edit-inv-transfer-form"
            disabled={isTransferring || !selectedNewOwnerId}
            className={modalPrimaryButtonClass}
          >
            {isTransferring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
            <span>Transferir propiedad</span>
          </button>
        )}

        {activeTab === 'danger' && isOwner && (
          <button
            type="submit"
            form="edit-inv-danger-form"
            disabled={isDeleting || deleteConfirmationInput !== 'DELETE-INVENTORY'}
            className={modalDangerButtonClass}
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>Eliminar inventario</span>
          </button>
        )}
      </ModalFooter>
    </ModalShell>
  );
};
