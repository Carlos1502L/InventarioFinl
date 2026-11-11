import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Layers, Plus, CheckCircle, Shield, Users, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CancelButton } from '../common/CancelButton';
import { supabase } from '../../services/supabase';
import { MinimalDropdown } from '../ui/MinimalDropdown';
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  modalFieldInputClass,
  modalFieldLabelClass,
  modalPrimaryButtonClass
} from './ModalShell';

interface InventorySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InventorySelectorModal: React.FC<InventorySelectorModalProps> = ({
  isOpen,
  onClose
}) => {
  const { inventories, currentInventory, selectInventory, refreshInventories, user } = useAuth();
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newInvName, setNewInvName] = useState('');
  const [newInvDesc, setNewInvDesc] = useState('');
  const [newInvCurrency, setNewInvCurrency] = useState('USD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newInvName.trim()) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      // 1. Crear el inventario
      const { data: newInv, error: createError } = await supabase
        .from('inventories')
        .insert({
          name: newInvName.trim(),
          description: newInvDesc.trim() || null,
          currency: newInvCurrency,
          owner_id: user.id
        })
        .select()
        .single();

      if (createError) throw createError;

      // 2. Asociar como owner en inventory_users
      await supabase.from('inventory_users').insert({
        inventory_id: newInv.id,
        user_id: user.id,
        role: 'owner'
      });

      // 3. Crear una ubicación por defecto para que pueda empezar inmediatamente
      await supabase.from('locations').insert({
        inventory_id: newInv.id,
        name: 'Almacén Principal',
        code: `LOC-${Math.random().toString(36).substring(2, 6).toUpperCase()}-01`,
        description: 'Ubicación física predeterminada'
      });

      // 4. Crear categorías predeterminadas
      await supabase.from('categories').insert([
        {
          inventory_id: newInv.id,
          name: 'General',
          color: '#3B82F6',
          description: 'Artículos diversos'
        },
        {
          inventory_id: newInv.id,
          name: 'Herramientas',
          color: '#F59E0B',
          description: 'Equipos e insumos'
        }
      ]);

      await refreshInventories();
      selectInventory({
        ...newInv,
        role: 'owner',
        is_owner: true
      });
      setIsCreatingNew(false);
      onClose();
    } catch (err: any) {
      console.error('Error creando inventario:', err);
      setErrorMsg(err.message || 'Error al crear el nuevo inventario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      disableDismiss={!currentInventory || isSubmitting}
      formId={isCreatingNew ? 'create-inventory-form' : undefined}
    >
      <ModalHeader
        title="Espacios de inventario"
        subtitle="Selecciona tu depósito de trabajo o crea uno nuevo"
        icon={<Layers className="w-4 h-4 lg:w-5 lg:h-5" />}
        iconTone="indigo"
        onClose={currentInventory ? onClose : undefined}
        closeDisabled={isSubmitting}
      />

      <ModalBody className="space-y-3">
        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {!isCreatingNew ? (
            <motion.div
              key="inv-list"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              className="space-y-2.5"
            >
              {(inventories || []).map((inv) => {
                const isSelected = currentInventory?.id === inv.id;
                const isOwner = inv.is_owner || inv.role === 'owner';

                return (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => {
                      selectInventory(inv);
                      onClose();
                    }}
                    className={`w-full min-h-[60px] text-left p-3.5 lg:p-4 rounded-xl border transition-[background-color,border-color,transform] duration-150 active:scale-[0.99] flex items-center justify-between group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
                      isSelected
                        ? 'bg-slate-800/80 border-indigo-500/60 ring-1 ring-indigo-500/25'
                        : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-3 space-y-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="font-semibold text-slate-100 text-sm truncate">
                          {inv.name}
                        </h4>
                        <span
                          className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                            isOwner
                              ? 'bg-slate-100 text-slate-950 border-transparent'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {isOwner ? <Shield className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                          {isOwner ? 'Dueño' : 'Colaborador'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block truncate">
                        <span className="font-mono text-slate-300">{inv.currency || 'USD'}</span>
                        {inv.description ? ` · ${inv.description}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center shrink-0">
                      {isSelected ? (
                        <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-sm">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full text-slate-400 group-hover:text-slate-100 flex items-center justify-center transition-colors">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                className="w-full mt-2 min-h-[48px] p-3.5 border border-dashed border-slate-700 hover:border-indigo-400/70 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800/50 transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Crear nuevo depósito</span>
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="inv-create"
              id="create-inventory-form"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              onSubmit={handleCreateInventory}
              className="space-y-4"
            >
              <div>
                <label className={modalFieldLabelClass}>
                  Nombre del depósito <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newInvName}
                  onChange={e => setNewInvName(e.target.value)}
                  placeholder="Ej: Depósito Central, Vitrina 1..."
                  required
                  autoFocus
                  className={modalFieldInputClass}
                />
              </div>

              <div>
                <label className={modalFieldLabelClass}>
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  value={newInvDesc}
                  onChange={e => setNewInvDesc(e.target.value)}
                  placeholder="Ej: Stock de accesorios finos..."
                  className={modalFieldInputClass}
                />
              </div>

              <div>
                <label className={modalFieldLabelClass}>
                  Moneda predeterminada
                </label>
                <MinimalDropdown
                  value={newInvCurrency}
                  onChange={(val) => setNewInvCurrency(val)}
                  options={[
                    { value: 'PEN', label: 'Soles Peruanos (S/ PEN)' },
                    { value: 'USD', label: 'Dólar Estadounidense ($ USD)' },
                    { value: 'EUR', label: 'Euros (€ EUR)' },
                    { value: 'MXN', label: 'Pesos Mexicanos ($ MXN)' },
                    { value: 'COP', label: 'Pesos Colombianos ($ COP)' }
                  ]}
                />
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </ModalBody>

      {isCreatingNew && (
        <ModalFooter shortcutLabel="para crear">
          <CancelButton onClick={() => setIsCreatingNew(false)} label="Volver a la lista" disabled={isSubmitting} />
          <button
            type="submit"
            form="create-inventory-form"
            disabled={isSubmitting || !newInvName.trim()}
            className={modalPrimaryButtonClass}
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>Crear e ingresar</span>
          </button>
        </ModalFooter>
      )}
    </ModalShell>
  );
};
