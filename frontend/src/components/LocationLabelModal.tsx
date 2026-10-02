import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { X, Printer, Download, ExternalLink, QrCode as QrIcon, CheckCircle2 } from 'lucide-react';
import { Location } from '../types/database';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/supabase';

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

  if (!isOpen || !location) return null;

  // 1. Impresión directa en navegador con dimensiones exactas de tarjeta de crédito (85.6 mm x 53.9 mm)
  const handlePrint = () => {
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
          <title>Etiqueta - ${location.code}</title>
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
            <div class="header">${inventoryTitle}</div>
            <div class="body">
              <div class="qr-box">
                <img src="${qrDataUrl}" alt="QR" />
              </div>
              <div class="details">
                <div class="badge">Ubicación Asignada</div>
                <div class="loc-name">${location.name}</div>
                <div class="code-box">${location.code}</div>
                ${location.description ? `<div class="desc">${location.description}</div>` : ''}
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
    try {
      setIsExporting(true);
      // Crear documento jsPDF con formato exacto de tarjeta de crédito (85.6 x 53.9 mm)
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
      doc.text(location.name, textX, 20.5, { maxWidth: 48 });

      // Caja de código
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(textX, 25, 48, 7, 1, 1, 'FD');

      doc.setTextColor(30, 41, 59);
      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.text(location.code, textX + 24, 29.8, { align: 'center' });

      // Descripción si existe
      if (location.description) {
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.text(location.description, textX, 36, { maxWidth: 48 });
      }

      // Pie
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.text('85.6 mm × 53.9 mm • Escanear para ubicar o transferir productos', 42.8, 50, { align: 'center' });

      doc.save(`etiqueta-${location.code}.pdf`);
    } catch (err) {
      console.error('Error generando PDF de etiqueta:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
              <QrIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Etiqueta de Ubicación</h3>
              <p className="text-xs text-slate-400">Dimensiones de Tarjeta de Crédito (85.6 mm × 53.9 mm)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vista previa en escala real */}
        <div className="p-6 bg-slate-950 flex flex-col items-center justify-center">
          <div className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Vista previa exacta para impresión térmica / tarjeta plástica
          </div>

          {/* Tarjeta con proporción real 85.6 x 53.9 mm */}
          <div
            ref={printAreaRef}
            className="w-[342px] h-[215px] bg-white rounded-xl p-3 border-2 border-slate-300 shadow-2xl flex flex-col justify-between text-slate-900 relative overflow-hidden select-none"
          >
            {/* Encabezado */}
            <div className="bg-slate-900 text-white text-center py-1.5 px-2 rounded-md font-bold text-[10px] tracking-wide uppercase truncate">
              {currentInventory?.name || 'SISTEMA DE INVENTARIO'}
            </div>

            {/* Contenido Central */}
            <div className="flex items-center gap-3 my-auto">
              {/* QR Code */}
              <div className="w-24 h-24 bg-white border border-slate-200 rounded-lg p-1 flex-shrink-0 flex items-center justify-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-slate-100 animate-pulse rounded" />
                )}
              </div>

              {/* Datos de Ubicación */}
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                  Ubicación Física
                </span>
                <h4 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                  {location.name}
                </h4>
                
                {/* Código de barra/QR en caja */}
                <div className="mt-2 bg-slate-100 border border-slate-300 rounded px-2 py-1 text-center font-mono font-bold text-xs text-slate-800 tracking-wider">
                  {location.code}
                </div>

                {location.description && (
                  <p className="text-[9px] text-slate-500 mt-1 line-clamp-1">
                    {location.description}
                  </p>
                )}
              </div>
            </div>

            {/* Pie de Tarjeta */}
            <div className="border-t border-slate-100 pt-1 text-center text-[8px] text-slate-400">
              85.6 mm × 53.9 mm • Escáner de Ubicación PWA
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap gap-2.5 justify-end">
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" /> Imprimir Etiqueta
          </button>

          <button
            onClick={handleDownloadClientPDF}
            disabled={isExporting}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" /> Exportar a PDF (85.6×53.9 mm)
          </button>
        </div>
      </div>
    </div>
  );
};
