import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Barcode, Upload, Trash2, Loader2, MapPin, Tag, Layers, Check, Plus, AlertCircle, Sparkles, GitBranch } from 'lucide-react';
import { Product, Category, Subcategory, Location } from '../../types/database';
import { supabase, uploadProductImage, logAuditAction, formatCurrency } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  productToEdit?: Product | null;
  categories: Category[];
  subcategories: Subcategory[];
  locations: Location[];
  products?: Product[];
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  productToEdit,
  categories,
  subcategories,
  locations,
  products = []
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

  // RF-06.2: Detección inteligente de duplicados por QR
  const [duplicateDetectedProduct, setDuplicateDetectedProduct] = useState<Product | null>(null);
  const [duplicateAddQuantity, setDuplicateAddQuantity] = useState<number>(1);
  const [isAddingStockDirectly, setIsAddingStockDirectly] = useState(false);

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

      setStock(productToEdit.stock !== undefined ? String(productToEdit.stock) : '0');
      // RF-04.1: Si no tiene min_stock, defecto 1
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
      setStock('1');
      setMinStock('1'); // RF-04.1: Configuración inicial en 1 unidad
      setCategoryId(categories[0]?.id || '');
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

  // RF-06.2: Manejo de lectura exitosa del escáner óptico con detección de duplicados
  const handleScanSuccess = (scannedText: string) => {
    const cleanText = scannedText.trim();
    if (scanTarget === 'productCode') {
      // Buscar si el producto ya existe en el inventario actual
      const existing = products.find(
        p => p.code.toLowerCase() === cleanText.toLowerCase() && p.id !== productToEdit?.id
      );

      if (existing) {
        // RF-06.2: Preguntar: "Producto existente, ¿desea añadir stock?"
        setDuplicateDetectedProduct(existing);
        setDuplicateAddQuantity(1);
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

  // RF-06.2: Sumar stock directamente al producto existente detectado por QR
  const handleConfirmAddStock = async () => {
    if (!duplicateDetectedProduct || !currentInventory || !user) return;
    try {
      setIsAddingStockDirectly(true);
      const newStock = (duplicateDetectedProduct.stock || 0) + Number(duplicateAddQuantity);

      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock: newStock,
          last_modified_by: user.id,
          last_modified_by_email: user.email
        })
        .eq('id', duplicateDetectedProduct.id);

      if (updateError) throw updateError;

      // Registrar auditoría de reabastecimiento
      await logAuditAction({
        inventoryId: currentInventory.id,
        productId: duplicateDetectedProduct.id,
        productName: duplicateDetectedProduct.name,
        actionType: 'RESTOCK',
        details: `Reabastecimiento vía escáner QR: Se añadieron ${duplicateAddQuantity} unidades. Stock total: ${newStock}`,
        metadata: {
          added_quantity: duplicateAddQuantity,
          previous_stock: duplicateDetectedProduct.stock,
          new_stock: newStock
        }
      });

      setDuplicateDetectedProduct(null);
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error sumando stock:', err);
      setErrorMsg(err.message || 'Error al actualizar el stock del producto.');
    } finally {
      setIsAddingStockDirectly(false);
    }
  };

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
    if (!locationId) {
      setErrorMsg('Debes asignar una ubicación física válida.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const parsedPrice = parseFloat(price) || 0;
      const parsedCostPrice = parseFloat(costPrice) || 0;
      const parsedMarkup = parseFloat(markupPercentage) || 0;
      const parsedStock = parseInt(stock, 10) || 0;
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
        stock: parsedStock,
        min_stock: parsedMinStock,
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        location_id: locationId,
        images: images,
        is_variant: isVariant,
        parent_id: isVariant && parentId ? parentId : null,
        variant_attributes: isVariant ? variantAttributes : {},
        status: 'ACTIVE' as const,
        last_modified_by: user.id,
        last_modified_by_email: user.email
      };

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
          details: `Producto actualizado por ${user.email}. Precio: ${parsedPrice}, Stock: ${parsedStock}`,
          metadata: {
            previous_price: productToEdit.price,
            new_price: parsedPrice,
            previous_stock: productToEdit.stock,
            new_stock: parsedStock
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
          details: `Producto creado (${payload.code}) con stock inicial de ${parsedStock} unidades.`,
          metadata: { initial_stock: parsedStock, price: parsedPrice }
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
  const numStock = Number(stock || 0);
  const numMinStock = Number(minStock || 0);
  const isStockLow = numStock <= numMinStock;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-y-auto animate-in fade-in">
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-xl md:max-w-5xl my-auto overflow-hidden shadow-xl flex flex-col max-h-[92vh]">
          {/* Cabecera Editorial Awwwards */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#ffffff] sticky top-0 z-20">
            <div>
              <span className="text-[10px] tracking-widest uppercase font-mono text-[#E8B4A0] block">
                {productToEdit ? 'EDICIÓN DE MANIFIESTO' : 'NUEVO REGISTRO EN CATÁLOGO'}
              </span>
              <h3 className="font-bold text-[#1E3A5F] text-lg uppercase tracking-tight">
                {productToEdit ? 'Modificar Ficha Técnica' : 'Registrar Nuevo Ítem'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#1E3A5F] hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Formulario Asimétrico 2 Columnas (60% Formulario / 40% Previsualización en Vivo en Tablets y Desktop) */}
          <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              
              {/* =========================================================
                  PANEL IZQUIERDO (~60%): ENTRADA Y FORMULARIO
                 ========================================================= */}
              <div className="w-full md:col-span-7 space-y-4">
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

                {/* RF-03.1: Sección de Variantes del Producto */}
                <div className="p-4 bg-[#F8F9FA] rounded-2xl border border-[#E5E7EB] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-[#1E3A5F]" />
                      <span className="text-xs font-medium text-[#1E3A5F] uppercase tracking-wider">
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
                      <div className="w-10 h-5 bg-[#E5E7EB] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1E3A5F]"></div>
                    </label>
                  </div>

                  {isVariant && (
                    <div className="pt-3 border-t border-[#E5E7EB] space-y-3 animate-in fade-in">
                      <div>
                        <label className="block text-[11px] font-medium text-[#616161] uppercase tracking-wider mb-1">
                          Producto Principal (Padre)
                        </label>
                        <select
                          value={parentId}
                          onChange={e => setParentId(e.target.value)}
                          className="w-full min-h-[40px] bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                        >
                          <option value="">Selecciona el producto principal...</option>
                          {candidateParents.map(parent => (
                            <option key={parent.id} value={parent.id}>
                              {parent.name} ({parent.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
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

                {/* 3. Ubicación Asignada con Escáner de QR */}
                <div>
                  <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">
                    Ubicación Física Asignada <span className="text-[#E8B4A0]">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        value={locationId}
                        onChange={e => setLocationId(e.target.value)}
                        required
                        className="w-full min-h-[44px] bg-[#ffffff] border border-[#E5E7EB] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] transition-all"
                      >
                        <option value="" disabled>Selecciona una ubicación...</option>
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name} ({loc.code})
                          </option>
                        ))}
                      </select>
                      <MapPin className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setScanTarget('locationCode');
                        setScannerOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 min-h-[44px] bg-[#F8F9FA] hover:bg-[#E8B4A0]/20 text-[#1E3A5F] border border-[#E5E7EB] rounded-xl text-xs uppercase tracking-wider transition-all whitespace-nowrap active:scale-95"
                    >
                      <Camera className="w-4 h-4 text-[#1E3A5F]" /> QR Estante
                    </button>
                  </div>
                </div>

                {/* 4. Categoría y Subcategoría */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">Categoría</label>
                    <div className="relative">
                      <select
                        value={categoryId}
                        onChange={e => {
                          setCategoryId(e.target.value);
                          setSubcategoryId('');
                        }}
                        className="w-full min-h-[44px] bg-[#ffffff] border border-[#E5E7EB] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] transition-all"
                      >
                        <option value="">Sin Categoría</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      <Tag className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">Subcategoría</label>
                    <div className="relative">
                      <select
                        value={subcategoryId}
                        onChange={e => setSubcategoryId(e.target.value)}
                        disabled={!categoryId || filteredSubcategories.length === 0}
                        className="w-full min-h-[44px] bg-[#ffffff] border border-[#E5E7EB] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] disabled:opacity-50 transition-all"
                      >
                        <option value="">Ninguna</option>
                        {filteredSubcategories.map(sub => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                      <Layers className="w-4 h-4 text-[#616161] absolute left-3.5 top-3.5" />
                    </div>
                  </div>
                </div>

                {/* RF-01: Precios (Negocio vs Personal) */}
                {isBusiness ? (
                  <div className="p-4 bg-[#F8F9FA] rounded-2xl border border-[#E5E7EB] space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#1E3A5F]">
                      <Sparkles className="w-3.5 h-3.5 text-[#E8B4A0]" />
                      <span>Estructura Financiera (Modo Comercial)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
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
                  <div className="p-4 bg-[#F8F9FA] rounded-2xl border border-[#E5E7EB]">
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

                {/* Stock Actual y Stock Mínimo */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">
                      Stock Actual <span className="text-[#E8B4A0]">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={stock}
                      onChange={e => setStock(e.target.value)}
                      required
                      className="w-full min-h-[44px] bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1E3A5F] uppercase tracking-wider mb-1">
                      Stock Mínimo (Alerta)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={minStock}
                      onChange={e => setMinStock(e.target.value)}
                      required
                      placeholder="1"
                      className="w-full min-h-[44px] bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-sm text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                    />
                  </div>
                </div>

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
                        Toma foto con la cámara o selecciona desde tu galería
                      </p>
                      <p className="text-[10px] text-[#616161] mt-0.5 font-mono">
                        Compresión automática a WebP sin pérdida de nitidez
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

                {/* Botones de Acción para Dispositivos Móviles (< md: sin panel de previsualización) */}
                <div className="pt-4 border-t border-[#E5E7EB] flex flex-col sm:flex-row gap-2 md:hidden">
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] px-4 text-xs uppercase tracking-wider text-[#1E3A5F] hover:bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isUploadingImage}
                    className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 px-6 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider font-medium rounded-xl shadow-sm disabled:opacity-50 transition-all active:scale-95"
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

              {/* =========================================================
                  PANEL DERECHO (~40%): PREVISUALIZACIÓN REACTIVA EN VIVO
                  (Exclusivo para Tablets y Desktop: >= md)
                 ========================================================= */}
              <div className="hidden md:block md:col-span-5 sticky top-0 space-y-4">
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
                  <div className="my-4 aspect-[4/3] rounded-xl overflow-hidden bg-white border border-[#E5E7EB] flex items-center justify-center relative">
                    {images.length > 0 ? (
                      <img
                        src={images[0]}
                        alt="Previsualización"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <Barcode className="w-10 h-10 text-[#1E3A5F]/20 mx-auto mb-2" />
                        <p className="text-xs text-[#616161] font-mono uppercase">
                          Sin imagen de portada
                        </p>
                      </div>
                    )}

                    {/* Badge de Stock en Vivo sobre la imagen */}
                    <div className="absolute top-2.5 right-2.5">
                      {isStockLow ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ffdd00] text-black text-[10px] font-mono font-medium shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping"></span>
                          <span>STOCK BAJO ({numStock} UDS)</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-[#E5E7EB] text-[#1E3A5F] text-[10px] font-mono">
                          <span>{numStock} UDS DISPONIBLES</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Datos del Ítem Reactivo */}
                  <div className="space-y-3 font-mono">
                    <div>
                      <h4 className="font-bold text-base text-[#1E3A5F] uppercase tracking-tight line-clamp-2">
                        {name || 'NOMBRE DEL PRODUCTO'}
                      </h4>
                      <p className="text-[11px] text-[#616161] mt-0.5 line-clamp-2">
                        {description || 'Sin notas descriptivas adicionales.'}
                      </p>
                    </div>

                    {/* Metadata Pills */}
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
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
                      {selectedLocationObj && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] border border-[#1E3A5F]/20 uppercase">
                          <MapPin className="w-3 h-3 text-[#1E3A5F]" />
                          {selectedLocationObj.name}
                        </span>
                      )}
                    </div>

                    {/* Bloque Financiero Reactivo */}
                    <div className="p-3 bg-white border border-[#E5E7EB] rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-[#616161] uppercase block">
                          {isBusiness ? 'PRECIO DE VENTA' : 'VALUACIÓN ESTIMADA'}
                        </span>
                        <span className="text-lg font-bold text-[#1E3A5F]">
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

                  {/* Botones de Acción (Confirmación / Cancelación) */}
                  <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-h-[44px] px-4 text-xs uppercase tracking-wider text-[#1E3A5F] hover:bg-white rounded-xl border border-[#E5E7EB] transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || isUploadingImage}
                      className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 px-6 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider font-medium rounded-xl shadow-sm disabled:opacity-50 transition-all active:scale-95"
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

      {/* RF-06.2: Modal Interactivo de Producto Duplicado detectado por Escáner */}
      {duplicateDetectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#ffdd00]/20 text-black flex items-center justify-center flex-shrink-0">
                <Barcode className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-light text-[#1E3A5F] text-base uppercase tracking-tight">
                  Producto Existente Detectado
                </h4>
                <p className="text-xs text-[#616161] font-mono">
                  REF: <span className="text-[#1E3A5F] font-semibold">{duplicateDetectedProduct.code}</span>
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] text-xs space-y-1.5 font-mono">
              <p className="font-medium text-[#1E3A5F] text-sm uppercase">{duplicateDetectedProduct.name}</p>
              <p className="text-[#616161]">
                Stock actual: <strong className="text-[#1E3A5F]">{duplicateDetectedProduct.stock} unidades</strong>
              </p>
              <p className="text-[#616161]">
                Precio: <strong className="text-[#1E3A5F]">{formatCurrency(duplicateDetectedProduct.price, currentInventory?.currency)}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-[#1E3A5F]">
                ¿Añadir stock a este registro?
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={duplicateAddQuantity}
                  onChange={e => setDuplicateAddQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-24 min-h-[44px] bg-[#ffffff] border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm text-center font-mono text-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                />
                <button
                  type="button"
                  onClick={handleConfirmAddStock}
                  disabled={isAddingStockDirectly}
                  className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider font-medium rounded-xl shadow-sm active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isAddingStockDirectly ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Plus className="w-4 h-4 text-[#E8B4A0]" />
                  )}
                  <span>Sumar al Stock</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setCode(duplicateDetectedProduct.code);
                  setDuplicateDetectedProduct(null);
                }}
                className="text-xs text-[#616161] hover:text-[#1E3A5F] transition-colors"
              >
                Usar código de todas formas
              </button>
              <button
                type="button"
                onClick={() => setDuplicateDetectedProduct(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-[#1E3A5F] hover:bg-[#F8F9FA] rounded-xl border border-[#E5E7EB] transition-colors"
              >
                Cerrar
              </button>
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
