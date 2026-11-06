import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { User, Briefcase, Loader2, Sparkles } from 'lucide-react';

interface FirstTimeOnboardingProps {
  onComplete?: () => void;
}

export function FirstTimeOnboarding({ onComplete }: FirstTimeOnboardingProps) {
  const { user, refreshInventories, selectInventory } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<'personal' | 'business'>('business');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const dbType = type === 'personal' ? 'PERSONAL' : 'BUSINESS';
      const locName = type === 'personal' ? 'Espacio Principal' : 'Almacén Central';
      const locCode = `LOC-${Math.random().toString(36).substring(2, 6).toUpperCase()}-01`;

      // 1. Crear el nuevo inventario
      const { data: newInv, error: createError } = await supabase
        .from('inventories')
        .insert({
          name: name.trim(),
          description: type === 'personal' ? 'Inventario de uso personal' : 'Punto de venta y operaciones comerciales',
          currency: 'PEN',
          inventory_type: dbType,
          owner_id: user.id
        })
        .select()
        .single();

      if (createError) throw createError;

      // 2. Asociar como owner
      await supabase.from('inventory_users').insert({
        inventory_id: newInv.id,
        user_id: user.id,
        role: 'owner'
      });

      // 3. Crear ubicación física inicial
      await supabase.from('locations').insert({
        inventory_id: newInv.id,
        name: locName,
        code: locCode,
        description: 'Ubicación física predeterminada'
      });

      // 4. Crear categoría predeterminada
      await supabase.from('categories').insert([
        {
          inventory_id: newInv.id,
          name: 'General',
          color: '#1E3A5F',
          description: 'Categoría inicial de productos'
        }
      ]);

      // 5. Refrescar estado y seleccionar
      await refreshInventories();
      selectInventory({
        ...newInv,
        role: 'owner',
        is_owner: true
      });

      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      console.error('Error al crear inventario de primer inicio:', err);
      setErrorMsg(err.message || 'No se pudo crear el espacio de trabajo.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white px-6 flex flex-col justify-between py-10 overflow-y-auto overscroll-contain selection:bg-white selection:text-black">
      <div className="space-y-6 mt-8 max-w-md w-full mx-auto">
        <div>
          <span className="text-[11px] uppercase tracking-widest text-zinc-500 font-mono font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            Bienvenido a Stockly
          </span>
          <h1 className="text-2xl font-bold tracking-tight mt-1 text-zinc-100">
            Crea tu primer espacio
          </h1>
          <p className="text-sm text-zinc-400 mt-1 font-light leading-relaxed">
            Configura el inventario para comenzar a registrar productos y existencias.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-900/60 rounded-2xl text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Selector de 2 opciones: Personal vs Negocio (RF-INV-044) */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setType('personal')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              type === 'personal'
                ? 'border-white bg-zinc-900 text-white shadow-lg'
                : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center mb-3 text-sm text-zinc-200">
              <User className="w-4 h-4" />
            </div>
            <div className="font-semibold text-sm text-zinc-200">Personal</div>
            <div className="text-xs text-zinc-500 mt-0.5 leading-relaxed font-light">
              Colecciones, herramientas o uso propio
            </div>
          </button>

          <button
            type="button"
            onClick={() => setType('business')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              type === 'business'
                ? 'border-white bg-zinc-900 text-white shadow-lg'
                : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center mb-3 text-sm text-zinc-200">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="font-semibold text-sm text-zinc-200">Negocio</div>
            <div className="text-xs text-zinc-500 mt-0.5 leading-relaxed font-light">
              Ventas, stock comercial y caja
            </div>
          </button>
        </div>

        <div className="pt-2">
          <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-2 font-mono font-medium">
            Nombre del inventario <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            placeholder={type === 'personal' ? 'Ej. Mi Colección' : 'Ej. Tienda Central'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-sans"
          />
        </div>
      </div>

      <div className="max-w-md w-full mx-auto pt-6">
        <button
          type="button"
          disabled={!name.trim() || submitting}
          onClick={handleSubmit}
          className="w-full py-4 bg-white hover:bg-zinc-200 text-black font-semibold rounded-2xl text-sm transition-transform active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-xl cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-black" />
              <span>Iniciando...</span>
            </>
          ) : (
            <span>Comenzar</span>
          )}
        </button>
      </div>
    </div>
  );
}

export default FirstTimeOnboarding;
