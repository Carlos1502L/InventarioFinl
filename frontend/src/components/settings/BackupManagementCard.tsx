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
  Edit2,
  ChevronDown
} from 'lucide-react';
import { supabase, getApiUrl } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { showAppToast } from '../ui';
import { BackupRestoreModal } from './BackupRestoreModal';
import { Switch } from '../common/Switch';

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

  const handleConfirmRestore = async (conversionOptions?: any) => {
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
          backup_payload: selectedFile.content,
          currency_conversion: conversionOptions
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error durante la restauración atómica.');
      }

      setRestoreModalOpen(false);
      setSelectedFile(null);
      const counts = data.result?.restored_counts || {};
      const prodsCount = counts.products ?? 0;
      const locsCount = counts.locations ?? 0;
      showAppToast(`Restauración exitosa: se cargaron ${prodsCount} productos y ${locsCount} ubicaciones.`, 'success', 7000);

      // Despachar evento global para que la app recargue todos los productos, categorías y ubicaciones
      window.dispatchEvent(new CustomEvent('stockly_inventory_data_updated', {
        detail: { inventoryId: currentInventory.id, counts }
      }));

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
      <div className={`bg-white border border-slate-200 rounded-2xl shadow-ui-card overflow-hidden font-sans ${className}`}>
        
        {/* Cabecera Principal del Módulo */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
                  Copias de seguridad (Backups)
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-semibold">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> OWNER
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Exportación cifrada JSON, respaldos automáticos y restauración atómica.
              </p>
            </div>
          </div>

          {loadingSettings && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
              <span>Cargando configuración...</span>
            </div>
          )}
        </div>

        {/* Contenido en 3 Bloques Ordenados */}
        <div className="divide-y divide-slate-200">

          {/* BLOQUE A: Respaldo Manual */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shrink-0 font-mono text-xs font-semibold">
                A
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                  Respaldo manual inmediato
                </h3>
                <p className="text-xs text-slate-500">
                  Exporta todos los datos relacionales en formato JSON y despáchalos al correo destino tras validación OTP.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <label className="text-xs font-medium text-slate-700 truncate min-w-0 shrink">
                    Correo de destino
                  </label>
                  {isEmailVerified && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> Verificado
                      </span>
                      <button
                        type="button"
                        onClick={handleResetVerification}
                        className="text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer underline font-medium shrink-0"
                      >
                        Cambiar
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full min-w-0">
                  <div className="flex-1 min-w-0 h-10 bg-slate-50 rounded-xl px-3.5 flex items-center gap-2.5 border border-slate-200 focus-within:bg-white focus-within:border-slate-900 transition-[background-color,border-color] duration-150">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0 pointer-events-none" />
                    <input
                      type="text"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck="false"
                      value={manualEmail}
                      onChange={(e) => {
                        setManualEmail(e.target.value);
                        if (isEmailVerified) handleResetVerification();
                      }}
                      placeholder="propietario@ejemplo.com"
                      disabled={isExporting || isEmailVerified}
                      readOnly={isEmailVerified}
                      className={`w-full flex-1 min-w-0 bg-transparent text-xs font-medium focus:outline-none truncate border-none p-0 shadow-none ${
                        isEmailVerified
                          ? 'text-slate-600 cursor-not-allowed'
                          : 'text-slate-900'
                      }`}
                    />
                  </div>

                  {!isEmailVerified && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp || isExporting || !manualEmail.trim()}
                      className="h-10 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      {isSendingOtp ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
                      ) : (
                        <KeyRound className="w-3.5 h-3.5 text-slate-700" />
                      )}
                      <span>{otpSent ? 'Reenviar' : 'Validar'}</span>
                    </button>
                  )}
                </div>
              </div>

              {otpSent && !isEmailVerified && (
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Código 6 dígitos"
                    className="w-36 h-9 px-3 text-center font-mono text-xs font-semibold tracking-widest bg-white border border-slate-300 focus:border-slate-900 rounded-lg text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={isVerifyingOtp || otpCode.trim().length !== 6}
                    className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1 transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:opacity-50 cursor-pointer"
                  >
                    {isVerifyingOtp ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    <span>Verificar</span>
                  </button>
                  <span className="text-[11px] text-slate-500 pl-1 font-mono tabular-nums">
                    {otpCooldown > 0 ? `${otpCooldown}s` : (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isSendingOtp}
                        className="text-slate-900 underline hover:text-slate-700 cursor-pointer font-sans font-medium"
                      >
                        Reenviar
                      </button>
                    )}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleExportAndSend}
                  disabled={!isEmailVerified || isExporting || isDownloading}
                  className={`flex-1 h-10 px-4 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer ${
                    isEmailVerified
                      ? 'bg-slate-900 hover:bg-slate-800'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  title={
                    !isEmailVerified
                      ? 'Debes verificar tu correo mediante código OTP antes de despachar el respaldo.'
                      : 'Generar y enviar'
                  }
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generando y enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Generar y enviar</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadDirectly}
                  disabled={isExporting || isDownloading}
                  className="h-10 px-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] shrink-0 cursor-pointer disabled:opacity-50"
                  title="Descargar copia local (.json)"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                      <span>Descargando...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-slate-700" />
                      <span>Descargar JSON</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* BLOQUE B: Programación Automática */}
          <div className="p-5 sm:p-6 space-y-4 bg-slate-50/40">
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center shrink-0 font-mono text-xs font-semibold">
                  B
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                    Programación automática
                  </h3>
                  <p className="text-xs text-slate-500">
                    Envío recurrente y autónomo sin necesidad de abrir la aplicación.
                  </p>
                </div>
              </div>

              <Switch
                checked={isScheduled}
                onChange={setIsScheduled}
                ariaLabel="Respaldos automáticos"
              />
            </div>

            {isScheduled ? (
              <div className="space-y-4 pt-3 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  
                  <div className="sm:col-span-6 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <label className="text-xs font-medium text-slate-700 truncate min-w-0 shrink">
                        Correo de destino
                      </label>
                      {isScheduledEmailVerified && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> Verificado
                          </span>
                          <button
                            type="button"
                            onClick={handleResetScheduledVerification}
                            className="text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer underline font-medium shrink-0"
                          >
                            Cambiar
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full min-w-0">
                      <div className="flex-1 min-w-0 h-10 bg-white rounded-xl px-3.5 flex items-center gap-2.5 border border-slate-200 focus-within:border-slate-900 transition-colors">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0 pointer-events-none" />
                        <input
                          type="text"
                          inputMode="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck="false"
                          value={scheduledEmail}
                          onChange={(e) => {
                            setScheduledEmail(e.target.value);
                            if (isScheduledEmailVerified) handleResetScheduledVerification();
                          }}
                          placeholder="propietario@empresa.com"
                          disabled={isScheduledEmailVerified}
                          readOnly={isScheduledEmailVerified}
                          className={`w-full flex-1 min-w-0 bg-transparent text-xs font-medium focus:outline-none truncate border-none p-0 shadow-none ${
                            isScheduledEmailVerified
                              ? 'text-slate-600 cursor-not-allowed'
                              : 'text-slate-900'
                          }`}
                        />
                      </div>

                      {!isScheduledEmailVerified && (
                        <button
                          type="button"
                          onClick={handleSendScheduledOtp}
                          disabled={isSendingScheduledOtp || !scheduledEmail.trim()}
                          className="h-10 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          {isSendingScheduledOtp ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
                          ) : (
                            <KeyRound className="w-3.5 h-3.5 text-slate-700" />
                          )}
                          <span>{scheduledOtpSent ? 'Reenviar' : 'Validar'}</span>
                        </button>
                      )}
                    </div>

                    {scheduledOtpSent && !isScheduledEmailVerified && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <input
                          type="text"
                          maxLength={6}
                          value={scheduledOtpCode}
                          onChange={(e) => setScheduledOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Código 6 dígitos"
                          className="w-36 h-9 px-3 text-center font-mono text-xs font-semibold tracking-widest bg-white border border-slate-300 focus:border-slate-900 rounded-lg text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyScheduledOtp}
                          disabled={isVerifyingScheduledOtp || scheduledOtpCode.trim().length !== 6}
                          className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1 transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:opacity-50 cursor-pointer"
                        >
                          {isVerifyingScheduledOtp ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          <span>Verificar</span>
                        </button>
                        <span className="text-[11px] text-slate-500 pl-1 font-mono tabular-nums">
                          {scheduledOtpCooldown > 0 ? `${scheduledOtpCooldown}s` : (
                            <button
                              type="button"
                              onClick={handleSendScheduledOtp}
                              disabled={isSendingScheduledOtp}
                              className="text-slate-900 underline hover:text-slate-700 cursor-pointer font-sans font-medium"
                            >
                              Reenviar
                            </button>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Selector de Frecuencia */}
                  <div className="sm:col-span-6 space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 block">
                      Frecuencia de envío
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative w-full">
                        <div
                          className={`w-full min-h-[40px] px-3 py-2 rounded-xl flex items-center justify-between gap-1.5 transition-colors pointer-events-none select-none ${
                            frequencyOption !== 'custom'
                              ? 'bg-white border border-slate-900 text-slate-900 font-semibold'
                              : 'bg-white border border-slate-200 text-slate-500 font-medium'
                          }`}
                        >
                          <span className="flex-1 text-center text-xs leading-snug truncate">
                            {frequencyOption === '1'
                              ? 'Diario (1 día)'
                              : frequencyOption === '7'
                              ? 'Semanal (7 días)'
                              : frequencyOption === '15'
                              ? 'Quincenal (15 días)'
                              : 'Predeterminado'}
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                              frequencyOption !== 'custom' ? 'text-slate-900' : 'text-slate-400'
                            }`}
                          />
                        </div>

                        <select
                          value={frequencyOption === 'custom' ? '' : frequencyOption}
                          onChange={(e) => {
                            if (e.target.value) {
                              setFrequencyOption(e.target.value as any);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 text-base"
                          aria-label="Frecuencia predeterminada"
                        >
                          <option value="" disabled hidden>
                            Predeterminado
                          </option>
                          <option value="1">Diario (1 día)</option>
                          <option value="7">Semanal (7 días)</option>
                          <option value="15">Quincenal (15 días)</option>
                        </select>
                      </div>

                      <div className="relative w-full">
                        <div
                          className={`w-full min-h-[40px] px-3 py-2 rounded-xl flex items-center justify-between gap-1.5 transition-colors pointer-events-none select-none ${
                            frequencyOption === 'custom'
                              ? 'bg-white border border-slate-900 text-slate-900 font-semibold'
                              : 'bg-white border border-slate-200 text-slate-500 font-medium'
                          }`}
                        >
                          <span className="flex-1 text-center text-xs leading-snug truncate">
                            {frequencyOption === 'custom'
                              ? `${customDays} ${customDays === 1 ? 'día' : 'días'}`
                              : 'Personalizado'}
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                              frequencyOption === 'custom' ? 'text-slate-900' : 'text-slate-400'
                            }`}
                          />
                        </div>

                        <select
                          value={frequencyOption === 'custom' ? String(customDays) : ''}
                          onChange={(e) => {
                            const days = parseInt(e.target.value, 10);
                            if (!isNaN(days) && days >= 1) {
                              setCustomDays(days);
                              setFrequencyOption('custom');
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 text-base"
                          aria-label="Días personalizados"
                        >
                          <option value="" disabled hidden>
                            Personalizado
                          </option>
                          {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>
                              {d} {d === 1 ? 'día' : 'días'}
                            </option>
                          ))}
                          <option value="45">45 días</option>
                          <option value="60">60 días</option>
                          <option value="90">90 días</option>
                          <option value="180">180 días</option>
                          <option value="365">365 días</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-6 flex items-center justify-start sm:justify-center gap-2.5 h-10 px-1">
                    <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Hora de envío (24h)</span>
                    </label>
                    <input
                      type="time"
                      value={executionTime || '02:00'}
                      onChange={(e) => setExecutionTime(e.target.value || '02:00')}
                      className="w-22 h-8 px-2 bg-white border border-slate-200 focus:border-slate-900 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none text-center shrink-0 tabular-nums"
                    />
                  </div>

                  <div className="sm:col-span-6">
                    <button
                      type="button"
                      onClick={handleSaveSchedule}
                      disabled={isSavingSettings || (isScheduled && !isScheduledEmailVerified)}
                      className="w-full h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer disabled:opacity-50"
                      title={
                        isScheduled && !isScheduledEmailVerified
                          ? 'Debes validar el correo de destino con OTP antes de guardar.'
                          : 'Guardar programación'
                      }
                    >
                      {isSavingSettings ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Guardar programación</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {nextRunAt && (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] font-mono text-emerald-800 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-sans">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Próxima ejecución programada:
                    </span>
                    <strong className="text-emerald-950 font-semibold tabular-nums">
                      {new Date(nextRunAt).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
                    </strong>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>La sincronización periódica está desactivada. Activa el interruptor para configurarla.</span>
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={isSavingSettings}
                  className="text-xs text-slate-700 hover:text-slate-900 underline cursor-pointer font-medium"
                >
                  Guardar estado desactivado
                </button>
              </div>
            )}
          </div>

          {/* BLOQUE C: Restaurar Copia */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0 font-mono text-xs font-semibold">
                C
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                  Restaurar copia de seguridad
                </h3>
                <p className="text-xs text-slate-500">
                  Carga un archivo <code>.json</code> previo para restaurar atómicamente el catálogo y ventas.
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5 text-xs text-amber-900">
                <p className="font-semibold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  Operación destructiva protegida
                </p>
                <p className="text-amber-800/90 text-[11px]">
                  Requiere validación de estructura y confirmación con la palabra clave RESTAURAR.
                </p>
              </div>

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
                  className="h-10 px-4 rounded-xl border border-red-300 hover:border-red-400 bg-white hover:bg-red-50 text-red-700 text-xs font-semibold flex items-center justify-center gap-2 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer whitespace-nowrap"
                >
                  <FileJson className="w-4 h-4 text-red-600" />
                  <span>Seleccionar archivo (.json)</span>
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
        sourceCurrency={selectedFile?.content?.inventory_metadata?.currency || 'PEN'}
        targetCurrency={currentInventory?.currency || 'PEN'}
        backupExchangeRate={selectedFile?.content?.inventory_metadata?.exchange_rate}
        inventoryExchangeRate={currentInventory?.exchange_rate}
      />
    </>
  );
};
