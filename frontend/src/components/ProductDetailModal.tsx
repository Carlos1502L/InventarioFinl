import React, { useState, useEffect } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { Product, AuditLog, Location } from '../types/database';
import { supabase, formatCurrency, formatDate } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onMove: (product: Product) => void;
  onWithdraw: (product: Product) => void;
  locations: Location[];
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onEdit,
  onMove,
  onWithdraw,
  locations
}) => {
  const { currentInventory } = useAuth();
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

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

  if (!isOpen || !product) return null;

  const photos = product.images && product.images.length > 0 ? product.images : [];
  const currentLocation = locations.find(l => l.id === product.location_id);
  const isLowStock = product.stock <= (product.min_stock || 5);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl my-auto overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-blue-400 font-semibold">
              {product.code}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              product.status === 'ACTIVE'
                ? isLowStock ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              {product.status === 'ACTIVE' ? (isLowStock ? 'Bajo Stock' : 'Activo') : 'Retirado'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onEdit(product)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Editar Producto"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido Principal con Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* 1. Galería de Fotos (Hasta 3 fotos) */}
          {photos.length > 0 ? (
            <div className="space-y-2">
              <div className="relative aspect-video sm:aspect-[2/1] rounded-2xl overflow-hidden bg-black/60 border border-slate-800">
                <img
                  src={photos[activePhotoIdx]}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : photos.length - 1))}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setActivePhotoIdx((prev) => (prev < photos.length - 1 ? prev + 1 : 0))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition-all"
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
                      className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        activePhotoIdx === i ? 'border-blue-500 scale-105' : 'border-slate-800 opacity-60'
                      }`}
                    >
                      <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-28 rounded-2xl bg-slate-800/40 border border-dashed border-slate-700/60 flex flex-col items-center justify-center text-slate-500">
              <Package className="w-8 h-8 mb-1 opacity-50" />
              <span className="text-xs">Sin fotografías registradas</span>
            </div>
          )}

          {/* 2. Título, Descripción y Precios */}
          <div>
            <h2 className="text-xl font-extrabold text-white">{product.name}</h2>
            {product.description && (
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                {product.description}
              </p>
            )}
          </div>

          {/* 3. Métricas Destacadas (Precio, Stock, Ubicación) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Precio
              </div>
              <p className="text-base font-extrabold text-white">
                {formatCurrency(product.price, currentInventory?.currency)}
              </p>
            </div>

            <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Package className="w-3.5 h-3.5 text-blue-400" /> Stock Actual
              </div>
              <p className={`text-base font-extrabold ${isLowStock ? 'text-amber-400' : 'text-white'}`}>
                {product.stock} <span className="text-xs font-normal text-slate-400">uds (mín: {product.min_stock})</span>
              </p>
            </div>

            <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-xl col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" /> Ubicación
              </div>
              <p className="text-sm font-bold text-white truncate">
                {currentLocation?.name || 'No asignada'}
              </p>
              <p className="text-[10px] font-mono text-slate-400">{currentLocation?.code}</p>
            </div>
          </div>

          {/* Categoría y Subcategoría */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800 text-slate-300 rounded-lg border border-slate-700">
              <Tag className="w-3 h-3 text-blue-400" />
              Categoría: <strong>{product.categories?.name || 'General'}</strong>
            </span>
            {product.subcategories?.name && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800 text-slate-300 rounded-lg border border-slate-700">
                Subcategoría: <strong>{product.subcategories.name}</strong>
              </span>
            )}
          </div>

          {/* 4. Botones de Acción Operativa */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 flex flex-wrap gap-2.5">
            <button
              onClick={() => onMove(product)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition-all active:scale-95"
            >
              <ArrowRightLeft className="w-4 h-4" /> Mover de Ubicación
            </button>
            <button
              onClick={() => onWithdraw(product)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all active:scale-95"
            >
              <Archive className="w-4 h-4" /> Retirar / Dar de baja
            </button>
          </div>

          {/* 5. Trazabilidad e Historial de Auditoría (Exigido en los requerimientos) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-400" />
                <h4 className="text-sm font-bold text-white">Trazabilidad e Historial</h4>
              </div>
              <span className="text-[11px] text-slate-400">{auditLogs.length} eventos</span>
            </div>

            {/* Etiqueta de Última Modificación */}
            <div className="p-3 bg-blue-950/30 border border-blue-900/50 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-300">
                  Modificado por: <strong className="text-blue-300">{product.last_modified_by_email || 'Sistema'}</strong>
                </span>
              </div>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatDate(product.updated_at)}
              </span>
            </div>

            {/* Lista cronológica de cambios */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {loadingAudit ? (
                <div className="text-center py-4 text-xs text-slate-500">Cargando trazabilidad...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500">No hay registros de auditoría anteriores</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{log.action_type}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(log.created_at)}</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{log.details}</p>
                    <div className="text-[10px] text-slate-500">
                      Por: <span className="text-slate-400">{log.user_email}</span>
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
