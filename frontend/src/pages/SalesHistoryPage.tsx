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
  QrCode,
  ArrowUpRight,
  ShoppingCart
} from 'lucide-react';
import { Sale, SaleItem } from '../types/database';
import { supabase, formatCurrency, formatDate } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';

interface SalesHistoryPageProps {
  onNavigateToSales?: () => void;
}

export const SalesHistoryPage: React.FC<SalesHistoryPageProps> = ({ onNavigateToSales }) => {
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
    <>
      {/* =========================================================
          VISTA MÓVIL ULTRA MINIMALISTA (< 768px / md:hidden)
         ========================================================= */}
      <div className="md:hidden fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col overflow-hidden bg-white text-neutral-900">
        
        {/* CAPA 1: Header Oscuro Principal (Fijo / shrink-0) */}
        <header className="shrink-0 bg-neutral-950 text-white rounded-b-[2.5rem] z-20 select-none px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Historial de Ventas
            </h1>

            <div className="flex items-center gap-2 flex-shrink-0">
              {onNavigateToSales && (
                <button
                  type="button"
                  onClick={onNavigateToSales}
                  aria-label="Volver al Punto de Venta"
                  className="h-10 px-3.5 rounded-full bg-neutral-800/70 hover:bg-neutral-800 text-neutral-200 flex items-center gap-1.5 text-xs font-medium transition-colors active:scale-95"
                >
                  <ShoppingCart className="w-3.5 h-3.5 stroke-[1.75]" />
                  <span>Cobrar</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={filteredSales.length === 0}
                aria-label="Exportar PDF"
                className="w-10 h-10 rounded-full bg-neutral-800/70 hover:bg-neutral-800 text-neutral-200 flex items-center justify-center transition-colors active:scale-95 disabled:opacity-40"
              >
                <Download className="w-4 h-4 stroke-[1.75]" />
              </button>
            </div>
          </div>

          {/* Total recaudado y cantidad de tickets */}
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <span className="text-xs text-neutral-400 block">
                Total recaudado
              </span>
              <p className="text-4xl font-semibold tracking-tight text-white tabular-nums mt-1">
                {formatCurrency(totalRevenue, currentInventory?.currency)}
              </p>
            </div>

            <span className="inline-flex items-center px-3 py-1 rounded-full bg-neutral-800/80 text-neutral-300 text-xs font-medium tabular-nums">
              {filteredSales.length} {filteredSales.length === 1 ? 'ticket' : 'tickets'}
            </span>
          </div>
        </header>

        {/* CAPA 2: Contenedor Blanco Global (flex-1 flex flex-col overflow-hidden) */}
        <section className="flex-1 min-h-0 w-full bg-white flex flex-col overflow-hidden">
          
          {/* SUB-CAPA 2A: Barra Fija de Herramientas (NUNCA SE MUEVE NI HACE SCROLL) */}
          <div className="shrink-0 w-full bg-white px-5 pt-4 pb-2.5 space-y-3">
            {/* Buscador plano */}
            <div className="flex items-center gap-3 bg-neutral-50 border border-neutral-200/60 rounded-2xl px-4 py-3.5 focus-within:border-neutral-950 focus-within:bg-white transition-all">
              <Search className="w-5 h-5 text-neutral-400 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por ticket, cliente o método..."
                className="w-full bg-transparent border-0 outline-none ring-0 p-0 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-xs text-neutral-400 hover:text-neutral-900"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtro/rango de fechas en píldoras simples */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setStartDate(todayStr);
                  setEndDate(todayStr);
                }}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  startDate === todayStr && endDate === todayStr
                    ? 'bg-neutral-950 text-white'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 7);
                  setStartDate(d.toISOString().split('T')[0]);
                  setEndDate(todayStr);
                }}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  startDate !== '' && startDate !== todayStr
                    ? 'bg-neutral-950 text-white'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                Últimos 7 días
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate(todayStr);
                }}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  startDate === ''
                    ? 'bg-neutral-950 text-white'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                Todo el historial
              </button>
            </div>
          </div>

          {/* SUB-CAPA 2B: Contenedor de Datos con Scroll Aislado */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 divide-y divide-neutral-100 pb-28">
            {loading ? (
              <p className="py-10 text-center text-xs text-neutral-400">
                Cargando transacciones...
              </p>
            ) : filteredSales.length === 0 ? (
              <p className="py-10 text-center text-xs text-neutral-400">
                No se encontraron ventas en este periodo.
              </p>
            ) : (
              filteredSales.map((s) => {
                const firstItem = (s.items?.[0]?.product_name || 'VENTA').toUpperCase();
                const productTitle =
                  s.items && s.items.length > 1
                    ? `${firstItem} (+${s.items.length - 1})`
                    : firstItem;
                const timeStr = new Date(s.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSale(s)}
                    className="py-4 flex items-center justify-between gap-3 cursor-pointer active:opacity-70 transition-opacity"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center flex-shrink-0">
                        <ArrowUpRight className="w-3.5 h-3.5 stroke-[1.75]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate">
                          {productTitle}
                        </p>
                        <p className="text-xs text-neutral-400 truncate mt-0.5">
                          #{s.id.slice(0, 6).toUpperCase()} · {timeStr} // {(s.payment_method || 'EFECTIVO').toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-semibold text-neutral-900 tabular-nums">
                        {formatCurrency(s.total_amount, currentInventory?.currency)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* =========================================================
          VISTA DE ESCRITORIO (>= 768px / hidden md:block)
         ========================================================= */}
      <div className="hidden md:block space-y-6 pb-28 sm:pb-12 max-w-7xl mx-auto font-normal text-[#1E3A5F]">
      {/* 1. Cabecera Editorial */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#E8B4A0] uppercase block">
            TRANSACTIONS AUDIT // HISTORY & EXPORT
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E3A5F] uppercase">
            Historial de Ventas & Manifiestos
          </h1>
          <p className="text-xs text-[#616161] font-light mt-0.5">
            Consulta, auditoría de transacciones y exportación oficial de comprobantes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={filteredSales.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#F8F9FA] hover:bg-white text-[#1E3A5F] border border-[#E5E7EB] text-xs uppercase tracking-wider rounded-full transition-all disabled:opacity-50 shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#1E3A5F]" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            disabled={filteredSales.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider rounded-full transition-all disabled:opacity-50 shadow-xs"
          >
            <FileText className="w-3.5 h-3.5 text-[#E8B4A0]" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* 2. KPIs y Métricas Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[#616161] mb-1">
            <DollarSign className="w-3.5 h-3.5 text-[#E8B4A0]" /> Recaudación Total
          </div>
          <p className="text-2xl font-bold text-[#1E3A5F] font-mono">
            {formatCurrency(totalRevenue, currentInventory?.currency)}
          </p>
        </div>

        <div className="p-5 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[#616161] mb-1">
            <Receipt className="w-3.5 h-3.5 text-[#E8B4A0]" /> Ventas Concretadas
          </div>
          <p className="text-2xl font-bold text-[#1E3A5F] font-mono">
            {filteredSales.length} <span className="text-xs text-[#616161] font-sans font-normal">tickets</span>
          </p>
        </div>

        <div className="p-5 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[#616161] mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#E8B4A0]" /> Unidades Despachadas
          </div>
          <p className="text-2xl font-bold text-[#1E3A5F] font-mono">
            {totalUnitsSold} <span className="text-xs text-[#616161] font-sans font-normal">uds</span>
          </p>
        </div>
      </div>

      {/* 3. Filtros de Fecha y Búsqueda */}
      <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Búsqueda por Ticket / Cliente / Vendedor */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#616161] absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por ticket, cliente, correo o método..."
              className="w-full bg-[#ffffff] border border-[#E5E7EB] rounded-xl pl-9 pr-3.5 py-2 text-xs text-[#1E3A5F] placeholder:text-[#616161]/50 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            />
          </div>

          {/* Rango de Fechas */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-xs text-[#1E3A5F]">
              <Calendar className="w-3.5 h-3.5 text-[#616161]" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent text-[#1E3A5F] text-xs focus:outline-none"
              />
              <span className="text-[#616161]">a</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent text-[#1E3A5F] text-xs focus:outline-none"
              />
            </div>
            {(startDate || endDate !== todayStr || searchTerm) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate(todayStr);
                  setSearchTerm('');
                }}
                className="text-xs text-[#616161] hover:text-[#1E3A5F] uppercase font-mono px-2 transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Tabla de Ventas */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-[#616161] font-mono">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1E3A5F]" />
            Cargando historial de transacciones...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#616161] space-y-1 font-mono">
            <Receipt className="w-10 h-10 mx-auto stroke-1 text-[#1E3A5F]/20 mb-2" />
            <p className="uppercase text-[#1E3A5F]">No se encontraron ventas registradas</p>
            <p className="text-[11px] text-[#616161]/70 font-sans">Las operaciones liquidadas en el Punto de Venta aparecerán aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[#1E3A5F] font-bold uppercase tracking-wider text-[10px] font-mono border-b border-[#E5E7EB]">
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
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredSales.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedSale(s)}
                    className="hover:bg-[#F8F9FA]/60 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 font-mono font-bold text-[#1E3A5F]">
                      #{s.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="p-3.5 text-[#616161] font-mono text-[11px] font-medium">
                      {formatDate(s.created_at)}
                    </td>
                    <td className="p-3.5 font-semibold text-[#1E3A5F] uppercase">
                      {s.customer_name || 'Consumidor Final'}
                    </td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E8B4A0]/50">
                        {s.payment_method}
                      </span>
                    </td>
                    <td className="p-3.5 text-[#616161] truncate max-w-[160px] font-mono text-[11px]">
                      {s.seller_email}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-[#1E3A5F]">
                      {formatCurrency(s.total_amount, currentInventory?.currency)}
                    </td>
                    <td className="p-3.5 text-center">
                      <button className="p-1 text-[#616161] hover:text-[#1E3A5F] transition-colors">
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
      </div>

      {/* Modal de Detalle de Venta */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="mobile-dark-modal bg-white border border-[#E5E7EB] rounded-2xl w-full max-w-lg overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB] bg-white">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#E8B4A0]" />
                <h3 className="font-bold text-[#1E3A5F] uppercase tracking-tight text-sm">
                  Ticket #{selectedSale.id.slice(0, 8).toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="w-8 h-8 rounded-full border border-[#E5E7EB] text-[#616161] hover:text-[#1E3A5F] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="mobile-flat-section grid grid-cols-2 gap-2 p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] text-xs font-mono">
                <div>
                  <span className="text-[10px] text-[#616161] block uppercase">Fecha:</span>
                  <span className="text-[#1E3A5F]">{new Date(selectedSale.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#616161] block uppercase">Método:</span>
                  <span className="text-[#1E3A5F] font-medium">{selectedSale.payment_method}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#616161] block uppercase">Cliente:</span>
                  <span className="text-[#1E3A5F]">{selectedSale.customer_name || 'Consumidor Final'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#616161] block uppercase">Contacto:</span>
                  <span className="text-[#1E3A5F]">{selectedSale.customer_contact || 'Sin registrar'}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-[#E5E7EB]">
                  <span className="text-[10px] text-[#616161] block uppercase">Vendedor:</span>
                  <span className="text-[#1E3A5F]">{selectedSale.seller_email}</span>
                </div>
                {selectedSale.notes && (
                  <div className="col-span-2 pt-2 border-t border-[#E5E7EB]">
                    <span className="text-[10px] text-[#616161] block uppercase">Notas / Cupón:</span>
                    <span className="text-[#1E3A5F]">{selectedSale.notes}</span>
                  </div>
                )}
              </div>

              {/* Ítems vendidos */}
              <div className="space-y-2">
                <span className="text-[11px] uppercase font-mono tracking-wider text-[#616161] block">
                  Ítems Vendidos ({selectedSale.items?.length || 0})
                </span>
                <div className="mobile-flat-section divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-xl overflow-hidden">
                  {selectedSale.items?.map((it) => {
                    const hasFormattedBreakdown = (it.product_name || '').includes('·');
                    return (
                      <div key={it.id} className="mobile-flat-row p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-[#1E3A5F] uppercase">{it.product_name}</p>
                          <p className="text-[10px] text-[#616161] font-mono mt-0.5">
                            <span className="font-semibold">{it.product_code}</span>
                            {hasFormattedBreakdown
                              ? ` • P. Unit: ${formatCurrency(it.unit_price, currentInventory?.currency)}`
                              : ` • ${it.quantity} uds × ${formatCurrency(it.unit_price, currentInventory?.currency)}`}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-[#1E3A5F]">
                          {formatCurrency(it.subtotal, currentInventory?.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total final */}
              <div className="mobile-flat-row flex items-center justify-between p-4 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl font-mono">
                <span className="text-xs uppercase tracking-wider text-[#616161] font-bold">TOTAL LIQUIDADO:</span>
                <span className="text-lg font-bold text-[#1E3A5F]">
                  {formatCurrency(selectedSale.total_amount, currentInventory?.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
