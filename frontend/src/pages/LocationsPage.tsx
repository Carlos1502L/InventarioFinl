import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  MapPin,
  Barcode,
  Search,
  ArrowRightLeft,
  Check,
  Trash2,
  Plus,
  Minus,
  AlertCircle,
  Package,
  Layers,
  Camera,
  QrCode,
  Loader2,
  CheckCircle2,
  Inbox,
  ChevronDown
} from 'lucide-react';
import { Product, Location } from '../types/database';
import {
  supabase,
  formatStockDisplay,
  getBoxBreakdown,
  getAssignedLocationStock,
  getPendingLocationStock,
  formatLocationQuantity
} from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { BarcodeScannerModal } from '../components/modals/BarcodeScannerModal';
import { MinimalDropdown } from '../components/ui/MinimalDropdown';

export type LocationSubTab = 'assign' | 'consult' | 'move';

interface BatchAssignItem {
  product: Product;
  quantity: number; // En la unidad operativa del producto (unidades si UNIT, cajas decimales si BOX)
  boxes: number;
  looseUnits: number;
  maxPending: number;
}

interface LocationsPageProps {
  products: Product[];
  locations: Location[];
  onRefresh: () => void;
  initialSubTab?: LocationSubTab;
  initialProduct?: Product | null;
}

