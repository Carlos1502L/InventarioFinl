import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  PlusCircle,
  MapPin,
  Tag,
  Printer,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  Layers,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export type MainNavTab = 'dashboard' | 'sales' | 'inventory' | 'reports' | 'analytics' | 'settings';

interface SidebarProps {
  activeTab: MainNavTab;
  onChangeTab: (tab: MainNavTab) => void;
  onOpenCreateProduct: () => void;
  onOpenLocations: () => void;
  onOpenCategories: () => void;
  onOpenBatchLabels: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChangeTab,
  onOpenCreateProduct,
  onOpenLocations,
  onOpenCategories,
  onOpenBatchLabels
}) => {
  const { user, currentInventory, signOut } = useAuth();

  const userInitial = user?.email ? user.email.slice(0, 2).toUpperCase() : 'LM';
  const userName = user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Lucía Martín');
  const userRole = currentInventory?.is_owner ? 'Administradora' : 'Colaborador';

  return (
    <aside className="hidden lg:flex flex-col justify-between w-64 bg-[#1A2035] text-white shrink-0 min-h-screen border-r border-slate-800 select-none z-20">
      {/* 1. Logotipo Superior de Marca */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-white block">
              InventarioCoop
            </span>
            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {currentInventory?.name || 'Mi Negocio'}
            </span>
          </div>
        </div>
        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/40">
          PRO
        </span>
      </div>

      {/* 2. Menú de Navegación Categorizado (RF-03.1) */}
      <div className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
        <div>
          <span className="px-3 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase block mb-2">
            Gestión de Negocio
          </span>

          <nav className="space-y-1">
            {/* Resumen / Dashboard */}
            <button
              onClick={() => onChangeTab('dashboard')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-white text-[#1A2035] shadow-md border-l-4 border-[#FF6B00]'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
                <span>Resumen</span>
              </div>
              {activeTab === 'dashboard' && <ChevronRight className="w-3.5 h-3.5 text-[#FF6B00]" />}
            </button>

            {/* Ventas */}
            <button
              onClick={() => onChangeTab('sales')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'sales'
                  ? 'bg-white text-[#1A2035] shadow-md border-l-4 border-[#FF6B00]'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className={`w-4 h-4 ${activeTab === 'sales' ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
                <span>Ventas</span>
              </div>
              {activeTab === 'sales' && <ChevronRight className="w-3.5 h-3.5 text-[#FF6B00]" />}
            </button>

            {/* Inventario */}
            <button
              onClick={() => onChangeTab('inventory')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'inventory'
                  ? 'bg-white text-[#1A2035] shadow-md border-l-4 border-[#FF6B00]'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <Package className={`w-4 h-4 ${activeTab === 'inventory' ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
                <span>Inventario</span>
              </div>
              {activeTab === 'inventory' && <ChevronRight className="w-3.5 h-3.5 text-[#FF6B00]" />}
            </button>

            {/* Acción Rápida: Añadir Producto */}
            <button
              onClick={onOpenCreateProduct}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left"
            >
              <PlusCircle className="w-4 h-4 text-[#FF6B00]" />
              <span>Añadir producto</span>
            </button>

            {/* Proveedores / Almacenes */}
            <button
              onClick={onOpenLocations}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left"
            >
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>Proveedores / Almacenes</span>
            </button>

            {/* Categorías */}
            <button
              onClick={onOpenCategories}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left"
            >
              <Tag className="w-4 h-4 text-slate-400" />
              <span>Categorías</span>
            </button>

            {/* Etiquetas */}
            <button
              onClick={onOpenBatchLabels}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Etiquetas en Lote</span>
            </button>
          </nav>
        </div>

        <div>
          <span className="px-3 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase block mb-2">
            Análisis y Control
          </span>

          <nav className="space-y-1">
            {/* Reportes */}
            <button
              onClick={() => onChangeTab('reports')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'reports'
                  ? 'bg-white text-[#1A2035] shadow-md border-l-4 border-[#FF6B00]'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className={`w-4 h-4 ${activeTab === 'reports' ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
                <span>Reportes</span>
              </div>
              {activeTab === 'reports' && <ChevronRight className="w-3.5 h-3.5 text-[#FF6B00]" />}
            </button>

            {/* Estadísticas */}
            <button
              onClick={() => onChangeTab('analytics')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'analytics'
                  ? 'bg-white text-[#1A2035] shadow-md border-l-4 border-[#FF6B00]'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <BarChart3 className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
                <span>Estadísticas</span>
              </div>
              {activeTab === 'analytics' && <ChevronRight className="w-3.5 h-3.5 text-[#FF6B00]" />}
            </button>

            {/* Ajustes */}
            <button
              onClick={() => onChangeTab('settings')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'settings'
                  ? 'bg-white text-[#1A2035] shadow-md border-l-4 border-[#FF6B00]'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
                <span>Ajustes</span>
              </div>
              {activeTab === 'settings' && <ChevronRight className="w-3.5 h-3.5 text-[#FF6B00]" />}
            </button>
          </nav>
        </div>
      </div>

      {/* 3. Perfil de Usuario y Botón Cerrar Sesión Abajo (RF-03.1) */}
      <div className="p-4 border-t border-white/10 space-y-3 bg-[#131828]">
        <div className="flex items-center gap-3 px-1">
          <Avatar className="h-9 w-9 ring-2 ring-[#FF6B00]/40">
            <AvatarFallback className="bg-[#242B45] text-white font-extrabold text-xs">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{userName}</p>
            <p className="text-[10px] text-slate-400 truncate">{userRole}</p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
};
