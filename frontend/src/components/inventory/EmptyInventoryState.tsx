import React, { useState } from 'react';
import { Layers, Store, Warehouse, Truck, User, Plus, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { MinimalDropdown } from '../ui/MinimalDropdown';
import { InventoryType } from '../../types/database';

interface EmptyInventoryStateProps {
  onInventoryCreated?: () => void;
}

type SetupInventoryKind = 'RETAIL' | 'GENERAL' | 'TRANSIT' | 'PERSONAL';

interface InventoryKindOption {
  id: SetupInventoryKind;
  label: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  dbType: InventoryType;
}

const INVENTORY_KINDS: InventoryKindOption[] = [
  {
    id: 'RETAIL',
    label: 'Minorista / Comercio',
    badge: 'Comercial & POS',
    description: 'Para tiendas, vitrinas, locales comerciales y venta al detalle con cobro en caja.',
    icon: Store,
    dbType: 'BUSINESS',
  },
  {
    id: 'GENERAL',
    label: 'Almacén general',
    badge: 'Depósito Central',
    description: 'Para bodegas principales, centros de acopio y control masivo de existencias.',
    icon: Warehouse,
    dbType: 'BUSINESS',
  },
  {
    id: 'TRANSIT',
    label: 'Almacén de tránsito',
    badge: 'Logística',
    description: 'Para mercancía en movimiento entre depósitos, vehículos y despachos en curso.',
    icon: Truck,
    dbType: 'BUSINESS',
  },
  {
    id: 'PERSONAL',
    label: 'Personal',
    badge: 'Uso Particular',
    description: 'Para control de herramientas, activos privados o inventario propio sin módulo de venta.',
    icon: User,
    dbType: 'PERSONAL',
  },
];

const CURRENCY_OPTIONS = [
  { value: 'PEN', label: 'Soles Peruanos (S/ PEN)' },
  { value: 'USD', label: 'Dólares Americanos ($ USD)' },
  { value: 'EUR', label: 'Euros (€ EUR)' },
  { value: 'MXN', label: 'Pesos Mexicanos ($ MXN)' },
  { value: 'COP', label: 'Pesos Colombianos ($ COP)' },
];

export const EmptyInventoryState: React.FC<EmptyInventoryStateProps> = ({ onInventoryCreated }) => {
  const { user, selectInventory, refreshInventories } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedKind, setSelectedKind] = useState<SetupInventoryKind>('RETAIL');
  const [currency, setCurrency] = useState('PEN');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedKindObj = INVENTORY_KINDS.find((k) => k.id === selectedKind) || INVENTORY_KINDS[0];

  const handleCreateAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!name.trim()) {
      setErrorMsg('Por favor escribe un nombre para tu inventario.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      // 1. Crear el nuevo inventario con su tipo
      const { data: newInv, error: createError } = await supabase
        .from('inventories')
        .insert({
          name: name.trim(),
          description: description.trim() || `Depósito configurado como ${selectedKindObj.label}`,
          currency: currency,
          inventory_type: selectedKindObj.dbType,
          owner_id: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // 2. Asociar como owner en inventory_users
      await supabase.from('inventory_users').insert({
        inventory_id: newInv.id,
        user_id: user.id,
        role: 'owner',
      });

      // 3. Crear ubicación física inicial
      const locName = selectedKind === 'PERSONAL' ? 'Espacio Principal' : 'Almacén Central';
      const locCode = `LOC-${Math.random().toString(36).substring(2, 6).toUpperCase()}-01`;
      await supabase.from('locations').insert({
        inventory_id: newInv.id,
        name: locName,
        code: locCode,
        description: 'Ubicación física inicial configurada automáticamente',
      });

      // 4. Crear categoría predeterminada
      await supabase.from('categories').insert([
        {
          inventory_id: newInv.id,
          name: 'General',
          color: '#1E3A5F',
          description: 'Categoría inicial de artículos',
        },
      ]);

      // 5. Refrescar estado global y seleccionar el nuevo inventario
      await refreshInventories();
      selectInventory({
        ...newInv,
        role: 'owner',
        is_owner: true,
      });

      if (onInventoryCreated) {
        onInventoryCreated();
      }
    } catch (err: any) {
      console.error('Error al inicializar inventario obligatorio:', err);
      setErrorMsg(err.message || 'No se pudo crear el inventario. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#F8F9FA] flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-[#1E3A5F] selection:text-white">
      <div className="w-full max-w-2xl bg-white border border-[#E2E8F0] rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 my-auto">
        {/* Cabecera Editorial con Acento Navy & Nude */}
        <div className="bg-[#1E3A5F] text-white p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-[#E8B4A0]/10 blur-xl pointer-events-none" />
          <div className="relative z-10 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-[#E8B4A0] shrink-0 shadow-sm">
              <Layers className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest bg-white/10 text-[#E8B4A0] border border-white/10 font-semibold">
                <Sparkles className="w-3 h-3 text-[#E8B4A0]" />
                <span>RF-INV-043 // Configuración Obligatoria</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                No tienes ningún inventario activo
              </h1>
              <p className="text-xs sm:text-sm text-white/75 font-light leading-relaxed max-w-lg">
                Has eliminado todos los depósitos existentes. Para continuar operando el catálogo, los movimientos y las ventas, configura tu nuevo inventario de trabajo.
              </p>
            </div>
          </div>
        </div>

        {/* Formulario de Configuración Inicial */}
        <form onSubmit={handleCreateAndStart} className="p-6 sm:p-8 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 animate-in fade-in">
              {errorMsg}
            </div>
          )}

          {/* 1. Selector de Tipo de Inventario */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] mb-2.5">
              1. Selecciona el Tipo de Inventario <span className="text-[#E8B4A0]">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INVENTORY_KINDS.map((kind) => {
                const Icon = kind.icon;
                const isSelected = selectedKind === kind.id;
                return (
                  <div
                    key={kind.id}
                    onClick={() => setSelectedKind(kind.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none active:scale-[0.99] ${
                      isSelected
                        ? 'bg-[#1E3A5F]/5 border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20 shadow-xs'
                        : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-[#1E3A5F] text-white' : 'bg-[#F1F5F9] text-[#1E3A5F]'
                        }`}
                      >
                        <Icon className="w-4 h-4 stroke-[2]" />
                      </div>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold ${
                          isSelected
                            ? 'bg-[#1E3A5F] text-white'
                            : 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]'
                        }`}
                      >
                        {kind.badge}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1E3A5F]">{kind.label}</h4>
                      <p className="text-[11px] text-[#64748B] leading-snug mt-0.5">{kind.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Campo Nombre del Inventario */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
              2. Nombre del inventario <span className="text-[#E8B4A0]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Depósito Central, Tienda Principal, Almacén 1..."
              required
              className="w-full min-h-[46px] bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#1E3A5F] rounded-2xl px-4 text-sm text-[#1E3A5F] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 transition-all font-sans"
            />
          </div>

          {/* 3. Moneda y Descripción Opcional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                Moneda de Operación
              </label>
              <MinimalDropdown
                value={currency}
                onChange={(val) => setCurrency(val)}
                options={CURRENCY_OPTIONS}
              />
            </div>
            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                Descripción (Opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Sede Lima Norte, Sucursal principal..."
                className="w-full min-h-[46px] bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#1E3A5F] rounded-2xl px-4 text-sm text-[#1E3A5F] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 transition-all font-sans"
              />
            </div>
          </div>

          {/* Botón de Acción Principal */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full min-h-[50px] bg-[#1E3A5F] hover:bg-[#152a45] text-white text-sm font-bold uppercase tracking-wider rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                  <span>CREANDO DEPÓSITO...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-[#E8B4A0] stroke-[2.5]" />
                  <span>Crear inventario y comenzar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmptyInventoryState;
