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
    <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-[260px] h-screen bg-[#ffffff] z-40 text-[#17191c] select-none border-r border-[#ececec]">
      {/* 1. SECCIÓN SUPERIOR: LOGO Y SELECTOR DE DEPÓSITO */}
      <div className="p-6 border-b border-[#ececec]">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-[#17191c] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs">
            <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
          <div>
            <span className="font-serif text-lg tracking-tight text-[#17191c] font-normal block leading-tight">
              Stockly
            </span>
            <span className="text-[11px] text-[#777b86] font-normal tracking-wide block">
              Inventory OS
            </span>
          </div>
        </div>

        {/* Depósito Activo (Chip Selector) */}
        <button
          onClick={onOpenInventorySelector}
          className="w-full text-left p-3 rounded-2xl bg-[#f2f2f3] hover:bg-[#e8e8ea] border-0 transition-all flex items-center justify-between group cursor-pointer"
        >
          <div className="min-w-0 pr-2">
            <span className="text-[10px] uppercase tracking-wider text-[#777b86] font-medium block">
              Depósito activo
            </span>
            <span className="text-xs font-semibold text-[#17191c] truncate block">
              {currentInventory?.name || 'Seleccionar...'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#777b86] group-hover:text-[#17191c] flex-shrink-0 transition-colors" />
        </button>
      </div>

      {/* 2. SECCIÓN CENTRAL: MENÚ DE NAVEGACIÓN VERTICAL */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1.5 text-xs">
        <span className="px-3 text-[10px] uppercase tracking-wider text-[#979799] font-medium block mb-2.5">
          Módulos
        </span>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full transition-all text-left cursor-pointer ${
                isActive
                  ? 'bg-[#17191c] text-white font-medium shadow-sm'
                  : 'text-[#777b86] hover:text-[#17191c] hover:bg-[#f2f2f3]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2]' : 'stroke-[1.5]'}`} />
              <span className="text-[13px] tracking-tight truncate">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Acceso Rápido: Escáner Central (Blush Peach Accent) */}
        <div className="pt-4">
          <button
            onClick={onQuickScan}
            className="w-full min-h-[42px] px-4 rounded-full bg-[#fbe1d1] hover:bg-[#f8d4bf] text-[#5d2a1a] transition-all flex items-center justify-center gap-2 text-xs font-medium active:scale-[0.98] shadow-xs cursor-pointer"
          >
            <Camera className="w-4 h-4 stroke-[1.8] text-[#5d2a1a]" />
            <span>Escanear producto</span>
          </button>
        </div>
      </div>

      {/* 3. SECCIÓN INFERIOR: PERFIL DE USUARIO & SALIR */}
      <div className="p-4 border-t border-[#ececec]">
        <div className="p-2.5 rounded-2xl bg-[#fafafb] border border-[#ececec] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#f2f2f3] text-[#17191c] flex items-center justify-center flex-shrink-0 text-xs font-semibold">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-[#17191c] truncate block">
                {user?.email?.split('@')[0] || 'Usuario'}
              </span>
              <span className="text-[10px] text-[#777b86] truncate block">
                {user?.email || ''}
              </span>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#777b86] hover:text-[#17191c] hover:bg-white transition-colors flex-shrink-0 cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
