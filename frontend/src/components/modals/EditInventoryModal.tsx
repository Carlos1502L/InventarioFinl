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
import { showAppToast } from '../ui';

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

  if (!isOpen || !inventory) return null;

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

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/85 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
        <div className="mobile-dark-modal bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
          {/* Cabecera */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-2xl">
                {mode === 'payments' ? (
                  <QrCode className="w-5 h-5" />
                ) : isOwner ? (
                  <Settings className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {mode === 'payments'
                    ? 'Pasarela de Pagos'
                    : isOwner
                    ? 'Editar Información'
                    : 'Información de Inventario'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {inventory.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Barra de Pestañas Deslizable Horizontalmente (Swipeable Tabs) */}
          {mode !== 'payments' && (
            <div className="mobile-tabs-bar flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs font-semibold overflow-x-auto no-scrollbar scroll-smooth">
              {/* Pestaña 1: Detalles */}
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`py-2.5 px-3.5 shrink-0 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'general'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/5 mobile-tab-active font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                <Layers className="w-4 h-4" /> Detalles
              </button>

              {/* Pestaña 2: Moneda */}
              <button
                type="button"
                onClick={() => setActiveTab('currency')}
                className={`py-2.5 px-3.5 shrink-0 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'currency'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-500/5 mobile-tab-active font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                <Coins className="w-4 h-4" /> Moneda
              </button>

              {/* Pestaña 3: Propietario (Solo Dueño) */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setActiveTab('transfer')}
                  className={`py-2.5 px-3.5 shrink-0 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'transfer'
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/5 mobile-tab-active font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                  }`}
                >
                  <UserCheck className="w-4 h-4" /> Propietario
                </button>
              )}

              {/* Pestaña 4: Eliminar (Solo Dueño) */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setActiveTab('danger')}
                  className={`py-2.5 px-3.5 shrink-0 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'danger'
                      ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-500/5 mobile-tab-active font-bold'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                  }`}
                >
                  <Trash2 className="w-4 h-4" /> Eliminar
                </button>
              )}
            </div>
          )}

          {/* Contenido del Modal */}
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

            {/* TAB 1: DETALLES GENERALES */}
            {mode !== 'payments' && activeTab === 'general' && (
              !isOwner ? (
                /* Vista Colaborador: Solo Lectura */
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        Depósito Activo
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                        {inventory.inventory_type === 'PERSONAL' ? (
                          <>
                            <User className="w-3 h-3" /> Personal
                          </>
                        ) : (
                          <>
                            <Briefcase className="w-3 h-3" /> Negocio
                          </>
                        )}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {inventory.name}
                    </h4>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Descripción del Inventario
                    </label>
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 min-h-[70px] leading-relaxed">
                      {inventory.description || 'Sin notas descriptivas establecidas por el dueño.'}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <CancelButton onClick={onClose} label="Cerrar" />
                  </div>
                </div>
              ) : (
                /* Vista Dueño: Formulario Editable */
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

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Tipo de Inventario
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setInventoryType('BUSINESS')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          inventoryType === 'BUSINESS'
                            ? 'bg-blue-50/80 dark:bg-blue-600/10 border-blue-500 ring-2 ring-blue-500/20 mobile-card-active'
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
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          inventoryType === 'PERSONAL'
                            ? 'bg-blue-50/80 dark:bg-blue-600/10 border-blue-500 ring-2 ring-blue-500/20 mobile-card-active'
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
                      Descripción del Inventario
                    </label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Notas descriptivas o dirección del depósito..."
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                    />
                  </div>

                  <div className="pt-2 flex max-md:flex-col-reverse justify-end gap-2.5">
                    <CancelButton onClick={onClose} />
                    <button
                      type="submit"
                      disabled={isSavingGeneral}
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
                    >
                      {isSavingGeneral ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Guardar Cambios</span>
                    </button>
                  </div>
                </form>
              )
            )}

            {/* TAB 2: MONEDA Y TASA DE CAMBIO */}
            {mode !== 'payments' && activeTab === 'currency' && (
              !isOwner ? (
                /* Vista Colaborador: Solo Lectura */
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
                      <Coins className="w-4 h-4 text-amber-500" />
                      <span>Moneda y Tipo de Cambio Operativo</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block uppercase font-mono">
                          Moneda Base
                        </span>
                        <strong className="text-sm text-slate-900 dark:text-white block mt-0.5">
                          {inventory.currency || 'PEN'}
                        </strong>
                      </div>

                      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block uppercase font-mono">
                          Tasa Operativa
                        </span>
                        <strong className="text-sm font-mono text-[#1E3A5F] dark:text-sky-400 block mt-0.5">
                          {Number(inventory.exchange_rate || 1.000).toFixed(3)}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono pt-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Última actualización de tasa: {rateLastUpdated}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <CancelButton onClick={onClose} label="Cerrar" />
                  </div>
                </div>
              ) : (
                /* Vista Dueño: Control de Divisas, Ajuste y Botón "Actualizar precios" */
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-amber-500" />
                        <span>Gestión de Moneda y Tipo de Cambio</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Catálogo & Precios
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Moneda del Inventario */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Moneda del Inventario
                        </label>
                        <MinimalDropdown
                          value={currency}
                          onChange={(val) => setCurrency(val)}
                          options={SUPPORTED_CURRENCIES}
                        />
                      </div>

                      {/* Tasa de Cambio Operativa */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                          <span>Tasa de Cambio Operativa</span>
                          <span className="text-[9px] font-mono text-slate-400">3 decimales</span>
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          max="99999.999"
                          value={exchangeRate}
                          onChange={e => setExchangeRate(e.target.value)}
                          placeholder="Ej. 3.750"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Marca de tiempo de última actualización */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Última act. de tasa:</span>
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {rateLastUpdated}
                      </span>
                    </div>
                  </div>

                  {/* Botones de Acción en Pestaña Moneda */}
                  <div className="space-y-2.5 pt-1">
                    {/* Botón Principal: Actualizar precios (Ejecución Directa) */}
                    <button
                      type="button"
                      onClick={handleExecuteRecalculate}
                      disabled={isSavingCurrencyOnly || isRecalculating || !isValidRate}
                      className="w-full h-11 px-4 rounded-xl bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isRecalculating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                          <span>Actualizando precios y costos...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 text-[#E8B4A0]" />
                          <span>Actualizar precios</span>
                        </>
                      )}
                    </button>

                    {/* Botón Secundario: Guardar Moneda / Tasa sin recalcular */}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={handleSaveCurrencyOnly}
                        disabled={isSavingCurrencyOnly || isRecalculating || !isValidRate}
                        className="w-full h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingCurrencyOnly ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>Guardar Moneda / Tasa (Sin recalcular)</span>
                      </button>
                      <p className="text-[10px] text-center text-slate-500 dark:text-slate-400">
                        Aplica este nuevo tipo de cambio a nuevos productos ingresados sin alterar los precios actuales.
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* TAB 3: PASARELA DE PAGOS YAPE / PLIN (RF-06.3) */}
            {(mode === 'payments' || activeTab === 'payments') && (
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
                <div className="mobile-flat-section p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
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
                        disabled={!isOwner}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-60"
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
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all cursor-pointer"
                          >
                            {isUploadingYape ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            {yapeQrUrl ? 'Cambiar QR' : 'Subir QR'}
                          </button>
                        )}
                        {yapeQrUrl && (
                          <img src={yapeQrUrl} alt="QR Yape" className="w-9 h-9 object-cover rounded-lg border border-slate-200 dark:border-slate-700" loading="lazy" decoding="async" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Plin */}
                <div className="mobile-flat-section p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
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
                        disabled={!isOwner}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
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
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all cursor-pointer"
                          >
                            {isUploadingPlin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            {plinQrUrl ? 'Cambiar QR' : 'Subir QR'}
                          </button>
                        )}
                        {plinQrUrl && (
                          <img src={plinQrUrl} alt="QR Plin" className="w-9 h-9 object-cover rounded-lg border border-slate-200 dark:border-slate-700" loading="lazy" decoding="async" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex max-md:flex-col-reverse justify-end gap-2.5">
                  <CancelButton onClick={onClose} label={isOwner ? 'Cancelar' : 'Cerrar'} />
                  {isOwner && (
                    <button
                      type="submit"
                      disabled={isSavingPayments}
                      className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
                    >
                      {isSavingPayments ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Guardar Métodos de Pago
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* TAB 4: TRANSFERIR PROPIEDAD (Solo Dueño) */}
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

                    <div className="pt-4 flex max-md:flex-col-reverse justify-end gap-2.5">
                      <CancelButton onClick={onClose} />
                      <button
                        type="submit"
                        disabled={isTransferring || !selectedNewOwnerId}
                        className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
                      >
                        {isTransferring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                        Transferir Propiedad
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}

            {/* TAB 5: ZONA DE PELIGRO (Solo Dueño) */}
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

                <div className="pt-2 flex max-md:flex-col-reverse justify-end gap-2.5">
                  <CancelButton onClick={onClose} />
                  <button
                    type="submit"
                    disabled={isDeleting || deleteConfirmationInput !== 'DELETE-INVENTORY'}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-600/20 disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
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
    </>
  );
};
