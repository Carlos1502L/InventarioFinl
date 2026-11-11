import React, { useState } from 'react';
import { X, Layers, Plus, CheckCircle, Shield, Users, ArrowRight, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { CancelButton } from '../common/CancelButton';
import { supabase } from '../../services/supabase';
import { MinimalDropdown } from '../ui/MinimalDropdown';
import { useModalEscape, useModalMotion } from './modalMotion';

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
  const { backdropMotion, panelMotion, tabContentMotion } = useModalMotion();

  useModalEscape(isOpen, onClose, !currentInventory || isSubmitting);

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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          {...backdropMotion}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            {...panelMotion}
            className="mobile-dark-modal bg-[#ffffff] border border-[#ececec] rounded-2xl md:rounded-3xl w-full max-w-lg overflow-hidden shadow-xl flex flex-col"
          >
            {/* Cabecera */}
            <div className="px-6 py-4 border-b border-[#ececec] bg-[#ffffff] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#17191c]/10 text-[#17191c] flex items-center justify-center">
                  <Layers className="w-5 h-5 text-[#17191c]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#17191c] uppercase tracking-tight">
                    Espacios de Inventario
                  </h2>
                  <p className="text-[11px] text-[#777b86]">
                    Selecciona tu depósito de trabajo o crea uno nuevo
                  </p>
                </div>
              </div>
              {currentInventory && (
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#17191c] hover:bg-[#fafafb] border border-[#ececec] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Lista de Inventarios o Formulario de Creación */}
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-3 font-mono">
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {errorMsg}
                </div>
              )}

              <AnimatePresence mode="wait" initial={false}>
                {!isCreatingNew ? (
                  <motion.div key="inventory-list" {...tabContentMotion} className="space-y-3">
                    {(inventories || []).map((inv) => {
                      const isSelected = currentInventory?.id === inv.id;
                      const isOwner = inv.is_owner || inv.role === 'owner';

                      return (
                        <button
                          key={inv.id}
                          onClick={() => {
                            selectInventory(inv);
                            onClose();
                          }}
                          className={`mobile-flat-row w-full text-left p-4 rounded-xl border transition-[background-color,border-color] duration-150 flex items-center justify-between group cursor-pointer ${
                            isSelected
                              ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900/15 mobile-card-active'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-3 space-y-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <h4 className="font-bold text-[#17191c] text-sm group-hover:text-[#17191c] transition-colors uppercase truncate">
                                {inv.name}
                              </h4>
                              <span
                                className={`shrink-0 text-[9px] uppercase px-2 py-0.5 rounded-full tracking-wider flex items-center gap-1 ${
                                  isOwner
                                    ? 'bg-[#17191c] text-white'
                                    : 'bg-[#fafafb] text-[#777b86] border border-[#ececec]'
                                }`}
                              >
                                {isOwner ? <Shield className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                                {isOwner ? 'Dueño' : 'Colaborador'}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#777b86] block truncate">
                              MONEDA // {inv.currency || 'USD'}{inv.description ? ` · ${inv.description}` : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isSelected ? (
                              <div className="w-8 h-8 rounded-full bg-[#17191c] text-white flex items-center justify-center shadow-sm">
                                <CheckCircle className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full text-[#777b86] group-hover:text-[#17191c] flex items-center justify-center transition-colors">
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
                      className="w-full mt-2 min-h-[44px] p-3 border-2 border-dashed border-[#ececec] hover:border-[#17191c] rounded-2xl text-xs uppercase tracking-wider text-[#17191c] hover:bg-[#fafafb] transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4 text-white" /> Crear Nuevo Depósito
                    </button>
                  </motion.div>
                ) : (
                  /* Formulario de Nuevo Inventario */
                  <motion.form key="inventory-create" {...tabContentMotion} onSubmit={handleCreateInventory} className="space-y-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-[#17191c] mb-1">
                        Nombre del Depósito <span className="text-[#e7000b]">*</span>
                      </label>
                      <input
                        type="text"
                        value={newInvName}
                        onChange={e => setNewInvName(e.target.value)}
                        placeholder="Ej: Depósito Central, Vitrina 1..."
                        required
                        className="w-full min-h-[44px] bg-white border border-[#ececec] rounded-xl px-4 py-2 text-sm text-[#17191c] placeholder:text-[#777b86]/50 focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-[#17191c] mb-1">
                        Descripción (Opcional)
                      </label>
                      <input
                        type="text"
                        value={newInvDesc}
                        onChange={e => setNewInvDesc(e.target.value)}
                        placeholder="Ej: Stock de accesorios finos..."
                        className="w-full min-h-[44px] bg-white border border-[#ececec] rounded-xl px-4 py-2 text-sm text-[#17191c] placeholder:text-[#777b86]/50 focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-[#17191c] mb-1">
                        Moneda Predeterminada
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
                      <select className="hidden" />
                    </div>

                    <div className="flex max-md:flex-col-reverse justify-end gap-2.5 pt-2">
                      <CancelButton onClick={() => setIsCreatingNew(false)} label="Volver a la Lista" />
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="min-h-[44px] inline-flex items-center gap-2 px-6 bg-[#17191c] hover:bg-black text-white text-xs uppercase tracking-wider font-medium rounded-xl shadow-sm disabled:opacity-50 transition-all active:scale-95"
                      >
                        {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Plus className="w-3.5 h-3.5 text-white" />}
                        Crear e Ingresar
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
