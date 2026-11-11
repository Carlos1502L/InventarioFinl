import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Barcode,
  Upload,
  Trash2,
  Loader2,
  MapPin,
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
import { compressImage } from '../../utils/imageCompression';
import { saveProductLocally, isNetworkOrOfflineError } from '../../services/offlineSync';
import { showAppToast } from '../ui/ToastNotification';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { MinimalDropdown } from '../ui/MinimalDropdown';
import { CancelButton } from '../common/CancelButton';
import { Switch } from '../common/Switch';
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  modalFieldInputClass,
  modalFieldCompactInputClass,
  modalFieldLabelClass,
  modalPrimaryButtonClass
} from './ModalShell';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (savedProduct?: Product) => void;
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
  // Blobs locales WebP para guardado y renderizado inmediato sin red
  const [localBlobs, setLocalBlobs] = useState<Array<{ filename: string; blob: Blob; previewUrl: string }>>([]);

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
      setLocalBlobs([]);
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

  // Manejador de subida de imágenes con compresión automática y soporte offline
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
      const newBlobs: Array<{ filename: string; blob: Blob; previewUrl: string }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 15 * 1024 * 1024) {
          throw new Error(`La imagen "${file.name}" supera el límite de 15 MB.`);
        }

        // Compresión obligatoria a WebP < 300KB
        const compressedFile = await compressImage(file, 1200, 1200, 0.8);

        // Fallback transparente si estamos sin conexión
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const previewUrl = URL.createObjectURL(compressedFile);
          newUrls.push(previewUrl);
          newBlobs.push({ filename: compressedFile.name, blob: compressedFile, previewUrl });
        } else {
          try {
            const url = await uploadProductImage(compressedFile, currentInventory.id);
            newUrls.push(url);
          } catch (uploadErr) {
            if (isNetworkOrOfflineError(uploadErr)) {
              const previewUrl = URL.createObjectURL(compressedFile);
              newUrls.push(previewUrl);
              newBlobs.push({ filename: compressedFile.name, blob: compressedFile, previewUrl });
            } else {
              throw uploadErr;
            }
          }
        }
      }

      setImages(prev => [...prev, ...newUrls].slice(0, 3));
      if (newBlobs.length > 0) {
        setLocalBlobs(prev => [...prev, ...newBlobs].slice(0, 3));
      }
    } catch (err: any) {
      console.error('Error subiendo imagen:', err);
      setErrorMsg(err.message || 'Error al subir la imagen.');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (indexToRemove: number) => {
    const targetUrl = images[indexToRemove];
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (targetUrl) {
      setLocalBlobs(prev => prev.filter(b => b.previewUrl !== targetUrl));
    }
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

      // Helper para guardar provisionalmente en IndexedDB y actualizar catálogo en memoria
      const saveOfflineProvisional = async () => {
        const localTempId = crypto.randomUUID();
        const queuedBlobs = localBlobs.filter(b => images.includes(b.previewUrl));

        await saveProductLocally({
          local_temp_id: localTempId,
          product_data: {
            inventory_id: currentInventory.id,
            name: name.trim(),
            sku: code.trim(),
            code: code.trim(),
            description: description.trim() || undefined,
            category_id: categoryId || undefined,
            sub_category_id: subcategoryId || undefined,
            cost_price: isBusiness ? parsedCostPrice : 0,
            price: parsedPrice,
            unit_type: unitType,
            units_per_box: unitType === 'BOX' ? parsedUpb : undefined,
            stock: consolidatedStock,
            min_stock_alert: parsedMinStock,
            location_id: locationId || undefined,
            is_variant: isVariant,
            parent_id: isVariant && parentId ? parentId : undefined,
            variant_attributes: isVariant ? variantAttributes : {},
            status: 'ACTIVE',
            last_modified_by: user.id,
            last_modified_by_email: user.email
          },
          images_blobs: queuedBlobs.map(b => ({ filename: b.filename, blob: b.blob }))
        });

        const selectedLoc = locations.find(l => l.id === locationId);
        const selectedCat = categories.find(c => c.id === categoryId);
        const selectedSub = subcategories.find(s => s.id === subcategoryId);

        const provisionalProduct: Product = {
          id: localTempId,
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
          location_id: locationId || null,
          images: images,
          is_variant: isVariant,
          parent_id: isVariant && parentId ? parentId : null,
          variant_attributes: isVariant ? variantAttributes : {},
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_modified_by: user.id,
          last_modified_by_email: user.email || null,
          categories: selectedCat
            ? { id: selectedCat.id, name: selectedCat.name, color: selectedCat.color }
            : null,
          subcategories: selectedSub
            ? { id: selectedSub.id, name: selectedSub.name }
            : null,
          locations: selectedLoc
            ? { id: selectedLoc.id, name: selectedLoc.name, code: selectedLoc.code }
            : null
        };

        onSaved(provisionalProduct);
        showAppToast('Producto guardado localmente (se subirá al conectar a internet)', 'info', 4000);
        onClose();
      };

      // Si no hay conexión a internet al crear producto, derivar directamente a IndexedDB
      if (!productToEdit && typeof navigator !== 'undefined' && !navigator.onLine) {
        await saveOfflineProvisional();
        return;
      }

      if (productToEdit) {
        // ACTUALIZACIÓN
        const { error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', productToEdit.id);

        if (updateError) throw updateError;

        // Calcular diferenciales específicos para la trazabilidad y auditoría
        const nameChanged = (productToEdit.name || '').trim() !== payload.name.trim();
        const prevCategory = categories.find(c => c.id === productToEdit.category_id)?.name 
          || (productToEdit.categories as any)?.name 
          || (productToEdit.category_id ? 'Categoría anterior' : null);
        const newCategory = categories.find(c => c.id === categoryId)?.name || (categoryId ? 'Nueva categoría' : null);
        const categoryChanged = (productToEdit.category_id || '') !== (categoryId || '');

        const prevSubcategory = subcategories.find(s => s.id === productToEdit.subcategory_id)?.name 
          || (productToEdit.subcategories as any)?.name 
          || null;
        const newSubcategory = subcategories.find(s => s.id === subcategoryId)?.name || null;
        const subcategoryChanged = (productToEdit.subcategory_id || '') !== (subcategoryId || '');

        const priceChanged = Number(productToEdit.price) !== Number(parsedPrice);
        const stockChanged = Number(productToEdit.stock) !== Number(consolidatedStock);
        const codeChanged = (productToEdit.code || '').trim() !== payload.code.trim();
        const unitChanged = productToEdit.unit_type !== unitType || (unitType === 'BOX' && Number(productToEdit.units_per_box) !== Number(parsedUpb));

        const diffSummary: string[] = [];

        if (nameChanged) {
          diffSummary.push(`Renombró '${productToEdit.name}' por '${payload.name}'`);
        }
        if (categoryChanged) {
          if (prevCategory && newCategory) {
            diffSummary.push(`Cambió categoría de '${prevCategory}' a '${newCategory}'`);
          } else if (newCategory) {
            diffSummary.push(`Asignó categoría '${newCategory}'`);
          } else {
            diffSummary.push(`Quitó categoría '${prevCategory}'`);
          }
        }
        if (subcategoryChanged && newSubcategory) {
          diffSummary.push(`Asignó subcategoría '${newSubcategory}'`);
        }
        if (priceChanged) {
          diffSummary.push(`Actualizó precio a S/ ${parsedPrice} (Antes: S/ ${productToEdit.price})`);
        }
        if (stockChanged) {
          const diff = Number(consolidatedStock) - Number(productToEdit.stock);
          const sign = diff > 0 ? `+${diff}` : `${diff}`;
          diffSummary.push(`Ajustó stock: ${sign} (${productToEdit.stock} -> ${consolidatedStock})`);
        }
        if (codeChanged) {
          diffSummary.push(`Modificó código/SKU a '${payload.code}'`);
        }
        if (unitChanged) {
          diffSummary.push(`Cambió unidad a ${unitType === 'BOX' ? `Caja (${parsedUpb} und)` : 'Unidad'}`);
        }

        const detailsText = diffSummary.length > 0
          ? diffSummary.join(' • ')
          : `Actualización de ficha técnica por ${user.email}`;

        await logAuditAction({
          inventoryId: currentInventory.id,
          productId: productToEdit.id,
          productName: payload.name,
          actionType: 'UPDATE',
          details: detailsText,
          metadata: {
            previous_name: productToEdit.name,
            new_name: payload.name,
            previous_category: prevCategory,
            new_category: newCategory,
            previous_subcategory: prevSubcategory,
            new_subcategory: newSubcategory,
            previous_price: productToEdit.price,
            new_price: parsedPrice,
            previous_stock: productToEdit.stock,
            new_stock: consolidatedStock,
            unit_type: unitType,
            units_per_box: unitType === 'BOX' ? parsedUpb : null,
            diff_summary: diffSummary
          }
        });

        onSaved();
        onClose();
      } else {
        // CREACIÓN ONLINE CON SUBIDA DE FOTOS Y FALLBACK RESILIENTE
        const uploadedImages: string[] = [];
        for (const imgUrl of images) {
          const matchingBlob = localBlobs.find(b => b.previewUrl === imgUrl);
          if (matchingBlob) {
            try {
              const url = await uploadProductImage(
                new File([matchingBlob.blob], matchingBlob.filename, {
                  type: matchingBlob.blob.type || 'image/webp'
                }),
                currentInventory.id
              );
              uploadedImages.push(url);
            } catch (uploadErr) {
              if (isNetworkOrOfflineError(uploadErr)) {
                await saveOfflineProvisional();
                return;
              }
              throw uploadErr;
            }
          } else {
            uploadedImages.push(imgUrl);
          }
        }
        payload.images = uploadedImages;

        const { data: newProd, error: insertError } = await supabase
          .from('products')
          .insert(payload)
          .select()
          .single();

        if (insertError) {
          if (isNetworkOrOfflineError(insertError)) {
            await saveOfflineProvisional();
            return;
          }
          throw insertError;
        }

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

        onSaved(newProd);
        onClose();
      }
    } catch (err: any) {
      if (!productToEdit && isNetworkOrOfflineError(err)) {
        try {
          // Fallback final resiliente ante pérdida abrupta de paquetes
          const localTempId = crypto.randomUUID();
          await saveProductLocally({
            local_temp_id: localTempId,
            product_data: {
              inventory_id: currentInventory.id,
              name: name.trim(),
              sku: code.trim(),
              code: code.trim(),
              description: description.trim() || undefined,
              category_id: categoryId || undefined,
              sub_category_id: subcategoryId || undefined,
              cost_price: isBusiness ? parseFloat(costPrice) || 0 : 0,
              price: parseFloat(price) || 0,
              unit_type: unitType,
              units_per_box: unitType === 'BOX' ? parsedUpb : undefined,
              stock: consolidatedStock,
              min_stock_alert: Math.max(1, parseInt(minStock, 10) || 1),
              location_id: locationId || undefined,
              is_variant: isVariant,
              parent_id: isVariant && parentId ? parentId : undefined,
              variant_attributes: isVariant ? (isVariant ? { Color: variantColor.trim(), 'Talla/Tamaño': variantSize.trim(), 'Región/Versión': variantRegion.trim() } : {}) : {},
              status: 'ACTIVE',
              last_modified_by: user.id,
              last_modified_by_email: user.email
            },
            images_blobs: localBlobs.filter(b => images.includes(b.previewUrl)).map(b => ({ filename: b.filename, blob: b.blob }))
          });

          const selectedLoc = locations.find(l => l.id === locationId);
          const selectedCat = categories.find(c => c.id === categoryId);
          const selectedSub = subcategories.find(s => s.id === subcategoryId);

          const provProd: Product = {
            id: localTempId,
            inventory_id: currentInventory.id,
            name: name.trim(),
            code: code.trim(),
            description: description.trim() || null,
            price: parseFloat(price) || 0,
            cost_price: isBusiness ? parseFloat(costPrice) || 0 : 0,
            markup_percentage: isBusiness ? parseFloat(markupPercentage) || 0 : 0,
            unit_type: unitType,
            units_per_box: unitType === 'BOX' ? parsedUpb : null,
            stock: consolidatedStock,
            min_stock: Math.max(1, parseInt(minStock, 10) || 1),
            category_id: categoryId || null,
            subcategory_id: subcategoryId || null,
            location_id: locationId || null,
            images: images,
            is_variant: isVariant,
            parent_id: isVariant && parentId ? parentId : null,
            variant_attributes: isVariant ? { Color: variantColor.trim(), 'Talla/Tamaño': variantSize.trim(), 'Región/Versión': variantRegion.trim() } : {},
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_modified_by: user.id,
            last_modified_by_email: user.email || null,
            categories: selectedCat ? { id: selectedCat.id, name: selectedCat.name, color: selectedCat.color } : null,
            subcategories: selectedSub ? { id: selectedSub.id, name: selectedSub.name } : null,
            locations: selectedLoc ? { id: selectedLoc.id, name: selectedLoc.name, code: selectedLoc.code } : null
          };

          onSaved(provProd);
          showAppToast('Producto guardado localmente (se subirá al conectar a internet)', 'info', 4000);
          onClose();
          return;
        } catch (innerErr) {
          console.warn('[OfflineFallback] Error en fallback final:', innerErr);
        }
      }

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

  const lastDuplicateRef = useRef<Product | null>(duplicateDetectedProduct);
  if (duplicateDetectedProduct) {
    lastDuplicateRef.current = duplicateDetectedProduct;
  }
  const activeDuplicate = duplicateDetectedProduct ?? lastDuplicateRef.current;

  const selectedLocationObj = locations.find(l => l.id === locationId);
  void selectedLocationObj;
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
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="5xl"
        formId="product-form"
        disableDismiss={isSubmitting}
        ariaLabel={productToEdit ? 'Modificar producto' : 'Crear nuevo producto'}
      >
        <ModalHeader
          title={productToEdit ? 'Modificar producto' : 'Nuevo producto'}
          subtitle={
            productToEdit
              ? 'Actualización de ficha técnica y existencias'
              : 'Registro de mercancía en catálogo'
          }
          icon={<Package className="w-5 h-5" />}
          iconTone="indigo"
          onClose={onClose}
          closeDisabled={isSubmitting}
        />

        <form
          id="product-form"
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <ModalBody className="flex-1 min-h-0 lg:overflow-hidden lg:flex lg:flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start lg:flex-1 lg:min-h-0">
              {/* PANEL IZQUIERDO (~60%): FORMULARIO */}
              <div className="w-full lg:col-span-7 space-y-4 lg:h-full lg:overflow-y-auto lg:pr-2 custom-scrollbar-dark">
                {errorMsg && (
                  <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-200 flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* 1. Nombre */}
                <div>
                  <label className={modalFieldLabelClass}>
                    Nombre del producto <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej: Pulsera Minimalista Plata 925"
                    required
                    className={modalFieldInputClass}
                  />
                </div>

                {/* 2. Código / SKU con Escáner */}
                <div>
                  <label className={modalFieldLabelClass}>
                    Código / SKU / Código de barras <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Barcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        placeholder="Ej: SKU-9821-PLT"
                        required
                        className={`${modalFieldInputClass} pl-10 font-mono uppercase`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setScanTarget('productCode');
                        setScannerOpen(true);
                      }}
                      className="min-h-[44px] lg:min-h-[40px] px-4 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border border-indigo-500/30 inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-[background-color,transform] duration-150 active:scale-[0.97] cursor-pointer"
                      title="Escanear código con cámara"
                    >
                      <Camera className="w-4 h-4 text-indigo-300" />
                      <span className="hidden sm:inline">Escanear</span>
                    </button>
                  </div>
                </div>

                {/* 3. Unidad de Medida Dual */}
                <div className="p-4 bg-slate-950/55 rounded-2xl border border-slate-800/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      Unidad de medida operativa <span className="text-rose-400">*</span>
                    </span>

                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl shrink-0 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setUnitType('UNIT');
                          setInitialLooseUnits('0');
                          setStock(prev => String(Math.max(0, Math.round(parseFloat(prev) || 1))));
                        }}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                          unitType === 'UNIT'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Unidad</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnitType('BOX')}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                          unitType === 'BOX'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Caja</span>
                      </button>
                    </div>
                  </div>

                  {unitType === 'UNIT' ? (
                    <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3">
                      <div>
                        <label className={modalFieldLabelClass}>
                          {productToEdit ? 'Stock actual (und)' : 'Stock inicial (und)'}{' '}
                          <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={stock}
                          onChange={e => setStock(e.target.value)}
                          required
                          className={`${modalFieldInputClass} font-mono tabular-nums`}
                        />
                      </div>

                      <div>
                        <label className={modalFieldLabelClass}>
                          Stock mínimo (und)
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={minStock}
                          onChange={e => setMinStock(e.target.value)}
                          required
                          placeholder="1"
                          className={`${modalFieldInputClass} font-mono tabular-nums`}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-slate-800/80 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={modalFieldLabelClass}>
                            Unidades por caja <span className="text-rose-400">*</span>
                          </label>
                          <p className="text-[11px] text-slate-400 mb-1.5 hidden sm:block">
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
                            className={`${modalFieldInputClass} font-mono tabular-nums`}
                          />
                        </div>

                        <div>
                          <label className={modalFieldLabelClass}>
                            {productToEdit ? 'Cantidad de cajas' : 'Cajas iniciales'}{' '}
                            <span className="text-rose-400">*</span>
                          </label>
                          <p className="text-[11px] text-slate-400 mb-1.5 hidden sm:block">
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
                            className={`${modalFieldInputClass} font-mono tabular-nums`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={modalFieldLabelClass}>
                            Unidades sueltas (opcional)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={initialLooseUnits}
                            onChange={e => setInitialLooseUnits(e.target.value)}
                            placeholder="0"
                            className={`${modalFieldCompactInputClass} font-mono tabular-nums`}
                          />
                        </div>

                        <div>
                          <label className={modalFieldLabelClass}>
                            Alerta mínimo (cajas)
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={minStock}
                            onChange={e => setMinStock(e.target.value)}
                            required
                            placeholder="1"
                            className={`${modalFieldCompactInputClass} font-mono tabular-nums`}
                          />
                        </div>
                      </div>

                      {parsedUpb > 0 && (
                        <div className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono tabular-nums">
                          <span className="text-slate-400">
                            Equivalencia: <strong className="text-slate-100">1 caja = {parsedUpb} und</strong>
                          </span>
                          <span className="text-indigo-300 font-semibold">
                            Balance: {previewStockText}
                            {previewBoxBreakdown.breakdownLabel ? ` (${previewBoxBreakdown.breakdownLabel})` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Variantes */}
                <div className="p-4 bg-slate-950/55 rounded-2xl border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-semibold text-slate-200">
                        ¿Es variante de otro ítem?
                      </span>
                    </div>
                    <Switch
                      checked={isVariant}
                      onChange={setIsVariant}
                      ariaLabel="¿Es variante de otro ítem?"
                    />
                  </div>

                  {isVariant && (
                    <div className="pt-3 border-t border-slate-800/80 space-y-3">
                      <div>
                        <label className={modalFieldLabelClass}>
                          Producto principal (Padre)
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

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className={modalFieldLabelClass}>Color</label>
                          <input
                            type="text"
                            value={variantColor}
                            onChange={e => setVariantColor(e.target.value)}
                            placeholder="Ej: Dorado"
                            className={modalFieldCompactInputClass}
                          />
                        </div>
                        <div>
                          <label className={modalFieldLabelClass}>Talla</label>
                          <input
                            type="text"
                            value={variantSize}
                            onChange={e => setVariantSize(e.target.value)}
                            placeholder="Ej: 18cm"
                            className={modalFieldCompactInputClass}
                          />
                        </div>
                        <div>
                          <label className={modalFieldLabelClass}>Versión</label>
                          <input
                            type="text"
                            value={variantRegion}
                            onChange={e => setVariantRegion(e.target.value)}
                            placeholder="Ej: Especial"
                            className={modalFieldCompactInputClass}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Categoría y Subcategoría */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={modalFieldLabelClass}>Categoría</label>
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
                    <label className={modalFieldLabelClass}>Subcategoría</label>
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

                {/* Precios */}
                {isBusiness ? (
                  <div className="p-4 bg-slate-950/55 rounded-2xl border border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Estructura financiera (Modo comercial)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={modalFieldLabelClass}>
                          Costo ({currentInventory?.currency || 'USD'})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={costPrice}
                          onChange={e => handleCostChange(e.target.value)}
                          className={`${modalFieldCompactInputClass} font-mono tabular-nums`}
                        />
                      </div>

                      <div>
                        <label className={modalFieldLabelClass}>Margen (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={markupPercentage}
                          onChange={e => handleMarkupChange(e.target.value)}
                          placeholder="20"
                          className={`${modalFieldCompactInputClass} font-mono tabular-nums`}
                        />
                      </div>

                      <div>
                        <label className={modalFieldLabelClass}>Venta final</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={price}
                          onChange={e => handlePriceChange(e.target.value)}
                          className={`${modalFieldCompactInputClass} border-indigo-500/60 font-mono font-bold tabular-nums text-slate-100`}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950/55 rounded-2xl border border-slate-800/80">
                    <label className={modalFieldLabelClass}>
                      Valor base estimado ({currentInventory?.currency || 'USD'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="0.00"
                      className={`${modalFieldInputClass} font-mono tabular-nums`}
                    />
                  </div>
                )}

                {/* Descripción */}
                <div>
                  <label className={modalFieldLabelClass}>Descripción y notas</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Detalles de fabricación, aleación, serie o especificaciones técnicas..."
                    rows={2}
                    className={`${modalFieldInputClass} min-h-[72px] py-2.5 resize-none`}
                  />
                </div>

                {/* Fotografías */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Fotografías del ítem ({images.length}/3 máx)
                    </label>
                    {images.length < 3 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 flex items-center gap-1 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {isUploadingImage ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Comprimiendo...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" /> Subir foto
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
                      className="border-2 border-dashed border-slate-700/80 hover:border-indigo-400/70 rounded-2xl p-5 text-center cursor-pointer transition-colors bg-slate-950/50"
                    >
                      <Camera className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-300 font-medium">
                        Toma o carga hasta 3 fotografías
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Compresión automática WebP (&lt; 300 KB)
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2.5">
                      {images.map((imgUrl, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-xl overflow-hidden aspect-square border border-slate-800/80 bg-slate-950/60"
                        >
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
                            className="absolute top-1.5 right-1.5 p-1.5 bg-slate-950/85 hover:bg-rose-600 text-slate-200 hover:text-white border border-slate-700/80 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar foto"
                            aria-label="Eliminar foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {images.length < 3 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="border-2 border-dashed border-slate-700/80 hover:border-indigo-400/70 rounded-xl aspect-square flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-indigo-200 transition-colors bg-slate-950/40"
                        >
                          <Plus className="w-5 h-5 mb-1" />
                          <span className="text-[11px] font-medium">Añadir</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* PANEL DERECHO (~40%): PREVISUALIZACIÓN EN VIVO DESKTOP */}
              <div className="hidden lg:flex lg:flex-col lg:col-span-5 sticky top-0 self-start">
                <div className="bg-slate-950/65 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                  {/* Encabezado */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-semibold text-slate-200">
                        Vista previa en vivo
                      </span>
                    </div>
                    <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 text-slate-200">
                      {code ? code.toUpperCase() : 'SKU PENDIENTE'}
                    </span>
                  </div>

                  {/* Imagen Principal */}
                  <div className="aspect-[16/10] max-h-44 rounded-xl overflow-hidden bg-slate-900 border border-slate-800/80 flex items-center justify-center relative">
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
                        <Barcode className="w-8 h-8 text-slate-600 mx-auto mb-1.5" />
                        <p className="text-xs text-slate-400 font-mono">
                          Sin imagen de portada
                        </p>
                      </div>
                    )}

                    <div className="absolute top-2.5 right-2.5">
                      {isStockLow ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-950/90 backdrop-blur-sm text-rose-300 border border-rose-500/40 text-[11px] font-mono font-semibold tabular-nums">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          <span>Stock bajo ({previewStockText})</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-950/90 backdrop-blur-sm border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-semibold tabular-nums">
                          <span>{previewStockText} disponibles</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Datos del Ítem */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-bold text-sm text-slate-100 line-clamp-1">
                        {name || 'Nombre del producto'}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        {description || 'Sin notas descriptivas adicionales.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 font-mono font-medium">
                        {unitType === 'BOX' ? `Caja (${parsedUpb || 0} und)` : 'Unidad'}
                      </span>
                      {selectedCategoryObj && (
                        <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium">
                          {selectedCategoryObj.name}
                        </span>
                      )}
                      {selectedSubcategoryObj && (
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 text-slate-300">
                          {selectedSubcategoryObj.name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 text-slate-300 font-medium">
                        <MapPin className="w-3 h-3 text-indigo-400" />
                        {productToEdit ? 'Multi-ubicación' : 'Pendiente de ubicar'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-900/90 border border-slate-800/80 rounded-xl flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400 block">
                          {isBusiness ? 'Precio de venta' : 'Valuación estimada'}
                        </span>
                        <span className="font-mono text-lg font-bold tabular-nums text-slate-100">
                          {formatCurrency(Number(price || 0), currentInventory?.currency)}
                        </span>
                      </div>
                      {isBusiness && costPrice && (
                        <div className="text-right font-mono tabular-nums">
                          <span className="text-[11px] text-slate-400 block">
                            Costo: {formatCurrency(Number(costPrice || 0), currentInventory?.currency)}
                          </span>
                          <span className="text-[11px] text-emerald-300 font-semibold block">
                            +{markupPercentage || 0}% margen
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>

          <ModalFooter
            shortcutLabel={
              isSubmitting ? undefined : productToEdit ? 'Guardar cambios' : 'Registrar producto'
            }
          >
            <CancelButton
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto sm:min-w-[130px]"
            />
            <button
              type="submit"
              disabled={isSubmitting || isUploadingImage}
              className={`${modalPrimaryButtonClass} w-full sm:w-auto sm:min-w-[200px]`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{productToEdit ? 'Guardar cambios' : 'Confirmar registro'}</span>
                </>
              )}
            </button>
          </ModalFooter>
        </form>
      </ModalShell>

      {/* Modal de Confirmación de Código Existente */}
      <ModalShell
        isOpen={Boolean(duplicateDetectedProduct)}
        onClose={() => setDuplicateDetectedProduct(null)}
        maxWidth="sm"
        ariaLabel="Código existente"
      >
        {activeDuplicate && (
          <>
            <ModalHeader
              title="Código existente"
              subtitle={`El código ${activeDuplicate.code} ya pertenece a un producto registrado`}
              icon={<AlertCircle className="w-5 h-5" />}
              iconTone="amber"
              onClose={() => setDuplicateDetectedProduct(null)}
            />

            <ModalBody className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                ¿Deseas ir directamente a su ficha para añadir existencias en lugar de crear un duplicado?
              </p>

              <div className="bg-slate-950/65 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">
                    {activeDuplicate.name}
                  </p>
                  <p className="text-xs font-mono text-slate-400 truncate mt-0.5">
                    SKU {activeDuplicate.code}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 font-mono text-xs font-semibold text-slate-200 tabular-nums shrink-0">
                  {formatStockDisplay(activeDuplicate)}
                </span>
              </div>
            </ModalBody>

            <ModalFooter>
              <CancelButton
                onClick={() => setDuplicateDetectedProduct(null)}
                className="w-full sm:flex-1"
              />
              <button
                type="button"
                onClick={() => {
                  const target = activeDuplicate;
                  setDuplicateDetectedProduct(null);
                  onClose();
                  if (onRedirectToStock && target) {
                    onRedirectToStock(target);
                  }
                }}
                className={`${modalPrimaryButtonClass} w-full sm:flex-1`}
              >
                Ir a Stock
              </button>
            </ModalFooter>
          </>
        )}
      </ModalShell>

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
