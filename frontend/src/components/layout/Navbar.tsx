import React from 'react';
import { ChevronDown, Users, LogOut, Camera } from 'lucide-react';
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
  onOpenInventorySelector,
  onOpenCollaborators,
  onQuickScan
}) => {
  const { currentInventory, user, profile, signOut } = useAuth();

  // Saludo dinámico según la hora local (05:00-11:59 Buenos días | 12:00-18:59 Buenas tardes | 19:00-04:59 Buenas noches)
  const getTimeBasedGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Buenos días';
    if (hour >= 12 && hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
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
    <header className="hidden md:block sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#ececec] transition-colors lg:pl-[260px] pt-[env(safe-area-inset-top,0px)]">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Lado Izquierdo: Saludo Usuario Desktop / Logo Móvil */}
        <div className="flex items-center gap-3">
          {/* Logo en Móvil (Visible solo en < lg) */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="relative w-9 h-9 rounded-xl bg-white border border-[#ececec] overflow-hidden flex items-center justify-center flex-shrink-0 shadow-xs">
              <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              <span
                className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white transition-colors ${
                  isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                title={isOnline ? 'Conectado' : 'Fuera de línea'}
              />
            </div>
            <button
              onClick={onOpenInventorySelector}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#f2f2f3] border-0 rounded-full text-left max-w-[160px] sm:max-w-xs cursor-pointer"
            >
              <span className="text-xs font-medium text-[#17191c] truncate block">
                {currentInventory?.name || 'Seleccionar...'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#777b86] flex-shrink-0" />
            </button>
          </div>

          {/* Saludo Dinámico Editorial en Desktop (>= lg) */}
          <div className="hidden lg:flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              title={isOnline ? 'Conectado a la nube' : 'Modo fuera de línea'}
            />
            <h2 className="text-xl font-serif font-normal text-[#17191c] tracking-tight leading-none">
              {getTimeBasedGreeting()}, <span className="italic font-serif">{displayName}</span>
            </h2>
          </div>
        </div>

        {/* Lado Derecho: Acciones Contextuales y Perfil */}
        <div className="flex items-center gap-3 text-xs">
          {/* Botón de Colaboradores */}
          <button
            onClick={onOpenCollaborators}
            className="inline-flex items-center justify-center gap-2 px-4 min-h-[38px] bg-[#f2f2f3] hover:bg-[#e8e8ea] text-[#17191c] text-xs font-medium rounded-full border-0 transition-colors cursor-pointer"
            title="Equipo y Colaboradores"
          >
            <Users className="w-3.5 h-3.5 stroke-[1.8]" />
            <span className="hidden sm:inline">Equipo</span>
          </button>

          {/* Escáner Móvil Rápido */}
          {onQuickScan && (
            <button
              onClick={onQuickScan}
              className="lg:hidden min-h-[38px] px-4 rounded-full bg-[#fbe1d1] text-[#5d2a1a] hover:bg-[#f8d4bf] flex items-center justify-center gap-1.5 text-xs font-medium transition-all active:scale-95 cursor-pointer"
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
              className="min-h-[36px] min-w-[36px] rounded-full border border-[#ececec] text-[#777b86] hover:text-[#17191c] flex items-center justify-center bg-white cursor-pointer"
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
