import React, { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  Package
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
import { MinimalDropdown } from '../ui/MinimalDropdown';
import { matchesAnyField, normalizeText } from '../../utils/searchUtils';
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  modalFieldCompactInputClass,
  modalFieldLabelClass,
  modalSecondaryButtonClass,
  modalDangerButtonClass
} from './ModalShell';

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

  // Filtrado reactivo de búsqueda en catálogo (RF-SEARCH-016: Tolerancia a acentos)
  const searchResults = useMemo(() => {
    const norm = normalizeText(searchTerm);
    if (!norm) return [];
    return products
      .filter(p =>
        p.status === 'ACTIVE' &&
        matchesAnyField([p.name, p.code, (p as any).sku, p.description], norm)
      )
      .slice(0, 8);
  }, [searchTerm, products]);

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
  const handleConfirmWithdrawal = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="xl"
        disableDismiss={isSubmitting}
        onSubmitShortcut={() => {
          if (!isListEmpty && !hasInvalidItem && !isSubmitting) {
            handleConfirmWithdrawal();
          }
        }}
      >
        <ModalHeader
          title="Salida masiva de mercadería"
          subtitle="Escaneo rápido y descuento de stock en lote"
          icon={<PackageMinus className="w-4 h-4 lg:w-5 lg:h-5" />}
          iconTone="rose"
          onClose={onClose}
          closeDisabled={isSubmitting}
        />

        {/* Área de captura rápida */}
        <div className="px-4 lg:px-6 py-3 border-b border-slate-800/80 bg-slate-950/35 shrink-0 space-y-2.5">
          <div className="flex items-center gap-2.5 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setIsSearching(true);
                }}
                placeholder="Buscar producto por nombre o SKU..."
                className={`${modalFieldCompactInputClass} pl-10 pr-9`}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setIsSearching(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              title="Abrir escáner continuo de cámara"
              aria-label="Escanear con cámara"
              className={`${modalSecondaryButtonClass} shrink-0`}
            >
              <Camera className="w-4 h-4 text-indigo-400" />
              <span>Escanear</span>
            </button>
          </div>

          {isSearching && searchResults.length > 0 && (
            <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl max-h-48 overflow-y-auto overscroll-contain custom-scrollbar-dark divide-y divide-slate-800/70">
              {searchResults.map(p => {
                const alreadySelected = selectedItems.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAddProduct(p)}
                    className="w-full text-left p-2.5 px-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/70 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {p.images && p.images[0] ? (
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-100 truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                          SKU: {p.code} · Stock: {formatStockDisplay(p)}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/15 px-2.5 py-1 rounded-lg border border-indigo-500/30 shrink-0">
                      {alreadySelected ? '+ Sumar' : '+ Agregar'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Lista dinámica de productos seleccionados */}
        <ModalBody className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isListEmpty ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-center text-slate-400">
                <PackageMinus className="w-7 h-7 stroke-[1.5]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  No hay productos seleccionados
                </p>
                <p className="text-xs max-w-sm mt-1 text-slate-400">
                  Usa la barra de búsqueda o el botón de cámara para agregar productos al lote de retiro.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {itemsList.map(item => {
                  const prod = item.product;
                  const isBox = prod.unit_type === 'BOX' && Number(prod.units_per_box) > 0;
                  const maxStock = Number(prod.stock || 0);
                  const isExceeded = item.deltaStock > maxStock + 0.0001;

                  return (
                    <motion.div
                      key={prod.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isExceeded
                          ? 'bg-rose-500/10 border-rose-500/40'
                          : 'bg-slate-950/55 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-slate-100 truncate">
                          {prod.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] font-mono tabular-nums text-slate-400">
                            Disp: {formatStockDisplay(prod)}
                          </span>
                          {isExceeded && (
                            <span className="text-[11px] font-mono text-rose-300 font-semibold">
                              · Excede stock
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        {isBox ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden bg-slate-900">
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(prod.id, -1, 0)}
                                className="min-h-[36px] min-w-[32px] lg:min-h-[30px] lg:min-w-[28px] flex items-center justify-center hover:bg-slate-800 text-slate-200 active:scale-95 cursor-pointer"
                                title="Restar caja"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center font-mono tabular-nums text-xs font-semibold text-slate-100">
                                {item.quantityBoxes}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(prod.id, 1, 0)}
                                className="min-h-[36px] min-w-[32px] lg:min-h-[30px] lg:min-w-[28px] flex items-center justify-center hover:bg-slate-800 text-slate-200 active:scale-95 cursor-pointer"
                                title="Sumar caja"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">caj</span>

                            <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden bg-slate-900">
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(prod.id, 0, -1)}
                                className="min-h-[36px] min-w-[30px] lg:min-h-[30px] lg:min-w-[26px] flex items-center justify-center hover:bg-slate-800 text-slate-200 active:scale-95 cursor-pointer"
                                title="Restar unidad suelta"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="w-7 text-center font-mono tabular-nums text-[11px] font-semibold text-slate-100">
                                {item.quantityUnits}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(prod.id, 0, 1)}
                                className="min-h-[36px] min-w-[30px] lg:min-h-[30px] lg:min-w-[26px] flex items-center justify-center hover:bg-slate-800 text-slate-200 active:scale-95 cursor-pointer"
                                title="Sumar unidad suelta"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">und</span>
                          </div>
                        ) : (
                          <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden bg-slate-900">
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(prod.id, 0, -1)}
                              className="min-h-[36px] min-w-[32px] lg:min-h-[30px] lg:min-w-[28px] flex items-center justify-center hover:bg-slate-800 text-slate-200 active:scale-95 cursor-pointer"
                              title="Descontar 1 unidad"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-10 text-center font-mono tabular-nums text-xs font-semibold text-slate-100">
                              {item.quantityUnits}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(prod.id, 0, 1)}
                              className="min-h-[36px] min-w-[32px] lg:min-h-[30px] lg:min-w-[28px] flex items-center justify-center hover:bg-slate-800 text-slate-200 active:scale-95 cursor-pointer"
                              title="Sumar 1 unidad"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(prod.id)}
                          className="min-h-[36px] min-w-[36px] lg:min-h-[30px] lg:min-w-[30px] rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Eliminar de la lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {!isListEmpty && (
            <div className="pt-4 border-t border-slate-800/80 space-y-3">
              <div>
                <label className={modalFieldLabelClass}>Motivo de la salida</label>
                <MinimalDropdown
                  value={reason}
                  onChange={(val) => setReason(val)}
                  options={REASON_OPTIONS.map(r => ({ value: r, label: r }))}
                />
              </div>

              <div>
                <label className={modalFieldLabelClass}>Notas adicionales (opcional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ej. Salida autorizada para showroom, merma de embalaje..."
                  className={modalFieldCompactInputClass}
                />
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter shortcutLabel={!isListEmpty && !hasInvalidItem ? 'para confirmar' : undefined}>
          <button
            type="button"
            onClick={handleConfirmWithdrawal}
            disabled={isListEmpty || hasInvalidItem || isSubmitting}
            className={`${modalDangerButtonClass} w-full sm:w-auto`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Procesando lote...</span>
              </>
            ) : (
              <>
                <PackageMinus className="w-4 h-4" />
                <span className="tabular-nums">Confirmar descuentos ({itemsList.length})</span>
              </>
            )}
          </button>
        </ModalFooter>
      </ModalShell>

      {/* Escáner Continuo de Cámara */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleContinuousScan}
        continuous={true}
        title="Escaneo continuo de retiro"
        instructions="Escanea los códigos sucesivamente. Cada detección agregará el producto a la lista sin cerrar la cámara."
      />
    </>
  );
};
