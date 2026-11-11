import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, Plus, Trash2, QrCode, Loader2, Sparkles } from 'lucide-react';
import { Location } from '../../types/database';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { LocationLabelModal } from './LocationLabelModal';
import { PillOption } from '../common/PillOption';
import { CancelButton } from '../common/CancelButton';
import {
  ModalShell,
  ModalHeader,
  ModalTabsBar,
  ModalBody,
  ModalFooter,
  modalFieldCompactInputClass,
  modalFieldLabelClass,
  modalSurfaceCardClass,
  modalPrimaryButtonClass
} from './ModalShell';

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
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="lg"
        disableDismiss={isSubmitting}
        formId={activeTab === 'create' ? 'create-location-form' : undefined}
      >
        <ModalHeader
          title="Ubicaciones físicas"
          subtitle="Depósitos, estantes y etiquetas QR imprimibles"
          icon={<MapPin className="w-4 h-4 lg:w-5 lg:h-5" />}
          iconTone="indigo"
          onClose={onClose}
          closeDisabled={isSubmitting}
        />

        <ModalTabsBar>
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
        </ModalTabsBar>

        <ModalBody className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {activeTab === 'create' ? (
              <motion.form
                key="loc-create"
                id="create-location-form"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                onSubmit={handleCreateLocation}
                className="space-y-4"
              >
                <div className={`${modalSurfaceCardClass} space-y-3.5`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className={modalFieldLabelClass}>
                        Nombre del espacio <span className="text-rose-400">*</span>
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
                        className={modalFieldCompactInputClass}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-slate-300">Código / QR</label>
                        <button
                          type="button"
                          onClick={() => setCode(generateUniqueCode(name || 'LOC'))}
                          className="text-[11px] text-indigo-300 hover:text-indigo-200 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <Sparkles className="w-3 h-3" /> Auto-generar
                        </button>
                      </div>
                      <input
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        placeholder="Ej: LOC-EST-001"
                        className={`${modalFieldCompactInputClass} font-mono uppercase`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={modalFieldLabelClass}>Descripción / Referencia</label>
                    <input
                      type="text"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Ej: Segundo piso junto a la puerta principal..."
                      className={modalFieldCompactInputClass}
                    />
                  </div>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="loc-existing"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200 tabular-nums">
                    Espacios registrados ({locations.length})
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    85.6 × 53.9 mm QR
                  </span>
                </div>

                <div className="max-h-[360px] overflow-y-auto overscroll-contain custom-scrollbar-dark space-y-2 border border-slate-800/80 rounded-2xl bg-slate-950/45 p-3">
                  {locations.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-400 space-y-2">
                      <p>No hay ubicaciones creadas aún.</p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('create')}
                        className="text-xs text-indigo-300 underline font-semibold cursor-pointer"
                      >
                        Crear la primera ubicación
                      </button>
                    </div>
                  ) : (
                    locations.map(loc => (
                      <div
                        key={loc.id}
                        className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2 hover:border-slate-700 transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-semibold text-slate-100 truncate">{loc.name}</h4>
                            <span className="font-mono text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md text-slate-200 font-semibold">
                              {loc.code}
                            </span>
                          </div>
                          {loc.description && (
                            <p className="text-[11px] text-slate-400 truncate">{loc.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedLocationForLabel(loc)}
                            className="min-h-[38px] lg:min-h-[32px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-medium border border-slate-700/80 transition-all active:scale-95 cursor-pointer"
                            title="Imprimir o exportar etiqueta de tarjeta de crédito"
                          >
                            <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="hidden sm:inline">Etiqueta</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteLocation(loc.id)}
                            className="min-h-[38px] min-w-[38px] lg:min-h-[32px] lg:min-w-[32px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar ubicación"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ModalBody>

        <ModalFooter shortcutLabel={activeTab === 'create' ? 'para crear' : undefined}>
          <CancelButton onClick={onClose} label="Cerrar" disabled={isSubmitting} />
          {activeTab === 'create' && (
            <button
              type="submit"
              form="create-location-form"
              disabled={isSubmitting || !name.trim()}
              className={modalPrimaryButtonClass}
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Crear ubicación</span>
            </button>
          )}
        </ModalFooter>
      </ModalShell>

      {/* Modal de Etiqueta Imprimible */}
      <LocationLabelModal
        location={selectedLocationForLabel}
        isOpen={Boolean(selectedLocationForLabel)}
        onClose={() => setSelectedLocationForLabel(null)}
      />
    </>
  );
};
