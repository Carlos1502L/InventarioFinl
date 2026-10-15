import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { Product, Category, Subcategory, Location } from './types/database';

// Componentes y Vistas
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { BottomNav, TabType } from './components/BottomNav';
import { PendingInvitationsBanner } from './components/PendingInvitationsBanner';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { SalesPage } from './pages/SalesPage';
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
import { BatchLabelsModal } from './components/BatchLabelsModal';

import { Loader2, Layers, Plus, Sparkles } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { user, loading: authLoading, currentInventory, refreshInventories } = useAuth();

  // Estado de Navegación Principal (Por defecto 'dashboard' / Resumen)
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

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
  const [batchLabelsOpen, setBatchLabelsOpen] = useState(false);

  // Modales de Configuración
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [locationsModalOpen, setLocationsModalOpen] = useState(false);
  const [collaboratorsModalOpen, setCollaboratorsModalOpen] = useState(false);
  const [inventorySelectorOpen, setInventorySelectorOpen] = useState(false);

  // Escáner Rápido Global (Barra Inferior)
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

      if (prodsRes.data) setProducts(prodsRes.data);
      if (catsRes.data) setCategories(catsRes.data);
      if (subRes.data) setSubcategories(subRes.data);
      if (locsRes.data) setLocations(locsRes.data);
    } catch (err) {
      console.error('Error cargando datos del inventario:', err);
    } finally {
      setDataLoading(false);
    }
  }, [currentInventory]);

  useEffect(() => {
    if (currentInventory) {
      fetchInventoryData();
    } else {
      setProducts([]);
      setCategories([]);
      setSubcategories([]);
      setLocations([]);
    }
  }, [currentInventory, fetchInventoryData]);

  // Manejo de Escaneo Rápido desde Barra Inferior
  const handleQuickScanSuccess = (scannedCode: string) => {
    const code = scannedCode.trim();
    // 1. Buscar si es un producto
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
      alert(`Código detectado de Ubicación: ${matchedLocation.name} (${matchedLocation.code}).`);
      return;
    }

    // 3. Si no existe, preguntar si desea registrarlo como nuevo producto
    if (confirm(`Código escaneado: "${code}"\nNo está registrado en el inventario. ¿Deseas registrar un nuevo producto con este código?`)) {
      setProductToEdit(null);
      setProductFormOpen(true);
    }
  };

  // Título del módulo activo en el TopHeader
  const moduleTitles: Record<TabType, string> = {
    dashboard: 'Resumen Ejecutivo',
    inventory: 'Módulo de Inventario',
    sales: 'Terminal de Ventas (POS)',
    reports: 'Reportes y Exportación',
    analytics: 'Estadísticas y Métricas',
    settings: 'Configuración y Catálogo'
  };

  // 1. Pantalla de Carga Inicial
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0E131F] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#FF6B00] flex items-center justify-center shadow-xl shadow-orange-500/30 animate-pulse">
          <Layers className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-[#FF6B00]" />
          <span>Iniciando InventarioCoop Pro...</span>
        </div>
      </div>
    );
  }

  // 2. Pantalla de Autenticación si no hay sesión (MÓDULO 1)
  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] dark:bg-[#0E131F] text-slate-900 dark:text-slate-100 font-sans selection:bg-[#FF6B00] selection:text-white transition-colors duration-200">
      {/* ==============================================================================
          BARRA LATERAL IZQUIERDA FIJA EN AZUL MARINO (#1A2035) (RF-03.1 Desktop)
         ============================================================================== */}
      <Sidebar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenCreateProduct={() => {
          setProductToEdit(null);
          setProductFormOpen(true);
        }}
        onOpenLocations={() => setLocationsModalOpen(true)}
        onOpenCategories={() => setCategoriesModalOpen(true)}
        onOpenBatchLabels={() => setBatchLabelsOpen(true)}
      />

      {/* ==============================================================================
          CANVAS DE CONTENIDO Y BARRA SUPERIOR (RF-03.1 Top Header & Content)
         ============================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Barra Superior Fija (Top Header) */}
        <TopHeader
          moduleTitle={moduleTitles[activeTab]}
          onOpenRegisterSale={() => setActiveTab('sales')}
          onOpenInventorySelector={() => setInventorySelectorOpen(true)}
        />

        {/* Contenedor Principal */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
          {/* RF-05.1: Banner de Invitaciones Pendientes con Aceptación Explícita */}
          <PendingInvitationsBanner />

          {/* Banner si el usuario no tiene inventario activo */}
          {!currentInventory && (
            <div className="mb-6 p-6 bg-white dark:bg-[#1A2035] border border-orange-200 dark:border-orange-900/40 rounded-[12px] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-orange-50 dark:bg-orange-950/50 text-[#FF6B00] rounded-2xl">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    ¡Bienvenido a InventarioCoop!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Para comenzar a registrar existencias y ventas, crea tu primer inventario de trabajo.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInventorySelectorOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" /> Crear Mi Primer Inventario
              </button>
            </div>
          )}

          {/* MÓDULO 2: Vista Home / Dashboard (RF-04 a RF-07) */}
          {activeTab === 'dashboard' && (
            <DashboardPage
              products={products}
              locations={locations}
              categories={categories}
              onOpenCreateProduct={() => {
                setProductToEdit(null);
                setProductFormOpen(true);
              }}
              onOpenRegisterSale={() => setActiveTab('sales')}
              onNavigateToInventory={() => setActiveTab('inventory')}
              onNavigateToSales={() => setActiveTab('sales')}
              onOpenBatchLabels={() => setBatchLabelsOpen(true)}
            />
          )}

          {/* Módulo de Inventario */}
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

          {/* Módulo de Ventas y Cobros (RF-06) */}
          {activeTab === 'sales' && (
            <SalesPage
              products={products}
              onSaleCompleted={fetchInventoryData}
            />
          )}

          {/* Módulo de Reportes (RF-07) */}
          {activeTab === 'reports' && (
            <ReportsPage
              products={products}
              categories={categories}
              subcategories={subcategories}
              locations={locations}
            />
          )}

          {/* Módulo de Estadísticas */}
          {activeTab === 'analytics' && (
            <AnalyticsPage
              products={products}
              categories={categories}
              locations={locations}
            />
          )}

          {/* Módulo de Ajustes */}
          {activeTab === 'settings' && (
            <SettingsPage
              onOpenCategories={() => setCategoriesModalOpen(true)}
              onOpenLocations={() => setLocationsModalOpen(true)}
              onOpenCollaborators={() => setCollaboratorsModalOpen(true)}
              onOpenInventorySelector={() => setInventorySelectorOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Barra de Navegación Inferior Mobile-First (RF-03.2) */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onQuickScan={() => setQuickScanOpen(true)}
        isBusiness={currentInventory?.inventory_type !== 'PERSONAL'}
      />

      {/* --- MODALES OPERATIVOS --- */}

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

      {/* 2. Modal de Detalle de Producto con Trazabilidad y Galería */}
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

      {/* Modal de Impresión de Etiquetas en Lote */}
      <BatchLabelsModal
        products={products}
        isOpen={batchLabelsOpen}
        onClose={() => setBatchLabelsOpen(false)}
      />

      {/* Escáner Rápido Global (Barra Inferior) */}
      <BarcodeScannerModal
        isOpen={quickScanOpen}
        onClose={() => setQuickScanOpen(false)}
        onScanSuccess={handleQuickScanSuccess}
        title="Escáner Rápido de Producto o Ubicación"
        instructions="Apunta la cámara al código de barras o QR de cualquier producto o estantería."
      />
    </div>
  );
};

export default AppContent;
