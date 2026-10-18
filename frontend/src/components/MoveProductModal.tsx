import React, { useState } from 'react';
import { X, ArrowRightLeft, MapPin, Loader2, Check, Camera } from 'lucide-react';
import { Product, Location } from '../types/database';
import { supabase, logAuditAction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface MoveProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onMoved: () => void;
  locations: Location[];
}

export const MoveProductModal: React.FC<MoveProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onMoved,
  locations
}) => {
  const { currentInventory, user } = useAuth();
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [quantityToMove, setQuantityToMove] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Inicializar cantidad al abrir
  React.useEffect(() => {
    if (product) {
      setQuantityToMove(product.stock > 0 ? 1 : 0);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  // Ubicaciones de destino posibles (excluyendo la actual)
  const availableDestinations = locations.filter(l => l.id !== product.location_id);
  const currentLocation = locations.find(l => l.id === product.location_id);
  const selectedLocation = locations.find(l => l.id === selectedLocationId);

  // RF-08.1: Escaneo de código QR para seleccionar destino
  const handleScanLocationQR = (scannedCode: string) => {
    const clean = scannedCode.trim();
    const foundLoc = locations.find(
      l => l.code.toUpperCase() === clean.toUpperCase() || l.id === clean
    );

    if (foundLoc) {
      if (foundLoc.id === product.location_id) {
        setErrorMsg(`La ubicación "${foundLoc.name}" ya es la ubicación actual del producto.`);
      } else {
        setSelectedLocationId(foundLoc.id);
        setErrorMsg(null);
      }
    } else {
      setErrorMsg(`No se encontró ninguna ubicación con el código "${scannedCode}".`);
    }
  };

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !user || !selectedLocationId) return;

    const targetLocation = locations.find(l => l.id === selectedLocationId);
    if (!targetLocation) {
      setErrorMsg('Debes seleccionar una ubicación física de destino válida.');
      return;
    }

    if (quantityToMove <= 0 || quantityToMove > product.stock) {
      setErrorMsg(`La cantidad a trasladar debe estar entre 1 y ${product.stock} unidades.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const fromName = currentLocation ? `${currentLocation.name} (${currentLocation.code})` : 'Ubicación previa';
      const toName = `${targetLocation.name} (${targetLocation.code})`;

      // CASO A: Traslado TOTAL (todas las unidades)
      if (quantityToMove >= product.stock) {
        // Verificar si ya existe este mismo código en la ubicación destino
        const { data: existingAtTarget } = await supabase
          .from('products')
          .select('id, stock')
          .eq('inventory_id', currentInventory.id)
          .eq('code', product.code)
          .eq('location_id', selectedLocationId)
          .maybeSingle();

        if (existingAtTarget && existingAtTarget.id !== product.id) {
          // Fusionar stock en destino y eliminar fila origen
          await supabase
            .from('products')
            .update({
              stock: (existingAtTarget.stock || 0) + product.stock,
              last_modified_by: user.id,
              last_modified_by_email: user.email,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingAtTarget.id);

          await supabase.from('products').delete().eq('id', product.id);
        } else {
          // Actualización directa de ubicación
          const { error: updateError } = await supabase
            .from('products')
            .update({
              location_id: selectedLocationId,
              last_modified_by: user.id,
              last_modified_by_email: user.email,
              updated_at: new Date().toISOString()
            })
            .eq('id', product.id);

          if (updateError) throw updateError;
        }

        await logAuditAction({
          inventoryId: currentInventory.id,
          productId: product.id,
          productName: product.name,
          actionType: 'MOVE',
          details: `Traslado total (${product.stock} uds) desde "${fromName}" hacia "${toName}". ${reason ? `Motivo: ${reason}` : ''}`,
          metadata: {
            from_location_id: product.location_id,
            to_location_id: targetLocation.id,
            quantity_moved: product.stock,
            is_partial: false,
            reason: reason || null
          }
        });
      } else {
        // CASO B: Traslado PARCIAL (se trasladan algunas unidades y el resto permanece en origen)
        // 1. Verificar si ya existe el producto en el destino
        const { data: existingAtTarget } = await supabase
          .from('products')
          .select('id, stock')
          .eq('inventory_id', currentInventory.id)
          .eq('code', product.code)
          .eq('location_id', selectedLocationId)
          .maybeSingle();

        if (existingAtTarget) {
          await supabase
            .from('products')
            .update({
              stock: (existingAtTarget.stock || 0) + quantityToMove,
              last_modified_by: user.id,
              last_modified_by_email: user.email,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingAtTarget.id);
        } else {
          // Crear copia del producto en el nuevo almacén con la cantidad trasladada
          const newProductPayload = {
            inventory_id: currentInventory.id,
            name: product.name,
            code: product.code,
            description: product.description,
            price: product.price,
            cost_price: product.cost_price || 0,
            markup_percentage: product.markup_percentage || 0,
            stock: quantityToMove,
            min_stock: product.min_stock || 1,
            category_id: product.category_id,
            subcategory_id: product.subcategory_id,
            location_id: selectedLocationId,
            images: product.images || [],
            status: 'ACTIVE',
            parent_id: product.parent_id,
            is_variant: product.is_variant,
            variant_attributes: product.variant_attributes,
            last_modified_by: user.id,
            last_modified_by_email: user.email
          };

          const { error: insertErr } = await supabase
            .from('products')
            .insert(newProductPayload);

          if (insertErr) {
            // Si la base de datos restringe unicidad estricta de (inventory_id, code), usar subcódigo con ubicación
            if (insertErr.code === '23505') {
              const suffixedCode = `${product.code}-${targetLocation.code}`;
              await supabase
                .from('products')
                .insert({ ...newProductPayload, code: suffixedCode });
            } else {
              throw insertErr;
            }
          }
        }

        // 2. Descontar las unidades trasladadas del producto en origen
        const remainingStock = product.stock - quantityToMove;
        const { error: deductErr } = await supabase
          .from('products')
          .update({
            stock: remainingStock,
            last_modified_by: user.id,
            last_modified_by_email: user.email,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id);

        if (deductErr) throw deductErr;

        await logAuditAction({
          inventoryId: currentInventory.id,
          productId: product.id,
          productName: product.name,
          actionType: 'MOVE',
          details: `Traslado parcial de almacén: movidas ${quantityToMove} de ${product.stock} unidades desde "${fromName}" hacia "${toName}". Stock restante en origen: ${remainingStock} uds. ${reason ? `Motivo: ${reason}` : ''}`,
          metadata: {
            from_location_id: product.location_id,
            to_location_id: targetLocation.id,
            quantity_moved: quantityToMove,
            remaining_stock: remainingStock,
            is_partial: true,
            reason: reason || null
          }
        });
      }

      onMoved();
      onClose();
    } catch (err: any) {
      console.error('Error al transferir ubicación:', err);
      setErrorMsg(err.message || 'Error al mover el producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
          {/* Cabecera */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 dark:bg-amber-600/20 text-amber-600 dark:text-amber-400 rounded-xl">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Mover de Ubicación</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Transferencia entre almacenes</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleMove} className="p-5 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400">
                {errorMsg}
              </div>
            )}

            {/* Información del producto y ubicación actual */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 space-y-1">
              <span className="text-[10px] text-slate-400 dark:text-slate-400 uppercase font-bold tracking-wider">Producto</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{product.name}</p>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 pt-1">
                <MapPin className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>Ubicación actual: <strong>{currentLocation?.name || 'Desconocida'}</strong> ({currentLocation?.code})</span>
              </div>
            </div>
            {/* Cantidad a Mover (Transferencia Parcial si stock > 1) */}
            {product.stock > 1 ? (
              <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Cantidad a Trasladar <span className="text-amber-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Total disponible: <strong className="text-amber-600 dark:text-amber-400">{product.stock} uds</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantityToMove(q => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={product.stock}
                    value={quantityToMove}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1;
                      setQuantityToMove(Math.max(1, Math.min(product.stock, val)));
                    }}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-center text-sm font-extrabold text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantityToMove(q => Math.min(product.stock, q + 1))}
                    className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantityToMove(product.stock)}
                    className="px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-xl transition-colors whitespace-nowrap"
                  >
                    Todas ({product.stock})
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {quantityToMove < product.stock 
                    ? `Se moverán ${quantityToMove} uds y permanecerán ${product.stock - quantityToMove} uds en la ubicación actual.`
                    : `Se trasladará la totalidad del inventario de este producto.`}
                </p>
              </div>
            ) : (
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/40 text-[11px] text-slate-500">
                Traslado de unidad única (1 ud).
              </div>
            )}

            {/* Selección de nueva ubicación con Escáner QR (RF-08.1) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nueva Ubicación de Destino <span className="text-amber-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedLocationId}
                    onChange={e => setSelectedLocationId(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800"
                  >
                    <option value="" disabled>Selecciona la nueva ubicación...</option>
                    {availableDestinations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-600/20 dark:hover:bg-amber-600/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 rounded-xl text-xs font-semibold transition-all active:scale-95 whitespace-nowrap"
                  title="Escanear QR de ubicación de destino"
                >
                  <Camera className="w-4 h-4" /> Escanear QR
                </button>
              </div>
              {selectedLocation && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Destino seleccionado: {selectedLocation.name} ({selectedLocation.code})
                </p>
              )}
            </div>

            {/* Motivo de traslado */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Motivo o Justificación del Traslado
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Ej: Reorganización de estantes, exhibición en vitrina..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-800"
              />
            </div>

            {/* Acciones */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedLocationId}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-amber-600/20 disabled:opacity-50 transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Moviendo...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Confirmar Traslado
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Escáner de QR para ubicación de destino */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanLocationQR}
        title="Escanear Código QR de Ubicación de Destino"
      />
    </>
  );
};
