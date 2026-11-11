import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
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
import { Product, Category, Subcategory, Location, UnitType } from '../../../types/database';
import {
  supabase,
  uploadProductImage,
  logAuditAction,
  formatCurrency,
  formatCleanDecimal,
  formatStockDisplay,
  getBoxBreakdown
} from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { compressImage } from '../../../utils/imageCompression';
import { saveProductLocally, isNetworkOrOfflineError } from '../../../services/offlineSync';
import { showAppToast } from '../../ui/ToastNotification';
import { BarcodeScannerModal } from '../BarcodeScannerModal';
import { MinimalDropdown } from '../../ui/MinimalDropdown';
import { CancelButton } from '../../common/CancelButton';
import { Switch } from '../../common/Switch';
import { useLatestValue, useModalEscape, useModalMotion } from '../modalMotion';

interface ProductEditViewProps {
  productToEdit?: Product | null;
  categories: Category[];
  subcategories: Subcategory[];
  locations: Location[];
  products: Product[];
  onCancel: () => void;
  onSuccess: (savedProduct?: Product) => void;
  onCloseEntireModal: () => void;
  onRedirectToStock?: (product: Product) => void;
  onSwitchToRestockProduct?: (product: Product) => void;
  onSubmittingChange?: (submitting: boolean) => void;
  onSubModalOpenChange?: (open: boolean) => void;
}

