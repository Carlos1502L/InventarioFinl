import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Send,
  Calendar,
  Clock,
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Mail,
  ShieldCheck,
  RefreshCw,
  FileJson
} from 'lucide-react';
import { supabase, getApiUrl } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { showAppToast } from '../ui';
import { BackupRestoreModal } from './BackupRestoreModal';

interface BackupManagementCardProps {
  className?: string;
  onRestoreCompleted?: () => void;
}

export const BackupManagementCard: React.FC<BackupManagementCardProps> = ({
  className = '',
  onRestoreCompleted
}) => {
  const { currentInventory, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados Bloque A: Manual
  const [manualEmail, setManualEmail] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Estados Bloque B: Programado
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledEmail, setScheduledEmail] = useState('');
  const [frequencyOption, setFrequencyOption] = useState<'1' | '7' | '15' | 'custom'>('7');
  const [customDays, setCustomDays] = useState<number>(3);
  const [executionTime, setExecutionTime] = useState('02:00');
  const [nextRunAt, setNextRunAt] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Estados Bloque C: Restauración
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: any } | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Precargar correos iniciales con el usuario autenticado
  useEffect(() => {
    if (user?.email) {
      if (!manualEmail) setManualEmail(user.email);
      if (!scheduledEmail) setScheduledEmail(user.email);
    }
  }, [user]);

  // Cargar configuración existente de inventory_backup_settings
  useEffect(() => {
    const fetchSettings = async () => {
      if (!currentInventory?.id) return;
      setLoadingSettings(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch(getApiUrl(`/backup/settings/${currentInventory.id}`), {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (res.ok) {
          const json = await res.json();
          if (json.settings) {
            const s = json.settings;
            setIsScheduled(Boolean(s.is_scheduled));
            if (s.target_email) setScheduledEmail(s.target_email);
            
            const days = String(s.interval_days || 7);
            if (['1', '7', '15'].includes(days)) {
              setFrequencyOption(days as any);
            } else {
              setFrequencyOption('custom');
              setCustomDays(Number(days) || 3);
            }

            if (s.execution_time) {
              setExecutionTime(s.execution_time.slice(0, 5));
            }
            setNextRunAt(s.next_run_at || null);
            setLastRunAt(s.last_run_at || null);
          }
        }
      } catch (err) {
        console.warn('No se pudo cargar la configuración de respaldos:', err);
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchSettings();
  }, [currentInventory?.id]);

  // --------------------------------------------------------------------------
  // HANDLERS BLOQUE A: Manual
  // --------------------------------------------------------------------------
  const handleExportAndSend = async (downloadDirectly = false) => {
    if (!currentInventory?.id) return;
    const target = manualEmail.trim();
    if (!target || !target.includes('@')) {
      showAppToast('Por favor, ingresa un correo electrónico válido.', 'warning');
      return;
    }

    setIsExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No hay sesión activa.');

      const res = await fetch(getApiUrl('/backup/export-and-send'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          inventory_id: currentInventory.id,
          target_email: target
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al exportar y enviar el respaldo.');
      }

      showAppToast(`Respaldo generado y enviado a ${target}`, 'success', 5000);

      // Descarga opcional directa
      if (downloadDirectly && data.payload) {
        const blob = new Blob([JSON.stringify(data.payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename || `backup_${currentInventory.name}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error('Error en exportAndSend:', err);
      showAppToast(err.message || 'Error al generar la copia de seguridad.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // --------------------------------------------------------------------------
  // HANDLERS BLOQUE B: Programado
  // --------------------------------------------------------------------------
  const handleSaveSchedule = async () => {
    if (!currentInventory?.id) return;
    const target = scheduledEmail.trim();
    if (isScheduled && (!target || !target.includes('@'))) {
      showAppToast('Debes especificar un correo de destino válido para activar la programación.', 'warning');
      return;
    }

    const intervalDays = frequencyOption === 'custom' ? Number(customDays) || 1 : Number(frequencyOption);

    setIsSavingSettings(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No hay sesión activa.');

      const res = await fetch(getApiUrl('/backup/settings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          inventory_id: currentInventory.id,
          target_email: target || user?.email,
          is_scheduled: isScheduled,
          interval_days: intervalDays,
          execution_time: executionTime.length === 5 ? `${executionTime}:00` : executionTime,
          timezone: 'America/Lima'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al guardar la programación.');
      }

      if (data.settings) {
        setNextRunAt(data.settings.next_run_at || null);
      }

      showAppToast(
        isScheduled
          ? `Programación guardada. Próximo respaldo: ${new Date(data.settings?.next_run_at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}`
          : 'Programación desactivada con éxito.',
        'success'
      );
    } catch (err: any) {
      console.error('Error guardando schedule:', err);
      showAppToast(err.message || 'Error al guardar la configuración.', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // --------------------------------------------------------------------------
  // HANDLERS BLOQUE C: Restaurar
  // --------------------------------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      showAppToast('El archivo debe tener formato .json válido.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = event.target?.result as string;
        const parsed = JSON.parse(rawJson);

        if (!parsed.version || parsed.version !== '1.0' || !parsed.data) {
          showAppToast('Estructura inválida: El archivo debe ser un respaldo oficial versión 1.0.', 'error');
          return;
        }

        setSelectedFile({ name: file.name, content: parsed });
        setRestoreModalOpen(true);
      } catch (parseErr) {
        showAppToast('Error al procesar el archivo JSON. Verifica su integridad.', 'error');
      }
    };
    reader.readAsText(file);
    // Resetear valor para permitir seleccionar el mismo archivo si es necesario
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!selectedFile || !currentInventory?.id) return;

    setIsRestoring(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No hay sesión activa.');

      const res = await fetch(getApiUrl('/backup/restore'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          inventory_id: currentInventory.id,
          backup_payload: selectedFile.content
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error durante la restauración atómica.');
      }

      setRestoreModalOpen(false);
      setSelectedFile(null);
      showAppToast('¡Copia de seguridad restaurada exitosamente!', 'success', 6000);

      if (onRestoreCompleted) {
        onRestoreCompleted();
      }
    } catch (err: any) {
      console.error('Error restaurando backup:', err);
      showAppToast(err.message || 'Error restaurando los datos del inventario.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <div className={`bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden font-sans ${className}`}>
        
        {/* Cabecera Principal del Módulo */}
        <div className="p-5 sm:p-6 border-b border-[#E5E7EB] bg-[#F8F9FA]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#1E3A5F] text-[#E8B4A0] flex items-center justify-center shrink-0 shadow-xs">
              <Database className="w-5 h-5 stroke-[1.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#E8B4A0]">
                  PROTECCIÓN & GOBERNANZA DE DATOS
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-medium">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> OWNER
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#1E3A5F] tracking-tight">
                Módulo de Copias de Seguridad (Backups)
              </h2>
            </div>
          </div>

          {loadingSettings && (
            <div className="flex items-center gap-2 text-xs text-[#616161]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1E3A5F]" />
              <span>Cargando configuración...</span>
            </div>
          )}
        </div>

        {/* Contenido en 3 Bloques Ordenados */}
        <div className="divide-y divide-[#E5E7EB]">

          {/* =================================================================
              BLOQUE A: Respaldo Manual Inmediato
             ================================================================= */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center shrink-0 font-mono text-xs font-bold">
                A
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1E3A5F] tracking-tight">
                  Respaldo Manual Inmediato
                </h3>
                <p className="text-xs text-[#616161]">
                  Exporta todos los datos relacionales en formato JSON y despáchalos al correo destino.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-7 space-y-1.5">
                <label className="text-xs font-semibold text-[#1E3A5F] block">
                  Correo electrónico destinatario
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#616161] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="propietario@ejemplo.com"
                    disabled={isExporting}
                    className="w-full h-11 bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl pl-10 pr-3.5 text-xs text-[#1E3A5F] focus:outline-none transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="sm:col-span-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportAndSend(false)}
                  disabled={isExporting}
                  className="flex-1 h-11 px-4 rounded-xl bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
                  title="Generar y despachar respaldo por correo"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                      <span>Generando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-[#E8B4A0]" />
                      <span>Generar y Enviar</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleExportAndSend(true)}
                  disabled={isExporting}
                  className="h-11 px-3 rounded-xl border border-[#E5E7EB] hover:border-[#1E3A5F] bg-white hover:bg-[#F8F9FA] text-[#1E3A5F] text-xs flex items-center justify-center transition-all active:scale-95 shrink-0"
                  title="Descargar copia JSON directa en tu navegador"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* =================================================================
              BLOQUE B: Programación Automática de Respaldos
             ================================================================= */}
          <div className="p-5 sm:p-6 space-y-4 bg-[#F8F9FA]/40">
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center shrink-0 font-mono text-xs font-bold">
                  B
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E3A5F] tracking-tight">
                    Programación Automática de Respaldos
                  </h3>
                  <p className="text-xs text-[#616161]">
                    Envío recurrente y autónomo sin necesidad de abrir la aplicación.
                  </p>
                </div>
              </div>

              {/* Switch de Activación */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E3A5F]"></div>
              </label>
            </div>

            {isScheduled ? (
              <div className="space-y-4 pt-2 border-t border-[#E5E7EB]/80 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  
                  {/* Correo Fijo de Destino */}
                  <div className="sm:col-span-6 space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E3A5F] block">
                      Correo fijo de destino
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#616161] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        value={scheduledEmail}
                        onChange={(e) => setScheduledEmail(e.target.value)}
                        placeholder="propietario@empresa.com"
                        className="w-full h-11 bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl pl-10 pr-3.5 text-xs text-[#1E3A5F] focus:outline-none transition-all shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Selector de Frecuencia */}
                  <div className="sm:col-span-6 space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E3A5F] block">
                      Frecuencia de Envío
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: 'Diario', value: '1' },
                        { label: 'Semanal', value: '7' },
                        { label: 'Quincenal', value: '15' },
                        { label: 'Personalizado', value: 'custom' }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFrequencyOption(opt.value as any)}
                          className={`h-11 px-1 rounded-xl text-[11px] font-mono uppercase tracking-wider transition-all flex items-center justify-center border ${
                            frequencyOption === opt.value
                              ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-bold shadow-xs'
                              : 'bg-white text-[#1E3A5F] border-[#E5E7EB] hover:bg-[#F8F9FA]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* Input de días si es personalizado */}
                  {frequencyOption === 'custom' && (
                    <div className="sm:col-span-4 space-y-1.5">
                      <label className="text-xs font-semibold text-[#1E3A5F] block">
                        Cada cuántos días (mín. 1)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={customDays}
                        onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full h-11 px-3.5 bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl text-xs font-mono text-[#1E3A5F] focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Hora de Ejecución */}
                  <div className={`${frequencyOption === 'custom' ? 'sm:col-span-4' : 'sm:col-span-6'} space-y-1.5`}>
                    <label className="text-xs font-semibold text-[#1E3A5F] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#E8B4A0]" />
                      Hora de Ejecución (24h)
                    </label>
                    <input
                      type="time"
                      value={executionTime}
                      onChange={(e) => setExecutionTime(e.target.value)}
                      className="w-full h-11 px-3.5 bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl text-xs font-mono text-[#1E3A5F] focus:outline-none shadow-xs"
                    />
                  </div>

                  {/* Botón Guardar Programación */}
                  <div className={`${frequencyOption === 'custom' ? 'sm:col-span-4' : 'sm:col-span-6'}`}>
                    <button
                      type="button"
                      onClick={handleSaveSchedule}
                      disabled={isSavingSettings}
                      className="w-full h-11 px-4 rounded-xl bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs cursor-pointer"
                    >
                      {isSavingSettings ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <Calendar className="w-3.5 h-3.5 text-[#E8B4A0]" />
                          <span>Guardar Programación</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Próxima Ejecución */}
                {nextRunAt && (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] font-mono text-emerald-800 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Próxima ejecución programada:
                    </span>
                    <strong className="text-emerald-950 font-bold">
                      {new Date(nextRunAt).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
                    </strong>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-[#616161] pt-1">
                <span>La sincronización periódica está desactivada. Activa el interruptor para configurarla.</span>
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={isSavingSettings}
                  className="text-xs font-mono text-neutral-500 hover:text-neutral-800 underline cursor-pointer"
                >
                  Guardar estado desactivado
                </button>
              </div>
            )}
          </div>

          {/* =================================================================
              BLOQUE C: Restaurar Copia de Seguridad
             ================================================================= */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 font-mono text-xs font-bold">
                C
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1E3A5F] tracking-tight">
                  Restaurar Copia de Seguridad
                </h3>
                <p className="text-xs text-[#616161]">
                  Carga un archivo <code>.json</code> previo para restaurar atómicamente el catálogo y ventas.
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5 text-xs text-amber-900">
                <p className="font-semibold flex items-center gap-1 text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  Operación destructiva protegida
                </p>
                <p className="text-amber-800/90 text-[11px]">
                  Requiere validación estricta de estructura y confirmación con la palabra clave RESTAURAR.
                </p>
              </div>

              {/* Botón Estilizado para Seleccionar Archivo */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-11 px-4 rounded-xl border border-rose-300 hover:border-rose-500 bg-white hover:bg-rose-50/50 text-rose-700 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <FileJson className="w-4 h-4 text-rose-600" />
                  <span>Seleccionar Archivo de Backup (.json)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Confirmación Crítica con Input RESTAURAR */}
      <BackupRestoreModal
        isOpen={restoreModalOpen}
        onClose={() => {
          setRestoreModalOpen(false);
          setSelectedFile(null);
        }}
        fileName={selectedFile?.name || 'backup.json'}
        onConfirm={handleConfirmRestore}
        isLoading={isRestoring}
      />
    </>
  );
};
