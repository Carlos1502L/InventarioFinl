import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { Printer, CheckSquare, Square, Search, Tag, Loader2 } from 'lucide-react';
import { Product } from '../../types/database';
import { matchesAnyField, normalizeText } from '../../utils/searchUtils';
import { formatCurrency, formatCleanDecimal } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { escapeHtml } from '../../utils/security';
import { CancelButton } from '../common/CancelButton';
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  modalFieldCompactInputClass,
  modalPrimaryButtonClass,
  modalSecondaryButtonClass
} from './ModalShell';

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

  // Filtrar productos para la lista de selección (RF-SEARCH-016: Tolerancia a acentos)
  const filteredProducts = useMemo(() => {
    const norm = normalizeText(searchTerm);
    if (!norm) return products;
    return products.filter(p => matchesAnyField([p.name, p.code, (p as any).sku], norm));
  }, [products, searchTerm]);

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
              <span class="inventory-tag">${escapeHtml(inventoryName)}</span>
              <h4 class="product-title">${escapeHtml(prod.name)}</h4>
              <p class="product-code">SKU: <strong>${escapeHtml(prod.code)}</strong></p>
              <p class="product-loc">📍 ${escapeHtml(locName)}</p>
              <div class="product-price">${escapeHtml(priceStr)}</div>
            </div>
            <div class="label-qr">
              ${qrUrl ? `<img src="${qrUrl}" alt="${escapeHtml(prod.code)}" />` : ''}
              <span class="qr-code-text">${escapeHtml(prod.code)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas en Lote - ${escapeHtml(inventoryName)}</title>
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
    <ModalShell isOpen={isOpen} onClose={onClose} maxWidth="xl">
      <ModalHeader
        title="Impresión de etiquetas en lote"
        subtitle="Grilla optimizada de 2 columnas sin desperdicio de papel (A4)"
        icon={<Tag className="w-4 h-4 lg:w-5 lg:h-5" />}
        iconTone="indigo"
        onClose={onClose}
      />

      {/* Buscador y Controles de Selección */}
      <div className="px-4 lg:px-6 py-3 border-b border-slate-800/80 bg-slate-950/35 shrink-0 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar productos a imprimir..."
            className={`${modalFieldCompactInputClass} pl-9`}
          />
        </div>

        <div className="flex items-center gap-2 justify-between shrink-0">
          <button
            type="button"
            onClick={handleSelectAll}
            className={`${modalSecondaryButtonClass} min-h-[38px] lg:min-h-[36px] px-3 py-1.5`}
          >
            {selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0 ? (
              <>
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                <span>Deseleccionar</span>
              </>
            ) : (
              <>
                <Square className="w-4 h-4 text-slate-400" />
                <span className="tabular-nums">Todos ({filteredProducts.length})</span>
              </>
            )}
          </button>
          <span className="text-xs font-mono tabular-nums font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
            {selectedProductIds.size} sel.
          </span>
        </div>
      </div>

      {/* Lista de Productos para Selección */}
      <ModalBody className="p-0 px-4 lg:px-6 py-3 divide-y divide-slate-800/70">
        {filteredProducts.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-10">
            No se encontraron productos coincidentes.
          </p>
        ) : (
          filteredProducts.map(product => {
            const isSelected = selectedProductIds.has(product.id);
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => toggleSelect(product.id)}
                className={`w-full text-left py-3 px-3 my-0.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-indigo-500/15 border border-indigo-500/35'
                    : 'hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition-all ${
                      isSelected
                        ? 'bg-indigo-500 border-indigo-400 text-white'
                        : 'border-slate-600 bg-slate-950/60'
                    }`}
                  >
                    {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-100 truncate">{product.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap mt-0.5">
                      <span className="font-mono text-slate-300">{product.code}</span>
                      <span>·</span>
                      <span className="truncate">{product.locations?.name || 'Almacén'}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums font-semibold text-emerald-300">
                        {formatCurrency(product.price, currentInventory?.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
                  {formatCleanDecimal(Number(product.stock || 0), 2)}
                </span>
              </button>
            );
          })
        )}
      </ModalBody>

      <ModalFooter>
        <CancelButton onClick={onClose} />
        <button
          type="button"
          onClick={handlePrint}
          disabled={selectedProductIds.size === 0 || isGeneratingQRs}
          className={modalPrimaryButtonClass}
        >
          {isGeneratingQRs ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generando códigos...</span>
            </>
          ) : (
            <>
              <Printer className="w-4 h-4" />
              <span className="tabular-nums">Imprimir {selectedProductIds.size} etiquetas (2 cols)</span>
            </>
          )}
        </button>
      </ModalFooter>
    </ModalShell>
  );
};
