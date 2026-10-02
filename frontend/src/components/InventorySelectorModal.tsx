import React, { useState } from 'react';
import { X, Layers, Plus, CheckCircle, Shield, Users, ArrowRight, Loader2 } from 'lucide-react';
import { Inventory } from '../types/database';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Cabecera */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                ¿A qué inventario deseas ingresar hoy?
              </h2>
              <p className="text-xs text-slate-400">
                Selecciona tu espacio de trabajo o crea uno nuevo
              </p>
            </div>
          </div>
          {currentInventory && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Lista de Inventarios o Formulario de Creación */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-3">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {errorMsg}
            </div>
          )}

          {!isCreatingNew ? (
            <>
              {inventories.map((inv) => {
                const isSelected = currentInventory?.id === inv.id;
                const isOwner = inv.is_owner || inv.role === 'owner';

                return (
                  <button
                    key={inv.id}
                    onClick={() => {
                      selectInventory(inv);
                      onClose();
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-slate-800/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-base group-hover:text-blue-400 transition-colors">
                          {inv.name}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                            isOwner
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {isOwner ? <Shield className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                          {isOwner ? 'Dueño' : 'Colaborador'}
                        </span>
                      </div>
                      {inv.description && (
                        <p className="text-xs text-slate-400 line-clamp-1">{inv.description}</p>
                      )}
                      <span className="text-[11px] text-slate-500 font-mono block">
                        Moneda: {inv.currency || 'USD'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/30">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-2 text-slate-500 group-hover:text-slate-200 rounded-xl transition-colors">
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
                className="w-full mt-2 p-3.5 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl text-xs font-semibold text-slate-400 hover:text-blue-400 transition-all flex items-center justify-center gap-2 bg-slate-800/30"
              >
                <Plus className="w-4 h-4" /> Crear un Nuevo Inventario
              </button>
            </>
          ) : (
            /* Formulario de Nuevo Inventario */
            <form onSubmit={handleCreateInventory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre del Inventario <span className="text-blue-400">*</span>
                </label>
                <input
                  type="text"
                  value={newInvName}
                  onChange={e => setNewInvName(e.target.value)}
                  placeholder="Ej: Sucursal Norte, Depósito Central..."
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descripción (Opcional)
                </label>
                <input
                  type="text"
                  value={newInvDesc}
                  onChange={e => setNewInvDesc(e.target.value)}
                  placeholder="Ej: Inventario de herramientas y repuestos de Lima..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Moneda Predeterminada
                </label>
                <select
                  value={newInvCurrency}
                  onChange={e => setNewInvCurrency(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">Dólar Estadounidense ($ USD)</option>
                  <option value="PEN">Soles Peruanos (S/ PEN)</option>
                  <option value="EUR">Euros (€ EUR)</option>
                  <option value="MXN">Pesos Mexicanos ($ MXN)</option>
                  <option value="COP">Pesos Colombianos ($ COP)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                >
                  Volver a la Lista
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Crear e Ingresar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
