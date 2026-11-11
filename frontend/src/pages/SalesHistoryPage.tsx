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
import { matchesAnyField, normalizeText } from '../utils/searchUtils';
import { getAllQueuedSales, formatStockShortageNotes } from '../services/offlineSync';
import jsPDF from 'jspdf';
import { SalesHistorySkeleton } from '../components/ui/Skeleton';

/**
 * RN-HIST-02: Determina si una venta fue rechazada por falta de stock.
 * Se evalúa tanto por la columna status como por la marca semántica [RECHAZADA_STOCK].
 */
import { isSaleRejected } from '../lib/supabase';
export { isSaleRejected };

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
      const remoteSales: Sale[] = data || [];

      // RN-HIST-01: Fusionar ventas diferidas de la cola local de IndexedDB
      try {
        const localQueued = await getAllQueuedSales();
        const relevantFailed = localQueued.filter(
          (ls) => ls.payload.p_inventory_id === currentInventory.id && ls.status === 'FAILED_STOCK'
        );

        for (const ls of relevantFailed) {
          const alreadyPresent = remoteSales.some(
            (rs) =>
              (ls.local_id !== undefined && rs.notes?.includes(`local-queue-${ls.local_id}`)) ||
              (rs.created_at === ls.created_at && Number(rs.total_amount) === Number(ls.payload.p_total_amount))
          );

          if (!alreadyPresent) {
            remoteSales.push({
              id: `offline-rejected-${ls.local_id || Date.now()}`,
              inventory_id: ls.payload.p_inventory_id,
              seller_id: ls.payload.p_seller_id || null,
              seller_email: ls.payload.p_seller_email || 'offline@pos',
              total_amount: ls.payload.p_total_amount,
              payment_method: (ls.payload.p_payment_method as any) || 'CASH',
              customer_name: ls.payload.p_customer_name || null,
              customer_contact: ls.payload.p_customer_contact || null,
              notes: `[RECHAZADA_STOCK] ${formatStockShortageNotes(ls.error_message || 'Sin stock disponible', ls.payload.p_items)}`,
              status: 'REJECTED_STOCK',
              created_at: ls.created_at,
              items: (ls.payload.p_items || []).map((it: any, idx: number) => ({
                id: `local-item-${ls.local_id}-${idx}`,
                sale_id: `offline-rejected-${ls.local_id}`,
                product_id: it.product_id,
                product_name: it.product_name || 'Producto',
                product_code: it.product_code || 'S/C',
                quantity: it.quantity,
                unit_price: it.unit_price,
                cost_price: it.cost_price || 0,
                subtotal: it.subtotal,
                created_at: ls.created_at
              }))
            });
          }
        }

        remoteSales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } catch (mergeErr) {
        console.warn('[SalesHistory] Error fusionando ventas rechazadas locales:', mergeErr);
      }

      setSales(remoteSales);
    } catch (err: any) {
      console.error('Error cargando historial de ventas:', err);
    } finally {
      setLoading(false);
    }
  }, [currentInventory]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Sincronización reactiva en tiempo real al recibirse evento de conciliación
  useEffect(() => {
    const handleSalesUpdate = () => {
      loadSales();
    };
    window.addEventListener('stockly_sales_data_updated', handleSalesUpdate);
    return () => {
      window.removeEventListener('stockly_sales_data_updated', handleSalesUpdate);
    };
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

      const normTerm = normalizeText(searchTerm);
      if (normTerm) {
        return matchesAnyField(
          [sale.id, sale.customer_name, sale.seller_email, sale.payment_method],
          normTerm
        );
      }

      return true;
    });
  }, [sales, startDate, endDate, searchTerm]);

  // RN-HIST-03: Las ventas rechazadas (rojas) se omiten del cálculo de recaudación y unidades (+0.00)
  const totalRevenue = useMemo(() => {
    return filteredSales
      .filter((s) => !isSaleRejected(s))
      .reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  }, [filteredSales]);

  const totalUnitsSold = useMemo(() => {
    return filteredSales
      .filter((s) => !isSaleRejected(s))
      .reduce((sum, s) => {
        const itemsCount = s.items?.reduce((iSum, item) => iSum + (item.quantity || 0), 0) || 0;
        return sum + itemsCount;
      }, 0);
  }, [filteredSales]);

  const approvedTicketsCount = useMemo(() => {
    return filteredSales.filter((s) => !isSaleRejected(s)).length;
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
        `"${formatStockShortageNotes(s.notes || '', s.items).replace(/"/g, '""')}"`
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

        if (isSaleRejected(s)) {
          doc.setTextColor(220, 38, 38);
        } else {
          doc.setTextColor(22, 163, 74);
        }
        doc.text(formatCurrency(s.total_amount, currency), 170, y);
        doc.setTextColor(30);

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
              {approvedTicketsCount} {approvedTicketsCount === 1 ? 'ticket' : 'tickets'}
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
              <div className="py-4">
                <SalesHistorySkeleton />
              </div>
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
                      <span className={`text-sm font-semibold tabular-nums ${isSaleRejected(s) ? 'text-red-600' : 'text-emerald-600'}`}>
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
          VISTA DE ESCRITORIO (>= 768px / hidden md:block) - Ui CLINICAL BLUEPRINT
         ========================================================= */}
      <div className="hidden md:block space-y-5 pb-28 sm:pb-12 max-w-[1440px] mx-auto font-sans text-slate-900">
      {/* 1. Cabecera Directa */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-slate-900">
            Historial de ventas
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Auditoría de comprobantes emitidos y exportación financiera.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={filteredSales.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 min-h-[38px] bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 text-xs font-medium rounded-xl transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] disabled:opacity-45 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            disabled={filteredSales.length === 0}
            className="inline-flex items-center gap-1.5 px-4 min-h-[38px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:opacity-45 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* 2. KPIs y Métricas Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-ui-card desktop-hover-lift">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Recaudación total</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-[-0.02em] tabular-nums truncate">
            {formatCurrency(totalRevenue, currentInventory?.currency)}
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-ui-card desktop-hover-lift">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Ventas concretadas</span>
            <Receipt className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-[-0.02em] tabular-nums">
            {approvedTicketsCount} <span className="text-xs text-slate-500 font-normal">tickets</span>
          </p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-ui-card desktop-hover-lift">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Unidades despachadas</span>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-[-0.02em] tabular-nums">
            {totalUnitsSold} <span className="text-xs text-slate-500 font-normal">und</span>
          </p>
        </div>
      </div>

      {/* 3. Filtros de Fecha y Búsqueda */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-ui-card">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por ticket, cliente, correo o método..."
              className="w-full min-h-[40px] bg-slate-50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-900 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-[background-color,border-color] duration-150"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent text-slate-900 font-mono text-xs focus:outline-none"
              />
              <span className="text-slate-400">&rarr;</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent text-slate-900 font-mono text-xs focus:outline-none"
              />
            </div>
            {(startDate || endDate !== todayStr || searchTerm) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate(todayStr);
                  setSearchTerm('');
                }}
                className="min-h-[40px] px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 transition-colors cursor-pointer font-medium"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Tabla de Ventas */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-ui-card">
        {loading ? (
          <div className="p-6">
            <SalesHistorySkeleton />
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 space-y-1">
            <Receipt className="w-9 h-9 mx-auto stroke-[1.2] text-slate-300 mb-2" />
            <p className="text-slate-900 font-semibold">No se encontraron ventas registradas</p>
            <p className="text-[11px] text-slate-500">Las operaciones liquidadas en el Punto de Venta aparecerán aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold text-[11px] border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedSale(s)}
                    className="hover:bg-slate-50/70 cursor-pointer transition-colors duration-150"
                  >
                    <td className="p-3.5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      #{s.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="p-3.5 text-slate-500 text-[11px] tabular-nums whitespace-nowrap">
                      {formatDate(s.created_at)}
                    </td>
                    <td className="p-3.5 font-medium text-slate-900 truncate max-w-[200px]">
                      {s.customer_name || 'Consumidor Final'}
                    </td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {s.payment_method}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500 truncate max-w-[160px] text-[11px]">
                      {s.seller_email}
                    </td>
                    <td className={`p-3.5 text-right font-semibold tabular-nums ${isSaleRejected(s) ? 'text-red-600' : 'text-slate-900'}`}>
                      {formatCurrency(s.total_amount, currentInventory?.currency)}
                    </td>
                    <td className="p-3.5 text-center">
                      <button className="p-1 text-slate-400 hover:text-slate-900 transition-colors cursor-pointer">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="mobile-dark-modal bg-white border border-slate-200 rounded-2xl w-full max-w-lg lg:max-w-xl overflow-hidden shadow-xl flex flex-col max-h-[90vh] font-sans">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <h3 className="font-mono font-semibold text-slate-900 tracking-tight text-sm">
                  Ticket #{selectedSale.id.slice(0, 8).toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="mobile-flat-section grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">Fecha</span>
                  <span className="font-mono text-slate-900 font-medium tabular-nums">{new Date(selectedSale.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Método</span>
                  <span className="font-mono text-slate-900 font-semibold">{selectedSale.payment_method}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Cliente</span>
                  <span className="text-slate-900 font-medium">{selectedSale.customer_name || 'Consumidor Final'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Contacto</span>
                  <span className="font-mono text-slate-900">{selectedSale.customer_contact || 'Sin registrar'}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-500 block">Vendedor</span>
                  <span className="font-mono text-slate-900">{selectedSale.seller_email}</span>
                </div>
                {selectedSale.notes && (
                  <div className="col-span-2 pt-2 border-t border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Notas / Cupón</span>
                    <span className="text-slate-900">
                      {formatStockShortageNotes(selectedSale.notes, selectedSale.items)}
                    </span>
                  </div>
                )}
              </div>

              {/* Ítems vendidos */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 block">
                  Ítems vendidos ({selectedSale.items?.length || 0})
                </span>
                <div className="mobile-flat-section divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedSale.items?.map((it) => {
                    const hasFormattedBreakdown = (it.product_name || '').includes('·');
                    return (
                      <div key={it.id} className="mobile-flat-row p-3 flex items-center justify-between text-xs gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{it.product_name}</p>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5 tabular-nums">
                            <span className="font-semibold text-slate-700">{it.product_code}</span>
                            {hasFormattedBreakdown
                              ? ` · P. Unit: ${formatCurrency(it.unit_price, currentInventory?.currency)}`
                              : ` · ${it.quantity} und × ${formatCurrency(it.unit_price, currentInventory?.currency)}`}
                          </p>
                        </div>
                        <span className="font-mono font-semibold tabular-nums text-slate-900 shrink-0">
                          {formatCurrency(it.subtotal, currentInventory?.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total final */}
              <div className="mobile-flat-row flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs text-slate-600 font-semibold">Total liquidado</span>
                <span className={`text-lg font-semibold tabular-nums ${isSaleRejected(selectedSale) ? 'text-red-600' : 'text-emerald-700'}`}>
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

export default SalesHistoryPage;
