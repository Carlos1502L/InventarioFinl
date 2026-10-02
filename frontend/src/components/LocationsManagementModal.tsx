import React, { useState } from 'react';
import { X, MapPin, Plus, Printer, Trash2, QrCode, Loader2, Sparkles } from 'lucide-react';
import { Location } from '../types/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { LocationLabelModal } from './LocationLabelModal';

interface LocationsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  onRefresh: () => void;
}

export const LocationsManagementModal: React.FC<LocationsManagementModalProps> = ({
  isOpen,
  onClose,
  locations,
  onRefresh
}) => {
  const { currentInventory } = useAuth();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal para imprimir / exportar etiqueta a tamaño de tarjeta de crédito
  const [selectedLocationForLabel, setSelectedLocationForLabel] = useState<Location | null>(null);

  if (!isOpen) return null;

  // Auto-generador de código de ubicación amigable
  const generateUniqueCode = (locName: string) => {
    const prefix = locName
      .trim()
      .split(' ')
      .map(w => w.substring(0, 3).toUpperCase())
      .join('-')
      .substring(0, 7) || 'LOC';
    const rand = Math.floor(100 + Math.random() * 900);
    return `LOC-${prefix}-${rand}`;
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !name.trim()) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const finalCode = (code.trim() || generateUniqueCode(name)).toUpperCase();

      const { data: newLoc, error } = await supabase
        .from('locations')
        .insert({
          inventory_id: currentInventory.id,
          name: name.trim(),
          code: finalCode,
          description: description.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      setName('');
      setCode('');
      setDescription('');
      onRefresh();

      // Abrir inmediatamente la etiqueta para imprimir o descargar
      if (newLoc) {
        setSelectedLocationForLabel(newLoc);
      }
    } catch (err: any) {
      console.error('Error al crear ubicación:', err);
      if (err.code === '23505') {
        setErrorMsg(`Ya existe una ubicación con el código "${code.toUpperCase()}".`);
      } else {
        setErrorMsg(err.message || 'Error al guardar la ubicación.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta ubicación física? Si contiene productos vinculados, el sistema no permitirá borrarla.')) return;
    try {
      const { error } = await supabase.from('locations').delete().eq('id', id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert('No se puede eliminar la ubicación porque tiene productos asignados. Mueve primero los productos.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          {/* Cabecera */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-600/20 text-amber-400 rounded-xl">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Gestión de Ubicaciones Físicas</h3>
                <p className="text-xs text-slate-400">
                  Almacenes, estantes y generador de etiquetas de tarjeta (85.6 × 53.9 mm)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenido con scroll */}
          <div className="p-5 overflow-y-auto space-y-6">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {errorMsg}
              </div>
            )}

            {/* Formulario Nueva Ubicación */}
            <form onSubmit={handleCreateLocation} className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-amber-400" /> Registrar Nueva Ubicación Física
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Nombre de la Ubicación <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => {
                      setName(e.target.value);
                      if (!code) setCode(generateUniqueCode(e.target.value));
                    }}
                    placeholder="Ej: Pasillo 3 - Estante B"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Código Único (QR / Barcode)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={code}
                      onChange={e => setCode(e.target.value.toUpperCase())}
                      placeholder="Ej: LOC-PAS3-B"
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setCode(generateUniqueCode(name || 'LOC'))}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex-shrink-0"
                      title="Generar código aleatorio"
                    >
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Descripción o Referencia de Espacio (Opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ej: Segundo nivel de estantería metálica frente a recepción..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-amber-600/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Crear y Generar Etiqueta
                </button>
              </div>
            </form>

            {/* Lista de Ubicaciones */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Ubicaciones en Este Inventario ({locations.length})
              </span>

              {locations.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No hay ubicaciones registradas aún. Crea la primera arriba.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {locations.map(loc => (
                    <div
                      key={loc.id}
                      className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">{loc.name}</h4>
                          <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-900 border border-slate-700 text-amber-400 rounded-md">
                            {loc.code}
                          </span>
                        </div>
                        {loc.description && (
                          <p className="text-xs text-slate-400 line-clamp-1">{loc.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Botón de Etiqueta QR (Dimensiones Tarjeta de Crédito) */}
                        <button
                          onClick={() => setSelectedLocationForLabel(loc)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-semibold transition-all active:scale-95"
                          title="Imprimir o Exportar PDF a tamaño tarjeta de crédito (85.6 × 53.9 mm)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Etiqueta 85.6×53.9mm</span>
                          <span className="sm:hidden">Etiqueta</span>
                        </button>

                        <button
                          onClick={() => handleDeleteLocation(loc.id)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
                          title="Eliminar ubicación"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Etiqueta Exacta 85.6 mm x 53.9 mm */}
      <LocationLabelModal
        location={selectedLocationForLabel}
        isOpen={Boolean(selectedLocationForLabel)}
        onClose={() => setSelectedLocationForLabel(null)}
      />
    </>
  );
};
