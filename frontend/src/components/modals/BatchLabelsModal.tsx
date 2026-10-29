import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Printer, CheckSquare, Square, Search, Tag, Loader2 } from 'lucide-react';
import { Product } from '../../types/database';
import { formatCurrency } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

interface BatchLabelsModalProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
}

interface ProductWithQR extends Product {
  qrDataUrl?: string;
}

export const BatchLabelsModal: React.FC<BatchLabelsModalProps> = ({
  products,
  isOpen,
  onClose
}) => {
  const { currentInventory } = useAuth();
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [qrCache, setQrCache] = useState<Record<string, string>>({});
  const [isGeneratingQRs, setIsGeneratingQRs] = useState(false);

  // Filtrar productos para la lista de selección
  const filteredProducts = products.filter(p => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term);
  });

  // Alternar selección de un producto individual
  const toggleSelect = (id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Seleccionar / Deseleccionar todos los visibles
  const handleSelectAll = () => {
    if (selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  // Generar QRs para los productos seleccionados
  useEffect(() => {
    const generateQRs = async () => {
      const selected = products.filter(p => selectedProductIds.has(p.id));
      const missing = selected.filter(p => !qrCache[p.id]);

      if (missing.length === 0) return;

      setIsGeneratingQRs(true);
      const newCache = { ...qrCache };

      for (const prod of missing) {
        try {
          const url = await QRCode.toDataURL(prod.code, {
            width: 200,
            margin: 1,
            color: { dark: '#0F172A', light: '#FFFFFF' },
            errorCorrectionLevel: 'M'
          });
          newCache[prod.id] = url;
        } catch (e) {
          console.error('Error generating QR for', prod.code, e);
        }
      }

      setQrCache(newCache);
      setIsGeneratingQRs(false);
    };

    if (isOpen && selectedProductIds.size > 0) {
      generateQRs();
    }
  }, [isOpen, selectedProductIds, products, qrCache]);

  if (!isOpen) return null;

  const selectedProducts = products.filter(p => selectedProductIds.has(p.id));

  // RF-09.2: Formato de impresión en grilla de al menos 2 columnas llenándose verticalmente
  const handlePrint = () => {
    if (selectedProducts.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Por favor habilita las ventanas emergentes para imprimir las etiquetas.');
      return;
    }

    const inventoryName = currentInventory?.name || 'Inventario';

    // Generar HTML de las etiquetas en 2 columnas
    const labelsHtml = selectedProducts.map(prod => {
      const qrUrl = qrCache[prod.id] || '';
      const priceStr = formatCurrency(prod.price, currentInventory?.currency);
      const locName = prod.locations?.name || 'Almacén';

      return `
        <div class="label-card">
          <div class="label-content">
            <div class="label-info">
              <span class="inventory-tag">${inventoryName}</span>
              <h4 class="product-title">${prod.name}</h4>
              <p class="product-code">SKU: <strong>${prod.code}</strong></p>
              <p class="product-loc">📍 ${locName}</p>
              <div class="product-price">${priceStr}</div>
            </div>
            <div class="label-qr">
              ${qrUrl ? `<img src="${qrUrl}" alt="${prod.code}" />` : ''}
              <span class="qr-code-text">${prod.code}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas en Lote - ${inventoryName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            body {
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            /* Grilla de 2 columnas llenándose verticalmente para evitar desperdicio de papel */
            .labels-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8mm 6mm;
            }
            .label-card {
              border: 1.5px solid #cbd5e1;
              border-radius: 6px;
              padding: 6mm;
              height: 48mm;
              page-break-inside: avoid;
              background: #fff;
            }
            .label-content {
              display: flex;
              height: 100%;
              justify-content: space-between;
              align-items: center;
              gap: 4mm;
            }
            .label-info {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              height: 100%;
              overflow: hidden;
            }
            .inventory-tag {
              font-size: 8px;
              text-transform: uppercase;
              font-weight: 800;
              color: #64748b;
              letter-spacing: 0.5px;
            }
            .product-title {
              font-size: 13px;
              font-weight: 800;
              color: #0f172a;
              line-height: 1.2;
              margin: 2px 0;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            .product-code {
              font-size: 10px;
              font-family: monospace;
              color: #334155;
            }
            .product-loc {
              font-size: 9px;
              color: #64748b;
            }
            .product-price {
              font-size: 14px;
              font-weight: 900;
              color: #0284c7;
              margin-top: 2px;
            }
            .label-qr {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              width: 32mm;
            }
            .label-qr img {
              width: 28mm;
              height: 28mm;
            }
            .qr-code-text {
              font-size: 8px;
              font-family: monospace;
              color: #64748b;
              margin-top: 2px;
              max-width: 28mm;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          </style>
        </head>
        <body>
          <div class="labels-grid">
            ${labelsHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="mobile-dark-modal bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Impresión de Etiquetas en Lote
              </h3>
              <p className="text-xs text-slate-500">
                Grilla optimizada de 2 columnas sin desperdicio de papel (A4)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Buscador y Controles de Selección */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar productos a imprimir..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 justify-between">
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
            >
              {selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0 ? (
                <>
                  <CheckSquare className="w-4 h-4 text-blue-600" /> Deseleccionar todos
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" /> Seleccionar todos ({filteredProducts.length})
                </>
              )}
            </button>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
              {selectedProductIds.size} seleccionados
            </span>
          </div>
        </div>

        {/* Lista de Productos para Selección */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 dark:divide-slate-800">
          {filteredProducts.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">No se encontraron productos coincidentes.</p>
          ) : (
            filteredProducts.map(product => {
              const isSelected = selectedProductIds.has(product.id);
              return (
                <div
                  key={product.id}
                  onClick={() => toggleSelect(product.id)}
                  className={`mobile-flat-row py-2.5 px-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'mobile-card-active bg-blue-50 dark:bg-blue-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                    </button>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{product.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="font-mono">{product.code}</span>
                        <span>•</span>
                        <span>{product.locations?.name || 'Almacén'}</span>
                        <span>•</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(product.price, currentInventory?.currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono">
                    Stock: {product.stock}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Pie y Acción de Imprimir */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex max-md:flex-col-reverse max-md:gap-2 items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="mobile-cancel-btn px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={selectedProductIds.size === 0 || isGeneratingQRs}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 transition-all"
          >
            {isGeneratingQRs ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Generando códigos...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" /> Imprimir {selectedProductIds.size} Etiquetas (2 Cols)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
