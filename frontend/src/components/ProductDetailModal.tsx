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
  Loader2,
  Check
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

  const relatedVariants = useMemo(() => {
    if (!product || !allProducts || allProducts.length === 0) return [];
    return allProducts.filter((p) => {
      if (p.id === product.id) return false;
      if (product.parent_id && p.parent_id === product.parent_id) return true;
      if (product.parent_id && p.id === product.parent_id) return true;
      if (!product.parent_id && p.parent_id === product.id) return true;
      return false;
    });
  }, [product, allProducts]);

  const handleReactivateProduct = async () => {
    if (!product || !currentInventory) return;
    const confirmReactivation = window.confirm(
      `¿Confirmas reactivar la mercancía [REF: ${product.code}] "${product.name}" en el catálogo activo?`
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
        details: 'Producto reactivado en catálogo activo.',
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
      alert('Error reactivando el producto: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsReactivating(false);
    }
  };

  if (!isOpen || !product) return null;

  const photos = product.images && product.images.length > 0 ? product.images : [];
  const currentLocation = locations.find(l => l.id === product.location_id);
  const isInactive = product.status === 'INACTIVE' || product.status === 'WITHDRAWN';
  const isLowStock = !isInactive && product.stock <= (product.min_stock || 1);
  const totalItemValuation = (product.price || 0) * (product.stock || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-2xl w-full max-w-4xl my-auto overflow-hidden flex flex-col max-h-[94vh] shadow-xl">
        
        {/* =========================================================
            HEADER // AWWWARDS EDITORIAL STAMP
           ========================================================= */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E5E7EB] bg-white sticky top-0 z-20">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-[#1E3A5F] px-3 py-1 rounded-full border border-[#1E3A5F]/30 bg-[#F8F9FA]">
              REF // {product.code}
            </span>
            {isInactive ? (
              <span className="font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded-full bg-[#1E3A5F] text-white">
                ESTADO // RETIRADO
              </span>
            ) : isLowStock ? (
              <span className="font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded-full bg-[#ffdd00] text-black font-medium flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                ESTADO // STOCK CRÍTICO
              </span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded-full border border-[#E5E7EB] text-[#1E3A5F] bg-[#F8F9FA]">
                ESTADO // ACTIVO
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(product)}
              className="min-h-[38px] px-4 rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] text-[#1E3A5F] text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors bg-white shadow-sm"
              title="Modificar especificación técnica"
            >
              <Edit className="w-3.5 h-3.5 text-[#1E3A5F]" />
              <span className="hidden sm:inline">EDITAR</span>
            </button>
            <button
              onClick={onClose}
              className="min-h-[38px] min-w-[38px] rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] text-[#1E3A5F] flex items-center justify-center transition-colors bg-white shadow-sm"
              title="Cerrar ficha"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =========================================================
            BODY // 50/50 MODULAR SPLIT (MOBILE FIRST STACK)
           ========================================================= */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          
          {/* Alerta de Retiro / Inactividad */}
          {isInactive && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono uppercase tracking-wider">
              <div className="flex items-start sm:items-center gap-2 text-rose-800">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5 sm:mt-0" />
                <span>
                  MERCANCÍA DADA DE BAJA {product.withdrawal_reason ? `// MOTIVO: "${product.withdrawal_reason}"` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={handleReactivateProduct}
                disabled={isReactivating}
                className="shrink-0 min-h-[38px] px-5 bg-[#1E3A5F] hover:bg-[#152a45] text-white rounded-full flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {isReactivating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <RotateCcw className="w-3.5 h-3.5 text-[#E8B4A0]" />}
                <span>REACTIVAR ÍTEM</span>
              </button>
            </div>
          )}

          {/* Grilla Principal 50/50 Desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* COLUMNA IZQUIERDA: GALERÍA */}
            <div className="space-y-3">
              <div className="relative aspect-square sm:aspect-[4/3] bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl flex items-center justify-center overflow-hidden">
                {photos.length > 0 ? (
                  <img
                    src={photos[activePhotoIdx]}
                    alt={product.name}
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <div className="text-center p-6 font-mono text-[#616161]">
                    <Package className="w-12 h-12 stroke-[1] text-[#1E3A5F]/30 mx-auto mb-2" />
                    <p className="text-[10px] uppercase tracking-widest text-[#616161]">
                      SIN MUESTRA FOTOGRÁFICA REGISTRADA
                    </p>
                  </div>
                )}

                {/* Controles de navegación en galería */}
                {photos.length > 1 && (
                  <div className="absolute inset-x-2 bottom-2 flex items-center justify-between pointer-events-none">
                    <button
                      onClick={() => setActivePhotoIdx(prev => (prev > 0 ? prev - 1 : photos.length - 1))}
                      className="pointer-events-auto min-h-[36px] min-w-[36px] rounded-full bg-white/90 backdrop-blur-sm border border-[#E5E7EB] hover:bg-[#1E3A5F] hover:text-white text-[#1E3A5F] flex items-center justify-center transition-all shadow-sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-[10px] px-3 py-1 rounded-full bg-[#1E3A5F] text-white">
                      {activePhotoIdx + 1} / {photos.length}
                    </span>
                    <button
                      onClick={() => setActivePhotoIdx(prev => (prev < photos.length - 1 ? prev + 1 : 0))}
                      className="pointer-events-auto min-h-[36px] min-w-[36px] rounded-full bg-white/90 backdrop-blur-sm border border-[#E5E7EB] hover:bg-[#1E3A5F] hover:text-white text-[#1E3A5F] flex items-center justify-center transition-all shadow-sm"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Thumbnails en Píldora / Hairline */}
              {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                  {photos.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePhotoIdx(i)}
                      className={`w-16 h-16 rounded-xl border flex-shrink-0 transition-all p-0.5 bg-white overflow-hidden ${
                        activePhotoIdx === i
                          ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20'
                          : 'border-[#E5E7EB] opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Muestra ${i + 1}`} className="w-full h-full object-cover rounded-lg" />
                    </button>
                  ))}
                </div>
              )}

              {/* Código de Identificación */}
              <div className="border border-[#E5E7EB] rounded-xl p-3 bg-[#F8F9FA] font-mono text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#616161] uppercase tracking-wider block">
                    CÓDIGO DE IDENTIFICACIÓN
                  </span>
                  <span className="text-[#1E3A5F] font-semibold uppercase tracking-wider">{product.code}</span>
                </div>
                <span className="text-[9px] uppercase px-2.5 py-0.5 rounded-full border border-[#E8B4A0] bg-[#E8B4A0]/20 text-[#1E3A5F]">
                  AWWWARDS STANDARD
                </span>
              </div>
            </div>

            {/* COLUMNA DERECHA: ESPECIFICACIONES TÉCNICAS */}
            <div className="space-y-5">
              <div>
                <p className="font-mono text-[10px] text-[#E8B4A0] uppercase tracking-[0.2em] mb-1 font-medium">
                  FICHA TÉCNICA // {product.categories?.name || 'MERCANCÍA GENERAL'}
                </p>
                <h2 className="text-xl sm:text-2xl font-light uppercase tracking-tight text-[#1E3A5F]">
                  {product.name}
                </h2>
                {product.description && (
                  <p className="text-xs text-[#616161] mt-2 font-light leading-relaxed uppercase border-l-2 border-[#E8B4A0] pl-3 py-0.5">
                    {product.description}
                  </p>
                )}
              </div>

              {/* Matriz de Parámetros Técnicos */}
              <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden divide-y divide-[#E5E7EB] font-mono text-xs shadow-sm">
                
                {/* Precio Unitario */}
                <div className="p-3.5 flex items-center justify-between bg-white">
                  <span className="text-[10px] text-[#616161] uppercase tracking-wider">
                    PRECIO UNITARIO DE SALIDA
                  </span>
                  <span className="text-base sm:text-lg font-light tabular-nums text-[#1E3A5F]">
                    {formatCurrency(product.price, currentInventory?.currency)}
                  </span>
                </div>

                {/* Stock Actual y Alerta */}
                <div className="p-3.5 flex items-center justify-between bg-white">
                  <span className="text-[10px] text-[#616161] uppercase tracking-wider">
                    VOLUMEN EN ALMACÉN
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-light tabular-nums text-[#1E3A5F]">
                      {product.stock} <span className="text-xs text-[#616161]">UDS</span>
                    </span>
                    <span className="text-[10px] text-[#616161] uppercase">
                      (MÍN: {product.min_stock || 1})
                    </span>
                  </div>
                </div>

                {/* Valuación Total del Ítem */}
                <div className="p-3.5 flex items-center justify-between bg-white">
                  <span className="text-[10px] text-[#616161] uppercase tracking-wider">
                    VALOR TOTAL DE EXISTENCIAS
                  </span>
                  <span className="text-sm font-light tabular-nums text-[#1E3A5F]">
                    {formatCurrency(totalItemValuation, currentInventory?.currency)}
                  </span>
                </div>

                {/* Ubicación Física */}
                <div className="p-3.5 flex items-center justify-between bg-white">
                  <span className="text-[10px] text-[#616161] uppercase tracking-wider">
                    UBICACIÓN FÍSICA // RACK
                  </span>
                  <span className="text-[#1E3A5F] uppercase flex items-center gap-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    {currentLocation?.name || 'SIN UBICACIÓN ASIGNADA'}
                    {currentLocation?.code && ` [${currentLocation.code}]`}
                  </span>
                </div>

                {/* Categoría y Subcategoría */}
                <div className="p-3.5 flex items-center justify-between bg-white">
                  <span className="text-[10px] text-[#616161] uppercase tracking-wider">
                    CLASIFICACIÓN TÉCNICA
                  </span>
                  <span className="text-[#1E3A5F] uppercase">
                    {product.categories?.name || 'GENERAL'}
                    {product.subcategories?.name && ` // ${product.subcategories.name}`}
                  </span>
                </div>
              </div>

              {/* Botones de Acción Operativa */}
              <div className="space-y-2 pt-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => onMove(product)}
                    className="flex-1 min-h-[44px] px-5 rounded-full border border-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white text-[#1E3A5F] text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>TRASLADAR UBICACIÓN</span>
                  </button>

                  {!isInactive ? (
                    <button
                      onClick={() => onWithdraw(product)}
                      className="flex-1 min-h-[44px] px-5 rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] text-[#616161] hover:text-[#1E3A5F] text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-white shadow-sm"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>DAR DE BAJA (INACTIVAR)</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleReactivateProduct}
                      disabled={isReactivating}
                      className="flex-1 min-h-[44px] px-5 rounded-full bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm"
                    >
                      {isReactivating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      <span>REACTIVAR MERCANCÍA</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* =========================================================
              VARIACIONES ASOCIADAS (SI APLICA)
             ========================================================= */}
          {relatedVariants.length > 0 && (
            <div className="border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 space-y-3 bg-[#ffffff] shadow-sm">
              <div className="flex items-center justify-between font-mono">
                <span className="text-xs uppercase tracking-wider text-[#1E3A5F] flex items-center gap-1.5 font-medium">
                  <GitBranch className="w-4 h-4 text-[#1E3A5F]" />
                  VARIANTES REGISTRADAS DE LA FAMILIA ({relatedVariants.length})
                </span>
                <span className="text-[10px] text-[#616161] uppercase">TOCA PARA CAMBIAR DE FICHA</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
                {relatedVariants.map((v) => {
                  const vInactive = v.status === 'INACTIVE' || v.status === 'WITHDRAWN';
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onSelectProduct?.(v)}
                      className="p-3 border border-[#E5E7EB] hover:border-[#1E3A5F] rounded-xl bg-white hover:bg-[#F8F9FA] text-left transition-all active:scale-[0.98] flex items-center justify-between group shadow-sm"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs uppercase tracking-wide text-[#1E3A5F] group-hover:underline truncate font-medium">
                          {v.name}
                        </p>
                        <span className="text-[10px] text-[#616161] uppercase tracking-wider block mt-0.5">
                          REF: {v.code}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-light tabular-nums text-[#1E3A5F] block">
                          {formatCurrency(v.price, currentInventory?.currency)}
                        </span>
                        <span className={`text-[10px] ${vInactive ? 'text-[#616161]' : v.stock <= (v.min_stock || 1) ? 'text-black bg-[#ffdd00] px-2 py-0.5 rounded-full font-medium' : 'text-[#1E3A5F]'}`}>
                          {vInactive ? 'BAJA' : `${v.stock} UDS`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================================
              TRAZABILIDAD // AUDIT LOG SHEET
             ========================================================= */}
          <div className="border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 space-y-3 bg-[#ffffff] shadow-sm">
            <div className="flex items-center justify-between font-mono">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#1E3A5F]" />
                <h4 className="text-xs uppercase tracking-wider text-[#1E3A5F] font-medium">
                  MANIFIESTO DE TRAZABILIDAD & AUDITORÍA
                </h4>
              </div>
              <span className="text-[10px] text-[#616161] uppercase">
                {auditLogs.length} REGISTROS
              </span>
            </div>

            {/* Metadato de Última Modificación */}
            <div className="p-3 border border-[#E5E7EB] rounded-xl bg-[#F8F9FA] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono">
              <div className="flex items-center gap-2 text-[#1E3A5F]">
                <User className="w-3.5 h-3.5 text-[#1E3A5F]" />
                <span>ÚLTIMA MODIFICACIÓN: {product.last_modified_by_email || 'SISTEMA'}</span>
              </div>
              <span className="text-[10px] text-[#616161] flex items-center gap-1 uppercase">
                <Clock className="w-3 h-3" /> {formatDate(product.updated_at)}
              </span>
            </div>

            {/* Historial en Lista */}
            <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-xl bg-white font-mono text-xs">
              {loadingAudit ? (
                <div className="text-center py-6 text-xs text-[#616161] uppercase">
                  CARGANDO HISTORIAL TÉCNICO...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#616161] uppercase">
                  SIN EVENTOS REGISTRADOS EN AUDITORÍA
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3 hover:bg-[#F8F9FA] transition-colors space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#1E3A5F] uppercase tracking-wider text-[11px]">
                        [{log.action_type}]
                      </span>
                      <span className="text-[10px] text-[#616161]">{formatDate(log.created_at)}</span>
                    </div>
                    <p className="text-[#1E3A5F] text-[11px] uppercase">{log.details}</p>
                    <div className="text-[10px] text-[#616161] uppercase">
                      USUARIO: {log.user_email}
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
