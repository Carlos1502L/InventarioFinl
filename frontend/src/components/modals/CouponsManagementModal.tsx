import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Tag, Plus, Trash2, Percent, DollarSign, Loader2, Sparkles } from 'lucide-react';
import { Coupon, DiscountType } from '../../types/database';
import { supabase, formatCurrency } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { MinimalDropdown } from '../ui/MinimalDropdown';
import { PillOption } from '../common/PillOption';
import { CancelButton } from '../common/CancelButton';
import {
  ModalShell,
  ModalHeader,
  ModalTabsBar,
  ModalBody,
  ModalFooter,
  modalFieldCompactInputClass,
  modalFieldLabelClass,
  modalSurfaceCardClass,
  modalPrimaryButtonClass
} from './ModalShell';

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

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      disableDismiss={isSubmitting}
      formId={activeTab === 'create' ? 'create-coupon-form' : undefined}
    >
      <ModalHeader
        title="Cupones de descuento"
        subtitle="Promociones aplicables al registrar ventas en el POS"
        icon={<Tag className="w-4 h-4 lg:w-5 lg:h-5" />}
        iconTone="emerald"
        onClose={onClose}
        closeDisabled={isSubmitting}
      />

      <ModalTabsBar>
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
      </ModalTabsBar>

      <ModalBody className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-200">
            {successMsg}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'create' ? (
            <motion.form
              key="coupon-create"
              id="create-coupon-form"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              onSubmit={handleCreateCoupon}
              className="space-y-4"
            >
              <div className={`${modalSurfaceCardClass} space-y-3.5`}>
                <div>
                  <label className={modalFieldLabelClass}>
                    Código promocional <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="Ej: PROMO10"
                    required
                    className={`${modalFieldCompactInputClass} font-mono font-semibold uppercase tracking-wider`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className={modalFieldLabelClass}>Tipo de descuento</label>
                    <MinimalDropdown
                      value={discountType}
                      onChange={(val) => setDiscountType(val as DiscountType)}
                      options={[
                        { value: 'PERCENTAGE', label: 'Porcentaje (%)' },
                        { value: 'FIXED', label: `Monto fijo (${currentInventory?.currency || 'PEN'})` }
                      ]}
                    />
                  </div>

                  <div>
                    <label className={modalFieldLabelClass}>
                      Valor {discountType === 'PERCENTAGE' ? '(%)' : `(${currentInventory?.currency || 'PEN'})`}{' '}
                      <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={discountType === 'PERCENTAGE' ? '100' : undefined}
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                      required
                      className={`${modalFieldCompactInputClass} font-mono tabular-nums font-semibold`}
                    />
                  </div>
                </div>

                <div>
                  <label className={modalFieldLabelClass}>Descripción / Términos (opcional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Ej: Descuento especial de temporada"
                    className={modalFieldCompactInputClass}
                  />
                </div>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="coupon-existing"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-200 tabular-nums">
                  Promociones y cupones ({coupons.length})
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Aplicables en POS
                </span>
              </div>

              <div className="max-h-[360px] overflow-y-auto overscroll-contain custom-scrollbar-dark space-y-2 border border-slate-800/80 rounded-2xl bg-slate-950/45 p-3">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Cargando cupones...</span>
                  </div>
                ) : coupons.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400 space-y-2">
                    <p>No hay descuentos ni cupones creados aún.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('create')}
                      className="text-xs text-indigo-300 underline font-semibold cursor-pointer"
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
                        className="p-3 bg-slate-900/90 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2.5 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                              isActive
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {coupon.discount_type === 'PERCENTAGE' ? (
                              <Percent className="w-3.5 h-3.5" />
                            ) : (
                              <DollarSign className="w-3.5 h-3.5" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-100 tracking-wide">
                                {coupon.code}
                              </span>
                              <span className="text-xs font-mono tabular-nums font-semibold text-emerald-300">
                                {coupon.discount_type === 'PERCENTAGE'
                                  ? `-${coupon.discount_value}%`
                                  : `-${formatCurrency(coupon.discount_value, currentInventory?.currency)}`}
                              </span>
                              <span
                                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                                  isActive
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                {isActive ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </div>
                            {coupon.description && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {coupon.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(coupon)}
                            className={`min-h-[34px] lg:min-h-[30px] px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer border ${
                              isActive
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                            }`}
                            title={isActive ? 'Desactivar cupón' : 'Activar cupón'}
                          >
                            {isActive ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCoupon(coupon)}
                            className="min-h-[34px] min-w-[34px] lg:min-h-[30px] lg:min-w-[30px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
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
            </motion.div>
          )}
        </AnimatePresence>
      </ModalBody>

      <ModalFooter shortcutLabel={activeTab === 'create' ? 'para guardar' : undefined}>
        <CancelButton onClick={onClose} label="Cerrar" disabled={isSubmitting} />
        {activeTab === 'create' && (
          <button
            type="submit"
            form="create-coupon-form"
            disabled={isSubmitting || !code.trim()}
            className={modalPrimaryButtonClass}
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Guardar descuento</span>
          </button>
        )}
      </ModalFooter>
    </ModalShell>
  );
};
