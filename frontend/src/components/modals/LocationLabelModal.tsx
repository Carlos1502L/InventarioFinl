import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Printer, Download, QrCode as QrIcon, CheckCircle2 } from 'lucide-react';
import { Location } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { escapeHtml } from '../../utils/security';
import { CancelButton } from '../common/CancelButton';
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  modalPrimaryButtonClass,
  modalSecondaryButtonClass
} from './ModalShell';

interface LocationLabelModalProps {
  location: Location | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LocationLabelModal: React.FC<LocationLabelModalProps> = ({
  location,
  isOpen,
  onClose
}) => {
  const { currentInventory } = useAuth();
  const lastLocRef = useRef<Location | null>(null);
  if (location) {
    lastLocRef.current = location;
  }
  const activeLocation = location || lastLocRef.current;

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location?.code) {
      QRCode.toDataURL(location.code, {
        width: 320,
        margin: 1,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
      }).then(setQrDataUrl).catch(console.error);
    }
  }, [location]);

  // 1. Impresión directa en navegador con dimensiones exactas de tarjeta de crédito (85.6 mm x 53.9 mm)
  const handlePrint = () => {
    if (!activeLocation) return;
    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (!printWindow) {
      alert('Por favor permite ventanas emergentes para imprimir la etiqueta.');
      return;
    }

    const inventoryTitle = currentInventory?.name || 'SISTEMA DE INVENTARIO';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta - ${escapeHtml(activeLocation.code)}</title>
          <style>
            @page {
              size: 85.6mm 53.9mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            body {
              width: 85.6mm;
              height: 53.9mm;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .card {
              width: 85.6mm;
              height: 53.9mm;
              padding: 2.5mm;
              display: flex;
              flex-direction: column;
              border: 1px dashed #cbd5e1;
              position: relative;
              background: #ffffff;
            }
            .header {
              background: #0f172a;
              color: #ffffff;
              padding: 2mm 3mm;
              border-radius: 1.5mm;
              font-size: 7.5pt;
              font-weight: 700;
              text-align: center;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .body {
              display: flex;
              align-items: center;
              flex: 1;
              padding-top: 2.5mm;
              gap: 3mm;
            }
            .qr-box {
              width: 28mm;
              height: 28mm;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 1px solid #e2e8f0;
              border-radius: 1.5mm;
              padding: 1mm;
              background: #fff;
            }
            .qr-box img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            .details {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              overflow: hidden;
            }
            .badge {
              font-size: 5.5pt;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
            }
            .loc-name {
              font-size: 11pt;
              font-weight: 800;
              color: #0f172a;
              line-height: 1.2;
              margin: 1mm 0 2mm 0;
              word-break: break-word;
            }
            .code-box {
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              border-radius: 1.5mm;
              padding: 1mm 2mm;
              font-family: monospace;
              font-size: 8.5pt;
              font-weight: 700;
              color: #1e293b;
              text-align: center;
              letter-spacing: 0.5px;
            }
            .desc {
              font-size: 5.5pt;
              color: #64748b;
              margin-top: 1.5mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .footer {
              text-align: center;
              font-size: 5pt;
              color: #94a3b8;
              margin-top: auto;
              border-top: 0.5px solid #f1f5f9;
              padding-top: 0.8mm;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">${escapeHtml(inventoryTitle)}</div>
            <div class="body">
              <div class="qr-box">
                <img src="${qrDataUrl}" alt="QR" />
              </div>
              <div class="details">
                <div class="badge">Ubicación Asignada</div>
                <div class="loc-name">${escapeHtml(activeLocation.name)}</div>
                <div class="code-box">${escapeHtml(activeLocation.code)}</div>
                ${activeLocation.description ? `<div class="desc">${escapeHtml(activeLocation.description)}</div>` : ''}
              </div>
            </div>
            <div class="footer">Dimensiones: 85.6 mm × 53.9 mm (Tarjeta de Crédito) • Escaneo Directo PWA</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // 2. Exportación a PDF directo en cliente (sin depender de internet ni servidor externo)
  const handleDownloadClientPDF = async () => {
    if (!activeLocation) return;
    try {
      setIsExporting(true);
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.9]
      });

      const invName = (currentInventory?.name || 'INVENTARIO').toUpperCase();

      // Borde redondeado de la tarjeta
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(2, 2, 81.6, 49.9, 2, 2, 'S');

      // Franja superior
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(2.5, 2.5, 80.6, 7.5, 1, 1, 'F');

      // Título cabecera
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(invName, 42.8, 7.2, { align: 'center' });

      // Código QR en imagen
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', 4.5, 12.5, 26, 26);
      }

      // Cuadro sutil alrededor del QR
      doc.setDrawColor(226, 232, 240);
      doc.rect(4.5, 12.5, 26, 26, 'S');

      // Texto de ubicación
      const textX = 33.5;

      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text('UBICACIÓN ASIGNADA', textX, 15);

      // Nombre de la ubicación
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(activeLocation.name, textX, 20.5, { maxWidth: 48 });

      // Caja de código
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(textX, 25, 48, 7, 1, 1, 'FD');

      doc.setTextColor(30, 41, 59);
      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.text(activeLocation.code, textX + 24, 29.8, { align: 'center' });

      // Descripción si existe
      if (activeLocation.description) {
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.text(activeLocation.description, textX, 36, { maxWidth: 48 });
      }

      // Pie
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.text('85.6 mm × 53.9 mm • Escanear para ubicar o transferir productos', 42.8, 50, { align: 'center' });

      doc.save(`etiqueta-${activeLocation.code}.pdf`);
    } catch (err) {
      console.error('Error generando PDF de etiqueta:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ModalShell
      isOpen={Boolean(isOpen && activeLocation)}
      onClose={onClose}
      maxWidth="md"
    >
      <ModalHeader
        title="Etiqueta de ubicación"
        subtitle="Dimensiones de tarjeta de crédito (85.6 × 53.9 mm)"
        icon={<QrIcon className="w-4 h-4 lg:w-5 lg:h-5" />}
        iconTone="indigo"
        onClose={onClose}
      />

      {activeLocation && (
        <>
          <ModalBody className="bg-slate-950/60 flex flex-col items-center justify-center space-y-3">
            <div className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Vista previa exacta para impresión térmica</span>
            </div>

            {/* Tarjeta con proporción real 85.6 x 53.9 mm (mantener blanco para legibilidad QR) */}
            <div
              ref={printAreaRef}
              className="qr-light-surface w-full max-w-[342px] h-[215px] bg-white rounded-xl p-3 border-2 border-slate-700/80 shadow-2xl flex flex-col justify-between text-slate-900 relative overflow-hidden select-none"
            >
              <div className="bg-slate-900 text-white text-center py-1.5 px-2 rounded-md font-bold text-[10px] tracking-wide uppercase truncate">
                {currentInventory?.name || 'SISTEMA DE INVENTARIO'}
              </div>

              <div className="flex items-center gap-3 my-auto">
                <div className="qr-light-surface w-24 h-24 bg-white border border-slate-200 rounded-lg p-1 flex-shrink-0 flex items-center justify-center">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 animate-pulse rounded" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                    Ubicación Física
                  </span>
                  <h4 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                    {activeLocation.name}
                  </h4>

                  <div className="mt-2 bg-slate-100 border border-slate-300 rounded px-2 py-1 text-center font-mono font-bold text-xs text-slate-800 tracking-wider truncate">
                    {activeLocation.code}
                  </div>

                  {activeLocation.description && (
                    <p className="text-[9px] text-slate-500 mt-1 line-clamp-1">
                      {activeLocation.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-1 text-center text-[8px] text-slate-500 font-mono">
                85.6 mm × 53.9 mm • Escáner de Ubicación PWA
              </div>
            </div>
          </ModalBody>

          <ModalFooter>
            <CancelButton onClick={onClose} label="Cerrar" />
            <button
              type="button"
              onClick={handleDownloadClientPDF}
              disabled={isExporting}
              className={modalSecondaryButtonClass}
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Exportar PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className={modalPrimaryButtonClass}
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir etiqueta</span>
            </button>
          </ModalFooter>
        </>
      )}
    </ModalShell>
  );
};