export const ProductEditView: React.FC<ProductEditViewProps> = ({
  productToEdit,
  categories,
  subcategories,
  locations,
  products,
  onCancel,
  onSuccess,
  onCloseEntireModal,
  onRedirectToStock,
  onSwitchToRestockProduct,
  onSubmittingChange,
  onSubModalOpenChange
}) => {
  const { currentInventory, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusiness = currentInventory?.inventory_type !== 'PERSONAL';

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [costPrice, setCostPrice] = useState<string>('0.00');
  const [markupPercentage, setMarkupPercentage] = useState<string>('20.00');
  const [price, setPrice] = useState<string>('0.00');
  const [unitType, setUnitType] = useState<UnitType>('UNIT');
  const [unitsPerBox, setUnitsPerBox] = useState<string>('12');
  const [initialLooseUnits, setInitialLooseUnits] = useState<string>('0');
  const [stock, setStock] = useState<string>('1');
  const [minStock, setMinStock] = useState<string>('1');
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  const [localBlobs, setLocalBlobs] = useState<Array<{ filename: string; blob: Blob; previewUrl: string }>>([]);
  const [isVariant, setIsVariant] = useState(false);
  const [parentId, setParentId] = useState<string>('');
  const [variantColor, setVariantColor] = useState('');
  const [variantSize, setVariantSize] = useState('');
  const [variantRegion, setVariantRegion] = useState('');

  const [duplicateDetectedProduct, setDuplicateDetectedProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<'productCode' | 'locationCode'>('productCode');

  const setSubmitting = (next: boolean) => {
    setIsSubmitting(next);
    onSubmittingChange?.(next);
  };

  useEffect(() => {
    onSubModalOpenChange?.(scannerOpen || Boolean(duplicateDetectedProduct));
  }, [scannerOpen, duplicateDetectedProduct, onSubModalOpenChange]);

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name || '');
      setCode(productToEdit.code || '');
      setDescription(productToEdit.description || '');
      setPrice(productToEdit.price ? String(productToEdit.price) : '0.00');
      setCostPrice(productToEdit.cost_price ? String(productToEdit.cost_price) : '0.00');
      setMarkupPercentage(productToEdit.markup_percentage ? String(productToEdit.markup_percentage) : '20.00');

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
      setMinStock('1');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productToEdit?.id]);

  const handleCostChange = (val: string) => {
    setCostPrice(val);
    const cost = parseFloat(val) || 0;
    const markup = parseFloat(markupPercentage) || 0;
    setPrice((cost * (1 + markup / 100)).toFixed(2));
  };

  const handleMarkupChange = (val: string) => {
    setMarkupPercentage(val);
    const cost = parseFloat(costPrice) || 0;
    const markup = parseFloat(val) || 0;
    setPrice((cost * (1 + markup / 100)).toFixed(2));
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    if (isBusiness) {
      const finalPrice = parseFloat(val) || 0;
      const cost = parseFloat(costPrice) || 0;
      if (cost > 0) {
        setMarkupPercentage((((finalPrice - cost) / cost) * 100).toFixed(2));
      }
    }
  };

  const filteredSubcategories = subcategories.filter(s => s.category_id === categoryId);
  const candidateParents = products.filter(p => !p.is_variant && p.id !== productToEdit?.id);

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

        const compressedFile = await compressImage(file, 1200, 1200, 0.8);

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

  const handleScanSuccess = (scannedText: string) => {
    const cleanText = scannedText.trim();
    if (scanTarget === 'productCode') {
      const existing = products.find(
        p => p.code.toLowerCase() === cleanText.toLowerCase() && p.id !== productToEdit?.id
      );
      if (existing) {
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

  const parsedUpb = parseInt(unitsPerBox, 10) || 0;
  const parsedBaseStock = parseFloat(stock) || 0;
  const parsedLoose = parseInt(initialLooseUnits, 10) || 0;
  const consolidatedStock =
    unitType === 'BOX'
      ? parsedUpb > 0
        ? Number((parsedBaseStock + parsedLoose / parsedUpb).toFixed(4))
        : parsedBaseStock
      : Math.round(parsedBaseStock);

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

    if (unitType === 'BOX') {
      if (!unitsPerBox.trim() || !Number.isInteger(parsedUpb) || parsedUpb <= 0) {
        setErrorMsg('Para productos tipo Caja, "Unidades por caja" debe ser un número entero mayor a 0.');
        return;
      }
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const parsedPrice = parseFloat(price) || 0;
      const parsedCostPrice = parseFloat(costPrice) || 0;
      const parsedMarkup = parseFloat(markupPercentage) || 0;
      const parsedMinStock = Math.max(1, parseInt(minStock, 10) || 1);

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
        location_id: productToEdit ? productToEdit.location_id || null : null,
        images: images,
        is_variant: isVariant,
        parent_id: isVariant && parentId ? parentId : null,
        variant_attributes: isVariant ? variantAttributes : {},
        status: 'ACTIVE' as const,
        last_modified_by: user.id,
        last_modified_by_email: user.email || null
      };

      const formattedStockLabel = formatStockDisplay({
        stock: consolidatedStock,
        unit_type: unitType,
        units_per_box: unitType === 'BOX' ? parsedUpb : null
      });

      const selectedCat = categories.find(c => c.id === categoryId);
      const selectedSub = subcategories.find(s => s.id === subcategoryId);
      const selectedLoc = locations.find(l => l.id === locationId);

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
          categories: selectedCat ? { id: selectedCat.id, name: selectedCat.name, color: selectedCat.color } : null,
          subcategories: selectedSub ? { id: selectedSub.id, name: selectedSub.name } : null,
          locations: selectedLoc ? { id: selectedLoc.id, name: selectedLoc.name, code: selectedLoc.code } : null
        };

        onSuccess(provisionalProduct);
        showAppToast('Producto guardado localmente (se subirá al conectar a internet)', 'info', 4000);
      };

      if (!productToEdit && typeof navigator !== 'undefined' && !navigator.onLine) {
        await saveOfflineProvisional();
        return;
      }

      if (productToEdit) {
        const updatedAt = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', productToEdit.id);

        if (updateError) throw updateError;

        const nameChanged = (productToEdit.name || '').trim() !== payload.name.trim();
        const prevCategory =
          categories.find(c => c.id === productToEdit.category_id)?.name ||
          (productToEdit.categories as any)?.name ||
          (productToEdit.category_id ? 'Categoría anterior' : null);
        const newCategory = selectedCat?.name || (categoryId ? 'Nueva categoría' : null);
        const categoryChanged = (productToEdit.category_id || '') !== (categoryId || '');

        const prevSubcategory =
          subcategories.find(s => s.id === productToEdit.subcategory_id)?.name ||
          (productToEdit.subcategories as any)?.name ||
          null;
        const newSubcategory = selectedSub?.name || null;
        const subcategoryChanged = (productToEdit.subcategory_id || '') !== (subcategoryId || '');

        const priceChanged = Number(productToEdit.price) !== Number(parsedPrice);
        const stockChanged = Number(productToEdit.stock) !== Number(consolidatedStock);
        const codeChanged = (productToEdit.code || '').trim() !== payload.code.trim();
        const unitChanged =
          productToEdit.unit_type !== unitType ||
          (unitType === 'BOX' && Number(productToEdit.units_per_box) !== Number(parsedUpb));

        const diffSummary: string[] = [];
        if (nameChanged) diffSummary.push(`Renombró '${productToEdit.name}' por '${payload.name}'`);
        if (categoryChanged) {
          if (prevCategory && newCategory) diffSummary.push(`Cambió categoría de '${prevCategory}' a '${newCategory}'`);
          else if (newCategory) diffSummary.push(`Asignó categoría '${newCategory}'`);
          else diffSummary.push(`Quitó categoría '${prevCategory}'`);
        }
        if (subcategoryChanged && newSubcategory) diffSummary.push(`Asignó subcategoría '${newSubcategory}'`);
        if (priceChanged) diffSummary.push(`Actualizó precio a S/ ${parsedPrice} (Antes: S/ ${productToEdit.price})`);
        if (stockChanged) {
          const diff = Number(consolidatedStock) - Number(productToEdit.stock);
          const sign = diff > 0 ? `+${diff}` : `${diff}`;
          diffSummary.push(`Ajustó stock: ${sign} (${productToEdit.stock} -> ${consolidatedStock})`);
        }
        if (codeChanged) diffSummary.push(`Modificó código/SKU a '${payload.code}'`);
        if (unitChanged) diffSummary.push(`Cambió unidad a ${unitType === 'BOX' ? `Caja (${parsedUpb} und)` : 'Unidad'}`);

        const detailsText =
          diffSummary.length > 0
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

        const updatedSnapshot: Product = {
          ...productToEdit,
          ...payload,
          updated_at: updatedAt,
          categories: selectedCat
            ? { id: selectedCat.id, name: selectedCat.name, color: selectedCat.color }
            : null,
          subcategories: selectedSub ? { id: selectedSub.id, name: selectedSub.name } : null
        };
        onSuccess(updatedSnapshot);
      } else {
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

        onSuccess(newProd);
      }
    } catch (err: any) {
      if (!productToEdit && isNetworkOrOfflineError(err)) {
        try {
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
              variant_attributes: isVariant
                ? {
                    Color: variantColor.trim(),
                    'Talla/Tamaño': variantSize.trim(),
                    'Región/Versión': variantRegion.trim()
                  }
                : {},
              status: 'ACTIVE',
              last_modified_by: user.id,
              last_modified_by_email: user.email
            },
            images_blobs: localBlobs
              .filter(b => images.includes(b.previewUrl))
              .map(b => ({ filename: b.filename, blob: b.blob }))
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
            variant_attributes: isVariant
              ? {
                  Color: variantColor.trim(),
                  'Talla/Tamaño': variantSize.trim(),
                  'Región/Versión': variantRegion.trim()
                }
              : {},
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_modified_by: user.id,
            last_modified_by_email: user.email || null,
            categories: selectedCat
              ? { id: selectedCat.id, name: selectedCat.name, color: selectedCat.color }
              : null,
            subcategories: selectedSub ? { id: selectedSub.id, name: selectedSub.name } : null,
            locations: selectedLoc ? { id: selectedLoc.id, name: selectedLoc.name, code: selectedLoc.code } : null
          };

          onSuccess(provProd);
          showAppToast('Producto guardado localmente (se subirá al conectar a internet)', 'info', 4000);
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
      setSubmitting(false);
    }
  };

  const activeDuplicate = useLatestValue(duplicateDetectedProduct);
  const { backdropMotion, panelMotion, tabContentMotion } = useModalMotion();
  useModalEscape(Boolean(duplicateDetectedProduct), () => setDuplicateDetectedProduct(null));

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
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="p-4 sm:p-6 max-md:px-5 max-md:py-4 overflow-y-auto flex-1 min-h-0 overscroll-contain custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-md:block">
            {/* PANEL IZQUIERDO: FORMULARIO */}
            <div className="w-full lg:col-span-7 space-y-4">
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#17191c] uppercase tracking-wider mb-1">
                  Nombre del Producto <span className="text-[#e7000b]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Pulsera Minimalista Plata 925"
                  required
                  className="w-full min-h-[44px] bg-[#ffffff] border border-[#ececec] rounded-xl px-4 py-2.5 text-sm text-[#17191c] placeholder:text-[#777b86]/50 focus:outline-none focus:ring-1 focus:ring-[#17191c] focus:border-[#17191c] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17191c] uppercase tracking-wider mb-1">
                  Código / SKU / Código de Barras <span className="text-[#e7000b]">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      placeholder="Ej: SKU-9821-PLT"
                      required
                      className="w-full min-h-[44px] bg-[#ffffff] border border-[#ececec] rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-mono tabular-nums text-[#17191c] placeholder:text-[#777b86]/50 focus:outline-none focus:ring-1 focus:ring-[#17191c] focus:border-[#17191c] transition-all uppercase"
                    />
                    <Barcode className="w-4 h-4 text-[#777b86] absolute left-3.5 top-3.5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setScanTarget('productCode');
                      setScannerOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 min-h-[44px] bg-white hover:bg-[#fafafb] text-[#17191c] border border-[#CBD5E1] hover:border-[#17191c] rounded-xl text-xs uppercase tracking-wider transition-all whitespace-nowrap active:scale-95 shadow-xs cursor-pointer font-medium"
                    title="Escanear código"
                  >
                    <Camera className="w-4 h-4 text-[#17191c]" />
                    <span>Escanear</span>
                  </button>
                </div>
              </div>

              {/* Unidad de Medida Dual */}
              <div className="mobile-flat-section p-4 bg-[#fafafb] rounded-2xl border border-[#ececec] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#17191c] max-md:text-neutral-700 max-md:font-semibold max-md:normal-case uppercase tracking-wider">
                    Unidad de Medida Operativa <span className="text-[#e7000b]">*</span>
                  </span>

                  <div className="mobile-segmented grid grid-cols-2 gap-1.5 p-1 bg-white border border-[#ececec] rounded-xl shrink-0 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setUnitType('UNIT');
                        setInitialLooseUnits('0');
                        setStock(prev => String(Math.max(0, Math.round(parseFloat(prev) || 1))));
                      }}
                      className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        unitType === 'UNIT'
                          ? 'bg-[#17191c] text-white shadow-sm mobile-pill-active'
                          : 'text-[#777b86] hover:text-[#17191c]'
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
                          ? 'bg-[#17191c] text-white shadow-sm mobile-pill-active'
                          : 'text-[#777b86] hover:text-[#17191c]'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Caja</span>
                    </button>
                  </div>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {unitType === 'UNIT' ? (
                    <motion.div
                      key="form-unit-mode"
                      {...tabContentMotion}
                      className="pt-2 border-t border-[#ececec] grid grid-cols-2 gap-3"
                    >
                      <div>
                        <label className="block text-xs font-bold text-[#17191c] uppercase tracking-wider mb-1 leading-snug">
                          {productToEdit ? 'Stock Actual (Unidades)' : 'Stock Inicial (Unidades)'} <span className="text-[#e7000b]">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={stock}
                          onChange={e => setStock(e.target.value)}
                          required
                          className="w-full min-h-[44px] bg-white border border-[#ececec] rounded-xl px-3 sm:px-4 py-2 text-sm font-mono tabular-nums text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#17191c] uppercase tracking-wider mb-1 leading-snug">
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
                          className="w-full min-h-[44px] bg-white border border-[#ececec] rounded-xl px-3 sm:px-4 py-2 text-sm font-mono tabular-nums text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="form-box-mode"
                      {...tabContentMotion}
                      className="pt-3 border-t border-[#ececec] space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] sm:text-xs font-bold text-[#17191c] uppercase tracking-wider mb-1 leading-snug">
                            Unidades por caja <span className="text-[#e7000b]">*</span>
                          </label>
                          <p className="text-[10px] text-[#777b86] mb-1.5 hidden sm:block">
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
                            className="w-full min-h-[44px] bg-white border border-[#ececec] rounded-xl px-3 sm:px-4 py-2 text-sm font-mono tabular-nums text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] sm:text-xs font-bold text-[#17191c] uppercase tracking-wider mb-1 leading-snug">
                            {productToEdit ? 'Cantidad de cajas' : 'Cantidad inicial de cajas'} <span className="text-[#e7000b]">*</span>
                          </label>
                          <p className="text-[10px] text-[#777b86] mb-1.5 hidden sm:block">
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
                            className="w-full min-h-[44px] bg-white border border-[#ececec] rounded-xl px-3 sm:px-4 py-2 text-sm font-mono tabular-nums text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#17191c] uppercase tracking-wider mb-1 leading-snug">
                            Unidades sueltas (Opcional)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={initialLooseUnits}
                            onChange={e => setInitialLooseUnits(e.target.value)}
                            placeholder="0"
                            className="w-full min-h-[40px] bg-white border border-[#ececec] rounded-xl px-3 sm:px-3.5 py-1.5 text-xs font-mono tabular-nums text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-[#17191c] uppercase tracking-wider mb-1 leading-snug">
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
                            className="w-full min-h-[40px] bg-white border border-[#ececec] rounded-xl px-3 sm:px-3.5 py-1.5 text-xs font-mono tabular-nums text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                          />
                        </div>
                      </div>

                      {parsedUpb > 0 && (
                        <div className="p-3 bg-white border border-[#ececec] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono tabular-nums">
                          <span className="text-[#777b86]">
                            Equivalencia: <strong className="text-[#17191c]">1 caja = {parsedUpb} unidades</strong>
                          </span>
                          <span className="text-[#17191c] font-bold">
                            Balance: {previewStockText}
                            {previewBoxBreakdown.breakdownLabel ? ` (${previewBoxBreakdown.breakdownLabel})` : ''}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Variantes del Producto */}
              <div className="mobile-flat-section p-4 bg-[#fafafb] rounded-2xl border border-[#ececec] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-[#17191c] max-md:text-neutral-600" />
                    <span className="text-xs font-medium text-[#17191c] max-md:text-neutral-700 max-md:font-semibold max-md:normal-case uppercase tracking-wider">
                      ¿Es variante de otro ítem?
                    </span>
                  </div>
                  <Switch checked={isVariant} onChange={setIsVariant} ariaLabel="¿Es variante de otro ítem?" />
                </div>

                <AnimatePresence initial={false}>
                  {isVariant && (
                    <motion.div
                      key="form-variant-fields"
                      {...tabContentMotion}
                      className="pt-3 border-t border-[#ececec] space-y-3"
                    >
                      <div>
                        <label className="block text-[11px] font-medium text-[#777b86] uppercase tracking-wider mb-1">
                          Producto Principal (Padre)
                        </label>
                        <MinimalDropdown
                          value={parentId}
                          onChange={val => setParentId(val)}
                          placeholder="Selecciona el producto principal..."
                          options={[
                            { value: '', label: 'Selecciona el producto principal...' },
                            ...candidateParents.map(parent => ({
                              value: parent.id,
                              label: parent.name,
                              badge: parent.code
                            }))
                          ]}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-[#777b86] uppercase tracking-wider mb-1 leading-snug truncate">
                              Color
                            </label>
                            <input
                              type="text"
                              value={variantColor}
                              onChange={e => setVariantColor(e.target.value)}
                              placeholder="Ej: Dorado"
                              className="w-full bg-white border border-[#ececec] rounded-lg px-2.5 py-1.5 text-xs text-[#17191c]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#777b86] uppercase tracking-wider mb-1 leading-snug truncate">
                              Talla
                            </label>
                            <input
                              type="text"
                              value={variantSize}
                              onChange={e => setVariantSize(e.target.value)}
                              placeholder="Ej: 18cm"
                              className="w-full bg-white border border-[#ececec] rounded-lg px-2.5 py-1.5 text-xs text-[#17191c]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] text-[#777b86] uppercase tracking-wider mb-1 leading-snug truncate">
                            Versión
                          </label>
                          <input
                            type="text"
                            value={variantRegion}
                            onChange={e => setVariantRegion(e.target.value)}
                            placeholder="Ej: Especial"
                            className="w-full bg-white border border-[#ececec] rounded-lg px-2.5 py-1.5 text-xs text-[#17191c]"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Categoría y Subcategoría */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#17191c] uppercase tracking-wider mb-1 leading-snug truncate">
                    Categoría
                  </label>
                  <MinimalDropdown
                    value={categoryId}
                    onChange={val => {
                      setCategoryId(val);
                      setSubcategoryId('');
                    }}
                    placeholder="Ninguna"
                    options={[
                      { value: '', label: 'Ninguna' },
                      ...categories.map(cat => ({
                        value: cat.id,
                        label: cat.name
                      }))
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17191c] uppercase tracking-wider mb-1 leading-snug truncate">
                    Subcategoría
                  </label>
                  <MinimalDropdown
                    value={subcategoryId}
                    onChange={val => setSubcategoryId(val)}
                    placeholder="Ninguna"
                    options={[
                      { value: '', label: 'Ninguna' },
                      ...filteredSubcategories.map(sub => ({
                        value: sub.id,
                        label: sub.name
                      }))
                    ]}
                  />
                </div>
              </div>

              {/* Precios */}
              {isBusiness ? (
                <div className="mobile-flat-section p-4 bg-[#fafafb] rounded-2xl border border-[#ececec] space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[#17191c] max-md:hidden">
                    <Sparkles className="w-3.5 h-3.5 text-[#17191c]" />
                    <span>Estructura Financiera (Modo Comercial)</span>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-[#777b86] uppercase tracking-wider mb-1 leading-snug">
                          Costo ({currentInventory?.currency || 'USD'})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={costPrice}
                          onChange={e => handleCostChange(e.target.value)}
                          className="w-full min-h-[40px] bg-white border border-[#ececec] rounded-xl px-3 py-2 font-mono tabular-nums text-sm text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-[#777b86] uppercase tracking-wider mb-1 leading-snug">
                          Margen (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={markupPercentage}
                          onChange={e => handleMarkupChange(e.target.value)}
                          placeholder="20"
                          className="w-full min-h-[40px] bg-white border border-[#ececec] rounded-xl px-3 py-2 font-mono tabular-nums text-sm text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[#17191c] uppercase tracking-wider mb-1 leading-snug">
                        Venta Final
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={price}
                        onChange={e => handlePriceChange(e.target.value)}
                        className="w-full min-h-[40px] bg-white border-2 border-slate-900 rounded-xl px-3 py-2 font-mono text-sm font-semibold tabular-nums text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mobile-flat-section p-4 bg-[#fafafb] rounded-2xl border border-[#ececec]">
                  <label className="block text-xs font-medium text-[#17191c] uppercase tracking-wider mb-1">
                    Valor Base Estimado ({currentInventory?.currency || 'USD'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full min-h-[44px] bg-white border border-[#ececec] rounded-xl px-4 py-2 font-mono tabular-nums text-sm text-[#17191c] focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                  />
                </div>
              )}

              {/* Descripción */}
              <div>
                <label className="block text-xs font-medium text-[#17191c] uppercase tracking-wider mb-1">
                  Descripción y Notas
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detalles de fabricación, aleación, serie o especificaciones técnicas..."
                  rows={2}
                  className="w-full bg-[#ffffff] border border-[#ececec] rounded-xl px-4 py-2.5 text-sm text-[#17191c] placeholder:text-[#777b86]/50 focus:outline-none focus:ring-1 focus:ring-[#17191c]"
                />
              </div>

              {/* Fotografías */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-[#17191c] uppercase tracking-wider">
                    Fotografías del Ítem ({images.length}/3 máx)
                  </label>
                  {images.length < 3 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="text-xs font-medium text-[#17191c] hover:underline flex items-center gap-1 disabled:opacity-50 transition-colors cursor-pointer"
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
                    className="border-2 border-dashed border-[#ececec] hover:border-[#17191c] rounded-2xl p-5 text-center cursor-pointer transition-colors bg-[#fafafb]"
                  >
                    <Camera className="w-6 h-6 text-[#17191c]/60 mx-auto mb-1" />
                    <p className="text-xs text-[#17191c] font-light">Toma o carga de imágenes</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-xl overflow-hidden aspect-square border border-[#ececec] bg-[#fafafb]"
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
                        className="border-2 border-dashed border-[#ececec] hover:border-[#17191c] rounded-xl aspect-square flex flex-col items-center justify-center cursor-pointer text-[#777b86] hover:text-[#17191c] transition-colors"
                      >
                        <Plus className="w-5 h-5 mb-0.5" />
                        <span className="text-[10px] uppercase font-mono">Añadir</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* PANEL DERECHO DESKTOP: PREVISUALIZACIÓN EN VIVO */}
            <div className="hidden lg:block lg:col-span-5 sticky top-0 self-start">
              <div className="bg-[#fafafb] border border-[#ececec] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#ececec]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#17191c]">
                      PREVISUALIZACIÓN EN VIVO
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-white border border-[#ececec] text-[#17191c] tabular-nums">
                    {code ? code.toUpperCase() : 'SKU PENDIENTE'}
                  </span>
                </div>

                <div className="my-3.5 aspect-[16/10] max-h-44 rounded-xl overflow-hidden bg-white border border-[#ececec] flex items-center justify-center relative">
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
                      <Barcode className="w-8 h-8 text-[#17191c]/20 mx-auto mb-1" />
                      <p className="text-[11px] text-[#777b86] font-mono uppercase">Sin imagen de portada</p>
                    </div>
                  )}

                  <div className="absolute top-2.5 right-2.5">
                    {isStockLow ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 text-[10px] font-mono font-semibold tabular-nums">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                        <span>STOCK BAJO ({previewStockText.toUpperCase()})</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-[#ececec] text-[#17191c] text-[10px] font-mono tabular-nums">
                        <span>{previewStockText.toUpperCase()} DISPONIBLES</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 font-mono">
                  <div>
                    <h4 className="font-bold text-sm text-[#17191c] uppercase tracking-tight line-clamp-1">
                      {name || 'NOMBRE DEL PRODUCTO'}
                    </h4>
                    <p className="text-[11px] text-[#777b86] mt-0.5 line-clamp-1">
                      {description || 'Sin notas descriptivas adicionales.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#17191c] text-white uppercase tabular-nums">
                      {unitType === 'BOX' ? `CAJA (${parsedUpb || 0} UND)` : 'UNIDAD'}
                    </span>
                    {selectedCategoryObj && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#f5f5f5] text-[#17191c] border border-[#e5e5e5] uppercase">
                        {selectedCategoryObj.name}
                      </span>
                    )}
                    {selectedSubcategoryObj && (
                      <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#ececec] text-[#777b86] uppercase">
                        {selectedSubcategoryObj.name}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#f5f5f5] text-[#17191c] border border-[#e5e5e5] uppercase font-bold">
                      <MapPin className="w-3 h-3 text-[#17191c]" />
                      {productToEdit ? 'MULTI-UBICACIÓN' : 'STOCK PENDIENTE DE UBICAR'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white border border-[#ececec] rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#777b86] uppercase block">
                        {isBusiness ? 'PRECIO DE VENTA' : 'VALUACIÓN ESTIMADA'}
                      </span>
                      <span className="text-base font-bold text-[#17191c] tabular-nums">
                        {formatCurrency(Number(price || 0), currentInventory?.currency)}
                      </span>
                    </div>
                    {isBusiness && costPrice && (
                      <div className="text-right">
                        <span className="text-[10px] text-[#777b86] uppercase block tabular-nums">
                          COSTO: {formatCurrency(Number(costPrice || 0), currentInventory?.currency)}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-700 font-semibold block tabular-nums">
                          +{markupPercentage || 0}% MARGEN
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Fijo con Padding Limpio */}
        <div className="px-6 py-4 max-md:px-5 max-md:py-3.5 border-t border-[#ececec] bg-white shrink-0 flex max-md:flex-col-reverse items-center justify-end gap-2.5">
          <CancelButton onClick={onCancel} />
          <button
            type="submit"
            disabled={isSubmitting || isUploadingImage}
            className="mobile-primary-btn min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 bg-[#17191c] hover:bg-black text-white text-xs font-mono uppercase tracking-wider font-semibold rounded-full shadow-sm disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-white max-md:hidden" />
                <span>{productToEdit ? 'Guardar Cambios' : 'Confirmar Registro'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Modal de Confirmación de Código Existente */}
      <AnimatePresence>
        {duplicateDetectedProduct && activeDuplicate && (
          <motion.div
            {...backdropMotion}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              {...panelMotion}
              className="mobile-dark-modal bg-white rounded-3xl w-full max-w-sm shadow-2xl text-neutral-900 overflow-hidden"
            >
              <div className="p-6 pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 max-md:hidden">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-neutral-900 leading-snug">Código existente</h3>
                      <p className="text-xs text-neutral-500 mt-1">
                        El código <strong className="font-mono">{activeDuplicate.code}</strong> ya pertenece a un producto registrado. ¿Deseas añadir unidades?
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

              <div className="px-6 pb-6 pt-3 space-y-5">
                <div className="mobile-flat-row bg-neutral-50 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{activeDuplicate.name}</p>
                    <p className="text-xs text-neutral-400 truncate mt-0.5 font-mono">SKU {activeDuplicate.code}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-neutral-100 text-xs font-semibold text-neutral-800 tabular-nums flex-shrink-0">
                    {formatStockDisplay(activeDuplicate)}
                  </span>
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5 pt-1">
                  <CancelButton onClick={() => setDuplicateDetectedProduct(null)} className="w-full sm:flex-1" />
                  <button
                    type="button"
                    onClick={() => {
                      const target = activeDuplicate;
                      setDuplicateDetectedProduct(null);
                      if (onSwitchToRestockProduct && target) {
                        onSwitchToRestockProduct(target);
                      } else if (onRedirectToStock && target) {
                        onCloseEntireModal();
                        onRedirectToStock(target);
                      } else {
                        onCloseEntireModal();
                      }
                    }}
                    className="mobile-primary-btn w-full sm:flex-1 py-3 px-4 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold uppercase tracking-wider transition-colors active:scale-[0.98]"
                  >
                    Reingresar Stock
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
