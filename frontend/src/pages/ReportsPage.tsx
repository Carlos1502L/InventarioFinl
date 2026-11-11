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
import { MinimalDropdown } from '../components/ui/MinimalDropdown';

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

      const { default: jsPDF } = await import('jspdf');
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
    <div className="space-y-5 pb-28 sm:pb-12 max-w-[1440px] mx-auto font-sans text-slate-900">
      {/* 1. Cabecera y Exportación */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-slate-900">
            Reportes y manifiestos
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Exportación de inventarios basada en los parámetros y filtros aplicados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel || reportProducts.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 min-h-[38px] bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 text-xs font-medium rounded-xl disabled:opacity-45 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer"
          >
            {isExportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            <span>Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => handleExportCSV('reporte-inventario')}
            disabled={isExportingCSV || reportProducts.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 min-h-[38px] bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 text-xs font-medium rounded-xl disabled:opacity-45 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer"
          >
            {isExportingCSV ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCode className="w-3.5 h-3.5" />}
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || reportProducts.length === 0}
            className="inline-flex items-center gap-1.5 px-4 min-h-[38px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl disabled:opacity-45 transition-[background-color,transform] duration-150 active:scale-[0.97] cursor-pointer"
          >
            {isExportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* 1B. Resumen Métricas del Reporte */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-ui-card">
          <span className="text-xs font-medium text-slate-500 block">
            Ítems filtrados
          </span>
          <span className="text-2xl font-semibold tabular-nums text-slate-900 mt-1 block">
            {reportProducts.length} <span className="text-xs font-normal text-slate-500">ítems</span>
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-ui-card">
          <span className="text-xs font-medium text-slate-500 block">
            Total unidades
          </span>
          <span className="text-2xl font-semibold tabular-nums text-slate-900 mt-1 block">
            {totalUnits} <span className="text-xs font-normal text-slate-500">und</span>
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-ui-card">
          <span className="text-xs font-medium text-slate-500 block">
            Valorización del reporte
          </span>
          <span className="text-2xl font-semibold tabular-nums text-slate-900 mt-1 block truncate">
            {formatCurrency(totalValuation, currentInventory?.currency)}
          </span>
        </div>
      </div>

      {/* 2. Filtros de Segmentación */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-ui-card">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
          <span className="text-sm font-semibold text-slate-900">
            Parámetros de segmentación
          </span>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200/70 text-slate-800 border border-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Restablecer
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Categoría</label>
            <MinimalDropdown
              value={filterCategory}
              onChange={(val) => {
                setFilterCategory(val);
                setFilterSubcategory('ALL');
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Todas las Categorías' },
                ...categories.map((c) => ({ value: c.id, label: c.name }))
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Subcategoría</label>
            <MinimalDropdown
              value={filterSubcategory}
              onChange={(val) => {
                setFilterSubcategory(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Todas las Subcategorías' },
                ...activeSubcategories.map((s) => ({ value: s.id, label: s.name }))
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Ubicación física</label>
            <MinimalDropdown
              value={filterLocation}
              onChange={(val) => {
                setFilterLocation(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Todas las Ubicaciones' },
                ...locations.map((l) => ({ value: l.id, label: l.name, badge: l.code }))
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Estado de existencia</label>
            <MinimalDropdown
              value={filterStatus}
              onChange={(val) => {
                setFilterStatus(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Todos los Estados' },
                { value: 'ACTIVE', label: 'Activos en Manifiesto' },
                { value: 'WITHDRAWN', label: 'Retirados / Baja' }
              ]}
            />
            {false && (/*
            <select
              value={filterCategory}
              onChange={e => {
                setFilterCategory(e.target.value);
                setFilterSubcategory('ALL');
                setCurrentPage(1);
              }}
              className="w-full bg-[#ffffff] border border-[#ececec] rounded-xl px-3 py-2 text-xs text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
            >
              <option value="ALL">Todas las Categorías</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}

          </div>

          <div>
            <label className="block text-[10px]   tracking-wider text-[#777b86] mb-1">Subcategoría</label>
            <select
              value={filterSubcategory}
              onChange={e => {
                setFilterSubcategory(e.target.value);
                setCurrentPage(1);
              }}
              disabled={filterCategory === 'ALL' || activeSubcategories.length === 0}
              className="w-full bg-[#ffffff] border border-[#ececec] rounded-xl px-3 py-2 text-xs text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c] disabled:opacity-50"
            >
              <option value="ALL">Todas las Subcategorías</option>
              {activeSubcategories.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}

          </div>

          <div>
            <label className="block text-[10px]   tracking-wider text-[#777b86] mb-1">Ubicación Física</label>
            <select
              value={filterLocation}
              onChange={e => {
                setFilterLocation(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#ffffff] border border-[#ececec] rounded-xl px-3 py-2 text-xs text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
            >
              <option value="ALL">Todas las Ubicaciones</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}

          </div>

          <div>
            <label className="block text-[10px]   tracking-wider text-[#777b86] mb-1">Estado de Existencia</label>
            <select
              value={filterStatus}
              onChange={e => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#ffffff] border border-[#ececec] rounded-xl px-3 py-2 text-xs text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVE">Activos en Manifiesto</option>
              <option value="WITHDRAWN">Retirados / Baja</option>
            */ null)}

          </div>
        </div>
      </div>

      {/* 3. Tabla Interactiva de Datos con Paginación */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-ui-card">
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <span className="text-sm font-semibold text-slate-900">
            Previsualización del manifiesto <span className="font-mono text-xs text-slate-500 font-normal ml-1 tabular-nums">({reportProducts.length})</span>
          </span>
          {hasActiveFilters && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              Filtros activos
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] font-semibold border-b border-slate-200">
                <th className="p-3.5">SKU</th>
                <th className="p-3.5">Producto</th>
                <th className="p-3.5">Categoría</th>
                <th className="p-3.5">Ubicación</th>
                <th className="p-3.5 text-right">Precio</th>
                <th className="p-3.5 text-right">Stock</th>
                <th className="p-3.5 text-right">Valor total</th>
                <th className="p-3.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 text-xs">
                    No hay productos que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedReportProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors duration-150">
                    <td className="p-3.5 font-mono font-medium text-slate-900 whitespace-nowrap">{p.code}</td>
                    <td title={p.name} className="p-3.5 font-semibold text-slate-900 max-w-[220px] truncate">{p.name}</td>
                    <td className="p-3.5 text-slate-600">{p.categories?.name || 'General'}</td>
                    <td className="p-3.5 text-slate-600">{p.locations?.name || '—'}</td>
                    <td className="p-3.5 text-right text-slate-900 font-semibold tabular-nums">
                      {formatCurrency(p.price, currentInventory?.currency)}
                    </td>
                    <td className="p-3.5 text-right font-semibold tabular-nums text-slate-900">{p.stock}</td>
                    <td className="p-3.5 text-right font-semibold tabular-nums text-slate-900">
                      {formatCurrency((p.price || 0) * (p.stock || 0), currentInventory?.currency)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                        p.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
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
          <div className="p-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 tabular-nums">
            <span>
              Página <strong className="text-slate-900 font-semibold">{currentPage}</strong> de {totalPages} ({reportProducts.length} productos)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
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

export default ReportsPage;
