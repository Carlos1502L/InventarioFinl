import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, AlertCircle, Volume2 } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string, format?: string) => void;
  title?: string;
  instructions?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Escanear Código de Barras / QR',
  instructions = 'Apunta la cámara del dispositivo hacia el código para escanearlo automáticamente.'
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
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
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error al detener escáner:', err);
      } finally {
        setIsScanning(false);
      }
    }
  };

  const startScanner = async (cameraId?: string) => {
    try {
      setErrorMsg(null);
      await stopScanner();

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
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0
        },
        (decodedText, result) => {
          playBeep();
          stopScanner().then(() => {
            onScanSuccess(decodedText, result.result.format?.formatName);
            onClose();
          });
        },
        () => {
          // Ignorar frames sin código detectado
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error('Error iniciando escáner de cámara:', err);
      setErrorMsg(
        err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Por favor, concede acceso a la cámara en los ajustes del navegador.'
          : 'No se pudo acceder a la cámara. Verifica que ningún otro programa la esté usando.'
      );
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    // Inicializar cámaras disponibles
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Preferir cámara trasera si existe
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in">
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-md overflow-hidden shadow-xl flex flex-col font-mono">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#ffffff]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
              <Camera className="w-5 h-5 text-[#1E3A5F]" />
            </div>
            <div>
              <h3 className="font-light text-[#1E3A5F] text-base uppercase tracking-tight">{title}</h3>
              <p className="text-[11px] text-[#616161]">Escáner Óptico de Alta Velocidad</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visor de Cámara */}
        <div className="relative bg-black flex items-center justify-center min-h-[320px]">
          <div id={elementId} className="w-full h-full overflow-hidden" />

          {/* Guía visual de enfoque superpuesta */}
          {isScanning && !errorMsg && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-dashed border-[#E8B4A0] rounded-2xl relative">
                {/* Esquinas resaltadas */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#1E3A5F] rounded-tl" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#1E3A5F] rounded-tr" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#1E3A5F] rounded-bl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#1E3A5F] rounded-br" />
                {/* Línea de escaneo láser */}
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#E8B4A0] to-transparent animate-pulse shadow-[0_0_8px_#E8B4A0]" />
              </div>
            </div>
          )}

          {/* Mensaje de Error */}
          {errorMsg && (
            <div className="absolute inset-0 bg-[#1E3A5F]/95 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-12 h-12 text-[#E8B4A0] mb-3" />
              <p className="text-sm text-white mb-4">{errorMsg}</p>
              <button
                onClick={() => startScanner(selectedCameraId)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#1E3A5F] text-xs font-semibold rounded-xl shadow transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reintentar Conexión
              </button>
            </div>
          )}
        </div>

        {/* Controles y Selector de Cámara */}
        <div className="p-4 bg-[#F8F9FA] border-t border-[#E5E7EB] space-y-3">
          <p className="text-xs text-[#616161] text-center">{instructions}</p>

          {cameras.length > 1 && (
            <div className="flex items-center justify-between text-xs text-[#1E3A5F] bg-white p-2.5 rounded-xl border border-[#E5E7EB]">
              <span className="text-[#616161]">Cámara:</span>
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  startScanner(e.target.value);
                }}
                className="bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-[#1E3A5F] outline-none"
              >
                {cameras.map((cam, idx) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Cámara ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-[11px] text-[#616161]">
            <Volume2 className="w-3 h-3 text-[#1E3A5F]" /> Señal háptica y auditiva al detectar
          </div>
        </div>
      </div>
    </div>
  );
};
