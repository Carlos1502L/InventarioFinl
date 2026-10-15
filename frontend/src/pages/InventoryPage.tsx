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
  Printer,
  Tag,
  GitBranch
} from 'lucide-react';
import { Product, Category, Subcategory, Location } from '../types/database';
import { formatCurrency } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { BatchLabelsModal } from '../components/BatchLabelsModal';

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

  // RNF-01: Paginación
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = viewMode === 'grid' ? 12 : 15;

  // Escáner de Búsqueda Rápida
  const [searchScannerOpen, setSearchScannerOpen] = useState(false);

  // RF-09: Modal de Impresión de Etiquetas en Lote
  const [batchLabelsOpen, setBatchLabelsOpen] = useState(false);

  // Subcategorías según la categoría seleccionada
  const activeSubcategories = useMemo(() => {
    if (selectedCategory === 'ALL') return [];
    return subcategories.filter(s => s.category_id === selectedCategory);
  }, [selectedCategory, subcategories]);

  // RF-07.2: Detectar si algún filtro está activo para mostrar botón limpiar
  const hasActiveFilters = useMemo(() => {
    return Boolean(
      searchTerm.trim() ||
      selectedCategory !== 'ALL' ||
      selectedSubcategory !== 'ALL' ||
      selectedLocation !== 'ALL' ||
      selectedStatus !== 'ACTIVE'
    );
  }, [searchTerm, selectedCategory, selectedSubcategory, selectedLocation, selectedStatus]);

  // RF-07.2: Función para reiniciar todos los filtros inmediatamente
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('ALL');
    setSelectedSubcategory('ALL');
    setSelectedLocation('ALL');
    setSelectedStatus('ACTIVE');
    setCurrentPage(1);
  };

  // Filtrado reactivo en tiempo real
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // 1. Búsqueda por texto (nombre o código SKU)
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        prod.name.toLowerCase().includes(term) ||
        prod.code.toLowerCase().includes(term) ||
        (prod.description && prod.description.toLowerCase().includes(term));

      // 2. Filtro de Categoría
      const matchCategory =
        selectedCategory === 'ALL' || prod.category_id === selectedCategory;

      // 3. Filtro de Subcategoría
      const matchSubcategory =
        selectedSubcategory === 'ALL' || prod.subcategory_id === selectedSubcategory;

      // 4. Filtro de Ubicación
      const matchLocation =
        selectedLocation === 'ALL' || prod.location_id === selectedLocation;

      // 5. Filtro de Estado
      const matchStatus =
        selectedStatus === 'ALL' || prod.status === selectedStatus;

      return matchSearch && matchCategory && matchSubcategory && matchLocation && matchStatus;
    });
  }, [products, searchTerm, selectedCategory, selectedSubcategory, selectedLocation, selectedStatus]);

  // RNF-01: Cálculo de paginación
  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredProducts.slice(startIdx, startIdx + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Cambiar página cuando cambian los filtros
  useMemo(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredProducts.length, totalPages, currentPage]);

  // Manejar escaneo desde la barra de búsqueda
  const handleBarcodeSearch = (scannedCode: string) => {
    setSearchTerm(scannedCode);
    const exactMatch = products.find(p => p.code.toLowerCase() === scannedCode.toLowerCase());
    if (exactMatch) {
      onSelectProduct(exactMatch);
    }
  };

  return (
    <div className="space-y-4 pb-20 sm:pb-8">
      {/* 1. Barra de Búsqueda y Botones Rápidos (Mobile First) */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="flex-1 flex gap-2">
          {/* Input de Búsqueda */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por nombre, SKU o código..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Botón de Escaneo Directo */}
          <button
            onClick={() => setSearchScannerOpen(true)}
            className="px-3.5 bg-blue-50 dark:bg-blue-600/20 hover:bg-blue-100 dark:hover:bg-blue-600/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm"
            title="Escanear código de producto con la cámara"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Toggle de Filtros Avanzados */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3.5 rounded-xl border flex items-center justify-center transition-all shadow-sm ${
              showFilters || hasActiveFilters
                ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
            }`}
            title="Filtros"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Acciones de la Derecha: Impresión en Lote, Vistas y Nuevo */}
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          {/* RF-09.1: Botón de Impresión de Etiquetas en Lote */}
          <button
            onClick={() => setBatchLabelsOpen(true)}
            disabled={products.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap"
            title="Imprimir etiquetas de productos en lote"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Etiquetas en Lote</span>
          </button>

          <div className="flex items-center bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}
              title="Vista en Cuadrícula"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}
              title="Vista en Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onOpenCreateModal}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Nuevo Producto
          </button>
        </div>
      </div>

      {/* 2. Panel Desplegable de Filtros */}
      {showFilters && (
        <div className="p-4 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl grid grid-cols-1 sm:grid-cols-4 gap-3 shadow-sm animate-in fade-in transition-colors">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Categoría</label>
            <select
              value={selectedCategory}
              onChange={e => {
                setSelectedCategory(e.target.value);
                setSelectedSubcategory('ALL');
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Todas las Categorías</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Subcategoría</label>
            <select
              value={selectedSubcategory}
              onChange={e => {
                setSelectedSubcategory(e.target.value);
                setCurrentPage(1);
              }}
              disabled={selectedCategory === 'ALL' || activeSubcategories.length === 0}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="ALL">Todas las Subcategorías</option>
              {activeSubcategories.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Ubicación Física</label>
            <select
              value={selectedLocation}
              onChange={e => {
                setSelectedLocation(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Todas las Ubicaciones</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Estado</label>
            <select
              value={selectedStatus}
              onChange={e => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVE">Activos en Stock</option>
              <option value="WITHDRAWN">Retirados / Baja</option>
            </select>
          </div>
        </div>
      )}

      {/* 3. Conteo de Resultados, Botón Limpiar Filtros (RF-07.2) y Actualizar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 px-1">
        <div className="flex items-center gap-2.5">
          <span>
            Mostrando <strong className="text-slate-800 dark:text-slate-200">{filteredProducts.length}</strong> de {products.length} productos
          </span>

          {/* RF-07.2: Botón Limpiar Filtros */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[11px] font-bold rounded-lg transition-colors"
              title="Restablecer todos los filtros"
            >
              <RotateCcw className="w-3 h-3" /> Limpiar Filtros
            </button>
          )}
        </div>

        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {/* 4. Lista o Grid de Productos Paginados */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm transition-colors">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h4 className="text-base font-bold text-slate-800 dark:text-slate-300">No se encontraron productos</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Prueba modificando tus filtros de búsqueda o escanea otro código.'
              : 'Empieza a registrar existencias pulsando el botón a continuación.'}
          </p>
          <div className="flex items-center justify-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Quitar Filtros
              </button>
            )}
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" /> Agregar Producto
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* VISTA GRID */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {paginatedProducts.map(product => {
            const isLow = product.stock <= (product.min_stock || 1);
            const mainPhoto = product.images?.[0];

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="bg-white dark:bg-slate-800/60 hover:bg-slate-50/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer flex flex-col group"
              >
                {/* Imagen del Producto con RNF-04 Lazy Loading */}
                <div className="aspect-square bg-slate-100 dark:bg-slate-900 relative overflow-hidden flex items-center justify-center">
                  {mainPhoto ? (
                    <img
                      src={mainPhoto}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <Package className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                  )}

                  {/* Badge de Stock en la foto */}
                  <div className="absolute top-2 right-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md shadow-sm ${
                        product.status !== 'ACTIVE'
                          ? 'bg-rose-600/90 text-white'
                          : isLow
                          ? 'bg-amber-500/90 text-white animate-pulse'
                          : 'bg-emerald-600/90 text-white'
                      }`}
                    >
                      {product.status !== 'ACTIVE' ? 'Retirado' : `${product.stock} uds`}
                    </span>
                  </div>

                  {/* Badge de Variante RF-03.1 */}
                  {product.is_variant && (
                    <div className="absolute top-2 left-2">
                      <span className="font-bold text-[9px] px-1.5 py-0.5 rounded bg-indigo-600/90 text-white backdrop-blur-md flex items-center gap-1">
                        <GitBranch className="w-2.5 h-2.5" /> Var
                      </span>
                    </div>
                  )}

                  {/* Badge de Código en foto */}
                  <div className="absolute bottom-2 left-2">
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-black/70 text-white backdrop-blur-md">
                      {product.code}
                    </span>
                  </div>
                </div>

                {/* Contenido de la tarjeta */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {product.name}
                    </h4>
                    
                    {/* Ubicación */}
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                      <MapPin className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span className="truncate">{product.locations?.name || 'Sin ubicación'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/50">
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                      {formatCurrency(product.price, currentInventory?.currency)}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
                      {product.categories?.name || 'General'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA LISTA DETALLADA */
        <div className="space-y-2">
          {paginatedProducts.map(product => {
            const isLow = product.stock <= (product.min_stock || 1);
            const mainPhoto = product.images?.[0];

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="p-3 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] group shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {mainPhoto ? (
                      <img src={mainPhoto} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-slate-400 dark:text-slate-600" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {product.name}
                      </h4>
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 px-1.5 py-0.2 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                        {product.code}
                      </span>
                      {product.is_variant && (
                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                          Variante
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-500" /> {product.locations?.name || '-'}
                      </span>
                      <span>•</span>
                      <span>{product.categories?.name || 'General'}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                    {formatCurrency(product.price, currentInventory?.currency)}
                  </p>
                  <span className={`text-[11px] font-bold ${isLow ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`}>
                    {product.stock} uds
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RNF-01: Controles de Paginación */}
      {totalPages > 1 && (
        <div className="pt-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          <span>
            Página <strong className="text-slate-800 dark:text-slate-200">{currentPage}</strong> de {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
                  className={`w-7 h-7 rounded-xl text-xs font-bold transition-all ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
        title="Buscar Producto por Escaneo"
        instructions="Escanea el código de barras o QR de cualquier producto para ubicarlo instantáneamente."
      />

      {/* RF-09: Modal de Impresión de Etiquetas en Lote */}
      <BatchLabelsModal
        products={products}
        isOpen={batchLabelsOpen}
        onClose={() => setBatchLabelsOpen(false)}
      />
    </div>
  );
};
