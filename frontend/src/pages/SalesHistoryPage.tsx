import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  History,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  DollarSign,
  TrendingUp,
  Receipt,
  User,
  X,
  Loader2,
  ChevronRight,
  CreditCard,
  QrCode
} from 'lucide-react';
import { Sale, SaleItem } from '../types/database';
import { supabase, formatCurrency, formatDate } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';

export const SalesHistoryPage: React.FC = () => {
  const { currentInventory } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Filtros de fecha
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const loadSales = useCallback(async () => {
    if (!currentInventory) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          items:sale_items(*)
        `)
        .eq('inventory_id', currentInventory.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (err: any) {
      console.error('Error cargando historial de ventas:', err);
    } finally {
      setLoading(false);
    }
  }, [currentInventory]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Inicializar fechas inteligentes
  useEffect(() => {
    if (!startDate && sales.length > 0) {
      const sorted = [...sales].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setStartDate(sorted[0].created_at.split('T')[0]);
    }
    if (!endDate) {
      setEndDate(todayStr);
    }
  }, [sales, startDate, endDate, todayStr]);

  // Filtrado reactivo por fecha y búsqueda
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const saleDate = sale.created_at.split('T')[0];
      if (startDate && saleDate < startDate) return false;
      if (endDate && saleDate > endDate) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchId = sale.id.toLowerCase().includes(term);
        const matchCustomer = (sale.customer_name || '').toLowerCase().includes(term);
        const matchSeller = sale.seller_email.toLowerCase().includes(term);
        const matchPayment = sale.payment_method.toLowerCase().includes(term);
        return matchId || matchCustomer || matchSeller || matchPayment;
      }

      return true;
    });
  }, [sales, startDate, endDate, searchTerm]);

  // KPIs
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  }, [filteredSales]);

  const totalUnitsSold = useMemo(() => {
    return filteredSales.reduce((sum, s) => {
      const itemsCount = s.items?.reduce((iSum, item) => iSum + (item.quantity || 0), 0) || 0;
      return sum + itemsCount;
    }, 0);
  }, [filteredSales]);

  // Exportar CSV
  const handleExportCSV = () => {
    try {
      const headers = ['ID_Venta', 'Fecha', 'Vendedor', 'Cliente', 'MetodoPago', 'Total', 'Notas'];
      const rows = filteredSales.map(s => [
        `"${s.id.slice(0, 8)}"`,
        `"${new Date(s.created_at).toLocaleString()}"`,
        `"${s.seller_email}"`,
        `"${(s.customer_name || 'Consumidor Final').replace(/"/g, '""')}"`,
        `"${s.payment_method}"`,
        Number(s.total_amount).toFixed(2),
        `"${(s.notes || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historial-ventas-${startDate || 'inicio'}-al-${endDate || 'fin'}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Error exportando CSV: ' + err.message);
    }
  };

  // Exportar PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const inventoryName = currentInventory?.name || 'Inventario';
      const currency = currentInventory?.currency || 'USD';

      doc.setFontSize(16);
      doc.text(`Reporte Histórico de Ventas - ${inventoryName}`, 14, 18);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Rango: ${startDate || 'Inicio'} al ${endDate || 'Hoy'}`, 14, 25);
      doc.text(`Ventas registradas: ${filteredSales.length} | Unidades vendidas: ${totalUnitsSold} uds`, 14, 31);
      doc.text(`Recaudación Total: ${formatCurrency(totalRevenue, currency)}`, 14, 37);

      let y = 47;
      doc.setTextColor(30);
      doc.setFontSize(9);
      doc.text('Ticket', 14, y);
      doc.text('Fecha', 40, y);
      doc.text('Cliente', 80, y);
      doc.text('Método', 130, y);
      doc.text('Total', 170, y);

      doc.setDrawColor(200);
      doc.line(14, y + 2, 196, y + 2);
      y += 8;

      filteredSales.forEach((s) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }

        doc.text(s.id.slice(0, 8), 14, y);
        doc.text(new Date(s.created_at).toLocaleDateString(), 40, y);
        doc.text((s.customer_name || 'Consumidor Final').slice(0, 24), 80, y);
        doc.text(s.payment_method, 130, y);
        doc.text(formatCurrency(s.total_amount, currency), 170, y);

        y += 6;
      });

      doc.save(`ventas-${startDate}-al-${endDate}.pdf`);
    } catch (err: any) {
      alert('Error exportando PDF: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 pb-28 sm:pb-12 max-w-7xl mx-auto">
      {/* 1. Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <History className="w-6 h-6 text-blue-600" /> Historial y Exportación de Ventas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Consulta, auditoría de transacciones y descarga de comprobantes y reportes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={filteredSales.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={filteredSales.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-600/20 dark:hover:bg-rose-600/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
          >
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* 2. KPIs y Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-500" /> Recaudación Total
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalRevenue, currentInventory?.currency)}
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Receipt className="w-4 h-4 text-blue-500" /> Ventas Concretadas
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {filteredSales.length} <span className="text-xs font-normal text-slate-500">tickets</span>
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-500" /> Unidades Vendidas
          </div>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
            {totalUnitsSold} <span className="text-xs font-normal text-slate-500">uds</span>
          </p>
        </div>
      </div>

      {/* 3. Filtros de Fecha y Búsqueda */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Búsqueda por Ticket / Cliente / Vendedor */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por ticket, cliente, correo o método..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          {/* Rango de Fechas */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 text-xs focus:outline-none"
              />
              <span className="text-slate-400">a</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 text-xs focus:outline-none"
              />
            </div>
            {(startDate || endDate !== todayStr || searchTerm) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate(todayStr);
                  setSearchTerm('');
                }}
                className="text-xs text-blue-600 hover:underline px-2"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Tabla de Ventas */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            Cargando historial de transacciones...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 space-y-1">
            <Receipt className="w-10 h-10 mx-auto stroke-1 text-slate-300 dark:text-slate-700 mb-2" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">No se encontraron ventas registradas</p>
            <p>Las ventas confirmadas en el Punto de Venta aparecerán aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Ticket</th>
                  <th className="p-3.5">Fecha</th>
                  <th className="p-3.5">Cliente</th>
                  <th className="p-3.5">Método</th>
                  <th className="p-3.5">Vendedor</th>
                  <th className="p-3.5 text-right">Total</th>
                  <th className="p-3.5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSales.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedSale(s)}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                      #{s.id.slice(0, 8)}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">
                      {formatDate(s.created_at)}
                    </td>
                    <td className="p-3.5 font-medium text-slate-900 dark:text-white">
                      {s.customer_name || 'Consumidor Final'}
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.payment_method === 'YAPE'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300'
                          : s.payment_method === 'PLIN'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      }`}>
                        {s.payment_method}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500 truncate max-w-[160px]">
                      {s.seller_email}
                    </td>
                    <td className="p-3.5 text-right font-extrabold text-slate-900 dark:text-white">
                      {formatCurrency(s.total_amount, currentInventory?.currency)}
                    </td>
                    <td className="p-3.5 text-center">
                      <button className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalle de Venta */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Ticket #{selectedSale.id.slice(0, 8)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Fecha:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{new Date(selectedSale.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Método:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{selectedSale.payment_method}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Cliente:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedSale.customer_name || 'Consumidor Final'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Contacto:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedSale.customer_contact || 'Sin registrar'}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-bold">Vendedor:</span>
                  <span className="text-slate-600 dark:text-slate-400">{selectedSale.seller_email}</span>
                </div>
                {selectedSale.notes && (
                  <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block font-bold">Notas / Cupón:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{selectedSale.notes}</span>
                  </div>
                )}
              </div>

              {/* Ítems vendidos */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Ítems Vendidos ({selectedSale.items?.length || 0})
                </span>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  {selectedSale.items?.map((it) => (
                    <div key={it.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{it.product_name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {it.product_code} • {it.quantity} uds × {formatCurrency(it.unit_price, currentInventory?.currency)}
                        </p>
                      </div>
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {formatCurrency(it.subtotal, currentInventory?.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total final */}
              <div className="flex items-center justify-between p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">TOTAL COBRADO:</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(selectedSale.total_amount, currentInventory?.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
