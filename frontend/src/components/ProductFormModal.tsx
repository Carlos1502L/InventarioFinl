import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Barcode, Upload, Trash2, Loader2, MapPin, Tag, Layers, Check } from 'lucide-react';
import { Product, Category, Subcategory, Location } from '../types/database';
import { supabase, uploadProductImage, logAuditAction } from '../lib/supabase';
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
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  productToEdit,
  categories,
  subcategories,
  locations
}) => {
  const { currentInventory, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados del Formulario
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<string>('0.00');
  const [stock, setStock] = useState<string>('0');
  const [minStock, setMinStock] = useState<string>('5');
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);

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
      setPrice(productToEdit.price ? String(productToEdit.price) : '0.00');
      setStock(productToEdit.stock ? String(productToEdit.stock) : '0');
      setMinStock(productToEdit.min_stock ? String(productToEdit.min_stock) : '5');
      setCategoryId(productToEdit.category_id || '');
      setSubcategoryId(productToEdit.subcategory_id || '');
      setLocationId(productToEdit.location_id || (locations[0]?.id || ''));
      setImages(productToEdit.images || []);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setPrice('0.00');
      setStock('1');
      setMinStock('5');
      setCategoryId(categories[0]?.id || '');
      setSubcategoryId('');
      setLocationId(locations[0]?.id || '');
      setImages([]);
    }
    setErrorMsg(null);
  }, [productToEdit, isOpen, categories, locations]);

  // Filtrar subcategorías dependientes de la categoría seleccionada
  const filteredSubcategories = subcategories.filter(s => s.category_id === categoryId);

  // Manejador de subida de imágenes (máximo 3 fotos)
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
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`La imagen "${file.name}" supera el límite de 5 MB.`);
        }
        const uploadedUrl = await uploadProductImage(file, currentInventory.id);
        newUrls.push(uploadedUrl);
      }

      setImages(prev => [...prev, ...newUrls].slice(0, 3));
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al subir la imagen a Supabase Storage.');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Manejar escaneo exitoso
  const handleScanSuccess = (decodedText: string) => {
    if (scanTarget === 'productCode') {
      setCode(decodedText.trim());
    } else {
      // Buscar si el código escaneado coincide con alguna ubicación existente
      const matchedLoc = locations.find(l => l.code.toUpperCase() === decodedText.trim().toUpperCase());
      if (matchedLoc) {
        setLocationId(matchedLoc.id);
      } else {
        alert(`La ubicación con código "${decodedText}" no existe en este inventario. Debes crearla primero en Configuración.`);
      }
    }
  };

  // Guardar Producto
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
      const parsedStock = parseInt(stock, 10) || 0;
      const parsedMinStock = parseInt(minStock, 10) || 5;

      const payload = {
        inventory_id: currentInventory.id,
        name: name.trim(),
        code: code.trim(),
        description: description.trim() || null,
        price: parsedPrice,
        stock: parsedStock,
        min_stock: parsedMinStock,
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        location_id: locationId,
        images: images,
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

        // Registrar auditoría de actualización
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

        // Registrar auditoría de creación
        await logAuditAction({
          inventoryId: currentInventory.id,
          productId: newProd.id,
          productName: payload.name,
          actionType: 'CREATE',
          details: `Producto creado con código ${payload.code} y stock inicial de ${parsedStock} unidades en ubicación seleccionada.`,
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
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl my-auto overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
          {/* Cabecera */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
            <div>
              <h3 className="font-bold text-white text-lg">
                {productToEdit ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <p className="text-xs text-slate-400">
                {productToEdit ? 'Modifica los datos del producto' : 'Completa los campos o escanea los códigos con la cámara'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {errorMsg}
              </div>
            )}

            {/* 1. Nombre */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre del Producto <span className="text-blue-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Taladro Inalámbrico 20V"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 2. Código con Escáner de Cámara */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Código / SKU / Código de Barras <span className="text-blue-400">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="Ej: 7751234567890 o SKU-001"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScanTarget('productCode');
                    setScannerOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-semibold transition-all active:scale-95 whitespace-nowrap"
                >
                  <Camera className="w-4 h-4" /> Escanear
                </button>
              </div>
            </div>

            {/* 3. Ubicación Asignada con Escáner de QR */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ubicación Física Asignada <span className="text-blue-400">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={locationId}
                    onChange={e => setLocationId(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-semibold transition-all active:scale-95 whitespace-nowrap"
                >
                  <Camera className="w-4 h-4" /> Escanear QR
                </button>
              </div>
            </div>

            {/* 4. Categoría y Subcategoría en Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría</label>
                <div className="relative">
                  <select
                    value={categoryId}
                    onChange={e => {
                      setCategoryId(e.target.value);
                      setSubcategoryId('');
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Subcategoría</label>
                <div className="relative">
                  <select
                    value={subcategoryId}
                    onChange={e => setSubcategoryId(e.target.value)}
                    disabled={!categoryId || filteredSubcategories.length === 0}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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

            {/* 5. Precios y Cantidades */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Precio Unit.</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Stock Actual</label>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={e => setStock(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Stock Mínimo</label>
                <input
                  type="number"
                  min="0"
                  value={minStock}
                  onChange={e => setMinStock(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 6. Descripción */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detalles adicionales, marca, modelo o especificaciones..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 7. Fotos del Producto (Hasta 3 fotos) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Fotografías del Producto <span className="text-slate-500">({images.length}/3 máx)</span>
                </label>
                {images.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                  >
                    {isUploadingImage ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    Subir Foto / Tomar
                  </button>
                )}
              </div>

              {/* Input oculto para cámara/archivo */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />

              {/* Grid de Fotos */}
              <div className="grid grid-cols-3 gap-2.5">
                {images.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-800 group">
                    <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Slot para añadir si < 3 */}
                {images.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="aspect-square border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl flex flex-col items-center justify-center p-2 text-slate-400 hover:text-blue-400 transition-colors bg-slate-800/40"
                  >
                    <Camera className="w-5 h-5 mb-1" />
                    <span className="text-[10px] text-center font-medium">Cámara o Galería</span>
                  </button>
                )}
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isUploadingImage}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> {productToEdit ? 'Actualizar Producto' : 'Guardar Producto'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Escáner de Cámara */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        title={scanTarget === 'productCode' ? 'Escanear Código del Producto' : 'Escanear QR de Ubicación'}
        instructions={
          scanTarget === 'productCode'
            ? 'Apunta la cámara al código de barras o QR del producto.'
            : 'Apunta la cámara a la etiqueta de la ubicación física.'
        }
      />
    </>
  );
};
