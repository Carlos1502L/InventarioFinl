import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowRightLeft, MapPin, Loader2, Check, Camera } from 'lucide-react';
import { Product, Location } from '../../types/database';
import {
  supabase,
  formatLocationQuantity,
  getPendingLocationStock
} from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { MinimalDropdown } from '../ui/MinimalDropdown';

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
  const [fromLocationId, setFromLocationId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [quantityToMove, setQuantityToMove] = useState<string>('1');
  const [moveBoxes, setMoveBoxes] = useState<number>(1);
  const [moveLooseUnits, setMoveLooseUnits] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const availableOrigins = useMemo(() => {
    if (!product) return [];
    return (product.product_locations || []).filter(pl => Number(pl.quantity || 0) > 0.0001);
  }, [product]);

  const originStock = useMemo(() => {
    const found = availableOrigins.find(pl => pl.location_id === fromLocationId);
    return Number(found?.quantity || 0);
  }, [availableOrigins, fromLocationId]);

  useEffect(() => {
    if (product && isOpen) {
      const firstOrigin = availableOrigins[0];
      const origId = firstOrigin?.location_id || '';
      setFromLocationId(origId);
      setSelectedLocationId('');
      setErrorMsg(null);
      setReason('');

      const avail = Number(firstOrigin?.quantity || 0);
      if (product.unit_type === 'BOX' && Number(product.units_per_box) > 0) {
        const upb = Number(product.units_per_box);
        if (avail >= 1) {
          setMoveBoxes(1);
          setMoveLooseUnits(0);
          setQuantityToMove('1');
        } else {
          const totalUnits = Math.round(avail * upb);
          setMoveBoxes(Math.floor(totalUnits / upb));
          setMoveLooseUnits(totalUnits % upb);
          setQuantityToMove(String(avail));
        }
      } else {
        setQuantityToMove(avail >= 1 ? '1' : '0');
      }
    }
  }, [product, isOpen, availableOrigins]);

  if (!isOpen || !product) return null;

  const isBox = product.unit_type === 'BOX' && Number(product.units_per_box) > 0;
  const upb = Number(product.units_per_box || 1);
  const availableDestinations = locations.filter(l => l.id !== fromLocationId);
  const selectedLocation = locations.find(l => l.id === selectedLocationId);

  const handleScanLocationQR = (scannedCode: string) => {
    const clean = scannedCode.trim();
    const foundLoc = locations.find(
      l => l.code.toUpperCase() === clean.toUpperCase() || l.id === clean
    );

    if (foundLoc) {
      if (foundLoc.id === fromLocationId) {
        setErrorMsg(`La ubicación "${foundLoc.name}" ya es la ubicación de origen seleccionada.`);
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
    if (!currentInventory || !user) return;
    if (!fromLocationId) {
      setErrorMsg('Debes elegir una ubicación de origen con saldo disponible.');
      return;
    }
    if (!selectedLocationId) {
      setErrorMsg('Debes seleccionar una ubicación de destino.');
      return;
    }

    const finalQty = isBox
      ? Number((moveBoxes + moveLooseUnits / upb).toFixed(4))
      : Math.round(Number(quantityToMove || 0));

    if (finalQty <= 0 || finalQty > originStock + 0.0002) {
      setErrorMsg(
        `La cantidad a trasladar debe ser mayor a 0 y no superar el disponible en origen (${formatLocationQuantity(originStock, product)}).`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const { error } = await supabase.rpc('move_product_location', {
        p_inventory_id: currentInventory.id,
        p_product_id: product.id,
        p_from_location_id: fromLocationId,
        p_to_location_id: selectedLocationId,
        p_quantity: finalQty,
        p_reason: reason.trim() || null,
        p_user_id: user.id,
        p_user_email: user.email || 'usuario@local'
      });

      if (error) throw error;

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 max-md:bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="mobile-dark-modal bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-md overflow-hidden shadow-xl flex flex-col">
          {/* Cabecera */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#ffffff]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-[#1E3A5F]" />
              </div>
              <div>
                <h3 className="font-bold text-[#1E3A5F] text-base uppercase tracking-tight">
                  Mover de Ubicación
                </h3>
                <p className="text-[11px] text-[#616161]">Reubicación atómica entre zonas</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleMove} className="p-6 space-y-4 font-mono">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            <div className="mobile-flat-row p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] space-y-1">
              <span className="text-[10px] text-[#616161] uppercase tracking-wider">
                PRODUCTO ({product.code})
              </span>
              <p className="text-sm font-bold text-[#1E3A5F] uppercase">{product.name}</p>
            </div>

            {availableOrigins.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <p className="font-bold uppercase">Sin stock asignado en ubicaciones</p>
                <p>
                  Este artículo tiene {formatLocationQuantity(getPendingLocationStock(product), product)} pendientes en recepción. Primero asígnalo desde el módulo "Asignar Ubicación".
                </p>
              </div>
            ) : (
              <>
                {/* Selector de Origen */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                    UBICACIÓN DE ORIGEN <span className="text-[#E8B4A0]">*</span>
                  </label>
                  <MinimalDropdown
                    value={fromLocationId}
                    onChange={(val) => setFromLocationId(val)}
                    placeholder="Seleccionar origen..."
                    options={availableOrigins.map((pl) => ({
                      value: pl.location_id,
                      label: pl.locations?.name || 'Estante',
                      badge: `${pl.locations?.code || ''} · Disp: ${formatLocationQuantity(pl.quantity, product)}`
                    }))}
                  />
                </div>

                {/* Cantidad a Mover */}
                <div className="mobile-flat-section p-4 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F]">
                      CANTIDAD A TRASLADAR <span className="text-[#E8B4A0]">*</span>
                    </label>
                    <span className="text-[10px] text-[#616161] uppercase">
                      DISPONIBLE:{' '}
                      <strong className="text-[#1E3A5F]">
                        {formatLocationQuantity(originStock, product)}
                      </strong>
                    </span>
                  </div>

                  {isBox ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-[#616161] block mb-1">Cajas</span>
                        <input
                          type="number"
                          min={0}
                          max={Math.floor(originStock + 0.0001)}
                          value={moveBoxes}
                          onChange={e => setMoveBoxes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-full min-h-[38px] bg-white border border-[#E5E7EB] rounded-xl px-3 py-1 text-center text-sm font-bold text-[#1E3A5F]"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-[#616161] block mb-1">Unidades sueltas</span>
                        <input
                          type="number"
                          min={0}
                          max={upb - 1}
                          value={moveLooseUnits}
                          onChange={e => setMoveLooseUnits(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-full min-h-[38px] bg-white border border-[#E5E7EB] rounded-xl px-3 py-1 text-center text-sm font-bold text-[#1E3A5F]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={Math.round(originStock)}
                        value={quantityToMove}
                        onChange={e => setQuantityToMove(e.target.value)}
                        className="flex-1 min-h-[40px] bg-white border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-center text-sm font-bold text-[#1E3A5F]"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantityToMove(String(Math.round(originStock)))}
                        className="px-3 min-h-[40px] text-[11px] uppercase tracking-wider text-[#1E3A5F] bg-[#E8B4A0]/20 hover:bg-[#E8B4A0]/30 border border-[#E8B4A0]/40 rounded-xl"
                      >
                        Todas ({Math.round(originStock)})
                      </button>
                    </div>
                  )}
                </div>

                {/* Selección de Destino */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                    UBICACIÓN DE DESTINO <span className="text-[#E8B4A0]">*</span>
                  </label>
                  <div className="flex items-center gap-2.5 w-full">
                    <div className="flex-1 min-w-0">
                      <MinimalDropdown
                        value={selectedLocationId}
                        onChange={(val) => setSelectedLocationId(val)}
                        placeholder="Selecciona la nueva ubicación..."
                        options={availableDestinations.map((loc) => ({
                          value: loc.id,
                          label: loc.name,
                          badge: loc.code
                        }))}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 min-h-[44px] bg-[#F8F9FA] hover:bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E5E7EB] rounded-xl text-xs uppercase tracking-wider shrink-0"
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

                {/* Motivo */}
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#1E3A5F] mb-1.5">
                    MOTIVO DEL TRASLADO (OPCIONAL)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Ej: Reorganización de vitrina, reposición..."
                    className="w-full min-h-[42px] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-xs text-[#1E3A5F]"
                  />
                </div>
              </>
            )}

            <div className="pt-3 border-t border-[#E5E7EB] max-md:border-0 flex max-md:flex-col-reverse justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="mobile-cancel-btn min-h-[44px] px-5 text-xs uppercase tracking-wider text-[#1E3A5F] hover:bg-[#F8F9FA] rounded-xl border border-[#E5E7EB]"
              >
                Cancelar
              </button>
              {availableOrigins.length > 0 && (
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedLocationId || !fromLocationId}
                  className="min-h-[44px] inline-flex items-center gap-2 px-6 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider font-medium rounded-xl shadow-sm disabled:opacity-50"
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
              )}
            </div>
          </form>
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanLocationQR}
        title="Escanear Código QR de Ubicación de Destino"
      />
    </>
  );
};
