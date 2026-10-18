import React, { useState, useMemo } from 'react';
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
import { formatCurrency } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

interface InventoryPageProps {
  products: Product[];
  categories: Category[];
  subcategories: Subcategory[];
  locations: Location[];
  onSelectProduct: (product: Product) => void;
  onOpenCreateModal: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({
  products,
  categories,
  subcategories,
  locations,
  onSelectProduct,
  onOpenCreateModal,
  onRefresh,
  loading
}) => {
  const { currentInventory } = useAuth();

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Paginación técnica
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = viewMode === 'grid' ? 12 : 16;

  // Escáner de Búsqueda Rápida
  const [searchScannerOpen, setSearchScannerOpen] = useState(false);

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
        selectedLocation === 'ALL' || prod.location_id === selectedLocation;

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
    setSearchTerm(scannedCode);
    const exactMatch = products.find(p => p.code.toLowerCase() === scannedCode.toLowerCase());
    if (exactMatch) {
      onSelectProduct(exactMatch);
    }
  };

  return (
    <div className="space-y-6 pb-28 lg:pb-16 max-w-[1440px] mx-auto text-[#1E3A5F]">
      
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
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-[#1E3A5F] uppercase">
            EXISTENCIAS & RECURSOS
          </h1>
        </div>

        <div className="flex items-center gap-2">
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
            className="min-h-[44px] px-6 rounded-full bg-[#1E3A5F] hover:bg-[#172E4C] text-white text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm"
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
          <div className="flex items-center gap-2">
            {/* Escáner de Cámara */}
            <button
              onClick={() => setSearchScannerOpen(true)}
              className="min-h-[44px] px-4 rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] bg-white text-[#1E3A5F] flex items-center justify-center gap-2 transition-all active:bg-[#F8F9FA] shadow-sm"
              title="Escanear código de barras o QR"
            >
              <Camera className="w-4 h-4 stroke-[1.5]" />
              <span className="text-xs font-mono uppercase tracking-wider hidden md:inline">ESCANEAR</span>
            </button>

            {/* Toggle de Filtros */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`min-h-[44px] px-4 rounded-full border transition-all flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider shadow-sm ${
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
              <label className="block text-[10px] font-mono text-[#616161] uppercase tracking-[0.15em] mb-1.5">
                [01] CATEGORÍA PRINCIPAL
              </label>
              <select
                value={selectedCategory}
                onChange={e => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubcategory('ALL');
                  setCurrentPage(1);
                }}
                className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl px-4 text-xs font-mono uppercase tracking-wider text-[#1E3A5F] focus:outline-none"
              >
                <option value="ALL">TODAS LAS CATEGORÍAS</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-[#616161] uppercase tracking-[0.15em] mb-1.5">
                [02] SUBCATEGORÍA / TIPO
              </label>
              <select
                value={selectedSubcategory}
                onChange={e => {
                  setSelectedSubcategory(e.target.value);
                  setCurrentPage(1);
                }}
                disabled={selectedCategory === 'ALL' || activeSubcategories.length === 0}
                className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl px-4 text-xs font-mono uppercase tracking-wider text-[#1E3A5F] focus:outline-none disabled:opacity-40"
              >
                <option value="ALL">TODAS LAS SUBCATEGORÍAS</option>
                {activeSubcategories.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-[#616161] uppercase tracking-[0.15em] mb-1.5">
                [03] UBICACIÓN FÍSICA / RACK
              </label>
              <select
                value={selectedLocation}
                onChange={e => {
                  setSelectedLocation(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl px-4 text-xs font-mono uppercase tracking-wider text-[#1E3A5F] focus:outline-none"
              >
                <option value="ALL">TODAS LAS UBICACIONES</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name} [{l.code}]</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-[#616161] uppercase tracking-[0.15em] mb-1.5">
                [04] ESTADO DE INVENTARIO
              </label>
              <select
                value={selectedStatus}
                onChange={e => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full min-h-[44px] bg-[#F8F9FA] border border-[#E5E7EB] focus:border-[#1E3A5F] rounded-2xl px-4 text-xs font-mono uppercase tracking-wider text-[#1E3A5F] focus:outline-none"
              >
                <option value="ALL">TODOS LOS ESTADOS</option>
                <option value="ACTIVE">ACTIVOS (EN VENTA/USO)</option>
                <option value="INACTIVE">RETIRADOS / INACTIVOS</option>
              </select>
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
          3. PRODUCT MATRIX // LIST (AWWWARDS EDITORIAL GALLERY)
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
            const isLow = product.stock <= (product.min_stock || 1);
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
                    <h3 className="text-sm font-normal uppercase tracking-wide text-[#1E3A5F] truncate group-hover:text-[#1E3A5F] group-hover:underline mt-0.5">
                      {product.name}
                    </h3>
                  </div>

                  {/* Badge de Stock en Píldora */}
                  <div className="flex-shrink-0">
                    {isInactive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono tracking-wider bg-[#1E3A5F] text-white">
                        RETIRADO
                      </span>
                    ) : isLow ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono tracking-wider bg-[#ffdd00] text-black border border-black/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-black mr-1 inline-block animate-pulse" />
                        {product.stock} UDS
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono tracking-wider border border-[#E5E7EB] text-[#1E3A5F]">
                        {product.stock} UDS
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
                      LOC: {product.locations?.name || 'SIN ASIGNAR'}
                    </span>
                    <span className="font-mono text-[10px] text-[#E8B4A0] uppercase tracking-wider block truncate font-medium">
                      CAT: {product.categories?.name || 'GENERAL'}
                    </span>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-base font-normal tabular-nums text-[#1E3A5F] block tracking-tight">
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
          <div className="hidden md:grid grid-cols-12 gap-2 p-3.5 bg-[#F8F9FA] border-b border-[#E5E7EB] font-mono text-[10px] uppercase tracking-[0.15em] text-[#616161]">
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
              const isLow = product.stock <= (product.min_stock || 1);
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
                        />
                      ) : (
                        <Package className="w-4 h-4 stroke-[1] text-[#616161] opacity-50" />
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 font-mono text-xs uppercase tracking-wider text-[#1E3A5F]">
                    <span className="text-[#616161] md:hidden text-[10px] block">SKU:</span>
                    {product.code}
                    {product.is_variant && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full border border-[#1E3A5F] text-[#1E3A5F]">
                        VAR
                      </span>
                    )}
                  </div>

                  <div className="col-span-4 min-w-0">
                    <h4 className="text-xs sm:text-sm font-normal uppercase tracking-wide text-[#1E3A5F] group-hover:underline truncate">
                      {product.name}
                    </h4>
                    <span className="font-mono text-[10px] text-[#616161] uppercase tracking-wider block truncate">
                      {product.categories?.name || 'GENERAL'} {product.subcategories?.name ? `// ${product.subcategories.name}` : ''}
                    </span>
                  </div>

                  <div className="col-span-2 font-mono text-xs uppercase tracking-wider text-[#616161] flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 stroke-[1.5] text-[#1E3A5F] flex-shrink-0" />
                    <span className="truncate">{product.locations?.name || 'SIN ASIGNAR'}</span>
                  </div>

                  <div className="col-span-1 text-left md:text-right font-normal text-xs sm:text-sm tabular-nums text-[#1E3A5F]">
                    <span className="text-[#616161] md:hidden text-[10px] font-mono uppercase block">PRECIO:</span>
                    {formatCurrency(product.price, currentInventory?.currency)}
                  </div>

                  <div className="col-span-1 text-left md:text-right font-mono text-xs tabular-nums text-[#1E3A5F]">
                    <span className="text-[#616161] md:hidden text-[10px] uppercase block">CANTIDAD:</span>
                    {product.stock} <span className="text-[10px] text-[#616161]">UDS</span>
                  </div>

                  <div className="col-span-1 flex md:justify-center">
                    {isInactive ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] uppercase font-mono tracking-wider bg-[#1E3A5F] text-white">
                        BAJA
                      </span>
                    ) : isLow ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] uppercase font-mono tracking-wider bg-[#ffdd00] text-black border border-black/20">
                        CRÍTICO
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

      {/* Escáner de Búsqueda Rápida */}
      <BarcodeScannerModal
        isOpen={searchScannerOpen}
        onClose={() => setSearchScannerOpen(false)}
        onScanSuccess={handleBarcodeSearch}
        title="ESCANEAR CÓDIGO // BÚSQUEDA RÁPIDA"
        instructions="Ubica el código de barras o QR de la mercancía frente al lente para indexar la ficha técnica."
      />
    </div>
  );
};
