import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  FileJson,
  KeyRound,
  ChevronDown
} from 'lucide-react';
import { supabase, getApiUrl } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { showAppToast } from '../ui';
import { BackupRestoreModal } from '../settings/BackupRestoreModal';
import { PillOption } from '../common/PillOption';
import { Switch } from '../common/Switch';
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
  modalPrimaryButtonClass,
  modalSecondaryButtonClass,
  modalDangerButtonClass
} from './ModalShell';

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

  // Sincronización de correo verificado entre vistas y sesiones
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

    // 2. Escuchar evento de sincronización en tiempo real entre componentes (web y móvil)
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

  // Precargar correo con el del usuario logueado
  useEffect(() => {
    if (user?.email) {
      if (!manualEmail) setManualEmail(user.email);
      if (!scheduledEmail) setScheduledEmail(user.email);
    }
  }, [user]);

  // Cargar configuración guardada de respaldos programados y estado verificado de backend
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
      onClose();
    } catch (err: any) {
      console.error('Error restaurando backup:', err);
      showAppToast(err.message || 'Error restaurando los datos del inventario.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const isBusy = isExporting || isDownloading || isSendingOtp || isVerifyingOtp || isSavingSettings || isRestoring;

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="md"
        disableDismiss={isBusy}
      >
        <ModalHeader
          title="Copias de seguridad"
          subtitle="Respaldo cifrado por correo OTP y restauración JSON"
          icon={<Database className="w-4 h-4 lg:w-5 lg:h-5" />}
          iconTone="indigo"
          onClose={onClose}
          closeDisabled={isBusy}
        />

        <ModalTabsBar>
          <PillOption
            active={activeTab === 'manual'}
            onClick={() => setActiveTab('manual')}
          >
            Manual
          </PillOption>
          <PillOption
            active={activeTab === 'scheduled'}
            onClick={() => setActiveTab('scheduled')}
          >
            Automático
          </PillOption>
          <PillOption
            active={activeTab === 'restore'}
            onClick={() => setActiveTab('restore')}
          >
            Restaurar
          </PillOption>
        </ModalTabsBar>

        <ModalBody className="space-y-4">
          {loadingSettings && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Cargando configuración de respaldos...</span>
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {/* PESTAÑA 1: MANUAL (con Verificación OTP y RF-2) */}
            {activeTab === 'manual' && (
              <motion.div
                key="backup-manual"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <label className="text-xs font-medium text-slate-300 truncate">
                      Correo de destino
                    </label>
                    {isEmailVerified && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> Verificado
                        </span>
                        <button
                          type="button"
                          onClick={handleResetVerification}
                          className="text-[11px] text-slate-400 hover:text-slate-100 underline font-medium cursor-pointer"
                        >
                          Cambiar
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full min-w-0">
                    <div className="relative flex-1 min-w-0">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                        className={`${modalFieldCompactInputClass} pl-10 ${
                          isEmailVerified ? 'opacity-65 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>

                    {!isEmailVerified && (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isSendingOtp || isExporting || !manualEmail.trim()}
                        className={`${modalSecondaryButtonClass} shrink-0 min-h-[44px] lg:min-h-[38px]`}
                      >
                        {isSendingOtp ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                        <span>{otpSent ? 'Reenviar' : 'Validar'}</span>
                      </button>
                    )}
                  </div>

                  {/* Formulario OTP de 6 dígitos en línea */}
                  {otpSent && !isEmailVerified && (
                    <div className="flex flex-wrap items-center gap-2 pt-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-32 h-10 px-2.5 text-center font-mono tabular-nums text-sm font-bold tracking-[0.25em] bg-slate-950 border border-indigo-500/40 focus:border-indigo-400 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                      />

                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isVerifyingOtp || otpCode.trim().length !== 6}
                        className={`${modalPrimaryButtonClass} min-h-[40px] lg:min-h-[38px] px-4 py-2`}
                      >
                        {isVerifyingOtp ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>Verificar OTP</span>
                      </button>

                      <span className="text-[11px] font-mono tabular-nums text-slate-400 pl-1">
                        {otpCooldown > 0 ? `${otpCooldown}s` : (
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={isSendingOtp}
                            className="text-indigo-300 underline hover:text-indigo-200 cursor-pointer font-sans font-medium"
                          >
                            Reenviar código
                          </button>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleExportAndSend}
                    disabled={!isEmailVerified || isExporting || isDownloading}
                    className={`${modalPrimaryButtonClass} w-full`}
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
                        <Send className="w-4 h-4" />
                        <span>Generar y enviar por correo</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadDirectly}
                    disabled={isExporting || isDownloading}
                    className={`${modalSecondaryButtonClass} w-full`}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Descargando...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-indigo-400" />
                        <span>Descargar copia JSON</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* PESTAÑA 2: AUTOMÁTICO */}
            {activeTab === 'scheduled' && (
              <motion.div
                key="backup-scheduled"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="flex flex-col gap-4"
              >
                <div className={`${modalSurfaceCardClass} flex items-center justify-between gap-3`}>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-slate-100 block truncate">
                      Respaldos automáticos
                    </span>
                    <span className="text-xs text-slate-400 block truncate mt-0.5">
                      Envío recurrente en segundo plano
                    </span>
                  </div>

                  <Switch
                    checked={isScheduled}
                    onChange={setIsScheduled}
                    ariaLabel="Respaldos automáticos"
                  />
                </div>

                {isScheduled && (
                  <div className="flex flex-col gap-4 pt-1">
                    {/* Correo de destino con Validación OTP */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <label className="text-xs font-medium text-slate-300 truncate">
                          Correo de destino
                        </label>
                        {isScheduledEmailVerified && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-medium">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> Verificado
                            </span>
                            <button
                              type="button"
                              onClick={handleResetScheduledVerification}
                              className="text-[11px] text-slate-400 hover:text-slate-100 underline font-medium cursor-pointer"
                            >
                              Cambiar
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 w-full min-w-0">
                        <div className="relative flex-1 min-w-0">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                            className={`${modalFieldCompactInputClass} pl-10 ${
                              isScheduledEmailVerified ? 'opacity-65 cursor-not-allowed' : ''
                            }`}
                          />
                        </div>

                        {!isScheduledEmailVerified && (
                          <button
                            type="button"
                            onClick={handleSendScheduledOtp}
                            disabled={isSendingScheduledOtp || !scheduledEmail.trim()}
                            className={`${modalSecondaryButtonClass} shrink-0 min-h-[44px] lg:min-h-[38px]`}
                          >
                            {isSendingScheduledOtp ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                            ) : (
                              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                            )}
                            <span>{scheduledOtpSent ? 'Reenviar' : 'Validar'}</span>
                          </button>
                        )}
                      </div>

                      {scheduledOtpSent && !isScheduledEmailVerified && (
                        <div className="flex flex-wrap items-center gap-2 pt-1.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={scheduledOtpCode}
                            onChange={(e) => setScheduledOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="w-32 h-10 px-2.5 text-center font-mono tabular-nums text-sm font-bold tracking-[0.25em] bg-slate-950 border border-indigo-500/40 focus:border-indigo-400 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                          />

                          <button
                            type="button"
                            onClick={handleVerifyScheduledOtp}
                            disabled={isVerifyingScheduledOtp || scheduledOtpCode.trim().length !== 6}
                            className={`${modalPrimaryButtonClass} min-h-[40px] lg:min-h-[38px] px-4 py-2`}
                          >
                            {isVerifyingScheduledOtp ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            <span>Verificar OTP</span>
                          </button>

                          <span className="text-[11px] font-mono tabular-nums text-slate-400 pl-1">
                            {scheduledOtpCooldown > 0 ? `${scheduledOtpCooldown}s` : (
                              <button
                                type="button"
                                onClick={handleSendScheduledOtp}
                                disabled={isSendingScheduledOtp}
                                className="text-indigo-300 underline hover:text-indigo-200 cursor-pointer font-sans font-medium"
                              >
                                Reenviar código
                              </button>
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Frecuencia de envío */}
                    <div className="space-y-1.5">
                      <label className={modalFieldLabelClass}>Frecuencia de envío</label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="relative w-full">
                          <div
                            className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl flex items-center justify-between gap-1.5 transition-colors pointer-events-none select-none border ${
                              frequencyOption !== 'custom'
                                ? 'bg-slate-800/80 border-indigo-500/60 text-white font-semibold'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 font-medium'
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
                            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
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
                            className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl flex items-center justify-between gap-1.5 transition-colors pointer-events-none select-none border ${
                              frequencyOption === 'custom'
                                ? 'bg-slate-800/80 border-indigo-500/60 text-white font-semibold'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 font-medium'
                            }`}
                          >
                            <span className="flex-1 text-center text-xs leading-snug truncate font-mono tabular-nums">
                              {frequencyOption === 'custom'
                                ? `${customDays} ${customDays === 1 ? 'día' : 'días'}`
                                : 'Personalizado'}
                            </span>
                            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
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

                    {/* Hora de envío */}
                    <div className="w-full flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl gap-3">
                      <label className="text-xs font-medium text-slate-300 flex items-center gap-2 shrink-0 select-none">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <span>Hora de envío (24h)</span>
                      </label>
                      <input
                        type="time"
                        value={executionTime || '02:00'}
                        onChange={(e) => setExecutionTime(e.target.value || '02:00')}
                        className="w-28 h-9 px-2.5 bg-slate-900 rounded-lg text-xs font-mono tabular-nums font-semibold text-slate-100 border border-slate-700 focus:outline-none focus:border-indigo-400 text-center shrink-0 cursor-pointer"
                      />
                    </div>

                    {nextRunAt && (
                      <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/25 text-xs text-emerald-200 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          Próximo envío:
                        </span>
                        <strong className="font-mono tabular-nums truncate">
                          {new Date(nextRunAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                        </strong>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveSchedule}
                      disabled={isSavingSettings || (isScheduled && !isScheduledEmailVerified)}
                      className={`${modalPrimaryButtonClass} w-full`}
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
                          <Calendar className="w-4 h-4" />
                          <span>Guardar programación</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* PESTAÑA 3: RESTAURAR */}
            {activeTab === 'restore' && (
              <motion.div
                key="backup-restore"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="space-y-4"
              >
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
                    className="w-full min-h-[130px] border border-dashed border-slate-700 hover:border-indigo-400/70 rounded-2xl bg-slate-950/50 hover:bg-slate-900 flex flex-col items-center justify-center p-4 gap-2.5 transition-colors cursor-pointer active:scale-[0.99]"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
                      <Upload className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-semibold text-slate-100 block">
                        Seleccionar archivo .json
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Copia de respaldo previa del inventario
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className={`${modalSurfaceCardClass} space-y-3.5`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0">
                        <FileJson className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-mono font-semibold text-slate-100 block truncate">
                          {selectedFile.name}
                        </span>
                        <span className="text-[11px] text-emerald-300 font-medium block mt-0.5">
                          Estructura validada (Versión 1.0)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-xs text-slate-400 hover:text-slate-100 px-2 py-1 rounded-lg cursor-pointer"
                        title="Quitar archivo"
                      >
                        Quitar
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setRestoreModalOpen(true)}
                      className={`${modalDangerButtonClass} w-full`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>Continuar con la restauración</span>
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </ModalBody>

        <ModalFooter>
          <CancelButton onClick={onClose} label="Cerrar" disabled={isBusy} />
        </ModalFooter>
      </ModalShell>

      {/* Modal de Confirmación Crítica de Restauración */}
      <BackupRestoreModal
        isOpen={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
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
