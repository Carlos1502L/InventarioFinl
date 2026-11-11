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
    <header className="hidden md:block sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 transition-colors lg:pl-[260px] pt-[env(safe-area-inset-top,0px)] font-sans">
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
            <span className="text-slate-500 font-normal">
              Stockly
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 stroke-[1.75]" />
            <span className="text-slate-900 font-semibold tracking-tight">
              {tabLabels[activeTab] || 'Módulo'}
            </span>
            {currentInventory?.name && (
              <span className="hidden xl:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-600 ml-1 max-w-[180px] truncate">
                {currentInventory.name}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-mono text-[10px] font-medium ml-1 transition-colors ${
                isOnline
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
              title={isOnline ? 'Conectado a la nube' : 'Modo fuera de línea'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {isOnline ? 'SYNC' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Lado Derecho: Acciones Contextuales y Perfil */}
        <div className="flex items-center gap-2 text-xs">
          {/* Acceso rápido escáner en Desktop */}
          {onQuickScan && (
            <button
              onClick={onQuickScan}
              className="hidden lg:inline-flex items-center justify-center gap-1.5 px-3 min-h-[34px] bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-medium rounded-xl border border-slate-200 hover:border-slate-300 transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] cursor-pointer"
              title="Escáner rápido"
            >
              <Camera className="w-3.5 h-3.5 stroke-[1.8]" />
              <span>Escanear</span>
            </button>
          )}

          {/* Botón de Colaboradores */}
          <button
            onClick={onOpenCollaborators}
            className="inline-flex items-center justify-center gap-2 px-3.5 min-h-[34px] bg-[#f5f5f5] lg:bg-slate-100 hover:bg-[#ebebeb] lg:hover:bg-slate-200/70 text-[#0a0a0a] lg:text-slate-900 text-xs font-medium rounded-[18px] lg:rounded-xl border-0 lg:border lg:border-slate-200/80 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] cursor-pointer"
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
