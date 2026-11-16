import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Package, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Product } from '../../types/database';
import { formatStockDisplay } from '../../services/supabase';

interface StocktakeQuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  existingCountedQty?: number; // Cantidad previamente contada en esta sesión (si existe)
  onConfirm: (product: Product, countedQty: number, mode: 'replace' | 'add') => void;
}

export const StocktakeQuantityModal: React.FC<StocktakeQuantityModalProps> = ({
  isOpen,
  onClose,
  product,
  existingCountedQty = 0,
  onConfirm
}) => {
  const isPreviouslyCounted = existingCountedQty > 0;
  const isBoxProduct = product?.unit_type === 'BOX' && Number(product?.units_per_box) > 0;
  const unitsPerBox = Number(product?.units_per_box) || 1;

  // Modo de ingreso: 'unit' o 'box'
  const [selectedUnitMode, setSelectedUnitMode] = useState<'unit' | 'box'>('unit');
  // Si ya existía conteo, opción de sumar o reemplazar
  const [countMode, setCountMode] = useState<'add' | 'replace'>('add');
  // Valor numérico digitado
  const [inputValue, setInputValue] = useState<string>('1');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedUnitMode('unit');
      setCountMode('add');
      setInputValue('1');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  // Calcular cantidad física en unidades operativas
  const rawNumber = parseFloat(inputValue) || 0;
  const deltaUnits = selectedUnitMode === 'box'
    ? Number((rawNumber * unitsPerBox).toFixed(4))
    : Number(rawNumber.toFixed(4));

  const totalResultingQty = countMode === 'add'
    ? Number((existingCountedQty + deltaUnits).toFixed(4))
    : deltaUnits;

  const handleQuickDelta = (delta: number) => {
    const current = parseFloat(inputValue) || 0;
    const next = Math.max(0, current + delta);
    setInputValue(next.toString());
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (rawNumber <= 0 && countMode === 'replace' && existingCountedQty <= 0) return;
    onConfirm(product, deltaUnits, countMode);
    onClose();
  };

  // Imagen del producto
  const imageUrl = Array.isArray(product.images) && product.images.length > 0
    ? (typeof product.images[0] === 'string' ? product.images[0] : (product.images[0] as any)?.url)
    : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-neutral-950/60 backdrop-blur-xs select-none">
        {/* Fondo interactivo para cerrar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal Sheet Táctil */}
        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative w-full max-w-lg bg-white rounded-t-[2rem] sm:rounded-3xl shadow-2xl border border-neutral-200/80 overflow-hidden z-10 max-h-[90dvh] flex flex-col"
        >
          {/* Manija táctil móvil */}
          <div className="w-12 h-1.5 bg-neutral-300 rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />

          {/* Header */}
          <div className="px-5 pt-3 pb-3 border-b border-neutral-100 flex items-center justify-between shrink-0">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold block">
                Barrido · Conteo Físico
              </span>
              <h2 className="text-base font-bold text-neutral-900 truncate max-w-[280px]">
                {product.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Cuerpo con Scroll */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Tarjeta de Identificación del Producto */}
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-neutral-50 border border-neutral-100">
              <div className="w-14 h-14 rounded-xl bg-white border border-neutral-200/60 flex items-center justify-center overflow-hidden shrink-0">
                {imageUrl ? (
                  <img src={imageUrl} alt={product.name} className="w-full h-full object-contain" />
                ) : (
                  <Package className="w-6 h-6 text-neutral-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-mono font-medium text-neutral-500 block truncate">
                  SKU / CÓDIGO: {product.code}
                </span>
                <p className="text-xs text-neutral-400 mt-0.5 truncate">
                  {product.unit_type === 'BOX'
                    ? `Caja de ${product.units_per_box} unidades`
                    : 'Producto por Unidad'}
                </p>
                {isPreviouslyCounted && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                    <span>Ya contado en sesión: <strong>{existingCountedQty} unds</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Si ya estaba contado, preguntar Sumar o Reemplazar */}
            {isPreviouslyCounted && (
              <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-amber-900 block">
                  ¿Cómo deseas registrar esta lectura?
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCountMode('add')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      countMode === 'add'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-white text-neutral-700 border border-neutral-200/60'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Sumar a lo contado</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountMode('replace')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      countMode === 'replace'
                        ? 'bg-neutral-900 text-white shadow-xs'
                        : 'bg-white text-neutral-700 border border-neutral-200/60'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reemplazar cantidad</span>
                  </button>
                </div>
              </div>
            )}

            {/* Selector de Unidades / Cajas (Si aplica) */}
            {isBoxProduct && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-neutral-700 block">
                  Unidad de conteo
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUnitMode('unit')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                      selectedUnitMode === 'unit'
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Piezas / Unidades (und)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUnitMode('box')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                      selectedUnitMode === 'box'
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Cajas ({unitsPerBox} und/caja)
                  </button>
                </div>
              </div>
            )}

            {/* Input Numérico con Steppers Táctiles */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-700 block">
                {countMode === 'add' ? 'Cantidad a sumar (+)' : 'Nueva cantidad total'}
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDelta(-1)}
                  className="w-12 h-14 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 flex items-center justify-center text-lg font-bold shrink-0 active:scale-95 transition-all"
                >
                  <Minus className="w-5 h-5" />
                </button>

                <div className="flex-1 bg-neutral-50 border-2 border-neutral-300 focus-within:border-neutral-950 rounded-2xl px-3 py-1 flex items-center justify-center">
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full text-center text-2xl font-mono font-bold text-neutral-900 bg-transparent outline-none p-2"
                  />
                  <span className="text-xs font-mono font-semibold text-neutral-400 uppercase pr-1">
                    {selectedUnitMode === 'box' ? 'Cjs' : 'Unds'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleQuickDelta(1)}
                  className="w-12 h-14 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 flex items-center justify-center text-lg font-bold shrink-0 active:scale-95 transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Botones de incremento rápido (+5, +10, +25) */}
              <div className="flex items-center gap-2 pt-1">
                {[5, 10, 25].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickDelta(amt)}
                    className="flex-1 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-mono font-semibold text-neutral-700 active:scale-95 transition-all"
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumen del conteo resultante */}
            <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center justify-between text-xs">
              <span className="text-neutral-500">Total en este estante tras confirmar:</span>
              <span className="font-mono font-bold text-neutral-950 text-sm tabular-nums">
                {totalResultingQty} unds
                {isBoxProduct && unitsPerBox > 1 && (
                  <span className="text-[11px] font-normal text-neutral-500 ml-1">
                    ({(totalResultingQty / unitsPerBox).toFixed(2)} cjs)
                  </span>
                )}
              </span>
            </div>

            {/* Botón de Confirmación Principal */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={rawNumber <= 0 && countMode === 'replace' && existingCountedQty <= 0}
                className="w-full py-4 rounded-2xl bg-neutral-950 hover:bg-neutral-900 text-white font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Confirmar Conteo ({totalResultingQty} unds)</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
