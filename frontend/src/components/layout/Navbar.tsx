import React from 'react';
import { ChevronDown, Users, LogOut, MapPin, Tag, Camera } from 'lucide-react';
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
  activeTab,
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

  return (
    <header className="hidden md:block sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] transition-colors lg:pl-[250px] pt-[env(safe-area-inset-top,0px)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        
        {/* Lado Izquierdo: Saludo Usuario Desktop / Logo Móvil */}
        <div className="flex items-center gap-3">
          {/* Logo en Móvil (Visible solo en < lg) */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#E5E7EB] overflow-hidden flex items-center justify-center flex-shrink-0 shadow-xs">
              <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            </div>
            <button
              onClick={onOpenInventorySelector}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-full text-left max-w-[160px] sm:max-w-xs"
            >
              <span className="text-xs font-normal uppercase text-[#1E3A5F] truncate block">
                {currentInventory?.name || 'Seleccionar...'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#616161] flex-shrink-0" />
            </button>
          </div>

          {/* Saludo Dinámico según la hora al Usuario Logueado (Desktop >= lg) */}
          <div className="hidden lg:block">
            <h2 className="text-base sm:text-lg font-bold text-[#1E3A5F] tracking-tight leading-none">
              {getTimeBasedGreeting()}: <span className="font-semibold text-[#1E3A5F]">{displayName}</span>
            </h2>
          </div>
        </div>

        {/* Lado Derecho: Acciones Contextuales y Perfil */}
        <div className="flex items-center gap-2.5 font-mono text-xs">
          
          {/* Botón de Colaboradores */}
          <button
            onClick={onOpenCollaborators}
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 min-h-[36px] min-w-[36px] bg-white hover:bg-[#F8F9FA] text-[#1E3A5F] text-xs uppercase tracking-wider rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] transition-colors shadow-sm"
            title="Equipo y Colaboradores"
          >
            <Users className="w-3.5 h-3.5 stroke-[1.5]" />
            <span className="hidden sm:inline">EQUIPO</span>
          </button>

          {/* Escáner Móvil Rápido */}
          {onQuickScan && (
            <button
              onClick={onQuickScan}
              className="lg:hidden min-h-[36px] px-3 rounded-full bg-[#1E3A5F] text-white flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider"
              title="Escanear"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Avatar de Usuario en Móvil */}
          <div className="lg:hidden flex items-center gap-1">
            <button
              onClick={() => signOut()}
              className="min-h-[36px] min-w-[36px] rounded-full border border-[#E5E7EB] text-[#616161] hover:text-[#1E3A5F] flex items-center justify-center bg-white"
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
