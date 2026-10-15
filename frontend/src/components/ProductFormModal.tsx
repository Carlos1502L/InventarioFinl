import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Barcode, Upload, Trash2, Loader2, MapPin, Tag, Layers, Check, Plus, AlertCircle, Sparkles, GitBranch } from 'lucide-react';
import { Product, Category, Subcategory, Location } from '../types/database';
import { supabase, uploadProductImage, logAuditAction, formatCurrency } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
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

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl my-auto overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
          {/* Cabecera */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 sticky top-0 z-10">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                {productToEdit ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isBusiness ? 'Modalidad Negocio (Costos y Precios calculados)' : 'Modalidad Colección / Personal'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Nombre */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nombre del Producto <span className="text-blue-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Taladro Inalámbrico 20V"
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
              />
            </div>

            {/* 2. Código con Escáner de Cámara */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Código / SKU / Código de Barras <span className="text-blue-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="Ej: 7751234567890 o SKU-001"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                  />
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScanTarget('productCode');
                    setScannerOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 rounded-xl text-xs font-semibold transition-all active:scale-95 whitespace-nowrap"
                >
                  <Camera className="w-4 h-4" /> Escanear QR/Barra
                </button>
              </div>
            </div>

            {/* RF-03.1: Sección de Variantes del Producto */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    ¿Es una variante de otro producto?
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVariant}
                    onChange={e => setIsVariant(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {isVariant && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Producto Base (Padre)
                    </label>
                    <select
                      value={parentId}
                      onChange={e => setParentId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Color</label>
                      <input
                        type="text"
                        value={variantColor}
                        onChange={e => setVariantColor(e.target.value)}
                        placeholder="Ej: Rojo, Azul"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Talla / Tamaño</label>
                      <input
                        type="text"
                        value={variantSize}
                        onChange={e => setVariantSize(e.target.value)}
                        placeholder="Ej: M, XL, 500ml"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Región / Versión</label>
                      <input
                        type="text"
                        value={variantRegion}
                        onChange={e => setVariantRegion(e.target.value)}
                        placeholder="Ej: USA, Global"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Ubicación Asignada con Escáner de QR */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ubicación Física Asignada <span className="text-blue-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={locationId}
                    onChange={e => setLocationId(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                  >
                    <option value="" disabled>Selecciona una ubicación...</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScanTarget('locationCode');
                    setScannerOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-xl text-xs font-semibold transition-all active:scale-95 whitespace-nowrap"
                >
                  <Camera className="w-4 h-4" /> Escanear QR
                </button>
              </div>
            </div>

            {/* 4. Categoría y Subcategoría en Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
                <div className="relative">
                  <select
                    value={categoryId}
                    onChange={e => {
                      setCategoryId(e.target.value);
                      setSubcategoryId('');
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                  >
                    <option value="">Sin Categoría</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subcategoría</label>
                <div className="relative">
                  <select
                    value={subcategoryId}
                    onChange={e => setSubcategoryId(e.target.value)}
                    disabled={!categoryId || filteredSubcategories.length === 0}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 disabled:opacity-50"
                  >
                    <option value="">Ninguna</option>
                    {filteredSubcategories.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                  <Layers className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>
            </div>

            {/* RF-01: Precios (Negocio vs Personal) y Stock */}
            {isBusiness ? (
              <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                  <Sparkles className="w-3.5 h-3.5" /> Estructura de Precios (Negocio)
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Precio Costo ({currentInventory?.currency || 'USD'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={costPrice}
                      onChange={e => handleCostChange(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Ganancia (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={markupPercentage}
                      onChange={e => handleMarkupChange(e.target.value)}
                      placeholder="Ej: 20"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-1">
                      Precio Venta
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={e => handlePriceChange(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border-2 border-blue-500 rounded-xl px-3 py-2 text-sm font-bold text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Fórmula automática: <span className="font-mono">Costo × (1 + Ganancia% / 100)</span>
                </p>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Valor Base Estimado ({currentInventory?.currency || 'USD'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Utilizado para reportes de valorización personal de la colección.
                </p>
              </div>
            )}

            {/* Stock Actual y Stock Mínimo (RF-04.1) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Stock Actual <span className="text-blue-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={e => setStock(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Stock Mínimo (Alerta)
                </label>
                <input
                  type="number"
                  min="1"
                  value={minStock}
                  onChange={e => setMinStock(e.target.value)}
                  required
                  placeholder="1"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                />
                <span className="text-[10px] text-slate-400">Umbral configurable desde 1 unidad</span>
              </div>
            </div>

            {/* 6. Descripción */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detalles adicionales, marca, modelo o especificaciones..."
                rows={2}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
              />
            </div>

            {/* 7. Fotos del Producto (Hasta 3 fotos) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Fotografías del Producto <span className="text-slate-400">({images.length}/3 máx)</span>
                </label>
                {images.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    {isUploadingImage ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" /> Optimizando...
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
                  className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/30"
                >
                  <Camera className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pulsa para tomar fotos con la cámara o seleccionar de la galería
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Se comprimen automáticamente antes de subir para ahorrar datos y espacio
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((imgUrl, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                      <img
                        src={imgUrl}
                        alt={`Foto ${idx + 1}`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-lg opacity-80 group-hover:opacity-100 transition-all"
                        title="Eliminar foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {images.length < 3 && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-xl aspect-square flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-blue-500 transition-colors"
                    >
                      <Plus className="w-5 h-5 mb-1" />
                      <span className="text-[10px] font-semibold">Añadir</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5 sticky bottom-0 bg-white dark:bg-slate-900 pb-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isUploadingImage}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> {productToEdit ? 'Guardar Cambios' : 'Registrar Producto'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* RF-06.2: Modal Interactivo de Producto Duplicado detectado por Escáner */}
      {duplicateDetectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl">
                <Barcode className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  ¡Producto Existente Detectado!
                </h4>
                <p className="text-xs text-slate-500">
                  Código: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{duplicateDetectedProduct.code}</span>
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <p className="font-bold text-slate-900 dark:text-white text-sm">{duplicateDetectedProduct.name}</p>
              <p className="text-slate-600 dark:text-slate-400">
                Stock actual: <strong className="text-blue-600 dark:text-blue-400">{duplicateDetectedProduct.stock} unidades</strong>
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Precio: <strong>{formatCurrency(duplicateDetectedProduct.price, currentInventory?.currency)}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                ¿Desea añadir stock a este producto?
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={duplicateAddQuantity}
                  onChange={e => setDuplicateAddQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-center font-bold"
                />
                <button
                  type="button"
                  onClick={handleConfirmAddStock}
                  disabled={isAddingStockDirectly}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                >
                  {isAddingStockDirectly ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Sumar al Stock
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setCode(duplicateDetectedProduct.code);
                  setDuplicateDetectedProduct(null);
                }}
                className="text-xs text-slate-500 hover:underline"
              >
                Usar código de todas formas
              </button>
              <button
                type="button"
                onClick={() => setDuplicateDetectedProduct(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
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
