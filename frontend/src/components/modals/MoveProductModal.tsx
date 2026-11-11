import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowRightLeft, Loader2, Check, Camera } from 'lucide-react';
import { Product, Location } from '../../types/database';
import {
  supabase,
  formatLocationQuantity,
  getPendingLocationStock
} from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { MinimalDropdown } from '../ui/MinimalDropdown';
import { CancelButton } from '../common/CancelButton';
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  modalFieldInputClass,
  modalFieldLabelClass,
  modalSurfaceCardClass,
  modalPrimaryButtonClass,
  modalSecondaryButtonClass
} from './ModalShell';

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
  const lastProductRef = useRef<Product | null>(null);
  if (product) {
    lastProductRef.current = product;
  }
  const activeProduct = product || lastProductRef.current;

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
    if (!activeProduct) return [];
    return (activeProduct.product_locations || []).filter(pl => Number(pl.quantity || 0) > 0.0001);
  }, [activeProduct]);

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

  const isBox = activeProduct?.unit_type === 'BOX' && Number(activeProduct?.units_per_box) > 0;
  const upb = Number(activeProduct?.units_per_box || 1);
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
    if (!currentInventory || !user || !activeProduct) return;
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
        `La cantidad a trasladar debe ser mayor a 0 y no superar el disponible en origen (${formatLocationQuantity(originStock, activeProduct)}).`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const { error } = await supabase.rpc('move_product_location', {
        p_inventory_id: currentInventory.id,
        p_product_id: activeProduct.id,
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
      <ModalShell
        isOpen={Boolean(isOpen && activeProduct)}
        onClose={onClose}
        maxWidth="md"
        disableDismiss={isSubmitting}
        formId="move-product-form"
      >
        <ModalHeader
          title="Mover de ubicación"
          subtitle="Reubicación atómica entre zonas y estantes"
          icon={<ArrowRightLeft className="w-4 h-4 lg:w-5 lg:h-5" />}
          iconTone="indigo"
          onClose={onClose}
          closeDisabled={isSubmitting}
        />

        {activeProduct && (
          <form
            id="move-product-form"
            onSubmit={handleMove}
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            <ModalBody className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-200">
                  {errorMsg}
                </div>
              )}

              <div className={`${modalSurfaceCardClass} flex items-center justify-between gap-3`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">{activeProduct.name}</p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">SKU: {activeProduct.code}</p>
                </div>
                <span className="font-mono px-2 py-0.5 rounded-md text-[10px] bg-slate-800 border border-slate-700 text-slate-200 font-semibold shrink-0">
                  {isBox ? 'BOX' : 'UNIT'}
                </span>
              </div>

              {availableOrigins.length === 0 ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-200 space-y-1.5">
                  <p className="font-semibold text-amber-300">Sin stock asignado en ubicaciones</p>
                  <p className="text-slate-300 leading-relaxed">
                    Este artículo tiene{' '}
                    <span className="font-mono tabular-nums text-white font-semibold">
                      {formatLocationQuantity(getPendingLocationStock(activeProduct), activeProduct)}
                    </span>{' '}
                    pendientes en recepción. Primero asígnalo desde el módulo "Asignar ubicación".
                  </p>
                </div>
              ) : (
                <>
                  {/* Selector de Origen */}
                  <div>
                    <label className={modalFieldLabelClass}>
                      Ubicación de origen <span className="text-rose-400">*</span>
                    </label>
                    <MinimalDropdown
                      value={fromLocationId}
                      onChange={(val) => setFromLocationId(val)}
                      placeholder="Seleccionar origen..."
                      options={availableOrigins.map((pl) => ({
                        value: pl.location_id,
                        label: pl.locations?.name || 'Estante',
                        badge: `${pl.locations?.code || ''} · Disp: ${formatLocationQuantity(pl.quantity, activeProduct)}`
                      }))}
                    />
                  </div>

                  {/* Cantidad a Mover */}
                  <div className={`${modalSurfaceCardClass} space-y-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-slate-200">
                        Cantidad a trasladar <span className="text-rose-400">*</span>
                      </label>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        Disponible:{' '}
                        <strong className="text-slate-100">
                          {formatLocationQuantity(originStock, activeProduct)}
                        </strong>
                      </span>
                    </div>

                    {isBox ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-1">Cajas</span>
                          <input
                            type="number"
                            min={0}
                            max={Math.floor(originStock + 0.0001)}
                            value={moveBoxes}
                            onChange={e => setMoveBoxes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className={`${modalFieldInputClass} text-center font-mono tabular-nums font-semibold`}
                          />
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block mb-1">Unidades sueltas</span>
                          <input
                            type="number"
                            min={0}
                            max={upb - 1}
                            value={moveLooseUnits}
                            onChange={e => setMoveLooseUnits(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className={`${modalFieldInputClass} text-center font-mono tabular-nums font-semibold`}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <input
                          type="number"
                          min={1}
                          max={Math.round(originStock)}
                          value={quantityToMove}
                          onChange={e => setQuantityToMove(e.target.value)}
                          className={`${modalFieldInputClass} flex-1 text-center font-mono tabular-nums font-semibold`}
                        />
                        <button
                          type="button"
                          onClick={() => setQuantityToMove(String(Math.round(originStock)))}
                          className={`${modalSecondaryButtonClass} font-mono tabular-nums shrink-0`}
                        >
                          Todas ({Math.round(originStock)})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Selección de Destino */}
                  <div>
                    <label className={modalFieldLabelClass}>
                      Ubicación de destino <span className="text-rose-400">*</span>
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
                        className={`${modalSecondaryButtonClass} shrink-0`}
                        title="Escanear ubicación"
                      >
                        <Camera className="w-4 h-4 text-indigo-400" />
                        <span>Escanear</span>
                      </button>
                    </div>
                    {selectedLocation && (
                      <p className="text-xs text-emerald-300 font-medium mt-2 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">
                          Destino: {selectedLocation.name}{' '}
                          <span className="font-mono text-emerald-200">({selectedLocation.code})</span>
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Motivo */}
                  <div>
                    <label className={modalFieldLabelClass}>Motivo del traslado (opcional)</label>
                    <input
                      type="text"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Ej: Reorganización de vitrina, reposición..."
                      className={modalFieldInputClass}
                    />
                  </div>
                </>
              )}
            </ModalBody>

            <ModalFooter shortcutLabel={availableOrigins.length > 0 ? 'para trasladar' : undefined}>
              <CancelButton onClick={onClose} disabled={isSubmitting} />
              {availableOrigins.length > 0 && (
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedLocationId || !fromLocationId}
                  className={modalPrimaryButtonClass}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Moviendo...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar traslado</span>
                    </>
                  )}
                </button>
              )}
            </ModalFooter>
          </form>
        )}
      </ModalShell>

      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanLocationQR}
        title="Escanear código QR de destino"
      />
    </>
  );
};
