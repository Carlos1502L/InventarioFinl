import React, { useState } from 'react';
import { X, MapPin, Plus, Printer, Trash2, QrCode, Loader2, Sparkles } from 'lucide-react';
import { Location } from '../../types/database';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="mobile-dark-modal bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-xl overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
          {/* Cabecera */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#ffffff]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
                <MapPin className="w-5 h-5 text-[#1E3A5F]" />
              </div>
              <div>
                <h3 className="font-bold text-[#1E3A5F] text-base uppercase tracking-tight">Ubicaciones Físicas</h3>
                <p className="text-[11px] text-[#616161]">Depósitos, estantes y etiquetas QR imprimibles</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Contenido con scroll */}
          <div className="p-6 overflow-y-auto space-y-6 font-mono">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            {/* Formulario Nueva Ubicación */}
            <form onSubmit={handleCreateLocation} className="mobile-flat-section p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-amber-500 dark:text-amber-400" /> Nueva Ubicación
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Nombre del Espacio <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => {
                      setName(e.target.value);
                      if (!code) setCode(generateUniqueCode(e.target.value));
                    }}
                    placeholder="Ej: Estante B - Pasillo 3"
                    required
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-600 dark:text-slate-400">Código / QR</label>
                    <button
                      type="button"
                      onClick={() => setCode(generateUniqueCode(name || 'LOC'))}
                      className="text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-500 flex items-center gap-1"
                    >
                      <Sparkles className="w-2.5 h-2.5" /> Auto-generar
                    </button>
                  </div>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="Ej: LOC-EST-001"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Descripción / Referencia</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ej: Segundo piso junto a la puerta principal..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-amber-600/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Crear y Generar Etiqueta QR
                </button>
              </div>
            </form>

            {/* Lista de Ubicaciones Existentes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Ubicaciones Registradas ({locations.length})
                </span>
                <span className="text-[10px] text-slate-400">
                  Haz clic en el icono de etiqueta para imprimir (85.6 × 53.9 mm)
                </span>
              </div>

              {locations.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No hay ubicaciones creadas aún.</p>
              ) : (
                locations.map(loc => (
                  <div
                    key={loc.id}
                    className="mobile-flat-row p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{loc.name}</h4>
                        <span className="font-mono text-[10px] px-2 py-0.5 bg-slate-200/70 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-amber-700 dark:text-amber-300 font-semibold">
                          {loc.code}
                        </span>
                      </div>
                      {loc.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{loc.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedLocationForLabel(loc)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-600/10 hover:bg-blue-100 dark:hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold border border-blue-200 dark:border-blue-500/20 transition-all active:scale-95"
                        title="Imprimir o exportar etiqueta de tarjeta de crédito"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Etiqueta</span>
                      </button>

                      <button
                        onClick={() => handleDeleteLocation(loc.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                        title="Eliminar ubicación"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Etiqueta Imprimible */}
      <LocationLabelModal
        location={selectedLocationForLabel}
        isOpen={Boolean(selectedLocationForLabel)}
        onClose={() => setSelectedLocationForLabel(null)}
      />
    </>
  );
};