export const LocationsPage: React.FC<LocationsPageProps> = ({
  products,
  locations,
  onRefresh,
  initialSubTab = 'assign',
  initialProduct = null
}) => {
  const { currentInventory, user } = useAuth();

  // Sub-módulo activo: 1. Asignar | 2. Consultar | 3. Mover | 4. Estantes QR
  const [subTab, setSubTab] = useState<LocationSubTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // ============================================================================
  // ESTADOS DEL MÓDULO 2: "ASIGNAR UBICACIÓN" (PROCESAMIENTO POR LOTES)
  // ============================================================================
  const assignScanInputRef = useRef<HTMLInputElement>(null);
  const [assignScanCode, setAssignScanCode] = useState('');
  const [batchItems, setBatchItems] = useState<BatchAssignItem[]>([]);
  const [targetAssignLocationId, setTargetAssignLocationId] = useState<string>('');
  const selectedAssignLocation = useMemo(
    () => locations.find((l) => l.id === targetAssignLocationId) || null,
    [locations, targetAssignLocationId]
  );
  const [assignAlert, setAssignAlert] = useState<{ type: 'error' | 'warning' | 'success'; message: string } | null>(null);
  const [isAssigningBatch, setIsAssigningBatch] = useState(false);
  const [isAssignLocDropdownOpen, setIsAssignLocDropdownOpen] = useState(false);
  const assignLocDropdownRef = useRef<HTMLDivElement>(null);
  const [isMoveOriginDropdownOpen, setIsMoveOriginDropdownOpen] = useState(false);
  const moveOriginDropdownRef = useRef<HTMLDivElement>(null);
  const [isMoveDestDropdownOpen, setIsMoveDestDropdownOpen] = useState(false);
  const moveDestDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (assignLocDropdownRef.current && !assignLocDropdownRef.current.contains(target)) {
        setIsAssignLocDropdownOpen(false);
      }
      if (moveOriginDropdownRef.current && !moveOriginDropdownRef.current.contains(target)) {
        setIsMoveOriginDropdownOpen(false);
      }
      if (moveDestDropdownRef.current && !moveDestDropdownRef.current.contains(target)) {
        setIsMoveDestDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // ============================================================================
  // ESTADOS DEL MÓDULO 3: "CONSULTAR UBICACIÓN" (DESGLOSE MULTI-UBICACIÓN)
  // ============================================================================
  const consultInputRef = useRef<HTMLInputElement>(null);
  const [consultQuery, setConsultQuery] = useState('');
  const [consultedProductId, setConsultedProductId] = useState<string | null>(initialProduct?.id || null);
  const [consultAlert, setConsultAlert] = useState<string | null>(null);

  // ============================================================================
  // ESTADOS DEL MÓDULO 4: "MOVER UBICACIÓN" (REUBICACIÓN ENTRE ZONAS)
  // ============================================================================
  const moveScanInputRef = useRef<HTMLInputElement>(null);
  const [moveScanQuery, setMoveScanQuery] = useState('');
  const [moveProductId, setMoveProductId] = useState<string | null>(initialProduct?.id || null);
  const [moveFromLocationId, setMoveFromLocationId] = useState<string>('');
  const [moveToLocationId, setMoveToLocationId] = useState<string>('');
  const [moveQuantity, setMoveQuantity] = useState<string>('1');
  const [moveBoxes, setMoveBoxes] = useState<number>(1);
  const [moveLooseUnits, setMoveLooseUnits] = useState<number>(0);
  const [moveReason, setMoveReason] = useState<string>('');
  const [moveAlert, setMoveAlert] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [isMovingStock, setIsMovingStock] = useState(false);

  // ============================================================================
  // ESTADOS DEL ESCÁNER DE CÁMARA
  // ============================================================================
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [cameraScanTarget, setCameraScanTarget] = useState<
    'assignProduct' | 'assignLocation' | 'consultProduct' | 'moveProduct' | 'moveDestination'
  >('assignProduct');

  // Sincronizar producto inicial si viene desde otra vista
  useEffect(() => {
    if (initialProduct) {
      setConsultedProductId(initialProduct.id);
      setMoveProductId(initialProduct.id);
      const firstLocWithStock = (initialProduct.product_locations || []).find(pl => Number(pl.quantity || 0) > 0);
      setMoveFromLocationId(firstLocWithStock?.location_id || '');
    }
  }, [initialProduct]);

  // Autofocus ergonómico al cambiar de pestaña
  useEffect(() => {
    const timer = setTimeout(() => {
      if (subTab === 'assign') {
        assignScanInputRef.current?.focus();
      } else if (subTab === 'consult') {
        consultInputRef.current?.focus();
      } else if (subTab === 'move') {
        moveScanInputRef.current?.focus();
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [subTab]);

  // Sincronizar stock pendiente actualizado cuando se refresca la lista de productos
  useEffect(() => {
    setBatchItems(prev =>
      prev
        .map(item => {
          const freshProd = products.find(p => p.id === item.product.id);
          if (!freshProd) return null;
          const freshPending = getPendingLocationStock(freshProd);
          if (freshPending <= 0.0001) return null;
          const clampedQty = Math.min(item.quantity, freshPending);
          return {
            ...item,
            product: freshProd,
            maxPending: freshPending,
            quantity: clampedQty
          };
        })
        .filter(Boolean) as BatchAssignItem[]
    );
  }, [products]);

  // ============================================================================
  // LÓGICA DEL MÓDULO 2: "ASIGNAR UBICACIÓN"
  // ============================================================================

  const decomposeBoxQty = (qty: number, upb: number) => {
    const totalUnits = Math.round(qty * upb);
    return {
      boxes: Math.floor(totalUnits / upb),
      looseUnits: totalUnits % upb
    };
  };

  /**
   * Agrega o incrementa (+1) un producto en la lista temporal de asignación validando estrictamente Stock Pendiente
   */
  const handleAddOrIncrementAssignProduct = (product: Product) => {
    const maxPending = getPendingLocationStock(product);
    const isBox = product.unit_type === 'BOX' && Number(product.units_per_box) > 0;
    const upb = Number(product.units_per_box || 1);

    // Regla estricta: si no tiene unidades pendientes por ubicar, bloquear y alertar
    if (maxPending <= 0.0001) {
      setAssignAlert({
        type: 'error',
        message: `No hay más unidades pendientes por ubicar para este producto ("${product.name}" [${product.code}]). Todo su stock (${formatStockDisplay(product)}) ya se encuentra asignado en almacenes.`
      });
      assignScanInputRef.current?.focus();
      return;
    }

    const existingIdx = batchItems.findIndex(i => i.product.id === product.id);

    if (existingIdx >= 0) {
      const currentItem = batchItems[existingIdx];
      // Incremento de +1 por escaneo consecutivo (o el remanente si es menor a 1 caja)
      const step = isBox ? (maxPending - currentItem.quantity < 1 ? Number((maxPending - currentItem.quantity).toFixed(4)) : 1) : 1;

      if (currentItem.quantity + 0.0001 >= maxPending || step <= 0.0001) {
        setAssignAlert({
          type: 'error',
          message: `No hay más unidades pendientes por ubicar para este producto ("${product.name}"). Máximo pendiente disponible: ${formatLocationQuantity(maxPending, product)}.`
        });
        assignScanInputRef.current?.focus();
        return;
      }

      const nextQty = Number(Math.min(maxPending, currentItem.quantity + step).toFixed(4));
      const breakdown = isBox ? decomposeBoxQty(nextQty, upb) : { boxes: nextQty, looseUnits: 0 };

      setBatchItems(prev =>
        prev.map((it, idx) =>
          idx === existingIdx
            ? {
                ...it,
                product,
                maxPending,
                quantity: nextQty,
                boxes: breakdown.boxes,
                looseUnits: breakdown.looseUnits
              }
            : it
        )
      );
      setAssignAlert(null);
    } else {
      // Primera vez que se escanea el producto en el lote
      const initialQty = isBox ? Math.min(1, maxPending) : Math.min(1, maxPending);
      const breakdown = isBox ? decomposeBoxQty(initialQty, upb) : { boxes: initialQty, looseUnits: 0 };

      setBatchItems(prev => [
        ...prev,
        {
          product,
          quantity: Number(initialQty.toFixed(4)),
          boxes: breakdown.boxes,
          looseUnits: breakdown.looseUnits,
          maxPending
        }
      ]);
      setAssignAlert(null);
    }

    assignScanInputRef.current?.focus();
  };

  /**
   * Procesa el evento Enter del lector de código de barras o búsqueda manual en Asignar Ubicación
   */
  const handleAssignScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = assignScanCode.trim();
    if (!raw) return;

    // 1. Buscar coincidencia exacta por código de barras / SKU
    let matched = products.find(p => p.code.toLowerCase() === raw.toLowerCase() && p.status === 'ACTIVE');

    // 2. Si no hubo coincidencia exacta por código, buscar coincidencias con unidades pendientes por ubicar
    if (!matched) {
      const partialMatches = products.filter(
        p =>
          p.status === 'ACTIVE' &&
          getPendingLocationStock(p) > 0.0001 &&
          (p.code.toLowerCase().includes(raw.toLowerCase()) || p.name.toLowerCase().includes(raw.toLowerCase()))
      );
      if (partialMatches.length > 0) {
        matched = partialMatches[0];
      }
    }

    if (!matched) {
      setAssignAlert({
        type: 'error',
        message: `No se encontró ningún producto activo con el código o referencia "${raw}".`
      });
      setAssignScanCode('');
      assignScanInputRef.current?.focus();
      return;
    }

    handleAddOrIncrementAssignProduct(matched);
    setAssignScanCode('');
    assignScanInputRef.current?.focus();
  };

  /**
   * Actualiza manualmente la cantidad a asignar en la tabla temporal validando el tope de Stock Pendiente
   */
  const handleUpdateBatchItemQuantity = (productId: string, newQtyRaw: number) => {
    const item = batchItems.find(i => i.product.id === productId);
    if (!item) return;

    const isBox = item.product.unit_type === 'BOX' && Number(item.product.units_per_box) > 0;
    const upb = Number(item.product.units_per_box || 1);

    if (newQtyRaw > item.maxPending + 0.0001) {
      setAssignAlert({
        type: 'error',
        message: `No hay más unidades pendientes por ubicar para este producto ("${item.product.name}"). Tope máximo pendiente: ${formatLocationQuantity(item.maxPending, item.product)}.`
      });
      const clamped = item.maxPending;
      const breakdown = isBox ? decomposeBoxQty(clamped, upb) : { boxes: clamped, looseUnits: 0 };
      setBatchItems(prev =>
        prev.map(i =>
          i.product.id === productId
            ? { ...i, quantity: clamped, boxes: breakdown.boxes, looseUnits: breakdown.looseUnits }
            : i
        )
      );
      return;
    }

    const minAllowed = isBox ? Number((1 / upb).toFixed(4)) : 1;
    const validQty = isBox
      ? Math.max(minAllowed, Number(newQtyRaw.toFixed(4)))
      : Math.max(1, Math.round(newQtyRaw));

    const breakdown = isBox ? decomposeBoxQty(validQty, upb) : { boxes: validQty, looseUnits: 0 };
    setAssignAlert(null);
    setBatchItems(prev =>
      prev.map(i =>
        i.product.id === productId
          ? { ...i, quantity: validQty, boxes: breakdown.boxes, looseUnits: breakdown.looseUnits }
          : i
      )
    );
  };

  /**
   * Actualiza cajas y unidades sueltas para productos tipo BOX en la lista temporal de asignación
   */
  const handleUpdateBatchBoxBreakdown = (productId: string, newBoxes: number, newLooseUnits: number) => {
    const item = batchItems.find(i => i.product.id === productId);
    if (!item) return;
    const upb = Number(item.product.units_per_box || 1);
    const cleanBoxes = Math.max(0, Math.floor(newBoxes));
    const cleanLoose = Math.max(0, Math.floor(newLooseUnits));
    const computedQty = Number((cleanBoxes + cleanLoose / upb).toFixed(4));

    if (computedQty <= 0) return;
    handleUpdateBatchItemQuantity(productId, computedQty);
  };

  const handleRemoveBatchItem = (productId: string) => {
    setBatchItems(prev => prev.filter(i => i.product.id !== productId));
    assignScanInputRef.current?.focus();
  };

  /**
   * Ejecuta la confirmación por lote ("Confirmar y Asignar Ubicación") bajo transacción atómica
   */
  const handleConfirmBatchAssignment = async () => {
    if (!currentInventory || !user) return;
    if (batchItems.length === 0) {
      setAssignAlert({
        type: 'error',
        message: 'La lista temporal está vacía. Escanea o selecciona al menos un producto para asignar.'
      });
      assignScanInputRef.current?.focus();
      return;
    }
    if (!targetAssignLocationId) {
      setAssignAlert({
        type: 'error',
        message: 'Debes seleccionar una Ubicación Destino antes de confirmar el lote.'
      });
      return;
    }

    try {
      setIsAssigningBatch(true);
      setAssignAlert(null);

      const targetLoc = locations.find(l => l.id === targetAssignLocationId);
      const itemsPayload = batchItems.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity
      }));

      const { error } = await supabase.rpc('assign_product_locations_batch', {
        p_inventory_id: currentInventory.id,
        p_location_id: targetAssignLocationId,
        p_items: itemsPayload,
        p_user_id: user.id,
        p_user_email: user.email || 'usuario@local'
      });

      if (error) throw error;

      const assignedCount = batchItems.length;
      setBatchItems([]);
      setAssignScanCode('');
      onRefresh();

      setAssignAlert({
        type: 'success',
        message: `Lote confirmado: ${assignedCount} ${assignedCount === 1 ? 'producto asignado' : 'productos asignados'} correctamente a "${targetLoc?.name} (${targetLoc?.code})".`
      });

      // Ergonomía de escaneo: volver a enfocar automáticamente el input de escaneo principal
      setTimeout(() => {
        assignScanInputRef.current?.focus();
      }, 60);
    } catch (err: any) {
      setAssignAlert({
        type: 'error',
        message: err.message || 'Error al asignar ubicación por lote.'
      });
    } finally {
      setIsAssigningBatch(false);
    }
  };

  // Coincidencias en vivo al escribir en el buscador de "Asignar Ubicación" (solo productos con unidades pendientes de asignar)
  const assignSuggestions = useMemo(() => {
    const term = assignScanCode.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter(p => {
        if (p.status !== 'ACTIVE') return false;
        const inBatchQty = batchItems.find(b => b.product.id === p.id)?.quantity || 0;
        const remainingPending = getPendingLocationStock(p) - inBatchQty;
        if (remainingPending <= 0.0001) return false;
        return p.code.toLowerCase().includes(term) || p.name.toLowerCase().includes(term);
      })
      .slice(0, 6);
  }, [products, assignScanCode, batchItems]);

  // ============================================================================
  // LÓGICA DEL MÓDULO 3: "CONSULTAR UBICACIÓN"
  // ============================================================================
  const consultedProduct = useMemo(
    () => products.find(p => p.id === consultedProductId) || null,
    [products, consultedProductId]
  );

  // Coincidencias en vivo al escribir en el buscador de "Consultar Ubicación" (vacío si no se escribe nada)
  const consultSuggestions = useMemo(() => {
    const term = consultQuery.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter(
        p =>
          p.code.toLowerCase().includes(term) ||
          p.name.toLowerCase().includes(term) ||
          (p.description && p.description.toLowerCase().includes(term))
      )
      .slice(0, 6);
  }, [products, consultQuery]);

  const handleConsultSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = consultQuery.trim().toLowerCase();
    if (!raw) return;

    // 1. Coincidencia exacta por código o nombre
    const exact = products.find(
      p => p.code.toLowerCase() === raw || p.name.toLowerCase() === raw
    );
    if (exact) {
      setConsultedProductId(exact.id);
      setConsultAlert(null);
      setConsultQuery('');
      consultInputRef.current?.focus();
      return;
    }

    // 2. Coincidencia parcial por código o nombre
    const partialMatches = products.filter(
      p =>
        p.code.toLowerCase().includes(raw) ||
        p.name.toLowerCase().includes(raw) ||
        (p.description && p.description.toLowerCase().includes(raw))
    );

    if (partialMatches.length > 0) {
      setConsultedProductId(partialMatches[0].id);
      setConsultAlert(null);
      setConsultQuery('');
      consultInputRef.current?.focus();
      return;
    }

    setConsultAlert(`No se encontró ningún producto con el código o nombre "${consultQuery.trim()}".`);
    consultInputRef.current?.focus();
  };

  // ============================================================================
  // LÓGICA DEL MÓDULO 4: "MOVER UBICACIÓN" (REUBICACIÓN ENTRE ZONAS)
  // ============================================================================
  const moveSelectedProduct = useMemo(
    () => products.find(p => p.id === moveProductId) || null,
    [products, moveProductId]
  );

  // Coincidencias en vivo al escribir en el buscador de "Mover Ubicación" (solo productos con stock ubicado)
  const moveSuggestions = useMemo(() => {
    const term = moveScanQuery.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter(
        p =>
          p.status === 'ACTIVE' &&
          getAssignedLocationStock(p) > 0.0001 &&
          (p.code.toLowerCase().includes(term) || p.name.toLowerCase().includes(term))
      )
      .slice(0, 6);
  }, [products, moveScanQuery]);

  // Ubicaciones de origen donde el producto seleccionado tiene stock actual > 0
  const moveAvailableOrigins = useMemo(() => {
    if (!moveSelectedProduct) return [];
    return (moveSelectedProduct.product_locations || []).filter(pl => Number(pl.quantity || 0) > 0.0001);
  }, [moveSelectedProduct]);

  // Saldo disponible en la ubicación de origen elegida
  const moveOriginStock = useMemo(() => {
    const found = moveAvailableOrigins.find(pl => pl.location_id === moveFromLocationId);
    return Number(found?.quantity || 0);
  }, [moveAvailableOrigins, moveFromLocationId]);

  // Ubicaciones de destino disponibles (excluyendo la de origen)
  const moveAvailableDestinations = useMemo(() => {
    return locations.filter(loc => loc.id !== moveFromLocationId);
  }, [locations, moveFromLocationId]);

  // Seleccionar producto a trasladar por escáner o clic
  const selectProductForMove = (prod: Product, preferredOriginId?: string) => {
    setMoveProductId(prod.id);
    setMoveAlert(null);
    const origins = (prod.product_locations || []).filter(pl => Number(pl.quantity || 0) > 0.0001);
    const chosenOrigin =
      preferredOriginId && origins.some(o => o.location_id === preferredOriginId)
        ? preferredOriginId
        : origins[0]?.location_id || '';
    setMoveFromLocationId(chosenOrigin);
    setMoveToLocationId('');

    const originEntry = origins.find(o => o.location_id === chosenOrigin);
    const avail = Number(originEntry?.quantity || 0);

    if (prod.unit_type === 'BOX' && Number(prod.units_per_box) > 0) {
      const upb = Number(prod.units_per_box);
      if (avail >= 1) {
        setMoveBoxes(1);
        setMoveLooseUnits(0);
        setMoveQuantity('1');
      } else {
        const b = decomposeBoxQty(avail, upb);
        setMoveBoxes(b.boxes);
        setMoveLooseUnits(b.looseUnits);
        setMoveQuantity(String(avail));
      }
    } else {
      setMoveQuantity(avail >= 1 ? '1' : '0');
    }
  };

  const handleMoveScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = moveScanQuery.trim().toLowerCase();
    if (!raw) return;

    let matched = products.find(
      p => p.code.toLowerCase() === raw || p.name.toLowerCase() === raw
    );
    if (!matched) {
      const partial = products.filter(
        p => p.code.toLowerCase().includes(raw) || p.name.toLowerCase().includes(raw)
      );
      if (partial.length > 0) matched = partial[0];
    }

    if (!matched) {
      setMoveAlert({
        type: 'error',
        message: `No se encontró ningún producto con el código o nombre "${moveScanQuery}".`
      });
      moveScanInputRef.current?.focus();
      return;
    }

    selectProductForMove(matched);
    setMoveScanQuery('');
  };

  // Cuando cambia la ubicación de origen en Mover Ubicación, ajustar el tope de cantidad
  const handleOriginLocationChange = (locId: string) => {
    setMoveFromLocationId(locId);
    if (moveToLocationId === locId) {
      setMoveToLocationId('');
    }
    const found = moveAvailableOrigins.find(pl => pl.location_id === locId);
    const avail = Number(found?.quantity || 0);
    if (moveSelectedProduct?.unit_type === 'BOX' && Number(moveSelectedProduct.units_per_box) > 0) {
      const upb = Number(moveSelectedProduct.units_per_box);
      if (avail >= 1) {
        setMoveBoxes(1);
        setMoveLooseUnits(0);
        setMoveQuantity('1');
      } else {
        const b = decomposeBoxQty(avail, upb);
        setMoveBoxes(b.boxes);
        setMoveLooseUnits(b.looseUnits);
        setMoveQuantity(String(avail));
      }
    } else {
      setMoveQuantity(avail >= 1 ? '1' : '0');
    }
  };

  const handleConfirmMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !user || !moveSelectedProduct) return;

    if (!moveFromLocationId) {
      setMoveAlert({
        type: 'error',
        message: 'Selecciona la ubicación de origen desde donde se retirará el stock.'
      });
      return;
    }
    if (!moveToLocationId) {
      setMoveAlert({
        type: 'error',
        message: 'Selecciona la ubicación de destino.'
      });
      return;
    }

    const isBox = moveSelectedProduct.unit_type === 'BOX' && Number(moveSelectedProduct.units_per_box) > 0;
    const upb = Number(moveSelectedProduct.units_per_box || 1);
    const finalQtyToMove = isBox
      ? Number((moveBoxes + moveLooseUnits / upb).toFixed(4))
      : Math.round(Number(moveQuantity || 0));

    if (finalQtyToMove <= 0) {
      setMoveAlert({
        type: 'error',
        message: 'La cantidad a trasladar debe ser mayor a 0.'
      });
      return;
    }

    if (finalQtyToMove > moveOriginStock + 0.0002) {
      setMoveAlert({
        type: 'error',
        message: `La cantidad solicitada supera el saldo disponible en la ubicación de origen (${formatLocationQuantity(moveOriginStock, moveSelectedProduct)}).`
      });
      return;
    }

    try {
      setIsMovingStock(true);
      setMoveAlert(null);

      const fromLoc = locations.find(l => l.id === moveFromLocationId);
      const toLoc = locations.find(l => l.id === moveToLocationId);

      const { error } = await supabase.rpc('move_product_location', {
        p_inventory_id: currentInventory.id,
        p_product_id: moveSelectedProduct.id,
        p_from_location_id: moveFromLocationId,
        p_to_location_id: moveToLocationId,
        p_quantity: finalQtyToMove,
        p_reason: moveReason.trim() || null,
        p_user_id: user.id,
        p_user_email: user.email || 'usuario@local'
      });

      if (error) throw error;

      const movedLabel = formatLocationQuantity(finalQtyToMove, moveSelectedProduct);
      const prodName = moveSelectedProduct.name;

      // Limpiar vista tras confirmar traslado y devolver foco al input de escaneo principal
      setMoveProductId(null);
      setMoveFromLocationId('');
      setMoveToLocationId('');
      setMoveQuantity('1');
      setMoveBoxes(1);
      setMoveLooseUnits(0);
      setMoveReason('');
      setMoveScanQuery('');
      onRefresh();

      setMoveAlert({
        type: 'success',
        message: `Traslado completado: ${movedLabel} de "${prodName}" movidos desde "${fromLoc?.name}" hacia "${toLoc?.name}".`
      });

      setTimeout(() => {
        moveScanInputRef.current?.focus();
      }, 60);
    } catch (err: any) {
      setMoveAlert({
        type: 'error',
        message: err.message || 'Error al ejecutar el traslado de ubicación.'
      });
    } finally {
      setIsMovingStock(false);
    }
  };

  // Manejador del escáner de cámara óptica
  const handleCameraScanSuccess = (scannedCode: string) => {
    const clean = scannedCode.trim();
    setCameraScannerOpen(false);

    if (cameraScanTarget === 'assignProduct') {
      setAssignScanCode(clean);
      const matched = products.find(p => p.code.toLowerCase() === clean.toLowerCase() && p.status === 'ACTIVE');
      if (matched) {
        handleAddOrIncrementAssignProduct(matched);
      } else {
        setAssignAlert({
          type: 'error',
          message: `No se encontró ningún producto activo con el código "${clean}".`
        });
      }
      setTimeout(() => assignScanInputRef.current?.focus(), 80);
    } else if (cameraScanTarget === 'assignLocation') {
      const foundLoc = locations.find(l => l.code.toUpperCase() === clean.toUpperCase() || l.id === clean);
      if (foundLoc) {
        setTargetAssignLocationId(foundLoc.id);
        setAssignAlert(null);
      } else {
        setAssignAlert({
          type: 'error',
          message: `No se encontró ninguna ubicación física con el código "${clean}".`
        });
      }
    } else if (cameraScanTarget === 'consultProduct') {
      setConsultQuery(clean);
      const matched = products.find(p => p.code.toLowerCase() === clean.toLowerCase());
      if (matched) {
        setConsultedProductId(matched.id);
        setConsultAlert(null);
      } else {
        setConsultAlert(`No se encontró ningún producto con el código "${clean}".`);
      }
      setTimeout(() => consultInputRef.current?.focus(), 80);
    } else if (cameraScanTarget === 'moveProduct') {
      setMoveScanQuery(clean);
      const matched = products.find(p => p.code.toLowerCase() === clean.toLowerCase());
      if (matched) {
        selectProductForMove(matched);
      } else {
        setMoveAlert({
          type: 'error',
          message: `No se encontró ningún producto con el código "${clean}".`
        });
      }
      setTimeout(() => moveScanInputRef.current?.focus(), 80);
    } else if (cameraScanTarget === 'moveDestination') {
      const foundLoc = locations.find(l => l.code.toUpperCase() === clean.toUpperCase() || l.id === clean);
      if (foundLoc) {
        if (foundLoc.id === moveFromLocationId) {
          setMoveAlert({
            type: 'error',
            message: 'La ubicación escaneada es la misma ubicación de origen.'
          });
        } else {
          setMoveToLocationId(foundLoc.id);
          setMoveAlert(null);
        }
      } else {
        setMoveAlert({
          type: 'error',
          message: `No se encontró ninguna ubicación con el código "${clean}".`
        });
      }
    }
  };

  // Resumen global de estado de ubicación del inventario
  const globalSummary = useMemo(() => {
    const activeProds = products.filter(p => p.status === 'ACTIVE');
    let skusWithPending = 0;
    let skusFullyAssigned = 0;

    for (const p of activeProds) {
      const pending = getPendingLocationStock(p);
      if (pending > 0.0001) {
        skusWithPending++;
      } else if (Number(p.stock || 0) > 0) {
        skusFullyAssigned++;
      }
    }

    return {
      totalLocations: locations.length,
      skusWithPending,
      skusFullyAssigned
    };
  }, [products, locations]);

  return (
    <>
      {/* ========================================================================
          VISTA MÓVIL ULTRA MINIMALISTA (< 768px / md:hidden)
         ======================================================================== */}
      <div className="md:hidden fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col overflow-hidden bg-white text-neutral-900">
        
        {/* CAPA 1: Header Oscuro Principal (Fijo / shrink-0) */}
        <header className="shrink-0 bg-neutral-950 text-white rounded-b-[2.5rem] z-20 select-none px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">
                Ubicaciones
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-800/80 text-neutral-300 text-xs font-medium">
                  En Recepción: <strong className="text-amber-300 tabular-nums">{globalSummary.skusWithPending}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-800/80 text-neutral-300 text-xs font-medium">
                  Estantes: <strong className="text-white tabular-nums">{globalSummary.totalLocations}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Selector de submódulos tipo píldora en fila horizontal deslizable */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mt-4">
            {(
              [
                { id: 'assign', label: 'Asignar' },
                { id: 'consult', label: 'Consultar' },
                { id: 'move', label: 'Mover' }
              ] as { id: LocationSubTab; label: string }[]
            ).map((tab) => {
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubTab(tab.id)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                    active
                      ? 'bg-white text-neutral-950 shadow-sm'
                      : 'bg-neutral-800/70 text-neutral-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* CAPA 2: Contenedor Blanco Global (flex-1 flex flex-col overflow-hidden) */}
        <section className="flex-1 min-h-0 w-full bg-white flex flex-col overflow-hidden">
          
          {/* SUBMÓDULO A: ASIGNAR UBICACIÓN */}
          {subTab === 'assign' && (
            <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
              {/* SUB-CAPA 2A: Barra Fija de Herramientas / Buscador */}
              <div className="shrink-0 w-full bg-white px-5 pt-4 pb-2 space-y-2">
                <form onSubmit={handleAssignScanSubmit} className="flex items-center gap-2.5">
                  <div className="flex-1 min-w-0 flex items-center gap-3 bg-neutral-50 border border-neutral-200/60 rounded-2xl px-4 py-3.5 focus-within:border-neutral-950 focus-within:bg-white transition-all">
                    <Search className="w-5 h-5 text-neutral-400 shrink-0" />
                    <input
                      type="text"
                      value={assignScanCode}
                      onChange={(e) => setAssignScanCode(e.target.value)}
                      placeholder="Escanear o escribir código / nombre..."
                      className="w-full bg-transparent border-0 outline-none ring-0 p-0 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCameraScanTarget('assignProduct');
                      setCameraScannerOpen(true);
                    }}
                    className="w-12 h-12 flex items-center justify-center bg-neutral-50 border border-neutral-200/60 rounded-2xl text-neutral-600 hover:text-neutral-950 active:scale-95 transition-all shrink-0"
                    aria-label="Cámara"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </form>

                {/* Sugerencias en vivo con scroll interno */}
                {assignSuggestions.length > 0 && (
                  <div className="bg-neutral-50 border border-neutral-100 rounded-2xl px-4 max-h-44 overflow-y-auto overscroll-contain divide-y divide-neutral-100">
                    {assignSuggestions.map((prod) => {
                      const inBatchQty = batchItems.find((b) => b.product.id === prod.id)?.quantity || 0;
                      const remaining = Math.max(0, getPendingLocationStock(prod) - inBatchQty);
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => {
                            handleAddOrIncrementAssignProduct(prod);
                            setAssignScanCode('');
                          }}
                          className="w-full py-2.5 flex items-center justify-between text-left active:opacity-70"
                        >
                          <div className="min-w-0 pr-3">
                            <p className="text-sm font-semibold text-neutral-900 truncate">
                              {prod.name}
                            </p>
                            <p className="text-xs text-neutral-400 truncate">
                              {prod.code} · Pendiente: {formatLocationQuantity(remaining, prod)}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-neutral-900 px-2.5 py-1 rounded-full bg-white shrink-0">
                            + Añadir
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SUB-CAPA 2B: Contenedor Operativo con Scroll Aislado */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-1.5 pb-28 space-y-3.5">

              {assignAlert && (
                <div
                  className={`py-3 px-4 rounded-2xl text-xs font-medium flex items-center justify-between gap-2 ${
                    assignAlert.type === 'error'
                      ? 'bg-rose-50 text-rose-700'
                      : assignAlert.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  <span>{assignAlert.message}</span>
                  <button type="button" onClick={() => setAssignAlert(null)} className="opacity-60">
                    ✕
                  </button>
                </div>
              )}

              {/* Recuadro de productos por ubicar con scroll interno contenido */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-neutral-400">
                    Productos por ubicar ({batchItems.length})
                  </span>
                  {batchItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBatchItems([])}
                      className="text-xs text-neutral-400 hover:text-neutral-900"
                    >
                      Vaciar
                    </button>
                  )}
                </div>

                {batchItems.length === 0 ? (
                  <div className="bg-neutral-50/70 border border-neutral-100 rounded-2xl py-4 px-4 text-center text-xs text-neutral-400">
                    Escanea o busca productos en recepción para asignarlos a un estante.
                  </div>
                ) : (
                  <div className="bg-neutral-50/70 border border-neutral-100 rounded-2xl px-3.5 max-h-[130px] overflow-y-auto overscroll-contain divide-y divide-neutral-100">
                    {batchItems.map((item) => {
                      const isBox = item.product.unit_type === 'BOX' && Number(item.product.units_per_box) > 0;
                      const step = isBox ? Number((1 / Number(item.product.units_per_box || 1)).toFixed(4)) : 1;
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
                              {item.product.code} · Máx: {formatLocationQuantity(item.maxPending, item.product)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex items-center gap-1.5 bg-neutral-100 rounded-full px-2 py-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateBatchItemQuantity(
                                    item.product.id,
                                    Math.max(step, Number((item.quantity - (isBox ? 1 : 1)).toFixed(4)))
                                  )
                                }
                                className="w-6 h-6 rounded-full bg-white text-neutral-700 flex items-center justify-center active:scale-95"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-semibold text-neutral-900 tabular-nums px-1.5">
                                {formatLocationQuantity(item.quantity, item.product)}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateBatchItemQuantity(
                                    item.product.id,
                                    Math.min(item.maxPending, Number((item.quantity + 1).toFixed(4)))
                                  )
                                }
                                className="w-6 h-6 rounded-full bg-white text-neutral-700 flex items-center justify-center active:scale-95"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveBatchItem(item.product.id)}
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

              {/* Selector de ubicación destino y botón de confirmación en cápsula negra */}
              <div className="space-y-2.5 pt-0.5">
                <label className="text-xs font-medium text-neutral-500 block">
                  Ubicación destino
                </label>
                <div className="flex items-center gap-2.5 w-full">
                  <div ref={assignLocDropdownRef} className="relative w-full flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => setIsAssignLocDropdownOpen((prev) => !prev)}
                      className="w-full flex items-center justify-between bg-neutral-50 border border-neutral-200/60 rounded-2xl py-3 px-4 text-sm text-neutral-800 font-medium hover:bg-neutral-100/60 transition-colors"
                    >
                      {selectedAssignLocation ? (
                        <span className="truncate">
                          {selectedAssignLocation.name}
                          <span className="text-xs text-neutral-400 font-normal ml-2">
                            {selectedAssignLocation.code}
                          </span>
                        </span>
                      ) : (
                        <span className="truncate text-neutral-400 font-normal">
                          Seleccionar estante o zona...
                        </span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-neutral-400 shrink-0 ml-2 transition-transform duration-200 ${
                          isAssignLocDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isAssignLocDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-2 z-30 bg-white rounded-2xl border border-neutral-200/80 shadow-xl p-1.5 overflow-hidden max-h-60 overflow-y-auto">
                        {locations.length === 0 ? (
                          <div className="px-3 py-2.5 text-xs text-neutral-400 text-center">
                            No hay ubicaciones registradas
                          </div>
                        ) : (
                          locations.map((loc) => {
                            const isSelected = targetAssignLocationId === loc.id;
                            return (
                              <button
                                key={loc.id}
                                type="button"
                                onClick={() => {
                                  setTargetAssignLocationId(loc.id);
                                  setIsAssignLocDropdownOpen(false);
                                }}
                                className={`w-full rounded-xl px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 transition-colors flex items-center justify-between cursor-pointer text-left ${
                                  isSelected ? 'bg-neutral-100/80 font-semibold text-neutral-950' : ''
                                }`}
                              >
                                <div className="truncate pr-2">
                                  <span>{loc.name}</span>
                                  <span className="text-xs text-neutral-400 font-normal ml-2">
                                    {loc.code}
                                  </span>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-neutral-950 shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCameraScanTarget('assignLocation');
                      setCameraScannerOpen(true);
                    }}
                    title="Escanear código o QR de ubicación"
                    aria-label="Escanear ubicación destino"
                    className="py-3 px-4 rounded-2xl bg-neutral-50 border border-neutral-200/60 text-neutral-800 hover:bg-neutral-100/60 flex items-center justify-center gap-1.5 text-xs font-semibold shrink-0 active:scale-95 transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Escanear</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmBatchAssignment}
                  disabled={isAssigningBatch || batchItems.length === 0 || !targetAssignLocationId}
                  className="bg-neutral-950 text-white rounded-2xl py-4 font-semibold w-full text-sm disabled:opacity-40 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {isAssigningBatch ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Asignando ubicación...</span>
                    </>
                  ) : (
                    <span>Asignar Ubicación</span>
                  )}
                </button>
              </div>
              </div>
            </div>
          )}

          {/* SUBMÓDULO B: CONSULTAR UBICACIÓN */}
          {subTab === 'consult' && (
            <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
              {/* SUB-CAPA 2A: Barra Fija de Herramientas / Buscador */}
              <div className="shrink-0 w-full bg-white px-5 pt-4 pb-2 space-y-2">
                <form onSubmit={handleConsultSearchSubmit} className="flex items-center gap-2.5">
                  <div className="flex-1 min-w-0 flex items-center gap-3 bg-neutral-50 border border-neutral-200/60 rounded-2xl px-4 py-3.5 focus-within:border-neutral-950 focus-within:bg-white transition-all">
                    <Search className="w-5 h-5 text-neutral-400 shrink-0" />
                    <input
                      type="text"
                      value={consultQuery}
                      onChange={(e) => setConsultQuery(e.target.value)}
                      placeholder="Buscar producto por código o nombre..."
                      className="w-full bg-transparent border-0 outline-none ring-0 p-0 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCameraScanTarget('consultProduct');
                      setCameraScannerOpen(true);
                    }}
                    className="w-12 h-12 flex items-center justify-center bg-neutral-50 border border-neutral-200/60 rounded-2xl text-neutral-600 hover:text-neutral-950 active:scale-95 transition-all shrink-0"
                    aria-label="Cámara"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </form>

                {consultSuggestions.length > 0 && (
                  <div className="bg-neutral-50 border border-neutral-100 rounded-2xl px-4 max-h-48 overflow-y-auto overscroll-contain divide-y divide-neutral-100">
                    {consultSuggestions.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => {
                          setConsultedProductId(prod.id);
                          setConsultQuery('');
                          setConsultAlert(null);
                        }}
                        className="w-full py-2.5 flex items-center justify-between text-left active:opacity-70"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="text-sm font-semibold text-neutral-900 truncate">
                            {prod.name}
                          </p>
                          <p className="text-xs text-neutral-400 truncate">
                            {prod.code}
                          </p>
                        </div>
                        <span className="text-xs text-neutral-500 tabular-nums shrink-0">
                          {formatStockDisplay(prod)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* SUB-CAPA 2B: Contenedor de Datos con Scroll Aislado */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-2 pb-28 space-y-4">
                {consultAlert && (
                  <p className="text-xs text-rose-600 py-2">{consultAlert}</p>
                )}

                {/* Resultados como texto plano jerarquizado */}
                {!consultedProduct ? (
                  <p className="py-6 text-center text-xs text-neutral-400">
                    Busca o escanea un producto para consultar en qué estantes se encuentra.
                  </p>
                ) : (
                <div className="space-y-4">
                  <div className="pb-4 border-b border-neutral-100">
                    <h2 className="text-base font-semibold text-neutral-900">
                      {consultedProduct.name}
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      SKU {consultedProduct.code} · Total: {formatStockDisplay(consultedProduct)}
                    </p>
                  </div>

                  <div className="divide-y divide-neutral-100">
                    {/* Stock en recepción sin ubicar */}
                    {getPendingLocationStock(consultedProduct) > 0.0001 && (
                      <div className="py-3.5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-amber-600">
                            En Recepción (Sin ubicar)
                          </p>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            Pendiente de asignar a estante
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-normal text-neutral-900 tabular-nums">
                            {formatLocationQuantity(getPendingLocationStock(consultedProduct), consultedProduct)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              handleAddOrIncrementAssignProduct(consultedProduct);
                              setSubTab('assign');
                            }}
                            className="text-xs font-semibold text-neutral-900 underline"
                          >
                            Asignar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Estantes asignados */}
                    {(consultedProduct.product_locations || [])
                      .filter((pl) => Number(pl.quantity || 0) > 0.0001)
                      .map((pl) => {
                        const locInfo = pl.locations || locations.find((l) => l.id === pl.location_id);
                        return (
                          <div
                            key={pl.id || pl.location_id}
                            className="py-3.5 flex items-center justify-between gap-3"
                          >
                            <div>
                              <p className="text-sm font-semibold text-neutral-900">
                                {locInfo?.name || 'Estante'} · {formatLocationQuantity(Number(pl.quantity || 0), consultedProduct)}
                              </p>
                              <p className="text-xs text-neutral-400 mt-0.5">
                                Código {locInfo?.code || 'S/C'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                selectProductForMove(consultedProduct, pl.location_id);
                                setSubTab('move');
                              }}
                              className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
                            >
                              Mover
                            </button>
                          </div>
                        );
                      })}

                    {(consultedProduct.product_locations || []).filter((pl) => Number(pl.quantity || 0) > 0.0001).length === 0 &&
                      getPendingLocationStock(consultedProduct) <= 0.0001 && (
                        <p className="py-6 text-xs text-neutral-400 text-center">
                          Este producto no tiene existencias disponibles actualmente.
                        </p>
                      )}
                  </div>
                </div>
              )}
              </div>
            </div>
          )}

          {/* SUBMÓDULO C: MOVER UBICACIÓN */}
          {subTab === 'move' && (
            <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
              {/* SUB-CAPA 2A: Barra Fija de Herramientas / Buscador */}
              <div className="shrink-0 w-full bg-white px-5 pt-4 pb-2 space-y-2">
                <form onSubmit={handleMoveScanSubmit} className="flex items-center gap-2.5">
                  <div className="flex-1 min-w-0 flex items-center gap-3 bg-neutral-50 border border-neutral-200/60 rounded-2xl px-4 py-3.5 focus-within:border-neutral-950 focus-within:bg-white transition-all">
                    <Search className="w-5 h-5 text-neutral-400 shrink-0" />
                    <input
                      type="text"
                      value={moveScanQuery}
                      onChange={(e) => setMoveScanQuery(e.target.value)}
                      placeholder="Buscar producto a trasladar..."
                      className="w-full bg-transparent border-0 outline-none ring-0 p-0 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCameraScanTarget('moveProduct');
                      setCameraScannerOpen(true);
                    }}
                    className="w-12 h-12 flex items-center justify-center bg-neutral-50 border border-neutral-200/60 rounded-2xl text-neutral-600 hover:text-neutral-950 active:scale-95 transition-all shrink-0"
                    aria-label="Cámara"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </form>

                {moveSuggestions.length > 0 && (
                  <div className="bg-neutral-50 border border-neutral-100 rounded-2xl px-4 max-h-48 overflow-y-auto overscroll-contain divide-y divide-neutral-100">
                    {moveSuggestions.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => {
                          selectProductForMove(prod);
                          setMoveScanQuery('');
                        }}
                        className="w-full py-2.5 flex items-center justify-between text-left active:opacity-70"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="text-sm font-semibold text-neutral-900 truncate">
                            {prod.name}
                          </p>
                          <p className="text-xs text-neutral-400 truncate">
                            {prod.code}
                          </p>
                        </div>
                        <span className="text-xs text-neutral-500 tabular-nums shrink-0">
                          {formatLocationQuantity(getAssignedLocationStock(prod), prod)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* SUB-CAPA 2B: Contenedor Operativo con Scroll Aislado */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-2 pb-28 space-y-4">
                {moveAlert && (
                  <div
                    className={`py-3 px-4 rounded-2xl text-xs font-medium flex items-center justify-between gap-2 ${
                      moveAlert.type === 'error'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <span>{moveAlert.message}</span>
                    <button type="button" onClick={() => setMoveAlert(null)} className="opacity-60">
                      ✕
                    </button>
                  </div>
                )}

                {!moveSelectedProduct ? (
                  <p className="py-6 text-center text-xs text-neutral-400">
                    Selecciona un producto con ubicación activa para moverlo entre estantes.
                  </p>
                ) : (
                <form onSubmit={handleConfirmMove} className="space-y-4">
                  <div className="pb-3 border-b border-neutral-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {moveSelectedProduct.name}
                      </p>
                      <p className="text-xs text-neutral-400">
                        SKU {moveSelectedProduct.code}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMoveProductId(null)}
                      className="text-xs text-neutral-400 hover:text-neutral-900"
                    >
                      Cambiar
                    </button>
                  </div>

                  {/* Origen */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500 block">
                      Ubicación de origen
                    </label>
                    <div ref={moveOriginDropdownRef} className="relative w-full">
                      <button
                        type="button"
                        onClick={() => setIsMoveOriginDropdownOpen((prev) => !prev)}
                        className="w-full flex items-center justify-between bg-neutral-50 border border-neutral-200/60 rounded-2xl py-3 px-4 text-sm text-neutral-800 font-medium hover:bg-neutral-100/60 transition-colors"
                      >
                        {(() => {
                          const selectedOriginPl = moveAvailableOrigins.find((pl) => pl.location_id === moveFromLocationId);
                          const locInfo = selectedOriginPl
                            ? selectedOriginPl.locations || locations.find((l) => l.id === selectedOriginPl.location_id)
                            : null;
                          return selectedOriginPl && locInfo ? (
                            <span className="truncate">
                              {locInfo.name}
                              <span className="text-xs text-neutral-400 font-normal ml-2">
                                {locInfo.code} · Disp: {formatLocationQuantity(Number(selectedOriginPl.quantity || 0), moveSelectedProduct)}
                              </span>
                            </span>
                          ) : (
                            <span className="truncate text-neutral-400 font-normal">
                              Seleccionar origen...
                            </span>
                          );
                        })()}
                        <ChevronDown
                          className={`w-4 h-4 text-neutral-400 shrink-0 ml-2 transition-transform duration-200 ${
                            isMoveOriginDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isMoveOriginDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-2 z-30 bg-white rounded-2xl border border-neutral-200/80 shadow-xl p-1.5 overflow-hidden max-h-60 overflow-y-auto">
                          {moveAvailableOrigins.map((pl) => {
                            const locInfo = pl.locations || locations.find((l) => l.id === pl.location_id);
                            const isSelected = moveFromLocationId === pl.location_id;
                            return (
                              <button
                                key={pl.location_id}
                                type="button"
                                onClick={() => {
                                  handleOriginLocationChange(pl.location_id);
                                  setIsMoveOriginDropdownOpen(false);
                                }}
                                className={`w-full rounded-xl px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 transition-colors flex items-center justify-between cursor-pointer text-left ${
                                  isSelected ? 'bg-neutral-100/80 font-semibold text-neutral-950' : ''
                                }`}
                              >
                                <div className="truncate pr-2">
                                  <span>{locInfo?.name || 'Estante'}</span>
                                  <span className="text-xs text-neutral-400 font-normal ml-2">
                                    {locInfo?.code || 'S/C'} · Disp: {formatLocationQuantity(Number(pl.quantity || 0), moveSelectedProduct)}
                                  </span>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-neutral-950 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Destino */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500 block">
                      Ubicación de destino
                    </label>
                    <div className="flex items-center gap-2.5 w-full">
                      <div ref={moveDestDropdownRef} className="relative w-full flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => setIsMoveDestDropdownOpen((prev) => !prev)}
                          className="w-full flex items-center justify-between bg-neutral-50 border border-neutral-200/60 rounded-2xl py-3 px-4 text-sm text-neutral-800 font-medium hover:bg-neutral-100/60 transition-colors"
                        >
                          {(() => {
                            const selectedDest = moveAvailableDestinations.find((loc) => loc.id === moveToLocationId);
                            return selectedDest ? (
                              <span className="truncate">
                                {selectedDest.name}
                                <span className="text-xs text-neutral-400 font-normal ml-2">
                                  {selectedDest.code}
                                </span>
                              </span>
                            ) : (
                              <span className="truncate text-neutral-400 font-normal">
                                Seleccionar destino...
                              </span>
                            );
                          })()}
                          <ChevronDown
                            className={`w-4 h-4 text-neutral-400 shrink-0 ml-2 transition-transform duration-200 ${
                              isMoveDestDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {isMoveDestDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-2 z-30 bg-white rounded-2xl border border-neutral-200/80 shadow-xl p-1.5 overflow-hidden max-h-60 overflow-y-auto">
                            {moveAvailableDestinations.length === 0 ? (
                              <div className="px-3 py-2.5 text-xs text-neutral-400 text-center">
                                No hay ubicaciones disponibles
                              </div>
                            ) : (
                              moveAvailableDestinations.map((loc) => {
                                const isSelected = moveToLocationId === loc.id;
                                return (
                                  <button
                                    key={loc.id}
                                    type="button"
                                    onClick={() => {
                                      setMoveToLocationId(loc.id);
                                      setIsMoveDestDropdownOpen(false);
                                    }}
                                    className={`w-full rounded-xl px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 transition-colors flex items-center justify-between cursor-pointer text-left ${
                                      isSelected ? 'bg-neutral-100/80 font-semibold text-neutral-950' : ''
                                    }`}
                                  >
                                    <div className="truncate pr-2">
                                      <span>{loc.name}</span>
                                      <span className="text-xs text-neutral-400 font-normal ml-2">
                                        {loc.code}
                                      </span>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-neutral-950 shrink-0" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCameraScanTarget('moveDestination');
                          setCameraScannerOpen(true);
                        }}
                        title="Escanear código o QR de ubicación destino"
                        aria-label="Escanear ubicación destino"
                        className="py-3 px-4 rounded-2xl bg-neutral-50 border border-neutral-200/60 text-neutral-800 hover:bg-neutral-100/60 flex items-center justify-center gap-1.5 text-xs font-semibold shrink-0 active:scale-95 transition-all"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Escanear</span>
                      </button>
                    </div>
                  </div>

                  {/* Cantidad */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500 block">
                      Cantidad a trasladar (Máx: {formatLocationQuantity(moveOriginStock, moveSelectedProduct)})
                    </label>
                    {moveSelectedProduct.unit_type === 'BOX' && Number(moveSelectedProduct.units_per_box) > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-neutral-50 rounded-2xl px-4 py-2.5">
                          <span className="text-[11px] text-neutral-400 block">Cajas</span>
                          <input
                            type="number"
                            min={0}
                            value={moveBoxes}
                            onChange={(e) => setMoveBoxes(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                            className="w-full bg-transparent text-sm font-semibold text-neutral-900 focus:outline-none mt-0.5"
                          />
                        </div>
                        <div className="bg-neutral-50 rounded-2xl px-4 py-2.5">
                          <span className="text-[11px] text-neutral-400 block">Unidades sueltas</span>
                          <input
                            type="number"
                            min={0}
                            value={moveLooseUnits}
                            onChange={(e) => setMoveLooseUnits(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                            className="w-full bg-transparent text-sm font-semibold text-neutral-900 focus:outline-none mt-0.5"
                          />
                        </div>
                      </div>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        max={moveOriginStock}
                        value={moveQuantity}
                        onChange={(e) => setMoveQuantity(e.target.value)}
                        className="w-full bg-neutral-50 rounded-2xl px-4 py-3.5 text-sm font-semibold text-neutral-900 focus:outline-none"
                      />
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isMovingStock || !moveFromLocationId || !moveToLocationId}
                    className="bg-neutral-950 text-white rounded-2xl py-4 font-semibold w-full text-sm disabled:opacity-40 transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
                  >
                    {isMovingStock ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Ejecutando traslado...</span>
                      </>
                    ) : (
                      <span>Confirmar Traslado</span>
                    )}
                  </button>
                </form>
              )}
              </div>
            </div>
          )}

        </section>
      </div>

      {/* ========================================================================
          VISTA DE ESCRITORIO (>= 768px / hidden md:block)
         ======================================================================== */}
      <div className="hidden md:block space-y-6 pb-28 lg:pb-16 max-w-[1440px] mx-auto text-[#1E3A5F]">
      {/* ========================================================================
          CABECERA Y SELECTOR DE LOS 4 SUB-MÓDULOS DE UBICACIÓN
         ======================================================================== */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#E8B4A0] inline-block" />
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#616161]">
                WAREHOUSE SPATIAL ENGINE // LOGÍSTICA MULTI-UBICACIÓN
              </p>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E3A5F] uppercase">
              GESTIÓN DE UBICACIONES & RECEPCIÓN
            </h1>
            <p className="text-xs text-[#616161] mt-0.5">
              Asignación por lotes con validación de stock pendiente, consulta multi-ubicación y traslado atómico entre estantes.
            </p>
          </div>

          {/* Indicadores rápidos */}
          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            <div className="px-3.5 py-2 rounded-xl bg-[#F8F9FA] border border-[#E5E7EB] flex items-center gap-2">
              <Inbox className="w-4 h-4 text-[#E8B4A0]" />
              <span>
                EN RECEPCIÓN (SIN UBICAR):{' '}
                <strong className="text-[#1E3A5F]">{globalSummary.skusWithPending} SKUs</strong>
              </span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-[#F8F9FA] border border-[#E5E7EB] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#1E3A5F]" />
              <span>
                ESTANTES ACTIVOS: <strong className="text-[#1E3A5F]">{globalSummary.totalLocations}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Pestañas de los 3 Módulos de Ubicación */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#E5E7EB] font-mono text-xs">
          <button
            type="button"
            onClick={() => setSubTab('assign')}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
              subTab === 'assign'
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-sm'
                : 'bg-[#F8F9FA] text-[#1E3A5F] border-[#E5E7EB] hover:border-[#1E3A5F]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Barcode className={`w-4 h-4 shrink-0 ${subTab === 'assign' ? 'text-[#E8B4A0]' : 'text-[#1E3A5F]'}`} />
              <div className="truncate">
                <span className="text-[9px] uppercase tracking-widest block opacity-75">01 // LOTE</span>
                <span className="font-bold uppercase tracking-wider truncate block">ASIGNAR UBICACIÓN</span>
              </div>
            </div>
            {globalSummary.skusWithPending > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  subTab === 'assign' ? 'bg-[#E8B4A0] text-[#1E3A5F]' : 'bg-[#1E3A5F] text-white'
                }`}
              >
                {globalSummary.skusWithPending}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('consult')}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
              subTab === 'consult'
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-sm'
                : 'bg-[#F8F9FA] text-[#1E3A5F] border-[#E5E7EB] hover:border-[#1E3A5F]'
            }`}
          >
            <Search className={`w-4 h-4 shrink-0 ${subTab === 'consult' ? 'text-[#E8B4A0]' : 'text-[#1E3A5F]'}`} />
            <div className="truncate">
              <span className="text-[9px] uppercase tracking-widest block opacity-75">02 // MAPA</span>
              <span className="font-bold uppercase tracking-wider truncate block">CONSULTAR UBICACIÓN</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('move')}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
              subTab === 'move'
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-sm'
                : 'bg-[#F8F9FA] text-[#1E3A5F] border-[#E5E7EB] hover:border-[#1E3A5F]'
            }`}
          >
            <ArrowRightLeft className={`w-4 h-4 shrink-0 ${subTab === 'move' ? 'text-[#E8B4A0]' : 'text-[#1E3A5F]'}`} />
            <div className="truncate">
              <span className="text-[9px] uppercase tracking-widest block opacity-75">03 // TRASLADO</span>
              <span className="font-bold uppercase tracking-wider truncate block">MOVER UBICACIÓN</span>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================
          MÓDULO 2: "ASIGNAR UBICACIÓN" (PROCESAMIENTO POR LOTES Y VALIDACIÓN)
         ======================================================================== */}
      {subTab === 'assign' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda (8 cols): Escáner + Tabla Acumulativa Temporal */}
          <div className="lg:col-span-8 space-y-4">
            {/* Barra de Escaneo con Autofocus Permanente */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#E8B4A0] block">
                    ENTRADA DE ESCÁNER EN ALMACÉN (AUTOFOCUS ACTIVO)
                  </span>
                  <h2 className="text-base font-bold uppercase text-[#1E3A5F]">
                    Escanear o Digitar Producto por Ubicar
                  </h2>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#F8F9FA] border border-[#E5E7EB] text-[#616161]">
                  LECTOR BARCODE + ENTER
                </span>
              </div>

              <form onSubmit={handleAssignScanSubmit} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-[#1E3A5F] absolute left-4 top-3.5 pointer-events-none" />
                  <input
                    ref={assignScanInputRef}
                    type="text"
                    autoFocus
                    value={assignScanCode}
                    onChange={e => setAssignScanCode(e.target.value)}
                    placeholder="Escanea el código de barras (Enter) o escribe código / nombre..."
                    className="w-full min-h-[46px] bg-[#F8F9FA] focus:bg-white border-2 border-[#1E3A5F] rounded-xl pl-11 pr-4 py-2.5 text-xs sm:text-sm font-mono text-[#1E3A5F] placeholder:text-[#616161]/60 focus:outline-none transition-all"
                  />

                  {/* Coincidencias desplegables al escribir */}
                  {assignSuggestions.length > 0 && (
                    <div className="mt-1.5 bg-white border border-[#1E3A5F] rounded-xl shadow-lg divide-y divide-[#E5E7EB] overflow-hidden z-20 relative">
                      {assignSuggestions.map(prod => {
                        const inBatchQty = batchItems.find(b => b.product.id === prod.id)?.quantity || 0;
                        const remainingPending = Math.max(0, getPendingLocationStock(prod) - inBatchQty);
                        return (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => {
                              handleAddOrIncrementAssignProduct(prod);
                              setAssignScanCode('');
                              assignScanInputRef.current?.focus();
                            }}
                            className="w-full px-3.5 py-2.5 text-left hover:bg-[#F8F9FA] transition-colors flex items-center justify-between gap-3 font-mono text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-[#1E3A5F] mr-2">[{prod.code}]</span>
                              <span className="text-[#1E3A5F] uppercase font-medium truncate">
                                {prod.name}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 bg-[#E8B4A0]/35 text-[#1E3A5F]">
                              Por ubicar: {formatLocationQuantity(remainingPending, prod)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 self-start w-full sm:w-auto">
                  <button
                    type="submit"
                    className="flex-1 sm:flex-initial min-h-[46px] px-5 bg-[#1E3A5F] hover:bg-[#152a45] text-white rounded-xl text-xs font-mono uppercase tracking-wider font-semibold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 text-[#E8B4A0]" />
                    <span>Agregar (+1)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCameraScanTarget('assignProduct');
                      setCameraScannerOpen(true);
                    }}
                    className="min-h-[46px] px-4 bg-[#F8F9FA] hover:bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E5E7EB] rounded-xl text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                    title="Usar cámara como escáner"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Cámara</span>
                  </button>
                </div>
              </form>

              {/* Alertas de Validación de Stock Pendiente o Éxito */}
              {assignAlert && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-mono flex items-start justify-between gap-3 animate-in fade-in ${
                    assignAlert.type === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : assignAlert.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {assignAlert.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    )}
                    <span>{assignAlert.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAssignAlert(null)}
                    className="text-[10px] uppercase underline shrink-0"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>

            {/* Tabla Temporal Acumulativa */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8F9FA]">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#1E3A5F]" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F]">
                    LISTA TEMPORAL ACUMULATIVA DE ASIGNACIÓN ({batchItems.length} SKUs)
                  </h3>
                </div>
                {batchItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setBatchItems([]);
                      assignScanInputRef.current?.focus();
                    }}
                    className="text-[10px] font-mono uppercase text-rose-600 hover:underline"
                  >
                    Vaciar lista
                  </button>
                )}
              </div>

              {batchItems.length === 0 ? (
                <div className="p-10 text-center space-y-2 font-mono">
                  <Barcode className="w-8 h-8 text-[#616161]/40 mx-auto" />
                  <p className="text-xs uppercase text-[#1E3A5F] font-bold">
                    SIN PRODUCTOS EN EL LOTE TEMPORAL
                  </p>
                  <p className="text-[11px] text-[#616161] max-w-md mx-auto">
                    Escanea el código de barras de los productos recién ingresados o haz clic sobre los artículos en recepción para acumularlos aquí.
                  </p>
                </div>
              ) : (
                <>
                  {/* Vista Móvil (< md): Tarjetas Táctiles sin Scroll Horizontal */}
                  <div className="md:hidden divide-y divide-[#E5E7EB] font-mono text-xs">
                    {batchItems.map(item => {
                      const isBox =
                        item.product.unit_type === 'BOX' && Number(item.product.units_per_box) > 0;
                      const upb = Number(item.product.units_per_box || 1);

                      return (
                        <div key={item.product.id} className="p-4 space-y-3 bg-white">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-[#616161] uppercase block">
                                CÓDIGO: {item.product.code}
                              </span>
                              <span className="text-sm font-bold text-[#1E3A5F] uppercase block truncate">
                                {item.product.name}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveBatchItem(item.product.id)}
                              className="p-2 rounded-xl text-[#616161] hover:text-rose-600 bg-[#F8F9FA] border border-[#E5E7EB]"
                              title="Quitar de la lista"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between text-[11px] bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl px-3 py-2">
                            <span className="text-[#616161]">Stock Pendiente Máx.:</span>
                            <span className="font-bold text-[#1E3A5F]">
                              {formatLocationQuantity(item.maxPending, item.product)}
                            </span>
                          </div>

                          {isBox ? (
                            <div className="grid grid-cols-2 gap-2.5 pt-1">
                              <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl p-2.5 flex items-center justify-between">
                                <span className="text-[10px] text-[#616161] uppercase font-bold">Cajas:</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.boxes}
                                  onChange={e =>
                                    handleUpdateBatchBoxBreakdown(
                                      item.product.id,
                                      parseInt(e.target.value, 10) || 0,
                                      item.looseUnits
                                    )
                                  }
                                  className="w-16 h-8 text-center font-bold text-[#1E3A5F] bg-white border border-[#E5E7EB] rounded-lg text-xs"
                                />
                              </div>
                              <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl p-2.5 flex items-center justify-between">
                                <span className="text-[10px] text-[#616161] uppercase font-bold">Und:</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={upb - 1}
                                  value={item.looseUnits}
                                  onChange={e =>
                                    handleUpdateBatchBoxBreakdown(
                                      item.product.id,
                                      item.boxes,
                                      parseInt(e.target.value, 10) || 0
                                    )
                                  }
                                  className="w-16 h-8 text-center font-bold text-[#1E3A5F] bg-white border border-[#E5E7EB] rounded-lg text-xs"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl px-3 py-2">
                              <span className="text-[11px] font-bold text-[#1E3A5F] uppercase">
                                Cantidad a asignar:
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateBatchItemQuantity(item.product.id, item.quantity - 1)
                                  }
                                  disabled={item.quantity <= 1}
                                  className="w-9 h-9 rounded-xl border border-[#E5E7EB] bg-white text-[#1E3A5F] font-bold disabled:opacity-40"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={item.maxPending}
                                  value={item.quantity}
                                  onChange={e =>
                                    handleUpdateBatchItemQuantity(
                                      item.product.id,
                                      parseInt(e.target.value, 10) || 1
                                    )
                                  }
                                  className="w-16 h-9 text-center font-bold text-[#1E3A5F] bg-white border border-[#1E3A5F] rounded-xl text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateBatchItemQuantity(item.product.id, item.quantity + 1)
                                  }
                                  className="w-9 h-9 rounded-xl border border-[#E5E7EB] bg-white text-[#1E3A5F] font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Vista Escritorio (>= md): Tabla Completa */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-white border-b border-[#E5E7EB] text-[10px] uppercase tracking-wider text-[#616161]">
                          <th className="p-3.5">CÓDIGO</th>
                          <th className="p-3.5">NOMBRE DEL PRODUCTO</th>
                          <th className="p-3.5 text-center">CANTIDAD A ASIGNAR</th>
                          <th className="p-3.5 text-right">STOCK PENDIENTE MÁX.</th>
                          <th className="p-3.5 text-center">QUITAR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {batchItems.map(item => {
                          const isBox =
                            item.product.unit_type === 'BOX' && Number(item.product.units_per_box) > 0;
                          const upb = Number(item.product.units_per_box || 1);

                          return (
                            <tr key={item.product.id} className="hover:bg-[#F8F9FA]/70 transition-colors">
                              <td className="p-3.5 font-bold text-[#1E3A5F] whitespace-nowrap">
                                {item.product.code}
                              </td>
                              <td className="p-3.5">
                                <span className="font-bold text-[#1E3A5F] uppercase block">
                                  {item.product.name}
                                </span>
                                <span className="text-[10px] text-[#616161] block">
                                  Stock Total: {formatStockDisplay(item.product)} | Ya ubicado:{' '}
                                  {formatLocationQuantity(getAssignedLocationStock(item.product), item.product)}
                                </span>
                              </td>
                              <td className="p-3.5">
                                {isBox ? (
                                  <div className="flex flex-col items-center gap-1.5">
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg px-2 py-1">
                                        <span className="text-[9px] text-[#616161] uppercase">Cajas:</span>
                                        <input
                                          type="number"
                                          min={0}
                                          value={item.boxes}
                                          onChange={e =>
                                            handleUpdateBatchBoxBreakdown(
                                              item.product.id,
                                              parseInt(e.target.value, 10) || 0,
                                              item.looseUnits
                                            )
                                          }
                                          className="w-12 text-center font-bold text-[#1E3A5F] bg-white border border-[#E5E7EB] rounded px-1 py-0.5 text-xs"
                                        />
                                      </div>
                                      <div className="flex items-center gap-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg px-2 py-1">
                                        <span className="text-[9px] text-[#616161] uppercase">Und:</span>
                                        <input
                                          type="number"
                                          min={0}
                                          max={upb - 1}
                                          value={item.looseUnits}
                                          onChange={e =>
                                            handleUpdateBatchBoxBreakdown(
                                              item.product.id,
                                              item.boxes,
                                              parseInt(e.target.value, 10) || 0
                                            )
                                          }
                                          className="w-12 text-center font-bold text-[#1E3A5F] bg-white border border-[#E5E7EB] rounded px-1 py-0.5 text-xs"
                                        />
                                      </div>
                                    </div>
                                    <span className="text-[10px] text-[#1E3A5F] font-semibold">
                                      = {formatLocationQuantity(item.quantity, item.product)}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateBatchItemQuantity(item.product.id, item.quantity - 1)
                                      }
                                      disabled={item.quantity <= 1}
                                      className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F8F9FA] text-[#1E3A5F] font-bold disabled:opacity-40"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      max={item.maxPending}
                                      value={item.quantity}
                                      onChange={e =>
                                        handleUpdateBatchItemQuantity(
                                          item.product.id,
                                          parseInt(e.target.value, 10) || 1
                                        )
                                      }
                                      className="w-16 h-8 text-center font-bold text-[#1E3A5F] bg-white border border-[#1E3A5F] rounded-lg text-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateBatchItemQuantity(item.product.id, item.quantity + 1)
                                      }
                                      className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F8F9FA] text-[#1E3A5F] font-bold"
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5 text-right">
                                <span className="px-2.5 py-1 rounded-full bg-[#E8B4A0]/25 text-[#1E3A5F] border border-[#E8B4A0]/50 font-bold text-[11px]">
                                  {formatLocationQuantity(item.maxPending, item.product)}
                                </span>
                              </td>
                              <td className="p-3.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBatchItem(item.product.id)}
                                  className="p-1.5 rounded-lg text-[#616161] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Quitar de la lista"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Columna Derecha (4 cols): Selección de Ubicación Destino y Confirmación por Lote */}
          <div className="lg:col-span-4 bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm space-y-5 font-mono sticky top-20">
            <div className="pb-3 border-b border-[#E5E7EB]">
              <span className="text-[10px] uppercase tracking-widest text-[#E8B4A0] block">
                CONFIRMACIÓN POR LOTE
              </span>
              <h3 className="text-base font-bold text-[#1E3A5F] uppercase">
                Ubicación Física Destino
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1.5">
                Seleccionar Estante / Almacén Destino <span className="text-[#E8B4A0]">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <MinimalDropdown
                    value={targetAssignLocationId}
                    onChange={(val) => setTargetAssignLocationId(val)}
                    placeholder="Seleccionar estante o zona..."
                    options={locations.map((loc) => ({
                      value: loc.id,
                      label: loc.name,
                      badge: loc.code
                    }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCameraScanTarget('assignLocation');
                    setCameraScannerOpen(true);
                  }}
                  className="px-3.5 min-h-[44px] bg-[#F8F9FA] hover:bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E5E7EB] rounded-xl text-xs uppercase flex items-center gap-1"
                  title="Escanear código QR del estante destino"
                >
                  <QrCode className="w-4 h-4" />
                  <span>QR</span>
                </button>
              </div>
            </div>

            {/* Resumen del Lote */}
            <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#616161]">SKUs en lote:</span>
                <strong className="text-[#1E3A5F]">{batchItems.length} productos</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#616161]">Ubicación destino:</span>
                <strong className="text-[#1E3A5F] truncate max-w-[180px]">
                  {locations.find(l => l.id === targetAssignLocationId)?.name || 'SIN SELECCIONAR'}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmBatchAssignment}
              disabled={isAssigningBatch || batchItems.length === 0 || !targetAssignLocationId}
              className="w-full min-h-[48px] px-6 bg-[#1E3A5F] hover:bg-[#152a45] text-white rounded-xl text-xs uppercase tracking-wider font-bold shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isAssigningBatch ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                  <span>PROCESANDO LOTE...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-[#E8B4A0]" />
                  <span>CONFIRMAR Y ASIGNAR UBICACIÓN</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================
          MÓDULO 3: "CONSULTAR UBICACIÓN" (DESGLOSE MULTI-UBICACIÓN)
         ======================================================================== */}
      {subTab === 'consult' && (
        <div className="space-y-6">
          {/* Buscador Flexible por Escáner o Nombre / Código */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#E8B4A0] block">
                  LOCALIZADOR ESPACIAL MULTI-ALMACÉN
                </span>
                <h2 className="text-base font-bold uppercase text-[#1E3A5F]">
                  Consultar Distribución Física de Producto
                </h2>
              </div>
            </div>

            <form onSubmit={handleConsultSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#1E3A5F] absolute left-4 top-3.5 pointer-events-none" />
                <input
                  ref={consultInputRef}
                  type="text"
                  autoFocus
                  value={consultQuery}
                  onChange={e => setConsultQuery(e.target.value)}
                  placeholder="Escanea el código de barras o escribe el nombre / SKU del artículo..."
                  className="w-full min-h-[46px] bg-[#F8F9FA] focus:bg-white border-2 border-[#1E3A5F] rounded-xl pl-11 pr-4 py-2.5 text-xs sm:text-sm font-mono text-[#1E3A5F] placeholder:text-[#616161]/60 focus:outline-none"
                />

                {/* Coincidencias desplegables al escribir */}
                {consultSuggestions.length > 0 && (
                  <div className="mt-1.5 bg-white border border-[#1E3A5F] rounded-xl shadow-lg divide-y divide-[#E5E7EB] overflow-hidden z-20 relative">
                    {consultSuggestions.map(prod => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => {
                          setConsultedProductId(prod.id);
                          setConsultAlert(null);
                          setConsultQuery('');
                          consultInputRef.current?.focus();
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-[#F8F9FA] transition-colors flex items-center justify-between gap-3 font-mono text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-[#1E3A5F] mr-2">[{prod.code}]</span>
                          <span className="text-[#1E3A5F] uppercase font-medium truncate">
                            {prod.name}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] text-[10px] font-bold shrink-0">
                          Stock: {formatLocationQuantity(prod.stock, prod)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 self-start w-full sm:w-auto">
                <button
                  type="submit"
                  className="flex-1 sm:flex-initial min-h-[46px] px-5 bg-[#1E3A5F] hover:bg-[#152a45] text-white rounded-xl text-xs font-mono uppercase tracking-wider font-semibold flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4 text-[#E8B4A0]" />
                  <span>Consultar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCameraScanTarget('consultProduct');
                    setCameraScannerOpen(true);
                  }}
                  className="min-h-[46px] px-4 bg-[#F8F9FA] hover:bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E5E7EB] rounded-xl text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  <span>Cámara</span>
                </button>
              </div>
            </form>

            {consultAlert && (
              <div className="p-3.5 rounded-xl border bg-rose-50 border-rose-200 text-rose-800 text-xs font-mono flex items-start justify-between gap-3 animate-in fade-in">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{consultAlert}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setConsultAlert(null)}
                  className="text-[10px] uppercase underline shrink-0"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>

          {/* Resultado de Cabecera + Tarjetas de Distribución Física */}
          {!consultedProduct ? (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-12 text-center space-y-2 font-mono">
              <MapPin className="w-8 h-8 text-[#616161]/40 mx-auto" />
              <p className="text-xs uppercase font-bold text-[#1E3A5F]">
                ESCRIBE O ESCANEA UN ARTÍCULO PARA CONSULTAR SUS UBICACIONES
              </p>
              <p className="text-[11px] text-[#616161]">
                Se mostrará el stock global, el desglose exacto por estantería y el stock pendiente en recepción.
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              {/* Resultado de Cabecera del Producto */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#1E3A5F] text-white text-[10px] font-bold uppercase">
                      CÓDIGO: {consultedProduct.code}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] text-[10px] font-bold uppercase">
                      UNIDAD BASE:{' '}
                      {consultedProduct.unit_type === 'BOX'
                        ? `CAJA (1 CAJA = ${consultedProduct.units_per_box || 1} UNIDADES)`
                        : 'UNIDAD (UND)'}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#1E3A5F] uppercase font-sans">
                    {consultedProduct.name}
                  </h3>
                </div>

                <div className="p-4 bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl text-right shrink-0">
                  <span className="text-[10px] uppercase tracking-wider text-[#616161] block">
                    STOCK TOTAL GLOBAL
                  </span>
                  <span className="text-2xl font-bold text-[#1E3A5F] block">
                    {formatLocationQuantity(consultedProduct.stock, consultedProduct)}
                  </span>
                  {consultedProduct.unit_type === 'BOX' && getBoxBreakdown(consultedProduct).breakdownLabel && (
                    <span className="text-[10px] text-[#616161] block">
                      {getBoxBreakdown(consultedProduct).breakdownLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Tarjetas de Distribución Física Multi-Ubicación */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
                {/* Tarjeta Destacada si existe Stock Pendiente sin asignar */}
                {getPendingLocationStock(consultedProduct) > 0.0001 && (
                  <div className="p-5 rounded-2xl bg-[#E8B4A0]/20 border-2 border-[#E8B4A0] flex flex-col justify-between space-y-4 shadow-xs">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#1E3A5F] text-[#E8B4A0] text-[10px] font-bold uppercase">
                          PENDIENTE DE UBICAR
                        </span>
                        <Inbox className="w-5 h-5 text-[#1E3A5F]" />
                      </div>
                      <h4 className="text-sm font-bold text-[#1E3A5F] uppercase pt-1">
                        Sin Ubicación Asignada / En Recepción
                      </h4>
                      <p className="text-lg font-bold text-[#1E3A5F]">
                        {formatLocationQuantity(getPendingLocationStock(consultedProduct), consultedProduct)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleAddOrIncrementAssignProduct(consultedProduct);
                        setSubTab('assign');
                      }}
                      className="w-full min-h-[38px] px-4 rounded-xl bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#E8B4A0]" />
                      <span>Asignar a un Estante</span>
                    </button>
                  </div>
                )}

                {/* Tarjetas de cada Ubicación donde existe stock */}
                {(consultedProduct.product_locations || [])
                  .filter(pl => Number(pl.quantity || 0) > 0.0001)
                  .map((pl, index) => (
                    <div
                      key={pl.id}
                      className="p-5 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#1E3A5F] flex flex-col justify-between space-y-4 shadow-xs transition-all"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider text-[#616161]">
                            UBICACIÓN #{index + 1}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] text-[10px] font-bold">
                            {pl.locations?.code || 'LOC'}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-[#1E3A5F] uppercase flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-[#E8B4A0] shrink-0" />
                          <span>{pl.locations?.name || 'Estante'}</span>
                        </h4>
                        <div className="pt-2 border-t border-[#E5E7EB]">
                          <span className="text-[10px] text-[#616161] uppercase block">
                            CANTIDAD DISPONIBLE EN ZONA:
                          </span>
                          <span className="text-lg font-bold text-[#1E3A5F] block">
                            {formatLocationQuantity(pl.quantity, consultedProduct)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          selectProductForMove(consultedProduct, pl.location_id);
                          setSubTab('move');
                        }}
                        className="w-full min-h-[38px] px-4 rounded-xl bg-[#F8F9FA] hover:bg-[#1E3A5F] text-[#1E3A5F] hover:text-white border border-[#E5E7EB] text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Mover desde esta zona</span>
                      </button>
                    </div>
                  ))}

                {(consultedProduct.product_locations || []).filter(pl => Number(pl.quantity || 0) > 0.0001).length ===
                  0 &&
                  getPendingLocationStock(consultedProduct) <= 0.0001 && (
                    <div className="col-span-full p-8 bg-white border border-[#E5E7EB] rounded-2xl text-center text-xs text-[#616161]">
                      Este producto tiene 0 existencias disponibles actualmente.
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================
          MÓDULO 4: "MOVER UBICACIÓN" (REUBICACIÓN ENTRE ZONAS)
         ======================================================================== */}
      {subTab === 'move' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Búsqueda / Escaneo del Producto a Trasladar */}
          <div className="lg:col-span-5 bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm space-y-4 font-mono">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#E8B4A0] block">
                PASO 1 // SELECCIÓN POR ESCÁNER
              </span>
              <h2 className="text-base font-bold text-[#1E3A5F] uppercase">
                Producto a Trasladar
              </h2>
            </div>

            <form onSubmit={handleMoveScanSubmit} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-[#1E3A5F] absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  ref={moveScanInputRef}
                  type="text"
                  autoFocus
                  value={moveScanQuery}
                  onChange={e => setMoveScanQuery(e.target.value)}
                  placeholder="Escanea el código de barras o escribe nombre / código..."
                  className="w-full min-h-[44px] bg-[#F8F9FA] focus:bg-white border-2 border-[#1E3A5F] rounded-xl pl-10 pr-3 py-2 text-xs text-[#1E3A5F] focus:outline-none"
                />

                {/* Coincidencias desplegables al escribir */}
                {moveSuggestions.length > 0 && (
                  <div className="mt-1.5 bg-white border border-[#1E3A5F] rounded-xl shadow-lg divide-y divide-[#E5E7EB] overflow-hidden z-20 relative">
                    {moveSuggestions.map(prod => {
                      const assigned = getAssignedLocationStock(prod);
                      const locCount = (prod.product_locations || []).filter(pl => Number(pl.quantity) > 0).length;
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => {
                            selectProductForMove(prod);
                            setMoveScanQuery('');
                          }}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-[#F8F9FA] transition-colors flex items-center justify-between gap-2 font-mono text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-[#1E3A5F] mr-1.5">[{prod.code}]</span>
                            <span className="text-[#1E3A5F] uppercase font-medium truncate">
                              {prod.name}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] text-[10px] font-bold shrink-0">
                            {assigned > 0.0001
                              ? `${formatLocationQuantity(assigned, prod)} (${locCount} ${locCount === 1 ? 'zona' : 'zonas'})`
                              : 'Sin ubicar'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 self-start w-full sm:w-auto">
                <button
                  type="submit"
                  className="flex-1 sm:flex-initial min-h-[44px] px-4 bg-[#1E3A5F] hover:bg-[#152a45] text-white rounded-xl text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5 text-[#E8B4A0]" />
                  <span>Buscar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCameraScanTarget('moveProduct');
                    setCameraScannerOpen(true);
                  }}
                  className="px-3.5 min-h-[44px] bg-[#F8F9FA] hover:bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E5E7EB] rounded-xl text-xs uppercase flex items-center justify-center gap-1.5"
                  title="Escanear con cámara"
                >
                  <Camera className="w-4 h-4" />
                  <span className="sm:hidden">Cámara</span>
                </button>
              </div>
            </form>

            {moveAlert && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                  moveAlert.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  {moveAlert.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  )}
                  <span>{moveAlert.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMoveAlert(null)}
                  className="text-[10px] underline uppercase shrink-0"
                >
                  OK
                </button>
              </div>
            )}
          </div>

          {/* Formulario de Traslado entre Origen y Destino */}
          <div className="lg:col-span-7 bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-sm font-mono">
            {!moveSelectedProduct ? (
              <div className="py-12 text-center space-y-2">
                <ArrowRightLeft className="w-8 h-8 text-[#616161]/40 mx-auto" />
                <p className="text-xs uppercase font-bold text-[#1E3A5F]">
                  ESCRIBE O ESCANEA UN PRODUCTO PARA INICIAR EL TRASLADO
                </p>
                <p className="text-[11px] text-[#616161]">
                  Podrás elegir la ubicación de origen con su saldo exacto, la cantidad a mover y la ubicación de destino.
                </p>
              </div>
            ) : (
              <form onSubmit={handleConfirmMove} className="space-y-5">
                <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#616161] uppercase block">
                      ARTÍCULO SELECCIONADO ({moveSelectedProduct.code})
                    </span>
                    <h3 className="text-base font-bold text-[#1E3A5F] uppercase">
                      {moveSelectedProduct.name}
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white border border-[#E5E7EB] text-xs font-bold text-[#1E3A5F]">
                    Total: {formatStockDisplay(moveSelectedProduct)}
                  </span>
                </div>

                {moveAvailableOrigins.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                    <p className="font-bold uppercase">
                      Este producto aún no tiene stock asignado a ninguna ubicación física.
                    </p>
                    <p>
                      Todo su stock ({formatLocationQuantity(moveSelectedProduct.stock, moveSelectedProduct)}) se encuentra en recepción pendiente de ubicar.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        handleAddOrIncrementAssignProduct(moveSelectedProduct);
                        setSubTab('assign');
                      }}
                      className="px-4 py-2 rounded-lg bg-[#1E3A5F] text-white text-xs uppercase font-bold"
                    >
                      Ir a Asignar Ubicación
                    </button>
                  </div>
                ) : (
                  <>
                    {/* 1. Selector de Origen (solo ubicaciones con stock actual > 0) */}
                    <div>
                      <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1.5">
                        1. Ubicación de Origen (Con Saldo Disponible) <span className="text-[#E8B4A0]">*</span>
                      </label>
                      <MinimalDropdown
                        value={moveFromLocationId}
                        onChange={(val) => handleOriginLocationChange(val)}
                        placeholder="Seleccionar origen..."
                        options={moveAvailableOrigins.map((pl) => ({
                          value: pl.location_id,
                          label: pl.locations?.name || 'Estante',
                          badge: `${pl.locations?.code || ''} · Disp: ${formatLocationQuantity(pl.quantity, moveSelectedProduct)}`
                        }))}
                      />
                    </div>

                    {/* 2. Cantidad a trasladar validada contra el stock de origen */}
                    {moveFromLocationId && (
                      <div className="p-4 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider">
                            2. Cantidad a Trasladar <span className="text-[#E8B4A0]">*</span>
                          </label>
                          <span className="text-[11px] text-[#1E3A5F] font-bold">
                            Máx en origen: {formatLocationQuantity(moveOriginStock, moveSelectedProduct)}
                          </span>
                        </div>

                        {moveSelectedProduct.unit_type === 'BOX' &&
                        Number(moveSelectedProduct.units_per_box) > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] text-[#616161] uppercase mb-1">
                                Cajas completas a trasladar
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={Math.floor(moveOriginStock + 0.0001)}
                                value={moveBoxes}
                                onChange={e =>
                                  setMoveBoxes(Math.max(0, parseInt(e.target.value, 10) || 0))
                                }
                                className="w-full min-h-[40px] bg-white border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-sm font-bold text-[#1E3A5F]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-[#616161] uppercase mb-1">
                                Unidades sueltas a trasladar
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={Number(moveSelectedProduct.units_per_box) - 1}
                                value={moveLooseUnits}
                                onChange={e =>
                                  setMoveLooseUnits(Math.max(0, parseInt(e.target.value, 10) || 0))
                                }
                                className="w-full min-h-[40px] bg-white border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-sm font-bold text-[#1E3A5F]"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={Math.round(moveOriginStock)}
                              step={1}
                              value={moveQuantity}
                              onChange={e => setMoveQuantity(e.target.value)}
                              required
                              className="flex-1 min-h-[42px] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm font-bold text-[#1E3A5F]"
                            />
                            <button
                              type="button"
                              onClick={() => setMoveQuantity(String(Math.round(moveOriginStock)))}
                              className="min-h-[42px] px-4 rounded-xl bg-[#E8B4A0]/25 hover:bg-[#E8B4A0]/40 text-[#1E3A5F] border border-[#E8B4A0]/50 text-xs uppercase font-bold"
                            >
                              Todo ({Math.round(moveOriginStock)})
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. Selector de Destino */}
                    <div>
                      <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1.5">
                        3. Ubicación de Destino <span className="text-[#E8B4A0]">*</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <MinimalDropdown
                            value={moveToLocationId}
                            onChange={(val) => setMoveToLocationId(val)}
                            placeholder="Seleccionar destino..."
                            options={moveAvailableDestinations.map((loc) => ({
                              value: loc.id,
                              label: loc.name,
                              badge: loc.code
                            }))}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCameraScanTarget('moveDestination');
                            setCameraScannerOpen(true);
                          }}
                          className="px-4 min-h-[44px] bg-[#F8F9FA] hover:bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E5E7EB] rounded-xl text-xs uppercase flex items-center gap-1.5"
                          title="Escanear QR de estante destino"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>QR</span>
                        </button>
                      </div>
                    </div>

                    {/* Motivo opcional */}
                    <div>
                      <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1.5">
                        Motivo / Nota de Auditoría (Opcional)
                      </label>
                      <input
                        type="text"
                        value={moveReason}
                        onChange={e => setMoveReason(e.target.value)}
                        placeholder="Ej: Reposición de mostrador, reacomodo de pasillo..."
                        className="w-full min-h-[42px] bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl px-4 py-2 text-xs text-[#1E3A5F]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isMovingStock || !moveFromLocationId || !moveToLocationId}
                      className="w-full min-h-[48px] px-6 bg-[#1E3A5F] hover:bg-[#152a45] text-white rounded-xl text-xs uppercase tracking-wider font-bold shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {isMovingStock ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#E8B4A0]" />
                          <span>EJECUTANDO TRASLADO...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-[#E8B4A0]" />
                          <span>CONFIRMAR TRASLADO</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      </div>

      {/* Modal de Escáner de Cámara */}
      <BarcodeScannerModal
        isOpen={cameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        onScanSuccess={handleCameraScanSuccess}
        title="ESCANEAR CÓDIGO DE BARRAS / QR"
      />
    </>
  );
};
