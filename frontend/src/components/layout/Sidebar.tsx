import React from 'react';
import { motion } from 'framer-motion';
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
    <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-[260px] h-screen bg-[#f8fafc] z-40 text-slate-900 select-none border-r border-slate-200 font-sans">
      {/* 1. SECCIÓN SUPERIOR: LOGO Y SELECTOR DE DEPÓSITO */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-3 mb-4 px-1">
          <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs">
            <img src="/logo.png" alt="Stockly" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
          <div className="min-w-0">
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900 block leading-tight">
              Stockly
            </span>
            <span className="text-[11px] font-mono text-slate-500 tracking-tight block">
              Control &amp; POS
            </span>
          </div>
        </div>

        {/* Depósito Activo */}
        <button
          onClick={onOpenInventorySelector}
          className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] flex items-center justify-between group cursor-pointer"
        >
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium block">
                Depósito activo
              </span>
              {currentInventory?.currency && (
                <span className="font-mono text-[10px] px-1.5 py-px rounded bg-slate-100 text-slate-600">
                  {currentInventory.currency}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-slate-900 truncate block mt-0.5">
              {currentInventory?.name || 'Seleccionar depósito'}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 flex-shrink-0 transition-colors duration-150" />
        </button>
      </div>

      {/* 2. SECCIÓN CENTRAL: MENÚ DE NAVEGACIÓN VERTICAL */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 text-sm">
        <span className="px-3 text-[11px] font-medium text-slate-400 block mb-2">
          Operaciones
        </span>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors duration-150 text-left cursor-pointer active:scale-[0.98] ${
                isActive
                  ? 'text-white font-medium'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-pill"
                  transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.7 }}
                  className="absolute inset-0 bg-slate-900 rounded-xl shadow-xs pointer-events-none"
                />
              )}
              <Icon className="relative z-10 w-4 h-4 stroke-[1.8] flex-shrink-0" />
              <span className="relative z-10 text-[13px] tracking-[-0.01em] truncate">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Acceso Rápido: Escáner Central */}
        <div className="pt-4">
          <button
            onClick={onQuickScan}
            className="w-full min-h-[38px] px-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] flex items-center justify-center gap-2 text-xs font-medium active:scale-[0.97] cursor-pointer"
          >
            <Camera className="w-4 h-4 stroke-[1.8] text-slate-700" />
            <span>Escanear código</span>
          </button>
        </div>
      </div>

      {/* 3. SECCIÓN INFERIOR: PERFIL DE USUARIO & SALIR */}
      <div className="p-3 border-t border-slate-200">
        <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold">
              <User className="w-3.5 h-3.5 stroke-[1.8]" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-900 truncate block">
                {user?.email?.split('@')[0] || 'Usuario'}
              </span>
              <span className="text-[11px] font-mono text-slate-500 truncate block">
                {user?.email || ''}
              </span>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-[background-color,color,transform] duration-150 active:scale-[0.95] flex-shrink-0 cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5 stroke-[1.8]" />
          </button>
        </div>
      </div>
    </aside>
  );
};
