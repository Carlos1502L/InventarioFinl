import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Package,
  Banknote,
  Smartphone
} from 'lucide-react';
import { Product, PaymentMethod, Coupon, Inventory } from '../types/database';
import {
  supabase,
  formatCurrency,
  logAuditAction,
  formatCleanDecimal,
  formatStockDisplay,
  getBoxBreakdown
} from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { matchesAnyField, normalizeText } from '../utils/searchUtils';
import { BarcodeScannerModal } from '../components/modals/BarcodeScannerModal';
import { SuccessCheckModal } from '../components/modals/SuccessCheckModal';
import { saveSaleLocally, isNetworkOrOfflineError, QueuedSalePayload } from '../services/offlineSync';
import { showAppToast } from '../components/ui/ToastNotification';
import { Switch } from '../components/common/Switch';
import jsPDF from 'jspdf';
import { useBackdropDismiss, useLatestValue, useModalEscape, useModalMotion } from '../components/modals/modalMotion';

interface QrPaymentModalProps {
  qrModalType: 'YAPE' | 'PLIN' | null;
  inventory: Inventory | null;
  finalTotal: number;
  copiedText: boolean;
  onCopyPhone: (phone: string) => void;
  onClose: () => void;
}

const QrPaymentModal: React.FC<QrPaymentModalProps> = ({
  qrModalType,
  inventory,
  finalTotal,
  copiedText,
  onCopyPhone,
  onClose
}) => {
  const activeType = useLatestValue(qrModalType);
  const { backdropMotion, panelMotion } = useModalMotion();
  const backdropDismiss = useBackdropDismiss(onClose, Boolean(qrModalType));
  useModalEscape(Boolean(qrModalType), onClose);

  return (
    <AnimatePresence>
      {qrModalType && activeType && (
        <motion.div
          {...backdropMotion}
          {...backdropDismiss}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
        >
          <motion.div
            {...panelMotion}
            onClick={(e) => e.stopPropagation()}
            className="mobile-dark-modal bg-white border border-slate-200 rounded-2xl w-full max-w-sm sm:max-w-md p-6 shadow-xl space-y-4 text-center font-sans"
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-900 text-white">
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-slate-900 text-base tracking-tight">
                    {activeType === 'YAPE' ? 'Cobro con Yape' : 'Cobro con Plin'}
                  </h4>
                  <p className="text-[11px] text-slate-500">Presenta el código QR al cliente</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuerpo Operativo */}
            <div className="overflow-y-auto space-y-4">
              {/* Monto exacto */}
              <div className="mobile-flat-row p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-medium text-slate-500 block">
                  Monto exacto a transferir
                </span>
                <span className="text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900 block mt-0.5">
                  {formatCurrency(finalTotal, inventory?.currency)}
                </span>
              </div>

              {/* QR Grande */}
              <div className="flex flex-col items-center justify-center">
                {((activeType === 'YAPE' && inventory?.yape_qr_url) ||
                  (activeType === 'PLIN' && inventory?.plin_qr_url)) ? (
                  <div className="qr-light-surface w-64 h-64 sm:w-72 sm:h-72 p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden">
                    <img
                      src={activeType === 'YAPE' ? inventory?.yape_qr_url! : inventory?.plin_qr_url!}
                      alt={`Código QR ${activeType}`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : (
                  <div className="w-64 h-64 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
                    <QrCode className="w-12 h-12 text-slate-300" />
                    <p className="font-semibold text-xs text-slate-800">
                      Sin QR cargado para {activeType}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Carga la imagen del QR en <strong>Configuración &gt; Pasarela de Pagos</strong>.
                    </p>
                  </div>
                )}
              </div>

              {/* Número telefónico */}
              {((activeType === 'YAPE' && inventory?.yape_phone) ||
                (activeType === 'PLIN' && inventory?.plin_phone)) && (
                <div className="mobile-flat-row p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="text-left">
                    <span className="text-[11px] text-slate-500 block">Número asociado</span>
                    <span className="text-base font-mono font-semibold text-slate-900">
                      {activeType === 'YAPE' ? inventory?.yape_phone : inventory?.plin_phone}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCopyPhone((activeType === 'YAPE' ? inventory?.yape_phone : inventory?.plin_phone)!)}
                    className="mobile-inline-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    {copiedText ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedText ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              )}

              {inventory?.payment_instructions && (
                <p className="text-[11px] text-slate-500 italic">
                  "{inventory.payment_instructions}"
                </p>
              )}

              <button
                type="button"
                onClick={onClose}
                className="mobile-primary-btn w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
              >
                Volver al cobro
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

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
    isOffline?: boolean;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Escáner Modal para Venta Rápida por Cámara
  const [scannerOpen, setScannerOpen] = useState(false);

  // Modal de Pasarela Rápida Yape / Plin (Grande y legible para cliente)
  const [qrModalType, setQrModalType] = useState<'YAPE' | 'PLIN' | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Búsqueda de Productos para el Carrito (RF-SEARCH-016: Tolerancia a acentos)
  const searchResults = useMemo(() => {
    const normTerm = normalizeText(searchTerm);
    if (!normTerm) return [];
    return products
      .filter(p => (p.status === 'ACTIVE' || !p.status) && Number(p.stock) > 0)
      .filter(p => matchesAnyField([p.name, p.code, (p as any).sku], normTerm))
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

  // PROCESAR VENTA CON PROTECCIÓN DE CONCURRENCIA TRANSACCIONAL Y FAILOVER OFFLINE
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

      const rpcPayload: QueuedSalePayload = {
        p_inventory_id: currentInventory.id,
        p_seller_id: user.id,
        p_seller_email: user.email || null,
        p_total_amount: finalTotal,
        p_payment_method: paymentMethod,
        p_customer_name: customerName.trim() || null,
        p_customer_contact: customerContact.trim() || null,
        p_notes: saleNotes.trim() || null,
        p_items: saleItemsPayload,
        p_coupon_code: appliedCoupon?.code || null,
        p_discount_amount: discountAmount
      };

      let saleIdCreated: string | null = null;
      let isOfflineSale = false;

      // RF-1.1: Evaluación de conectividad previa
      const currentOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (!currentOnline) {
        // Sin red: omitir llamada remota y derivar inmediatamente a IndexedDB
        const localId = await saveSaleLocally(rpcPayload);
        saleIdCreated = `local-${localId}-${Date.now()}`;
        isOfflineSale = true;
      } else {
        // RF-1.2: Llamada con failover a la RPC process_pos_sale
        try {
          const { data: rpcRes, error: rpcError } = await supabase.rpc('process_pos_sale', rpcPayload);

          if (rpcError) {
            // RF-1.3: Captura de fallos de red / timeout / offline
            if (isNetworkOrOfflineError(rpcError)) {
              console.warn('[POS] Falla de red en RPC process_pos_sale, derivando a IndexedDB:', rpcError);
              const localId = await saveSaleLocally(rpcPayload);
              saleIdCreated = `local-${localId}-${Date.now()}`;
              isOfflineSale = true;
            } else {
              // RF-1.4: Regla de negocio o validación de BD (concurrencia, stock insuficiente) -> propagar sin encolar
              if (rpcError.message && rpcError.message.toLowerCase().includes('stock insuficiente')) {
                throw new Error(
                  `⚠️ Concurrencia detectada: ${rpcError.message}. Otro usuario acaba de comprar este artículo o no hay suficientes existencias.`
                );
              }
              throw rpcError;
            }
          } else if (rpcRes && rpcRes.sale_id) {
            saleIdCreated = rpcRes.sale_id;
            isOfflineSale = false;
          }
        } catch (rpcCatchErr: any) {
          if (isNetworkOrOfflineError(rpcCatchErr)) {
            console.warn('[POS] Excepción de red en llamada RPC, derivando a IndexedDB:', rpcCatchErr);
            const localId = await saveSaleLocally(rpcPayload);
            saleIdCreated = `local-${localId}-${Date.now()}`;
            isOfflineSale = true;
          } else {
            // Propagar errores de validación de negocio
            throw rpcCatchErr;
          }
        }
      }

      // Registro de auditoría solo si la llamada fue en vivo a Supabase
      if (!isOfflineSale) {
        try {
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
        } catch (auditErr) {
          console.warn('No se pudo registrar log de auditoría en vivo:', auditErr);
        }
      }

      const receiptItemsSnapshot = saleItemsPayload.map(i => ({
        label: i.product_name,
        subtotal: i.subtotal
      }));

      // RF-1.5: Cierre de flujo idéntico (vaciar carrito, cerrar modal, resetear campos)
      const receiptNum = isOfflineSale
        ? `OFF-${Date.now().toString().slice(-6)}`
        : `VTA-${Date.now().toString().slice(-6)}`;

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
        items: receiptItemsSnapshot,
        isOffline: isOfflineSale
      });

      // RF-2: Notificación toast específica para venta offline
      if (isOfflineSale) {
        showAppToast(
          'Venta guardada en este dispositivo (sin conexión). Se sincronizará automáticamente.',
          'info',
          4500
        );
      }

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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-white">
                Terminal de Cobro
              </h1>
              <span
                className={`w-2 h-2 rounded-full transition-colors ${
                  isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
                title={isOnline ? 'En línea' : 'Modo fuera de línea'}
              />
            </div>

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
                className="w-12 h-12 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-2xl text-white active:scale-95 transition-all shrink-0 shadow-sm"
              >
                <Camera className="w-5 h-5 text-white" />
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
              <Switch
                id="mobile-customer-switch"
                size="lg"
                activeColor="bg-neutral-950"
                checked={showCustomerInfo}
                onChange={(next) => {
                  setShowCustomerInfo(next);
                  if (!next) {
                    setCustomerName('');
                    setCustomerContact('');
                  }
                }}
                ariaLabel="¿Información del cliente?"
              />
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
          VISTA DE ESCRITORIO (>= 768px / hidden md:block) - Ui CLINICAL BLUEPRINT
         ========================================================= */}
      <div className="hidden md:block space-y-5 pb-28 sm:pb-12 max-w-[1440px] mx-auto font-sans text-slate-900">
      {/* 1. Encabezado POS Directo (Sin eyebrow) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-slate-900">
            Punto de venta
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cobro fraccionable por unidades o cajas, cupones de descuento y emisión de comprobantes.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
              isOnline
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isOnline ? 'Terminal conectada' : 'Modo offline activo'}
          </span>
          <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 tabular-nums">
            {products.length} SKUs
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-xs text-red-700">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 p-1 rounded-md hover:bg-red-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Terminal de Punto de Venta (POS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Columna Izquierda (7/8 cols): Búsqueda Rápida y Orden */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Tarjeta de Búsqueda */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-ui-card space-y-3.5">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar producto por nombre, SKU o código de barras..."
                  className="w-full min-h-[40px] bg-slate-50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-900 rounded-xl pl-10 pr-8 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-[background-color,border-color,box-shadow] duration-150"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-900 p-0.5 rounded hover:bg-slate-200/60 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 min-h-[40px] bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-medium transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] whitespace-nowrap cursor-pointer"
                title="Escanear código"
              >
                <Camera className="w-4 h-4 text-slate-700" />
                <span>Escanear</span>
              </button>
            </div>

            {/* Resultados de Búsqueda Desplegables */}
            {searchResults.length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {searchResults.map(p => {
                  const isBox = p.unit_type === 'BOX' && Number(p.units_per_box) > 0;
                  const breakdown = getBoxBreakdown(p);
                  const unitPriceEquiv = isBox ? p.price / Number(p.units_per_box || 1) : p.price;

                  return (
                    <div
                      key={p.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50 transition-colors duration-150"
                    >
                      <div className="min-w-0 pr-2 flex-1">
                        <div className="flex items-center gap-2">
                          <p title={p.name} className="text-[13px] font-semibold text-slate-900 truncate">
                            {p.name}
                          </p>
                          <span className={`font-mono px-1.5 py-px rounded text-[10px] font-medium border shrink-0 ${
                            isBox
                              ? 'bg-slate-100 border-slate-200 text-slate-700'
                              : 'bg-slate-50 border-slate-200/80 text-slate-600'
                          }`}>
                            {isBox ? `BOX · ${p.units_per_box}u` : 'UNIT'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5 tabular-nums">
                          <span className="font-mono text-slate-700 font-medium">{p.code}</span>
                          <span>·</span>
                          <span>
                            Stock: <strong className="text-slate-900 font-semibold">{formatStockDisplay(p)}</strong>
                            {isBox && breakdown.breakdownLabel ? ` (${breakdown.breakdownLabel})` : ''}
                          </span>
                          <span>·</span>
                          <span className="text-slate-900 font-semibold">
                            {formatCurrency(p.price, currentInventory?.currency)}
                            {isBox ? ` / caja (${formatCurrency(unitPriceEquiv, currentInventory?.currency)} / u)` : ''}
                          </span>
                        </div>
                      </div>

                      {isBox ? (
                        <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
                          {Number(p.stock) >= 1 && (
                            <button
                              type="button"
                              onClick={() => addToCart(p, 'BOX')}
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 min-h-[34px] bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-medium rounded-lg active:scale-[0.97] transition-[background-color,transform] duration-150 cursor-pointer"
                              title="Vender por caja completa"
                            >
                              <Layers className="w-3.5 h-3.5" /> +1 Caja
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => addToCart(p, 'UNIT')}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 min-h-[34px] bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 hover:border-slate-300 text-[11px] font-medium rounded-lg active:scale-[0.97] transition-[background-color,border-color,transform] duration-150 cursor-pointer"
                            title="Vender por unidades sueltas"
                          >
                            <Package className="w-3.5 h-3.5" /> +1 Und
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(p, 'UNIT')}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3.5 min-h-[34px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg active:scale-[0.97] transition-[background-color,transform] duration-150 flex-shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Añadir
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lista de Ítems en la Orden */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-ui-card space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Orden actual
                </h3>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium tabular-nums">
                  {cart.length} {cart.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-slate-500 hover:text-red-600 transition-colors font-medium cursor-pointer"
                >
                  Vaciar carrito
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <ShoppingCart className="w-9 h-9 mx-auto stroke-[1.2] text-slate-300" />
                <p className="text-xs font-semibold text-slate-900">El carrito de caja está vacío</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Busca por nombre o SKU arriba o utiliza el escáner para agregar ítems a la orden.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto overscroll-contain pr-1">
                <AnimatePresence initial={false}>
                  {cart.map(item => {
                    const isBox = item.product.unit_type === 'BOX' && Number(item.product.units_per_box) > 0;
                    const upb = Math.max(1, Number(item.product.units_per_box || 1));
                    const unitPrice = isBox ? item.product.price / upb : item.product.price;
                    const itemSubtotal = Number((item.product.price * item.quantity).toFixed(2));
                    const breakdown = getBoxBreakdown(item.product);

                    return (
                      <motion.div
                        key={item.product.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4, height: 0, overflow: 'hidden' }}
                        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                        className="py-3.5 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p title={item.product.name} className="text-[13px] font-semibold text-slate-900 truncate">
                                {item.product.name}
                              </p>
                              <span className={`font-mono px-1.5 py-px rounded text-[10px] font-medium border shrink-0 ${
                                isBox
                                  ? 'bg-slate-100 border-slate-200 text-slate-700'
                                  : 'bg-slate-50 border-slate-200/80 text-slate-500'
                              }`}>
                                {isBox ? `BOX · ${upb}u` : 'UNIT'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                              <span className="font-mono text-slate-700 font-medium">{item.product.code}</span> ·{' '}
                              <span className="font-semibold text-slate-800">
                                {formatCurrency(item.product.price, currentInventory?.currency)}
                                {isBox ? ` / caja (${formatCurrency(unitPrice, currentInventory?.currency)} / u)` : ' / u'}
                              </span>{' '}
                              · Disp: <strong className="text-slate-800 font-medium">{formatStockDisplay(item.product)}</strong>
                              {isBox && breakdown.breakdownLabel ? ` (${breakdown.breakdownLabel})` : ''}
                            </p>
                          </div>

                          {/* Subtotal y Botón Quitar */}
                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-900 tabular-nums">
                                {formatCurrency(itemSubtotal, currentInventory?.currency)}
                              </p>
                              <span className="text-[10px] font-mono text-slate-500 block tabular-nums">
                                {isBox
                                  ? `-${formatCleanDecimal(item.quantity, 2)} ${item.quantity === 1 ? 'caja' : 'cajas'}`
                                  : `-${item.quantity} und`}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.product.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-150 cursor-pointer"
                              title="Quitar ítem"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Controles planos de Cantidad según Tipo (UNIT vs BOX fraccionable) */}
                        {!isBox ? (
                          <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 text-xs">
                            <span className="text-[11px] text-slate-600 font-medium">Cantidad (unidades)</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateUnitCartQuantity(item.product.id, item.quantity - 1)}
                                className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-800 hover:bg-slate-100 active:scale-[0.95] transition-[background-color,transform] duration-150 cursor-pointer"
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
                                className="w-16 h-7 text-center font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                              />
                              <button
                                type="button"
                                onClick={() => updateUnitCartQuantity(item.product.id, item.quantity + 1)}
                                className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-800 hover:bg-slate-100 active:scale-[0.95] transition-[background-color,transform] duration-150 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Selector Dual plano para Producto tipo CAJA */
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
                              <div className="min-w-0 pr-2">
                                <span className="text-[11px] font-semibold text-slate-800 block">Cajas</span>
                                <span className="text-[10px] text-slate-500 tabular-nums">
                                  {formatCurrency(item.product.price, currentInventory?.currency)} / caja
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateBoxCartAmounts(item.product.id, Math.max(0, item.boxes - 1), item.looseUnits)
                                  }
                                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-800 hover:bg-slate-100 active:scale-[0.95] transition-[background-color,transform] duration-150 cursor-pointer"
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
                                  className="w-14 h-7 text-center font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateBoxCartAmounts(item.product.id, item.boxes + 1, item.looseUnits)}
                                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-800 hover:bg-slate-100 active:scale-[0.95] transition-[background-color,transform] duration-150 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
                              <div className="min-w-0 pr-2">
                                <span className="text-[11px] font-semibold text-slate-800 block">Unidades sueltas</span>
                                <span className="text-[10px] text-slate-500 tabular-nums">
                                  {formatCurrency(unitPrice, currentInventory?.currency)} / und
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateBoxCartAmounts(item.product.id, item.boxes, Math.max(0, item.looseUnits - 1))
                                  }
                                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-800 hover:bg-slate-100 active:scale-[0.95] transition-[background-color,transform] duration-150 cursor-pointer"
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
                                  className="w-14 h-7 text-center font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateBoxCartAmounts(item.product.id, item.boxes, item.looseUnits + 1)}
                                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-800 hover:bg-slate-100 active:scale-[0.95] transition-[background-color,transform] duration-150 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha (4/5 cols): Liquidación de Ticket Sticky */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          <form onSubmit={handleProcessSale} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-ui-card space-y-4 sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Resumen de cobro
                </h3>
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                {currentInventory?.currency || 'PEN'}
              </span>
            </div>

            {/* Total Destacado y Desglose */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Subtotal ({cartTotalItemsCount} {cartTotalItemsCount === 1 ? 'ítem' : 'ítems'})</span>
                <span className="text-slate-900 font-medium tabular-nums">
                  {formatCurrency(cartSubtotal, currentInventory?.currency)}
                </span>
              </div>

              {appliedCoupon && (
                <div className="flex items-center justify-between text-xs text-emerald-700">
                  <span className="flex items-center gap-1 font-medium">
                    <Tag className="w-3.5 h-3.5" /> Cupón <span className="font-mono">{appliedCoupon.code}</span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    -{formatCurrency(discountAmount, currentInventory?.currency)}
                  </span>
                </div>
              )}

              <div className="flex items-baseline justify-between pt-2.5 border-t border-slate-200">
                <span className="text-xs font-semibold text-slate-600">Total a cobrar</span>
                <span className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-[-0.03em] tabular-nums">
                  {formatCurrency(finalTotal, currentInventory?.currency)}
                </span>
              </div>
            </div>

            {/* Cupón de Descuento */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-medium text-slate-600">
                Cupón promocional
              </label>

              {appliedCoupon ? (
                <div className="px-3 py-2 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="font-mono text-xs text-emerald-900 font-semibold">
                      {appliedCoupon.code}
                    </span>
                    <span className="text-[11px] text-emerald-700 tabular-nums">
                      ({appliedCoupon.discount_type === 'PERCENTAGE' ? `-${appliedCoupon.discount_value}%` : `-${formatCurrency(appliedCoupon.discount_value, currentInventory?.currency)}`})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="p-1 text-emerald-700 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                    title="Quitar cupón"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={e => setCouponCodeInput(e.target.value.toUpperCase())}
                    placeholder="Código (Ej: DESC10)"
                    className="flex-1 min-h-[38px] bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-900 rounded-xl px-3 py-1.5 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 outline-none transition-[background-color,border-color] duration-150"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponCodeInput.trim()}
                    className="px-3.5 min-h-[38px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-xl transition-[background-color,transform] duration-150 disabled:opacity-45 active:scale-[0.97] whitespace-nowrap cursor-pointer"
                  >
                    {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aplicar'}
                  </button>
                </div>
              )}

              {couponMessage && (
                <p className={`text-[11px] font-medium ${couponMessage.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                  {couponMessage.text}
                </p>
              )}
            </div>

            {/* Método de Pago (Lucide icons, sin emojis Unicode) */}
            <div className="pt-2 border-t border-slate-200">
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Método de pago
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CASH', label: 'Efectivo', Icon: Banknote },
                  { id: 'YAPE', label: 'Yape', Icon: QrCode },
                  { id: 'PLIN', label: 'Plin', Icon: Smartphone }
                ].map(m => {
                  const IconComponent = m.Icon;
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.id as PaymentMethod);
                        if (m.id === 'YAPE') setQrModalType('YAPE');
                        if (m.id === 'PLIN') setQrModalType('PLIN');
                      }}
                      className={`py-2.5 px-2 rounded-xl text-xs border flex flex-col items-center justify-center gap-1 transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] cursor-pointer ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900'
                      }`}
                    >
                      <IconComponent className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-600'}`} />
                      <span className="text-[11px] font-medium">{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {(paymentMethod === 'YAPE' || paymentMethod === 'PLIN') && (
                <button
                  type="button"
                  onClick={() => setQrModalType(paymentMethod)}
                  className="w-full mt-2 py-2 px-3 bg-slate-100 hover:bg-slate-200/70 text-slate-900 border border-slate-200 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-slate-700" /> Mostrar QR {paymentMethod}
                </button>
              )}
            </div>

            {/* Switch: ¿Información del cliente? y Detalle de la venta */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="desktop-customer-switch"
                  className="text-xs font-medium text-slate-600 cursor-pointer select-none"
                >
                  Datos del cliente
                </label>
                <Switch
                  id="desktop-customer-switch"
                  size="md"
                  activeColor="bg-slate-900"
                  checked={showCustomerInfo}
                  onChange={(next) => {
                    setShowCustomerInfo(next);
                    if (!next) {
                      setCustomerName('');
                      setCustomerContact('');
                    }
                  }}
                  ariaLabel="¿Información del cliente?"
                />
              </div>

              <AnimatePresence initial={false}>
                {showCustomerInfo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                    className="space-y-2.5 overflow-hidden"
                  >
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Nombre completo
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="w-full min-h-[36px] bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-900 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none transition-[background-color,border-color] duration-150"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={customerContact}
                        onChange={e => setCustomerContact(e.target.value)}
                        placeholder="Ej: 999888777"
                        className="w-full min-h-[36px] bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-900 rounded-xl px-3 py-1.5 font-mono text-xs text-slate-900 placeholder:font-sans outline-none transition-[background-color,border-color] duration-150"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Notas de despacho o ticket
                </label>
                <textarea
                  value={saleNotes}
                  onChange={e => setSaleNotes(e.target.value)}
                  placeholder="Detalles de entrega, referencia o comprobante..."
                  rows={2}
                  className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-[background-color,border-color] duration-150"
                />
              </div>
            </div>

            {/* Botón de Confirmación */}
            <button
              type="submit"
              disabled={isProcessingSale || cart.length === 0}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl active:scale-[0.98] disabled:opacity-45 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer"
            >
              {isProcessingSale ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando operación...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirmar venta y cobro</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
      </div>

      {/* MODAL DE PAGO YAPE / PLIN */}
      <QrPaymentModal
        qrModalType={qrModalType}
        inventory={currentInventory}
        finalTotal={finalTotal}
        copiedText={copiedText}
        onCopyPhone={copyPaymentPhone}
        onClose={() => setQrModalType(null)}
      />

      {/* Modal Minimalista de Confirmación de Cobro (Auto-dismiss 1.5s) */}
      <SuccessCheckModal
        isOpen={Boolean(saleSuccessData)}
        label={saleSuccessData?.isOffline ? "Venta guardada (sin conexión)" : "Cobro exitoso"}
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

export default SalesPage;
