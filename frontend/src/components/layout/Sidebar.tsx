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
  User,
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
  const { currentInventory, user, signOut } = useAuth();

  const navItems = [
    { id: 'home' as TabType, label: 'HOME // RESUMEN', icon: LayoutDashboard },
    { id: 'inventory' as TabType, label: 'STOCK // CATÁLOGO', icon: Package },
    { id: 'locations' as TabType, label: 'UBICACIONES // ALMACÉN', icon: MapPin },
    ...(isBusiness ? [
      { id: 'sales' as TabType, label: 'PUNTO DE VENTA', icon: ShoppingCart },
      { id: 'sales-history' as TabType, label: 'HISTORIAL VENTAS', icon: Receipt },
    ] : []),
    { id: 'reports' as TabType, label: 'REPORTES AUDITORÍA', icon: FileText },
    { id: 'analytics' as TabType, label: 'TELEMETRÍA STOCK', icon: BarChart3 },
    { id: 'settings' as TabType, label: 'CONFIGURACIÓN', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-[250px] h-screen bg-[#1E3A5F] z-40 text-white select-none border-r border-[#172E4C] shadow-sm">
      {/* 1. SECCIÓN SUPERIOR: LOGO Y SELECTOR DE DEPÓSITO */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/20 shadow-xs">
            <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="font-mono text-sm uppercase tracking-[0.2em] text-[#E8B4A0] font-bold block leading-tight">
              STOCKLY
            </span>
            <span className="text-[10px] text-white/70 font-semibold tracking-wider uppercase block">
              INVENTORY APP
            </span>
          </div>
        </div>

        {/* Depósito Activo (Chip Selector) */}
        <button
          onClick={onOpenInventorySelector}
          className="w-full text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center justify-between group"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[9px] font-mono uppercase tracking-widest text-[#E8B4A0] block">
              DEPÓSITO ACTIVO
            </span>
            <span className="text-xs font-bold text-white uppercase truncate block group-hover:underline">
              {currentInventory?.name || 'SELECCIONAR...'}
            </span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-white/40 group-hover:text-white flex-shrink-0" />
        </button>
      </div>

      {/* 2. SECCIÓN CENTRAL: MENÚ DE NAVEGACIÓN VERTICAL */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 font-mono text-xs">
        <span className="px-3 text-[9px] uppercase tracking-[0.2em] text-[#E8B4A0]/80 font-semibold block mb-2">
          MÓDULOS DEL SISTEMA
        </span>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left ${
                isActive
                  ? 'bg-[#E8B4A0] text-[#1E3A5F] font-semibold shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2]' : 'stroke-[1.5]'}`} />
              <span className="uppercase tracking-wider text-[11px] truncate">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Acceso Rápido: Escáner Central */}
        <div className="pt-4">
          <button
            onClick={onQuickScan}
            className="w-full min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-[#E8B4A0] hover:text-[#1E3A5F] text-[#E8B4A0] border border-[#E8B4A0]/30 transition-all flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-wider"
          >
            <Camera className="w-4 h-4 stroke-[1.5]" />
            <span>ESCANEAR CÓDIGO</span>
          </button>
        </div>
      </div>

      {/* 3. SECCIÓN INFERIOR: PERFIL DE USUARIO & SALIR */}
      <div className="p-4 border-t border-white/10 bg-[#172E4C] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 text-[#E8B4A0]">
            <User className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-white/90 truncate block font-sans">
              {user?.email?.split('@')[0] || 'Usuario'}
            </span>
            <span className="text-[9px] font-mono text-white/50 truncate block">
              {user?.email || ''}
            </span>
          </div>
        </div>

        <button
          onClick={() => signOut()}
          className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-rose-300 transition-colors flex-shrink-0"
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
