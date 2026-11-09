import React, { useState, useEffect } from 'react';
import { X, Tag, Plus, Trash2, Percent, DollarSign, Loader2, Sparkles } from 'lucide-react';
import { Coupon, DiscountType } from '../../types/database';
import { supabase, formatCurrency } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { MinimalDropdown } from '../ui/MinimalDropdown';
import { PillOption } from '../common/PillOption';

interface CouponsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CouponsManagementModal: React.FC<CouponsManagementModalProps> = ({
  isOpen,
  onClose
}) => {
  const { currentInventory } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'existing'>('create');
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
        if (error.code === '42P01') {
          setErrorMsg('La tabla de cupones se está inicializando en Supabase.');
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

      const { error } = await supabase
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
      await loadCoupons();
      setActiveTab('existing');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="mobile-dark-modal bg-[#ffffff] border border-[#ececec] rounded-2xl md:rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85dvh] font-sans">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ececec] bg-[#ffffff] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#17191c]/10 text-[#17191c] flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5 text-[#17191c]" />
            </div>
            <div>
              <h3 className="font-bold text-[#17191c] text-base uppercase tracking-tight">
                Cupones de Descuento
              </h3>
              <p className="text-[11px] text-[#777b86]">
                Promociones aplicables al registrar ventas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#17191c] hover:bg-[#fafafb] border border-[#ececec] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de Pestañas Tipo Píldora (RF-UI-TABS-008 & RNF-UX-CONSISTENCY-005) */}
        <div className="mobile-tabs-bar flex items-center gap-2 px-6 py-3 border-b border-[#ececec] bg-white shrink-0 overflow-x-auto">
          <PillOption
            active={activeTab === 'create'}
            onClick={() => setActiveTab('create')}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Crear cupón
          </PillOption>

          <PillOption
            active={activeTab === 'existing'}
            onClick={() => setActiveTab('existing')}
            badge={coupons.length}
          >
            Existentes
          </PillOption>
        </div>

        {/* Contenido según Pestaña Activa */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
              {successMsg}
            </div>
          )}

          {/* PESTAÑA 1: FORMULARIO CREAR DESCUENTO */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateCoupon} className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-[#fafafb] rounded-2xl border border-[#ececec] space-y-3.5">
                <span className="text-xs font-bold text-[#17191c] uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-white" /> Datos de la Promoción
                </span>

                <div className="space-y-3">
                  {/* Código Promocional */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#17191c] mb-1">
                      Código Promocional <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={e => setCode(e.target.value.toUpperCase())}
                      placeholder="Ej: PROMO10"
                      required
                      className="w-full bg-white border border-[#ececec] focus:border-[#17191c] rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase text-[#17191c] placeholder:text-neutral-400 focus:outline-none transition-all box-border"
                    />
                  </div>

                  {/* Al Mismo Nivel: Tipo de Descuento y Valor */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#17191c] mb-1 truncate">
                        Tipo de Descuento
                      </label>
                      <MinimalDropdown
                        value={discountType}
                        onChange={(val) => setDiscountType(val as DiscountType)}
                        options={[
                          { value: 'PERCENTAGE', label: 'Porcentaje (%)' },
                          { value: 'FIXED', label: `Monto Fijo (${currentInventory?.currency || 'PEN'})` }
                        ]}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#17191c] mb-1 truncate">
                        Valor {discountType === 'PERCENTAGE' ? '(%)' : `(${currentInventory?.currency || 'PEN'})`} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={discountType === 'PERCENTAGE' ? '100' : undefined}
                        value={discountValue}
                        onChange={e => setDiscountValue(e.target.value)}
                        required
                        className="w-full bg-white border border-[#ececec] focus:border-[#17191c] rounded-xl px-3 py-2 text-xs font-bold text-[#17191c] placeholder:text-neutral-400 focus:outline-none transition-all box-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Descripción opcional */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#17191c] mb-1">
                    Descripción / Términos (Opcional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Ej: Descuento especial de temporada"
                    className="w-full bg-white border border-[#ececec] focus:border-[#17191c] rounded-xl px-3 py-2 text-xs text-[#17191c] placeholder:text-neutral-400 focus:outline-none transition-all box-border"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !code.trim()}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#17191c] hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Guardar Descuento</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* PESTAÑA 2: DESCUENTOS EXISTENTES (RECUADRO CON SCROLL CONTENIDO) */}
          {activeTab === 'existing' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-[#777b86]">
                <span className="font-semibold text-[#17191c]">
                  Promociones y Cupones Activos ({coupons.length})
                </span>
                <span className="text-[10px] font-mono">
                  Se aplican en el punto de cobro / ventas
                </span>
              </div>

              {/* Recuadro contenedor con scroll para evitar scroll infinito */}
              <div className="max-h-[380px] overflow-y-auto space-y-2.5 border border-[#ececec] rounded-2xl bg-[#fafafb]/40 p-3 overscroll-contain">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#777b86]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#17191c]" />
                    <span>Cargando cupones...</span>
                  </div>
                ) : coupons.length === 0 ? (
                  <div className="text-center py-10 text-xs text-[#777b86] space-y-2">
                    <p>No hay descuentos ni cupones creados aún.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('create')}
                      className="text-xs text-[#17191c] underline font-semibold cursor-pointer"
                    >
                      Crear el primer descuento
                    </button>
                  </div>
                ) : (
                  coupons.map((coupon) => {
                    const isActive = coupon.status === 'ACTIVE';
                    return (
                      <div
                        key={coupon.id}
                        className="py-2.5 px-3 bg-white rounded-xl border border-[#ececec] flex items-center justify-between gap-2.5 group hover:border-[#17191c]/40 transition-colors shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isActive
                              ? 'bg-[#17191c]/10 text-[#17191c]'
                              : 'bg-neutral-100 text-neutral-400'
                          }`}>
                            {coupon.discount_type === 'PERCENTAGE' ? (
                              <Percent className="w-3.5 h-3.5" />
                            ) : (
                              <DollarSign className="w-3.5 h-3.5" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-[#17191c]">
                                {coupon.code}
                              </span>
                              <span className="text-[11px] font-bold text-[#17191c]">
                                {coupon.discount_type === 'PERCENTAGE'
                                  ? `-${coupon.discount_value}%`
                                  : `-${formatCurrency(coupon.discount_value, currentInventory?.currency)}`}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                              }`}>
                                {isActive ? 'Activo' : 'Inactivo'}
                              </span>
                            </div>
                            {coupon.description && (
                              <p className="text-[10px] text-[#777b86] truncate leading-tight mt-0.5">{coupon.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(coupon)}
                            className={`px-2 py-1 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer border ${
                              isActive
                                ? 'bg-[#fafafb] hover:bg-neutral-100 text-[#777b86] border-[#ececec]'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}
                            title={isActive ? 'Desactivar cupón' : 'Activar cupón'}
                          >
                            {isActive ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCoupon(coupon)}
                            className="p-1 text-neutral-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar cupón"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
