import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShoppingCart,
  Search,
  Camera,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  CreditCard,
  QrCode,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Copy,
  Check,
  User,
  X,
  Loader2,
  History,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { Product, Sale, SaleItem, PaymentMethod } from '../types/database';
import { supabase, formatCurrency, logAuditAction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import jsPDF from 'jspdf';

interface SalesPageProps {
  products: Product[];
  onSaleCompleted: () => void;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export const SalesPage: React.FC<SalesPageProps> = ({ products, onSaleCompleted }) => {
  const { currentInventory, user } = useAuth();

  // Vista activa: 'terminal' (Registrar Venta) o 'history' (Historial y Exportación)
  const [activeSubTab, setActiveSubTab] = useState<'terminal' | 'history'>('terminal');

  // Carrito de Venta
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  // Estados de Proceso
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [saleSuccessData, setSaleSuccessData] = useState<{ saleId: string; total: number; receiptNumber: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Escáner Modal para Venta Rápida (RF-06.2)
  const [scannerOpen, setScannerOpen] = useState(false);

  // Modal de Pasarela Rápida Yape / Plin (RF-06.3)
  const [quickPaymentModalOpen, setQuickPaymentModalOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Historial de Ventas (RF-06.4)
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);

  // Filtro de Rango de Fechas Inteligente (RF-06.4)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 1. Cargar Historial de Ventas
  const loadSalesHistory = useCallback(async () => {
    if (!currentInventory) return;
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          items:sale_items(*)
        `)
        .eq('inventory_id', currentInventory.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSalesHistory(data || []);
    } catch (err: any) {
      console.error('Error cargando historial de ventas:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [currentInventory]);

  useEffect(() => {
    if (activeSubTab === 'history') {
      loadSalesHistory();
    }
  }, [activeSubTab, loadSalesHistory]);

  // Determinar límites inteligentes de fechas (RF-06.4)
  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const earliestSaleDateStr = useMemo(() => {
    if (salesHistory.length === 0) return todayStr;
    const sorted = [...salesHistory].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return sorted[0].created_at.split('T')[0];
  }, [salesHistory, todayStr]);

  // Inicializar fechas inteligentes si están vacías
  useEffect(() => {
    if (!startDate && earliestSaleDateStr) {
      setStartDate(earliestSaleDateStr);
    }
    if (!endDate) {
      setEndDate(todayStr);
    }
  }, [earliestSaleDateStr, todayStr, startDate, endDate]);

  // Filtrado de ventas por rango de fechas inteligente
  const filteredSales = useMemo(() => {
    return salesHistory.filter((sale) => {
      const saleDate = sale.created_at.split('T')[0];
      if (startDate && saleDate < startDate) return false;
      if (endDate && saleDate > endDate) return false;
      return true;
    });
  }, [salesHistory, startDate, endDate]);

  // Métricas del Historial Filtrado
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  }, [filteredSales]);

  const totalUnitsSold = useMemo(() => {
    return filteredSales.reduce((sum, s) => {
      const itemsCount = s.items?.reduce((iSum, item) => iSum + (item.quantity || 0), 0) || 0;
      return sum + itemsCount;
    }, 0);
  }, [filteredSales]);

  // Búsqueda de Productos para el Carrito
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();
    return products
      .filter(p => p.status === 'ACTIVE' && p.stock > 0)
      .filter(p => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term))
      .slice(0, 6);
  }, [products, searchTerm]);

  // Añadir producto al carrito
  const addToCart = (product: Product, quantityToAdd: number = 1) => {
    setErrorMessage(null);
    setCart(prevCart => {
      const existing = prevCart.find(item => item.product.id === product.id);
      if (existing) {
        const nextQty = existing.quantity + quantityToAdd;
        if (nextQty > product.stock) {
          setErrorMessage(`No puedes agregar más de ${product.stock} unidades de "${product.name}".`);
          return prevCart;
        }
        return prevCart.map(item =>
          item.product.id === product.id ? { ...item, quantity: nextQty } : item
        );
      } else {
        if (quantityToAdd > product.stock) {
          setErrorMessage(`Stock disponible insuficiente (${product.stock} unidades).`);
          return prevCart;
        }
        return [...prevCart, { product, quantity: quantityToAdd }];
      }
    });
    setSearchTerm('');
  };

  // RF-06.2: Escáner de código QR/Barra en módulo de ventas
  const handleScanProductForSale = (scannedCode: string) => {
    const code = scannedCode.trim().toLowerCase();
    const found = products.find(p => p.code.toLowerCase() === code);

    if (found) {
      if (found.stock <= 0) {
        setErrorMessage(`El producto "${found.name}" está agotado (Stock: 0).`);
        return;
      }
      addToCart(found, 1);
    } else {
      setErrorMessage(`No se encontró ningún producto con el código "${scannedCode}".`);
    }
  };

  // Modificar cantidad en carrito
  const updateCartQuantity = (productId: string, newQty: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const clamped = Math.max(1, Math.min(newQty, item.product.stock));
          return { ...item, quantity: clamped };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Cálculos del Carrito
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }, [cart]);

  const cartTotalUnits = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // RF-06.1: Registrar Venta con Descuento Obligatorio y Automático de Stock
  const handleProcessSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !user || cart.length === 0) return;

    try {
      setIsProcessingSale(true);
      setErrorMessage(null);

      // 1. Validar existencias actuales de cada ítem antes de procesar
      for (const item of cart) {
        if (item.quantity > item.product.stock) {
          throw new Error(`El producto "${item.product.name}" solo tiene ${item.product.stock} unidades en stock.`);
        }
      }

      // 2. Insertar registro maestro de venta
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          inventory_id: currentInventory.id,
          seller_id: user.id,
          seller_email: user.email || 'Vendedor',
          total_amount: cartTotal,
          payment_method: paymentMethod,
          customer_name: customerName.trim() || null,
          customer_contact: customerContact.trim() || null,
          notes: saleNotes.trim() || null
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // 3. Insertar líneas de venta (sale_items)
      const saleItemsPayload = cart.map(item => ({
        sale_id: saleData.id,
        product_id: item.product.id,
        product_name: item.product.name,
        product_code: item.product.code,
        quantity: item.quantity,
        unit_price: item.product.price,
        cost_price: item.product.cost_price || 0,
        subtotal: item.product.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItemsPayload);

      if (itemsError) throw itemsError;

      // 4. RF-06.1: DESCUENTO OBLIGATORIO Y AUTOMÁTICO DEL STOCK REAL
      for (const item of cart) {
        const remainingStock = item.product.stock - item.quantity;

        const { error: stockError } = await supabase
          .from('products')
          .update({
            stock: remainingStock,
            last_modified_by: user.id,
            last_modified_by_email: user.email
          })
          .eq('id', item.product.id);

        if (stockError) throw stockError;

        // Registrar auditoría por cada producto descontado
        await logAuditAction({
          inventoryId: currentInventory.id,
          productId: item.product.id,
          productName: item.product.name,
          actionType: 'SALE',
          details: `Venta #${saleData.id.slice(0, 8)}: Se descontaron ${item.quantity} unidades de stock. Stock restante: ${remainingStock}`,
          metadata: {
            sale_id: saleData.id,
            quantity_sold: item.quantity,
            unit_price: item.product.price,
            remaining_stock: remainingStock
          }
        });
      }

      // 5. Limpiar carrito y notificar
      const receiptNum = `VTA-${Date.now().toString().slice(-6)}`;
      setSaleSuccessData({
        saleId: saleData.id,
        total: cartTotal,
        receiptNumber: receiptNum
      });
      setCart([]);
      setCustomerName('');
      setCustomerContact('');
      setSaleNotes('');

      // Recargar existencias en la app principal
      onSaleCompleted();
    } catch (err: any) {
      console.error('Error completando venta:', err);
      setErrorMessage(err.message || 'Error al procesar la venta.');
    } finally {
      setIsProcessingSale(false);
    }
  };

  // RF-06.4: Exportar Histórico de Ventas a CSV
  const handleExportSalesCSV = () => {
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
      a.download = `ventas-${startDate}-al-${endDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Error exportando CSV: ' + err.message);
    }
  };

  // RF-06.4: Exportar Histórico a PDF
  const handleExportSalesPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Reporte de Ventas: ${currentInventory?.name || 'Inventario'}`, 14, 20);

      doc.setFontSize(10);
      doc.text(`Periodo: ${startDate} hasta ${endDate}`, 14, 28);
      doc.text(`Total de Ventas: ${filteredSales.length} transacciones`, 14, 34);
      doc.text(`Recaudación Total: ${formatCurrency(totalRevenue, currentInventory?.currency)}`, 14, 40);

      let y = 50;
      doc.setFontSize(9);
      doc.text('ID', 14, y);
      doc.text('Fecha', 40, y);
      doc.text('Cliente', 85, y);
      doc.text('Método', 135, y);
      doc.text('Total', 170, y);

      doc.line(14, y + 2, 195, y + 2);
      y += 8;

      filteredSales.forEach((s) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(s.id.slice(0, 8), 14, y);
        doc.text(new Date(s.created_at).toLocaleDateString(), 40, y);
        doc.text((s.customer_name || 'Consumidor Final').slice(0, 20), 85, y);
        doc.text(s.payment_method, 135, y);
        doc.text(formatCurrency(s.total_amount, currentInventory?.currency), 170, y);
        y += 6;
      });

      doc.save(`ventas-${startDate}-al-${endDate}.pdf`);
    } catch (err: any) {
      alert('Error exportando PDF: ' + err.message);
    }
  };

  const copyPaymentPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* 1. Selector de Subpestañas: Terminal POS vs Historial */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('terminal')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              activeSubTab === 'terminal'
                ? 'bg-blue-600 text-white shadow-blue-500/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShoppingCart className="w-4 h-4" /> Registrar Venta (POS)
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              activeSubTab === 'history'
                ? 'bg-blue-600 text-white shadow-blue-500/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="w-4 h-4" /> Historial y Exportación
          </button>
        </div>

        {/* Pasarela Rápida Yape / Plin Botón (RF-06.3) */}
        {(currentInventory?.yape_phone || currentInventory?.plin_phone || currentInventory?.yape_qr_url || currentInventory?.plin_qr_url) && (
          <button
            onClick={() => setQuickPaymentModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-500/20 active:scale-95 transition-all"
          >
            <QrCode className="w-3.5 h-3.5" /> Cobrar con Yape / Plin
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-2.5 text-xs text-rose-600 dark:text-rose-400 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-auto text-rose-400 hover:text-rose-700">✕</button>
        </div>
      )}

      {/* --- MODO 1: REGISTRAR VENTA (TERMINAL POS) --- */}
      {activeSubTab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Búsqueda y Selección de Productos */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" /> Búsqueda y Escaneo de Productos
              </h3>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Escribe el nombre o SKU del producto..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* RF-06.2: Botón de Escáner QR/Barra para Ventas */}
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap shadow-sm"
                  title="Escanear código de barra o QR para añadir a la venta"
                >
                  <Camera className="w-4 h-4" /> Escanear QR
                </button>
              </div>

              {/* Resultados de Búsqueda Desplegables */}
              {searchResults.length > 0 && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/40 animate-in fade-in">
                  {searchResults.map(p => (
                    <div
                      key={p.id}
                      className="p-3 flex items-center justify-between hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{p.name}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-mono">{p.code}</span>
                          <span>•</span>
                          <span>Stock: <strong className="text-slate-700 dark:text-slate-300">{p.stock} uds</strong></span>
                          <span>•</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(p.price, currentInventory?.currency)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToCart(p, 1)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-sm active:scale-95 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Añadir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tabla del Carrito de Ventas */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-blue-600" /> Ítems en la Venta ({cart.length})
                </h3>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-rose-500 hover:underline"
                  >
                    Vaciar Carrito
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                  <ShoppingCart className="w-10 h-10 mx-auto stroke-1" />
                  <p className="text-xs">El carrito está vacío. Busca un producto o escanea su código QR para empezar.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto">
                  {cart.map(item => (
                    <div key={item.product.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.product.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {item.product.code} • {formatCurrency(item.product.price, currentInventory?.currency)} c/u
                        </p>
                      </div>

                      {/* Controles de Cantidad */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                          className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-slate-900 dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock}
                          className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Subtotal y Eliminar */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-900 dark:text-white w-20 text-right">
                          {formatCurrency(item.product.price * item.quantity, currentInventory?.currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="Quitar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Resumen de Cobro y Checkout */}
          <div className="space-y-4">
            <form onSubmit={handleProcessSale} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" /> Resumen y Cobro
              </h3>

              {/* Total Destacado */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Unidades a descontar:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{cartTotalUnits} uds</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">TOTAL A COBRAR:</span>
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(cartTotal, currentInventory?.currency)}
                  </span>
                </div>
              </div>

              {/* Método de Pago */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Método de Pago <span className="text-blue-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'CASH', label: 'Efectivo', icon: '💵' },
                    { id: 'YAPE', label: 'Yape', icon: '🟣' },
                    { id: 'PLIN', label: 'Plin', icon: '🔵' },
                    { id: 'CARD', label: 'Tarjeta', icon: '💳' },
                    { id: 'TRANSFER', label: 'Transf.', icon: '🏦' },
                    { id: 'OTHER', label: 'Otro', icon: '📝' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.id as PaymentMethod);
                        if (m.id === 'YAPE' || m.id === 'PLIN') {
                          setQuickPaymentModalOpen(true);
                        }
                      }}
                      className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                        paymentMethod === m.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span>{m.icon}</span> {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Datos opcionales del cliente */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Nombre del Cliente (Opcional)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Teléfono / Correo (Opcional)
                  </label>
                  <input
                    type="text"
                    value={customerContact}
                    onChange={e => setCustomerContact(e.target.value)}
                    placeholder="Ej: 999888777"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Notas de la Venta
                  </label>
                  <textarea
                    value={saleNotes}
                    onChange={e => setSaleNotes(e.target.value)}
                    placeholder="Detalles de entrega, comprobante, etc..."
                    rows={2}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              {/* Botón de Confirmación y Descuento de Stock Obligatorio */}
              <button
                type="submit"
                disabled={isProcessingSale || cart.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-2xl shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50 transition-all"
              >
                {isProcessingSale ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Descontando stock y registrando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Confirmar Venta y Descontar Stock
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODO 2: HISTORIAL Y EXPORTACIÓN DE VENTAS (RF-06.4) --- */}
      {activeSubTab === 'history' && (
        <div className="space-y-5">
          {/* Barra de Filtros Inteligentes por Fecha */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" /> Histórico de Transacciones y Exportación
                </h3>
                <p className="text-xs text-slate-500">
                  Fechas bloqueadas automáticamente: no permite fechas futuras ni anteriores a la primera venta registrada.
                </p>
              </div>

              {/* Botones de Exportación */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportSalesPDF}
                  disabled={filteredSales.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  onClick={handleExportSalesCSV}
                  disabled={filteredSales.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel / CSV
                </button>
              </div>
            </div>

            {/* Selectores de Fechas con Bloqueo Automático (RF-06.4) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Fecha Inicio (Mín: Primera venta)
                </label>
                <input
                  type="date"
                  value={startDate}
                  min={earliestSaleDateStr}
                  max={endDate || todayStr}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Fecha Fin (Máx: Hoy)
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || earliestSaleDateStr}
                  max={todayStr}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white"
                />
              </div>

              {/* Métricas del Periodo */}
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block font-bold">Ventas Realizadas</span>
                <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                  {filteredSales.length} transacciones ({totalUnitsSold} uds)
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block font-bold">Recaudación Total</span>
                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalRevenue, currentInventory?.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Tabla de Historial de Ventas */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            {loadingHistory ? (
              <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Cargando ventas...
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Receipt className="w-10 h-10 mx-auto stroke-1" />
                <p className="text-xs">No se encontraron ventas registradas en el rango de fechas seleccionado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="p-3.5">ID / Fecha</th>
                      <th className="p-3.5">Cliente</th>
                      <th className="p-3.5">Vendedor</th>
                      <th className="p-3.5">Método</th>
                      <th className="p-3.5 text-right">Total</th>
                      <th className="p-3.5 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSales.map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">#{sale.id.slice(0, 8)}</span>
                          <span className="block text-[10px] text-slate-400">
                            {new Date(sale.created_at).toLocaleString()}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {sale.customer_name || 'Consumidor Final'}
                          </span>
                          {sale.customer_contact && (
                            <span className="block text-[10px] text-slate-400">{sale.customer_contact}</span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-500">{sale.seller_email}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            {sale.payment_method}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(sale.total_amount, currentInventory?.currency)}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => setSelectedSaleDetail(sale)}
                            className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                          >
                            Ver Recibo
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
      )}

      {/* RF-06.3: Modal de Pasarela Rápida Yape / Plin */}
      {quickPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-xl">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Pasarela de Pago Móvil</h4>
                  <p className="text-[11px] text-slate-400">Yape / Plin configurado</p>
                </div>
              </div>
              <button onClick={() => setQuickPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Código QR subido */}
            <div className="text-center space-y-2">
              {currentInventory?.yape_qr_url || currentInventory?.plin_qr_url ? (
                <div className="mx-auto w-48 h-48 rounded-2xl overflow-hidden border-2 border-dashed border-purple-300 dark:border-purple-700 p-1 bg-white">
                  <img
                    src={currentInventory.yape_qr_url || currentInventory.plin_qr_url || ''}
                    alt="Código QR de Cobro"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs text-slate-400">
                  <QrCode className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No se ha cargado una foto de código QR en Ajustes.</p>
                </div>
              )}

              {/* Teléfonos configurados con botón copiar */}
              <div className="space-y-1.5 pt-2">
                {currentInventory?.yape_phone && (
                  <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800/40 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 block">Número Yape</span>
                      <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{currentInventory.yape_phone}</span>
                    </div>
                    <button
                      onClick={() => copyPaymentPhone(currentInventory.yape_phone!)}
                      className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg"
                      title="Copiar número"
                    >
                      {copiedText ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {currentInventory?.plin_phone && (
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800/40 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block">Número Plin</span>
                      <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{currentInventory.plin_phone}</span>
                    </div>
                    <button
                      onClick={() => copyPaymentPhone(currentInventory.plin_phone!)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg"
                      title="Copiar número"
                    >
                      {copiedText ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setQuickPaymentModalOpen(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
            >
              Listo / Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Venta Exitosa */}
      {saleSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>

            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white text-base">¡Venta Registrada con Éxito!</h4>
              <p className="text-xs text-slate-500 mt-0.5">Las unidades se han descontado del stock real en la base de datos.</p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Comprobante:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{saleSuccessData.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monto Cobrado:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(saleSuccessData.total, currentInventory?.currency)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSaleSuccessData(null)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            >
              Nueva Venta
            </button>
          </div>
        </div>
      )}

      {/* Modal Detalle de Venta Pasada */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  Recibo de Venta #{selectedSaleDetail.id.slice(0, 8)}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {new Date(selectedSaleDetail.created_at).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedSaleDetail(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de productos de la venta */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
              {selectedSaleDetail.items?.map(it => (
                <div key={it.id} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{it.product_name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {it.quantity} uds × {formatCurrency(it.unit_price, currentInventory?.currency)}
                    </p>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatCurrency(it.subtotal, currentInventory?.currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200">TOTAL:</span>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(selectedSaleDetail.total_amount, currentInventory?.currency)}
              </span>
            </div>

            <button
              onClick={() => setSelectedSaleDetail(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
            >
              Cerrar Recibo
            </button>
          </div>
        </div>
      )}

      {/* Escáner de Cámara para Ventas */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanProductForSale}
        title="Escanear Código de Barras o QR para la Venta"
      />
    </div>
  );
};
