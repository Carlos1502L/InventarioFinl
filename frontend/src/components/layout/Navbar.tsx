import React from 'react';
import { ChevronDown, Users, LogOut, Camera, Bell } from 'lucide-react';
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
    <header className="hidden md:block sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 transition-colors lg:pl-[250px] pt-[env(safe-area-inset-top,0px)] font-sans">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        
        {/* Lado Izquierdo: Saludo Usuario Desktop / Logo Tablet */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo en Tablet (< lg) */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="relative w-9 h-9 rounded-xl bg-white border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-xs">
              <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              <span
                className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white transition-colors ${
                  isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                title={isOnline ? 'Conectado' : 'Fuera de línea'}
              />
            </div>
            <button
              type="button"
              onClick={onOpenInventorySelector}
              className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full text-left max-w-[160px] sm:max-w-xs cursor-pointer"
            >
              <span className="text-xs font-medium text-[#0F291E] truncate block">
                {currentInventory?.name || 'Seleccionar...'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
            </button>
          </div>

          {/* Saludo Dinámico al Usuario Logueado (Desktop >= lg) */}
          <div className="hidden lg:flex items-center gap-2.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              title={isOnline ? 'Conectado a la nube' : 'Modo fuera de línea'}
            />
            <h2 className="text-sm sm:text-base font-normal text-neutral-600 tracking-tight leading-none truncate">
              {getTimeBasedGreeting()},{' '}
              <span className="font-semibold text-[#0F291E]">{displayName}</span>
            </h2>
          </div>
        </div>

        {/* Lado Derecho: Acciones Contextuales Refactorizadas */}
        <div className="flex items-center gap-2.5 text-xs">
          
          {/* 1. Pill de estado en tiempo real (Punto verde pulsante + texto) */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F0FDF4] border border-[#DCFCE7] text-[#15803D] text-xs font-medium shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Tiempo real</span>
          </div>

          {/* 2. Botón de Notificaciones (Campana) */}
          <button
            type="button"
            className="w-9 h-9 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/80 text-neutral-600 hover:text-[#0F291E] flex items-center justify-center transition-all shadow-xs cursor-pointer"
            title="Notificaciones"
            aria-label="Notificaciones"
          >
            <Bell className="w-4 h-4 stroke-[1.75]" />
          </button>

          {/* 3. Botón de Equipo / Colaboradores */}
          <button
            type="button"
            onClick={onOpenCollaborators}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 h-9 bg-white hover:bg-gray-50 text-neutral-700 hover:text-[#0F291E] text-xs font-medium rounded-xl border border-gray-200/80 transition-colors shadow-xs cursor-pointer"
            title="Equipo y Colaboradores"
          >
            <Users className="w-3.5 h-3.5 stroke-[1.75]" />
            <span className="hidden sm:inline">Equipo</span>
          </button>

          {/* 4. Botón de Acción Rápida Oscuro */}
          {onQuickScan && (
            <button
              type="button"
              onClick={onQuickScan}
              className="h-9 px-4 rounded-lg bg-[#0F291E] hover:bg-[#1B3D2F] text-white flex items-center justify-center gap-1.5 text-xs font-medium transition-all active:scale-95 shadow-xs cursor-pointer"
              title="Escanear producto"
            >
              <Camera className="w-3.5 h-3.5 text-[#BBF7D0]" />
              <span>Escanear</span>
            </button>
          )}

          {/* Avatar / Salir en Tablet (< lg) */}
          <div className="lg:hidden flex items-center gap-1">
            <button
              type="button"
              onClick={() => signOut()}
              className="h-9 w-9 rounded-xl border border-gray-200 text-neutral-500 hover:text-rose-600 flex items-center justify-center bg-white cursor-pointer"
              title={`Cerrar Sesión (${user?.email})`}
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};

export default Navbar;
