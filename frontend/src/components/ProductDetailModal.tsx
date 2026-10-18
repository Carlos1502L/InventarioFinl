import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  MapPin,
  Tag,
  DollarSign,
  Package,
  Clock,
  User,
  ArrowRightLeft,
  Archive,
  Edit,
  History,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  RotateCcw,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Product, AuditLog, Location } from '../types/database';
import { supabase, formatCurrency, formatDate, logAuditAction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onMove: (product: Product) => void;
  onWithdraw: (product: Product) => void;
  locations: Location[];
  allProducts?: Product[];
  onSelectProduct?: (product: Product) => void;
  onUpdated?: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onEdit,
  onMove,
  onWithdraw,
  locations,
  allProducts = [],
  onSelectProduct,
  onUpdated
}) => {
  const { currentInventory, user } = useAuth();
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);

  // Cargar historial de auditoría de este producto
  useEffect(() => {
    if (product && isOpen) {
      setActivePhotoIdx(0);
      setLoadingAudit(true);
      supabase
        .from('audit_logs')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data, error }) => {
          if (!error && data) {
            setAuditLogs(data);
          }
          setLoadingAudit(false);
        });
    }
  }, [product, isOpen]);

  // Vínculo entre variantes: localizar todas las variantes asociadas (RF Stock)
  const relatedVariants = useMemo(() => {
    if (!product || !allProducts || allProducts.length === 0) return [];
    
    // Si este producto es una variante o es padre de variantes
    const familyParentId = product.parent_id || product.id;

    return allProducts.filter((p) => {
      if (p.id === product.id) return false;
      
      // Caso 1: Hermano variante (mismo parent_id)
      if (product.parent_id && p.parent_id === product.parent_id) return true;
      // Caso 2: Es el producto principal / padre
      if (product.parent_id && p.id === product.parent_id) return true;
      // Caso 3: Es variante hija de este producto
      if (!product.parent_id && p.parent_id === product.id) return true;

      return false;
    });
  }, [product, allProducts]);

  // Reactivar Producto (Cambiar estado de Inactivo a Activo)
  const handleReactivateProduct = async () => {
    if (!product || !currentInventory) return;
    const confirmReactivation = window.confirm(
      `¿Confirmas reactivar el producto "${product.name}"? Volverá a estar activo y visible en el inventario general.`
    );
    if (!confirmReactivation) return;

    try {
      setIsReactivating(true);

      const { error } = await supabase
        .from('products')
        .update({
          status: 'ACTIVE',
          withdrawal_reason: null,
          last_modified_by: user?.id,
          last_modified_by_email: user?.email,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);

      if (error) throw error;

      await logAuditAction({
        inventoryId: currentInventory.id,
        productId: product.id,
        productName: product.name,
        actionType: 'UPDATE',
        details: 'Producto reactivado: estado cambiado exitosamente de Inactivo a Activo.',
        metadata: {
          previous_status: product.status,
          new_status: 'ACTIVE',
          reactivated_by: user?.email
        }
      });

      if (onUpdated) onUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error reactivando producto:', err);
      alert('Error al reactivar el producto: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsReactivating(false);
    }
  };

  if (!isOpen || !product) return null;

  const photos = product.images && product.images.length > 0 ? product.images : [];
  const currentLocation = locations.find(l => l.id === product.location_id);
  const isInactive = product.status === 'INACTIVE' || product.status === 'WITHDRAWN';
  const isLowStock = !isInactive && product.stock <= (product.min_stock || 5);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl my-auto overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-blue-600 dark:text-blue-400 font-semibold">
              {product.code}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
              !isInactive
                ? isLowStock ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
            }`}>
              {!isInactive ? (isLowStock ? 'Bajo Stock' : 'Activo') : 'Inactivo'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onEdit(product)}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Editar Producto"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido Principal con Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Alerta si está inactivo */}
          {isInactive && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Este producto está <strong>Inactivo</strong> {product.withdrawal_reason ? `(Motivo: "${product.withdrawal_reason}")` : ''}.
                </span>
              </div>
              <button
                type="button"
                onClick={handleReactivateProduct}
                disabled={isReactivating}
                className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-1.5 text-[11px]"
              >
                {isReactivating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Reactivar
              </button>
            </div>
          )}

          {/* 1. Galería de Fotos (Hasta 3 fotos) */}
          {photos.length > 0 ? (
            <div className="space-y-2">
              <div className="relative aspect-video sm:aspect-[2/1] rounded-2xl overflow-hidden bg-slate-100 dark:bg-black/60 border border-slate-200 dark:border-slate-800">
                <img
                  src={photos[activePhotoIdx]}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : photos.length - 1))}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-black/60 hover:bg-white dark:hover:bg-black/90 text-slate-800 dark:text-white rounded-full shadow transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setActivePhotoIdx((prev) => (prev < photos.length - 1 ? prev + 1 : 0))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 dark:bg-black/60 hover:bg-white dark:hover:bg-black/90 text-slate-800 dark:text-white rounded-full shadow transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {photos.length > 1 && (
                <div className="flex gap-2">
                  {photos.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePhotoIdx(i)}
                      className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                        activePhotoIdx === i ? 'border-blue-500 scale-105' : 'border-slate-200 dark:border-slate-800 opacity-60'
                      }`}
                    >
                      <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-28 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center text-slate-400">
              <Package className="w-8 h-8 mb-1 opacity-50" />
              <span className="text-xs">Sin fotografías registradas</span>
            </div>
          )}

          {/* 2. Título, Descripción y Precios */}
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{product.name}</h2>
            {product.description && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {product.description}
              </p>
            )}
          </div>

          {/* 3. Métricas Destacadas (Precio, Stock, Ubicación) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-2xl">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> Precio
              </div>
              <p className="text-base font-extrabold text-slate-900 dark:text-white">
                {formatCurrency(product.price, currentInventory?.currency)}
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-2xl">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                <Package className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> Stock Actual
              </div>
              <p className={`text-base font-extrabold ${isLowStock ? 'text-amber-500 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                {product.stock} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">uds (mín: {product.min_stock})</span>
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-2xl col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                <MapPin className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" /> Ubicación
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {currentLocation?.name || 'No asignada'}
              </p>
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{currentLocation?.code}</p>
            </div>
          </div>

          {/* Categoría y Subcategoría */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 font-medium">
              <Tag className="w-3 h-3 text-blue-500 dark:text-blue-400" />
              Categoría: <strong>{product.categories?.name || 'General'}</strong>
            </span>
            {product.subcategories?.name && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 font-medium">
                Subcategoría: <strong>{product.subcategories.name}</strong>
              </span>
            )}
          </div>

          {/* 4. Botones de Acción Operativa */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-2.5">
            <button
              onClick={() => onMove(product)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-amber-50 dark:bg-amber-600/20 hover:bg-amber-100 dark:hover:bg-amber-600/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 rounded-xl text-xs font-semibold transition-all active:scale-95"
            >
              <ArrowRightLeft className="w-4 h-4" /> Mover de Ubicación
            </button>

            {isInactive ? (
              <button
                onClick={handleReactivateProduct}
                disabled={isReactivating}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md shadow-emerald-500/20"
              >
                {isReactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Reactivar Producto
              </button>
            ) : (
              <button
                onClick={() => onWithdraw(product)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-rose-50 dark:bg-rose-600/20 hover:bg-rose-100 dark:hover:bg-rose-600/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs font-semibold transition-all active:scale-95"
              >
                <Archive className="w-4 h-4" /> Dar de Baja (Inactivar)
              </button>
            )}
          </div>

          {/* 5. Variantes Asociadas (RF Stock: Vínculo entre variantes con redirección) */}
          {relatedVariants.length > 0 && (
            <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-indigo-500" /> Variantes del Producto ({relatedVariants.length})
                </span>
                <span className="text-[11px] text-slate-400">Toca para ir a la variante</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {relatedVariants.map((v) => {
                  const vInactive = v.status === 'INACTIVE' || v.status === 'WITHDRAWN';
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onSelectProduct?.(v)}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-2xl text-left transition-all active:scale-[0.98] group flex items-center justify-between shadow-sm"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {v.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                          <span className="font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                            {v.code}
                          </span>
                          {v.variant_attributes &&
                            Object.entries(v.variant_attributes).map(([k, val]) => (
                              <span
                                key={k}
                                className="px-1.5 py-0.5 bg-slate-200/80 dark:bg-slate-700 rounded font-medium text-slate-700 dark:text-slate-300"
                              >
                                {k}: {val}
                              </span>
                            ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                          {formatCurrency(v.price, currentInventory?.currency)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            vInactive
                              ? 'text-rose-500'
                              : v.stock <= (v.min_stock || 1)
                              ? 'text-amber-500'
                              : 'text-slate-500'
                          }`}
                        >
                          {vInactive ? 'Inactivo' : `${v.stock} uds`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Trazabilidad e Historial de Auditoría */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Trazabilidad e Historial</h4>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{auditLogs.length} eventos</span>
            </div>

            {/* Etiqueta de Última Modificación */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-slate-700 dark:text-slate-300">
                  Modificado por: <strong className="text-blue-600 dark:text-blue-300">{product.last_modified_by_email || 'Sistema'}</strong>
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatDate(product.updated_at)}
              </span>
            </div>

            {/* Lista cronológica de cambios */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {loadingAudit ? (
                <div className="text-center py-4 text-xs text-slate-400">Cargando trazabilidad...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">No hay registros de auditoría anteriores</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{log.action_type}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(log.created_at)}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px]">{log.details}</p>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">
                      Por: <span className="text-slate-600 dark:text-slate-400">{log.user_email}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
