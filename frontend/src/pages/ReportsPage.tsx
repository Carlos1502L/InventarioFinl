import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  FileSpreadsheet,
  FileCode,
  Filter,
  Package,
  MapPin,
  Tag,
  DollarSign,
  Loader2,
  Calendar
} from 'lucide-react';
import { Product, Category, Subcategory, Location } from '../types/database';
import { formatCurrency, API_BASE_URL } from '../lib/supabase';
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
  const { currentInventory, session } = useAuth();

  // Estados de Filtro del Reporte
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('ALL');
  const [filterLocation, setFilterLocation] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Estados de Descarga
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  // Subcategorías según la categoría seleccionada
  const activeSubcategories = useMemo(() => {
    if (filterCategory === 'ALL') return [];
    return subcategories.filter(s => s.category_id === filterCategory);
  }, [filterCategory, subcategories]);

  // Productos filtrados para el reporte
  const reportProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchCat = filterCategory === 'ALL' || prod.category_id === filterCategory;
      const matchSub = filterSubcategory === 'ALL' || prod.subcategory_id === filterSubcategory;
      const matchLoc = filterLocation === 'ALL' || prod.location_id === filterLocation;
      const matchStatus = filterStatus === 'ALL' || prod.status === filterStatus;
      return matchCat && matchSub && matchLoc && matchStatus;
    });
  }, [products, filterCategory, filterSubcategory, filterLocation, filterStatus]);

  // Cálculos de Resumen
  const totalUnits = reportProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalValuation = reportProducts.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);

  // 1. Exportar PDF (Intenta Backend Render, con fallback de jsPDF en el navegador)
  const handleExportPDF = async () => {
    if (!currentInventory) return;
    try {
      setIsExportingPDF(true);
      const token = session?.access_token;

      let downloadedFromBackend = false;
      if (token) {
        try {
          const query = new URLSearchParams({
            inventory_id: currentInventory.id,
            category_id: filterCategory !== 'ALL' ? filterCategory : '',
            location_id: filterLocation !== 'ALL' ? filterLocation : '',
            status: filterStatus !== 'ALL' ? filterStatus : ''
          });

          const res = await fetch(`${API_BASE_URL}/api/reports/pdf?${query.toString()}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte-inventario-${Date.now()}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
            downloadedFromBackend = true;
          }
        } catch {
          // Continuar al fallback de cliente
        }
      }

      // Fallback nativo en cliente usando jsPDF si el backend de Render aún no está conectado
      if (!downloadedFromBackend) {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(`REPORTE DE INVENTARIO - ${currentInventory.name.toUpperCase()}`, 14, 18);
        doc.setFontSize(10);
        doc.text(`Fecha: ${new Date().toLocaleString()} | Moneda: ${currentInventory.currency}`, 14, 25);
        doc.text(`Total Productos: ${reportProducts.length} | Unidades: ${totalUnits} | Valor Total: ${formatCurrency(totalValuation, currentInventory.currency)}`, 14, 32);

        let y = 42;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('CÓDIGO', 14, y);
        doc.text('PRODUCTO', 45, y);
        doc.text('UBICACIÓN', 115, y);
        doc.text('STOCK', 155, y);
        doc.text('PRECIO', 175, y);
        y += 6;
        doc.line(14, y - 2, 195, y - 2);

        doc.setFont('helvetica', 'normal');
        reportProducts.forEach((p) => {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(p.code.substring(0, 15), 14, y);
          doc.text(p.name.substring(0, 35), 45, y);
          doc.text((p.locations?.name || '-').substring(0, 20), 115, y);
          doc.text(String(p.stock), 155, y);
          doc.text(Number(p.price).toFixed(2), 175, y);
          y += 6;
        });

        doc.save(`reporte-inventario-${Date.now()}.pdf`);
      }
    } catch (err: any) {
      alert('Error exportando PDF: ' + err.message);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 2. Exportar Excel (.xlsx)
  const handleExportExcel = async () => {
    if (!currentInventory) return;
    try {
      setIsExportingExcel(true);
      const token = session?.access_token;

      let downloadedFromBackend = false;
      if (token) {
        try {
          const query = new URLSearchParams({
            inventory_id: currentInventory.id,
            category_id: filterCategory !== 'ALL' ? filterCategory : '',
            location_id: filterLocation !== 'ALL' ? filterLocation : '',
            status: filterStatus !== 'ALL' ? filterStatus : ''
          });

          const res = await fetch(`${API_BASE_URL}/api/reports/excel?${query.toString()}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte-inventario-${Date.now()}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
            downloadedFromBackend = true;
          }
        } catch {
          // Continuar a fallback
        }
      }

      // Si no hay backend, exportar CSV estructurado con extensión legible por Excel
      if (!downloadedFromBackend) {
        handleExportCSV();
      }
    } catch (err: any) {
      alert('Error exportando Excel: ' + err.message);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // 3. Exportar CSV
  const handleExportCSV = () => {
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
      a.download = `inventario-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExportingCSV(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* 1. Cabecera y Resumen Ejecutivo */}
      <div className="bg-slate-800/60 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-blue-400" /> Generador de Reportes de Inventario
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Filtra por almacén o categoría y exporta en formatos ejecutivos
            </p>
          </div>

          {/* Botones de Descarga */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF || reportProducts.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {isExportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              PDF
            </button>

            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel || reportProducts.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {isExportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              Excel (.xlsx)
            </button>

            <button
              onClick={handleExportCSV}
              disabled={isExportingCSV || reportProducts.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl border border-slate-600 disabled:opacity-50 transition-all active:scale-95"
            >
              {isExportingCSV ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCode className="w-3.5 h-3.5" />}
              CSV
            </button>
          </div>
        </div>

        {/* Tarjetas de Métricas del Reporte */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-700/60">
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-semibold block">Productos Seleccionados</span>
            <span className="text-lg font-extrabold text-white">{reportProducts.length} ítems</span>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-semibold block">Total de Unidades</span>
            <span className="text-lg font-extrabold text-blue-400">{totalUnits} uds</span>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-400 font-semibold block">Valorización Total</span>
            <span className="text-lg font-extrabold text-emerald-400">
              {formatCurrency(totalValuation, currentInventory?.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filtros de Generación */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filtrar por Categoría</label>
          <select
            value={filterCategory}
            onChange={e => {
              setFilterCategory(e.target.value);
              setFilterSubcategory('ALL');
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Todas las Categorías</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filtrar por Subcategoría</label>
          <select
            value={filterSubcategory}
            onChange={e => setFilterSubcategory(e.target.value)}
            disabled={filterCategory === 'ALL' || activeSubcategories.length === 0}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="ALL">Todas las Subcategorías</option>
            {activeSubcategories.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filtrar por Ubicación Física</label>
          <select
            value={filterLocation}
            onChange={e => setFilterLocation(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Todas las Ubicaciones</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filtrar por Estado</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="ACTIVE">Activos en Stock</option>
            <option value="WITHDRAWN">Retirados / Baja</option>
          </select>
        </div>
      </div>

      {/* 3. Tabla Interactiva de Datos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">
            Vista Previa de Datos del Reporte ({reportProducts.length} registros)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
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
            <tbody className="divide-y divide-slate-800">
              {reportProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No hay productos que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                reportProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-medium text-blue-400">{p.code}</td>
                    <td className="p-3 font-bold text-white max-w-[200px] truncate">{p.name}</td>
                    <td className="p-3 text-slate-300">{p.categories?.name || 'General'}</td>
                    <td className="p-3 text-slate-300">{p.locations?.name || '-'}</td>
                    <td className="p-3 text-right text-slate-200">
                      {formatCurrency(p.price, currentInventory?.currency)}
                    </td>
                    <td className="p-3 text-right font-bold text-white">{p.stock}</td>
                    <td className="p-3 text-right font-bold text-emerald-400">
                      {formatCurrency((p.price || 0) * (p.stock || 0), currentInventory?.currency)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
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
      </div>
    </div>
  );
};
