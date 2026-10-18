import React, { useState, useEffect } from 'react';
import { X, Tag, Plus, Trash2, CheckCircle2, XCircle, Percent, DollarSign, Loader2, Sparkles } from 'lucide-react';
import { Coupon, DiscountType } from '../types/database';
import { supabase, formatCurrency } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface CouponsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CouponsManagementModal: React.FC<CouponsManagementModalProps> = ({
  isOpen,
  onClose
}) => {
  const { currentInventory } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Formulario nuevo cupón
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<string>('10');
  const [description, setDescription] = useState('');

  const loadCoupons = async () => {
    if (!currentInventory) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('inventory_id', currentInventory.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Si la tabla aún no existe, capturamos y mostramos mensaje amable
        if (error.code === '42P01') {
          setErrorMsg('La tabla de cupones se está inicializando. Ejecuta la migración en Supabase.');
          setCoupons([]);
          return;
        }
        throw error;
      }
      setCoupons(data || []);
    } catch (err: any) {
      console.error('Error cargando cupones:', err);
      setErrorMsg(err.message || 'Error cargando cupones.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentInventory) {
      loadCoupons();
      setCode('');
      setDiscountType('PERCENTAGE');
      setDiscountValue('10');
      setDescription('');
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, currentInventory]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory) return;

    const cleanCode = code.trim().toUpperCase();
    const numValue = parseFloat(discountValue);

    if (!cleanCode) {
      setErrorMsg('Debes ingresar un código para el cupón (ej: DESC10).');
      return;
    }

    if (isNaN(numValue) || numValue <= 0) {
      setErrorMsg('El valor del descuento debe ser un número positivo.');
      return;
    }

    if (discountType === 'PERCENTAGE' && numValue > 100) {
      setErrorMsg('El porcentaje de descuento no puede ser superior al 100%.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const { data, error } = await supabase
        .from('coupons')
        .insert({
          inventory_id: currentInventory.id,
          code: cleanCode,
          discount_type: discountType,
          discount_value: numValue,
          status: 'ACTIVE',
          description: description.trim() || null
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(`El código de cupón "${cleanCode}" ya existe en este inventario.`);
        }
        throw error;
      }

      setSuccessMsg(`Cupón "${cleanCode}" creado exitosamente.`);
      setCode('');
      setDescription('');
      setDiscountValue('10');
      loadCoupons();
    } catch (err: any) {
      console.error('Error creando cupón:', err);
      setErrorMsg(err.message || 'Error al guardar el cupón.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    const newStatus = coupon.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const { error } = await supabase
        .from('coupons')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', coupon.id);

      if (error) throw error;
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, status: newStatus } : c));
    } catch (err: any) {
      alert('Error cambiando estado del cupón: ' + err.message);
    }
  };

  const handleDeleteCoupon = async (coupon: Coupon) => {
    if (!confirm(`¿Eliminar definitivamente el cupón "${coupon.code}"?`)) return;
    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', coupon.id);

      if (error) throw error;
      setCoupons(prev => prev.filter(c => c.id !== coupon.id));
    } catch (err: any) {
      alert('Error eliminando cupón: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 dark:bg-purple-600/20 text-purple-600 dark:text-purple-400 rounded-xl">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Cupones de Descuento</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Promociones y descuentos aplicables en Ventas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 dark:text-rose-400">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-600 dark:text-emerald-400">
              {successMsg}
            </div>
          )}

          {/* Formulario de Creación */}
          <form onSubmit={handleCreateCoupon} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-purple-500" /> Crear Nuevo Cupón
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Código */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Código (Ej: DESC10) <span className="text-purple-500">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="DESC10"
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold uppercase text-slate-900 dark:text-white"
                />
              </div>

              {/* Tipo de Descuento */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Tipo de Descuento
                </label>
                <select
                  value={discountType}
                  onChange={e => setDiscountType(e.target.value as DiscountType)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  <option value="PERCENTAGE">Porcentaje (%)</option>
                  <option value="FIXED">Monto Fijo ({currentInventory?.currency || '$'})</option>
                </select>
              </div>

              {/* Valor del Descuento */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Valor {discountType === 'PERCENTAGE' ? '(%)' : `(${currentInventory?.currency || '$'})`} <span className="text-purple-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={discountType === 'PERCENTAGE' ? '100' : undefined}
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Descripción opcional */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Descripción / Términos (Opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ej: 10% de descuento de inauguración"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !code.trim()}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/20 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Guardar Cupón
            </button>
          </form>

          {/* Listado de Cupones */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
              Cupones Existentes ({coupons.length})
            </span>

            {loading ? (
              <p className="text-xs text-slate-400 text-center py-4">Cargando cupones...</p>
            ) : coupons.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                No hay cupones creados aún. Añade el primero arriba.
              </div>
            ) : (
              coupons.map((coupon) => {
                const isActive = coupon.status === 'ACTIVE';
                return (
                  <div
                    key={coupon.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isActive
                          ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {coupon.discount_type === 'PERCENTAGE' ? <Percent className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-slate-900 dark:text-white">
                            {coupon.code}
                          </span>
                          <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                            {coupon.discount_type === 'PERCENTAGE'
                              ? `-${coupon.discount_value}%`
                              : `-${formatCurrency(coupon.discount_value, currentInventory?.currency)}`}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                          }`}>
                            {isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        {coupon.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{coupon.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(coupon)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                          isActive
                            ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        }`}
                        title={isActive ? 'Desactivar cupón' : 'Activar cupón'}
                      >
                        {isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCoupon(coupon)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                        title="Eliminar cupón"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
