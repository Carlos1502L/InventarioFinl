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
  GitBranch
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
import { MinimalDropdown } from '../components/ui/MinimalDropdown';
import { LocationSubTab } from './LocationsPage';

interface InventoryPageProps {
  products: Product[];
  categories: Category[];
  subcategories: Subcategory[];
  locations: Location[];
  onSelectProduct: (product: Product) => void;
  onOpenCreateModal: () => void;
  onOpenLocationsModule?: (subTab?: LocationSubTab, product?: Product) => void;
  onRefresh: () => void;
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
  loading,
  initialSearchTerm,
  onClearInitialSearch
}) => {
  const { currentInventory } = useAuth();

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

  // Filtrado reactivo
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        prod.name.toLowerCase().includes(term) ||
        prod.code.toLowerCase().includes(term) ||
        (prod.description && prod.description.toLowerCase().includes(term));

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
                className="w-12 h-12 flex items-center justify-center bg-neutral-50 border border-neutral-200/60 rounded-2xl text-neutral-600 hover:text-neutral-950 active:scale-95 transition-all shrink-0"
              >
                <Camera className="w-5 h-5" />
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
            {filteredProducts.length === 0 ? (
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
          VISTA DE ESCRITORIO (>= 768px / hidden md:block)
         ========================================================= */}
      <div className="hidden md:block space-y-6 pb-28 lg:pb-16 max-w-[1440px] mx-auto text-[#1E3A5F]">
      
      {/* =========================================================
          1. ENCABEZADO DE STOCK (SIN BLOQUE DE KPIS)
         ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#1E3A5F] inline-block" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#616161]">
              CATÁLOGO GENERAL DE STOCK
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E3A5F] uppercase">
            EXISTENCIAS & RECURSOS
          </h1>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onRefresh}
            className="min-h-[44px] px-4 rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] bg-white text-[#1E3A5F] text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-colors active:bg-[#F8F9FA] shadow-sm"
            title="Sincronizar existencias"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">ACTUALIZAR</span>
          </button>

          <button
            onClick={onOpenCreateModal}
            className="flex-1 sm:flex-initial min-h-[44px] px-6 rounded-full bg-[#1E3A5F] hover:bg-[#172E4C] text-white text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[1.5]" />
            <span>NUEVO PRODUCTO</span>
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
            <Search className="w-4 h-4 text-[#616161] absolute left-4 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="BUSCAR POR NOMBRE, SKU, SERIAL O DESCRIPCIÓN..."
              className="w-full min-h-[44px] bg-white border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-full pl-11 pr-10 py-2.5 text-xs font-mono uppercase tracking-wider text-[#1E3A5F] placeholder-[#616161] focus:outline-none transition-colors shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-4 top-3 text-xs text-[#616161] hover:text-[#1E3A5F] min-w-[24px] min-h-[24px] flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>

          {/* Botones de Control en Píldora */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            {/* Escáner de Cámara */}
            <button
              onClick={() => setSearchScannerOpen(true)}
              className="flex-1 sm:flex-initial min-h-[44px] px-4 rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] bg-white text-[#1E3A5F] flex items-center justify-center gap-2 transition-all active:bg-[#F8F9FA] shadow-sm"
              title="Escanear código de barras o QR"
            >
              <Camera className="w-4 h-4 stroke-[1.5]" />
              <span className="text-xs font-mono uppercase tracking-wider">ESCANEAR</span>
            </button>

            {/* Toggle de Filtros */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-1 sm:flex-initial min-h-[44px] px-4 rounded-full border transition-all flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider shadow-sm ${
                showFilters || hasActiveFilters
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white text-[#1E3A5F] border-[#E5E7EB] hover:border-[#1E3A5F]'
              }`}
              title="Desplegar filtros técnicos"
            >
              <SlidersHorizontal className="w-4 h-4 stroke-[1.5]" />
              <span>FILTROS</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-[#E8B4A0]" />
              )}
            </button>

            {/* Selector de Vista */}
            <div className="flex items-center border border-[#E5E7EB] rounded-full p-1 bg-white shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={`min-h-[34px] px-3.5 rounded-full text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[#1E3A5F] text-white'
                    : 'text-[#616161] hover:text-[#1E3A5F]'
                }`}
                title="Vista en Retícula"
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-[10px]">RETÍCULA</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`min-h-[34px] px-3.5 rounded-full text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#1E3A5F] text-white'
                    : 'text-[#616161] hover:text-[#1E3A5F]'
                }`}
                title="Vista en Manifiesto"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-[10px]">LISTA</span>
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
              className={`min-h-[36px] px-4 rounded-full text-[11px] font-mono uppercase tracking-wider whitespace-nowrap transition-all border shadow-sm ${
                selectedCategory === 'ALL'
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white text-[#616161] border-[#E5E7EB] hover:border-[#1E3A5F]'
              }`}
            >
              TODAS LAS CATEGORÍAS ({products.length})
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
                  className={`min-h-[36px] px-4 rounded-full text-[11px] font-mono uppercase tracking-wider whitespace-nowrap transition-all border shadow-sm ${
                    selectedCategory === c.id
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-white text-[#616161] border-[#E5E7EB] hover:border-[#1E3A5F]'
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
          <div className="p-5 bg-white border border-[#E5E7EB] rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shadow-sm animate-in fade-in duration-200">
            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#1E3A5F] uppercase tracking-[0.15em] mb-1.5">
                [01] CATEGORÍA PRINCIPAL
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
              <label className="block text-[10px] font-mono font-semibold text-[#1E3A5F] uppercase tracking-[0.15em] mb-1.5">
                [02] SUBCATEGORÍA / TIPO
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
              <label className="block text-[10px] font-mono font-semibold text-[#1E3A5F] uppercase tracking-[0.15em] mb-1.5">
                [03] UBICACIÓN FÍSICA / RACK
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
              <label className="block text-[10px] font-mono font-semibold text-[#1E3A5F] uppercase tracking-[0.15em] mb-1.5">
                [04] ESTADO DE INVENTARIO
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
        <div className="flex items-center justify-between text-xs font-mono text-[#616161] px-1">
          <span className="uppercase tracking-wider">
            MOSTRANDO <span className="text-[#1E3A5F] font-semibold">{filteredProducts.length}</span> DE {products.length} ÍTEMS EN CATÁLOGO
          </span>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="min-h-[32px] px-3.5 rounded-full border border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>REINICIAR FILTROS</span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================
          3. PRODUCT MATRIX // LIST (EDITORIAL GALLERY)
         ========================================================= */}
      {filteredProducts.length === 0 ? (
        <div className="border border-[#E5E7EB] bg-white rounded-2xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 border border-[#E5E7EB] rounded-full mx-auto flex items-center justify-center">
            <Package className="w-6 h-6 stroke-[1.2] text-[#616161]" />
          </div>
          <div>
            <h3 className="text-sm font-normal uppercase tracking-wider text-[#1E3A5F]">
              SIN REGISTROS EN EL CATÁLOGO
            </h3>
            <p className="text-xs text-[#616161] font-mono mt-1 max-w-md mx-auto uppercase">
              {hasActiveFilters
                ? 'Ningún producto coincide con los parámetros de búsqueda o filtros seleccionados.'
                : 'No existen existencias registradas en este inventario de trabajo.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="min-h-[44px] px-5 rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] text-xs uppercase tracking-wider transition-colors"
              >
                LIMPIAR FILTROS
              </button>
            )}
            <button
              onClick={onOpenCreateModal}
              className="min-h-[44px] px-6 rounded-full bg-[#1E3A5F] text-white hover:bg-[#172E4C] text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" /> REGISTRAR PRODUCTO
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* VISTA RETÍCULA EN TARJETAS ROUNDED-2XL */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {paginatedProducts.map(product => {
            const isLow = product.stock < (product.min_stock !== undefined && product.min_stock !== null ? product.min_stock : 1);
            const isInactive = product.status !== 'ACTIVE';
            const mainPhoto = product.images?.[0];

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="bg-white border border-[#E5E7EB] hover:border-[#1E3A5F] rounded-2xl p-4 transition-all cursor-pointer group flex flex-col justify-between shadow-sm hover:shadow-md"
              >
                {/* Cabecera Técnica del Ítem */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] tracking-wider text-[#616161] uppercase block truncate">
                      REF // {product.code}
                    </span>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-[#1E3A5F] truncate group-hover:text-[#1E3A5F] group-hover:underline mt-0.5">
                      {product.name}
                    </h3>
                  </div>

                  {/* Badge de Stock en Píldora (3.3: UNIT -> "20 und", BOX -> "2 cajas" o "1.5 cajas" + desglose) */}
                  <div className="flex-shrink-0 text-right">
                    {isInactive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono tracking-wider bg-[#1E3A5F] text-white">
                        RETIRADO
                      </span>
                    ) : isLow ? (
                      <span
                        title={getBoxBreakdown(product).breakdownLabel || undefined}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider bg-[#E8B4A0] text-[#1E3A5F] border border-[#1E3A5F]/15"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1E3A5F] mr-1 inline-block animate-pulse" />
                        {formatStockDisplay(product)}
                      </span>
                    ) : (
                      <span
                        title={getBoxBreakdown(product).breakdownLabel || undefined}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider border border-[#E5E7EB] text-[#1E3A5F]"
                      >
                        {formatStockDisplay(product)}
                      </span>
                    )}
                    {product.unit_type === 'BOX' && getBoxBreakdown(product).breakdownLabel && (
                      <span className="block text-[9px] font-mono text-[#616161] mt-0.5">
                        {getBoxBreakdown(product).breakdownLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fotografía de Producto */}
                <div className="aspect-square bg-[#F8F9FA] rounded-2xl border border-[#E5E7EB] relative overflow-hidden flex items-center justify-center my-1">
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
                      <Package className="w-8 h-8 stroke-[1] text-[#616161] mx-auto mb-1 opacity-40" />
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#616161]">
                        SIN FOTO
                      </span>
                    </div>
                  )}

                  {product.is_variant && (
                    <div className="absolute top-2 left-2">
                      <span className="font-mono text-[9px] uppercase px-2.5 py-0.5 rounded-full bg-[#1E3A5F] text-white flex items-center gap-1 shadow-sm">
                        <GitBranch className="w-2.5 h-2.5" /> VARIANTE
                      </span>
                    </div>
                  )}
                </div>

                {/* Pie con Metadatos */}
                <div className="pt-3 mt-2 border-t border-[#E5E7EB] flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <span className="font-mono text-[10px] text-[#616161] uppercase tracking-wider block truncate">
                      LOC: {getProductLocationBadgeLabel(product)}
                    </span>
                    <span className="font-mono text-[10px] text-[#E8B4A0] uppercase tracking-wider block truncate font-medium">
                      CAT: {product.categories?.name || 'GENERAL'}
                    </span>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-base font-bold tabular-nums text-[#1E3A5F] block tracking-tight">
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
        <div className="border border-[#E5E7EB] bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-12 gap-2 p-3.5 bg-[#F8F9FA] border-b border-[#E5E7EB] font-mono font-bold text-[10px] uppercase tracking-[0.15em] text-[#1E3A5F]">
            <div className="col-span-1">FOTO</div>
            <div className="col-span-2">SKU // REF</div>
            <div className="col-span-4">DESCRIPCIÓN TÉCNICA</div>
            <div className="col-span-2">UBICACIÓN</div>
            <div className="col-span-1 text-right">PRECIO</div>
            <div className="col-span-1 text-right">STOCK</div>
            <div className="col-span-1 text-center">ESTADO</div>
          </div>

          <div className="divide-y divide-[#E5E7EB]">
            {paginatedProducts.map(product => {
              const isLow = product.stock < (product.min_stock !== undefined && product.min_stock !== null ? product.min_stock : 1);
              const isInactive = product.status !== 'ACTIVE';
              const mainPhoto = product.images?.[0];

              return (
                <div
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  className="p-3.5 sm:p-4 hover:bg-[#F8F9FA] transition-colors cursor-pointer group flex flex-col md:grid md:grid-cols-12 md:items-center gap-3"
                >
                  <div className="col-span-1 flex items-center">
                    <div className="w-12 h-12 border border-[#E5E7EB] bg-[#F8F9FA] rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {mainPhoto ? (
                        <img
                          src={mainPhoto}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <Package className="w-4 h-4 stroke-[1] text-[#616161] opacity-50" />
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 font-mono text-xs uppercase tracking-wider text-[#1E3A5F] font-semibold">
                    <span className="text-[#616161] md:hidden text-[10px] block font-normal">SKU:</span>
                    {product.code}
                    {product.is_variant && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full border border-[#1E3A5F] text-[#1E3A5F]">
                        VAR
                      </span>
                    )}
                  </div>

                  <div className="col-span-4 min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-[#1E3A5F] group-hover:underline truncate">
                      {product.name}
                    </h4>
                    <span className="font-mono text-[10px] text-[#616161] uppercase tracking-wider block truncate">
                      {product.categories?.name || 'GENERAL'} {product.subcategories?.name ? `// ${product.subcategories.name}` : ''}
                    </span>
                  </div>

                  <div className="col-span-2 font-mono text-xs uppercase tracking-wider text-[#616161] flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 stroke-[1.5] text-[#1E3A5F] flex-shrink-0" />
                    <span className="truncate">{getProductLocationBadgeLabel(product)}</span>
                  </div>

                  <div className="col-span-1 text-left md:text-right font-bold text-xs sm:text-sm tabular-nums text-[#1E3A5F]">
                    <span className="text-[#616161] md:hidden text-[10px] font-mono uppercase block font-normal">PRECIO:</span>
                    {formatCurrency(product.price, currentInventory?.currency)}
                  </div>

                  <div
                    className="col-span-1 text-left md:text-right font-mono font-bold text-xs tabular-nums text-[#1E3A5F]"
                    title={getBoxBreakdown(product).breakdownLabel || undefined}
                  >
                    <span className="text-[#616161] md:hidden text-[10px] uppercase block font-normal">CANTIDAD:</span>
                    <span>{formatStockDisplay(product)}</span>
                    {product.unit_type === 'BOX' && getBoxBreakdown(product).breakdownLabel && (
                      <span className="block text-[9px] text-[#616161] font-normal">
                        {getBoxBreakdown(product).breakdownLabel}
                      </span>
                    )}
                  </div>

                  <div className="col-span-1 flex md:justify-center">
                    {isInactive ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] uppercase font-mono tracking-wider bg-[#1E3A5F] text-white">
                        BAJA
                      </span>
                    ) : isLow ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] uppercase font-mono font-bold tracking-wider bg-[#E8B4A0] text-[#1E3A5F] border border-[#1E3A5F]/15">
                        BAJO STOCK
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] uppercase font-mono tracking-wider border border-[#E5E7EB] text-[#1E3A5F]">
                        ACTIVO
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
        <div className="border border-[#E5E7EB] bg-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs shadow-sm">
          <span className="text-[#616161] uppercase tracking-wider">
            HOJA <strong className="text-[#1E3A5F] font-normal">{currentPage.toString().padStart(2, '0')}</strong> DE {totalPages.toString().padStart(2, '0')}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="min-h-[40px] px-3.5 rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] bg-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors text-[#1E3A5F]"
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
                  className={`min-h-[40px] min-w-[40px] rounded-full text-xs font-mono uppercase transition-all flex items-center justify-center ${
                    currentPage === pageNum
                      ? 'bg-[#1E3A5F] text-white shadow-sm'
                      : 'border border-[#E5E7EB] hover:border-[#1E3A5F] text-[#1E3A5F] bg-white'
                  }`}
                >
                  {pageNum.toString().padStart(2, '0')}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="min-h-[40px] px-3.5 rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] bg-white disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors text-[#1E3A5F]"
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
    </>
  );
};
