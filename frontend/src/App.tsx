import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { Product, Category, Subcategory, Location } from './types/database';

// Componentes y Vistas
import { Navbar } from './components/Navbar';
import { BottomNav, TabType } from './components/BottomNav';
import { AuthPage } from './pages/AuthPage';
import { InventoryPage } from './pages/InventoryPage';
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

import { Loader2, Layers } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { user, loading: authLoading, currentInventory, needsInventorySelection, setNeedsInventorySelection } = useAuth();

  // Estado de Navegación
  const [activeTab, setActiveTab] = useState<TabType>('inventory');

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
      alert(`Código detectado de Ubicación: ${matchedLocation.name} (${matchedLocation.code}). Filtrando productos...`);
      return;
    }

    // 3. Si no existe, preguntar si desea registrarlo como nuevo producto
    if (confirm(`Código escaneado: "${code}"\nNo está registrado en el inventario. ¿Deseas crear un nuevo producto con este código?`)) {
      setProductToEdit(null);
      setProductFormOpen(true);
    }
  };

  // 1. Pantalla de Carga Inicial
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-600/30 animate-pulse">
          <Layers className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span>Iniciando plataforma de inventario...</span>
        </div>
      </div>
    );
  }

  // 2. Pantalla de Autenticación si no hay sesión
  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Barra de Navegación Superior */}
      <Navbar
        onOpenInventorySelector={() => setInventorySelectorOpen(true)}
        onOpenCollaborators={() => setCollaboratorsModalOpen(true)}
        onOpenLocations={() => setLocationsModalOpen(true)}
        onOpenCategories={() => setCategoriesModalOpen(true)}
      />

      {/* Contenedor Principal Responsive */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5">
        {/* Pestañas de Navegación Desktop */}
        <div className="hidden sm:flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'inventory'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            📦 Módulo Inventario
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'reports'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            📄 Reportes y Exportación
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            📊 Estadísticas y Ocupación
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            ⚙️ Configuración y Catálogo
          </button>
        </div>

        {/* Vista Activa */}
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

        {activeTab === 'reports' && (
          <ReportsPage
            products={products}
            categories={categories}
            subcategories={subcategories}
            locations={locations}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsPage
            products={products}
            categories={categories}
            locations={locations}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPage
            onOpenCategories={() => setCategoriesModalOpen(true)}
            onOpenLocations={() => setLocationsModalOpen(true)}
            onOpenCollaborators={() => setCollaboratorsModalOpen(true)}
            onOpenInventorySelector={() => setInventorySelectorOpen(true)}
          />
        )}
      </main>

      {/* Barra de Navegación Inferior Mobile-First */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onQuickScan={() => setQuickScanOpen(true)}
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

      {/* 3. Modal de Mover Ubicación Física */}
      <MoveProductModal
        product={selectedProduct}
        isOpen={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        onMoved={() => {
          fetchInventoryData();
          if (selectedProduct) {
            // Refrescar producto seleccionado
            supabase
              .from('products')
              .select('*, categories(*), subcategories(*), locations(*)')
              .eq('id', selectedProduct.id)
              .single()
              .then(({ data }) => {
                if (data) setSelectedProduct(data);
              });
          }
        }}
        locations={locations}
      />

      {/* 4. Modal de Retirar / Dar de Baja */}
      <WithdrawProductModal
        product={selectedProduct}
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        onWithdrawn={fetchInventoryData}
      />

      {/* 5. Modal de Categorías y Subcategorías Dinámicas */}
      <CategoriesManagementModal
        isOpen={categoriesModalOpen}
        onClose={() => setCategoriesModalOpen(false)}
        categories={categories}
        subcategories={subcategories}
        onRefresh={fetchInventoryData}
      />

      {/* 6. Modal de Ubicaciones Físicas y Etiquetas (85.6 × 53.9 mm) */}
      <LocationsManagementModal
        isOpen={locationsModalOpen}
        onClose={() => setLocationsModalOpen(false)}
        locations={locations}
        onRefresh={fetchInventoryData}
      />

      {/* 7. Modal de Colaboradores e Invitaciones */}
      <CollaboratorsModal
        isOpen={collaboratorsModalOpen}
        onClose={() => setCollaboratorsModalOpen(false)}
      />

      {/* 8. Selector de Inventario ("¿A qué inventario deseas ingresar hoy?") */}
      <InventorySelectorModal
        isOpen={inventorySelectorOpen || needsInventorySelection}
        onClose={() => {
          setInventorySelectorOpen(false);
          setNeedsInventorySelection(false);
        }}
      />

      {/* 9. Escáner Rápido de Cámara (Bottom Bar) */}
      <BarcodeScannerModal
        isOpen={quickScanOpen}
        onClose={() => setQuickScanOpen(false)}
        onScanSuccess={handleQuickScanSuccess}
        title="Escáner Rápido de Código"
        instructions="Escanea cualquier código de producto o QR de ubicación física para abrirlo al instante."
      />
    </div>
  );
};

export default function App() {
  return <AppContent />;
}
