import React from 'react';
import { Layers, ChevronDown, Users, LogOut, MapPin, Tag, Search, Camera, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
  onOpenLocations,
  onOpenCategories,
  onQuickScan
}) => {
  const { currentInventory, user, signOut } = useAuth();

  // Mapeo de títulos según pestaña activa
  const tabTitles: Record<TabType, { title: string; subtitle: string }> = {
    'home': { title: 'PANEL DE CONTROL', subtitle: 'Resumen operacional y métricas clave de stock' },
    'inventory': { title: 'CATÁLOGO DE EXISTENCIAS', subtitle: 'Listado técnico, filtros y control de unidades' },
    'sales': { title: 'TERMINAL DE VENTAS', subtitle: 'Registro rápido de transacciones comerciales y cobros' },
    'sales-history': { title: 'HISTORIAL DE VENTAS', subtitle: 'Trazabilidad y registro fiscal de salidas' },
    'reports': { title: 'REPORTES & EXPORTACIÓN', subtitle: 'Auditoría, kardex e informes en PDF / Excel' },
    'analytics': { title: 'TELEMETRÍA & OCUPACIÓN', subtitle: 'Estadísticas de rotación y capacidad física' },
    'settings': { title: 'CONFIGURACIÓN DE DEPÓSITO', subtitle: 'Gestión de categorías, ubicaciones y equipo' },
  };

  const currentInfo = tabTitles[activeTab] || tabTitles.home;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] transition-colors lg:pl-[250px] pt-[env(safe-area-inset-top,0px)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        
        {/* Lado Izquierdo: Título Desktop / Logo Móvil */}
        <div className="flex items-center gap-3">
          {/* Logo en Móvil (Visible solo en < lg) */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#E5E7EB] overflow-hidden flex items-center justify-center flex-shrink-0 shadow-xs">
              <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" />
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

          {/* Título de Sección y Subtítulo (Desktop >= lg) */}
          <div className="hidden lg:block">
            <h2 className="text-base font-light text-[#1E3A5F] uppercase tracking-wide leading-none">
              {currentInfo.title}
            </h2>
            <p className="text-[11px] text-[#616161] mt-0.5 font-light">
              {currentInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Lado Derecho: Acciones Contextuales y Perfil */}
        <div className="flex items-center gap-2.5 font-mono text-xs">
          
          {/* Botón de Categorías (Visible en desktop) */}
          <button
            onClick={onOpenCategories}
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 min-h-[36px] bg-white hover:bg-[#F8F9FA] text-[#1E3A5F] text-xs uppercase tracking-wider rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] transition-colors shadow-sm"
            title="Categorías y Subcategorías"
          >
            <Tag className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>CATEGORÍAS</span>
          </button>

          {/* Botón de Ubicaciones (Visible en desktop) */}
          <button
            onClick={onOpenLocations}
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 min-h-[36px] bg-white hover:bg-[#F8F9FA] text-[#1E3A5F] text-xs uppercase tracking-wider rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] transition-colors shadow-sm"
            title="Ubicaciones Físicas"
          >
            <MapPin className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>UBICACIONES</span>
          </button>

          {/* Botón de Colaboradores */}
          <button
            onClick={onOpenCollaborators}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 min-h-[36px] bg-white hover:bg-[#F8F9FA] text-[#1E3A5F] text-xs uppercase tracking-wider rounded-full border border-[#E5E7EB] hover:border-[#1E3A5F] transition-colors shadow-sm"
            title="Equipo y Colaboradores"
          >
            <Users className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>EQUIPO</span>
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
