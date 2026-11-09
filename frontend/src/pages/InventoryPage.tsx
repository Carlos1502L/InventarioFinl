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
      <div className="hidden md:block space-y-6 pb-28 lg:pb-16 max-w-[1440px] mx-auto text-[#0a0a0a]">
      
      {/* =========================================================
          1. ENCABEZADO DE STOCK
         ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
        <div>
          <span className="text-xs uppercase tracking-[0.05em] text-[#737373] font-medium block mb-1.5">
            Catálogo General
          </span>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#0a0a0a] tracking-[-0.04em]">
            Existencias y Productos
          </h1>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setAuditModalOpen(true)}
            aria-label="Auditoría y Trazabilidad"
            title="Historial de Auditoría"
            className="min-h-[40px] px-4 rounded-[18px] bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] border border-[#e5e5e5] text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <History className="w-4 h-4 stroke-[1.8]" />
            <span className="hidden sm:inline">Auditoría</span>
          </button>

          <button
            onClick={onRefresh}
            className="min-h-[40px] px-4 rounded-[18px] bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] border border-[#e5e5e5] text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
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
            className="min-h-[40px] px-4 rounded-[18px] bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] border border-[#e5e5e5] text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <PackageMinus className="w-4 h-4 stroke-[1.8]" />
            <span className="hidden sm:inline">Salida en lote</span>
          </button>

          <button
            onClick={onOpenCreateModal}
            className="flex-1 sm:flex-initial min-h-[40px] px-5 rounded-[18px] bg-[#0a0a0a] hover:bg-[#262626] text-[#fafafa] text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-ui-subtle cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            <span>Nuevo producto</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          2. BARRA DE BÚSQUEDA Y CONTROLES DIRECTOS
         ========================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          {/* Input de Búsqueda */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#737373] absolute left-4 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por nombre, SKU, serial o categoría..."
              className="w-full min-h-[42px] bg-[#f5f5f5] focus:bg-white border border-[#e5e5e5] focus:border-[#0a0a0a] rounded-[18px] pl-11 pr-10 py-2.5 text-xs text-[#0a0a0a] placeholder-[#737373] transition-all outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-4 top-3 text-xs text-[#737373] hover:text-[#0a0a0a] min-w-[24px] min-h-[24px] flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Botones de Control en Píldora */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            {/* Escáner de Cámara */}
            <button
              onClick={() => setSearchScannerOpen(true)}
              className="flex-1 sm:flex-initial min-h-[42px] px-4 rounded-[18px] bg-[#f5f5f5] hover:bg-[#ebebeb] border border-[#e5e5e5] text-[#0a0a0a] flex items-center justify-center gap-2 text-xs font-medium transition-all active:scale-95 cursor-pointer"
              title="Escanear código de barras o QR"
            >
              <Camera className="w-4 h-4 stroke-[1.8] text-[#0a0a0a]" />
              <span>Escanear</span>
            </button>

            {/* Toggle de Filtros */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-1 sm:flex-initial min-h-[42px] px-4 rounded-[18px] transition-all flex items-center justify-center gap-2 text-xs font-medium cursor-pointer ${
                showFilters || hasActiveFilters
                  ? 'bg-[#0a0a0a] text-[#fafafa] border border-[#0a0a0a] shadow-ui-subtle'
                  : 'bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] border border-[#e5e5e5]'
              }`}
              title="Desplegar filtros técnicos"
            >
              <SlidersHorizontal className="w-4 h-4 stroke-[1.8]" />
              <span>Filtros</span>
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#fafafa]" />
              )}
            </button>

            {/* Selector de Vista */}
            <div className="flex items-center rounded-[18px] p-1 bg-[#f5f5f5] border border-[#e5e5e5]">
              <button
                onClick={() => setViewMode('grid')}
                className={`min-h-[32px] px-3 rounded-[14px] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-[#0a0a0a] shadow-xs'
                    : 'text-[#737373] hover:text-[#0a0a0a]'
                }`}
                title="Vista en Retícula"
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-[11px]">Retícula</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`min-h-[32px] px-3 rounded-[14px] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-[#0a0a0a] shadow-xs'
                    : 'text-[#737373] hover:text-[#0a0a0a]'
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
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => {
                setSelectedCategory('ALL');
                setSelectedSubcategory('ALL');
                setCurrentPage(1);
              }}
              className={`min-h-[34px] px-4 rounded-[18px] text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-[#0a0a0a] text-[#fafafa] border border-[#0a0a0a] shadow-ui-subtle'
                  : 'bg-[#f5f5f5] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#ebebeb] border border-[#e5e5e5]'
              }`}
            >
              Todas las categorías ({products.length})
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
                  className={`min-h-[34px] px-4 rounded-[18px] text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === c.id
                      ? 'bg-[#0a0a0a] text-[#fafafa] border border-[#0a0a0a] shadow-ui-subtle'
                      : 'bg-[#f5f5f5] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#ebebeb] border border-[#e5e5e5]'
                  }`}
                >
                  {c.name} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Panel Desplegable de Filtros */}
        {showFilters && (
          <div className="p-6 bg-white border border-[#e5e5e5] rounded-3xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 shadow-ui-subtle animate-in fade-in duration-200">
            <div>
              <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-[0.05em] mb-2">
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
              <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-[0.05em] mb-2">
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
              <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-[0.05em] mb-2">
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
              <label className="block text-[11px] font-medium text-[#737373] uppercase tracking-[0.05em] mb-2">
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

        {/* Resumen de resultados */}
        <div className="flex items-center justify-between text-xs text-[#737373] px-1">
          <span>
            Mostrando <span className="text-[#0a0a0a] font-medium">{filteredProducts.length}</span> de {products.length} ítems en catálogo
          </span>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="min-h-[32px] px-3.5 rounded-[18px] bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] border border-[#e5e5e5] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reiniciar filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================
          3. PRODUCT MATRIX (24px RADIUS CARDS)
         ========================================================= */}
      {loading && products.length === 0 ? (
        <ProductTableSkeleton />
      ) : filteredProducts.length === 0 ? (
        <div className="border border-[#e5e5e5] bg-white rounded-3xl p-14 text-center space-y-4 shadow-ui-subtle">
          <div className="w-12 h-12 bg-[#f5f5f5] border border-[#e5e5e5] rounded-full mx-auto flex items-center justify-center">
            <Package className="w-5 h-5 stroke-[1.5] text-[#737373]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#0a0a0a]">
              Sin registros en el catálogo
            </h3>
            <p className="text-xs text-[#737373] mt-1 max-w-md mx-auto">
              {hasActiveFilters
                ? 'Ningún producto coincide con los parámetros de búsqueda o filtros seleccionados.'
                : 'No existen existencias registradas en este inventario de trabajo.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="min-h-[40px] px-5 rounded-[18px] bg-[#f5f5f5] hover:bg-[#ebebeb] text-xs font-medium text-[#0a0a0a] border border-[#e5e5e5] transition-colors cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
            <button
              onClick={onOpenCreateModal}
              className="min-h-[40px] px-5 rounded-[18px] bg-[#0a0a0a] text-[#fafafa] hover:bg-[#262626] text-xs font-medium flex items-center gap-2 shadow-ui-subtle cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Registrar producto
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* VISTA RETÍCULA EN TARJETAS ROUNDED-3XL (24px) */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {paginatedProducts.map(product => {
            const isLow = product.stock < (product.min_stock !== undefined && product.min_stock !== null ? product.min_stock : 1);
            const isInactive = product.status !== 'ACTIVE';
            const mainPhoto = product.images?.[0];

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="bg-white border border-[#e5e5e5] hover:border-[#0a0a0a] rounded-3xl p-5 transition-all cursor-pointer group flex flex-col justify-between shadow-ui-subtle hover:shadow-ui-card"
              >
                {/* Cabecera del Ítem */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <span className="text-[11px] text-[#737373] font-normal block truncate">
                      {product.code}
                    </span>
                    <h3 className="text-sm font-medium text-[#0a0a0a] truncate group-hover:underline mt-0.5">
                      {product.name}
                    </h3>
                  </div>

                  {/* Badge de Stock en Píldora */}
                  <div className="flex-shrink-0 text-right">
                    {isInactive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-[18px] text-[10px] uppercase font-medium bg-[#f5f5f5] text-[#737373] border border-[#e5e5e5]">
                        Retirado
                      </span>
                    ) : isLow ? (
                      <span
                        title={getBoxBreakdown(product).breakdownLabel || undefined}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-[18px] text-[11px] font-medium bg-[#fee2e2] text-[#e7000b] border border-[#fecaca]"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#e7000b] mr-1.5 inline-block animate-pulse" />
                        {formatStockDisplay(product)}
                      </span>
                    ) : (
                      <span
                        title={getBoxBreakdown(product).breakdownLabel || undefined}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-[18px] text-[11px] font-medium bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]"
                      >
                        {formatStockDisplay(product)}
                      </span>
                    )}
                    {product.unit_type === 'BOX' && getBoxBreakdown(product).breakdownLabel && (
                      <span className="block text-[10px] text-[#737373] mt-0.5">
                        {getBoxBreakdown(product).breakdownLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fotografía de Producto */}
                <div className="aspect-square bg-[#fafafa] rounded-2xl border border-[#e5e5e5] relative overflow-hidden flex items-center justify-center my-2">
                  {mainPhoto ? (
                    <img
                      src={mainPhoto}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <Package className="w-8 h-8 stroke-[1] text-[#a3a3a3] mx-auto mb-1 opacity-50" />
                      <span className="text-[10px] text-[#a3a3a3]">
                        Sin foto
                      </span>
                    </div>
                  )}

                  {product.is_variant && (
                    <div className="absolute top-2.5 left-2.5">
                      <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-[18px] bg-[#0a0a0a] text-[#fafafa] flex items-center gap-1 shadow-xs">
                        <GitBranch className="w-2.5 h-2.5" /> Variante
                      </span>
                    </div>
                  )}
                </div>

                {/* Pie con Metadatos */}
                <div className="pt-3.5 mt-2 border-t border-[#e5e5e5] flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <span className="text-[11px] text-[#737373] block truncate">
                      {getProductLocationBadgeLabel(product)}
                    </span>
                    <span className="text-[11px] text-[#a3a3a3] block truncate">
                      {product.categories?.name || 'General'}
                    </span>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-semibold tabular-nums text-[#0a0a0a] block">
                      {formatCurrency(product.price, currentInventory?.currency)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA MANIFIESTO EN LISTA */
        <div className="border border-[#e5e5e5] bg-white rounded-3xl overflow-hidden shadow-ui-subtle">
          <div className="hidden md:grid grid-cols-12 gap-2 p-4 bg-[#fafafa] border-b border-[#e5e5e5] font-medium text-xs text-[#737373] uppercase tracking-[0.05em]">
            <div className="col-span-1">Foto</div>
            <div className="col-span-2">Código SKU</div>
            <div className="col-span-4">Descripción</div>
            <div className="col-span-2">Ubicación</div>
            <div className="col-span-1 text-right">Precio</div>
            <div className="col-span-1 text-right">Stock</div>
            <div className="col-span-1 text-center">Estado</div>
          </div>

          <div className="divide-y divide-[#e5e5e5]">
            {paginatedProducts.map(product => {
              const isLow = product.stock < (product.min_stock !== undefined && product.min_stock !== null ? product.min_stock : 1);
              const isInactive = product.status !== 'ACTIVE';
              const mainPhoto = product.images?.[0];

              return (
                <div
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  className="p-4 hover:bg-[#fafafa] transition-colors cursor-pointer group flex flex-col md:grid md:grid-cols-12 md:items-center gap-3 text-xs"
                >
                  <div className="col-span-1 flex items-center">
                    <div className="w-11 h-11 border border-[#e5e5e5] bg-[#fafafa] rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {mainPhoto ? (
                        <img
                          src={mainPhoto}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <Package className="w-4 h-4 stroke-[1.2] text-[#a3a3a3]" />
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 text-xs text-[#0a0a0a] font-medium">
                    <span className="text-[#737373] md:hidden text-[10px] block font-normal">SKU:</span>
                    {product.code}
                    {product.is_variant && (
                      <span className="ml-1.5 text-[10px] px-2 py-0.5 rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]">
                        Var
                      </span>
                    )}
                  </div>

                  <div className="col-span-4 min-w-0">
                    <h4 className="text-xs sm:text-sm font-medium text-[#0a0a0a] group-hover:underline truncate">
                      {product.name}
                    </h4>
                    <span className="text-[11px] text-[#737373] block truncate mt-0.5">
                      {product.categories?.name || 'General'} {product.subcategories?.name ? `· ${product.subcategories.name}` : ''}
                    </span>
                  </div>

                  <div className="col-span-2 text-xs text-[#737373] flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 stroke-[1.8] text-[#737373] flex-shrink-0" />
                    <span className="truncate">{getProductLocationBadgeLabel(product)}</span>
                  </div>

                  <div className="col-span-1 text-left md:text-right font-semibold text-xs sm:text-sm tabular-nums text-[#0a0a0a]">
                    <span className="text-[#737373] md:hidden text-[10px] uppercase block font-normal">Precio:</span>
                    {formatCurrency(product.price, currentInventory?.currency)}
                  </div>

                  <div
                    className="col-span-1 text-left md:text-right font-semibold text-xs tabular-nums text-[#0a0a0a]"
                    title={getBoxBreakdown(product).breakdownLabel || undefined}
                  >
                    <span className="text-[#737373] md:hidden text-[10px] uppercase block font-normal">Stock:</span>
                    <span>{formatStockDisplay(product)}</span>
                    {product.unit_type === 'BOX' && getBoxBreakdown(product).breakdownLabel && (
                      <span className="block text-[10px] text-[#737373] font-normal">
                        {getBoxBreakdown(product).breakdownLabel}
                      </span>
                    )}
                  </div>

                  <div className="col-span-1 flex md:justify-center">
                    {isInactive ? (
                      <span className="px-2.5 py-0.5 rounded-[18px] text-[10px] font-medium bg-[#f5f5f5] text-[#737373] border border-[#e5e5e5]">
                        Baja
                      </span>
                    ) : isLow ? (
                      <span className="px-2.5 py-0.5 rounded-[18px] text-[10px] font-medium bg-[#fee2e2] text-[#e7000b] border border-[#fecaca]">
                        Bajo stock
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-[18px] text-[10px] font-medium bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5]">
                        Activo
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
        <div className="border border-[#e5e5e5] bg-white rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-ui-subtle">
          <span className="text-[#737373]">
            Página <strong className="text-[#0a0a0a] font-semibold">{currentPage}</strong> de {totalPages}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="min-h-[38px] px-3.5 rounded-[18px] bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] border border-[#e5e5e5] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
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
                  className={`min-h-[38px] min-w-[38px] rounded-[18px] text-xs font-medium transition-all flex items-center justify-center cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-[#0a0a0a] text-[#fafafa] border border-[#0a0a0a] shadow-xs'
                      : 'bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] border border-[#e5e5e5]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="min-h-[38px] px-3.5 rounded-[18px] bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] border border-[#e5e5e5] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
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
