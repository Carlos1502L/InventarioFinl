import React from 'react';
import { ChevronDown, Users, LogOut, Camera, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TabType } from './BottomNav';

interface NavbarProps {
  activeTab?: TabType;
  onOpenInventorySelector: () => void;
  onOpenCollaborators: () => void;
  onOpenLocations: () => void;
  onOpenCategories: () => void;
  onQuickScan?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab = 'home',
  onOpenInventorySelector,
  onOpenCollaborators,
  onQuickScan
}) => {
  const { currentInventory, user, profile, signOut } = useAuth();

  const tabLabels: Record<TabType, string> = {
    home: 'Resumen',
    inventory: 'Inventario & Stock',
    locations: 'Ubicaciones',
    sales: 'Punto de Venta',
    'sales-history': 'Historial de Ventas',
    reports: 'Reportes',
    analytics: 'Métricas',
    settings: 'Configuración'
  };

  const displayName =
    profile?.full_name?.trim() ||
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    user?.email?.split('@')[0] ||
    'Usuario';

  const [isOnline, setIsOnline] = React.useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="hidden md:block sticky top-0 z-30 bg-[#ffffff]/90 backdrop-blur-md border-b border-[#e5e5e5] transition-colors lg:pl-[260px] pt-[env(safe-area-inset-top,0px)] font-sans">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 h-14 flex items-center justify-between gap-4">
        
        {/* Lado Izquierdo: Breadcrumb Trail (Ui Design Spec) / Logo Móvil */}
        <div className="flex items-center gap-3">
          {/* Logo en Móvil (Visible solo en < lg) */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="relative w-8 h-8 rounded-[10px] bg-white border border-[#e5e5e5] overflow-hidden flex items-center justify-center flex-shrink-0 shadow-xs">
              <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              <span
                className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white transition-colors ${
                  isOnline ? 'bg-emerald-500' : 'bg-[#e7000b]'
                }`}
                title={isOnline ? 'Conectado' : 'Fuera de línea'}
              />
            </div>
            <button
              onClick={onOpenInventorySelector}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#f5f5f5] border-0 rounded-[18px] text-left max-w-[160px] sm:max-w-xs cursor-pointer"
            >
              <span className="text-xs font-medium text-[#0a0a0a] truncate block">
                {currentInventory?.name || 'Seleccionar...'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#737373] flex-shrink-0" />
            </button>
          </div>

          {/* Breadcrumb Trail en Desktop (>= lg) */}
          <div className="hidden lg:flex items-center gap-2 text-sm">
            <span className="text-[#737373] font-normal hover:text-[#0a0a0a] transition-colors">
              Stockly
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#737373] stroke-[1.5]" />
            <span className="text-[#0a0a0a] font-medium tracking-tight">
              {tabLabels[activeTab] || 'Módulo'}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ml-1.5 transition-colors ${
                isOnline ? 'bg-emerald-500' : 'bg-[#e7000b]'
              }`}
              title={isOnline ? 'Conectado a la nube' : 'Modo fuera de línea'}
            />
          </div>
        </div>

        {/* Lado Derecho: Acciones Contextuales y Perfil */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* Botón de Colaboradores (Secondary Ghost Button - 18px radius) */}
          <button
            onClick={onOpenCollaborators}
            className="inline-flex items-center justify-center gap-2 px-3.5 min-h-[34px] bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] text-xs font-medium rounded-[18px] border-0 transition-colors cursor-pointer"
            title="Equipo y Colaboradores"
          >
            <Users className="w-3.5 h-3.5 stroke-[1.8]" />
            <span className="hidden sm:inline">Equipo</span>
          </button>

          {/* Escáner Móvil Rápido */}
          {onQuickScan && (
            <button
              onClick={onQuickScan}
              className="lg:hidden min-h-[34px] px-3.5 rounded-[18px] bg-[#f5f5f5] text-[#0a0a0a] hover:bg-[#ebebeb] flex items-center justify-center gap-1.5 text-xs font-medium transition-all active:scale-95 cursor-pointer"
              title="Escanear"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Escanear</span>
            </button>
          )}

          {/* Avatar de Usuario en Móvil */}
          <div className="lg:hidden flex items-center gap-1">
            <button
              onClick={() => signOut()}
              className="min-h-[34px] min-w-[34px] rounded-[18px] border border-[#e5e5e5] text-[#737373] hover:text-[#e7000b] flex items-center justify-center bg-white cursor-pointer"
              title={`Cerrar Sesión (${user?.email})`}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};
