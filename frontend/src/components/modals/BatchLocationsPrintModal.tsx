import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import {
  X,
  Printer,
  Download,
  MapPin,
  CheckSquare,
  Square,
  Search,
  Loader2,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { Location } from '../../types/database';
import { useAuth } from '../../context/AuthContext';

interface BatchLocationsPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BatchLocationsPrintModal: React.FC<BatchLocationsPrintModalProps> = ({
  isOpen,
  onClose
}) => {
  const { currentInventory } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen && currentInventory?.id) {
      loadLocations();
    } else {
      setSelectedIds(new Set());
      setSearchTerm('');
    }
  }, [isOpen, currentInventory?.id]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('inventory_id', currentInventory?.id)
        .order('name', { ascending: true });

      if (error) throw error;
      const list = data || [];
      setLocations(list);
      // Por defecto seleccionar todas
      setSelectedIds(new Set(list.map(l => l.id)));
    } catch (err) {
      console.error('Error cargando ubicaciones para impresión:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = locations.filter(loc => {
    const q = searchTerm.toLowerCase();
    return loc.name.toLowerCase().includes(q) || loc.code.toLowerCase().includes(q);
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(locations.map(l => l.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const selectedLocations = locations.filter(l => selectedIds.has(l.id));

  // Generador de QR como Data URL
  const generateQrUrl = async (code: string): Promise<string> => {
    return await QRCode.toDataURL(code, {
      width: 320,
      margin: 1,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    });
  };

  // 1. Impresión directa en navegador
  const handlePrint = async () => {
    if (selectedLocations.length === 0) {
      alert('Selecciona al menos una ubicación para imprimir.');
      return;
    }

    setIsProcessing(true);
    setProgressMsg('Preparando tarjetas de ubicaciones...');

    try {
      // Generar QRs para todas las ubicaciones seleccionadas
      const cardsHtml = await Promise.all(
        selectedLocations.map(async loc => {
          const qrUrl = await generateQrUrl(loc.code);
          return `
            <div class="card-page">
              <div class="card">
                <div class="header">
                  <span>${currentInventory?.name || 'SISTEMA DE INVENTARIO'}</span>
                </div>
                <div class="body">
                  <div class="qr-box">
                    <img src="${qrUrl}" alt="QR ${loc.code}" />
                  </div>
                  <div class="details">
                    <div class="loc-code">${loc.code}</div>
                    <div class="loc-name">${loc.name}</div>
                    ${loc.description ? `<div class="loc-desc">${loc.description}</div>` : ''}
                    <div class="badge">UBICACIÓN FÍSICA</div>
                  </div>
                </div>
                <div class="footer">
                  <span>Escanea para transferir o inventariar</span>
                </div>
              </div>
            </div>
          `;
        })
      );

      const printWindow = window.open('', '_blank', 'width=750,height=500');
      if (!printWindow) {
        alert('Por favor habilita las ventanas emergentes en tu navegador para imprimir.');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Impresión de Ubicaciones (${selectedLocations.length})</title>
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
                background: #f8fafc;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .card-page {
                width: 85.6mm;
                height: 53.9mm;
                page-break-after: always;
                break-after: page;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto;
                background: #ffffff;
              }
              .card {
                width: 85.6mm;
                height: 53.9mm;
                padding: 2.5mm;
                display: flex;
                flex-direction: column;
                border: 1px dashed #cbd5e1;
                background: #ffffff;
                box-sizing: border-box;
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
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .body {
                display: flex;
                align-items: center;
                flex: 1;
                padding-top: 2.5mm;
                gap: 3mm;
              }
              .qr-box {
                width: 27mm;
                height: 27mm;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid #e2e8f0;
                border-radius: 1.5mm;
                padding: 1mm;
                background: #fff;
                flex-shrink: 0;
              }
              .qr-box img {
                width: 100%;
                height: 100%;
                object-fit: contain;
              }
              .details {
                display: flex;
                flex-direction: column;
                justify-content: center;
                overflow: hidden;
                flex: 1;
              }
              .loc-code {
                font-size: 11pt;
                font-weight: 800;
                color: #0f172a;
                line-height: 1.1;
                font-family: monospace;
                word-break: break-all;
              }
              .loc-name {
                font-size: 8pt;
                font-weight: 600;
                color: #475569;
                margin-top: 1mm;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .loc-desc {
                font-size: 6.5pt;
                color: #64748b;
                margin-top: 0.5mm;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
              }
              .badge {
                align-self: flex-start;
                margin-top: 1.5mm;
                background: #eff6ff;
                color: #2563eb;
                font-size: 5.5pt;
                font-weight: 700;
                padding: 0.5mm 1.5mm;
                border-radius: 1mm;
                border: 0.5px solid #bfdbfe;
                text-transform: uppercase;
              }
              .footer {
                border-top: 0.5px solid #e2e8f0;
                padding-top: 1mm;
                font-size: 5.5pt;
                color: #94a3b8;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
            </style>
          </head>
          <body>
            ${cardsHtml.join('')}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 400);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err: any) {
      console.error('Error al imprimir ubicaciones:', err);
      alert('Error preparando impresión: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // 2. Exportar a PDF (Tarjeta de Crédito estándar 85.6 x 53.9 mm)
  const handleExportPDF = async () => {
    if (selectedLocations.length === 0) {
      alert('Selecciona al menos una ubicación para exportar.');
      return;
    }

    setIsProcessing(true);
    setProgressMsg('Generando documento PDF de ubicaciones...');

    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.9]
      });

      for (let i = 0; i < selectedLocations.length; i++) {
        const loc = selectedLocations[i];
        if (i > 0) {
          doc.addPage([85.6, 53.9], 'landscape');
        }

        // Borde exterior
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.roundedRect(2, 2, 81.6, 49.9, 2, 2, 'S');

        // Encabezado
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(3.5, 3.5, 78.6, 6.5, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(currentInventory?.name || 'SISTEMA DE INVENTARIO', 42.8, 7.8, { align: 'center' });

        // QR Code
        const qrUrl = await generateQrUrl(loc.code);
        doc.addImage(qrUrl, 'PNG', 4.5, 12, 26, 26);

        // Detalles
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(loc.code, 33, 17);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        const nameText = loc.name.length > 28 ? loc.name.substring(0, 26) + '...' : loc.name;
        doc.text(nameText, 33, 22);

        if (loc.description) {
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          const splitDesc = doc.splitTextToSize(loc.description, 48);
          doc.text(splitDesc.slice(0, 2), 33, 27);
        }

        // Badge
        doc.setFillColor(239, 246, 255);
        doc.setDrawColor(191, 219, 254);
        doc.roundedRect(33, 33, 30, 4.5, 0.8, 0.8, 'FD');
        doc.setTextColor(37, 99, 235);
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.text('UBICACIÓN FÍSICA', 48, 36.2, { align: 'center' });

        // Pie
        doc.setDrawColor(226, 232, 240);
        doc.line(3.5, 45, 82.1, 45);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.text('Escanea para transferir o inventariar', 42.8, 48.5, { align: 'center' });
      }

      doc.save(`Ubicaciones_${currentInventory?.name || 'Inventario'}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err: any) {
      console.error('Error generando PDF de ubicaciones:', err);
      alert('Error al generar PDF: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-600/20 text-amber-600 dark:text-amber-400 rounded-xl">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
                Imprimir Tarjetas de Ubicaciones
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecciona las ubicaciones para imprimir sus códigos QR (85.6 × 53.9 mm)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de control y búsqueda */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre o código de ubicación..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors active:scale-95"
              >
                Todas
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors active:scale-95"
              >
                Ninguna
              </button>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 px-2 py-1 bg-amber-50 dark:bg-amber-500/10 rounded-lg whitespace-nowrap">
                {selectedIds.size} / {locations.length} sel.
              </span>
            </div>
          </div>
        </div>

        {/* Lista de Ubicaciones */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {loading ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Cargando ubicaciones físicas...</p>
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <MapPin className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {locations.length === 0
                  ? 'No hay ubicaciones registradas en este inventario.'
                  : 'No se encontraron ubicaciones que coincidan con la búsqueda.'}
              </p>
            </div>
          ) : (
            filteredLocations.map(loc => {
              const isSelected = selectedIds.has(loc.id);
              return (
                <div
                  key={loc.id}
                  onClick={() => toggleSelect(loc.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 shadow-sm'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      className="text-amber-600 dark:text-amber-400 focus:outline-none shrink-0"
                      onClick={e => {
                        e.stopPropagation();
                        toggleSelect(loc.id);
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-900 dark:text-white px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-md">
                          {loc.code}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {loc.name}
                        </h4>
                      </div>
                      {loc.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {loc.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    ID: {loc.id.substring(0, 8)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Acciones de impresión */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Formato: <strong>Tarjeta PVC / Adhesiva (85.6 × 53.9 mm)</strong>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportPDF}
              disabled={isProcessing || selectedIds.size === 0}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-indigo-500" />}
              Descargar PDF ({selectedIds.size})
            </button>
            <button
              onClick={handlePrint}
              disabled={isProcessing || selectedIds.size === 0}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Imprimir Seleccionadas ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
