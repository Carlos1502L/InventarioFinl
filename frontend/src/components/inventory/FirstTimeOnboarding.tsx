import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import {
  Layers,
  Briefcase,
  Coins,
  ChevronDown,
  Loader2,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface FirstTimeOnboardingProps {
  defaultInventoryId?: string;
  onComplete?: () => void;
}

export function FirstTimeOnboarding({ defaultInventoryId, onComplete }: FirstTimeOnboardingProps) {
  const { user, refreshInventories, selectInventory } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<'BUSINESS' | 'PERSONAL'>('BUSINESS');
  const [currency, setCurrency] = useState('PEN');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) {
      setErrorMsg('Por favor ingresa un nombre para tu inventario.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const description =
        type === 'PERSONAL'
          ? 'Inventario de uso personal'
          : 'Punto de venta y operaciones comerciales';

      let activeInv: any = null;

      // 1. Si existe un inventario predeterminado generado por trigger, actualizarlo
      if (defaultInventoryId) {
        const { data: updatedInv, error: updateError } = await supabase
          .from('inventories')
          .update({
            name: name.trim(),
            description: description,
            currency: currency,
            inventory_type: type,
            updated_at: new Date().toISOString()
          })
          .eq('id', defaultInventoryId)
          .select()
          .single();

        if (updateError) throw updateError;
        activeInv = updatedInv;
      } else {
        // 2. Si no existe ninguno, crear el nuevo inventario
        const { data: newInv, error: createError } = await supabase
          .from('inventories')
          .insert({
            name: name.trim(),
            description: description,
            currency: currency,
            inventory_type: type,
            owner_id: user.id
          })
          .select()
          .single();

        if (createError) throw createError;
        activeInv = newInv;

        // Asociar como owner
        await supabase.from('inventory_users').insert({
          inventory_id: newInv.id,
          user_id: user.id,
          role: 'owner'
        });

        // Crear ubicación inicial
        const locName = type === 'PERSONAL' ? 'Espacio Principal' : 'Almacén Central';
        const locCode = `LOC-${Math.random().toString(36).substring(2, 6).toUpperCase()}-01`;
        await supabase.from('locations').insert({
          inventory_id: newInv.id,
          name: locName,
          code: locCode,
          description: 'Ubicación física predeterminada'
        });

        // Crear categoría inicial
        await supabase.from('categories').insert({
          inventory_id: newInv.id,
          name: 'General',
          color: '#1E3A5F',
          description: 'Categoría inicial de productos'
        });
      }

      // Marcar onboarding como completado en almacenamiento local
      try {
        localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
        if (activeInv?.id) {
          localStorage.setItem(`active_inventory_${user.id}`, activeInv.id);
        }
      } catch (e) {
        console.warn('Error guardando clave de onboarding:', e);
      }

      // 3. Refrescar estado y seleccionar
      await refreshInventories();
      if (activeInv) {
        selectInventory({
          ...activeInv,
          role: 'owner',
          is_owner: true
        });
      }

      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      console.error('Error al configurar inventario inicial:', err);
      setErrorMsg(err.message || 'No se pudo crear el inventario. Inténtalo de nuevo.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full flex flex-col bg-white text-neutral-900 overflow-y-auto overscroll-contain font-sans">
      
      {/* Cabecera Oscura Minimalista Móvil */}
      <header className="shrink-0 bg-neutral-950 text-white rounded-b-[2.5rem] px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 select-none shadow-sm">
        <div className="max-w-md mx-auto">
          <span className="text-[11px] uppercase tracking-widest text-neutral-400 font-mono font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E8B4A0]" />
            Bienvenido a Stockly
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white mt-1">
            Configura tu primer espacio
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed font-light">
            Responde 3 preguntas básicas para comenzar a registrar productos y existencias.
          </p>
        </div>
      </header>

      {/* Cuerpo del Formulario */}
      <main className="flex-1 max-w-md w-full mx-auto px-6 py-6 flex flex-col justify-between">
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 leading-snug">
              {errorMsg}
            </div>
          )}

          {/* Pregunta 1: Nombre */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-800">
              ¿Cómo se llamará el inventario? <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Ej. Mi Depósito Central, Tienda Principal..."
                required
                className="w-full bg-neutral-50 border border-neutral-200/90 focus:border-neutral-950 focus:bg-white rounded-2xl pl-10 pr-4 py-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition-all box-border"
              />
              <Layers className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          {/* Pregunta 2: Tipo de Inventario */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-800">
              ¿Qué tipo de inventario utilizarás?
            </label>
            <div className="relative">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'BUSINESS' | 'PERSONAL')}
                className="w-full bg-neutral-50 border border-neutral-200/90 focus:border-neutral-950 focus:bg-white rounded-2xl pl-10 pr-10 py-3 text-base text-neutral-900 focus:outline-none transition-all appearance-none cursor-pointer box-border"
              >
                <option value="BUSINESS">Negocio (Ventas, catálogo y operaciones comerciales)</option>
                <option value="PERSONAL">Personal (Herramientas, colecciones o uso propio)</option>
              </select>
              <Briefcase className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Pregunta 3: Moneda */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-800">
              ¿Qué tipo de moneda deseas usar?
            </label>
            <div className="relative">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200/90 focus:border-neutral-950 focus:bg-white rounded-2xl pl-10 pr-10 py-3 text-base text-neutral-900 focus:outline-none transition-all appearance-none cursor-pointer box-border"
              >
                <option value="PEN">Sol Peruano (S/ PEN)</option>
                <option value="USD">Dólar Estadounidense ($ USD)</option>
                <option value="EUR">Euro (€ EUR)</option>
                <option value="MXN">Peso Mexicano ($ MXN)</option>
                <option value="COP">Peso Colombiano ($ COP)</option>
                <option value="CLP">Peso Chileno ($ CLP)</option>
                <option value="ARS">Peso Argentino ($ ARS)</option>
                <option value="BOB">Boliviano (Bs. BOB)</option>
                <option value="BRL">Real Brasileño (R$ BRL)</option>
              </select>
              <Coins className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Botón de Envío */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="w-full py-4 rounded-2xl bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-300" />
                  <span>Creando inventario...</span>
                </>
              ) : (
                <>
                  <span>Crear Inventario</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default FirstTimeOnboarding;
