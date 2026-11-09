import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { Product, Category, Subcategory, Location } from './types/database';
import { useIsDesktop } from './hooks/useDevice';

// Componentes de Layout y UI
import { BottomNav, TabType } from './components/layout/BottomNav';
import { PendingInvitationsBanner } from './components/ui/PendingInvitationsBanner';
import { AuthPage } from './pages/AuthPage';
const HomePage = React.lazy(() => import('./pages/HomePage'));
import type { LocationSubTab } from './pages/LocationsPage';

// Layout Desktop condicional (cargado solo en viewport de escritorio)
const Sidebar = React.lazy(() => import('./components/layout/Sidebar').then(m => ({ default: m.Sidebar })));
const Navbar = React.lazy(() => import('./components/layout/Navbar').then(m => ({ default: m.Navbar })));

// Vistas secundarias lazy (Code Splitting por dispositivo y ruta)
const InventoryPage = React.lazy(() => import('./pages/InventoryPage'));
const LocationsPage = React.lazy(() => import('./pages/LocationsPage'));
const SalesPage = React.lazy(() => import('./pages/SalesPage'));
const SalesHistoryPage = React.lazy(() => import('./pages/SalesHistoryPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const TermsPage = React.lazy(() => import('./pages/TermsPage'));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'));
const FirstTimeOnboarding = React.lazy(() => import('./components/inventory/FirstTimeOnboarding'));

// Modales Especializados lazy (descargados bajo demanda solo al abrirse)
const ProductFormModal = React.lazy(() => import('./components/modals/ProductFormModal').then(m => ({ default: m.ProductFormModal })));
const ProductDetailModal = React.lazy(() => import('./components/modals/ProductDetailModal').then(m => ({ default: m.ProductDetailModal })));
const MoveProductModal = React.lazy(() => import('./components/modals/MoveProductModal').then(m => ({ default: m.MoveProductModal })));
const WithdrawProductModal = React.lazy(() => import('./components/modals/WithdrawProductModal').then(m => ({ default: m.WithdrawProductModal })));
const CategoriesManagementModal = React.lazy(() => import('./components/modals/CategoriesManagementModal').then(m => ({ default: m.CategoriesManagementModal })));
const LocationsManagementModal = React.lazy(() => import('./components/modals/LocationsManagementModal').then(m => ({ default: m.LocationsManagementModal })));
const CollaboratorsModal = React.lazy(() => import('./components/modals/CollaboratorsModal').then(m => ({ default: m.CollaboratorsModal })));
const InventorySelectorModal = React.lazy(() => import('./components/modals/InventorySelectorModal').then(m => ({ default: m.InventorySelectorModal })));
const BarcodeScannerModal = React.lazy(() => import('./components/modals/BarcodeScannerModal').then(m => ({ default: m.BarcodeScannerModal })));
const RestockProductModal = React.lazy(() => import('./components/modals/RestockProductModal').then(m => ({ default: m.RestockProductModal })));
import { ToastNotification, showAppToast } from './components/ui';
import { syncAllOfflineDataSilently } from './services/offlineSync';

