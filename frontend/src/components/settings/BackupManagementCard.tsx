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
  FileJson,
  KeyRound,
  Edit2
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
  const [isDownloading, setIsDownloading] = useState(false);

  // Estados OTP Bloque A
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

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

  // Estados OTP Bloque B: Programado
  const [isScheduledEmailVerified, setIsScheduledEmailVerified] = useState(false);
  const [scheduledVerificationToken, setScheduledVerificationToken] = useState('');
  const [scheduledOtpSent, setScheduledOtpSent] = useState(false);
  const [scheduledOtpCode, setScheduledOtpCode] = useState('');
  const [isSendingScheduledOtp, setIsSendingScheduledOtp] = useState(false);
  const [isVerifyingScheduledOtp, setIsVerifyingScheduledOtp] = useState(false);
  const [scheduledOtpCooldown, setScheduledOtpCooldown] = useState(0);
  const [savedScheduledEmail, setSavedScheduledEmail] = useState('');

  // Estados Bloque C: Restauración
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

  // Si el correo programado coincide con el manual ya verificado, hereda la verificación
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

  // Sincronización de correo verificado entre vistas (móvil y web) y sesiones
  useEffect(() => {
    if (!currentInventory?.id) return;

    // 1. Cargar de localStorage si existe verificación previa para este inventario
    try {
      const stored = localStorage.getItem(`stockly_verified_backup_${currentInventory.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.email && parsed?.token) {
          setManualEmail(parsed.email);
          setIsEmailVerified(true);
          setVerificationToken(parsed.token);
          setScheduledEmail(parsed.email);
          setIsScheduledEmailVerified(true);
          setScheduledVerificationToken(parsed.token);
        }
      }
    } catch (e) {}

    // 2. Escuchar evento de sincronización en tiempo real
    const handleSync = (e: any) => {
      const detail = e.detail;
      if (detail?.email && detail?.token) {
        setManualEmail(detail.email);
        setIsEmailVerified(true);
        setVerificationToken(detail.token);
        setScheduledEmail(detail.email);
        setIsScheduledEmailVerified(true);
        setScheduledVerificationToken(detail.token);
      }
    };

    window.addEventListener('stockly_backup_verified', handleSync);
    return () => window.removeEventListener('stockly_backup_verified', handleSync);
  }, [currentInventory?.id]);

  // Precargar correos iniciales con el usuario autenticado
  useEffect(() => {
    if (user?.email) {
      if (!manualEmail) setManualEmail(user.email);
      if (!scheduledEmail) setScheduledEmail(user.email);
    }
  }, [user]);

  // Cargar configuración existente de inventory_backup_settings y sincronizar estado verificado de backend
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

          // Sincronizar correo verificado desde el backend
          if (json.verified_email && json.verification_token) {
            setManualEmail(json.verified_email);
            setIsEmailVerified(true);
            setVerificationToken(json.verification_token);
            setScheduledEmail(json.verified_email);
            setIsScheduledEmailVerified(true);
            setScheduledVerificationToken(json.verification_token);
            try {
              localStorage.setItem(
                `stockly_verified_backup_${currentInventory.id}`,
                JSON.stringify({ email: json.verified_email, token: json.verification_token })
              );
            } catch (e) {}
          }

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
  // HANDLERS BLOQUE A: Manual & OTP
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
      try {
        localStorage.setItem(
          `stockly_verified_backup_${currentInventory.id}`,
          JSON.stringify({ email: target, token: data.verification_token })
        );
        window.dispatchEvent(
          new CustomEvent('stockly_backup_verified', {
            detail: { email: target, token: data.verification_token }
          })
        );
      } catch (e) {}
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
        showAppToast(`Copia de seguridad generada y enviada exitosamente a ${target}`, 'success', 6000);
      } else {
        const notice = data.emailResult?.error || data.message || 'No se pudo enviar el correo.';
        showAppToast(`Aviso: ${notice}`, 'warning', 7000);
      }
      // REGLA ESTRICTA RF-2: Jamás invocar triggerBrowserDownload aquí
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        showAppToast('La solicitud tardó más de 90 segundos. Verifica si el correo llegó a tu bandeja.', 'warning', 8000);
      } else {
        console.error('Error en exportAndSend:', err);
        showAppToast(err.message || 'Error al generar la copia de seguridad.', 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // --------------------------------------------------------------------------
  // HANDLERS BLOQUE B: Programado & OTP
  // --------------------------------------------------------------------------
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
      try {
        localStorage.setItem(
          `stockly_verified_backup_${currentInventory.id}`,
          JSON.stringify({ email: target, token: data.verification_token })
        );
        window.dispatchEvent(
          new CustomEvent('stockly_backup_verified', {
            detail: { email: target, token: data.verification_token }
          })
        );
      } catch (e) {}
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
    const target = scheduledEmail.trim();
    if (isScheduled && (!target || !target.includes('@'))) {
      showAppToast('Debes especificar un correo de destino válido para activar la programación.', 'warning');
      return;
    }

    if (isScheduled && !isScheduledEmailVerified) {
      showAppToast('Debes validar el correo de destino con el código OTP antes de activar la programación.', 'warning');
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
          timezone: 'America/Lima',
          verification_token: scheduledVerificationToken || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al guardar la programación.');
      }

      if (data.settings) {
        setNextRunAt(data.settings.next_run_at || null);
        setSavedScheduledEmail(data.settings.target_email || target);
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

      // Despachar evento global para que la app recargue todos los productos, categorías y ubicaciones
      window.dispatchEvent(new CustomEvent('stockly_inventory_data_updated'));

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
              BLOQUE A: Respaldo Manual Inmediato (con Verificación OTP y RF-2)
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
                  Exporta todos los datos relacionales en formato JSON y despáchalos al correo destino tras validación OTP.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {/* Input y Estado de Verificación */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#1E3A5F] block">
                    Correo electrónico destinatario
                  </label>
                  {isEmailVerified && (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verificado
                      </span>
                      <button
                        type="button"
                        onClick={handleResetVerification}
                        className="text-[11px] text-neutral-400 hover:text-neutral-700 cursor-pointer underline font-medium"
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
                      className={`w-full h-11 border rounded-xl pl-10 pr-3.5 text-xs focus:outline-none transition-all shadow-xs ${
                        isEmailVerified
                          ? 'bg-neutral-100 text-neutral-600 border-neutral-300 cursor-not-allowed font-medium'
                          : 'bg-white text-[#1E3A5F] border-[#E5E7EB] focus:border-[#1E3A5F]'
                      }`}
                    />
                  </div>

                  {!isEmailVerified && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp || isExporting || !manualEmail.trim()}
                      className="h-11 px-3.5 rounded-xl border border-[#1E3A5F] bg-white hover:bg-[#1E3A5F]/5 text-[#1E3A5F] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
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
              </div>

              {/* Formulario OTP minimalista en línea */}
              {otpSent && !isEmailVerified && (
                <div className="flex items-center gap-2 pt-0.5 animate-in fade-in">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Código 6 dígitos"
                    className="w-36 h-9 px-3 text-center font-mono text-xs font-bold tracking-widest bg-white border border-[#1E3A5F]/30 focus:border-[#1E3A5F] rounded-lg text-[#1E3A5F] focus:outline-none shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={isVerifyingOtp || otpCode.trim().length !== 6}
                    className="h-9 px-3.5 rounded-lg bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    {isVerifyingOtp ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 text-[#E8B4A0]" />}
                    <span>Verificar</span>
                  </button>
                  <span className="text-[11px] text-neutral-400 pl-1">
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

              {/* Botones de Acción: Generar y Enviar vs Descargar Local */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportAndSend}
                  disabled={!isEmailVerified || isExporting || isDownloading}
                  className={`flex-1 h-11 px-4 rounded-xl text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs cursor-pointer ${
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
                      <Send className="w-3.5 h-3.5 text-[#E8B4A0]" />
                      <span>Generar y Enviar</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadDirectly}
                  disabled={isExporting || isDownloading}
                  className="h-11 px-4 rounded-xl border border-[#E5E7EB] hover:border-[#1E3A5F] bg-white hover:bg-[#F8F9FA] text-[#1E3A5F] text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0 cursor-pointer disabled:opacity-50"
                  title="Descargar copia local (.json)"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#1E3A5F]" />
                      <span>Descargando...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-[#1E3A5F]" />
                      <span>Descargar Backup</span>
                    </>
                  )}
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
                  
                  {/* Correo Fijo de Destino con Validación Minimalista */}
                  <div className="sm:col-span-6 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#1E3A5F] block">
                        Correo fijo de destino
                      </label>
                      {isScheduledEmailVerified && (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verificado
                          </span>
                          <button
                            type="button"
                            onClick={handleResetScheduledVerification}
                            className="text-[11px] text-neutral-400 hover:text-neutral-700 cursor-pointer underline font-medium"
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
                          className={`w-full h-11 border rounded-xl pl-10 pr-3.5 text-xs focus:outline-none transition-all shadow-xs ${
                            isScheduledEmailVerified
                              ? 'bg-neutral-100 text-neutral-600 border-neutral-300 cursor-not-allowed font-medium'
                              : 'bg-white text-[#1E3A5F] border-[#E5E7EB] focus:border-[#1E3A5F]'
                          }`}
                        />
                      </div>

                      {!isScheduledEmailVerified && (
                        <button
                          type="button"
                          onClick={handleSendScheduledOtp}
                          disabled={isSendingScheduledOtp || !scheduledEmail.trim()}
                          className="h-11 px-3.5 rounded-xl border border-[#1E3A5F] bg-white hover:bg-[#1E3A5F]/5 text-[#1E3A5F] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
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
                      <div className="flex items-center gap-2 pt-0.5 animate-in fade-in">
                        <input
                          type="text"
                          maxLength={6}
                          value={scheduledOtpCode}
                          onChange={(e) => setScheduledOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Código 6 dígitos"
                          className="w-36 h-9 px-3 text-center font-mono text-xs font-bold tracking-widest bg-white border border-[#1E3A5F]/30 focus:border-[#1E3A5F] rounded-lg text-[#1E3A5F] focus:outline-none shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyScheduledOtp}
                          disabled={isVerifyingScheduledOtp || scheduledOtpCode.trim().length !== 6}
                          className="h-9 px-3.5 rounded-lg bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
                        >
                          {isVerifyingScheduledOtp ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 text-[#E8B4A0]" />}
                          <span>Verificar</span>
                        </button>
                        <span className="text-[11px] text-neutral-400 pl-1">
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

                  {/* Selector de Frecuencia con Select y Menú Desplazable de Días al mismo nivel */}
                  <div className="sm:col-span-6 space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E3A5F] block">
                      Frecuencia de Envío
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Campo 1: Select predeterminado con texto centrado */}
                      <div className="relative">
                        <select
                          value={frequencyOption === 'custom' ? '' : frequencyOption}
                          onChange={(e) => {
                            if (e.target.value) {
                              setFrequencyOption(e.target.value as any);
                            }
                          }}
                          className={`w-full h-11 px-3 pr-7 rounded-xl text-xs font-semibold border appearance-none transition-all cursor-pointer text-center [text-align-last:center] ${
                            frequencyOption !== 'custom'
                              ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-xs'
                              : 'bg-white text-neutral-700 border-[#E5E7EB]'
                          }`}
                        >
                          <option value="" disabled className="text-neutral-400 bg-white">
                            Predeterminado
                          </option>
                          <option value="1" className="bg-white text-neutral-800">Diario (1 día)</option>
                          <option value="7" className="bg-white text-neutral-800">Semanal (7 días)</option>
                          <option value="15" className="bg-white text-neutral-800">Quincenal (15 días)</option>
                        </select>
                        <div className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs ${
                          frequencyOption !== 'custom' ? 'text-white' : 'text-neutral-500'
                        }`}>
                          ▾
                        </div>
                      </div>

                      {/* Campo 2: Menú desplazable para días personalizados (rueda/picker nativo como hora) */}
                      <div className="relative">
                        <select
                          value={frequencyOption === 'custom' ? String(customDays) : ''}
                          onChange={(e) => {
                            const days = parseInt(e.target.value, 10);
                            if (!isNaN(days) && days >= 1) {
                              setCustomDays(days);
                              setFrequencyOption('custom');
                            }
                          }}
                          className={`w-full h-11 px-3 pr-7 rounded-xl text-xs font-semibold border appearance-none transition-all cursor-pointer text-center [text-align-last:center] ${
                            frequencyOption === 'custom'
                              ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-xs'
                              : 'bg-white text-neutral-700 border-[#E5E7EB]'
                          }`}
                        >
                          <option value="" disabled={frequencyOption === 'custom'} className="text-neutral-400 bg-white">
                            Personalizado
                          </option>
                          {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d} className="bg-white text-neutral-800">
                              {d} {d === 1 ? 'día' : 'días'}
                            </option>
                          ))}
                          <option value="45" className="bg-white text-neutral-800">45 días</option>
                          <option value="60" className="bg-white text-neutral-800">60 días</option>
                          <option value="90" className="bg-white text-neutral-800">90 días</option>
                          <option value="180" className="bg-white text-neutral-800">180 días</option>
                          <option value="365" className="bg-white text-neutral-800">365 días</option>
                        </select>
                        <div className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs ${
                          frequencyOption === 'custom' ? 'text-white' : 'text-neutral-500'
                        }`}>
                          ▾
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* Hora de Ejecución limpia y centrada */}
                  <div className="sm:col-span-6 space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E3A5F] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#E8B4A0]" />
                      Hora de Ejecución (24h)
                    </label>
                    <input
                      type="time"
                      value={executionTime || '02:00'}
                      onChange={(e) => setExecutionTime(e.target.value || '02:00')}
                      className="w-full h-11 px-3.5 bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-xl text-xs font-mono font-bold text-[#1E3A5F] focus:outline-none shadow-xs text-center [text-align-last:center]"
                    />
                  </div>

                  {/* Botón Guardar Programación */}
                  <div className="sm:col-span-6">
                    <button
                      type="button"
                      onClick={handleSaveSchedule}
                      disabled={isSavingSettings || (isScheduled && !isScheduledEmailVerified)}
                      className="w-full h-11 px-4 rounded-xl bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-50"
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
