import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, AlertCircle, Volume2, CheckCircle2 } from 'lucide-react';
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  modalPrimaryButtonClass
} from './ModalShell';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string, format?: string) => void;
  title?: string;
  instructions?: string;
  continuous?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Escanear Código de Barras / QR',
  instructions = 'Apunta la cámara del dispositivo hacia el código para escanearlo automáticamente.',
  continuous = false
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [recentScansCount, setRecentScansCount] = useState<number>(0);
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);
  const scannerRef = useRef<any>(null);
  const elementId = 'interactive-barcode-scanner';

  // Sonido de feedback al escanear exitosamente (Web Audio API)
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880 Hz
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch {
      // Ignorar si el navegador bloquea audio
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState ? scannerRef.current.getState() : 0;
        if (state === 2 || (scannerRef.current as any).isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error al detener escáner:', err);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const startScanner = async (cameraId?: string) => {
    try {
      setErrorMsg(null);
      await stopScanner();

      let retries = 0;
      while (!document.getElementById(elementId) && retries < 10) {
        await new Promise(r => setTimeout(r, 50));
        retries++;
      }

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode(elementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E
        ],
        verbose: false
      });
      scannerRef.current = html5QrCode;

      const cameraConfig = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: 'environment' };

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.min(Math.floor(viewfinderWidth * 0.88), 300);
            const height = Math.min(Math.floor(width * 0.5), Math.floor(viewfinderHeight * 0.55), 150);
            return {
              width: Math.max(180, width),
              height: Math.max(85, height)
            };
          },
          aspectRatio: 1.333333
        },
        (decodedText, result) => {
          const now = Date.now();
          // Prevenir lecturas repetidas en ráfaga para el mismo código en escaneo continuo
          if (
            lastScanRef.current &&
            lastScanRef.current.code === decodedText &&
            now - lastScanRef.current.time < 1200
          ) {
            return;
          }
          lastScanRef.current = { code: decodedText, time: now };

          playBeep();

          if (continuous) {
            setLastScannedCode(decodedText);
            setRecentScansCount(c => c + 1);
            onScanSuccess(decodedText, result?.result?.format?.formatName);
          } else {
            stopScanner().then(() => {
              onScanSuccess(decodedText, result?.result?.format?.formatName);
              onClose();
            });
          }
        },
        () => {
          // Ignorar frames sin código detectado
        }
      );

      // Despertar video en iOS y Android si estuviese pausado
      try {
        const video = document.querySelector(`#${elementId} video`) as HTMLVideoElement | null;
        if (video) {
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          video.muted = true;
          if (video.paused) {
            video.play().catch(() => {});
          }
        }
      } catch (vErr) {
        console.warn('Video check:', vErr);
      }

      try {
        const stream = (html5QrCode as any).localMediaStream as MediaStream ||
          (document.querySelector(`#${elementId} video`) as HTMLVideoElement)?.srcObject as MediaStream;
        if (stream) {
          const track = stream.getVideoTracks()[0];
          if (track && track.applyConstraints && track.getCapabilities) {
            const capabilities: any = track.getCapabilities();
            if (capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
              await track.applyConstraints({
                advanced: [{ focusMode: 'continuous' }] as any
              });
            }
          }
        }
      } catch {
        // Enfoque continuo es una mejora opcional
      }

      setIsScanning(true);
    } catch (err: any) {
      console.error('Error iniciando escáner de cámara:', err);
      setErrorMsg(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Permiso de cámara denegado. Por favor, concede acceso a la cámara en los ajustes del navegador.'
          : 'No se pudo acceder a la cámara. Verifica que ningún otro programa la esté usando.'
      );
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setLastScannedCode(null);
      setRecentScansCount(0);
      lastScanRef.current = null;
      return;
    }

    // Inicializar cámaras disponibles
    import('html5-qrcode').then(({ Html5Qrcode }) => Html5Qrcode.getCameras())
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCam = devices.find(d =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('trasera') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
          );
          const chosenId = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(chosenId);
          startScanner(chosenId);
        } else {
          startScanner();
        }
      })
      .catch((err) => {
        console.warn('Error listando dispositivos de video:', err);
        startScanner();
      });

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth="md"
      ariaLabel={title}
    >
      <ModalHeader
        title={title}
        subtitle={continuous ? 'Modo escaneo continuo activo' : 'Escáner óptico de alta velocidad'}
        icon={<Camera className="w-4 h-4 lg:w-5 lg:h-5" />}
        iconTone="indigo"
        onClose={handleClose}
      />

      <ModalBody className="space-y-4">
        {/* Visor de Cámara */}
        <div className="relative bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden flex items-center justify-center min-h-[260px] lg:min-h-[280px] max-h-[340px]">
          <div id={elementId} className="w-full h-full overflow-hidden [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_video]:block" />

          {/* Guía visual de enfoque rectangular */}
          {isScanning && !errorMsg && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
              <div className="w-[88%] max-w-[320px] h-32 sm:h-36 border border-dashed border-white/50 rounded-xl relative shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]">
                <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-2 border-l-2 border-indigo-400" />
                <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-2 border-r-2 border-indigo-400" />
                <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-2 border-l-2 border-indigo-400" />
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-2 border-r-2 border-indigo-400" />
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10b981]" />
                <div className="absolute -bottom-7 inset-x-0 text-center text-[10px] text-slate-200 font-mono tracking-wider font-medium">
                  {continuous ? 'ESCANEO CONTINUO ACTIVO' : 'APUNTA AL CÓDIGO DE BARRAS O QR'}
                </div>
              </div>
            </div>
          )}

          {/* Mensaje de Error */}
          {errorMsg && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-10">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
              <p className="text-sm text-slate-200 mb-4 max-w-xs">{errorMsg}</p>
              <button
                type="button"
                onClick={() => startScanner(selectedCameraId)}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold rounded-xl shadow transition-transform active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reintentar conexión
              </button>
            </div>
          )}
        </div>

        {continuous && lastScannedCode && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-2 text-xs text-emerald-200">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate font-mono">
                Código: <strong className="text-white">{lastScannedCode}</strong>
              </span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 rounded-md font-mono tabular-nums text-[10px] font-semibold shrink-0">
              +{recentScansCount}
            </span>
          </div>
        )}

        {/* Controles y Selector de Cámara */}
        <div className="p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-2xl space-y-3">
          <p className="text-xs text-slate-300 text-center leading-relaxed">{instructions}</p>

          {cameras.length > 1 && (
            <div className="flex items-center gap-3 justify-between text-xs bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-medium shrink-0">Cámara:</span>
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  startScanner(e.target.value);
                }}
                className="flex-1 min-w-0 bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-lg px-2.5 py-2 focus:border-indigo-400 outline-none"
              >
                {cameras.map((cam, idx) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Cámara ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Señal háptica y auditiva al detectar código</span>
          </div>
        </div>
      </ModalBody>

      {continuous && (
        <ModalFooter>
          <button
            type="button"
            onClick={handleClose}
            className={`${modalPrimaryButtonClass} w-full`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="tabular-nums">Terminar escaneo ({recentScansCount} leídos)</span>
          </button>
        </ModalFooter>
      )}
    </ModalShell>
  );
};
