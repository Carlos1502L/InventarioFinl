import React, { useState } from 'react';
import { X, MapPin, Plus, Trash2, QrCode, Loader2, Sparkles } from 'lucide-react';
import { Location } from '../../types/database';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { LocationLabelModal } from './LocationLabelModal';
import { PillOption } from '../common/PillOption';

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
  const [activeTab, setActiveTab] = useState<'create' | 'existing'>('create');
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

      // Cambiar a la pestaña de existentes tras la creación
      setActiveTab('existing');

      // Abrir inmediatamente la etiqueta para imprimir o descargar si se desea
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
        <div className="mobile-dark-modal bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85dvh] font-sans">
          
          {/* Cabecera */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#ffffff] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-[#1E3A5F]" />
              </div>
              <div>
                <h3 className="font-bold text-[#1E3A5F] text-base uppercase tracking-tight">
                  Ubicaciones Físicas
                </h3>
                <p className="text-[11px] text-[#616161]">
                  Depósitos, estantes y etiquetas QR imprimibles
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Barra de Pestañas Tipo Píldora (RF-UI-TABS-008 & RNF-UX-CONSISTENCY-005) */}
          <div className="mobile-tabs-bar flex items-center gap-2 px-6 py-3 border-b border-[#E5E7EB] bg-white shrink-0 overflow-x-auto">
            <PillOption
              active={activeTab === 'create'}
              onClick={() => setActiveTab('create')}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Crear ubicación
            </PillOption>

            <PillOption
              active={activeTab === 'existing'}
              onClick={() => setActiveTab('existing')}
              badge={locations.length}
            >
              Existentes
            </PillOption>
          </div>

          {/* Contenido según Pestaña Activa */}
          <div className="p-6 overflow-y-auto space-y-4">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            {/* PESTAÑA 1: FORMULARIO CREAR UBICACIONES */}
            {activeTab === 'create' && (
              <form onSubmit={handleCreateLocation} className="space-y-4 animate-in fade-in">
                <div className="p-4 bg-[#F8F9FA] rounded-2xl border border-[#E5E7EB] space-y-3.5">
                  <span className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-[#E8B4A0]" /> Datos de la Nueva Ubicación
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">
                        Nombre del Espacio <span className="text-rose-500">*</span>
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
                        className="w-full bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl px-3 py-2 text-xs text-[#1E3A5F] placeholder:text-neutral-400 focus:outline-none transition-all box-border"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-[#1E3A5F]">Código / QR</label>
                        <button
                          type="button"
                          onClick={() => setCode(generateUniqueCode(name || 'LOC'))}
                          className="text-[10px] text-[#1E3A5F] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-[#E8B4A0]" /> Auto-generar
                        </button>
                      </div>
                      <input
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        placeholder="Ej: LOC-EST-001"
                        className="w-full bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl px-3 py-2 text-xs font-mono text-[#1E3A5F] placeholder:text-neutral-400 focus:outline-none transition-all uppercase box-border"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#1E3A5F] mb-1">
                      Descripción / Referencia
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Ej: Segundo piso junto a la puerta principal..."
                      className="w-full bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl px-3 py-2 text-xs text-[#1E3A5F] placeholder:text-neutral-400 focus:outline-none transition-all box-border"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || !name.trim()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E8B4A0]" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>Crear Ubicación</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* PESTAÑA 2: UBICACIONES EXISTENTES (RECUADRO CON SCROLL CONTENIDO) */}
            {activeTab === 'existing' && (
              <div className="space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs text-[#616161]">
                  <span className="font-semibold text-[#1E3A5F]">
                    Espacios Físicos Registrados ({locations.length})
                  </span>
                  <span className="text-[10px] font-mono">
                    Haz clic en "Etiqueta" para exportar rótulo físico
                  </span>
                </div>

                {/* Recuadro contenedor con scroll para evitar scroll infinito */}
                <div className="max-h-[380px] overflow-y-auto space-y-2.5 border border-[#E5E7EB] rounded-2xl bg-[#F8F9FA]/40 p-3 overscroll-contain">
                  {locations.length === 0 ? (
                    <div className="text-center py-10 text-xs text-[#616161] space-y-2">
                      <p>No hay ubicaciones creadas aún.</p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('create')}
                        className="text-xs text-[#1E3A5F] underline font-semibold cursor-pointer"
                      >
                        Crear la primera ubicación
                      </button>
                    </div>
                  ) : (
                    locations.map(loc => (
                      <div
                        key={loc.id}
                        className="p-3.5 bg-white rounded-xl border border-[#E5E7EB] flex items-center justify-between group hover:border-[#1E3A5F]/40 transition-colors shadow-2xs"
                      >
                        <div className="space-y-0.5 min-w-0 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-[#1E3A5F] truncate">{loc.name}</h4>
                            <span className="font-mono text-[10px] px-2 py-0.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-md text-[#1E3A5F] font-semibold">
                              {loc.code}
                            </span>
                          </div>
                          {loc.description && (
                            <p className="text-[11px] text-[#616161] truncate">{loc.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedLocationForLabel(loc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#F8F9FA] hover:bg-[#1E3A5F]/10 text-[#1E3A5F] rounded-lg text-xs font-semibold border border-[#E5E7EB] transition-all active:scale-95 cursor-pointer"
                            title="Imprimir o exportar etiqueta de tarjeta de crédito"
                          >
                            <QrCode className="w-3.5 h-3.5 text-[#1E3A5F]" />
                            <span className="hidden sm:inline">Etiqueta</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteLocation(loc.id)}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
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
            )}
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
