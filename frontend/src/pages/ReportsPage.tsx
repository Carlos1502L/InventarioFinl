import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  FileSpreadsheet,
  FileCode,
  Loader2,
  RotateCcw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Product, Category, Subcategory, Location } from '../types/database';
import { formatCurrency } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';

interface ReportsPageProps {
  products: Product[];
  categories: Category[];
  subcategories: Subcategory[];
  locations: Location[];
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  products,
  categories,
  subcategories,
  locations
}) => {
  const { currentInventory } = useAuth();

  // Estados de Filtro del Reporte
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('ALL');
  const [filterLocation, setFilterLocation] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // RNF-01: Paginación para vista previa de reporte
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Estados de Descarga
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  // Subcategorías según la categoría seleccionada
  const activeSubcategories = useMemo(() => {
    if (filterCategory === 'ALL') return [];
    return subcategories.filter(s => s.category_id === filterCategory);
  }, [filterCategory, subcategories]);

  // RF-07.2: Detectar si algún filtro está activo
  const hasActiveFilters = useMemo(() => {
    return (
      filterCategory !== 'ALL' ||
      filterSubcategory !== 'ALL' ||
      filterLocation !== 'ALL' ||
      filterStatus !== 'ALL'
    );
  }, [filterCategory, filterSubcategory, filterLocation, filterStatus]);

  // RF-07.2: Reiniciar filtros inmediatamente
  const handleClearFilters = () => {
    setFilterCategory('ALL');
    setFilterSubcategory('ALL');
    setFilterLocation('ALL');
    setFilterStatus('ALL');
    setCurrentPage(1);
  };

  // RF-07.1: Productos filtrados para el reporte (exclusivamente sobre la vista actual)
  const reportProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchCat = filterCategory === 'ALL' || prod.category_id === filterCategory;
      const matchSub = filterSubcategory === 'ALL' || prod.subcategory_id === filterSubcategory;
      const matchLoc = filterLocation === 'ALL' || prod.location_id === filterLocation;
      const matchStatus = filterStatus === 'ALL' || prod.status === filterStatus;
      return matchCat && matchSub && matchLoc && matchStatus;
    });
  }, [products, filterCategory, filterSubcategory, filterLocation, filterStatus]);

  // RNF-01: Datos paginados
  const totalPages = Math.ceil(reportProducts.length / pageSize) || 1;
  const paginatedReportProducts = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return reportProducts.slice(startIdx, startIdx + pageSize);
  }, [reportProducts, currentPage, pageSize]);

  // Cálculos de Resumen sobre los productos filtrados (RF-07.1)
  const totalUnits = reportProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalValuation = reportProducts.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);

  // 1. Exportar PDF exclusivamente sobre los productos filtrados (RF-07.1)
  const handleExportPDF = async () => {
    if (!currentInventory || reportProducts.length === 0) return;
    try {
      setIsExportingPDF(true);

      const doc = new jsPDF();
      const inventoryTitle = currentInventory.name || 'Reporte de Inventario';
      const currency = currentInventory.currency || 'USD';

      // Cabecera
      doc.setFontSize(16);
      doc.text(inventoryTitle, 14, 18);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 25);
      doc.text(`Ítems en reporte: ${reportProducts.length} productos | Stock total: ${totalUnits} uds`, 14, 31);
      doc.text(`Valorización estimada: ${formatCurrency(totalValuation, currency)}`, 14, 37);

      // Tabla de productos
      let y = 47;
      doc.setTextColor(30);
      doc.setFontSize(9);
      doc.text('Código', 14, y);
      doc.text('Producto', 45, y);
      doc.text('Ubicación', 110, y);
      doc.text('Precio', 145, y);
      doc.text('Stock', 165, y);
      doc.text('Subtotal', 180, y);

      doc.setDrawColor(200);
      doc.line(14, y + 2, 196, y + 2);
      y += 8;

      reportProducts.forEach((p) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }

        const subtotal = (p.price || 0) * (p.stock || 0);
        doc.text(p.code.slice(0, 14), 14, y);
        doc.text(p.name.slice(0, 32), 45, y);
        doc.text((p.locations?.name || '-').slice(0, 16), 110, y);
        doc.text(formatCurrency(p.price, currency), 145, y);
        doc.text(String(p.stock), 165, y);
        doc.text(formatCurrency(subtotal, currency), 180, y);

        y += 6;
      });

      doc.save(`reporte-${inventoryTitle.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);
    } catch (err: any) {
      alert('Error exportando PDF: ' + err.message);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 2. Exportar CSV / Excel exclusivamente sobre los productos filtrados (RF-07.1)
  const handleExportCSV = (filenamePrefix: string = 'inventario') => {
    try {
      setIsExportingCSV(true);
      const headers = ['Codigo', 'Producto', 'Categoria', 'Subcategoria', 'Ubicacion', 'Precio', 'Stock', 'ValorTotal', 'Estado'];
      const rows = reportProducts.map(p => [
        `"${p.code}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.categories?.name || 'General'}"`,
        `"${p.subcategories?.name || ''}"`,
        `"${p.locations?.name || ''}"`,
        Number(p.price || 0).toFixed(2),
        p.stock || 0,
        ((p.stock || 0) * (p.price || 0)).toFixed(2),
        `"${p.status}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenamePrefix}-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleExportExcel = () => {
    setIsExportingExcel(true);
    handleExportCSV('inventario-excel');
    setIsExportingExcel(false);
  };

  return (
    <div className="space-y-6 pb-28 sm:pb-12 max-w-7xl mx-auto font-normal text-[#1E3A5F]">
      {/* 1. Cabecera y Resumen de Exportación */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono tracking-widest text-[#E8B4A0] uppercase block">
              DATA EXPORT // INVENTORY CENSUS & AUDIT
            </span>
            <h1 className="text-xl sm:text-2xl font-light tracking-tight text-[#1E3A5F] uppercase">
              Reportes & Manifiestos de Stock
            </h1>
            <p className="text-xs text-[#616161] font-light mt-0.5">
              Generación y exportación de auditorías basadas estrictamente en la vista y filtros actuales.
            </p>
          </div>

          {/* Botones de Descarga */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF || reportProducts.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider rounded-full shadow-xs disabled:opacity-50 transition-all active:scale-95 font-medium"
            >
              {isExportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E8B4A0]" /> : <Download className="w-3.5 h-3.5 text-[#E8B4A0]" />}
              <span>PDF</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel || reportProducts.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F8F9FA] hover:bg-white text-[#1E3A5F] border border-[#E5E7EB] text-xs uppercase tracking-wider rounded-full shadow-xs disabled:opacity-50 transition-all active:scale-95 font-mono"
            >
              {isExportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              <span>Excel (.xlsx)</span>
            </button>

            <button
              onClick={() => handleExportCSV('reporte-inventario')}
              disabled={isExportingCSV || reportProducts.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F8F9FA] hover:bg-white text-[#1E3A5F] border border-[#E5E7EB] text-xs uppercase tracking-wider rounded-full shadow-xs disabled:opacity-50 transition-all active:scale-95 font-mono"
            >
              {isExportingCSV ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCode className="w-3.5 h-3.5" />}
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Tarjetas de Métricas del Reporte */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-[#E5E7EB]">
          <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#616161] block">
              Ítems Filtrados
            </span>
            <span className="text-xl font-light text-[#1E3A5F] font-mono mt-0.5 block">
              {reportProducts.length} ítems
            </span>
          </div>

          <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#616161] block">
              Total de Unidades
            </span>
            <span className="text-xl font-light text-[#1E3A5F] font-mono mt-0.5 block">
              {totalUnits} uds
            </span>
          </div>

          <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] col-span-2 sm:col-span-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#616161] block">
              Valorización Total
            </span>
            <span className="text-xl font-light text-[#1E3A5F] font-mono mt-0.5 block">
              {formatCurrency(totalValuation, currentInventory?.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filtros de Generación */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
          <span className="text-xs font-mono uppercase tracking-wider text-[#1E3A5F]">
            Parámetros de Segmentación
          </span>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F8F9FA] hover:bg-white text-[#1E3A5F] border border-[#E5E7EB] text-xs font-mono uppercase rounded-full transition-colors"
            >
              <RotateCcw className="w-3 h-3 text-[#E8B4A0]" /> Restablecer
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#616161] mb-1">Categoría</label>
            <select
              value={filterCategory}
              onChange={e => {
                setFilterCategory(e.target.value);
                setFilterSubcategory('ALL');
                setCurrentPage(1);
              }}
              className="w-full bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            >
              <option value="ALL">Todas las Categorías</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#616161] mb-1">Subcategoría</label>
            <select
              value={filterSubcategory}
              onChange={e => {
                setFilterSubcategory(e.target.value);
                setCurrentPage(1);
              }}
              disabled={filterCategory === 'ALL' || activeSubcategories.length === 0}
              className="w-full bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] disabled:opacity-50"
            >
              <option value="ALL">Todas las Subcategorías</option>
              {activeSubcategories.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#616161] mb-1">Ubicación Física</label>
            <select
              value={filterLocation}
              onChange={e => {
                setFilterLocation(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            >
              <option value="ALL">Todas las Ubicaciones</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#616161] mb-1">Estado de Existencia</label>
            <select
              value={filterStatus}
              onChange={e => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVE">Activos en Manifiesto</option>
              <option value="WITHDRAWN">Retirados / Baja</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Tabla Interactiva de Datos con RNF-01 Paginación */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-[#1E3A5F]">
            Previsualización del Manifiesto ({reportProducts.length} registros)
          </span>
          {hasActiveFilters && (
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E8B4A0]/40">
              Filtros activos
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F9FA] text-[#616161] font-mono text-[10px] uppercase tracking-wider border-b border-[#E5E7EB]">
                <th className="p-3.5 font-medium">CÓDIGO</th>
                <th className="p-3.5 font-medium">PRODUCTO</th>
                <th className="p-3.5 font-medium">CATEGORÍA</th>
                <th className="p-3.5 font-medium">UBICACIÓN</th>
                <th className="p-3.5 font-medium text-right">PRECIO</th>
                <th className="p-3.5 font-medium text-right">STOCK</th>
                <th className="p-3.5 font-medium text-right">VALOR TOTAL</th>
                <th className="p-3.5 font-medium text-center">ESTADO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {reportProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-[#616161] font-mono text-xs uppercase">
                    No hay productos que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedReportProducts.map(p => (
                  <tr key={p.id} className="hover:bg-[#F8F9FA]/60 transition-colors">
                    <td className="p-3.5 font-mono font-medium text-[#1E3A5F]">{p.code}</td>
                    <td className="p-3.5 font-normal text-[#1E3A5F] max-w-[220px] truncate uppercase">{p.name}</td>
                    <td className="p-3.5 text-[#616161]">{p.categories?.name || 'General'}</td>
                    <td className="p-3.5 text-[#616161]">{p.locations?.name || '-'}</td>
                    <td className="p-3.5 text-right text-[#1E3A5F] font-mono">
                      {formatCurrency(p.price, currentInventory?.currency)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-medium text-[#1E3A5F]">{p.stock}</td>
                    <td className="p-3.5 text-right font-mono font-medium text-[#1E3A5F]">
                      {formatCurrency((p.price || 0) * (p.stock || 0), currentInventory?.currency)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                        p.status === 'ACTIVE'
                          ? 'bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E8B4A0]/40'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {p.status === 'ACTIVE' ? 'Activo' : 'Baja'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* RNF-01: Controles de Paginación en Reportes */}
        {totalPages > 1 && (
          <div className="p-3.5 border-t border-[#E5E7EB] flex items-center justify-between text-xs font-mono text-[#616161]">
            <span>
              Página {currentPage} de {totalPages} ({reportProducts.length} productos)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-xl border border-[#E5E7EB] bg-white text-[#1E3A5F] hover:bg-[#F8F9FA] disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-xl border border-[#E5E7EB] bg-white text-[#1E3A5F] hover:bg-[#F8F9FA] disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
