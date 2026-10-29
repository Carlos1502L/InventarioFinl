import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Barcode,
  Upload,
  Trash2,
  Loader2,
  MapPin,
  Tag,
  Layers,
  Check,
  Plus,
  AlertCircle,
  Sparkles,
  GitBranch,
  Package
} from 'lucide-react';
import { Product, Category, Subcategory, Location, UnitType } from '../../types/database';
import {
  supabase,
  uploadProductImage,
  logAuditAction,
  formatCurrency,
  formatCleanDecimal,
  formatStockDisplay,
  getBoxBreakdown
} from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { RestockProductModal } from './RestockProductModal';
import { MinimalDropdown } from '../ui/MinimalDropdown';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  productToEdit?: Product | null;
  categories: Category[];
  subcategories: Subcategory[];
  locations: Location[];
  products?: Product[];
  onRedirectToStock?: (product: Product) => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  productToEdit,
  categories,
  subcategories,
  locations,
  products = [],
  onRedirectToStock
}) => {
  const { currentInventory, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modo de inventario
  const isBusiness = currentInventory?.inventory_type !== 'PERSONAL';

  // Estados del Formulario
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  // RF-01: Precios (Negocio: Costo + Ganancia % = Precio Final; Personal: Valor Base)
  const [costPrice, setCostPrice] = useState<string>('0.00');
  const [markupPercentage, setMarkupPercentage] = useState<string>('20.00');
  const [price, setPrice] = useState<string>('0.00');

  // Requerimiento Unidad de Medida Dual: 'UNIT' | 'BOX'
  const [unitType, setUnitType] = useState<UnitType>('UNIT');
  const [unitsPerBox, setUnitsPerBox] = useState<string>('12');
  const [initialLooseUnits, setInitialLooseUnits] = useState<string>('0');

  // Stock y Control de Stock Mínimo (RF-04.1: Umbral inicial configurable en 1)
  const [stock, setStock] = useState<string>('1');
  const [minStock, setMinStock] = useState<string>('1');

  // Categorías y Ubicación
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);

  // RF-03.1: Variantes de Producto
  const [isVariant, setIsVariant] = useState(false);
  const [parentId, setParentId] = useState<string>('');
  const [variantColor, setVariantColor] = useState('');
  const [variantSize, setVariantSize] = useState('');
  const [variantRegion, setVariantRegion] = useState('');

  // RF-06.2 & 3.2: Detección inteligente de duplicados por QR / Código de Barras
  const [duplicateDetectedProduct, setDuplicateDetectedProduct] = useState<Product | null>(null);

  // Estados de UI y Cámara
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Escáner Modal
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<'productCode' | 'locationCode'>('productCode');

  // Inicializar o limpiar campos
  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name || '');
      setCode(productToEdit.code || '');
      setDescription(productToEdit.description || '');

      const initialPrice = productToEdit.price ? String(productToEdit.price) : '0.00';
      const initialCost = productToEdit.cost_price ? String(productToEdit.cost_price) : '0.00';
      const initialMarkup = productToEdit.markup_percentage ? String(productToEdit.markup_percentage) : '20.00';

      setPrice(initialPrice);
      setCostPrice(initialCost);
      setMarkupPercentage(initialMarkup);

      const editUnitType: UnitType = productToEdit.unit_type === 'BOX' ? 'BOX' : 'UNIT';
      setUnitType(editUnitType);
      setUnitsPerBox(
        productToEdit.units_per_box && productToEdit.units_per_box > 0
          ? String(productToEdit.units_per_box)
          : '12'
      );
      setInitialLooseUnits('0');

      setStock(
        productToEdit.stock !== undefined
          ? editUnitType === 'BOX'
            ? formatCleanDecimal(productToEdit.stock, 4)
            : String(Math.round(Number(productToEdit.stock)))
          : '0'
      );
      setMinStock(productToEdit.min_stock !== undefined ? String(productToEdit.min_stock) : '1');

      setCategoryId(productToEdit.category_id || '');
      setSubcategoryId(productToEdit.subcategory_id || '');
      setLocationId(productToEdit.location_id || (locations[0]?.id || ''));
      setImages(productToEdit.images || []);

      // RF-03.1: Cargar variantes si existen
      setIsVariant(Boolean(productToEdit.is_variant || productToEdit.parent_id));
      setParentId(productToEdit.parent_id || '');
      if (productToEdit.variant_attributes) {
        setVariantColor(productToEdit.variant_attributes['Color'] || '');
        setVariantSize(productToEdit.variant_attributes['Talla/Tamaño'] || '');
        setVariantRegion(productToEdit.variant_attributes['Región/Versión'] || '');
      } else {
        setVariantColor('');
        setVariantSize('');
        setVariantRegion('');
      }
    } else {
      setName('');
      setCode('');
      setDescription('');
      setCostPrice('0.00');
      setMarkupPercentage('20.00');
      setPrice('0.00');
      setUnitType('UNIT');
      setUnitsPerBox('12');
      setInitialLooseUnits('0');
      setStock('1');
      setMinStock('1'); // RF-04.1: Configuración inicial en 1 unidad
      setCategoryId('');
      setSubcategoryId('');
      setLocationId(locations[0]?.id || '');
      setImages([]);
      setIsVariant(false);
      setParentId('');
      setVariantColor('');
      setVariantSize('');
      setVariantRegion('');
    }
    setErrorMsg(null);
    setDuplicateDetectedProduct(null);
  }, [productToEdit, isOpen, categories, locations]);

  // RF-01.2: Recálculo automático de precio de venta según costo y markup
  const handleCostChange = (val: string) => {
    setCostPrice(val);
    const cost = parseFloat(val) || 0;
    const markup = parseFloat(markupPercentage) || 0;
    const computedPrice = (cost * (1 + markup / 100)).toFixed(2);
    setPrice(computedPrice);
  };

  const handleMarkupChange = (val: string) => {
    setMarkupPercentage(val);
    const cost = parseFloat(costPrice) || 0;
    const markup = parseFloat(val) || 0;
    const computedPrice = (cost * (1 + markup / 100)).toFixed(2);
    setPrice(computedPrice);
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    if (isBusiness) {
      const finalPrice = parseFloat(val) || 0;
      const cost = parseFloat(costPrice) || 0;
      if (cost > 0) {
        const computedMarkup = (((finalPrice - cost) / cost) * 100).toFixed(2);
        setMarkupPercentage(computedMarkup);
      }
    }
  };

  // Filtrar subcategorías dependientes de la categoría seleccionada
  const filteredSubcategories = subcategories.filter(s => s.category_id === categoryId);

  // Lista de posibles productos padres para variantes
  const candidateParents = products.filter(p => !p.is_variant && p.id !== productToEdit?.id);

  // Manejador de subida de imágenes con compresión automática
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentInventory) return;

    if (images.length + files.length > 3) {
      setErrorMsg('Solo se permite un máximo de 3 fotografías por producto.');
      return;
    }

    try {
      setIsUploadingImage(true);
      setErrorMsg(null);

      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 15 * 1024 * 1024) {
          throw new Error(`La imagen "${file.name}" supera el límite de 15 MB.`);
        }
        const url = await uploadProductImage(file, currentInventory.id);
        newUrls.push(url);
      }

      setImages(prev => [...prev, ...newUrls].slice(0, 3));
    } catch (err: any) {
      console.error('Error subiendo imagen:', err);
      setErrorMsg(err.message || 'Error al subir la imagen.');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // RF-06.2 & 3.2: Manejo de lectura exitosa del escáner óptico con detección de duplicados
  const handleScanSuccess = (scannedText: string) => {
    const cleanText = scannedText.trim();
    if (scanTarget === 'productCode') {
      // Buscar si el producto ya existe en el inventario actual
      const existing = products.find(
        p => p.code.toLowerCase() === cleanText.toLowerCase() && p.id !== productToEdit?.id
      );

      if (existing) {
        // 3.2: Mostrar diálogo: "El producto ya existe en el sistema. ¿Deseas añadir más existencias?"
        setDuplicateDetectedProduct(existing);
      } else {
        setCode(cleanText);
      }
    } else if (scanTarget === 'locationCode') {
      const foundLoc = locations.find(
        l => l.code.toUpperCase() === cleanText.toUpperCase() || l.id === cleanText
      );
      if (foundLoc) {
        setLocationId(foundLoc.id);
      } else {
        setErrorMsg(`No se encontró ninguna ubicación con el código "${cleanText}".`);
      }
    }
  };

  // Cálculo reactivo de stock consolidado (cuando es BOX suma cajas + unidades sueltas / units_per_box)
  const parsedUpb = parseInt(unitsPerBox, 10) || 0;
  const parsedBaseStock = parseFloat(stock) || 0;
  const parsedLoose = parseInt(initialLooseUnits, 10) || 0;
  const consolidatedStock =
    unitType === 'BOX'
      ? parsedUpb > 0
        ? Number((parsedBaseStock + parsedLoose / parsedUpb).toFixed(4))
        : parsedBaseStock
      : Math.round(parsedBaseStock);

  // Guardar Producto (Nuevo o Edición)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInventory || !user) return;

    if (!name.trim()) {
      setErrorMsg('El nombre del producto es obligatorio.');
      return;
    }
    if (!code.trim()) {
      setErrorMsg('El código o SKU del producto es obligatorio.');
      return;
    }

    // 4. Validación Técnica de Creación para tipo Caja (BOX)
    if (unitType === 'BOX') {
      if (!unitsPerBox.trim() || !Number.isInteger(parsedUpb) || parsedUpb <= 0) {
        setErrorMsg('Para productos tipo Caja, "Unidades por caja" debe ser un número entero mayor a 0.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const parsedPrice = parseFloat(price) || 0;
      const parsedCostPrice = parseFloat(costPrice) || 0;
      const parsedMarkup = parseFloat(markupPercentage) || 0;
      const parsedMinStock = Math.max(1, parseInt(minStock, 10) || 1); // RF-04.1

      // Armar atributos de variante si aplica
      const variantAttributes: Record<string, string> = {};
      if (variantColor.trim()) variantAttributes['Color'] = variantColor.trim();
      if (variantSize.trim()) variantAttributes['Talla/Tamaño'] = variantSize.trim();
      if (variantRegion.trim()) variantAttributes['Región/Versión'] = variantRegion.trim();

      const payload = {
        inventory_id: currentInventory.id,
        name: name.trim(),
        code: code.trim(),
        description: description.trim() || null,
        price: parsedPrice,
        cost_price: isBusiness ? parsedCostPrice : 0,
        markup_percentage: isBusiness ? parsedMarkup : 0,
        unit_type: unitType,
        units_per_box: unitType === 'BOX' ? parsedUpb : null,
        stock: consolidatedStock,
        min_stock: parsedMinStock,
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        location_id: productToEdit ? (productToEdit.location_id || null) : null,
        images: images,
        is_variant: isVariant,
        parent_id: isVariant && parentId ? parentId : null,
        variant_attributes: isVariant ? variantAttributes : {},
        status: 'ACTIVE' as const,
        last_modified_by: user.id,
        last_modified_by_email: user.email
      };

      const formattedStockLabel = formatStockDisplay({
        stock: consolidatedStock,
        unit_type: unitType,
        units_per_box: unitType === 'BOX' ? parsedUpb : null
      });

      if (productToEdit) {
        // ACTUALIZACIÓN
        const { error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', productToEdit.id);

        if (updateError) throw updateError;

        await logAuditAction({
          inventoryId: currentInventory.id,
          productId: productToEdit.id,
          productName: payload.name,
          actionType: 'UPDATE',
          details: `Producto actualizado por ${user.email}. Unidad: ${unitType}${unitType === 'BOX' ? ` (1 caja = ${parsedUpb} und)` : ''}, Precio: ${parsedPrice}, Stock: ${formattedStockLabel}`,
          metadata: {
            previous_price: productToEdit.price,
            new_price: parsedPrice,
            previous_stock: productToEdit.stock,
            new_stock: consolidatedStock,
            unit_type: unitType,
            units_per_box: unitType === 'BOX' ? parsedUpb : null
          }
        });
      } else {
        // CREACIÓN
        const { data: newProd, error: insertError } = await supabase
          .from('products')
          .insert(payload)
          .select()
          .single();

        if (insertError) throw insertError;

        await logAuditAction({
          inventoryId: currentInventory.id,
          productId: newProd.id,
          productName: payload.name,
          actionType: 'CREATE',
          details: `Producto creado (${payload.code}) en modo ${unitType === 'BOX' ? `CAJA (1 caja = ${parsedUpb} und)` : 'UNIDAD'} con stock inicial de ${formattedStockLabel}.`,
          metadata: {
            initial_stock: consolidatedStock,
            unit_type: unitType,
            units_per_box: unitType === 'BOX' ? parsedUpb : null,
            price: parsedPrice
          }
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error guardando producto:', err);
      if (err.code === '23505') {
        setErrorMsg(`Ya existe otro producto con el código "${code}" en este inventario.`);
      } else {
        setErrorMsg(err.message || 'Error al guardar el producto.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedLocationObj = locations.find(l => l.id === locationId);
  const selectedCategoryObj = categories.find(c => c.id === categoryId);
  const selectedSubcategoryObj = subcategories.find(s => s.id === subcategoryId);
  const numMinStock = Number(minStock || 0);
  const isStockLow = consolidatedStock < numMinStock;

  const previewStockText = formatStockDisplay({
    stock: consolidatedStock,
    unit_type: unitType,
    units_per_box: unitType === 'BOX' ? parsedUpb : null
  });

  const previewBoxBreakdown = getBoxBreakdown({
    stock: consolidatedStock,
    unit_type: unitType,
    units_per_box: unitType === 'BOX' ? parsedUpb : null
  });

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 max-md:bg-black/75 backdrop-blur-sm p-3 sm:p-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-y-auto animate-in fade-in">
        <div className="mobile-dark-modal bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-xl lg:max-w-5xl my-auto overflow-hidden shadow-xl flex flex-col max-h-[85vh]">
          {/* Cabecera Principal / En móvil: Bloque 1 Cabecera Oscura Curva con Handle */}
          <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#ffffff] shrink-0 z-20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col max-md:flex-col-reverse">
                <span className="text-[10px] tracking-widest uppercase font-mono text-[#E8B4A0] block">
                  {productToEdit ? 'Edición de manifiesto en catálogo' : 'Nuevo registro en catálogo'}
                </span>
                <h3 className="font-bold text-[#1E3A5F] text-lg uppercase tracking-tight">
                  {productToEdit ? 'Modificar Producto' : 'Crear Nuevo Producto'}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Formulario Asimétrico 2 Columnas (60% Formulario / 40% Previsualización en Vivo en Tablets y Desktop) */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-hidden max-md:overflow-y-auto flex-1 min-h-0 flex flex-col max-md:block">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-0 max-md:block">
              
              {/* =========================================================
                  PANEL IZQUIERDO (~60%): ENTRADA Y FORMULARIO (ÚNICO CON SCROLL)
                 ========================================================= */}
              <div className="w-full lg:col-span-7 max-h-[calc(85vh-120px)] max-md:max-h-none overflow-y-auto max-md:overflow-visible pr-3 max-md:pr-0 space-y-4 custom-scrollbar">
                {errorMsg && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* 1. Nombre */}
                <div>
                  <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">
                    Nombre del Producto <span className="text-[#E8B4A0]">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej: Pulsera Minimalista Plata 925"
                    required
                    className="w-full min-h-[44px] bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm text-[#1E3A5F] placeholder:text-[#616161]/50 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] focus:border-[#1E3A5F] transition-all"
                  />
                </div>

                {/* 2. Código / SKU con Escáner de Cámara */}
                <div>
                  <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">
                    Código / SKU / Código de Barras <span className="text-[#E8B4A0]">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        placeholder="Ej: SKU-9821-PLT"
                        required
                        className="w-full min-h-[44px] bg-[#ffffff] border border-[#E5E7EB] rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-mono text-[#1E3A5F] placeholder:text-[#616161]/50 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] focus:border-[#1E3A5F] transition-all uppercase"
                      />
                      <Barcode className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setScanTarget('productCode');
                        setScannerOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 min-h-[44px] bg-[#F8F9FA] hover:bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E5E7EB] rounded-xl text-xs uppercase tracking-wider transition-all whitespace-nowrap active:scale-95"
                    >
                      <Camera className="w-4 h-4 text-[#1E3A5F]" /> Escanear
                    </button>
                  </div>
                </div>

                {/* 3.1: SELECTOR DE UNIDAD DE MEDIDA DUAL: [ Unidad ] | [ Caja ] */}
                <div className="mobile-flat-section p-4 bg-[#F8F9FA] rounded-2xl border border-[#E5E7EB] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-[#1E3A5F] max-md:text-neutral-700 max-md:font-semibold max-md:normal-case uppercase tracking-wider block">
                        Unidad de Medida Operativa <span className="text-[#E8B4A0]">*</span>
                      </span>
                      <span className="text-[11px] text-[#616161]">
                        Define si el control de inventario se realiza por unidad individual o por caja fraccionable
                      </span>
                    </div>

                    {/* Botones Selector [ Unidad ] | [ Caja ] */}
                    <div className="mobile-segmented grid grid-cols-2 gap-1.5 p-1 bg-white border border-[#E5E7EB] rounded-xl shrink-0 font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setUnitType('UNIT');
                          setInitialLooseUnits('0');
                          setStock(prev => String(Math.max(0, Math.round(parseFloat(prev) || 1))));
                        }}
                        className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                          unitType === 'UNIT'
                            ? 'bg-[#1E3A5F] text-white shadow-sm mobile-pill-active'
                            : 'text-[#616161] hover:text-[#1E3A5F]'
                        }`}
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Unidad</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnitType('BOX')}
                        className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                          unitType === 'BOX'
                            ? 'bg-[#1E3A5F] text-white shadow-sm mobile-pill-active'
                            : 'text-[#616161] hover:text-[#1E3A5F]'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Caja</span>
                      </button>
                    </div>
                  </div>

                  {/* Campos Dinámicos según Selección: Unidad vs Caja */}
                  {unitType === 'UNIT' ? (
                    <div className="pt-2 border-t border-[#E5E7EB] grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
                      <div>
                        <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">
                          {productToEdit ? 'Stock Actual (Unidades)' : 'Stock Inicial (Unidades)'} <span className="text-[#E8B4A0]">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={stock}
                          onChange={e => setStock(e.target.value)}
                          required
                          className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm font-mono text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">
                          Stock Mínimo (Alerta en und)
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={minStock}
                          onChange={e => setMinStock(e.target.value)}
                          required
                          placeholder="1"
                          className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm font-mono text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-[#E5E7EB] space-y-3 animate-in fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Campo 1: Unidades por caja (units_per_box) */}
                        <div>
                          <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">
                            Unidades por caja <span className="text-[#E8B4A0]">*</span>
                          </label>
                          <p className="text-[10px] text-[#616161] mb-1.5">
                            ¿Cuántas unidades contiene 1 caja?
                          </p>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={unitsPerBox}
                            onChange={e => setUnitsPerBox(e.target.value)}
                            placeholder="Ej: 50"
                            required
                            className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm font-mono text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                          />
                        </div>

                        {/* Campo 2: Cantidad inicial de cajas */}
                        <div>
                          <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">
                            {productToEdit ? 'Cantidad de cajas' : 'Cantidad inicial de cajas'} <span className="text-[#E8B4A0]">*</span>
                          </label>
                          <p className="text-[10px] text-[#616161] mb-1.5">
                            Cajas a registrar en inventario
                          </p>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={stock}
                            onChange={e => setStock(e.target.value)}
                            placeholder="Ej: 2"
                            required
                            className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm font-mono text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                          />
                        </div>
                      </div>

                      {/* Unidades sueltas opcionales al registrar/editar y Stock Mínimo en Cajas */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">
                            Unidades sueltas adicionales (Opcional)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={initialLooseUnits}
                            onChange={e => setInitialLooseUnits(e.target.value)}
                            placeholder="0"
                            className="w-full min-h-[40px] bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-1.5 text-xs font-mono text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">
                            Alerta Stock Mínimo (Cajas)
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={minStock}
                            onChange={e => setMinStock(e.target.value)}
                            required
                            placeholder="1"
                            className="w-full min-h-[40px] bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-1.5 text-xs font-mono text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                          />
                        </div>
                      </div>

                      {/* Leyenda de consolidación en vivo */}
                      {parsedUpb > 0 && (
                        <div className="p-3 bg-white border border-[#E5E7EB] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono">
                          <span className="text-[#616161]">
                            Equivalencia: <strong className="text-[#1E3A5F]">1 caja = {parsedUpb} unidades</strong>
                          </span>
                          <span className="text-[#1E3A5F] font-bold">
                            Balance: {previewStockText}
                            {previewBoxBreakdown.breakdownLabel ? ` (${previewBoxBreakdown.breakdownLabel})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* RF-03.1: Sección de Variantes del Producto */}
                <div className="mobile-flat-section p-4 bg-[#F8F9FA] rounded-2xl border border-[#E5E7EB] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-[#1E3A5F] max-md:text-neutral-600" />
                      <span className="text-xs font-medium text-[#1E3A5F] max-md:text-neutral-700 max-md:font-semibold max-md:normal-case uppercase tracking-wider">
                        ¿Es variante de otro ítem?
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isVariant}
                        onChange={e => setIsVariant(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-[#E5E7EB] max-md:bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1E3A5F] max-md:peer-checked:bg-neutral-950"></div>
                    </label>
                  </div>

                  {isVariant && (
                    <div className="pt-3 border-t border-[#E5E7EB] space-y-3 animate-in fade-in">
                      <div>
                        <label className="block text-[11px] font-medium text-[#616161] uppercase tracking-wider mb-1">
                          Producto Principal (Padre)
                        </label>
                        <MinimalDropdown
                          value={parentId}
                          onChange={(val) => setParentId(val)}
                          placeholder="Selecciona el producto principal..."
                          options={[
                            { value: '', label: 'Selecciona el producto principal...' },
                            ...candidateParents.map((parent) => ({
                              value: parent.id,
                              label: parent.name,
                              badge: parent.code
                            }))
                          ]}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-[#616161] uppercase tracking-wider mb-1">Color</label>
                          <input
                            type="text"
                            value={variantColor}
                            onChange={e => setVariantColor(e.target.value)}
                            placeholder="Ej: Dorado"
                            className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#1E3A5F]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#616161] uppercase tracking-wider mb-1">Talla</label>
                          <input
                            type="text"
                            value={variantSize}
                            onChange={e => setVariantSize(e.target.value)}
                            placeholder="Ej: 18cm"
                            className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#1E3A5F]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#616161] uppercase tracking-wider mb-1">Versión</label>
                          <input
                            type="text"
                            value={variantRegion}
                            onChange={e => setVariantRegion(e.target.value)}
                            placeholder="Ej: Especial"
                            className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#1E3A5F]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Categoría y Subcategoría */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">Categoría</label>
                    <MinimalDropdown
                      value={categoryId}
                      onChange={(val) => {
                        setCategoryId(val);
                        setSubcategoryId('');
                      }}
                      placeholder="Ninguna"
                      options={[
                        { value: '', label: 'Ninguna' },
                        ...categories.map((cat) => ({
                          value: cat.id,
                          label: cat.name
                        }))
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">Subcategoría</label>
                    <MinimalDropdown
                      value={subcategoryId}
                      onChange={(val) => setSubcategoryId(val)}
                      placeholder="Ninguna"
                      options={[
                        { value: '', label: 'Ninguna' },
                        ...filteredSubcategories.map((sub) => ({
                          value: sub.id,
                          label: sub.name
                        }))
                      ]}
                    />
                  </div>
                </div>

                {/* RF-01: Precios (Negocio vs Personal) */}
                {isBusiness ? (
                  <div className="mobile-flat-section p-4 bg-[#F8F9FA] rounded-2xl border border-[#E5E7EB] space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#1E3A5F] max-md:hidden">
                      <Sparkles className="w-3.5 h-3.5 text-[#E8B4A0]" />
                      <span>Estructura Financiera (Modo Comercial)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-[#616161] uppercase tracking-wider mb-1">
                          Costo ({currentInventory?.currency || 'USD'})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={costPrice}
                          onChange={e => handleCostChange(e.target.value)}
                          className="w-full min-h-[40px] bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-[#616161] uppercase tracking-wider mb-1">
                          Margen (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={markupPercentage}
                          onChange={e => handleMarkupChange(e.target.value)}
                          placeholder="20"
                          className="w-full min-h-[40px] bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[#1E3A5F] uppercase tracking-wider mb-1">
                          Venta Final
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={price}
                          onChange={e => handlePriceChange(e.target.value)}
                          className="w-full min-h-[40px] bg-white border-2 border-[#1E3A5F] rounded-xl px-3 py-2 text-sm font-semibold text-[#1E3A5F] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mobile-flat-section p-4 bg-[#F8F9FA] rounded-2xl border border-[#E5E7EB]">
                    <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1">
                      Valor Base Estimado ({currentInventory?.currency || 'USD'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                    />
                  </div>
                )}

                {/* Descripción */}
                <div>
                  <label className="block text-xs font-medium text-[#1E3A5F] uppercase tracking-wider mb-1">
                    Descripción y Notas
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Detalles de fabricación, aleación, serie o especificaciones técnicas..."
                    rows={2}
                    className="w-full bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm text-[#1E3A5F] placeholder:text-[#616161]/50 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                  />
                </div>

                {/* Fotografías */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#1E3A5F] uppercase tracking-wider">
                      Fotografías del Ítem ({images.length}/3 máx)
                    </label>
                    {images.length < 3 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="text-xs font-medium text-[#1E3A5F] hover:text-[#E8B4A0] flex items-center gap-1 disabled:opacity-50 transition-colors"
                      >
                        {isUploadingImage ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" /> Comprimiendo...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3 h-3" /> Subir foto
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  {images.length === 0 ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#E5E7EB] hover:border-[#1E3A5F] rounded-2xl p-5 text-center cursor-pointer transition-colors bg-[#F8F9FA]"
                    >
                      <Camera className="w-6 h-6 text-[#1E3A5F]/60 mx-auto mb-1" />
                      <p className="text-xs text-[#1E3A5F] font-light">
                        Toma o carga de imágenes
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {images.map((imgUrl, idx) => (
                        <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square border border-[#E5E7EB] bg-[#F8F9FA]">
                          <img
                            src={imgUrl}
                            alt={`Foto ${idx + 1}`}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-lg transition-all"
                            title="Eliminar foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {images.length < 3 && (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="border-2 border-dashed border-[#E5E7EB] hover:border-[#1E3A5F] rounded-xl aspect-square flex flex-col items-center justify-center cursor-pointer text-[#616161] hover:text-[#1E3A5F] transition-colors"
                        >
                          <Plus className="w-5 h-5 mb-0.5" />
                          <span className="text-[10px] uppercase font-mono">Añadir</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Botones de Acción para Dispositivos Móviles (< lg: sin panel de previsualización) */}
                <div className="pt-4 mt-4 mb-2 border-t border-[#E5E7EB] max-md:border-0 flex max-md:flex-col-reverse items-center gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={onClose}
                    className="mobile-cancel-btn min-h-[44px] max-md:min-h-0 px-5 text-xs uppercase tracking-wider font-medium text-[#616161] hover:text-[#1E3A5F] hover:bg-black/5 rounded-full border border-transparent transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isUploadingImage}
                    className="mobile-primary-btn min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 px-6 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider font-semibold rounded-full shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-[#E8B4A0] max-md:hidden" />
                        <span>{productToEdit ? 'Guardar Cambios' : 'Confirmar Registro'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* =========================================================
                  PANEL DERECHO (~40%): PREVISUALIZACIÓN EN VIVO & ACCIONES
                 ========================================================= */}
              <div className="hidden lg:block lg:col-span-5 sticky top-0 self-start">
                <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                  
                  {/* Encabezado de la Ficha en Vivo */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#E8B4A0] animate-pulse"></span>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#1E3A5F]">
                        PREVISUALIZACIÓN EN VIVO
                      </span>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-white border border-[#E5E7EB] text-[#1E3A5F]">
                      {code ? code.toUpperCase() : 'SKU PENDIENTE'}
                    </span>
                  </div>

                  {/* Imagen Principal Reactiva */}
                  <div className="my-3.5 aspect-[16/10] max-h-44 rounded-xl overflow-hidden bg-white border border-[#E5E7EB] flex items-center justify-center relative">
                    {images.length > 0 ? (
                      <img
                        src={images[0]}
                        alt="Previsualización"
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="text-center p-3">
                        <Barcode className="w-8 h-8 text-[#1E3A5F]/20 mx-auto mb-1" />
                        <p className="text-[11px] text-[#616161] font-mono uppercase">
                          Sin imagen de portada
                        </p>
                      </div>
                    )}

                    {/* Badge de Stock en Vivo sobre la imagen */}
                    <div className="absolute top-2.5 right-2.5">
                      {isStockLow ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8B4A0] text-[#1E3A5F] border border-[#1E3A5F]/15 text-[10px] font-mono font-bold shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1E3A5F] animate-ping"></span>
                          <span>STOCK BAJO ({previewStockText.toUpperCase()})</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-[#E5E7EB] text-[#1E3A5F] text-[10px] font-mono">
                          <span>{previewStockText.toUpperCase()} DISPONIBLES</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Datos del Ítem Reactivo */}
                  <div className="space-y-2.5 font-mono">
                    <div>
                      <h4 className="font-bold text-sm text-[#1E3A5F] uppercase tracking-tight line-clamp-1">
                        {name || 'NOMBRE DEL PRODUCTO'}
                      </h4>
                      <p className="text-[11px] text-[#616161] mt-0.5 line-clamp-1">
                        {description || 'Sin notas descriptivas adicionales.'}
                      </p>
                    </div>

                    {/* Metadata Pills */}
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#1E3A5F] text-white uppercase">
                        {unitType === 'BOX' ? `CAJA (${parsedUpb || 0} UND)` : 'UNIDAD'}
                      </span>
                      {selectedCategoryObj && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E8B4A0]/50 uppercase">
                          {selectedCategoryObj.name}
                        </span>
                      )}
                      {selectedSubcategoryObj && (
                        <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#E5E7EB] text-[#616161] uppercase">
                          {selectedSubcategoryObj.name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E8B4A0]/25 text-[#1E3A5F] border border-[#E8B4A0]/60 uppercase font-bold">
                        <MapPin className="w-3 h-3 text-[#1E3A5F]" />
                        {productToEdit ? 'MULTI-UBICACIÓN' : 'STOCK PENDIENTE DE UBICAR'}
                      </span>
                    </div>

                    {/* Bloque Financiero Reactivo */}
                    <div className="p-2.5 bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-[#616161] uppercase block">
                          {isBusiness ? 'PRECIO DE VENTA' : 'VALUACIÓN ESTIMADA'}
                        </span>
                        <span className="text-base font-bold text-[#1E3A5F]">
                          {formatCurrency(Number(price || 0), currentInventory?.currency)}
                        </span>
                      </div>
                      {isBusiness && costPrice && (
                        <div className="text-right">
                          <span className="text-[10px] text-[#616161] uppercase block">
                            COSTO: {formatCurrency(Number(costPrice || 0), currentInventory?.currency)}
                          </span>
                          <span className="text-[10px] font-mono text-[#E8B4A0] block">
                            +{markupPercentage || 0}% MARGEN
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botones de Acción (Confirmación / Cancelación) Siempre a la vista sin scroll */}
                  <div className="mt-4 pt-4 border-t border-[#E5E7EB] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-h-[44px] px-5 text-xs uppercase tracking-wider font-medium text-[#616161] hover:text-[#1E3A5F] hover:bg-black/5 rounded-full border border-transparent transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || isUploadingImage}
                      className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 px-6 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider font-semibold rounded-full shadow-sm disabled:opacity-50 transition-all active:scale-95"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-[#E8B4A0]" />
                          <span>{productToEdit ? 'Guardar Cambios' : 'Confirmar Registro'}</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              </div>

            </div>
          </form>
        </div>
      </div>

      {/* Modal de Confirmación de Código Existente (Evita duplicar registros) */}
      {duplicateDetectedProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="mobile-dark-modal bg-white rounded-3xl w-full max-w-sm shadow-2xl text-neutral-900 overflow-hidden">
            {/* Cabecera */}
            <div className="p-6 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 max-md:hidden">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-neutral-900 leading-snug">
                      Código existente
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1">
                      El código <strong className="font-mono">{duplicateDetectedProduct.code}</strong> ya pertenece a un producto registrado. ¿Deseas añadir unidades?
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDuplicateDetectedProduct(null)}
                  className="md:hidden w-8 h-8 rounded-full bg-neutral-900 text-neutral-400 hover:text-white flex items-center justify-center shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cuerpo (En móvil: Bloque 2 blanco plano) */}
            <div className="px-6 pb-6 pt-3 space-y-5">
              <div className="mobile-flat-row bg-neutral-50 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 truncate">
                    {duplicateDetectedProduct.name}
                  </p>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">
                    SKU {duplicateDetectedProduct.code}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-neutral-100 text-xs font-semibold text-neutral-800 tabular-nums flex-shrink-0">
                  {formatStockDisplay(duplicateDetectedProduct)}
                </span>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setDuplicateDetectedProduct(null)}
                  className="mobile-cancel-btn w-full sm:flex-1 py-3 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold uppercase tracking-wider transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = duplicateDetectedProduct;
                    setDuplicateDetectedProduct(null);
                    onClose();
                    if (onRedirectToStock && target) {
                      onRedirectToStock(target);
                    }
                  }}
                  className="mobile-primary-btn w-full sm:flex-1 py-3 px-4 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold uppercase tracking-wider transition-colors active:scale-[0.98]"
                >
                  Ir a Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Escáner de Código de Barras / QR con Cámara */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        title={scanTarget === 'productCode' ? 'Escanear Código / QR de Producto' : 'Escanear Código QR de Ubicación'}
      />
    </>
  );
};
