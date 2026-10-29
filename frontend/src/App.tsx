import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { Product, Category, Subcategory, Location } from './types/database';

// Componentes de Layout y UI
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { BottomNav, TabType } from './components/layout/BottomNav';
import { PendingInvitationsBanner } from './components/ui/PendingInvitationsBanner';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/InventoryPage';
import { LocationsPage, LocationSubTab } from './pages/LocationsPage';
import { SalesPage } from './pages/SalesPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

// Modales Especializados
import { ProductFormModal } from './components/modals/ProductFormModal';
import { ProductDetailModal } from './components/modals/ProductDetailModal';
import { MoveProductModal } from './components/modals/MoveProductModal';
import { WithdrawProductModal } from './components/modals/WithdrawProductModal';
import { CategoriesManagementModal } from './components/modals/CategoriesManagementModal';
import { LocationsManagementModal } from './components/modals/LocationsManagementModal';
import { CollaboratorsModal } from './components/modals/CollaboratorsModal';
import { InventorySelectorModal } from './components/modals/InventorySelectorModal';
import { BarcodeScannerModal } from './components/modals/BarcodeScannerModal';
import { RestockProductModal } from './components/modals/RestockProductModal';

import { Loader2, Layers, Plus, Sparkles } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { user, loading: authLoading, currentInventory, refreshInventories } = useAuth();

  // Regla lógica: Funcionalidades comerciales solo activas si es NEGOCIO
  const isBusiness = currentInventory?.inventory_type !== 'PERSONAL';

  // Estado de Navegación: Inicialmente en "home" (Dashboard Principal)
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Redirigir a Home si el tipo de inventario no permite ventas ni historial comercial
  useEffect(() => {
    if (!isBusiness && (activeTab === 'sales' || activeTab === 'sales-history')) {
      setActiveTab('home');
    }
  }, [isBusiness, activeTab]);

  // Datos del Inventario Actual
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Estados de Modales
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  // Modales de Configuración
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [locationsModalOpen, setLocationsModalOpen] = useState(false);
  const [collaboratorsModalOpen, setCollaboratorsModalOpen] = useState(false);
  const [inventorySelectorOpen, setInventorySelectorOpen] = useState(false);

  // Estado del Módulo de Gestión de Ubicaciones
  const [locationSubTab, setLocationSubTab] = useState<LocationSubTab>('assign');
  const [locationTargetProduct, setLocationTargetProduct] = useState<Product | null>(null);

  const openLocationsWorkspace = (subTab: LocationSubTab = 'assign', prod: Product | null = null) => {
    setLocationSubTab(subTab);
    setLocationTargetProduct(prod);
    setActiveTab('locations');
  };

  // Escáner Rápido Global (Bottom Nav / Sidebar) y Reingreso por Escaneo
  const [quickScanOpen, setQuickScanOpen] = useState(false);
  const [scannedRestockProduct, setScannedRestockProduct] = useState<Product | null>(null);
  const [stockSearchFilter, setStockSearchFilter] = useState<string>('');

  // Cargar datos del inventario seleccionado
  const fetchInventoryData = useCallback(async () => {
    if (!currentInventory) return;
    try {
      setDataLoading(true);

      const [prodsRes, catsRes, subRes, locsRes] = await Promise.all([
        supabase
          .from('products')
          .select(`
            *,
            categories (id, name, color),
            subcategories (id, name),
            locations (id, name, code)
          `)
          .eq('inventory_id', currentInventory.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('categories')
          .select('*')
          .eq('inventory_id', currentInventory.id)
          .order('name', { ascending: true }),

        supabase
          .from('subcategories')
          .select('*')
          .eq('inventory_id', currentInventory.id)
          .order('name', { ascending: true }),

        supabase
          .from('locations')
          .select('*')
          .eq('inventory_id', currentInventory.id)
          .order('name', { ascending: true })
      ]);

      if (prodsRes.error) throw prodsRes.error;
      if (catsRes.error) throw catsRes.error;
      if (subRes.error) throw subRes.error;
      if (locsRes.error) throw locsRes.error;

      setProducts(prodsRes.data || []);
      setCategories(catsRes.data || []);
      setSubcategories(subRes.data || []);
      setLocations(locsRes.data || []);
    } catch (err: any) {
      console.error('Error fetching inventory data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [currentInventory]);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  // Manejador del Escaneo Rápido Central
  const handleQuickScanSuccess = (code: string) => {
    setQuickScanOpen(false);

    // 1. Buscar si es un producto existente -> Abrir diálogo de Reingreso de Existencias (3.2)
    const matchedProduct = products.find(p => p.code.toLowerCase() === code.toLowerCase());
    if (matchedProduct) {
      setScannedRestockProduct(matchedProduct);
      return;
    }

    // 2. Buscar si es una ubicación
    const matchedLocation = locations.find(l => l.code.toUpperCase() === code.toUpperCase());
    if (matchedLocation) {
      setActiveTab('inventory');
      alert(`UBICACIÓN DETECTADA: ${matchedLocation.name} [${matchedLocation.code}].`);
      return;
    }

    // 3. Si no existe, preguntar si desea registrarlo
    if (confirm(`CÓDIGO ESCANEADO: "${code}"\nNo figura en el manifiesto. ¿Deseas registrar un nuevo ítem con esta referencia?`)) {
      setProductToEdit(null);
      setProductFormOpen(true);
    }
  };

  // 1. Pantalla de Carga Inicial
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center space-y-4 font-mono text-[#1E3A5F]">
        <div className="w-12 h-12 rounded-2xl bg-[#1E3A5F] text-[#E8B4A0] flex items-center justify-center shadow-md animate-pulse">
          <Layers className="w-6 h-6 stroke-[1.5]" />
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#616161]">
          <Loader2 className="w-4 h-4 animate-spin text-[#1E3A5F]" />
          <span>INICIANDO INVENTARIO...</span>
        </div>
      </div>
    );
  }

  // 2. Pantalla de Autenticación si no hay sesión
  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen max-md:fixed max-md:inset-0 max-md:h-[100dvh] max-md:w-full max-md:overflow-hidden md:overflow-visible md:h-auto bg-white md:bg-[#EAEFF5] text-[#1E3A5F] flex flex-col font-normal selection:bg-[#1E3A5F] selection:text-white transition-colors duration-200">
      {/* Sidebar Lateral Fijo Desktop (>= 1024px) */}
      <Sidebar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenCreateModal={() => {
          setProductToEdit(null);
          setProductFormOpen(true);
        }}
        onQuickScan={() => setQuickScanOpen(true)}
        onOpenInventorySelector={() => setInventorySelectorOpen(true)}
        onOpenCategories={() => setCategoriesModalOpen(true)}
        onOpenLocations={() => openLocationsWorkspace('assign')}
        onOpenCollaborators={() => setCollaboratorsModalOpen(true)}
        isBusiness={isBusiness}
      />

      {/* Barra de Navegación Superior (Visible en >= 768px) */}
      <Navbar
        activeTab={activeTab}
        onOpenInventorySelector={() => setInventorySelectorOpen(true)}
        onOpenCollaborators={() => setCollaboratorsModalOpen(true)}
        onOpenLocations={() => openLocationsWorkspace('assign')}
        onOpenCategories={() => setCategoriesModalOpen(true)}
        onQuickScan={() => setQuickScanOpen(true)}
      />

      {/* Contenedor Principal Responsive con offset para el Sidebar en Desktop y safe area en móvil */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-0 pt-0 md:px-6 md:pt-5 lg:pl-[266px] pb-0 md:pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] lg:pb-12 max-md:h-full max-md:overflow-hidden md:overflow-visible">
        {/* Banner de Invitaciones Pendientes */}
        <div className="px-4 md:px-0">
          <PendingInvitationsBanner />
        </div>

        {/* Banner si el usuario no tiene inventario activo */}
        {!currentInventory && (
          <div className="mx-4 md:mx-0 mt-4 md:mt-0 mb-6 p-6 bg-[#ffffff] border border-[#E5E7EB] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm font-mono">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#1E3A5F] text-[#E8B4A0] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div>
                <h3 className="text-sm font-light uppercase tracking-wider text-[#1E3A5F]">
                  INVENTARIO DE TRABAJO NO SELECCIONADO
                </h3>
                <p className="text-xs text-[#616161] mt-0.5 font-light">
                  Para comenzar a indexar existencias y mercancía, selecciona o crea tu primer depósito.
                </p>
              </div>
            </div>
            <button
              onClick={() => setInventorySelectorOpen(true)}
              className="w-full sm:w-auto min-h-[44px] px-6 rounded-full bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4 stroke-[1.5] text-[#E8B4A0]" /> CREAR O SELECCIONAR DEPÓSITO
            </button>
          </div>
        )}

        {/* =========================================================
            VISTAS DE PANTALLA PRINCIPAL
           ========================================================= */}
        
        {/* VISTA 1: HOME (DASHBOARD PRINCIPAL) */}
        {activeTab === 'home' && (
          <HomePage
            products={products}
            onNavigateToStock={() => setActiveTab('inventory')}
            onNavigateToSales={() => setActiveTab('sales')}
            onNavigateToHistory={() => setActiveTab('sales-history')}
            onSelectProduct={(p) => {
              setSelectedProduct(p);
              setProductDetailOpen(true);
            }}
            onQuickScan={() => setQuickScanOpen(true)}
            onOpenCreateModal={() => {
              setProductToEdit(null);
              setProductFormOpen(true);
            }}
          />
        )}

        {/* VISTA 2: STOCK (CATÁLOGO DE EXISTENCIAS & RECURSOS) */}
        {activeTab === 'inventory' && (
          <InventoryPage
            products={products}
            categories={categories}
            subcategories={subcategories}
            locations={locations}
            onSelectProduct={(p) => {
              setSelectedProduct(p);
              setProductDetailOpen(true);
            }}
            onOpenCreateModal={() => {
              setProductToEdit(null);
              setProductFormOpen(true);
            }}
            onOpenLocationsModule={(sub, prod) => openLocationsWorkspace(sub || 'assign', prod || null)}
            onRefresh={fetchInventoryData}
            loading={dataLoading}
            initialSearchTerm={stockSearchFilter}
            onClearInitialSearch={() => setStockSearchFilter('')}
          />
        )}

        {/* VISTA 2.B: GESTIÓN DE UBICACIONES (ASIGNAR, CONSULTAR, MOVER, ESTANTES) */}
        {activeTab === 'locations' && (
          <LocationsPage
            products={products}
            locations={locations}
            onRefresh={fetchInventoryData}
            initialSubTab={locationSubTab}
            initialProduct={locationTargetProduct}
          />
        )}

        {/* VISTA 3: TERMINAL DE VENTAS (Solo NEGOCIO) */}
        {activeTab === 'sales' && isBusiness && (
          <SalesPage
            products={products}
            onSaleCompleted={fetchInventoryData}
            onNavigateToHistory={() => setActiveTab('sales-history')}
          />
        )}

        {/* VISTA 4: HISTORIAL DE TRANSACCIONES (Solo NEGOCIO) */}
        {activeTab === 'sales-history' && isBusiness && (
          <SalesHistoryPage
            onNavigateToSales={() => setActiveTab('sales')}
          />
        )}

        {/* VISTA 5: REPORTES Y EXPORTACIÓN */}
        {activeTab === 'reports' && (
          <ReportsPage
            products={products}
            categories={categories}
            subcategories={subcategories}
            locations={locations}
          />
        )}

        {/* VISTA 6: ESTADÍSTICAS Y TELEMETRÍA */}
        {activeTab === 'analytics' && (
          <AnalyticsPage
            products={products}
            categories={categories}
            locations={locations}
          />
        )}

        {/* VISTA 7: AJUSTES Y CONFIGURACIÓN */}
        {activeTab === 'settings' && (
          <SettingsPage
            onOpenCategories={() => setCategoriesModalOpen(true)}
            onOpenLocations={() => setLocationsModalOpen(true)}
            onOpenCollaborators={() => setCollaboratorsModalOpen(true)}
            onOpenInventorySelector={() => setInventorySelectorOpen(true)}
          />
        )}
      </main>

      {/* =========================================================
          BARRA DE NAVEGACIÓN INFERIOR (FLOATING DOCK SUIZO)
         ========================================================= */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onQuickScan={() => setQuickScanOpen(true)}
        isBusiness={isBusiness}
      />

      {/* =========================================================
          MODALES OPERATIVOS
         ========================================================= */}

      {/* 1. Modal de Creación / Edición de Producto */}
      <ProductFormModal
        isOpen={productFormOpen}
        onClose={() => setProductFormOpen(false)}
        onSaved={fetchInventoryData}
        productToEdit={productToEdit}
        categories={categories}
        subcategories={subcategories}
        locations={locations}
        products={products}
        onRedirectToStock={(prod) => {
          setProductFormOpen(false);
          setStockSearchFilter(prod.code);
          setActiveTab('inventory');
          setScannedRestockProduct(prod);
        }}
      />

      {/* 2. Modal de Detalle de Producto (Ficha Técnica Suiza) */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={productDetailOpen}
        onClose={() => setProductDetailOpen(false)}
        onEdit={(p) => {
          setProductDetailOpen(false);
          setProductToEdit(p);
          setProductFormOpen(true);
        }}
        onMove={(p) => {
          setProductDetailOpen(false);
          setSelectedProduct(p);
          setMoveModalOpen(true);
        }}
        onAssignLocation={(p) => {
          setProductDetailOpen(false);
          openLocationsWorkspace('assign', p);
        }}
        onWithdraw={(p) => {
          setProductDetailOpen(false);
          setSelectedProduct(p);
          setWithdrawModalOpen(true);
        }}
        locations={locations}
        allProducts={products}
        onSelectProduct={(p) => setSelectedProduct(p)}
        onUpdated={fetchInventoryData}
      />

      {/* 3. Modal de Traslado de Ubicación */}
      <MoveProductModal
        product={selectedProduct}
        isOpen={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        onMoved={fetchInventoryData}
        locations={locations}
      />

      {/* 4. Modal de Retiro / Baja de Stock */}
      <WithdrawProductModal
        product={selectedProduct}
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        onWithdrawn={fetchInventoryData}
      />

      {/* 5. Modales de Configuración */}
      <CategoriesManagementModal
        isOpen={categoriesModalOpen}
        onClose={() => setCategoriesModalOpen(false)}
        categories={categories}
        subcategories={subcategories}
        onRefresh={fetchInventoryData}
      />

      <LocationsManagementModal
        isOpen={locationsModalOpen}
        onClose={() => setLocationsModalOpen(false)}
        locations={locations}
        onRefresh={fetchInventoryData}
      />

      <CollaboratorsModal
        isOpen={collaboratorsModalOpen}
        onClose={() => setCollaboratorsModalOpen(false)}
      />

      <InventorySelectorModal
        isOpen={inventorySelectorOpen}
        onClose={() => setInventorySelectorOpen(false)}
      />

      {/* Escáner Rápido Global */}
      <BarcodeScannerModal
        isOpen={quickScanOpen}
        onClose={() => setQuickScanOpen(false)}
        onScanSuccess={handleQuickScanSuccess}
        title="ESCANEAR CÓDIGO // BÚSQUEDA RÁPIDA"
        instructions="Apunta la cámara al código de barras o QR de cualquier producto o estantería."
      />

      {/* 3.2: Modal de Reingreso de Stock al escanear código existente */}
      <RestockProductModal
        product={scannedRestockProduct}
        isOpen={Boolean(scannedRestockProduct)}
        onClose={() => setScannedRestockProduct(null)}
        onRestocked={fetchInventoryData}
        onViewDetails={prod => {
          setScannedRestockProduct(null);
          setSelectedProduct(prod);
          setProductDetailOpen(true);
        }}
      />
    </div>
  );
};

export default AppContent;
