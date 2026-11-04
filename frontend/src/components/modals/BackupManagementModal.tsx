import React, { useState, useEffect, useRef } from 'react';
import {
  X,
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
  FileJson,
  ShieldCheck,
  KeyRound,
  Edit2
} from 'lucide-react';
import { supabase, getApiUrl } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { showAppToast } from '../ui';
import { BackupRestoreModal } from '../settings/BackupRestoreModal';

interface BackupManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreCompleted?: () => void;
}

export const BackupManagementModal: React.FC<BackupManagementModalProps> = ({
  isOpen,
  onClose,
  onRestoreCompleted
}) => {
  const { currentInventory, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pestaña activa: manual | scheduled | restore
  const [activeTab, setActiveTab] = useState<'manual' | 'scheduled' | 'restore'>('manual');

  // Estados Bloque Manual
  const [manualEmail, setManualEmail] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Estados OTP Bloque Manual
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Estados Bloque Programado
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledEmail, setScheduledEmail] = useState('');
  const [frequencyOption, setFrequencyOption] = useState<'1' | '7' | '15' | 'custom'>('7');
  const [customDays, setCustomDays] = useState<number>(3);
  const [executionTime, setExecutionTime] = useState('02:00');
  const [nextRunAt, setNextRunAt] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Estados OTP Bloque Programado
  const [isScheduledEmailVerified, setIsScheduledEmailVerified] = useState(false);
  const [scheduledVerificationToken, setScheduledVerificationToken] = useState('');
  const [scheduledOtpSent, setScheduledOtpSent] = useState(false);
  const [scheduledOtpCode, setScheduledOtpCode] = useState('');
  const [isSendingScheduledOtp, setIsSendingScheduledOtp] = useState(false);
  const [isVerifyingScheduledOtp, setIsVerifyingScheduledOtp] = useState(false);
  const [scheduledOtpCooldown, setScheduledOtpCooldown] = useState(0);
  const [savedScheduledEmail, setSavedScheduledEmail] = useState('');

  // Estados Bloque Restauración
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: any } | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Cooldown timer para reenvío de OTP manual
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  // Cooldown timer para reenvío de OTP programado
  useEffect(() => {
    if (scheduledOtpCooldown > 0) {
      const timer = setTimeout(() => setScheduledOtpCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [scheduledOtpCooldown]);

  // Heredar verificación si coincide con manualEmail verificado
  useEffect(() => {
    if (
      scheduledEmail &&
      manualEmail &&
      scheduledEmail.trim().toLowerCase() === manualEmail.trim().toLowerCase() &&
      isEmailVerified &&
      verificationToken
    ) {
      setIsScheduledEmailVerified(true);
      setScheduledVerificationToken(verificationToken);
    }
  }, [scheduledEmail, manualEmail, isEmailVerified, verificationToken]);

  // Precargar correo con el del usuario logueado
  useEffect(() => {
    if (user?.email) {
      if (!manualEmail) setManualEmail(user.email);
      if (!scheduledEmail) setScheduledEmail(user.email);
    }
  }, [user]);

  // Cargar configuración guardada de respaldos programados
  useEffect(() => {
    const fetchSettings = async () => {
      if (!currentInventory?.id || !isOpen) return;
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
            if (s.target_email) {
              setScheduledEmail(s.target_email);
              if (s.is_scheduled) {
                setSavedScheduledEmail(s.target_email);
                setIsScheduledEmailVerified(true);
              }
            }

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
          }
        }
      } catch (err) {
        console.warn('No se pudo cargar la configuración de respaldos:', err);
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchSettings();
  }, [currentInventory?.id, isOpen]);

  if (!isOpen) return null;

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------
  const handleSendOtp = async () => {
    if (!currentInventory?.id) return;
    const target = manualEmail.trim();

    if (!target || !target.includes('@')) {
      showAppToast('Por favor, ingresa un correo electrónico válido.', 'warning');
      return;
    }

    setIsSendingOtp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No hay sesión activa.');

      const res = await fetch(getApiUrl('/backup/send-verification-code'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          inventory_id: currentInventory.id,
          email: target
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al enviar el código de verificación.');
      }

      setOtpSent(true);
      setOtpCooldown(60);
      showAppToast(`Código de verificación enviado a ${target}`, 'success', 5000);
    } catch (err: any) {
      console.error('Error enviando OTP:', err);
      showAppToast(err.message || 'No se pudo enviar el código OTP.', 'error');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!currentInventory?.id) return;
    const target = manualEmail.trim();
    const code = otpCode.trim();

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      showAppToast('El código debe contener exactamente 6 dígitos numéricos.', 'warning');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No hay sesión activa.');

      const res = await fetch(getApiUrl('/backup/verify-code'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          inventory_id: currentInventory.id,
          email: target,
          code
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Código incorrecto o expirado.');
      }

      setVerificationToken(data.verification_token);
      setIsEmailVerified(true);
      setOtpSent(false);
      setOtpCode('');
      showAppToast('✓ Correo verificado exitosamente. Ahora puedes generar el respaldo.', 'success', 4000);
    } catch (err: any) {
      console.error('Error verificando OTP:', err);
      showAppToast(err.message || 'Error al validar el código.', 'error');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResetVerification = () => {
    setIsEmailVerified(false);
    setVerificationToken('');
    setOtpSent(false);
    setOtpCode('');
  };

  const triggerBrowserDownload = (payload: any) => {
    if (!payload || !currentInventory) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const safeInvName = (currentInventory.name || 'inventario').toLowerCase().replace(/[^a-z0-9]/g, '_');
    a.href = url;
    a.download = `backup_${safeInvName}_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Solo descarga directa (sin enviar ningún correo) - RF-2
  const handleDownloadDirectly = async () => {
    if (!currentInventory?.id) return;
    setIsDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No hay sesión activa.');

      const res = await fetch(getApiUrl('/backup/export'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          inventory_id: currentInventory.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al exportar la copia de seguridad.');
      }

      if (data.payload) {
        triggerBrowserDownload(data.payload);
        showAppToast('Copia de seguridad descargada exitosamente.', 'success', 4000);
      }
    } catch (err: any) {
      console.error('Error descargando backup:', err);
      showAppToast(err.message || 'No se pudo descargar el respaldo.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  // Generar y despachar por correo exclusivamente (RF-2, RF-3 y RF-4 con OTP)
  const handleExportAndSend = async () => {
    if (!currentInventory?.id) return;
    const target = manualEmail.trim();

    if (!isEmailVerified || !verificationToken) {
      showAppToast('Debes verificar tu correo con el código OTP antes de enviar el respaldo.', 'warning');
      return;
    }

    setIsExporting(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 segundos

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
        signal: controller.signal,
        body: JSON.stringify({
          inventory_id: currentInventory.id,
          email: target,
          verification_token: verificationToken
        })
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al exportar y enviar el respaldo.');
      }

      if (data.emailSent) {
        showAppToast(`Copia de seguridad generada y enviada a ${target}`, 'success', 6000);
      } else {
        const notice = data.emailResult?.error || data.message || 'No se pudo enviar el correo.';
        showAppToast(`Aviso: ${notice}`, 'warning', 7000);
      }
      // REGLA ESTRICTA RF-2: Jamás disparar triggerBrowserDownload aquí
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        showAppToast('La solicitud tardó más de 90 segundos. Verifica si el correo llegó a tu bandeja.', 'warning', 8000);
      } else {
        console.error('Error exportando backup:', err);
        showAppToast(err.message || 'No se pudo generar el respaldo.', 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendScheduledOtp = async () => {
    if (!currentInventory?.id) return;
    const target = scheduledEmail.trim();

    if (!target || !target.includes('@')) {
      showAppToast('Ingresa un correo electrónico válido.', 'warning');
      return;
    }

    setIsSendingScheduledOtp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No hay sesión activa.');

      const res = await fetch(getApiUrl('/backup/send-verification-code'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          inventory_id: currentInventory.id,
          email: target
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al enviar el código de verificación.');
      }

      setScheduledOtpSent(true);
      setScheduledOtpCooldown(60);
      showAppToast(`Código de verificación enviado a ${target}`, 'success', 5000);
    } catch (err: any) {
      console.error('Error enviando OTP programado:', err);
      showAppToast(err.message || 'No se pudo enviar el código OTP.', 'error');
    } finally {
      setIsSendingScheduledOtp(false);
    }
  };

  const handleVerifyScheduledOtp = async () => {
    if (!currentInventory?.id) return;
    const target = scheduledEmail.trim();
    const code = scheduledOtpCode.trim();

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      showAppToast('El código debe contener exactamente 6 dígitos.', 'warning');
      return;
    }

    setIsVerifyingScheduledOtp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No hay sesión activa.');

      const res = await fetch(getApiUrl('/backup/verify-code'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          inventory_id: currentInventory.id,
          email: target,
          code
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Código incorrecto o expirado.');
      }

      setScheduledVerificationToken(data.verification_token);
      setIsScheduledEmailVerified(true);
      setScheduledOtpSent(false);
      setScheduledOtpCode('');
      showAppToast('Correo verificado exitosamente.', 'success', 4000);
    } catch (err: any) {
      console.error('Error verificando OTP programado:', err);
      showAppToast(err.message || 'Error al validar el código.', 'error');
    } finally {
      setIsVerifyingScheduledOtp(false);
    }
  };

  const handleResetScheduledVerification = () => {
    setIsScheduledEmailVerified(false);
    setScheduledVerificationToken('');
    setScheduledOtpSent(false);
    setScheduledOtpCode('');
  };

  const handleSaveSchedule = async () => {
    if (!currentInventory?.id) return;

    if (isScheduled) {
      const target = scheduledEmail.trim();
      if (!target || !target.includes('@')) {
        showAppToast('Ingresa un correo de destino válido para la programación.', 'warning');
        return;
      }

      if (!isScheduledEmailVerified) {
        showAppToast('Debes validar el correo de destino con el código OTP antes de activar la programación.', 'warning');
        return;
      }
    }

    const intervalDays = frequencyOption === 'custom' ? customDays : parseInt(frequencyOption, 10);
    if (intervalDays < 1) {
      showAppToast('El intervalo debe ser de al menos 1 día.', 'warning');
      return;
    }

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
          target_email: scheduledEmail.trim() || user?.email || '',
          is_scheduled: isScheduled,
          interval_days: intervalDays,
          execution_time: executionTime.length === 5 ? `${executionTime}:00` : executionTime,
          verification_token: scheduledVerificationToken || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al guardar la configuración.');
      }

      if (data.settings?.next_run_at) {
        setNextRunAt(data.settings.next_run_at);
        setSavedScheduledEmail(data.settings.target_email || scheduledEmail);
      }

      showAppToast(
        isScheduled
          ? 'Programación de respaldos guardada y activada.'
          : 'Respaldos automáticos desactivados.',
        'success'
      );
    } catch (err: any) {
      console.error('Error guardando configuración de backup:', err);
      showAppToast(err.message || 'Error al guardar la programación.', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      showAppToast('Selecciona un archivo con formato .json válido.', 'warning');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);

        if (!json || typeof json !== 'object' || json.version !== '1.0' || !json.data) {
          throw new Error('Estructura de respaldo inválida. Debe ser versión 1.0.');
        }

        setSelectedFile({
          name: file.name,
          content: json
        });
      } catch (err: any) {
        console.error('Error parseando JSON de respaldo:', err);
        showAppToast(err.message || 'El archivo seleccionado no es un respaldo válido.', 'error');
        setSelectedFile(null);
      }
    };
    reader.readAsText(file);
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
      onClose();
    } catch (err: any) {
      console.error('Error restaurando backup:', err);
      showAppToast(err.message || 'Error restaurando los datos del inventario.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 max-md:bg-black/75 backdrop-blur-sm p-3 sm:p-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in fade-in">
        <div className="mobile-dark-modal bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col font-sans">
          
          {/* Cabecera Limpia */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] bg-[#ffffff] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 text-[#1E3A5F]" />
              </div>
              <div>
                <h3 className="font-bold text-[#1E3A5F] text-base uppercase tracking-tight">
                  Copias de Seguridad
                </h3>
                <p className="text-xs text-[#616161]">
                  Respaldo y restauración
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#616161] hover:text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Barra de Pestañas (Píldoras móviles) */}
          <div className="mobile-tabs-bar">
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={activeTab === 'manual' ? 'mobile-tab-active' : ''}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('scheduled')}
              className={activeTab === 'scheduled' ? 'mobile-tab-active' : ''}
            >
              Automático
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('restore')}
              className={activeTab === 'restore' ? 'mobile-tab-active' : ''}
            >
              Restaurar
            </button>
          </div>

          {/* Cuerpo Scrollable con Padding y Espaciado Limpio */}
          <div className="overflow-y-auto space-y-4 p-5">
            {loadingSettings && (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-[#616161]">
                <Loader2 className="w-4 h-4 animate-spin text-[#1E3A5F]" />
                <span>Cargando datos...</span>
              </div>
            )}

            {/* PESTAÑA 1: MANUAL (con Verificación OTP y RF-2) */}
            {activeTab === 'manual' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#1E3A5F] block">
                      Correo electrónico destinatario
                    </label>
                    {isEmailVerified && (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verificado
                        </span>
                        <button
                          type="button"
                          onClick={handleResetVerification}
                          className="text-[10px] text-neutral-400 hover:text-neutral-700 underline font-medium cursor-pointer"
                        >
                          Cambiar
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="w-4 h-4 text-[#616161] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        value={manualEmail}
                        onChange={(e) => {
                          setManualEmail(e.target.value);
                          if (isEmailVerified) handleResetVerification();
                        }}
                        placeholder="propietario@ejemplo.com"
                        disabled={isExporting || isEmailVerified}
                        readOnly={isEmailVerified}
                        className={`w-full h-11 rounded-xl pl-10 pr-3.5 text-xs focus:outline-none transition-all ${
                          isEmailVerified
                            ? 'bg-neutral-100 text-neutral-600 border border-neutral-300 cursor-not-allowed font-medium'
                            : 'bg-neutral-100 text-[#1E3A5F] border border-transparent focus:ring-1 focus:ring-[#1E3A5F]'
                        }`}
                      />
                    </div>

                    {!isEmailVerified && (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isSendingOtp || isExporting || !manualEmail.trim()}
                        className="h-11 px-3.5 rounded-xl border border-[#1E3A5F] bg-white hover:bg-[#1E3A5F]/5 text-[#1E3A5F] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
                      >
                        {isSendingOtp ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1E3A5F]" />
                        ) : (
                          <KeyRound className="w-3.5 h-3.5 text-[#1E3A5F]" />
                        )}
                        <span>{otpSent ? 'Reenviar' : 'Validar'}</span>
                      </button>
                    )}
                  </div>

                  {/* Formulario OTP minimalista en línea */}
                  {otpSent && !isEmailVerified && (
                    <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Código 6 dígitos"
                        className="w-32 h-9 px-2 text-center font-mono text-xs font-bold tracking-widest bg-white border border-[#1E3A5F]/30 focus:border-[#1E3A5F] rounded-lg text-[#1E3A5F] focus:outline-none"
                      />

                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isVerifyingOtp || otpCode.trim().length !== 6}
                        className="h-9 px-3 rounded-lg bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {isVerifyingOtp ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 text-[#E8B4A0]" />}
                        <span>Verificar</span>
                      </button>

                      <span className="text-[10px] text-neutral-400 pl-1">
                        {otpCooldown > 0 ? `${otpCooldown}s` : (
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={isSendingOtp}
                            className="text-[#1E3A5F] underline hover:text-black cursor-pointer font-medium"
                          >
                            Reenviar
                          </button>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  {/* Botón 1: Generar y Enviar */}
                  <button
                    type="button"
                    onClick={handleExportAndSend}
                    disabled={!isEmailVerified || isExporting || isDownloading}
                    className={`mobile-primary-btn w-full min-h-[44px] px-4 rounded-xl text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98 shadow-xs cursor-pointer ${
                      isEmailVerified
                        ? 'bg-[#1E3A5F] hover:bg-[#152a45]'
                        : 'bg-neutral-300 text-neutral-500 cursor-not-allowed opacity-60'
                    }`}
                    title={
                      !isEmailVerified
                        ? 'Debes verificar tu correo mediante código OTP antes de despachar el respaldo.'
                        : 'Generar y Enviar'
                    }
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                        <span>Generando y enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-[#E8B4A0]" />
                        <span>Generar y Enviar</span>
                      </>
                    )}
                  </button>

                  {/* Botón 2: Descargar Backup */}
                  <button
                    type="button"
                    onClick={handleDownloadDirectly}
                    disabled={isExporting || isDownloading}
                    className="w-full min-h-[44px] px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-neutral-600" />
                        <span>Descargando...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-neutral-600" />
                        <span>Descargar Backup</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* PESTAÑA 2: AUTOMÁTICO */}
            {activeTab === 'scheduled' && (
              <div className="space-y-4">
                {/* Switch de activación */}
                <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div>
                    <span className="text-xs font-bold text-neutral-800 block">Respaldos automáticos</span>
                    <span className="text-[11px] text-neutral-500 block">Envío recurrente sin abrir la app</span>
                  </div>
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

                {isScheduled && (
                  <div className="space-y-3.5 animate-in fade-in">
                    {/* Correo de destino con Validación Minimalista */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-[#1E3A5F] block">
                          Correo de destino
                        </label>
                        {isScheduledEmailVerified && (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verificado
                            </span>
                            <button
                              type="button"
                              onClick={handleResetScheduledVerification}
                              className="text-[10px] text-neutral-400 hover:text-neutral-700 underline font-medium cursor-pointer"
                            >
                              Cambiar
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Mail className="w-4 h-4 text-[#616161] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="email"
                            value={scheduledEmail}
                            onChange={(e) => {
                              setScheduledEmail(e.target.value);
                              if (isScheduledEmailVerified) handleResetScheduledVerification();
                            }}
                            placeholder="propietario@empresa.com"
                            disabled={isScheduledEmailVerified}
                            readOnly={isScheduledEmailVerified}
                            className={`w-full h-11 rounded-xl pl-10 pr-3.5 text-xs focus:outline-none transition-all ${
                              isScheduledEmailVerified
                                ? 'bg-neutral-100 text-neutral-600 border border-neutral-300 cursor-not-allowed font-medium'
                                : 'bg-neutral-100 text-[#1E3A5F] border border-transparent focus:ring-1 focus:ring-[#1E3A5F]'
                            }`}
                          />
                        </div>

                        {!isScheduledEmailVerified && (
                          <button
                            type="button"
                            onClick={handleSendScheduledOtp}
                            disabled={isSendingScheduledOtp || !scheduledEmail.trim()}
                            className="h-11 px-3.5 rounded-xl border border-[#1E3A5F] bg-white hover:bg-[#1E3A5F]/5 text-[#1E3A5F] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
                          >
                            {isSendingScheduledOtp ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1E3A5F]" />
                            ) : (
                              <KeyRound className="w-3.5 h-3.5 text-[#1E3A5F]" />
                            )}
                            <span>{scheduledOtpSent ? 'Reenviar' : 'Validar'}</span>
                          </button>
                        )}
                      </div>

                      {scheduledOtpSent && !isScheduledEmailVerified && (
                        <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                          <input
                            type="text"
                            maxLength={6}
                            value={scheduledOtpCode}
                            onChange={(e) => setScheduledOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Código 6 dígitos"
                            className="w-32 h-9 px-2 text-center font-mono text-xs font-bold tracking-widest bg-white border border-[#1E3A5F]/30 focus:border-[#1E3A5F] rounded-lg text-[#1E3A5F] focus:outline-none"
                          />

                          <button
                            type="button"
                            onClick={handleVerifyScheduledOtp}
                            disabled={isVerifyingScheduledOtp || scheduledOtpCode.trim().length !== 6}
                            className="h-9 px-3 rounded-lg bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            {isVerifyingScheduledOtp ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 text-[#E8B4A0]" />}
                            <span>Verificar</span>
                          </button>

                          <span className="text-[10px] text-neutral-400 pl-1">
                            {scheduledOtpCooldown > 0 ? `${scheduledOtpCooldown}s` : (
                              <button
                                type="button"
                                onClick={handleSendScheduledOtp}
                                disabled={isSendingScheduledOtp}
                                className="text-[#1E3A5F] underline hover:text-black cursor-pointer font-medium"
                              >
                                Reenviar
                              </button>
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Frecuencia (Grid 2x2 para evitar desbordes) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1E3A5F] block">
                        Frecuencia de envío
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Diario (1 día)', value: '1' },
                          { label: 'Semanal (7 días)', value: '7' },
                          { label: 'Quincenal (15 días)', value: '15' },
                          { label: 'Personalizado', value: 'custom' }
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFrequencyOption(opt.value as any)}
                            className={`min-h-[40px] px-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center border ${
                              frequencyOption === opt.value
                                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-bold shadow-xs'
                                : 'bg-neutral-50 text-neutral-700 border-neutral-200/80 hover:bg-neutral-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Días personalizados si aplica */}
                    {frequencyOption === 'custom' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[#1E3A5F] block">
                          Cada cuántos días (mín. 1)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={customDays}
                          onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full h-11 px-3.5 bg-neutral-100 rounded-xl text-xs text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                      </div>
                    )}

                    {/* Hora de Ejecución */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1E3A5F] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#E8B4A0]" />
                        Hora de envío (24h)
                      </label>
                      <input
                        type="time"
                        value={executionTime}
                        onChange={(e) => setExecutionTime(e.target.value)}
                        className="w-full h-11 px-3.5 bg-neutral-100 rounded-xl text-xs text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                      />
                    </div>

                    {/* Próximo envío badge */}
                    {nextRunAt && (
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] text-emerald-800 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          Próximo envío:
                        </span>
                        <strong className="truncate">
                          {new Date(nextRunAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                        </strong>
                      </div>
                    )}

                    {/* Botón Guardar Programación */}
                    <button
                      type="button"
                      onClick={handleSaveSchedule}
                      disabled={isSavingSettings || (isScheduled && !isScheduledEmailVerified)}
                      className="mobile-primary-btn w-full min-h-[44px] px-4 rounded-xl bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98 shadow-xs disabled:opacity-50 cursor-pointer"
                      title={
                        isScheduled && !isScheduledEmailVerified
                          ? 'Debes validar el correo de destino con OTP antes de guardar.'
                          : 'Guardar Programación'
                      }
                    >
                      {isSavingSettings ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <Calendar className="w-4 h-4 text-[#E8B4A0]" />
                          <span>Guardar Programación</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PESTAÑA 3: RESTAURAR */}
            {activeTab === 'restore' && (
              <div className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelected}
                  accept=".json,application/json"
                  className="hidden"
                />

                {!selectedFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full min-h-[120px] border-2 border-dashed border-neutral-200 hover:border-neutral-400 rounded-2xl bg-neutral-50/50 flex flex-col items-center justify-center p-4 gap-2 transition-all cursor-pointer active:scale-98"
                  >
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-bold text-neutral-800 block">
                        Seleccionar archivo .json
                      </span>
                      <span className="text-[11px] text-neutral-500 block">
                        Copia de respaldo previa del inventario
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <FileJson className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-neutral-800 block truncate">
                          {selectedFile.name}
                        </span>
                        <span className="text-[11px] text-emerald-600 font-medium block">
                          Estructura validada (Versión 1.0)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
                        title="Quitar archivo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setRestoreModalOpen(true)}
                      className="w-full min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs cursor-pointer"
                    >
                      <AlertTriangle className="w-4 h-4 text-white" />
                      <span>Continuar con la Restauración</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Confirmación Crítica de Restauración */}
      <BackupRestoreModal
        isOpen={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        fileName={selectedFile?.name || 'backup.json'}
        onConfirm={handleConfirmRestore}
        isLoading={isRestoring}
      />
    </>
  );
};
