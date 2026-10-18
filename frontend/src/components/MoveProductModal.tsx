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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-md overflow-hidden shadow-xl flex flex-col">
          {/* Cabecera */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#ffffff]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-[#1E3A5F]" />
              </div>
              <div>
                <h3 className="font-light text-[#1E3A5F] text-base uppercase tracking-tight">Mover de Ubicación</h3>
                <p className="text-[11px] text-[#616161]">Transferencia entre depósitos</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleMove} className="p-6 space-y-4 font-mono">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            {/* Información del producto y ubicación actual */}
            <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] space-y-1">
              <span className="text-[10px] text-[#616161] uppercase tracking-wider">PRODUCTO</span>
              <p className="text-sm font-medium text-[#1E3A5F] uppercase">{product.name}</p>
              <div className="flex items-center gap-1.5 text-xs text-[#1E3A5F] pt-1">
                <MapPin className="w-3.5 h-3.5 text-[#E8B4A0]" />
                <span>ORIGEN: <strong className="font-semibold">{currentLocation?.name || 'Desconocida'}</strong> ({currentLocation?.code})</span>
              </div>
            </div>

            {/* Cantidad a Mover */}
            {product.stock > 1 ? (
              <div className="p-4 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wider text-[#1E3A5F]">
                    CANTIDAD A TRASLADAR <span className="text-[#E8B4A0]">*</span>
                  </label>
                  <span className="text-[10px] text-[#616161] uppercase">
                    DISPONIBLE: <strong className="text-[#1E3A5F]">{product.stock} UDS</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantityToMove(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-xl border border-[#E5E7EB] bg-white flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] transition-colors"
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
                    className="flex-1 min-h-[40px] bg-white border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-center text-sm font-medium text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantityToMove(q => Math.min(product.stock, q + 1))}
                    className="w-10 h-10 rounded-xl border border-[#E5E7EB] bg-white flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] transition-colors"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantityToMove(product.stock)}
                    className="px-3 min-h-[40px] text-[11px] uppercase tracking-wider text-[#1E3A5F] bg-[#E8B4A0]/20 hover:bg-[#E8B4A0]/30 border border-[#E8B4A0]/40 rounded-xl transition-colors whitespace-nowrap"
                  >
                    Todas ({product.stock})
                  </button>
                </div>
                <p className="text-[10px] text-[#616161]">
                  {quantityToMove < product.stock 
                    ? `Se moverán ${quantityToMove} uds y permanecerán ${product.stock - quantityToMove} uds en la ubicación actual.`
                    : `Se trasladará la totalidad de las existencias.`}
                </p>
              </div>
            ) : (
              <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] text-xs text-[#616161]">
                Traslado de unidad única (1 ud).
              </div>
            )}

            {/* Selección de nueva ubicación con Escáner QR */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                NUEVA UBICACIÓN DE DESTINO <span className="text-[#E8B4A0]">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedLocationId}
                    onChange={e => setSelectedLocationId(e.target.value)}
                    required
                    className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                  >
                    <option value="" disabled>Selecciona la nueva ubicación...</option>
                    {availableDestinations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                  <MapPin className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 min-h-[44px] bg-[#F8F9FA] hover:bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E5E7EB] rounded-xl text-xs uppercase tracking-wider transition-all whitespace-nowrap active:scale-95"
                  title="Escanear QR de ubicación de destino"
                >
                  <Camera className="w-4 h-4 text-[#1E3A5F]" /> QR
                </button>
              </div>
              {selectedLocation && (
                <p className="text-[11px] text-[#1E3A5F] font-medium mt-1.5 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-[#E8B4A0]" /> Destino: {selectedLocation.name} ({selectedLocation.code})
                </p>
              )}
            </div>

            {/* Motivo de traslado */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                MOTIVO O JUSTIFICACIÓN DEL TRASLADO
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Ej: Reorganización de vitrina, reposición..."
                className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm text-[#1E3A5F] placeholder:text-[#616161]/50 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
              />
            </div>

            {/* Acciones */}
            <div className="pt-3 border-t border-[#E5E7EB] flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-5 text-xs uppercase tracking-wider text-[#1E3A5F] hover:bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedLocationId}
                className="min-h-[44px] inline-flex items-center gap-2 px-6 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider font-medium rounded-xl shadow-sm disabled:opacity-50 transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Moviendo...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-[#E8B4A0]" />
                    <span>Confirmar Traslado</span>
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
