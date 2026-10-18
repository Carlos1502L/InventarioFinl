import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { Product, Category, Subcategory, Location } from './types/database';

// Componentes y Vistas
import { Navbar } from './components/Navbar';
import { BottomNav, TabType } from './components/BottomNav';
import { PendingInvitationsBanner } from './components/PendingInvitationsBanner';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/InventoryPage';
import { SalesPage } from './pages/SalesPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

// Modales
import { ProductFormModal } from './components/ProductFormModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { MoveProductModal } from './components/MoveProductModal';
import { WithdrawProductModal } from './components/WithdrawProductModal';
import { CategoriesManagementModal } from './components/CategoriesManagementModal';
import { LocationsManagementModal } from './components/LocationsManagementModal';
import { CollaboratorsModal } from './components/CollaboratorsModal';
import { InventorySelectorModal } from './components/InventorySelectorModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';

import { Loader2, Layers, Plus, Sparkles, LayoutDashboard, Package, ShoppingCart, Receipt, FileText, BarChart3, Settings } from 'lucide-react';

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

  // Escáner Rápido Global (Bottom Nav)
  const [quickScanOpen, setQuickScanOpen] = useState(false);

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

    // 1. Buscar si es un producto existente
    const matchedProduct = products.find(p => p.code.toLowerCase() === code.toLowerCase());
    if (matchedProduct) {
      setSelectedProduct(matchedProduct);
      setProductDetailOpen(true);
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center space-y-4 font-mono text-black">
        <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center animate-pulse">
          <Layers className="w-6 h-6 stroke-[1.5]" />
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#616161]">
          <Loader2 className="w-4 h-4 animate-spin text-black" />
          <span>INICIANDO MANIFIESTO DE INVENTARIO...</span>
        </div>
      </div>
    );
  }

  // 2. Pantalla de Autenticación si no hay sesión
  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-white text-black flex flex-col font-normal selection:bg-black selection:text-white transition-colors duration-200">
      {/* Barra de Navegación Superior */}
      <Navbar
        onOpenInventorySelector={() => setInventorySelectorOpen(true)}
        onOpenCollaborators={() => setCollaboratorsModalOpen(true)}
        onOpenLocations={() => setLocationsModalOpen(true)}
        onOpenCategories={() => setCategoriesModalOpen(true)}
      />

      {/* Contenedor Principal Responsive */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 pt-5">
        {/* Banner de Invitaciones Pendientes */}
        <PendingInvitationsBanner />

        {/* Banner si el usuario no tiene inventario activo */}
        {!currentInventory && (
          <div className="mb-6 p-6 bg-white border border-[#cacaca] flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div>
                <h3 className="text-sm font-normal uppercase tracking-wider text-black">
                  INVENTARIO DE TRABAJO NO SELECCIONADO
                </h3>
                <p className="text-xs text-[#616161] uppercase mt-0.5">
                  Para comenzar a indexar existencias y mercancía, selecciona o crea tu primer depósito.
                </p>
              </div>
            </div>
            <button
              onClick={() => setInventorySelectorOpen(true)}
              className="w-full sm:w-auto min-h-[44px] px-6 rounded-full bg-black hover:bg-[#1a1b1e] text-white text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[1.5]" /> CREAR O SELECCIONAR DEPÓSITO
            </button>
          </div>
        )}

        {/* Pestañas de Navegación Desktop (Píldoras Monocromáticas Suizas) */}
        <div className="hidden sm:flex items-center gap-2 mb-6 border-b border-[#cacaca] pb-3 flex-wrap font-mono">
          {/* Pestaña 1: HOME */}
          <button
            onClick={() => setActiveTab('home')}
            className={`min-h-[38px] px-4 rounded-full text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'home'
                ? 'bg-black text-white border border-black'
                : 'bg-white border border-[#cacaca] text-[#616161] hover:text-black hover:border-black'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>HOME // RESUMEN</span>
          </button>

          {/* Pestaña 2: STOCK (CATÁLOGO) */}
          <button
            onClick={() => setActiveTab('inventory')}
            className={`min-h-[38px] px-4 rounded-full text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'inventory'
                ? 'bg-black text-white border border-black'
                : 'bg-white border border-[#cacaca] text-[#616161] hover:text-black hover:border-black'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>STOCK // CATÁLOGO</span>
          </button>

          {/* Pestaña 3: VENTAS (POS) - Solo NEGOCIO */}
          {isBusiness && (
            <button
              onClick={() => setActiveTab('sales')}
              className={`min-h-[38px] px-4 rounded-full text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'sales'
                  ? 'bg-black text-white border border-black'
                  : 'bg-white border border-[#cacaca] text-[#616161] hover:text-black hover:border-black'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>TERMINAL POS</span>
            </button>
          )}

          {/* Pestaña 4: HISTORIAL DE VENTAS - Solo NEGOCIO */}
          {isBusiness && (
            <button
              onClick={() => setActiveTab('sales-history')}
              className={`min-h-[38px] px-4 rounded-full text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'sales-history'
                  ? 'bg-black text-white border border-black'
                  : 'bg-white border border-[#cacaca] text-[#616161] hover:text-black hover:border-black'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>HISTORIAL VENTAS</span>
            </button>
          )}

          {/* Pestaña 5: REPORTES */}
          <button
            onClick={() => setActiveTab('reports')}
            className={`min-h-[38px] px-4 rounded-full text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'reports'
                ? 'bg-black text-white border border-black'
                : 'bg-white border border-[#cacaca] text-[#616161] hover:text-black hover:border-black'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>REPORTES</span>
          </button>

          {/* Pestaña 6: TELEMETRÍA Y OCUPACIÓN */}
          <button
            onClick={() => setActiveTab('analytics')}
            className={`min-h-[38px] px-4 rounded-full text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'bg-black text-white border border-black'
                : 'bg-white border border-[#cacaca] text-[#616161] hover:text-black hover:border-black'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>TELEMETRÍA</span>
          </button>

          {/* Pestaña 7: AJUSTES Y CONFIGURACIÓN */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`min-h-[38px] px-4 rounded-full text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-black text-white border border-black'
                : 'bg-white border border-[#cacaca] text-[#616161] hover:text-black hover:border-black'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>AJUSTES</span>
          </button>
        </div>

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
            onRefresh={fetchInventoryData}
            loading={dataLoading}
          />
        )}

        {/* VISTA 3: TERMINAL DE VENTAS (Solo NEGOCIO) */}
        {activeTab === 'sales' && isBusiness && (
          <SalesPage
            products={products}
            onSaleCompleted={fetchInventoryData}
          />
        )}

        {/* VISTA 4: HISTORIAL DE TRANSACCIONES (Solo NEGOCIO) */}
        {activeTab === 'sales-history' && isBusiness && (
          <SalesHistoryPage />
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
    </div>
  );
};

export default AppContent;
