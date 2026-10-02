import React, { useState } from 'react';
import { X, ArrowRightLeft, MapPin, Loader2, Check } from 'lucide-react';
import { Product, Location } from '../types/database';
import { supabase, logAuditAction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  // Ubicaciones de destino posibles (excluyendo la actual)
  const availableDestinations = locations.filter(l => l.id !== product.location_id);
  const currentLocation = locations.find(l => l.id === product.location_id);

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !user || !selectedLocationId) return;

    const targetLocation = locations.find(l => l.id === selectedLocationId);
    if (!targetLocation) {
      setErrorMsg('Debes seleccionar una ubicación física de destino válida.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const { error: updateError } = await supabase
        .from('products')
        .update({
          location_id: selectedLocationId,
          last_modified_by: user.id,
          last_modified_by_email: user.email
        })
        .eq('id', product.id);

      if (updateError) throw updateError;

      // Registrar en el historial de auditoría
      const fromName = currentLocation ? `${currentLocation.name} (${currentLocation.code})` : 'Ubicación previa';
      const toName = `${targetLocation.name} (${targetLocation.code})`;

      await logAuditAction({
        inventoryId: currentInventory.id,
        productId: product.id,
        productName: product.name,
        actionType: 'MOVE',
        details: `Traslado de almacén: movido desde "${fromName}" hacia "${toName}". ${reason ? `Motivo: ${reason}` : ''}`,
        metadata: {
          from_location_id: product.location_id,
          to_location_id: targetLocation.id,
          from_location_name: fromName,
          to_location_name: toName,
          reason: reason || null
        }
      });

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-600/20 text-amber-400 rounded-lg">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Mover de Ubicación</h3>
              <p className="text-xs text-slate-400">Transferencia entre almacenes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleMove} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {errorMsg}
            </div>
          )}

          {/* Información del producto y ubicación actual */}
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Producto</span>
            <p className="text-sm font-bold text-white">{product.name}</p>
            <div className="flex items-center gap-1.5 text-xs text-slate-300 pt-1">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>Ubicación actual: <strong>{currentLocation?.name || 'Desconocida'}</strong> ({currentLocation?.code})</span>
            </div>
          </div>

          {/* Selección de nueva ubicación */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nueva Ubicación de Destino <span className="text-amber-400">*</span>
            </label>
            <select
              value={selectedLocationId}
              onChange={e => setSelectedLocationId(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="" disabled>Selecciona la nueva ubicación...</option>
              {availableDestinations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>

          {/* Motivo de traslado */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Motivo o Justificación del Traslado
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ej: Reorganización de estantes, exhibición en vitrina..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Acciones */}
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedLocationId}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-amber-600/20 disabled:opacity-50"
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
  );
};
