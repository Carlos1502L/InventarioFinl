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
    { id: 'home' as TabType, label: 'Resumen', icon: LayoutDashboard },
    { id: 'inventory' as TabType, label: 'Inventario & Stock', icon: Package },
    { id: 'locations' as TabType, label: 'Ubicaciones', icon: MapPin },
    ...(isBusiness ? [
      { id: 'sales' as TabType, label: 'Punto de Venta', icon: ShoppingCart },
      { id: 'sales-history' as TabType, label: 'Historial de Ventas', icon: Receipt },
    ] : []),
    { id: 'reports' as TabType, label: 'Reportes', icon: FileText },
    { id: 'analytics' as TabType, label: 'Métricas', icon: BarChart3 },
    { id: 'settings' as TabType, label: 'Configuración', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-[260px] h-screen bg-[#fafafa] z-40 text-[#0a0a0a] select-none border-r border-[#e5e5e5] font-sans">
      {/* 1. SECCIÓN SUPERIOR: LOGO Y SELECTOR DE DEPÓSITO */}
      <div className="p-5 border-b border-[#e5e5e5]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-[10px] bg-[#0a0a0a] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs">
            <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
          <div>
            <span className="text-base font-semibold tracking-[-0.03em] text-[#0a0a0a] block leading-tight">
              Stockly
            </span>
            <span className="text-[12px] text-[#737373] font-normal tracking-normal block">
              Inventory System
            </span>
          </div>
        </div>

        {/* Depósito Activo (Surface Alt / Ghost Input Affordance) */}
        <button
          onClick={onOpenInventorySelector}
          className="w-full text-left p-2.5 rounded-[18px] bg-[#f5f5f5] hover:bg-[#ebebeb] border border-transparent hover:border-[#e5e5e5] transition-all flex items-center justify-between group cursor-pointer"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[11px] uppercase tracking-[0.05em] text-[#737373] font-medium block">
              Depósito
            </span>
            <span className="text-xs font-medium text-[#0a0a0a] truncate block">
              {currentInventory?.name || 'Seleccionar...'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-[#0a0a0a] flex-shrink-0 transition-colors" />
        </button>
      </div>

      {/* 2. SECCIÓN CENTRAL: MENÚ DE NAVEGACIÓN VERTICAL */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1 text-sm">
        <span className="px-3 text-[11px] uppercase tracking-[0.05em] text-[#737373] font-medium block mb-2">
          Módulos
        </span>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-[18px] transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-[#0a0a0a] text-[#fafafa] font-medium shadow-none'
                  : 'text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]'
              }`}
            >
              <Icon className="w-4 h-4 stroke-[1.8]" />
              <span className="text-[13px] tracking-[-0.01em] truncate">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Acceso Rápido: Escáner Central (Ghost secondary button) */}
        <div className="pt-4">
          <button
            onClick={onQuickScan}
            className="w-full min-h-[38px] px-3.5 rounded-[18px] bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#0a0a0a] transition-all flex items-center justify-center gap-2 text-xs font-medium active:scale-[0.98] cursor-pointer"
          >
            <Camera className="w-4 h-4 stroke-[1.8] text-[#0a0a0a]" />
            <span>Escanear producto</span>
          </button>
        </div>
      </div>

      {/* 3. SECCIÓN INFERIOR: PERFIL DE USUARIO & SALIR */}
      <div className="p-3.5 border-t border-[#e5e5e5]">
        <div className="p-2.5 rounded-[14px] bg-[#ffffff] border border-[#e5e5e5] flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-[10px] bg-[#f5f5f5] text-[#0a0a0a] flex items-center justify-center flex-shrink-0 text-xs font-semibold">
              <User className="w-3.5 h-3.5 stroke-[1.8]" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-[#0a0a0a] truncate block">
                {user?.email?.split('@')[0] || 'Usuario'}
              </span>
              <span className="text-[11px] text-[#737373] truncate block">
                {user?.email || ''}
              </span>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[#737373] hover:text-[#e7000b] hover:bg-[#f5f5f5] transition-colors flex-shrink-0 cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5 stroke-[1.8]" />
          </button>
        </div>
      </div>
    </aside>
  );
};
