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
  AlertCircle,
  Copy,
  Check,
  Tag,
  Sparkles,
  Loader2,
  X,
  Layers,
  Package
} from 'lucide-react';
import { Product, PaymentMethod, Coupon } from '../types/database';
import {
  supabase,
  formatCurrency,
  logAuditAction,
  formatCleanDecimal,
  formatStockDisplay,
  getBoxBreakdown
} from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { BarcodeScannerModal } from '../components/modals/BarcodeScannerModal';
import { SuccessCheckModal } from '../components/modals/SuccessCheckModal';
import jsPDF from 'jspdf';

interface SalesPageProps {
  products: Product[];
  onSaleCompleted: () => void;
  onNavigateToHistory?: () => void;
}

interface CartItem {
  product: Product;
  quantity: number; // En unidades si UNIT, o en cajas consolidadas (ej. 1.5) si BOX
  boxes: number; // Solo para BOX: cajas enteras/decimales a vender
  looseUnits: number; // Solo para BOX: unidades sueltas a vender
  saleMode?: 'BOX' | 'UNIT'; // Modalidad activa en móvil para productos en Caja ('BOX' | 'UNIT')
}

export const SalesPage: React.FC<SalesPageProps> = ({ products, onSaleCompleted, onNavigateToHistory }) => {
  const { currentInventory, user } = useAuth();

  // Carrito de Venta
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
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
  const [saleSuccessData, setSaleSuccessData] = useState<{
    saleId: string;
    total: number;
    receiptNumber: string;
    items?: Array<{ label: string; subtotal: number }>;
  } | null>(null);
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
      .filter(p => (p.status === 'ACTIVE' || !p.status) && Number(p.stock) > 0)
      .filter(p => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term))
      .slice(0, 6);
  }, [products, searchTerm]);

  // Calcular cantidad consolidada de un ítem BOX a partir de (boxes, looseUnits)
  const computeBoxConsolidatedQty = (product: Product, boxes: number, looseUnits: number): number => {
    const upb = Math.max(1, Number(product.units_per_box || 1));
    return Number((Math.max(0, boxes) + Math.max(0, looseUnits) / upb).toFixed(4));
  };

  // Precio unitario de venta para productos en Caja (usa precio_unidad explícito si existe, o Precio_Caja / unidades_por_caja)
  const getProductUnitSalePrice = (product: Product): number => {
    const explicitUnitPrice = Number((product as any).unit_price || (product as any).precio_unidad || 0);
    if (explicitUnitPrice > 0) {
      return explicitUnitPrice;
    }
    const isBox = product.unit_type === 'BOX' && Number(product.units_per_box) > 1;
    if (!isBox) {
      return Number(product.price || 0);
    }
    const upb = Math.max(1, Number(product.units_per_box || 1));
    return Number(product.price || 0) / upb;
  };

  // Calcular subtotal exacto de un ítem del carrito según modalidad (Caja vs Unidad)
  const getCartItemSubtotal = (item: CartItem): number => {
    const isBox = item.product.unit_type === 'BOX' && Number(item.product.units_per_box) > 1;
    if (!isBox) {
      return Number((Number(item.product.price || 0) * item.quantity).toFixed(2));
    }
    const boxesSubtotal = (item.boxes || 0) * Number(item.product.price || 0);
    const unitSalePrice = getProductUnitSalePrice(item.product);
    const looseUnitsSubtotal = (item.looseUnits || 0) * unitSalePrice;
    return Number((boxesSubtotal + looseUnitsSubtotal).toFixed(2));
  };

  // Formatear etiqueta descriptiva para el ticket e historial (ej. "SPIDERMAN · 6 unds (0.5 caja)" o "SPIDERMAN · 1 caja")
  const formatCartItemSaleLabel = (item: CartItem): string => {
    const isBox = item.product.unit_type === 'BOX' && Number(item.product.units_per_box) > 1;
    const baseName = item.product.name;

    if (!isBox) {
      return baseName;
    }

    const boxWord = (q: number) => (q <= 1 ? 'caja' : 'cajas');

    if (item.boxes > 0 && item.looseUnits === 0) {
      return `${baseName} · ${formatCleanDecimal(item.boxes, 2)} ${item.boxes === 1 ? 'caja' : 'cajas'}`;
    }

    if (item.looseUnits > 0 && item.boxes === 0) {
      return `${baseName} · ${item.looseUnits} ${item.looseUnits === 1 ? 'und' : 'unds'} (${formatCleanDecimal(item.quantity, 2)} ${boxWord(item.quantity)})`;
    }

    return `${baseName} · ${formatCleanDecimal(item.boxes, 2)} ${item.boxes === 1 ? 'caja' : 'cajas'} + ${item.looseUnits} ${item.looseUnits === 1 ? 'und' : 'unds'} (${formatCleanDecimal(item.quantity, 2)} ${boxWord(item.quantity)})`;
  };

  // Cambiar modalidad de venta [Caja | Unidad] en el carrito con un solo tap
  const switchCartItemSaleMode = (productId: string, targetMode: 'BOX' | 'UNIT') => {
    setErrorMessage(null);
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const currentMode = item.saleMode || (item.looseUnits > 0 && item.boxes === 0 ? 'UNIT' : 'BOX');
    if (currentMode === targetMode) return;

    const maxStock = Number(item.product.stock || 0);
    const upb = Math.max(1, Number(item.product.units_per_box || 1));
    const maxUnitsAvailable = Math.floor(maxStock * upb + 0.0001);

    if (targetMode === 'BOX') {
      if (maxStock + 0.0002 < 1) {
        setErrorMessage(
          `Stock insuficiente para vender 1 caja completa de "${item.product.name}". Disponible: ${formatCleanDecimal(maxStock, 2)} ${maxStock <= 1 ? 'caja' : 'cajas'} (${maxUnitsAvailable} ${maxUnitsAvailable === 1 ? 'und' : 'unds'}).`
        );
        return;
      }
      setCart(prev =>
        prev.map(i =>
          i.product.id === productId
            ? {
                ...i,
                saleMode: 'BOX',
                boxes: 1,
                looseUnits: 0,
                quantity: 1
              }
            : i
        )
      );
    } else {
      const unitConsolidated = computeBoxConsolidatedQty(item.product, 0, 1);
      if (unitConsolidated > maxStock + 0.0002) {
        setErrorMessage(
          `Stock insuficiente para "${item.product.name}". Disponible: ${formatCleanDecimal(maxStock, 2)} ${maxStock <= 1 ? 'caja' : 'cajas'} (${maxUnitsAvailable} ${maxUnitsAvailable === 1 ? 'und' : 'unds'}).`
        );
        return;
      }
      setCart(prev =>
        prev.map(i =>
          i.product.id === productId
            ? {
                ...i,
                saleMode: 'UNIT',
                boxes: 0,
                looseUnits: 1,
                quantity: unitConsolidated
              }
            : i
        )
      );
    }
  };

  // Añadir producto al carrito (soporta añadir por Caja o por Unidad suelta si es BOX)
  const addToCart = (product: Product, mode?: 'BOX' | 'UNIT') => {
    setErrorMessage(null);
    const isBoxProduct = product.unit_type === 'BOX' && Number(product.units_per_box) > 0;
    const upb = Math.max(1, Number(product.units_per_box || 1));
    const maxStock = Number(product.stock || 0);

    setCart(prevCart => {
      const existing = prevCart.find(item => item.product.id === product.id);

      if (!isBoxProduct) {
        // Producto tipo UNIT
        const nextQty = (existing ? existing.quantity : 0) + 1;
        if (nextQty > maxStock) {
          setErrorMessage(`No puedes agregar más de ${maxStock} und de "${product.name}".`);
          return prevCart;
        }
        if (existing) {
          return prevCart.map(item =>
            item.product.id === product.id
              ? { ...item, quantity: nextQty, boxes: 0, looseUnits: nextQty, saleMode: 'UNIT' }
              : item
          );
        }
        return [...prevCart, { product, quantity: 1, boxes: 0, looseUnits: 1, saleMode: 'UNIT' }];
      }

      // Producto tipo BOX (permite vender por Cajas y/o Unidades sueltas)
      const effectiveMode: 'BOX' | 'UNIT' = mode || existing?.saleMode || 'BOX';
      let addBoxes = effectiveMode === 'BOX' ? 1 : 0;
      let addLoose = effectiveMode === 'UNIT' ? 1 : 0;
      let resolvedSaleMode: 'BOX' | 'UNIT' = effectiveMode;

      // Si el usuario pulsa añadir Caja pero queda menos de 1 caja entera en stock (ej. 0.5 cajas), añadir 1 unidad suelta automáticamente
      if (effectiveMode === 'BOX' && (existing ? existing.quantity + 1 : 1) > maxStock + 0.0001) {
        addBoxes = 0;
        addLoose = 1;
        if (!existing) {
          resolvedSaleMode = 'UNIT';
        }
      }

      const nextBoxes = (existing ? existing.boxes : 0) + addBoxes;
      const nextLoose = (existing ? existing.looseUnits : 0) + addLoose;
      const nextConsolidated = computeBoxConsolidatedQty(product, nextBoxes, nextLoose);

      if (nextConsolidated > maxStock + 0.0002) {
        const maxUnitsAvailable = Math.floor(maxStock * upb + 0.0001);
        setErrorMessage(
          `Stock disponible insuficiente para "${product.name}". Disponible: ${formatCleanDecimal(maxStock, 2)} ${maxStock <= 1 ? 'caja' : 'cajas'} (${maxUnitsAvailable} ${maxUnitsAvailable === 1 ? 'und' : 'unds'}).`
        );
        return prevCart;
      }

      if (existing) {
        return prevCart.map(item =>
          item.product.id === product.id
            ? {
                ...item,
                boxes: nextBoxes,
                looseUnits: nextLoose,
                quantity: nextConsolidated,
                saleMode: mode ? mode : item.saleMode || resolvedSaleMode
              }
            : item
        );
      }

      return [
        ...prevCart,
        {
          product,
          boxes: nextBoxes,
          looseUnits: nextLoose,
          quantity: nextConsolidated,
          saleMode: resolvedSaleMode
        }
      ];
    });
    setSearchTerm('');
  };

  // Actualizar cantidad para producto tipo UNIT
  const updateUnitCartQuantity = (productId: string, newQuantity: number) => {
    setErrorMessage(null);
    const parsedQty = Math.round(newQuantity);
    if (parsedQty <= 0) {
      removeFromCart(productId);
      return;
    }
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    if (parsedQty > item.product.stock) {
      setErrorMessage(`Solo hay ${formatStockDisplay(item.product)} disponibles de "${item.product.name}".`);
      return;
    }

    setCart(prevCart =>
      prevCart.map(i =>
        i.product.id === productId
          ? { ...i, quantity: parsedQty, looseUnits: parsedQty }
          : i
      )
    );
  };

  // Actualizar Cajas y/o Unidades sueltas para producto tipo BOX
  const updateBoxCartAmounts = (
    productId: string,
    newBoxes: number,
    newLooseUnits: number,
    modeOverride?: 'BOX' | 'UNIT'
  ) => {
    setErrorMessage(null);
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const cleanBoxes = Math.max(0, Number.isFinite(newBoxes) ? newBoxes : 0);
    const cleanLoose = Math.max(0, Math.round(Number.isFinite(newLooseUnits) ? newLooseUnits : 0));
    const consolidated = computeBoxConsolidatedQty(item.product, cleanBoxes, cleanLoose);

    if (consolidated <= 0) {
      removeFromCart(productId);
      return;
    }

    if (consolidated > Number(item.product.stock) + 0.0002) {
      const upb = Math.max(1, Number(item.product.units_per_box || 1));
      const maxStock = Number(item.product.stock || 0);
      const maxUnitsAvailable = Math.floor(maxStock * upb + 0.0001);
      setErrorMessage(
        `Stock insuficiente para "${item.product.name}". Disponible: ${formatCleanDecimal(maxStock, 2)} ${maxStock <= 1 ? 'caja' : 'cajas'} (${maxUnitsAvailable} ${maxUnitsAvailable === 1 ? 'und' : 'unds'}).`
      );
      return;
    }

    setCart(prevCart =>
      prevCart.map(i =>
        i.product.id === productId
          ? {
              ...i,
              boxes: cleanBoxes,
              looseUnits: cleanLoose,
              quantity: consolidated,
              saleMode: modeOverride || i.saleMode
            }
          : i
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  // Escaneo rápido de código: agrega directamente al carrito (sumando 1 unidad si ya estaba en la lista)
  const handleScanProductForSale = (scannedCode: string) => {
    setScannerOpen(false);
    const code = scannedCode.trim().toLowerCase();
    const found = products.find(p => p.code.toLowerCase() === code);

    if (found) {
      if (found.status === 'INACTIVE' || found.status === 'WITHDRAWN') {
        setErrorMessage(`El producto "${found.name}" se encuentra inactivo.`);
        return;
      }
      if (Number(found.stock) <= 0) {
        setErrorMessage(`El producto "${found.name}" está agotado (Stock: 0).`);
        return;
      }
      addToCart(found);
    } else {
      setErrorMessage(`No se encontró ningún producto con el código "${scannedCode}".`);
    }
  };

  // Cálculos de Totales y Descuento por Cupón
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + getCartItemSubtotal(item), 0);
  }, [cart]);

  const cartTotalItemsCount = useMemo(() => {
    return cart.length;
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
      const discountDesc =
        data.discount_type === 'PERCENTAGE'
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

      const saleItemsPayload = cart.map(item => {
        const isBox = item.product.unit_type === 'BOX' && Number(item.product.units_per_box) > 1;
        const activeMode: 'BOX' | 'UNIT' =
          item.saleMode || (item.looseUnits > 0 && item.boxes === 0 ? 'UNIT' : 'BOX');
        const effectiveUnitPrice =
          isBox && activeMode === 'UNIT'
            ? Number(getProductUnitSalePrice(item.product).toFixed(2))
            : item.product.price;

        return {
          product_id: item.product.id,
          product_name: formatCartItemSaleLabel(item),
          product_code: item.product.code,
          quantity: item.quantity,
          unit_price: effectiveUnitPrice,
          cost_price: item.product.cost_price || 0,
          subtotal: getCartItemSubtotal(item)
        };
      });

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
          if (rpcError.message && rpcError.message.toLowerCase().includes('stock insuficiente')) {
            throw new Error(
              `⚠️ Concurrencia detectada: ${rpcError.message}. Otro usuario acaba de comprar este artículo o no hay suficientes existencias.`
            );
          }
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
        if (
          rpcCatchErr.message.includes('Concurrencia detectada') ||
          rpcCatchErr.message.includes('Stock insuficiente')
        ) {
          throw rpcCatchErr;
        }
        usedRpc = false;
      }

      // 2. FALLBACK SEGURO SI RPC NO ESTÁ INSTALADO
      if (!usedRpc) {
        for (const item of cart) {
          const { data: freshProd, error: checkErr } = await supabase
            .from('products')
            .select('stock, name, unit_type, units_per_box')
            .eq('id', item.product.id)
            .single();

          if (checkErr || !freshProd) {
            throw new Error(`El producto "${item.product.name}" ya no existe en el catálogo.`);
          }

          if (Number(freshProd.stock) + 0.0002 < item.quantity) {
            throw new Error(
              `⚠️ Stock insuficiente: El producto "${item.product.name}" solo cuenta con ${formatStockDisplay(freshProd)} en existencia.`
            );
          }
        }

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

        const linesToInsert = saleItemsPayload.map(item => ({
          sale_id: saleData.id,
          ...item
        }));
        await supabase.from('sale_items').insert(linesToInsert);

        for (const item of cart) {
          const remaining = Math.max(0, Number((Number(item.product.stock) - item.quantity).toFixed(4)));
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
        details: `Venta registrada por total de ${formatCurrency(finalTotal, currentInventory.currency)} mediante ${paymentMethod}. ${
          appliedCoupon ? `Cupón: ${appliedCoupon.code}` : ''
        }`,
        metadata: {
          sale_id: saleIdCreated,
          items_count: cart.length,
          payment_method: paymentMethod,
          coupon_applied: appliedCoupon?.code || null,
          discount_amount: discountAmount
        }
      });

      const receiptItemsSnapshot = saleItemsPayload.map(i => ({
        label: i.product_name,
        subtotal: i.subtotal
      }));

      // 4. Limpiar estado del terminal y disparar SuccessCheckModal
      const receiptNum = `VTA-${Date.now().toString().slice(-6)}`;
      setCart([]);
      setPaymentMethod('CASH');
      setShowCustomerInfo(false);
      setCustomerName('');
      setCustomerContact('');
      setSaleNotes('');
      setAppliedCoupon(null);
      setCouponMessage(null);
      setCouponCodeInput('');
      setSearchTerm('');

      setSaleSuccessData({
        saleId: saleIdCreated || Date.now().toString(),
        total: finalTotal,
        receiptNumber: receiptNum,
        items: receiptItemsSnapshot
      });

      onSaleCompleted();
    } catch (err: any) {
      console.error('Error al procesar la venta:', err);
      setErrorMessage(err.message || 'Error al procesar la venta.');
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
        format: [80, 160]
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
    <>
      {/* =========================================================
          VISTA MÓVIL ULTRA MINIMALISTA (< 768px / md:hidden)
         ========================================================= */}
      <div className="md:hidden fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col overflow-hidden bg-white text-neutral-900">
        
        {/* CAPA 1: Header Oscuro Principal (Fijo / shrink-0) */}
        <header className="shrink-0 bg-neutral-950 text-white rounded-b-[2.5rem] z-20 select-none px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Terminal de Cobro
            </h1>

            <div className="flex items-center gap-2 flex-shrink-0">
              {onNavigateToHistory && (
                <button
                  type="button"
                  onClick={onNavigateToHistory}
                  aria-label="Historial de Ventas"
                  title="Historial de Ventas"
                  className="h-10 px-3.5 rounded-full bg-neutral-800/70 hover:bg-neutral-800 text-neutral-200 flex items-center gap-1.5 text-xs font-medium transition-colors active:scale-95"
                >
                  <Receipt className="w-3.5 h-3.5 stroke-[1.75]" />
                  <span>Historial</span>
                </button>
              )}
            </div>
          </div>

          {/* Monto Total en Grande e Indicador de Productos */}
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <span className="text-xs text-neutral-400 block">
                Total a cobrar
              </span>
              <p className="text-4xl font-semibold tracking-tight text-white tabular-nums mt-1">
                {formatCurrency(finalTotal, currentInventory?.currency)}
              </p>
            </div>

            <span className="inline-flex items-center px-3 py-1 rounded-full bg-neutral-800/80 text-neutral-300 text-xs font-medium tabular-nums">
              {cart.length} {cart.length === 1 ? 'producto' : 'productos'}
            </span>
          </div>
        </header>

        {/* CAPA 2: Contenedor Blanco Global (flex-1 flex flex-col overflow-hidden) */}
        <section className="flex-1 min-h-0 w-full bg-white flex flex-col overflow-hidden">
          
          {/* SUB-CAPA 2A: Barra Fija de Herramientas / Buscador (NUNCA SE MUEVE NI HACE SCROLL) */}
          <div className="shrink-0 w-full bg-white px-5 pt-4 pb-2 space-y-2">
            {errorMessage && (
              <div className="py-3 px-4 bg-rose-50 text-rose-700 rounded-2xl text-xs font-medium flex items-center justify-between gap-2">
                <span>{errorMessage}</span>
                <button type="button" onClick={() => setErrorMessage(null)}>
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <div className="flex-1 min-w-0 flex items-center gap-3 bg-neutral-50 border border-neutral-200/60 rounded-2xl px-4 py-3.5 focus-within:border-neutral-950 focus-within:bg-white transition-all">
                <Search className="w-5 h-5 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar producto o SKU para agregar..."
                  className="w-full bg-transparent border-0 outline-none ring-0 p-0 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="text-xs text-neutral-400 hover:text-neutral-900 px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                aria-label="Escanear código para agregar al carrito"
                title="Escanear código"
                className="w-12 h-12 flex items-center justify-center bg-neutral-50 border border-neutral-200/60 rounded-2xl text-neutral-600 hover:text-neutral-950 active:scale-95 transition-all shrink-0"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="bg-neutral-50 border border-neutral-100 rounded-2xl px-4 max-h-48 overflow-y-auto overscroll-contain divide-y divide-neutral-100">
                {searchResults.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => addToCart(prod, 'BOX')}
                    className="w-full py-2.5 flex items-center justify-between text-left active:opacity-70"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-semibold text-neutral-900 truncate">
                        {prod.name}
                      </p>
                      <p className="text-xs text-neutral-400 truncate">
                        {prod.code} · Disp: {formatStockDisplay(prod)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-neutral-900 tabular-nums shrink-0">
                      {formatCurrency(prod.price, currentInventory?.currency)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SUB-CAPA 2B: Contenedor de Datos con Scroll Aislado */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-2 pb-28 space-y-5">
            {/* Recuadro de Detalle de compra con scroll interno (máximo 2 productos visibles) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-neutral-400">
                  Detalle de compra ({cart.length})
                </span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs text-neutral-400 hover:text-neutral-900"
                  >
                    Vaciar
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="bg-neutral-50/70 border border-neutral-100 rounded-2xl py-4 px-4 text-center text-xs text-neutral-400">
                  Escanea un código de barras o busca un producto para iniciar la venta.
                </div>
              ) : (
                <div className="bg-neutral-50/70 border border-neutral-100 rounded-2xl px-3.5 max-h-[160px] overflow-y-auto overscroll-contain divide-y divide-neutral-100">
                  {cart.map((item) => {
                    const isBox = item.product.unit_type === 'BOX' && Number(item.product.units_per_box) > 1;
                    const lineTotal = getCartItemSubtotal(item);
                    const activeMode: 'BOX' | 'UNIT' =
                      item.saleMode || (item.looseUnits > 0 && item.boxes === 0 ? 'UNIT' : 'BOX');
                    const unitSalePrice = getProductUnitSalePrice(item.product);
                    const displayCount = isBox
                      ? activeMode === 'UNIT'
                        ? item.looseUnits
                        : item.boxes
                      : item.quantity;

                    return (
                      <div
                        key={item.product.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-neutral-900 truncate">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-neutral-400 truncate mt-0.5">
                            {isBox
                              ? activeMode === 'UNIT'
                                ? `${formatCurrency(unitSalePrice, currentInventory?.currency)} / und (${formatCleanDecimal(item.quantity, 2)} ${item.quantity <= 1 ? 'caja' : 'cajas'}) · Subtotal: ${formatCurrency(lineTotal, currentInventory?.currency)}`
                                : `${formatCurrency(item.product.price, currentInventory?.currency)} / caja · Subtotal: ${formatCurrency(lineTotal, currentInventory?.currency)}`
                              : `${formatCurrency(item.product.price, currentInventory?.currency)} c/u · Subtotal: ${formatCurrency(lineTotal, currentInventory?.currency)}`}
                          </p>

                          {/* Selector de Modalidad [Caja | Unidad] en píldora compacta */}
                          {isBox && (
                            <div className="mt-1.5 inline-flex items-center bg-neutral-200/70 rounded-full p-0.5">
                              <button
                                type="button"
                                onClick={() => switchCartItemSaleMode(item.product.id, 'BOX')}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                                  activeMode === 'BOX'
                                    ? 'bg-neutral-950 text-white shadow-2xs'
                                    : 'text-neutral-600 hover:text-neutral-900'
                                }`}
                              >
                                Caja
                              </button>
                              <button
                                type="button"
                                onClick={() => switchCartItemSaleMode(item.product.id, 'UNIT')}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                                  activeMode === 'UNIT'
                                    ? 'bg-neutral-950 text-white shadow-2xs'
                                    : 'text-neutral-600 hover:text-neutral-900'
                                }`}
                              >
                                Unidad
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex items-center gap-1.5 bg-neutral-100 rounded-full p-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (isBox) {
                                  if (activeMode === 'UNIT') {
                                    updateBoxCartAmounts(item.product.id, 0, item.looseUnits - 1, 'UNIT');
                                  } else {
                                    updateBoxCartAmounts(item.product.id, item.boxes - 1, 0, 'BOX');
                                  }
                                } else {
                                  updateUnitCartQuantity(item.product.id, item.quantity - 1);
                                }
                              }}
                              className="w-7 h-7 rounded-full bg-white text-neutral-900 flex items-center justify-center active:scale-95 shadow-2xs"
                              aria-label="Disminuir"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-semibold text-neutral-900 tabular-nums px-1.5">
                              {displayCount}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (isBox) {
                                  if (activeMode === 'UNIT') {
                                    updateBoxCartAmounts(item.product.id, 0, item.looseUnits + 1, 'UNIT');
                                  } else {
                                    updateBoxCartAmounts(item.product.id, item.boxes + 1, 0, 'BOX');
                                  }
                                } else {
                                  updateUnitCartQuantity(item.product.id, item.quantity + 1);
                                }
                              }}
                              className="w-7 h-7 rounded-full bg-white text-neutral-900 flex items-center justify-center active:scale-95 shadow-2xs"
                              aria-label="Aumentar"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="w-8 h-8 rounded-full text-neutral-400 hover:text-rose-600 flex items-center justify-center"
                            aria-label="Quitar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          {/* Campo Añadir Descuento (Cupón Promocional) */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-medium text-neutral-400 block">
              Añadir descuento
            </span>

            {appliedCoupon ? (
              <div className="bg-neutral-50 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Tag className="w-4 h-4 text-neutral-700 flex-shrink-0" />
                  <div className="truncate">
                    <span className="text-xs font-semibold text-neutral-900">
                      {appliedCoupon.code}
                    </span>
                    <span className="text-xs text-emerald-600 font-medium ml-2 tabular-nums">
                      (-{formatCurrency(discountAmount, currentInventory?.currency)})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="text-xs text-neutral-400 hover:text-rose-600 p-1"
                  aria-label="Quitar descuento"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-neutral-50 rounded-2xl p-1.5 pl-4">
                <Tag className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <input
                  type="text"
                  value={couponCodeInput}
                  onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO DE DESCUENTO"
                  className="flex-1 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none uppercase"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponCodeInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-neutral-950 text-white text-xs font-semibold disabled:opacity-40 transition-all active:scale-95"
                >
                  {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aplicar'}
                </button>
              </div>
            )}

            {couponMessage && (
              <p
                className={`text-xs ${
                  couponMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {couponMessage.text}
              </p>
            )}
          </div>

          {/* Métodos de pago en píldoras sobrias */}
          <div className="space-y-3 pt-1">
            <span className="text-xs font-medium text-neutral-400 block">
              Método de pago
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'CASH', label: 'Efectivo' },
                  { id: 'YAPE', label: 'Yape' },
                  { id: 'PLIN', label: 'Plin' }
                ] as { id: PaymentMethod; label: string }[]
              ).map((m) => {
                const active = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-3 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                      active
                        ? 'bg-neutral-950 text-white shadow-xs'
                        : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {(paymentMethod === 'YAPE' || paymentMethod === 'PLIN') && (
              <button
                type="button"
                onClick={() => setQrModalType(paymentMethod)}
                className="w-full py-3 rounded-2xl bg-neutral-100 text-neutral-800 text-xs font-semibold flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <QrCode className="w-4 h-4" />
                <span>Mostrar código QR de {paymentMethod === 'YAPE' ? 'Yape' : 'Plin'}</span>
              </button>
            )}
          </div>

          {/* Switch: ¿Información del cliente? */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between py-1">
              <label
                htmlFor="mobile-customer-switch"
                className="text-sm font-medium text-neutral-900 cursor-pointer select-none"
              >
                ¿Información del cliente?
              </label>
              <button
                id="mobile-customer-switch"
                type="button"
                role="switch"
                aria-checked={showCustomerInfo}
                onClick={() => {
                  const next = !showCustomerInfo;
                  setShowCustomerInfo(next);
                  if (!next) {
                    setCustomerName('');
                    setCustomerContact('');
                  }
                }}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showCustomerInfo ? 'bg-neutral-950' : 'bg-neutral-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    showCustomerInfo ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {showCustomerInfo && (
              <div className="space-y-2.5 animate-in fade-in duration-150">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre del cliente..."
                  className="w-full bg-neutral-50 rounded-2xl px-4 py-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
                />
                <input
                  type="tel"
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                  placeholder="Número de teléfono..."
                  className="w-full bg-neutral-50 rounded-2xl px-4 py-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Detalle de la venta (siempre visible debajo del switch) */}
          <div className="space-y-2">
            <label
              htmlFor="mobile-sale-notes"
              className="text-xs font-medium text-neutral-400 block"
            >
              Detalle de la venta
            </label>
            <textarea
              id="mobile-sale-notes"
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              placeholder="Escribe notas o detalles de la venta..."
              rows={2}
              className="w-full bg-neutral-50 rounded-2xl px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none resize-none"
            />
          </div>

          {/* Botón principal de cobro: Cápsula negra ancha */}
          <button
            type="button"
            onClick={handleProcessSale}
            disabled={isProcessingSale || cart.length === 0}
            className="bg-neutral-950 text-white rounded-2xl py-4 font-semibold w-full text-sm disabled:opacity-40 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {isProcessingSale ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Procesando cobro...</span>
              </>
            ) : (
              <span>Registrar {formatCurrency(finalTotal, currentInventory?.currency)}</span>
            )}
          </button>
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
            TERMINAL OPERATIVA // CHECKOUT
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E3A5F] uppercase">
            Punto de Venta & Caja
          </h1>
          <p className="text-xs text-[#616161] font-light mt-0.5">
            Registro ágil de transacciones en unidades o cajas fraccionables, emisión de comprobantes y descuento automático de stock.
          </p>
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
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#1E3A5F] font-bold block">
                CATÁLOGO ACTIVO
              </span>
              <span className="text-xs text-[#616161]">{products.length} ítems indexados</span>
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
                {searchResults.map(p => {
                  const isBox = p.unit_type === 'BOX' && Number(p.units_per_box) > 0;
                  const breakdown = getBoxBreakdown(p);
                  const unitPriceEquiv = isBox ? p.price / Number(p.units_per_box || 1) : p.price;

                  return (
                    <div
                      key={p.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white transition-colors"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[#1E3A5F] uppercase truncate">{p.name}</p>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase bg-[#1E3A5F] text-white shrink-0">
                            {isBox ? `CAJA (${p.units_per_box} UND)` : 'UNIDAD'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#616161] font-mono mt-0.5">
                          <span className="font-semibold">{p.code}</span>
                          <span>•</span>
                          <span>
                            Stock: <strong className="text-[#1E3A5F] font-semibold">{formatStockDisplay(p)}</strong>
                            {isBox && breakdown.breakdownLabel ? ` (${breakdown.breakdownLabel})` : ''}
                          </span>
                          <span>•</span>
                          <span className="text-[#1E3A5F] font-bold">
                            {formatCurrency(p.price, currentInventory?.currency)}
                            {isBox ? ` / caja (${formatCurrency(unitPriceEquiv, currentInventory?.currency)} / und)` : ''}
                          </span>
                        </div>
                      </div>

                      {isBox ? (
                        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
                          {Number(p.stock) >= 1 && (
                            <button
                              type="button"
                              onClick={() => addToCart(p, 'BOX')}
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 min-h-[38px] bg-[#1E3A5F] hover:bg-[#152a45] text-white text-[11px] font-mono uppercase tracking-wider rounded-xl shadow-xs active:scale-95 transition-all"
                              title="Vender por caja completa"
                            >
                              <Layers className="w-3.5 h-3.5 text-[#E8B4A0]" /> +1 Caja
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => addToCart(p, 'UNIT')}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 min-h-[38px] bg-white hover:bg-[#F8F9FA] text-[#1E3A5F] border border-[#1E3A5F] text-[11px] font-mono uppercase tracking-wider rounded-xl shadow-xs active:scale-95 transition-all"
                            title="Vender por unidades sueltas"
                          >
                            <Package className="w-3.5 h-3.5 text-[#1E3A5F]" /> +1 Und
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(p, 'UNIT')}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3 min-h-[38px] bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider rounded-xl shadow-xs active:scale-95 transition-all flex-shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#E8B4A0]" /> Añadir
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tabla / Lista de Ítems en el Carrito */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#E8B4A0]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F]">
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
              <div className="divide-y divide-[#E5E7EB] max-h-[230px] overflow-y-auto overscroll-contain pr-1">
                {cart.map(item => {
                  const isBox = item.product.unit_type === 'BOX' && Number(item.product.units_per_box) > 0;
                  const upb = Math.max(1, Number(item.product.units_per_box || 1));
                  const unitPrice = isBox ? item.product.price / upb : item.product.price;
                  const itemSubtotal = Number((item.product.price * item.quantity).toFixed(2));
                  const breakdown = getBoxBreakdown(item.product);

                  return (
                    <div key={item.product.id} className="py-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-[#1E3A5F] uppercase truncate">{item.product.name}</p>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase bg-[#1E3A5F]/10 text-[#1E3A5F] font-semibold">
                              {isBox ? `CAJA (1 caja = ${upb} und)` : 'UNIDAD'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#616161] font-mono mt-0.5">
                            <span className="font-semibold">{item.product.code}</span> •{' '}
                            <span className="font-semibold">
                              {formatCurrency(item.product.price, currentInventory?.currency)}
                              {isBox ? ` / caja (${formatCurrency(unitPrice, currentInventory?.currency)} / und)` : ' / und'}
                            </span>{' '}
                            • Disponible: <strong className="text-[#1E3A5F]">{formatStockDisplay(item.product)}</strong>
                            {isBox && breakdown.breakdownLabel ? ` (${breakdown.breakdownLabel})` : ''}
                          </p>
                        </div>

                        {/* Subtotal y Botón Quitar */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-mono font-bold text-[#1E3A5F]">
                              {formatCurrency(itemSubtotal, currentInventory?.currency)}
                            </p>
                            <span className="text-[10px] font-mono text-[#616161] block">
                              {isBox
                                ? `Descuenta: ${formatCleanDecimal(item.quantity, 2)} ${item.quantity === 1 ? 'caja' : 'cajas'}`
                                : `Descuenta: ${item.quantity} und`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-1.5 text-[#616161] hover:text-rose-600 transition-colors"
                            title="Quitar ítem"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Controles de Cantidad según Tipo (UNIT vs BOX fraccionable) */}
                      {!isBox ? (
                        <div className="flex items-center justify-between bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl px-3.5 py-2 font-mono text-xs">
                          <span className="text-[11px] text-[#616161] uppercase">Cantidad (Unidades):</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateUnitCartQuantity(item.product.id, item.quantity - 1)}
                              className="w-7 h-7 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center text-[#1E3A5F] hover:border-[#1E3A5F] transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={item.product.stock}
                              step="1"
                              value={item.quantity}
                              onChange={e => updateUnitCartQuantity(item.product.id, parseInt(e.target.value, 10) || 1)}
                              className="w-16 h-7 text-center bg-white border border-[#E5E7EB] rounded-lg text-xs font-mono font-bold text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                            />
                            <button
                              type="button"
                              onClick={() => updateUnitCartQuantity(item.product.id, item.quantity + 1)}
                              className="w-7 h-7 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center text-[#1E3A5F] hover:border-[#1E3A5F] transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[11px] text-[#616161]">und</span>
                          </div>
                        </div>
                      ) : (
                        /* Selector Dual para Producto tipo CAJA: Cajas completas + Unidades sueltas */
                        <div className="p-3 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                          {/* Control de Cajas */}
                          <div className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-lg px-3 py-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase text-[#1E3A5F] block">Cajas a vender</span>
                              <span className="text-[10px] text-[#616161]">
                                {formatCurrency(item.product.price, currentInventory?.currency)} / caja
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  updateBoxCartAmounts(item.product.id, Math.max(0, item.boxes - 1), item.looseUnits)
                                }
                                className="w-7 h-7 rounded-lg bg-[#F8F9FA] border border-[#E5E7EB] flex items-center justify-center text-[#1E3A5F] hover:border-[#1E3A5F]"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.boxes}
                                onChange={e =>
                                  updateBoxCartAmounts(
                                    item.product.id,
                                    parseFloat(e.target.value) || 0,
                                    item.looseUnits
                                  )
                                }
                                className="w-16 h-7 text-center bg-white border border-[#E5E7EB] rounded-lg text-xs font-mono font-bold text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                              />
                              <button
                                type="button"
                                onClick={() => updateBoxCartAmounts(item.product.id, item.boxes + 1, item.looseUnits)}
                                className="w-7 h-7 rounded-lg bg-[#F8F9FA] border border-[#E5E7EB] flex items-center justify-center text-[#1E3A5F] hover:border-[#1E3A5F]"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Control de Unidades Sueltas */}
                          <div className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-lg px-3 py-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase text-[#1E3A5F] block">
                                Unidades sueltas
                              </span>
                              <span className="text-[10px] text-[#616161]">
                                {formatCurrency(unitPrice, currentInventory?.currency)} / und
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  updateBoxCartAmounts(item.product.id, item.boxes, Math.max(0, item.looseUnits - 1))
                                }
                                className="w-7 h-7 rounded-lg bg-[#F8F9FA] border border-[#E5E7EB] flex items-center justify-center text-[#1E3A5F] hover:border-[#1E3A5F]"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.looseUnits}
                                onChange={e =>
                                  updateBoxCartAmounts(
                                    item.product.id,
                                    item.boxes,
                                    parseInt(e.target.value, 10) || 0
                                  )
                                }
                                className="w-16 h-7 text-center bg-white border border-[#E5E7EB] rounded-lg text-xs font-mono font-bold text-[#1E3A5F] focus:outline-none focus:border-[#1E3A5F]"
                              />
                              <button
                                type="button"
                                onClick={() => updateBoxCartAmounts(item.product.id, item.boxes, item.looseUnits + 1)}
                                className="w-7 h-7 rounded-lg bg-[#F8F9FA] border border-[#E5E7EB] flex items-center justify-center text-[#1E3A5F] hover:border-[#1E3A5F]"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Resumen de Cobro y Checkout */}
        <div className="space-y-4">
          <form onSubmit={handleProcessSale} className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E5E7EB]">
              <Receipt className="w-4 h-4 text-[#E8B4A0]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F]">
                Liquidación de Ticket
              </h3>
            </div>

            {/* Total Destacado y Desglose */}
            <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] space-y-2 font-mono">
              <div className="flex items-center justify-between text-xs text-[#616161]">
                <span>Subtotal ({cartTotalItemsCount} {cartTotalItemsCount === 1 ? 'ítem' : 'ítems'}):</span>
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
                <span className="text-xs uppercase tracking-wider text-[#1E3A5F] font-bold">TOTAL COBRO:</span>
                <span className="text-2xl font-bold text-[#1E3A5F]">
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

            {/* Switch: ¿Información del cliente? y Detalle de la venta */}
            <div className="space-y-3 pt-2 border-t border-[#E5E7EB]">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="desktop-customer-switch"
                  className="text-[11px] uppercase tracking-wider font-medium text-[#1E3A5F] cursor-pointer select-none"
                >
                  ¿Información del cliente?
                </label>
                <button
                  id="desktop-customer-switch"
                  type="button"
                  role="switch"
                  aria-checked={showCustomerInfo}
                  onClick={() => {
                    const next = !showCustomerInfo;
                    setShowCustomerInfo(next);
                    if (!next) {
                      setCustomerName('');
                      setCustomerContact('');
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    showCustomerInfo ? 'bg-[#1E3A5F]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      showCustomerInfo ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {showCustomerInfo && (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#616161] mb-1">
                      Nombre del cliente
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
                      Número de teléfono
                    </label>
                    <input
                      type="tel"
                      value={customerContact}
                      onChange={e => setCustomerContact(e.target.value)}
                      placeholder="Ej: 999888777"
                      className="w-full bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#616161] mb-1">
                  Detalle de la venta
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
      </div>

      {/* MODAL DE PAGO YAPE / PLIN */}
      {qrModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="mobile-dark-modal bg-white border border-[#E5E7EB] rounded-2xl w-full max-w-sm sm:max-w-md p-6 shadow-xl space-y-4 text-center">
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

            {/* Cuerpo Operativo */}
            <div className="overflow-y-auto space-y-4">
              {/* Monto exacto */}
              <div className="mobile-flat-row p-3 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB]">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#616161] block">
                  MONTO EXACTO A TRANSFERIR
                </span>
                <span className="text-2xl sm:text-3xl font-light max-md:font-bold text-[#1E3A5F]">
                  {formatCurrency(finalTotal, currentInventory?.currency)}
                </span>
              </div>

              {/* QR Grande */}
              <div className="flex flex-col items-center justify-center">
                {((qrModalType === 'YAPE' && currentInventory?.yape_qr_url) ||
                  (qrModalType === 'PLIN' && currentInventory?.plin_qr_url)) ? (
                  <div className="qr-light-surface w-64 h-64 sm:w-72 sm:h-72 p-3 bg-white rounded-2xl shadow-sm border border-[#E5E7EB] flex items-center justify-center overflow-hidden">
                    <img
                      src={qrModalType === 'YAPE' ? currentInventory?.yape_qr_url! : currentInventory?.plin_qr_url!}
                      alt={`Código QR ${qrModalType}`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
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
                <div className="mobile-flat-row p-3 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] flex items-center justify-between font-mono">
                  <div className="text-left">
                    <span className="text-[10px] text-[#616161] block uppercase">Número asociado</span>
                    <span className="text-base font-light max-md:font-semibold text-[#1E3A5F]">
                      {qrModalType === 'YAPE' ? currentInventory?.yape_phone : currentInventory?.plin_phone}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyPaymentPhone((qrModalType === 'YAPE' ? currentInventory?.yape_phone : currentInventory?.plin_phone)!)}
                    className="mobile-inline-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-xl text-xs uppercase tracking-wider text-[#1E3A5F] hover:bg-[#F8F9FA] transition-colors"
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
                className="mobile-primary-btn w-full py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white uppercase tracking-wider text-xs rounded-xl transition-colors font-mono"
              >
                Listo // Volver al Cobro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Minimalista de Confirmación de Cobro (Auto-dismiss 1.5s) */}
      <SuccessCheckModal
        isOpen={Boolean(saleSuccessData)}
        onClose={() => {
          setCart([]);
          setPaymentMethod('CASH');
          setShowCustomerInfo(false);
          setCustomerName('');
          setCustomerContact('');
          setSaleNotes('');
          setAppliedCoupon(null);
          setCouponMessage(null);
          setCouponCodeInput('');
          setSearchTerm('');
          setSaleSuccessData(null);
        }}
      />

      {/* Escáner de Barra / QR para añadir al carrito */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanProductForSale}
        title="Escanear Producto para Venta"
        instructions="Apunta la cámara al código de barra o QR para añadirlo directamente al carrito."
      />
    </>
  );
};
