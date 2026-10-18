import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Search,
  Camera,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Receipt,
  QrCode,
  DollarSign,
  AlertCircle,
  Copy,
  Check,
  Tag,
  Sparkles,
  Loader2,
  X
} from 'lucide-react';
import { Product, PaymentMethod, Coupon } from '../types/database';
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

  // Carrito de Venta
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  // Cupones de Descuento (RF-06 Cupones)
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Estados de Proceso
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [saleSuccessData, setSaleSuccessData] = useState<{ saleId: string; total: number; receiptNumber: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Escáner Modal para Venta Rápida por Cámara
  const [scannerOpen, setScannerOpen] = useState(false);

  // Modal de Pasarela Rápida Yape / Plin (Grande y legible para cliente)
  const [qrModalType, setQrModalType] = useState<'YAPE' | 'PLIN' | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Búsqueda de Productos para el Carrito
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();
    return products
      .filter(p => (p.status === 'ACTIVE' || !p.status) && p.stock > 0)
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

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    const item = cart.find(i => i.product.id === productId);
    if (item && newQuantity > item.product.stock) {
      setErrorMessage(`Solo hay ${item.product.stock} unidades disponibles de "${item.product.name}".`);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.product.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  // Escaneo rápido de código
  const handleScanProductForSale = (scannedCode: string) => {
    const code = scannedCode.trim().toLowerCase();
    const found = products.find(p => p.code.toLowerCase() === code);

    if (found) {
      if (found.status === 'INACTIVE' || found.status === 'WITHDRAWN') {
        setErrorMessage(`El producto "${found.name}" se encuentra inactivo.`);
        return;
      }
      if (found.stock <= 0) {
        setErrorMessage(`El producto "${found.name}" está agotado (Stock: 0).`);
        return;
      }
      addToCart(found, 1);
    } else {
      setErrorMessage(`No se encontró ningún producto con el código "${scannedCode}".`);
    }
  };

  // Cálculos de Totales y Descuento por Cupón
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }, [cart]);

  const cartTotalUnits = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon || cartSubtotal <= 0) return 0;
    if (appliedCoupon.discount_type === 'PERCENTAGE') {
      return (cartSubtotal * Number(appliedCoupon.discount_value)) / 100;
    }
    return Math.min(cartSubtotal, Number(appliedCoupon.discount_value));
  }, [cartSubtotal, appliedCoupon]);

  const finalTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - discountAmount);
  }, [cartSubtotal, discountAmount]);

  // Aplicar Cupón de Descuento
  const handleApplyCoupon = async () => {
    const cleanCode = couponCodeInput.trim().toUpperCase();
    if (!cleanCode) return;
    if (!currentInventory) return;

    try {
      setCouponLoading(true);
      setCouponMessage(null);

      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('inventory_id', currentInventory.id)
        .eq('code', cleanCode)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setCouponMessage({ text: `El cupón "${cleanCode}" no existe.`, type: 'error' });
        return;
      }

      if (data.status !== 'ACTIVE') {
        setCouponMessage({ text: `El cupón "${cleanCode}" se encuentra inactivo.`, type: 'error' });
        return;
      }

      setAppliedCoupon(data);
      const discountDesc = data.discount_type === 'PERCENTAGE' 
        ? `${data.discount_value}%` 
        : formatCurrency(data.discount_value, currentInventory?.currency);
      setCouponMessage({ text: `¡Cupón "${cleanCode}" aplicado exitosamente (-${discountDesc})!`, type: 'success' });
      setCouponCodeInput('');
    } catch (err: any) {
      console.error('Error aplicando cupón:', err);
      setCouponMessage({ text: err.message || 'Error validando cupón.', type: 'error' });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponMessage(null);
    setCouponCodeInput('');
  };

  // Copiar número de teléfono
  const copyPaymentPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // PROCESAR VENTA CON PROTECCIÓN DE CONCURRENCIA TRANSACCIONAL (FOR UPDATE)
  const handleProcessSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !user) return;

    if (cart.length === 0) {
      setErrorMessage('El carrito está vacío. Agrega al menos un producto.');
      return;
    }

    try {
      setIsProcessingSale(true);
      setErrorMessage(null);

      const saleItemsPayload = cart.map(item => ({
        product_id: item.product.id,
        product_name: item.product.name,
        product_code: item.product.code,
        quantity: item.quantity,
        unit_price: item.product.price,
        cost_price: item.product.cost_price || 0,
        subtotal: item.product.price * item.quantity
      }));

      // 1. INTENTAR PROCESAMIENTO ATÓMICO VÍA RPC CON "FOR UPDATE"
      let saleIdCreated: string | null = null;
      let usedRpc = false;

      try {
        const { data: rpcRes, error: rpcError } = await supabase.rpc('process_pos_sale', {
          p_inventory_id: currentInventory.id,
          p_seller_id: user.id,
          p_seller_email: user.email,
          p_total_amount: finalTotal,
          p_payment_method: paymentMethod,
          p_customer_name: customerName.trim() || null,
          p_customer_contact: customerContact.trim() || null,
          p_notes: saleNotes.trim() || null,
          p_items: saleItemsPayload,
          p_coupon_code: appliedCoupon?.code || null,
          p_discount_amount: discountAmount
        });

        if (rpcError) {
          // Si el RPC falla porque detectó sobreventa o stock insuficiente
          if (rpcError.message && rpcError.message.toLowerCase().includes('stock insuficiente')) {
            throw new Error(`⚠️ Concurrencia detectada: ${rpcError.message}. Otro usuario acaba de comprar este artículo o no hay suficientes existencias.`);
          }
          // Si la función RPC aún no está creada en Supabase (código 42883), usamos fallback seguro
          if (rpcError.code === '42883' || rpcError.message.includes('does not exist')) {
            usedRpc = false;
          } else {
            throw rpcError;
          }
        } else if (rpcRes && rpcRes.sale_id) {
          saleIdCreated = rpcRes.sale_id;
          usedRpc = true;
        }
      } catch (rpcCatchErr: any) {
        if (rpcCatchErr.message.includes('Concurrencia detectada') || rpcCatchErr.message.includes('Stock insuficiente')) {
          throw rpcCatchErr;
        }
        usedRpc = false;
      }

      // 2. FALLBACK SEGURO SI RPC NO ESTÁ INSTALADO (VALIDA STOCK REAL EN TIEMPO REAL ANTES DE REGISTRAR)
      if (!usedRpc) {
        // Verificar stock fresco directamente en la base de datos de cada ítem
        for (const item of cart) {
          const { data: freshProd, error: checkErr } = await supabase
            .from('products')
            .select('stock, name')
            .eq('id', item.product.id)
            .single();

          if (checkErr || !freshProd) {
            throw new Error(`El producto "${item.product.name}" ya no existe en el catálogo.`);
          }

          if (freshProd.stock < item.quantity) {
            throw new Error(
              `⚠️ Stock insuficiente: El producto "${item.product.name}" solo cuenta con ${freshProd.stock} uds en existencia (solicitaste ${item.quantity}). Otro usuario pudo haberlo comprado.`
            );
          }
        }

        // Si todos tienen stock suficiente, crear la venta
        const saleNotesWithCoupon = appliedCoupon
          ? `${saleNotes ? saleNotes + ' | ' : ''}[Cupón: ${appliedCoupon.code} (-${discountAmount.toFixed(2)})]`
          : saleNotes.trim() || null;

        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .insert({
            inventory_id: currentInventory.id,
            seller_id: user.id,
            seller_email: user.email,
            total_amount: finalTotal,
            payment_method: paymentMethod,
            customer_name: customerName.trim() || null,
            customer_contact: customerContact.trim() || null,
            notes: saleNotesWithCoupon
          })
          .select()
          .single();

        if (saleError) throw saleError;
        saleIdCreated = saleData.id;

        // Insertar líneas de venta
        const linesToInsert = saleItemsPayload.map(item => ({
          sale_id: saleData.id,
          ...item
        }));
        await supabase.from('sale_items').insert(linesToInsert);

        // Descontar existencias
        for (const item of cart) {
          const remaining = item.product.stock - item.quantity;
          await supabase
            .from('products')
            .update({
              stock: remaining,
              last_modified_by: user.id,
              last_modified_by_email: user.email,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.product.id);
        }
      }

      // 3. Registrar auditoría
      await logAuditAction({
        inventoryId: currentInventory.id,
        actionType: 'SALE',
        details: `Venta registrada por total de ${formatCurrency(finalTotal, currentInventory.currency)} mediante ${paymentMethod}. ${appliedCoupon ? `Cupón: ${appliedCoupon.code}` : ''}`,
        metadata: {
          sale_id: saleIdCreated,
          items_count: cart.length,
          payment_method: paymentMethod,
          coupon_applied: appliedCoupon?.code || null,
          discount_amount: discountAmount
        }
      });

      // 4. Limpiar estado y mostrar confirmación
      const receiptNum = `VTA-${Date.now().toString().slice(-6)}`;
      setSaleSuccessData({
        saleId: saleIdCreated || Date.now().toString(),
        total: finalTotal,
        receiptNumber: receiptNum
      });

      setCart([]);
      setCustomerName('');
      setCustomerContact('');
      setSaleNotes('');
      setAppliedCoupon(null);
      setCouponMessage(null);

      // Recargar stock en toda la aplicación
      onSaleCompleted();
    } catch (err: any) {
      console.error('Error al procesar la venta:', err);
      setErrorMessage(err.message || 'Error al procesar la venta.');
      // Refrescar catálogo para actualizar existencias si hubo conflicto
      onSaleCompleted();
    } finally {
      setIsProcessingSale(false);
    }
  };

  // Descargar Comprobante / Recibo Digital en PDF
  const handleDownloadReceiptPDF = () => {
    if (!saleSuccessData || !currentInventory) return;
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 160] // Tamaño recibo de 80 mm
      });

      const invName = currentInventory.name || 'MI NEGOCIO';
      const currency = currentInventory.currency || 'USD';

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(invName.toUpperCase(), 40, 12, { align: 'center' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('COMPROBANTE DE VENTA', 40, 17, { align: 'center' });
      doc.text(`Ticket: ${saleSuccessData.receiptNumber}`, 40, 22, { align: 'center' });
      doc.text(`Fecha: ${new Date().toLocaleString()}`, 40, 27, { align: 'center' });
      doc.text(`Pago: ${paymentMethod}`, 40, 32, { align: 'center' });

      doc.setDrawColor(200);
      doc.line(6, 35, 74, 35);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL COBRADO:', 10, 43);
      doc.text(formatCurrency(saleSuccessData.total, currency), 70, 43, { align: 'right' });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text('¡Gracias por su compra!', 40, 55, { align: 'center' });

      doc.save(`recibo-${saleSuccessData.receiptNumber}.pdf`);
    } catch (err: any) {
      alert('Error generando recibo: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 pb-28 sm:pb-12 max-w-7xl mx-auto font-normal text-[#1E3A5F]">
      {/* 1. Cabecera Editorial */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#E8B4A0] uppercase block">
            TERMINAL OPERATIVA // CHECKOUT
          </span>
          <h1 className="text-xl sm:text-2xl font-light tracking-tight text-[#1E3A5F] uppercase">
            Punto de Venta & Caja
          </h1>
          <p className="text-xs text-[#616161] font-light mt-0.5">
            Registro ágil de transacciones, emisión de comprobantes y validación concurrente de stock.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider transition-all shadow-xs active:scale-95"
          >
            <Camera className="w-4 h-4 text-[#E8B4A0]" />
            <span>Escanear Código</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-700 animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800 p-1">
            ✕
          </button>
        </div>
      )}

      {/* Terminal de Punto de Venta (POS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Columna Izquierda: Búsqueda y Carrito de Productos */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tarjeta de Búsqueda */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#E8B4A0] block">
                CATÁLOGO ACTIVO
              </span>
              <span className="text-xs text-[#616161]">
                {products.length} ítems indexados
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Escribe el nombre o SKU del producto..."
                  className="w-full bg-[#ffffff] border border-[#E5E7EB] rounded-xl pl-10 pr-8 py-2.5 text-xs text-[#1E3A5F] placeholder:text-[#616161]/50 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] focus:border-[#1E3A5F] transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-3 text-xs text-[#616161] hover:text-[#1E3A5F]"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#F8F9FA] hover:bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E5E7EB] rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap shadow-xs"
              >
                <Camera className="w-4 h-4 text-[#1E3A5F]" />
                <span>Escanear</span>
              </button>
            </div>

            {/* Resultados de Búsqueda Desplegables */}
            {searchResults.length > 0 && (
              <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-xl overflow-hidden bg-[#F8F9FA]/60 animate-in fade-in">
                {searchResults.map(p => (
                  <div
                    key={p.id}
                    className="p-3 flex items-center justify-between hover:bg-white transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-medium text-[#1E3A5F] uppercase truncate">{p.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-[#616161] font-mono mt-0.5">
                        <span>{p.code}</span>
                        <span>•</span>
                        <span>Stock: <strong className="text-[#1E3A5F] font-normal">{p.stock} uds</strong></span>
                        <span>•</span>
                        <span className="text-[#1E3A5F] font-medium">
                          {formatCurrency(p.price, currentInventory?.currency)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToCart(p, 1)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider rounded-xl shadow-xs active:scale-95 transition-all flex-shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#E8B4A0]" /> Añadir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla / Lista de Ítems en el Carrito */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#E8B4A0]" />
                <h3 className="text-xs font-medium uppercase tracking-wider text-[#1E3A5F]">
                  Ítems Seleccionados ({cart.length})
                </h3>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-[#616161] hover:text-rose-600 transition-colors uppercase tracking-wider font-mono text-[11px]"
                >
                  Vaciar Carrito
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center text-[#616161] space-y-2 font-mono">
                <ShoppingCart className="w-10 h-10 mx-auto stroke-1 text-[#1E3A5F]/20" />
                <p className="text-xs uppercase tracking-wider">El carrito de caja está vacío.</p>
                <p className="text-[11px] text-[#616161]/70 font-sans">
                  Busca por nombre/código o utiliza el escáner para sumar productos al ticket.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB] overflow-x-auto">
                {cart.map(item => (
                  <div key={item.product.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#1E3A5F] uppercase truncate">{item.product.name}</p>
                      <p className="text-[11px] text-[#616161] font-mono">
                        {item.product.code} • {formatCurrency(item.product.price, currentInventory?.currency)} c/u
                      </p>
                    </div>

                    {/* Controles de Cantidad */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-mono font-medium text-[#1E3A5F]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Subtotal del Producto */}
                    <div className="text-right w-24">
                      <p className="text-xs font-mono font-medium text-[#1E3A5F]">
                        {formatCurrency(item.product.price * item.quantity, currentInventory?.currency)}
                      </p>
                    </div>

                    {/* Eliminar Ítem */}
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1.5 text-[#616161] hover:text-rose-600 transition-colors"
                      title="Quitar ítem"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Resumen de Cobro y Checkout */}
        <div className="space-y-4">
          <form onSubmit={handleProcessSale} className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E5E7EB]">
              <Receipt className="w-4 h-4 text-[#E8B4A0]" />
              <h3 className="text-xs font-medium uppercase tracking-wider text-[#1E3A5F]">
                Liquidación de Ticket
              </h3>
            </div>

            {/* Total Destacado y Desglose */}
            <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] space-y-2 font-mono">
              <div className="flex items-center justify-between text-xs text-[#616161]">
                <span>Subtotal ({cartTotalUnits} uds):</span>
                <span className="text-[#1E3A5F]">
                  {formatCurrency(cartSubtotal, currentInventory?.currency)}
                </span>
              </div>

              {appliedCoupon && (
                <div className="flex items-center justify-between text-xs text-[#1E3A5F]">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-[#E8B4A0]" /> Descuento ({appliedCoupon.code}):
                  </span>
                  <span className="text-[#E8B4A0] font-medium">
                    -{formatCurrency(discountAmount, currentInventory?.currency)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB]">
                <span className="text-xs uppercase tracking-wider text-[#1E3A5F]">TOTAL COBRO:</span>
                <span className="text-2xl font-light text-[#1E3A5F]">
                  {formatCurrency(finalTotal, currentInventory?.currency)}
                </span>
              </div>
            </div>

            {/* Cupón de Descuento (Opcional) */}
            <div className="space-y-2 pt-1 border-t border-[#E5E7EB]">
              <label className="block text-[11px] uppercase tracking-wider font-medium text-[#1E3A5F]">
                Cupón Promocional
              </label>

              {appliedCoupon ? (
                <div className="p-2.5 bg-[#F8F9FA] border border-[#E8B4A0] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono">
                    <Sparkles className="w-4 h-4 text-[#E8B4A0]" />
                    <div>
                      <span className="text-xs text-[#1E3A5F] font-semibold">
                        {appliedCoupon.code}
                      </span>
                      <span className="text-[11px] text-[#616161] ml-1.5">
                        ({appliedCoupon.discount_type === 'PERCENTAGE' ? `-${appliedCoupon.discount_value}%` : `-${formatCurrency(appliedCoupon.discount_value, currentInventory?.currency)}`})
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="p-1 text-[#616161] hover:text-rose-600 rounded-lg transition-colors"
                    title="Quitar cupón"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={e => setCouponCodeInput(e.target.value.toUpperCase())}
                    placeholder="Código (Ej: DESC10)"
                    className="flex-1 bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs font-mono uppercase text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponCodeInput.trim()}
                    className="px-3.5 py-2 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 active:scale-95 whitespace-nowrap shadow-xs"
                  >
                    {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aplicar'}
                  </button>
                </div>
              )}

              {couponMessage && (
                <p className={`text-[11px] font-mono ${couponMessage.type === 'success' ? 'text-[#1E3A5F]' : 'text-rose-600'}`}>
                  {couponMessage.text}
                </p>
              )}
            </div>

            {/* Método de Pago */}
            <div className="pt-2 border-t border-[#E5E7EB]">
              <label className="block text-[11px] uppercase tracking-wider font-medium text-[#1E3A5F] mb-2">
                Método de Pago <span className="text-[#E8B4A0]">*</span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CASH', label: 'Efectivo', icon: '💵' },
                  { id: 'YAPE', label: 'Yape', icon: '🟣' },
                  { id: 'PLIN', label: 'Plin', icon: '🔵' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m.id as PaymentMethod);
                      if (m.id === 'YAPE') setQrModalType('YAPE');
                      if (m.id === 'PLIN') setQrModalType('PLIN');
                    }}
                    className={`p-2.5 rounded-xl text-xs uppercase tracking-wider border flex flex-col items-center justify-center gap-1 transition-all ${
                      paymentMethod === m.id
                        ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-sm ring-2 ring-[#E8B4A0]'
                        : 'bg-[#F8F9FA] border-[#E5E7EB] text-[#1E3A5F] hover:bg-white'
                    }`}
                  >
                    <span className="text-base">{m.icon}</span>
                    <span className="font-mono text-[11px]">{m.label}</span>
                  </button>
                ))}
              </div>

              {(paymentMethod === 'YAPE' || paymentMethod === 'PLIN') && (
                <button
                  type="button"
                  onClick={() => setQrModalType(paymentMethod)}
                  className="w-full mt-2 py-2 px-3 bg-[#E8B4A0]/20 hover:bg-[#E8B4A0]/30 text-[#1E3A5F] border border-[#E8B4A0]/50 rounded-xl text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                >
                  <QrCode className="w-4 h-4 text-[#1E3A5F]" /> Ver QR para Cliente ({paymentMethod})
                </button>
              )}
            </div>

            {/* Datos opcionales del cliente */}
            <div className="space-y-2 pt-2 border-t border-[#E5E7EB]">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#616161] mb-1">
                  Cliente (Opcional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#616161] mb-1">
                  Contacto (Opcional)
                </label>
                <input
                  type="text"
                  value={customerContact}
                  onChange={e => setCustomerContact(e.target.value)}
                  placeholder="Ej: 999888777"
                  className="w-full bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#616161] mb-1">
                  Notas del Manifiesto
                </label>
                <textarea
                  value={saleNotes}
                  onChange={e => setSaleNotes(e.target.value)}
                  placeholder="Detalles de entrega, despacho, etc..."
                  rows={2}
                  className="w-full bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                />
              </div>
            </div>

            {/* Botón de Confirmación */}
            <button
              type="submit"
              disabled={isProcessingSale || cart.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 py-3 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider font-medium rounded-xl shadow-sm active:scale-95 disabled:opacity-50 transition-all"
            >
              {isProcessingSale ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                  <span>Validando Stock y Registrando...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-[#E8B4A0]" />
                  <span>Confirmar Venta y Cobro</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* MODAL DE PAGO YAPE / PLIN */}
      {qrModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl w-full max-w-sm sm:max-w-md p-6 shadow-xl space-y-4 text-center">
            {/* Cabecera */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#1E3A5F] text-[#E8B4A0]">
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-light text-[#1E3A5F] text-base uppercase tracking-tight">
                    {qrModalType === 'YAPE' ? 'Pagar con Yape' : 'Pagar con Plin'}
                  </h4>
                  <p className="text-[11px] text-[#616161] font-mono">Presenta el código al cliente</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQrModalType(null)}
                className="w-8 h-8 rounded-full border border-[#E5E7EB] text-[#616161] hover:text-[#1E3A5F] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Monto exacto */}
            <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB]">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#616161] block">
                MONTO EXACTO A TRANSFERIR
              </span>
              <span className="text-2xl sm:text-3xl font-light text-[#1E3A5F]">
                {formatCurrency(finalTotal, currentInventory?.currency)}
              </span>
            </div>

            {/* QR Grande */}
            <div className="flex flex-col items-center justify-center">
              {((qrModalType === 'YAPE' && currentInventory?.yape_qr_url) ||
                (qrModalType === 'PLIN' && currentInventory?.plin_qr_url)) ? (
                <div className="w-64 h-64 sm:w-72 sm:h-72 p-3 bg-white rounded-2xl shadow-sm border border-[#E5E7EB] flex items-center justify-center overflow-hidden">
                  <img
                    src={qrModalType === 'YAPE' ? currentInventory?.yape_qr_url! : currentInventory?.plin_qr_url!}
                    alt={`Código QR ${qrModalType}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-64 h-64 p-6 bg-[#F8F9FA] rounded-2xl border-2 border-dashed border-[#E5E7EB] flex flex-col items-center justify-center text-[#616161] text-xs space-y-2">
                  <QrCode className="w-12 h-12 text-[#1E3A5F]/20" />
                  <p className="font-mono uppercase text-[11px] text-[#1E3A5F]">
                    Sin QR cargado para {qrModalType}
                  </p>
                  <p className="text-[11px] text-[#616161]">
                    Carga la imagen del QR en <strong>Ajustes &gt; Pasarela de Pagos</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Número telefónico */}
            {((qrModalType === 'YAPE' && currentInventory?.yape_phone) ||
              (qrModalType === 'PLIN' && currentInventory?.plin_phone)) && (
              <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] flex items-center justify-between font-mono">
                <div className="text-left">
                  <span className="text-[10px] text-[#616161] block uppercase">Número asociado</span>
                  <span className="text-base font-light text-[#1E3A5F]">
                    {qrModalType === 'YAPE' ? currentInventory?.yape_phone : currentInventory?.plin_phone}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyPaymentPhone((qrModalType === 'YAPE' ? currentInventory?.yape_phone : currentInventory?.plin_phone)!)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-xl text-xs uppercase tracking-wider text-[#1E3A5F] hover:bg-[#F8F9FA] transition-colors"
                >
                  {copiedText ? <Check className="w-4 h-4 text-[#E8B4A0]" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedText ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            )}

            {currentInventory?.payment_instructions && (
              <p className="text-[11px] text-[#616161] italic font-light">
                "{currentInventory.payment_instructions}"
              </p>
            )}

            <button
              type="button"
              onClick={() => setQrModalType(null)}
              className="w-full py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white uppercase tracking-wider text-xs rounded-xl transition-colors font-mono"
            >
              Listo // Volver al Cobro
            </button>
          </div>
        </div>
      )}

      {/* Modal de Venta Exitosa */}
      {saleSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl w-full max-w-sm p-6 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 bg-[#1E3A5F] text-[#E8B4A0] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle className="w-6 h-6 stroke-[1.5]" />
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#E8B4A0] block">
                OPERACIÓN CONCRETADA
              </span>
              <h3 className="text-lg font-light text-[#1E3A5F] uppercase mt-0.5">¡Venta Registrada!</h3>
              <p className="text-xs text-[#616161] mt-1 font-mono">
                {saleSuccessData.receiptNumber}
              </p>
              <p className="text-2xl font-light text-[#1E3A5F] mt-2 font-mono">
                {formatCurrency(saleSuccessData.total, currentInventory?.currency)}
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleDownloadReceiptPDF}
                className="w-full py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-2 font-medium"
              >
                <Receipt className="w-4 h-4 text-[#E8B4A0]" /> Descargar Recibo Digital (PDF)
              </button>
              <button
                type="button"
                onClick={() => setSaleSuccessData(null)}
                className="w-full py-2 text-xs uppercase tracking-wider text-[#616161] hover:text-[#1E3A5F] transition-colors"
              >
                Cerrar y Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escáner de Barra / QR para añadir al carrito */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanProductForSale}
        title="Escanear Producto para Venta"
        instructions="Apunta la cámara al código de barra o QR para añadirlo directamente al carrito."
      />
    </div>
  );
};
