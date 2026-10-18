import React, { useState } from 'react';
import { X, Layers, Plus, CheckCircle, Shield, Users, ArrowRight, Loader2 } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-lg overflow-hidden shadow-xl flex flex-col">
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#ffffff] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
              <Layers className="w-5 h-5 text-[#1E3A5F]" />
            </div>
            <div>
              <h2 className="text-base font-light text-[#1E3A5F] uppercase tracking-tight">
                Espacios de Inventario
              </h2>
              <p className="text-[11px] text-[#616161]">
                Selecciona tu depósito de trabajo o crea uno nuevo
              </p>
            </div>
          </div>
          {currentInventory && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
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
                        ? 'bg-[#E8B4A0]/10 border-[#1E3A5F] ring-1 ring-[#1E3A5F]'
                        : 'bg-white border-[#E5E7EB] hover:border-[#1E3A5F] hover:bg-[#F8F9FA]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-[#1E3A5F] text-sm group-hover:text-[#1E3A5F] transition-colors uppercase">
                          {inv.name}
                        </h4>
                        <span
                          className={`text-[9px] uppercase px-2 py-0.5 rounded-full tracking-wider flex items-center gap-1 ${
                            isOwner
                              ? 'bg-[#1E3A5F] text-white'
                              : 'bg-[#F8F9FA] text-[#616161] border border-[#E5E7EB]'
                          }`}
                        >
                          {isOwner ? <Shield className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                          {isOwner ? 'Dueño' : 'Colaborador'}
                        </span>
                      </div>
                      {inv.description && (
                        <p className="text-[11px] text-[#616161] line-clamp-1">{inv.description}</p>
                      )}
                      <span className="text-[10px] text-[#616161] block">
                        MONEDA // {inv.currency || 'USD'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <div className="w-8 h-8 rounded-full bg-[#1E3A5F] text-[#E8B4A0] flex items-center justify-center shadow-sm">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full text-[#616161] group-hover:text-[#1E3A5F] flex items-center justify-center transition-colors">
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
                className="w-full mt-2 min-h-[44px] p-3 border-2 border-dashed border-[#E5E7EB] hover:border-[#1E3A5F] rounded-2xl text-xs uppercase tracking-wider text-[#1E3A5F] hover:bg-[#F8F9FA] transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 text-[#E8B4A0]" /> Crear Nuevo Depósito
              </button>
            </>
          ) : (
            /* Formulario de Nuevo Inventario */
            <form onSubmit={handleCreateInventory} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#1E3A5F] mb-1">
                  Nombre del Depósito <span className="text-[#E8B4A0]">*</span>
                </label>
                <input
                  type="text"
                  value={newInvName}
                  onChange={e => setNewInvName(e.target.value)}
                  placeholder="Ej: Depósito Central, Vitrina 1..."
                  required
                  className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm text-[#1E3A5F] placeholder:text-[#616161]/50 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-[#1E3A5F] mb-1">
                  Descripción (Opcional)
                </label>
                <input
                  type="text"
                  value={newInvDesc}
                  onChange={e => setNewInvDesc(e.target.value)}
                  placeholder="Ej: Stock de accesorios finos..."
                  className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm text-[#1E3A5F] placeholder:text-[#616161]/50 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-[#1E3A5F] mb-1">
                  Moneda Predeterminada
                </label>
                <select
                  value={newInvCurrency}
                  onChange={e => setNewInvCurrency(e.target.value)}
                  className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                >
                  <option value="PEN">Soles Peruanos (S/ PEN)</option>
                  <option value="USD">Dólar Estadounidense ($ USD)</option>
                  <option value="EUR">Euros (€ EUR)</option>
                  <option value="MXN">Pesos Mexicanos ($ MXN)</option>
                  <option value="COP">Pesos Colombianos ($ COP)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="min-h-[44px] px-4 text-xs uppercase tracking-wider text-[#1E3A5F] hover:bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] transition-colors"
                >
                  Volver a la Lista
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] inline-flex items-center gap-2 px-6 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider font-medium rounded-xl shadow-sm disabled:opacity-50 transition-all active:scale-95"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Plus className="w-3.5 h-3.5 text-[#E8B4A0]" />}
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
