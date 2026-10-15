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
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* 1. Cabecera y Resumen Ejecutivo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Generador de Reportes de Inventario
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Los reportes se generan estrictamente sobre los productos filtrados en la vista actual.
            </p>
          </div>

          {/* Botones de Descarga */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF || reportProducts.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-rose-500/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {isExportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              PDF
            </button>

            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel || reportProducts.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {isExportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              Excel (.xlsx / .csv)
            </button>

            <button
              onClick={() => handleExportCSV('reporte-inventario')}
              disabled={isExportingCSV || reportProducts.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-50 transition-all active:scale-95"
            >
              {isExportingCSV ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCode className="w-3.5 h-3.5" />}
              CSV
            </button>
          </div>
        </div>

        {/* Tarjetas de Métricas del Reporte */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-750">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block">Productos Seleccionados</span>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white">{reportProducts.length} ítems</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-750">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block">Total de Unidades</span>
            <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">{totalUnits} uds</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-750 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block">Valorización Total</span>
            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalValuation, currentInventory?.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filtros de Generación */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Filtros de Reporte</span>
          {/* RF-07.2: Botón Limpiar Filtros */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Limpiar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Filtrar por Categoría</label>
            <select
              value={filterCategory}
              onChange={e => {
                setFilterCategory(e.target.value);
                setFilterSubcategory('ALL');
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Todas las Categorías</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Filtrar por Subcategoría</label>
            <select
              value={filterSubcategory}
              onChange={e => {
                setFilterSubcategory(e.target.value);
                setCurrentPage(1);
              }}
              disabled={filterCategory === 'ALL' || activeSubcategories.length === 0}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="ALL">Todas las Subcategorías</option>
              {activeSubcategories.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Filtrar por Ubicación Física</label>
            <select
              value={filterLocation}
              onChange={e => {
                setFilterLocation(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Todas las Ubicaciones</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Filtrar por Estado</label>
            <select
              value={filterStatus}
              onChange={e => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVE">Activos en Stock</option>
              <option value="WITHDRAWN">Retirados / Baja</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Tabla Interactiva de Datos con RNF-01 Paginación */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Vista Previa del Reporte ({reportProducts.length} productos filtrados)
          </span>
          {hasActiveFilters && (
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
              Filtros activos
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <th className="p-3 font-semibold">CÓDIGO</th>
                <th className="p-3 font-semibold">PRODUCTO</th>
                <th className="p-3 font-semibold">CATEGORÍA</th>
                <th className="p-3 font-semibold">UBICACIÓN</th>
                <th className="p-3 font-semibold text-right">PRECIO</th>
                <th className="p-3 font-semibold text-right">STOCK</th>
                <th className="p-3 font-semibold text-right">VALOR TOTAL</th>
                <th className="p-3 font-semibold text-center">ESTADO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reportProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No hay productos que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedReportProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-medium text-blue-600 dark:text-blue-400">{p.code}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white max-w-[200px] truncate">{p.name}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{p.categories?.name || 'General'}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{p.locations?.name || '-'}</td>
                    <td className="p-3 text-right text-slate-700 dark:text-slate-200">
                      {formatCurrency(p.price, currentInventory?.currency)}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{p.stock}</td>
                    <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency((p.price || 0) * (p.stock || 0), currentInventory?.currency)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.status === 'ACTIVE'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                          : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
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
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Página {currentPage} de {totalPages} ({reportProducts.length} productos)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
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
