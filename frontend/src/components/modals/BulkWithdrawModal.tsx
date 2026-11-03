import React, { useState, useMemo } from 'react';
import {
  X,
  PackageMinus,
  Search,
  Camera,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  Loader2,
  Package,
  ChevronDown
} from 'lucide-react';
import { Product } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import {
  supabase,
  logAuditAction,
  formatCleanDecimal,
  formatStockDisplay,
  getBoxBreakdown
} from '../../services/supabase';
import {
  saveWithdrawalLocally,
  isNetworkOrOfflineError
} from '../../services/offlineSync';
import { showAppToast } from '../ui/ToastNotification';
import { BarcodeScannerModal } from './BarcodeScannerModal';

export interface BulkWithdrawalSelectedItem {
  product: Product;
  quantityUnits: number;
  quantityBoxes: number;
  deltaStock: number;
}

interface BulkWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onWithdrawn: (withdrawnItems: Array<{ product_id: string; quantity: number }>) => void;
}

const REASON_OPTIONS = [
  'Merma / Daño',
  'Uso personal / Consumo interno',
  'Venta externa / Marketplace',
  'Ajuste de inventario'
] as const;

export const BulkWithdrawModal: React.FC<BulkWithdrawModalProps> = ({
  isOpen,
  onClose,
  products,
  onWithdrawn
}) => {
  const { currentInventory, user } = useAuth();

  // Estado del lote de retiro
  const [selectedItems, setSelectedItems] = useState<Map<string, BulkWithdrawalSelectedItem>>(new Map());
  const [reason, setReason] = useState<string>(REASON_OPTIONS[0]);
  const [notes, setNotes] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtrado reactivo de búsqueda en catálogo
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.trim().toLowerCase();
    return products
      .filter(p =>
        p.status === 'ACTIVE' &&
        (p.name.toLowerCase().includes(term) ||
          p.code.toLowerCase().includes(term) ||
          (p.description && p.description.toLowerCase().includes(term)))
      )
      .slice(0, 8);
  }, [searchTerm, products]);

  if (!isOpen) return null;

  // Helper para recalcular deltaStock
  const computeDelta = (product: Product, boxes: number, units: number): number => {
    const isBox = product.unit_type === 'BOX' && Number(product.units_per_box) > 0;
    const upb = Number(product.units_per_box || 1);
    if (isBox) {
      return Number((boxes + units / upb).toFixed(4));
    }
    return Math.round(units);
  };

  // Agregar o incrementar producto al lote
  const handleAddProduct = (product: Product) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      const isBox = product.unit_type === 'BOX' && Number(product.units_per_box) > 0;
      const upb = Number(product.units_per_box || 1);
      const maxStock = Number(product.stock || 0);

      if (next.has(product.id)) {
        const current = next.get(product.id)!;
        if (isBox) {
          const newBoxes = current.quantityBoxes + 1;
          const newDelta = computeDelta(product, newBoxes, current.quantityUnits);
          if (newDelta <= maxStock) {
            next.set(product.id, {
              ...current,
              quantityBoxes: newBoxes,
              deltaStock: newDelta
            });
          }
        } else {
          const newUnits = current.quantityUnits + 1;
          if (newUnits <= maxStock) {
            next.set(product.id, {
              ...current,
              quantityUnits: newUnits,
              deltaStock: newUnits
            });
          }
        }
      } else {
        let initialBoxes = 0;
        let initialUnits = 1;
        if (isBox) {
          if (maxStock >= 1) {
            initialBoxes = 1;
            initialUnits = 0;
          } else {
            initialBoxes = 0;
            initialUnits = Math.min(Math.floor(maxStock * upb), 1);
          }
        } else {
          initialUnits = Math.min(maxStock, 1);
        }

        const delta = computeDelta(product, initialBoxes, initialUnits);
        next.set(product.id, {
          product,
          quantityBoxes: initialBoxes,
          quantityUnits: initialUnits,
          deltaStock: delta
        });
      }
      return next;
    });

    setSearchTerm('');
    setIsSearching(false);
  };

  // Manejador de escáner continuo
  const handleContinuousScan = (scannedCode: string) => {
    const clean = scannedCode.trim().toLowerCase();
    const found = products.find(
      p => p.code.toLowerCase() === clean && p.status === 'ACTIVE'
    );
    if (found) {
      handleAddProduct(found);
    } else {
      setErrorMsg(`No se encontró producto activo con el código "${scannedCode}".`);
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  // Actualizar cantidades de un item
  const handleUpdateItem = (
    productId: string,
    deltaBoxes: number,
    deltaUnits: number
  ) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      const item = next.get(productId);
      if (!item) return prev;

      const isBox = item.product.unit_type === 'BOX' && Number(item.product.units_per_box) > 0;
      const upb = Number(item.product.units_per_box || 1);
      const maxStock = Number(item.product.stock || 0);

      const nextBoxes = Math.max(0, item.quantityBoxes + deltaBoxes);
      const nextUnits = Math.max(0, item.quantityUnits + deltaUnits);
      const nextDelta = computeDelta(item.product, nextBoxes, nextUnits);

      if (nextDelta > maxStock + 0.0001) {
        return prev;
      }

      if (nextDelta <= 0 && nextBoxes === 0 && nextUnits === 0) {
        next.delete(productId);
        return next;
      }

      next.set(productId, {
        ...item,
        quantityBoxes: nextBoxes,
        quantityUnits: nextUnits,
        deltaStock: nextDelta
      });
      return next;
    });
  };

  const handleRemoveItem = (productId: string) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
  };

  const itemsList = Array.from(selectedItems.values());
  const totalItemsCount = itemsList.length;
  const isListEmpty = totalItemsCount === 0;

  // Validación: verificar si algún item tiene deltaStock <= 0 o supera el stock
  const hasInvalidItem = itemsList.some(i => {
    const max = Number(i.product.stock || 0);
    return i.deltaStock <= 0 || i.deltaStock > max + 0.0001;
  });

  // Confirmar Salida Masiva
  const handleConfirmWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || isListEmpty || hasInvalidItem || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const payloadItems = itemsList.map(item => ({
        product_id: item.product.id,
        product_name: item.product.name,
        unit_type: item.product.unit_type || 'UNIT',
        units_per_box: item.product.units_per_box || null,
        quantity_units: item.quantityUnits,
        quantity_boxes: item.quantityBoxes,
        deltaStock: item.deltaStock
      }));

      // RUTA OFFLINE: !navigator.onLine
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await saveWithdrawalLocally({
          inventory_id: currentInventory.id,
          reason,
          notes: notes.trim() || undefined,
          user_id: user?.id,
          user_email: user?.email,
          items: payloadItems
        });

        onWithdrawn(payloadItems.map(i => ({ product_id: i.product_id, quantity: i.deltaStock })));
        showAppToast('Descuento registrado localmente (pendiente de sincronización)', 'info', 4000);
        setSelectedItems(new Map());
        onClose();
        return;
      }

      // RUTA ONLINE: Ejecutar actualización directa en Supabase
      try {
        for (const item of payloadItems) {
          const originalProd = item;
          const currentProd = products.find(p => p.id === item.product_id);
          const currentStock = Number(currentProd?.stock || 0);
          const newStock = Math.max(0, Number((currentStock - item.deltaStock).toFixed(4)));

          const { error: updErr } = await supabase
            .from('products')
            .update({
              stock: newStock,
              updated_at: new Date().toISOString(),
              ...(user?.id ? { last_modified_by: user.id } : {}),
              ...(user?.email ? { last_modified_by_email: user.email } : {})
            })
            .eq('id', item.product_id);

          if (updErr) throw updErr;

          await logAuditAction({
            inventoryId: currentInventory.id,
            productId: item.product_id,
            productName: item.product_name,
            actionType: 'WITHDRAW',
            details: `Salida masiva de mercadería: -${item.deltaStock} ${item.unit_type === 'BOX' ? 'cajas' : 'und'}. Motivo: "${reason}". ${notes ? `Nota: "${notes.trim()}"` : ''}`,
            metadata: {
              previous_stock: currentStock,
              new_stock: newStock,
              withdrawn: item.deltaStock,
              reason,
              notes: notes.trim() || null
            }
          });
        }

        onWithdrawn(payloadItems.map(i => ({ product_id: i.product_id, quantity: i.deltaStock })));
        showAppToast('Descuento de mercadería procesado con éxito.', 'success', 4000);
        setSelectedItems(new Map());
        onClose();
      } catch (onlineErr: any) {
        if (isNetworkOrOfflineError(onlineErr)) {
          // Fallback a withdrawals_queue si se cortó la conexión durante la llamada
          await saveWithdrawalLocally({
            inventory_id: currentInventory.id,
            reason,
            notes: notes.trim() || undefined,
            user_id: user?.id,
            user_email: user?.email,
            items: payloadItems
          });

          onWithdrawn(payloadItems.map(i => ({ product_id: i.product_id, quantity: i.deltaStock })));
          showAppToast('Descuento registrado localmente (pendiente de sincronización)', 'info', 4000);
          setSelectedItems(new Map());
          onClose();
        } else {
          throw onlineErr;
        }
      }
    } catch (err: any) {
      console.error('Error al procesar salida masiva:', err);
      setErrorMsg(err.message || 'Error al procesar el retiro masivo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 max-md:bg-black/75 backdrop-blur-sm p-3 sm:p-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in fade-in">
        <div className="mobile-dark-modal bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col font-sans">
          {/* 1. CABECERA DEL MODAL */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#ffffff] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <PackageMinus className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-[#1E3A5F] text-base uppercase tracking-tight">
                  Salida Masiva de Mercadería
                </h3>
                <p className="text-xs text-[#616161]">
                  Escaneo rápido y descuento de stock en lote
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#616161] hover:text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. ÁREA DE CAPTURA RÁPIDA (BÚSQUEDA ANCHA A LA IZQUIERDA + ESCÁNER PEQUEÑO A LA DERECHA AL MISMO NIVEL) */}
          <div className="p-4 sm:p-6 pb-2 border-b border-[#E5E7EB] bg-[#F8F9FA]/80 shrink-0 space-y-3">
            <div className="flex items-center gap-2.5 w-full">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-[#616161] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    setIsSearching(true);
                  }}
                  placeholder="Buscar producto por nombre o SKU..."
                  className="w-full h-11 bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl pl-10 pr-9 text-xs font-mono uppercase text-[#1E3A5F] placeholder-[#616161] focus:outline-none transition-colors shadow-xs"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setIsSearching(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#616161] hover:text-[#1E3A5F] p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Botón Escáner Continuo pequeño a la derecha al mismo nivel */}
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                title="Abrir escáner continuo de cámara"
                aria-label="Escanear con cámara"
                className="w-11 h-11 flex items-center justify-center bg-white hover:bg-[#F8F9FA] border border-[#E5E7EB] hover:border-black rounded-xl text-black active:scale-95 transition-all shadow-xs shrink-0"
              >
                <Camera className="w-4 h-4 text-black" />
              </button>
            </div>

            {/* Resultados de Búsqueda Desplegables */}
            {isSearching && searchResults.length > 0 && (
              <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-[#E5E7EB] animate-in fade-in">
                {searchResults.map(p => {
                  const alreadySelected = selectedItems.has(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleAddProduct(p)}
                      className="p-2.5 px-4 flex items-center justify-between hover:bg-[#F8F9FA] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {p.images && p.images[0] ? (
                          <img
                            src={p.images[0]}
                            alt={p.name}
                            className="w-9 h-9 rounded-lg object-cover border border-[#E5E7EB] shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-[#E5E7EB] flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-[#616161]" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#1E3A5F] truncate">{p.name}</p>
                          <p className="text-[10px] text-[#616161] font-mono">
                            SKU: {p.code} • Stock: {formatStockDisplay(p)}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-[#1E3A5F] bg-[#F8F9FA] px-2 py-1 rounded border border-[#E5E7EB] shrink-0">
                        {alreadySelected ? 'Sumar (+)' : 'Agregar (+)'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. LISTA DINÁMICA DE PRODUCTOS SELECCIONADOS (SOLO NOMBRE Y CONTROLES AL LADO) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {isListEmpty ? (
              <div className="py-12 flex flex-col items-center justify-center text-center text-[#616161] space-y-3">
                <div className="w-14 h-14 rounded-full bg-[#F8F9FA] border border-[#E5E7EB] flex items-center justify-center text-[#616161]">
                  <PackageMinus className="w-7 h-7 stroke-[1.25]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1E3A5F]">
                    No hay productos seleccionados
                  </p>
                  <p className="text-xs max-w-sm mt-1 text-[#616161]">
                    Usa la barra de búsqueda o el botón de cámara para agregar productos al lote.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {itemsList.map(item => {
                  const prod = item.product;
                  const isBox = prod.unit_type === 'BOX' && Number(prod.units_per_box) > 0;
                  const maxStock = Number(prod.stock || 0);
                  const isExceeded = item.deltaStock > maxStock + 0.0001;

                  return (
                    <div
                      key={prod.id}
                      className={`p-3 px-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        isExceeded
                          ? 'bg-rose-50 border-rose-300'
                          : 'bg-white border-[#E5E7EB] hover:border-[#1E3A5F]/40 shadow-sm'
                      }`}
                    >
                      {/* Solo Nombre de Producto y Disponibilidad */}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-[#1E3A5F] truncate">
                          {prod.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-[#616161]">
                            Disp: {formatStockDisplay(prod)}
                          </span>
                          {isExceeded && (
                            <span className="text-[10px] font-mono text-rose-600 font-bold">
                              • Excede stock
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controles para Sumar o Descontar al lado */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isBox ? (
                          <div className="flex items-center gap-1.5">
                            {/* Cajas */}
                            <div className="flex items-center border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#F8F9FA]">
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(prod.id, -1, 0)}
                                className="w-7 h-7 flex items-center justify-center hover:bg-[#E5E7EB] text-[#1E3A5F] active:scale-95"
                                title="Restar caja"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center font-mono text-xs font-semibold text-[#1E3A5F]">
                                {item.quantityBoxes}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(prod.id, 1, 0)}
                                className="w-7 h-7 flex items-center justify-center hover:bg-[#E5E7EB] text-[#1E3A5F] active:scale-95"
                                title="Sumar caja"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[10px] font-mono text-[#616161]">caj</span>

                            {/* Unidades Sueltas */}
                            <div className="flex items-center border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#F8F9FA]">
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(prod.id, 0, -1)}
                                className="w-6 h-7 flex items-center justify-center hover:bg-[#E5E7EB] text-[#1E3A5F] active:scale-95"
                                title="Restar unidad suelta"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="w-6 text-center font-mono text-[11px] font-semibold text-[#1E3A5F]">
                                {item.quantityUnits}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(prod.id, 0, 1)}
                                className="w-6 h-7 flex items-center justify-center hover:bg-[#E5E7EB] text-[#1E3A5F] active:scale-95"
                                title="Sumar unidad suelta"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                            <span className="text-[10px] font-mono text-[#616161]">und</span>
                          </div>
                        ) : (
                          <div className="flex items-center border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#F8F9FA]">
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(prod.id, 0, -1)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-[#E5E7EB] text-[#1E3A5F] active:scale-95"
                              title="Descontar 1 unidad"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-10 text-center font-mono text-xs font-semibold text-[#1E3A5F]">
                              {item.quantityUnits}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(prod.id, 0, 1)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-[#E5E7EB] text-[#1E3A5F] active:scale-95"
                              title="Sumar 1 unidad"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Botón Remover */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(prod.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#616161] hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
                          title="Eliminar de la lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4. METADATA DE LA SALIDA (MOTIVO COMO SELECTOR DESPLEGABLE Y NOTAS) */}
            {!isListEmpty && (
              <div className="pt-4 border-t border-[#E5E7EB] space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1E3A5F] mb-1.5 uppercase font-mono">
                    Motivo de la Salida:
                  </label>
                  <div className="relative">
                    <select
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl px-3.5 py-2.5 text-xs text-[#1E3A5F] font-medium appearance-none cursor-pointer pr-10 shadow-sm focus:outline-none transition-colors"
                    >
                      {REASON_OPTIONS.map(r => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#616161] absolute right-3.5 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E3A5F] mb-1.5 uppercase font-mono">
                    Notas adicionales (opcional):
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Ej. Salida autorizada para showroom, merma de embalaje..."
                    className="w-full bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl px-3.5 py-2.5 text-xs text-[#1E3A5F] placeholder-[#616161] focus:outline-none transition-colors shadow-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. BOTÓN DE ACCIÓN INFERIOR */}
          <div className="p-4 sm:p-6 border-t border-[#E5E7EB] bg-[#ffffff] shrink-0">
            <button
              type="button"
              onClick={handleConfirmWithdrawal}
              disabled={isListEmpty || hasInvalidItem || isSubmitting}
              className={`w-full min-h-[48px] py-3 px-4 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] ${
                isListEmpty || hasInvalidItem || isSubmitting
                  ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed border border-neutral-300'
                  : 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>PROCESANDO...</span>
                </>
              ) : (
                <>
                  <PackageMinus className="w-4 h-4" />
                  <span>Confirmar Descuentos</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Escáner Continuo de Cámara */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleContinuousScan}
        continuous={true}
        title="Escaneo Continuo de Retiro"
        instructions="Escanea los códigos sucesivamente. Cada detección agregará el producto a la lista sin cerrar la cámara."
      />
    </>
  );
};
