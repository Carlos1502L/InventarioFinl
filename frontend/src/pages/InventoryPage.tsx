import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  Camera,
  Grid,
  List,
  MapPin,
  Package,
  RefreshCw,
  SlidersHorizontal,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  PackageMinus,
  History
} from 'lucide-react';
import { Product, Category, Subcategory, Location } from '../types/database';
import {
  formatCurrency,
  formatStockDisplay,
  getBoxBreakdown,
  getPendingLocationStock,
  getProductLocationBadgeLabel
} from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { BarcodeScannerModal } from '../components/modals/BarcodeScannerModal';
import { RestockProductModal } from '../components/modals/RestockProductModal';
import { BulkWithdrawModal } from '../components/modals/BulkWithdrawModal';
import { ProductAuditModal } from '../components/modals/ProductAuditModal';
import { MinimalDropdown } from '../components/ui/MinimalDropdown';
import { ProductTableSkeleton } from '../components/ui/Skeleton';
import { LocationSubTab } from './LocationsPage';
import { matchesAnyField, normalizeText } from '../utils/searchUtils';

interface InventoryPageProps {
  products: Product[];
  categories: Category[];
  subcategories: Subcategory[];
  locations: Location[];
  onSelectProduct: (product: Product) => void;
  onOpenCreateModal: () => void;
  onOpenLocationsModule?: (subTab?: LocationSubTab, product?: Product) => void;
  onRefresh: () => void;
  onBulkWithdrawn?: (withdrawnItems: Array<{ product_id: string; quantity: number }>) => void;
  loading: boolean;
  initialSearchTerm?: string;
  onClearInitialSearch?: () => void;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({
  products,
  categories,
  subcategories,
  locations,
  onSelectProduct,
  onOpenCreateModal,
  onOpenLocationsModule,
  onRefresh,
  onBulkWithdrawn,
  loading,
  initialSearchTerm,
  onClearInitialSearch
}) => {
  const { currentInventory } = useAuth();

  // Modal de Salida Masiva (Multi-Withdraw)
  const [bulkWithdrawOpen, setBulkWithdrawOpen] = useState(false);
  // Modal de Auditoría y Trazabilidad (RF-AUDIT-015)
  const [auditModalOpen, setAuditModalOpen] = useState(false);

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');

  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
      setCurrentPage(1);
      onClearInitialSearch?.();
    }
  }, [initialSearchTerm, onClearInitialSearch]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Paginación técnica
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = viewMode === 'grid' ? 12 : 16;

  // Escáner de Búsqueda Rápida y Reingreso de Stock
  const [searchScannerOpen, setSearchScannerOpen] = useState(false);
  const [restockTargetProduct, setRestockTargetProduct] = useState<Product | null>(null);

  // Subcategorías según categoría activa
  const activeSubcategories = useMemo(() => {
    if (selectedCategory === 'ALL') return [];
    return subcategories.filter(s => s.category_id === selectedCategory);
  }, [selectedCategory, subcategories]);

  // Detección de filtros activos
  const hasActiveFilters = useMemo(() => {
    return Boolean(
      searchTerm.trim() ||
      selectedCategory !== 'ALL' ||
      selectedSubcategory !== 'ALL' ||
      selectedLocation !== 'ALL' ||
      selectedStatus !== 'ACTIVE'
    );
  }, [searchTerm, selectedCategory, selectedSubcategory, selectedLocation, selectedStatus]);

  // Reiniciar filtros
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('ALL');
    setSelectedSubcategory('ALL');
    setSelectedLocation('ALL');
    setSelectedStatus('ACTIVE');
    setCurrentPage(1);
  };

  // Filtrado reactivo (RF-SEARCH-016: Tolerancia estricta a diacríticos y acentos)
  const filteredProducts = useMemo(() => {
    const normTerm = normalizeText(searchTerm);
    return products.filter((prod) => {
      const matchSearch =
        !normTerm ||
        matchesAnyField(
          [prod.name, prod.code, (prod as any).sku, prod.description],
          normTerm
        );

      const matchCategory =
        selectedCategory === 'ALL' || prod.category_id === selectedCategory;

      const matchSubcategory =
        selectedSubcategory === 'ALL' || prod.subcategory_id === selectedSubcategory;

      const matchLocation =
        selectedLocation === 'ALL'
          ? true
          : selectedLocation === 'UNASSIGNED'
            ? getPendingLocationStock(prod) > 0.0001
            : (prod.product_locations || []).some(
                pl => pl.location_id === selectedLocation && Number(pl.quantity || 0) > 0
              );

      const isProductInactive = prod.status === 'INACTIVE' || prod.status === 'WITHDRAWN';
      const matchStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'ACTIVE' && prod.status === 'ACTIVE') ||
        (selectedStatus === 'INACTIVE' && isProductInactive);

      return matchSearch && matchCategory && matchSubcategory && matchLocation && matchStatus;
    });
  }, [products, searchTerm, selectedCategory, selectedSubcategory, selectedLocation, selectedStatus]);

  // Paginación
  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredProducts.slice(startIdx, startIdx + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Reset de página si la longitud cambia
  useMemo(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredProducts.length, totalPages, currentPage]);

  const handleBarcodeSearch = (scannedCode: string) => {
    const clean = scannedCode.trim();
    setSearchTerm(clean);
    setCurrentPage(1);
    setSearchScannerOpen(false);
  };

  const totalStockValue = useMemo(() => {
    return products.reduce((sum, p) => sum + Number(p.price || 0) * Number(p.stock || 0), 0);
  }, [products]);

  return (
    <>
      {/* =========================================================
          VISTA MÓVIL ULTRA MINIMALISTA (< 768px / md:hidden)
         ========================================================= */}
      <div className="md:hidden fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col overflow-hidden bg-white text-neutral-900">
        
        {/* CAPA 1: Header Oscuro Principal (Fijo / shrink-0) */}
        <header className="shrink-0 bg-neutral-950 text-white rounded-b-[2.5rem] z-20 select-none px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Catálogo de Stock
            </h1>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setAuditModalOpen(true)}
                aria-label="Auditoría y Trazabilidad"
                title="Historial de Auditoría"
                className="w-10 h-10 rounded-full border border-neutral-700/80 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-200 flex items-center justify-center transition-colors active:scale-95"
              >
                <History className="w-4 h-4 stroke-[1.75]" />
              </button>
              <button
                type="button"
                onClick={() => setBulkWithdrawOpen(true)}
                aria-label="Salida de mercadería en lote"
                title="Salida de mercadería en lote"
                className="w-10 h-10 rounded-full border border-neutral-700/80 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-200 flex items-center justify-center transition-colors active:scale-95"
              >
                <PackageMinus className="w-4 h-4 stroke-[1.75]" />
              </button>
              <button
                type="button"
                onClick={onOpenCreateModal}
                aria-label="Nuevo producto"
                title="Crear Producto"
                className="w-10 h-10 rounded-full bg-neutral-800/70 hover:bg-neutral-800 text-neutral-200 flex items-center justify-center transition-colors active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[1.75]" />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <span className="text-xs text-neutral-400 block">
              Valorización de Catálogo
            </span>
            <div className="flex items-baseline justify-between gap-3 mt-1">
              <p className="text-3xl font-semibold tracking-tight text-white tabular-nums">
                {formatCurrency(totalStockValue, currentInventory?.currency)}
              </p>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-800/80 text-neutral-300 text-xs font-medium tabular-nums">
                {products.length} Referencias
              </span>
            </div>
          </div>
        </header>

        {/* CAPA 2: Contenedor Blanco Global (flex-1 flex flex-col overflow-hidden) */}
        <section className="flex-1 min-h-0 w-full bg-white flex flex-col overflow-hidden">
          
          {/* SUB-CAPA 2A: Barra Fija de Herramientas (NUNCA SE MUEVE NI HACE SCROLL) */}
          <div className="shrink-0 w-full bg-white px-5 pt-4 pb-2.5 space-y-3">
            {/* Buscador plano con botón de cámara fuera a la derecha */}
            <div className="flex items-center gap-2.5">
              <div className="flex-1 min-w-0 flex items-center gap-3 bg-neutral-50 border border-neutral-200/60 rounded-2xl px-4 py-3.5 focus-within:border-neutral-950 focus-within:bg-white transition-all">
                <Search className="w-5 h-5 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Buscar producto, SKU o categoría..."
                  className="w-full bg-transparent border-0 outline-none ring-0 p-0 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                    className="text-xs text-neutral-400 hover:text-neutral-900 px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSearchScannerOpen(true)}
                aria-label="Escanear código para buscar"
                title="Escanear código"
                className="w-12 h-12 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-2xl text-white active:scale-95 transition-all shrink-0 shadow-sm"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Filtro rápido de categorías en píldoras suaves */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('ALL');
                    setSelectedSubcategory('ALL');
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === 'ALL'
                      ? 'bg-neutral-950 text-white'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  Todos ({products.length})
                </button>
                {categories.map((c) => {
                  const count = products.filter((p) => p.category_id === c.id).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(c.id);
                        setSelectedSubcategory('ALL');
                        setCurrentPage(1);
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === c.id
                          ? 'bg-neutral-950 text-white'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {c.name} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* SUB-CAPA 2B: Contenedor de Datos con Scroll Aislado */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 divide-y divide-neutral-100 pb-28">
            {loading && products.length === 0 ? (
              <ProductTableSkeleton />
            ) : filteredProducts.length === 0 ? (
              <p className="py-12 text-center text-xs text-neutral-400">
                No se encontraron productos en el catálogo.
              </p>
            ) : (
              paginatedProducts.map((prod) => {
                const minThreshold =
                  prod.min_stock !== undefined && prod.min_stock !== null ? prod.min_stock : 1;
                const isLow = prod.status === 'ACTIVE' && prod.stock < minThreshold;

                return (
                  <div
                    key={prod.id}
                    onClick={() => onSelectProduct(prod)}
                    className="py-4 flex items-center justify-between gap-3 cursor-pointer active:opacity-70 transition-opacity"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900 truncate">
                        {prod.name}
                      </p>
                      <p className="text-xs text-neutral-400 truncate mt-0.5">
                        {prod.code} · {prod.categories?.name || 'General'}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                          isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-neutral-100 text-neutral-900'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isLow ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />
                        {formatStockDisplay(prod)}
                      </span>
                      <span className="text-xs text-neutral-400 tabular-nums">
                        {formatCurrency(prod.price, currentInventory?.currency)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {/* Paginación móvil limpia */}
            {totalPages > 1 && (
              <div className="pt-4 flex items-center justify-between text-xs text-neutral-500 border-t-0">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-full bg-neutral-100 text-neutral-800 font-medium disabled:opacity-30"
                >
                  Anterior
                </button>
                <span className="tabular-nums">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-full bg-neutral-100 text-neutral-800 font-medium disabled:opacity-30"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* =========================================================
          VISTA DE ESCRITORIO (>= 768px / hidden md:block) - Ui CLINICAL BLUEPRINT
         ========================================================= */}
      <div className="hidden md:block space-y-5 pb-28 lg:pb-16 max-w-[1440px] mx-auto text-slate-900 font-sans">
      
      {/* =========================================================
          1. ENCABEZADO DE STOCK (Sin eyebrow, jerarquía directa)
         ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-[-0.03em]">
            Existencias y productos
          </h1>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {filteredProducts.length} de {products.length} referencias activas en el catálogo actual
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setAuditModalOpen(true)}
            aria-label="Auditoría y Trazabilidad"
            title="Historial de Auditoría"
            className="min-h-[38px] px-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] cursor-pointer"
          >
            <History className="w-4 h-4 stroke-[1.8]" />
            <span className="hidden sm:inline">Auditoría</span>
          </button>

          <button
            onClick={onRefresh}
            className="min-h-[38px] px-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] cursor-pointer"
            title="Sincronizar existencias"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setBulkWithdrawOpen(true)}
            aria-label="Salida de mercadería en lote"
            title="Salida de mercadería en lote"
            className="min-h-[38px] px-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] cursor-pointer"
          >
            <PackageMinus className="w-4 h-4 stroke-[1.8]" />
            <span className="hidden sm:inline">Salida en lote</span>
          </button>

          <button
            onClick={onOpenCreateModal}
            className="flex-1 sm:flex-initial min-h-[38px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            <span>Nuevo producto</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          2. BARRA DE BÚSQUEDA Y CONTROLES DIRECTOS
         ========================================================= */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
          {/* Input de Búsqueda */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por nombre, SKU, código de barras o categoría..."
              className="w-full min-h-[40px] bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-900 rounded-xl pl-10 pr-9 py-2 text-xs text-slate-900 placeholder-slate-400 transition-[border-color,box-shadow] duration-150 outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-900 min-w-[24px] min-h-[24px] flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Controles de Toolbar */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            {/* Escáner de Cámara */}
            <button
              onClick={() => setSearchScannerOpen(true)}
              className="flex-1 sm:flex-initial min-h-[40px] px-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 flex items-center justify-center gap-2 text-xs font-medium transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] cursor-pointer"
              title="Escanear código de barras o QR"
            >
              <Camera className="w-4 h-4 stroke-[1.8] text-slate-700" />
              <span>Escanear</span>
            </button>

            {/* Toggle de Filtros */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-1 sm:flex-initial min-h-[40px] px-3.5 rounded-xl transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] flex items-center justify-center gap-2 text-xs font-medium cursor-pointer ${
                showFilters || hasActiveFilters
                  ? 'bg-slate-900 text-white border border-slate-900'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300'
              }`}
              title="Desplegar filtros técnicos"
            >
              <SlidersHorizontal className="w-4 h-4 stroke-[1.8]" />
              <span>Filtros</span>
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            {/* Selector de Vista */}
            <div className="flex items-center rounded-xl p-1 bg-slate-100 border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`min-h-[30px] px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-[background-color,color] duration-150 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Vista en Retícula"
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-[11px]">Retícula</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`min-h-[30px] px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-[background-color,color] duration-150 cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Vista en Lista"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-[11px]">Lista</span>
              </button>
            </div>
          </div>
        </div>

        {/* Chips de Categorías */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => {
                setSelectedCategory('ALL');
                setSelectedSubcategory('ALL');
                setCurrentPage(1);
              }}
              className={`min-h-[32px] px-3.5 rounded-lg text-xs font-medium whitespace-nowrap transition-[background-color,border-color,color] duration-150 cursor-pointer tabular-nums ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white border border-slate-900'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              Todas ({products.length})
            </button>
            {categories.map(c => {
              const count = products.filter(p => p.category_id === c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCategory(c.id);
                    setSelectedSubcategory('ALL');
                    setCurrentPage(1);
                  }}
                  className={`min-h-[32px] px-3.5 rounded-lg text-xs font-medium whitespace-nowrap transition-[background-color,border-color,color] duration-150 cursor-pointer tabular-nums ${
                    selectedCategory === c.id
                      ? 'bg-slate-900 text-white border border-slate-900'
                      : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {c.name} <span className="opacity-65 ml-0.5">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Panel Desplegable de Filtros */}
        {showFilters && (
          <div className="p-5 bg-white border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shadow-ui-card">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Categoría principal
              </label>
              <MinimalDropdown
                value={selectedCategory}
                onChange={(val) => {
                  setSelectedCategory(val);
                  setSelectedSubcategory('ALL');
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'Todas las Categorías' },
                  ...categories.map((c) => ({ value: c.id, label: c.name }))
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Subcategoría
              </label>
              <MinimalDropdown
                value={selectedSubcategory}
                onChange={(val) => {
                  setSelectedSubcategory(val);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'Todas las Subcategorías' },
                  ...activeSubcategories.map((s) => ({ value: s.id, label: s.name }))
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Ubicación física
              </label>
              <MinimalDropdown
                value={selectedLocation}
                onChange={(val) => {
                  setSelectedLocation(val);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'Todas las Ubicaciones' },
                  { value: 'UNASSIGNED', label: 'Sin ubicación asignada (En Recepción)' },
                  ...locations.map((l) => ({ value: l.id, label: l.name, badge: l.code }))
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Estado
              </label>
              <MinimalDropdown
                value={selectedStatus}
                onChange={(val) => {
                  setSelectedStatus(val);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'Todos los Estados' },
                  { value: 'ACTIVE', label: 'Activos (En venta/uso)' },
                  { value: 'INACTIVE', label: 'Retirados / Inactivos' }
                ]}
              />
            </div>
          </div>
        )}

        {/* Resumen de resultados y Reset */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs text-slate-500 px-0.5">
            <span>
              Filtro aplicado: <strong className="text-slate-900 font-semibold tabular-nums">{filteredProducts.length}</strong> coincidencias
            </span>
            <button
              onClick={handleClearFilters}
              className="min-h-[30px] px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reiniciar filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* =========================================================
          3. MATRIZ DE PRODUCTOS (GRID / LIST INDUSTRIAL)
         ========================================================= */}
      {loading && products.length === 0 ? (
        <ProductTableSkeleton />
      ) : filteredProducts.length === 0 ? (
        <div className="border border-slate-200 bg-white rounded-2xl p-14 text-center space-y-4 shadow-ui-card">
          <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-xl mx-auto flex items-center justify-center">
            <Package className="w-5 h-5 stroke-[1.5] text-slate-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Sin registros en el catálogo
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {hasActiveFilters
                ? 'Ningún producto coincide con los parámetros de búsqueda o filtros seleccionados.'
                : 'No existen existencias registradas en este depósito.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2.5 pt-2">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="min-h-[38px] px-4 rounded-xl bg-white hover:bg-slate-50 text-xs font-medium text-slate-900 border border-slate-200 transition-colors cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
            <button
              onClick={onOpenCreateModal}
              className="min-h-[38px] px-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Registrar producto
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* VISTA RETÍCULA EN TARJETAS INDUSTRIALES (rounded-2xl) */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {paginatedProducts.map(product => {
            const isLow = product.stock < (product.min_stock !== undefined && product.min_stock !== null ? product.min_stock : 1);
            const isInactive = product.status !== 'ACTIVE';
            const mainPhoto = product.images?.[0];
            const isBox = product.unit_type === 'BOX';

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="bg-white border border-slate-200 rounded-2xl p-4 desktop-hover-lift cursor-pointer group flex flex-col justify-between shadow-ui-card"
              >
                {/* Cabecera del Ítem */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-slate-500 truncate">
                        {product.code}
                      </span>
                      <span className={`font-mono text-[9px] font-semibold px-1.5 py-px rounded border ${
                        isBox
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200/80'
                      }`}>
                        {isBox ? 'BOX' : 'UNIT'}
                      </span>
                    </div>
                    <h3 title={product.name} className="text-sm font-semibold text-slate-900 truncate group-hover:text-slate-700 mt-1">
                      {product.name}
                    </h3>
                  </div>

                  {/* Badge de Stock Semántico */}
                  <div className="flex-shrink-0 text-right">
                    {isInactive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        Retirado
                      </span>
                    ) : isLow ? (
                      <span
                        title={getBoxBreakdown(product).breakdownLabel || undefined}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums bg-red-50 text-red-700 border border-red-200"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block" />
                        {formatStockDisplay(product)}
                      </span>
                    ) : (
                      <span
                        title={getBoxBreakdown(product).breakdownLabel || undefined}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums bg-emerald-50 text-emerald-700 border border-emerald-200"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        {formatStockDisplay(product)}
                      </span>
                    )}
                    {isBox && getBoxBreakdown(product).breakdownLabel && (
                      <span className="block font-mono text-[10px] text-slate-500 mt-0.5 tabular-nums">
                        {getBoxBreakdown(product).breakdownLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fotografía de Producto */}
                <div className="aspect-square bg-slate-50 rounded-xl border border-slate-200/80 relative overflow-hidden flex items-center justify-center my-1.5">
                  {mainPhoto ? (
                    <img
                      src={mainPhoto}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] md:group-hover:scale-[1.03]"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <Package className="w-8 h-8 stroke-[1.2] text-slate-300 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-400">
                        Sin foto
                      </span>
                    </div>
                  )}

                  {product.is_variant && (
                    <div className="absolute top-2 left-2">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-900/90 text-white flex items-center gap-1 shadow-xs">
                        <GitBranch className="w-2.5 h-2.5" /> Variante
                      </span>
                    </div>
                  )}
                </div>

                {/* Pie con Metadatos */}
                <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <span className="text-[11px] text-slate-600 font-medium block truncate">
                      {getProductLocationBadgeLabel(product)}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {product.categories?.name || 'General'}
                    </span>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-semibold tabular-nums text-slate-900 block">
                      {formatCurrency(product.price, currentInventory?.currency)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA MANIFIESTO EN TABLA DENSA CON CABECERA STICKY */
        <div className="border border-slate-200 bg-white rounded-2xl overflow-hidden shadow-ui-card">
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 text-[11px] font-semibold text-slate-500 sticky top-14 z-10">
            <div className="col-span-1">Foto</div>
            <div className="col-span-2">SKU / Formato</div>
            <div className="col-span-4">Descripción</div>
            <div className="col-span-2">Ubicación</div>
            <div className="col-span-1 text-right">Precio</div>
            <div className="col-span-1 text-right">Stock</div>
            <div className="col-span-1 text-center">Estado</div>
          </div>

          <div className="divide-y divide-slate-100">
            {paginatedProducts.map(product => {
              const isLow = product.stock < (product.min_stock !== undefined && product.min_stock !== null ? product.min_stock : 1);
              const isInactive = product.status !== 'ACTIVE';
              const mainPhoto = product.images?.[0];
              const isBox = product.unit_type === 'BOX';

              return (
                <div
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  className="px-4 py-3 hover:bg-slate-50 transition-colors duration-150 cursor-pointer group flex flex-col md:grid md:grid-cols-12 md:items-center gap-3 text-xs"
                >
                  <div className="col-span-1 flex items-center">
                    <div className="w-10 h-10 border border-slate-200 bg-slate-50 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {mainPhoto ? (
                        <img
                          src={mainPhoto}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <Package className="w-4 h-4 stroke-[1.2] text-slate-400" />
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 min-w-0">
                    <span className="font-mono text-xs text-slate-900 font-medium block truncate">
                      {product.code}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`font-mono text-[10px] px-1.5 py-px rounded border ${
                        isBox
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200/80'
                      }`}>
                        {isBox ? 'BOX' : 'UNIT'}
                      </span>
                      {product.is_variant && (
                        <span className="text-[10px] px-1.5 py-px rounded bg-slate-900 text-white font-medium">
                          Var
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-4 min-w-0">
                    <h4 title={product.name} className="text-xs sm:text-[13px] font-semibold text-slate-900 group-hover:text-slate-700 truncate">
                      {product.name}
                    </h4>
                    <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                      {product.categories?.name || 'General'} {product.subcategories?.name ? `· ${product.subcategories.name}` : ''}
                    </span>
                  </div>

                  <div className="col-span-2 text-xs text-slate-600 flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 stroke-[1.8] text-slate-400 flex-shrink-0" />
                    <span className="truncate">{getProductLocationBadgeLabel(product)}</span>
                  </div>

                  <div className="col-span-1 text-left md:text-right font-semibold text-xs sm:text-[13px] tabular-nums text-slate-900">
                    {formatCurrency(product.price, currentInventory?.currency)}
                  </div>

                  <div
                    className="col-span-1 text-left md:text-right font-semibold text-xs tabular-nums text-slate-900"
                    title={getBoxBreakdown(product).breakdownLabel || undefined}
                  >
                    <span className={isLow && !isInactive ? 'text-red-600' : 'text-slate-900'}>
                      {formatStockDisplay(product)}
                    </span>
                    {isBox && getBoxBreakdown(product).breakdownLabel && (
                      <span className="block font-mono text-[10px] text-slate-500 font-normal">
                        {getBoxBreakdown(product).breakdownLabel}
                      </span>
                    )}
                  </div>

                  <div className="col-span-1 flex md:justify-center">
                    {isInactive ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        Baja
                      </span>
                    ) : isLow ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                        Crítico
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Óptimo
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================
          4. PAGINACIÓN
         ========================================================= */}
      {totalPages > 1 && (
        <div className="border border-slate-200 bg-white rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-ui-card">
          <span className="text-slate-500 tabular-nums">
            Página <strong className="text-slate-900 font-semibold">{currentPage}</strong> de {totalPages}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="min-h-[34px] px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center transition-colors duration-150 cursor-pointer"
              title="Página Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              let pageNum = idx + 1;
              if (totalPages > 5 && currentPage > 3) {
                pageNum = currentPage - 2 + idx;
                if (pageNum > totalPages) pageNum = totalPages - (4 - idx);
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`min-h-[34px] min-w-[34px] rounded-lg text-xs font-mono font-medium tabular-nums transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.97] flex items-center justify-center cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-slate-900 text-white border border-slate-900'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="min-h-[34px] px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center transition-colors duration-150 cursor-pointer"
              title="Página Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      </div>

      {/* Escáner de Búsqueda Rápida */}
      <BarcodeScannerModal
        isOpen={searchScannerOpen}
        onClose={() => setSearchScannerOpen(false)}
        onScanSuccess={handleBarcodeSearch}
        title="ESCANEAR CÓDIGO // BÚSQUEDA RÁPIDA"
        instructions="Ubica el código de barras o QR de la mercancía frente al lente para indexar la ficha técnica."
      />

      {/* 3.2: Modal de Reingreso de Stock cuando se escanea un producto existente */}
      <RestockProductModal
        product={restockTargetProduct}
        isOpen={Boolean(restockTargetProduct)}
        onClose={() => setRestockTargetProduct(null)}
        onRestocked={onRefresh}
        onViewDetails={prod => {
          setRestockTargetProduct(null);
          onSelectProduct(prod);
        }}
      />
      {/* Modal de Salida Masiva de Mercadería (Multi-Withdraw) */}
      <BulkWithdrawModal
        isOpen={bulkWithdrawOpen}
        onClose={() => setBulkWithdrawOpen(false)}
        products={products}
        onWithdrawn={(items) => {
          if (onBulkWithdrawn) {
            onBulkWithdrawn(items);
          } else {
            onRefresh();
          }
        }}
      />

      {/* Modal de Auditoría Rápida & Kardex Centralizado (RF-AUDIT-015) */}
      <ProductAuditModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        products={products}
      />
    </>
  );
};

export default InventoryPage;
