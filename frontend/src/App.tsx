import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { MotionConfig } from 'framer-motion';
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
const ProductMasterModal = React.lazy(() => import('./components/modals/ProductMasterModal').then(m => ({ default: m.ProductMasterModal })));
import type { ProductModalView } from './components/modals/ProductMasterModal';
const WithdrawProductModal = React.lazy(() => import('./components/modals/WithdrawProductModal').then(m => ({ default: m.WithdrawProductModal })));
const CategoriesManagementModal = React.lazy(() => import('./components/modals/CategoriesManagementModal').then(m => ({ default: m.CategoriesManagementModal })));
const LocationsManagementModal = React.lazy(() => import('./components/modals/LocationsManagementModal').then(m => ({ default: m.LocationsManagementModal })));
const CollaboratorsModal = React.lazy(() => import('./components/modals/CollaboratorsModal').then(m => ({ default: m.CollaboratorsModal })));
const InventorySelectorModal = React.lazy(() => import('./components/modals/InventorySelectorModal').then(m => ({ default: m.InventorySelectorModal })));
const BarcodeScannerModal = React.lazy(() => import('./components/modals/BarcodeScannerModal').then(m => ({ default: m.BarcodeScannerModal })));
import { ToastNotification, showAppToast } from './components/ui';
import { LazyModalSlot } from './components/common/LazyModalSlot';
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
  const [masterModalOpen, setMasterModalOpen] = useState(false);
  const [masterModalInitialView, setMasterModalInitialView] = useState<ProductModalView>('DETAIL');
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  const openProductMasterModal = useCallback((prod: Product | null, view: ProductModalView) => {
    setSelectedProduct(prod);
    setMasterModalInitialView(view);
    setMasterModalOpen(true);
  }, []);

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
      openProductMasterModal(matchedProduct, 'RESTOCK');
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
      openProductMasterModal(null, 'EDIT');
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

        {/* Desktop: Indicador industrial de carga */}
        <div className="hidden md:flex flex-col items-center justify-center space-y-3.5 text-slate-900 font-sans">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-slate-50 flex items-center justify-center shadow-sm">
            <Layers className="w-5 h-5 stroke-[1.75]" />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium tracking-tight text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
            <span>Iniciando espacio de trabajo...</span>
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
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen max-md:fixed max-md:inset-0 max-md:h-[100dvh] max-md:w-full max-md:overflow-hidden md:overflow-visible md:h-auto bg-white lg:bg-[#f4f6f8] text-[#0a0a0a] lg:text-slate-900 flex flex-col font-normal selection:bg-slate-900 selection:text-slate-50 transition-colors duration-150">
      {/* Sidebar Lateral Fijo Desktop (>= 1024px) - Carga condicional reactiva */}
      {isDesktop && (
        <Suspense fallback={null}>
          <Sidebar
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            onOpenCreateModal={() => openProductMasterModal(null, 'EDIT')}
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

      {/* Contenedor Principal Responsive con offset para el Sidebar en Desktop y alineación exacta con Navbar */}
      <main id="main-content" className="flex-1 w-full px-0 pt-0 md:pt-6 lg:pl-[260px] pb-0 md:pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] lg:pb-16 max-md:h-full max-md:overflow-hidden md:overflow-visible">
        <div className="w-full h-full md:max-w-[1440px] md:mx-auto md:px-8">
        {/* Banner de Invitaciones Pendientes */}
        <div className="px-4 md:px-0">
          <PendingInvitationsBanner />
        </div>

        {/* Banner si el usuario no tiene inventario activo */}
        {!currentInventory && (
          <div className="mx-4 md:mx-0 mt-4 md:mt-0 mb-6 p-5 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm font-sans">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-slate-50 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 stroke-[1.75]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                  Depósito de trabajo no seleccionado
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Para comenzar a indexar existencias y operar el punto de venta, selecciona o crea tu primer depósito.
                </p>
              </div>
            </div>
            <button
              onClick={() => setInventorySelectorOpen(true)}
              className="w-full sm:w-auto min-h-[38px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2]" /> Seleccionar depósito
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
              onSelectProduct={(p: Product) => openProductMasterModal(p, 'DETAIL')}
              onQuickScan={() => setQuickScanOpen(true)}
              onOpenCreateModal={() => openProductMasterModal(null, 'EDIT')}
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
            onSelectProduct={(p: Product) => openProductMasterModal(p, 'DETAIL')}
            onOpenCreateModal={() => openProductMasterModal(null, 'EDIT')}
            onOpenLocationsModule={(sub?: LocationSubTab, prod?: Product | null) => openLocationsWorkspace(sub || 'assign', prod || null)}
            onRefresh={fetchInventoryData}
            onWithdrawProduct={(p: Product) => {
              setSelectedProduct(p);
              setWithdrawModalOpen(true);
            }}
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
          <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-slate-500">Cargando ajustes...</div>}>
          <SettingsPage
            onOpenCategories={() => setCategoriesModalOpen(true)}
            onOpenLocations={() => setLocationsModalOpen(true)}
            onOpenCollaborators={() => setCollaboratorsModalOpen(true)}
            onOpenInventorySelector={() => setInventorySelectorOpen(true)}
            onRefreshInventoryData={fetchInventoryData}
          />
          </Suspense>
        )}
        </div>
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
      <LazyModalSlot open={masterModalOpen}>
        <ProductMasterModal
          isOpen={masterModalOpen}
          onClose={() => setMasterModalOpen(false)}
          product={selectedProduct}
          initialView={masterModalInitialView}
          categories={categories}
          subcategories={subcategories}
          locations={locations}
          products={products}
          onSelectProduct={(p) => setSelectedProduct(p)}
          onSaved={handleProductSaved}
          onUpdated={fetchInventoryData}
          onRestocked={fetchInventoryData}
          onMoved={fetchInventoryData}
          onAssignLocation={(p) => {
            setMasterModalOpen(false);
            openLocationsWorkspace('assign', p);
          }}
          onWithdraw={(p) => {
            setMasterModalOpen(false);
            setSelectedProduct(p);
            setWithdrawModalOpen(true);
          }}
          onRedirectToStock={(prod) => {
            setMasterModalOpen(false);
            setStockSearchFilter(prod.code);
            setActiveTab('inventory');
            openProductMasterModal(prod, 'RESTOCK');
          }}
        />
      </LazyModalSlot>

      <LazyModalSlot open={withdrawModalOpen}>
          <WithdrawProductModal
            product={selectedProduct}
            isOpen={withdrawModalOpen}
            onClose={() => setWithdrawModalOpen(false)}
            onWithdrawn={fetchInventoryData}
          />
        </LazyModalSlot>

      {/* 5. Modales de Configuración */}
      <LazyModalSlot open={categoriesModalOpen}>
          <CategoriesManagementModal
            isOpen={categoriesModalOpen}
            onClose={() => setCategoriesModalOpen(false)}
            categories={categories}
            subcategories={subcategories}
            onRefresh={fetchInventoryData}
          />
        </LazyModalSlot>

      <LazyModalSlot open={locationsModalOpen}>
          <LocationsManagementModal
            isOpen={locationsModalOpen}
            onClose={() => setLocationsModalOpen(false)}
            locations={locations}
            onRefresh={fetchInventoryData}
          />
        </LazyModalSlot>

      <LazyModalSlot open={collaboratorsModalOpen}>
          <CollaboratorsModal
            isOpen={collaboratorsModalOpen}
            onClose={() => setCollaboratorsModalOpen(false)}
          />
        </LazyModalSlot>

      <LazyModalSlot open={inventorySelectorOpen}>
          <InventorySelectorModal
            isOpen={inventorySelectorOpen}
            onClose={() => setInventorySelectorOpen(false)}
          />
        </LazyModalSlot>

      {/* Escáner Rápido Global */}
      <LazyModalSlot open={quickScanOpen}>
          <BarcodeScannerModal
            isOpen={quickScanOpen}
            onClose={() => setQuickScanOpen(false)}
            onScanSuccess={handleQuickScanSuccess}
            title="ESCANEAR CÓDIGO // BÚSQUEDA RÁPIDA"
            instructions="Apunta la cámara al código de barras o QR de cualquier producto o estantería."
          />
        </LazyModalSlot>

      {/* Notificación Toast Global Flotante (Zero-UI Alterations) */}
      <ToastNotification />
    </div>
    </MotionConfig>
  );
};

export default AppContent;
