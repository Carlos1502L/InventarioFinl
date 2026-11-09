import React from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  FileText,
  BarChart3,
  Settings,
  Camera,
  LogOut,
  ChevronRight,
  MapPin
} from 'lucide-react';
import { TabType } from './BottomNav';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onQuickScan?: () => void;
  onOpenCreateModal?: () => void;
  onOpenInventorySelector?: () => void;
  onOpenCategories?: () => void;
  onOpenLocations?: () => void;
  onOpenCollaborators?: () => void;
  isBusiness?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChangeTab,
  onQuickScan,
  onOpenInventorySelector,
  isBusiness = true
}) => {
  const { currentInventory, user, profile, signOut } = useAuth();

  const displayName =
    profile?.full_name?.trim() ||
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    user?.email?.split('@')[0] ||
    'Usuario';

  const userInitial = displayName.charAt(0).toUpperCase() || 'U';

  const navItems = [
    { id: 'home' as TabType, title: 'Resumen', subtitle: 'Panel principal', icon: LayoutDashboard },
    { id: 'inventory' as TabType, title: 'Stock', subtitle: 'Catálogo', icon: Package },
    { id: 'locations' as TabType, title: 'Ubicaciones', subtitle: 'Almacén', icon: MapPin },
    ...(isBusiness ? [
      { id: 'sales' as TabType, title: 'Punto de Venta', subtitle: 'POS', icon: ShoppingCart },
      { id: 'sales-history' as TabType, title: 'Historial Ventas', subtitle: 'Tickets y arqueo', icon: Receipt },
    ] : []),
    { id: 'reports' as TabType, title: 'Reportes Auditoría', subtitle: 'Auditoría', icon: FileText },
    { id: 'analytics' as TabType, title: 'Telemetría', subtitle: 'Analíticas', icon: BarChart3 },
    { id: 'settings' as TabType, title: 'Configuración', subtitle: 'Preferencias', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-[250px] h-screen bg-[#0F291E] z-40 text-white select-none border-r border-[#1B3D2F]/70 shadow-sm font-sans">
      {/* 1. SECCIÓN SUPERIOR: LOGO Y SELECTOR DE DEPÓSITO */}
      <div className="p-5 border-b border-white/10 space-y-4">
        {/* Logo y Nombre Stockly */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#1B3D2F] border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs">
            <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
          <div className="min-w-0">
            <span className="text-base font-bold tracking-tight text-white block leading-none">
              Stockly
            </span>
            <span className="text-[11px] text-white/50 font-normal mt-1 block">
              Gestión de inventario
            </span>
          </div>
        </div>

        {/* Depósito Activo (Card Redondeada bg-[#1B3D2F]) */}
        <button
          type="button"
          onClick={onOpenInventorySelector}
          className="w-full text-left p-3 rounded-2xl bg-[#1B3D2F] hover:bg-[#224A3A] border border-white/10 transition-all flex items-center justify-between group cursor-pointer shadow-xs"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[10px] font-medium tracking-wider text-white/45 uppercase block leading-none">
              DEPÓSITO ACTIVO
            </span>
            <span className="text-xs font-semibold text-white truncate block mt-1">
              {currentInventory?.name || 'Seleccionar...'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white transition-colors flex-shrink-0" />
        </button>
      </div>

      {/* 2. SECCIÓN CENTRAL: MENÚ DE NAVEGACIÓN VERTICAL */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <span className="px-3 text-[10px] uppercase tracking-wider text-white/40 font-semibold block mb-2">
          Módulos
        </span>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer group ${
                isActive
                  ? 'bg-[#1B3D2F] text-white shadow-xs'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#BBF7D0] stroke-[2]' : 'text-white/60 group-hover:text-white stroke-[1.75]'
                  }`}
                />
                <div className="min-w-0">
                  <span
                    className={`text-sm block truncate leading-tight ${
                      isActive ? 'font-semibold text-white' : 'font-medium text-white/90'
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="text-xs text-white/45 block truncate font-normal mt-0.5">
                    {item.subtitle}
                  </span>
                </div>
              </div>

              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#BBF7D0] shrink-0 ml-2" />
              )}
            </button>
          );
        })}
      </div>

      {/* 3. SECCIÓN INFERIOR: BOTÓN ESCANEAR & PERFIL DE USUARIO */}
      <div className="p-4 border-t border-white/10 space-y-3 bg-[#0F291E]">
        {/* Botón rápido Escanear (Píldora Menta) */}
        {onQuickScan && (
          <button
            type="button"
            onClick={onQuickScan}
            className="w-full py-2.5 px-3.5 rounded-full bg-[#BBF7D0] hover:bg-[#A7F3D0] text-[#0F291E] transition-all flex items-center justify-between shadow-xs active:scale-95 cursor-pointer font-medium"
            title="Escanear producto"
          >
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#0F291E]" />
              <span className="text-xs font-semibold">Escanear</span>
            </div>
            <kbd className="text-[10px] font-mono font-bold bg-[#0F291E]/10 text-[#0F291E] px-1.5 py-0.5 rounded">
              ⌘ K
            </kbd>
          </button>
        )}

        {/* Perfil de Usuario */}
        <div className="flex items-center justify-between gap-2.5 pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#1B3D2F] border border-white/10 flex items-center justify-center flex-shrink-0 text-[#BBF7D0] font-semibold text-xs shadow-xs">
              {userInitial}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-white/90 truncate block leading-tight">
                {displayName}
              </span>
              <span className="text-[10px] text-white/45 truncate block mt-0.5">
                {user?.email || 'Sesión activa'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signOut()}
            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-rose-300 transition-colors flex-shrink-0 cursor-pointer"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