import { Loader2, Layers, Plus, Sparkles } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { user, isInitialAuthCheck, currentInventory, refreshInventories, inventories } = useAuth();
  const isDesktop = useIsDesktop();

  // Control de Rutas Estáticas Públicas (RF-LEGAL-001)
  const [currentPath, setCurrentPath] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Regla lógica: Funcionalidades comerciales solo activas si es NEGOCIO
  const isBusiness = currentInventory?.inventory_type !== 'PERSONAL';

  // Estado de Navegación: Inicialmente en "home" (Dashboard Principal)
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Al iniciar sesión siempre debe iniciar en "home" como primera vista obligatoria
  const prevUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (user && prevUserRef.current !== user.id) {
      setActiveTab('home');
      if (typeof window !== 'undefined' && window.location.pathname !== '/' && window.location.pathname !== '/terms' && window.location.pathname !== '/privacy') {
        window.history.replaceState({}, '', '/');
        setCurrentPath('/');
      }
      prevUserRef.current = user.id;
    } else if (!user) {
      prevUserRef.current = null;
      setActiveTab('home');
    }
  }, [user]);

  // Al cambiar de inventario activo, asegurar el regreso a la vista principal "home"
  const prevInventoryTabRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentInventory && prevInventoryTabRef.current !== currentInventory.id) {
      prevInventoryTabRef.current = currentInventory.id;
      setActiveTab('home');
    }
  }, [currentInventory]);

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

  useEffect(() => {
    if (activeTab !== 'locations') {
      setLocationTargetProduct(null);
    }
  }, [activeTab]);

  const openLocationsWorkspace = (subTab: LocationSubTab = 'assign', prod: Product | null = null) => {
    setLocationSubTab(subTab);
    setLocationTargetProduct(prod);
    setActiveTab('locations');
  };

  // Escáner Rápido Global (Bottom Nav / Sidebar) y Reingreso por Escaneo
  const [quickScanOpen, setQuickScanOpen] = useState(false);
  const [scannedRestockProduct, setScannedRestockProduct] = useState<Product | null>(null);
  const [stockSearchFilter, setStockSearchFilter] = useState<string>('');

  // RNF-PERF-FEEDBACK-004: Aislamiento de Concurrencia y Skeleton Debounced (250ms)
  const [dataLoading, setDataLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevInventoryIdRef = useRef<string | null>(null);

  // Cargar datos del inventario seleccionado cancelando peticiones previas en vuelo
  const fetchInventoryData = useCallback(async () => {
    if (!currentInventory) {
      setProducts([]);
      setCategories([]);
      setSubcategories([]);
      setLocations([]);
      return;
    }

    // 1. Cancelar petición anterior en vuelo al cambiar de almacén
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // 2. Solo limpiar el estado previo si realmente cambiamos de almacén
    // Esto previene que modales abiertos pierdan opciones de categorías/ubicaciones durante revalidaciones silenciosas
    const isDifferentInventory = prevInventoryIdRef.current !== currentInventory.id;
    if (isDifferentInventory) {
      prevInventoryIdRef.current = currentInventory.id;
      setProducts([]);
      setCategories([]);
      setSubcategories([]);
      setLocations([]);
      setDataLoading(true);
    }

    // 3. Temporizador Debounce: Solo activar Skeleton si cambia de almacén y tarda más de 250ms
    const skeletonTimer = setTimeout(() => {
      if (isDifferentInventory) {
        setShowSkeleton(true);
      }
    }, 250);

    try {
      const [prodsRes, catsRes, subRes, locsRes] = await Promise.all([
        supabase
          .from('products')
          .select(`
            *,
            categories (id, name, color),
            subcategories (id, name),
            locations (id, name, code),
            product_locations (
              id,
              location_id,
              quantity,
              locations (id, name, code)
            )
          `)
          .eq('inventory_id', currentInventory.id)
          .order('created_at', { ascending: false })
          .abortSignal(signal),

        supabase
          .from('categories')
          .select('*')
          .eq('inventory_id', currentInventory.id)
          .order('name', { ascending: true })
          .abortSignal(signal),

        supabase
          .from('subcategories')
          .select('*')
          .eq('inventory_id', currentInventory.id)
          .order('name', { ascending: true })
          .abortSignal(signal),

        supabase
          .from('locations')
          .select('*')
          .eq('inventory_id', currentInventory.id)
          .order('name', { ascending: true })
          .abortSignal(signal)
      ]);

      if (signal.aborted) return;

      if (prodsRes.error) throw prodsRes.error;
      if (catsRes.error) throw catsRes.error;
      if (subRes.error) throw subRes.error;
      if (locsRes.error) throw locsRes.error;

      setProducts(prodsRes.data || []);
      setCategories(catsRes.data || []);
      setSubcategories(subRes.data || []);
      setLocations(locsRes.data || []);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching inventory data:', err);
      }
    } finally {
      clearTimeout(skeletonTimer);
      setShowSkeleton(false);
      setDataLoading(false);
    }
  }, [currentInventory]);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  // RF-5: Motor de Sincronización Automática Integral (Creación, Salidas Masivas y Ventas POS)
  useEffect(() => {
    const handleOnline = () => {
      syncAllOfflineDataSilently((summary) => {
        fetchInventoryData();
        if (summary.syncedProducts > 0 || summary.syncedWithdrawals > 0) {
          showAppToast(
            'Sincronización en segundo plano completada con éxito.',
            'success',
            4500
          );
        }
      });
    };

    window.addEventListener('online', handleOnline);

    // Intentar sincronizar al iniciar la aplicación si hay conexión
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchInventoryData]);

  // Sincronización reactiva cuando se restaura una copia de seguridad
  useEffect(() => {
    const handleBackupRestoreUpdated = () => {
      fetchInventoryData();
      refreshInventories();
    };
    window.addEventListener('stockly_inventory_data_updated', handleBackupRestoreUpdated);
    return () => {
      window.removeEventListener('stockly_inventory_data_updated', handleBackupRestoreUpdated);
    };
  }, [fetchInventoryData, refreshInventories]);

  // Inyección reactiva inmediata de productos guardados (soporte offline)
  const handleProductSaved = (savedProduct?: Product) => {
    if (savedProduct) {
      setProducts((prev) => {
        const exists = prev.some((p) => p.id === savedProduct.id);
        if (exists) {
          return prev.map((p) => (p.id === savedProduct.id ? savedProduct : p));
        }
        return [savedProduct, ...prev];
      });
    }
    fetchInventoryData();
  };

  // Descuento reactivo inmediato de stock por salida masiva (soporte offline)
  const handleBulkWithdrawn = (withdrawn: Array<{ product_id: string; quantity: number }>) => {
    setProducts((prev) => {
      const map = new Map(withdrawn.map((w) => [w.product_id, w.quantity]));
      return prev.map((p) => {
        if (map.has(p.id)) {
          const delta = map.get(p.id)!;
          return {
            ...p,
            stock: Math.max(0, Number((p.stock - delta).toFixed(4)))
          };
        }
        return p;
      });
    });
    fetchInventoryData();
  };

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

  // 0. Rutas Estáticas Públicas sin Requerir Sesión (Centro Legal)
  if (currentPath === '/terms') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center font-mono text-xs text-[#616161]">CARGANDO CENTRO LEGAL...</div>}>
        <TermsPage onBack={() => {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('stockly_splash_shown', 'true');
          }
          window.history.pushState({}, '', '/');
          setCurrentPath('/');
        }} />
      </Suspense>
    );
  }

  if (currentPath === '/privacy') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center font-mono text-xs text-[#616161]">CARGANDO CENTRO LEGAL...</div>}>
        <PrivacyPage onBack={() => {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('stockly_splash_shown', 'true');
          }
          window.history.pushState({}, '', '/');
          setCurrentPath('/');
        }} />
      </Suspense>
    );
  }

  // 1. Pantalla de Carga Inicial o Carga de Inventarios (Evita parpadeos de onboarding)
  if (isInitialAuthCheck || (user && inventories === null)) {
    return (
      <main id="main-content" className="min-h-screen bg-black md:bg-[#F8F9FA] flex flex-col items-center justify-center font-mono">
        {/* Móvil: Splash nativo oscuro mínimo y centrado sin elementos web (evita flash blanco) */}
        <div className="flex md:hidden flex-col items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-white/80" />
        </div>

        {/* Desktop: Indicador editorial de carga */}
        <div className="hidden md:flex flex-col items-center justify-center space-y-4 text-[#1E3A5F]">
          <div className="w-12 h-12 rounded-2xl bg-[#1E3A5F] text-[#E8B4A0] flex items-center justify-center shadow-md animate-pulse">
            <Layers className="w-6 h-6 stroke-[1.5]" />
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#616161]">
            <Loader2 className="w-4 h-4 animate-spin text-[#1E3A5F]" />
            <span>INICIANDO INVENTARIO...</span>
          </div>
        </div>
      </main>
    );
  }

  // 2. Pantalla de Autenticación si no hay sesión
  if (!user) {
    return <AuthPage />;
  }

  // RF-INV-044: Onboarding Exclusivo para Primer Inicio
  // UNICAMENTE si la cuenta se registra por primera vez
  const isFirstTimeRegistration =
    Boolean(user) &&
    typeof window !== 'undefined' &&
    localStorage.getItem(`is_new_registration_${user?.id}`) === 'true' &&
    !localStorage.getItem(`onboarding_completed_${user?.id}`);

  // O si el usuario verdaderamente tiene 0 inventarios en base de datos y no ha completado onboarding
  const hasNoInventories =
    Boolean(user) &&
    inventories !== null &&
    inventories.length === 0 &&
    !localStorage.getItem(`onboarding_completed_${user?.id}`);

  if (inventories !== null && (isFirstTimeRegistration || hasNoInventories)) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <FirstTimeOnboarding
          defaultInventoryId={inventories.length > 0 ? inventories[0].id : undefined}
          onComplete={() => {
            if (user?.id) {
              try {
                localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
                localStorage.removeItem(`is_new_registration_${user.id}`);
              } catch (e) {
                console.warn(e);
              }
            }
            setActiveTab('home');
            fetchInventoryData();
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen max-md:fixed max-md:inset-0 max-md:h-[100dvh] max-md:w-full max-md:overflow-hidden md:overflow-visible md:h-auto bg-white md:bg-[#fafafb] text-[#17191c] flex flex-col font-normal selection:bg-[#fbe1d1] selection:text-[#5d2a1a] transition-colors duration-200">
      {/* Sidebar Lateral Fijo Desktop (>= 1024px) - Carga condicional reactiva */}
      {isDesktop && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* Barra de Navegación Superior (Visible en >= 768px) */}
      {isDesktop && (
        <Suspense fallback={null}>
          <Navbar
            activeTab={activeTab}
            onOpenInventorySelector={() => setInventorySelectorOpen(true)}
            onOpenCollaborators={() => setCollaboratorsModalOpen(true)}
            onOpenLocations={() => openLocationsWorkspace('assign')}
            onOpenCategories={() => setCategoriesModalOpen(true)}
            onQuickScan={() => setQuickScanOpen(true)}
          />
        </Suspense>
      )}

      {/* Contenedor Principal Responsive con offset para el Sidebar en Desktop y safe area en móvil */}
      <main id="main-content" className="flex-1 max-w-[1600px] w-full mx-auto px-0 pt-0 md:px-8 md:pt-6 lg:pl-[280px] pb-0 md:pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] lg:pb-16 max-md:h-full max-md:overflow-hidden md:overflow-visible">
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
          <Suspense fallback={<div className="p-12 text-center text-xs font-mono text-[#616161] flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-[#1E3A5F]" /><span>CARGANDO RESUMEN...</span></div>}>
            <HomePage
              products={products}
              onNavigateToStock={() => setActiveTab('inventory')}
              onNavigateToSales={() => setActiveTab('sales')}
              onNavigateToHistory={() => setActiveTab('sales-history')}
              onSelectProduct={(p: Product) => {
                setSelectedProduct(p);
                setProductDetailOpen(true);
              }}
              onQuickScan={() => setQuickScanOpen(true)}
              onOpenCreateModal={() => {
                setProductToEdit(null);
                setProductFormOpen(true);
              }}
            />
          </Suspense>
        )}

        {/* VISTA 2: STOCK (CATÁLOGO DE EXISTENCIAS & RECURSOS) */}
        {activeTab === 'inventory' && (
          <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-[#616161]">CARGANDO EXISTENCIAS...</div>}>
          <InventoryPage
            products={products}
            categories={categories}
            subcategories={subcategories}
            locations={locations}
            onSelectProduct={(p: Product) => {
              setSelectedProduct(p);
              setProductDetailOpen(true);
            }}
            onOpenCreateModal={() => {
              setProductToEdit(null);
              setProductFormOpen(true);
            }}
            onOpenLocationsModule={(sub?: LocationSubTab, prod?: Product | null) => openLocationsWorkspace(sub || 'assign', prod || null)}
            onRefresh={fetchInventoryData}
            onBulkWithdrawn={handleBulkWithdrawn}
            loading={showSkeleton}
            initialSearchTerm={stockSearchFilter}
            onClearInitialSearch={() => setStockSearchFilter('')}
          />
          </Suspense>
        )}

        {/* VISTA 2.B: GESTIÓN DE UBICACIONES (ASIGNAR, CONSULTAR, MOVER, ESTANTES) */}
        {activeTab === 'locations' && (
          <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-[#616161]">CARGANDO UBICACIONES...</div>}>
          <LocationsPage
            products={products}
            locations={locations}
            onRefresh={fetchInventoryData}
            initialSubTab={locationSubTab}
            initialProduct={locationTargetProduct}
            onClearInitialProduct={() => setLocationTargetProduct(null)}
          />
          </Suspense>
        )}

        {/* VISTA 3: TERMINAL DE VENTAS (Solo NEGOCIO) */}
        {activeTab === 'sales' && isBusiness && (
          <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-[#616161]">CARGANDO PUNTO DE VENTA...</div>}>
          <SalesPage
            products={products}
            onSaleCompleted={fetchInventoryData}
            onNavigateToHistory={() => setActiveTab('sales-history')}
          />
          </Suspense>
        )}

        {/* VISTA 4: HISTORIAL DE TRANSACCIONES (Solo NEGOCIO) */}
        {activeTab === 'sales-history' && isBusiness && (
          <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-[#616161]">CARGANDO HISTORIAL DE VENTAS...</div>}>
          <SalesHistoryPage
            onNavigateToSales={() => setActiveTab('sales')}
          />
          </Suspense>
        )}

        {/* VISTA 5: REPORTES Y EXPORTACIÓN */}
        {activeTab === 'reports' && (
          <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-[#616161]">CARGANDO MÓDULO DE REPORTES...</div>}>
          <ReportsPage
            products={products}
            categories={categories}
            subcategories={subcategories}
            locations={locations}
          />
          </Suspense>
        )}

        {/* VISTA 6: ESTADÍSTICAS Y TELEMETRÍA */}
        {activeTab === 'analytics' && (
          <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-[#616161]">CARGANDO TELEMETRÍA Y ESTADÍSTICAS...</div>}>
          <AnalyticsPage
            products={products}
            categories={categories}
            locations={locations}
          />
          </Suspense>
        )}

        {/* VISTA 7: AJUSTES Y CONFIGURACIÓN */}
        {activeTab === 'settings' && (
          <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-[#616161]">CARGANDO AJUSTES...</div>}>
          <SettingsPage
            onOpenCategories={() => setCategoriesModalOpen(true)}
            onOpenLocations={() => setLocationsModalOpen(true)}
            onOpenCollaborators={() => setCollaboratorsModalOpen(true)}
            onOpenInventorySelector={() => setInventorySelectorOpen(true)}
            onRefreshInventoryData={fetchInventoryData}
          />
          </Suspense>
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
      {productFormOpen && (
        <Suspense fallback={null}>
          <ProductFormModal
            isOpen={productFormOpen}
            onClose={() => setProductFormOpen(false)}
            onSaved={handleProductSaved}
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
        </Suspense>
      )}

      {/* 2. Modal de Detalle de Producto (Ficha Técnica Suiza) */}
      {productDetailOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* 3. Modal de Traslado de Ubicación */}
      {moveModalOpen && (
        <Suspense fallback={null}>
          <MoveProductModal
            product={selectedProduct}
            isOpen={moveModalOpen}
            onClose={() => setMoveModalOpen(false)}
            onMoved={fetchInventoryData}
            locations={locations}
          />
        </Suspense>
      )}

      {/* 4. Modal de Retiro / Baja de Stock */}
      {withdrawModalOpen && (
        <Suspense fallback={null}>
          <WithdrawProductModal
            product={selectedProduct}
            isOpen={withdrawModalOpen}
            onClose={() => setWithdrawModalOpen(false)}
            onWithdrawn={fetchInventoryData}
          />
        </Suspense>
      )}

      {/* 5. Modales de Configuración */}
      {categoriesModalOpen && (
        <Suspense fallback={null}>
          <CategoriesManagementModal
            isOpen={categoriesModalOpen}
            onClose={() => setCategoriesModalOpen(false)}
            categories={categories}
            subcategories={subcategories}
            onRefresh={fetchInventoryData}
          />
        </Suspense>
      )}

      {locationsModalOpen && (
        <Suspense fallback={null}>
          <LocationsManagementModal
            isOpen={locationsModalOpen}
            onClose={() => setLocationsModalOpen(false)}
            locations={locations}
            onRefresh={fetchInventoryData}
          />
        </Suspense>
      )}

      {collaboratorsModalOpen && (
        <Suspense fallback={null}>
          <CollaboratorsModal
            isOpen={collaboratorsModalOpen}
            onClose={() => setCollaboratorsModalOpen(false)}
          />
        </Suspense>
      )}

      {inventorySelectorOpen && (
        <Suspense fallback={null}>
          <InventorySelectorModal
            isOpen={inventorySelectorOpen}
            onClose={() => setInventorySelectorOpen(false)}
          />
        </Suspense>
      )}

      {/* Escáner Rápido Global */}
      {quickScanOpen && (
        <Suspense fallback={null}>
          <BarcodeScannerModal
            isOpen={quickScanOpen}
            onClose={() => setQuickScanOpen(false)}
            onScanSuccess={handleQuickScanSuccess}
            title="ESCANEAR CÓDIGO // BÚSQUEDA RÁPIDA"
            instructions="Apunta la cámara al código de barras o QR de cualquier producto o estantería."
          />
        </Suspense>
      )}

      {/* 3.2: Modal de Reingreso de Stock al escanear código existente */}
      {Boolean(scannedRestockProduct) && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}
      {/* Notificación Toast Global Flotante (Zero-UI Alterations) */}
      <ToastNotification />
    </div>
  );
};

export default AppContent;
