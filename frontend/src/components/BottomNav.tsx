import React from 'react';
import { LayoutDashboard, Package, ShoppingCart, Camera, Settings } from 'lucide-react';

export type TabType = 'dashboard' | 'inventory' | 'sales' | 'reports' | 'analytics' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onQuickScan: () => void;
  isBusiness?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  onQuickScan,
  isBusiness = true
}) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#1A2035]/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800 pb-safe lg:hidden shadow-lg transition-colors duration-200">
      <div className="flex items-center justify-around h-16 px-1">
        {/* Pestaña 1: Resumen (Dashboard) */}
        <button
          onClick={() => onChangeTab('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'dashboard'
              ? 'text-[#FF6B00] font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[9px]">Resumen</span>
        </button>

        {/* Pestaña 2: Inventario */}
        <button
          onClick={() => onChangeTab('inventory')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'inventory'
              ? 'text-[#FF6B00] font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Package className="w-5 h-5 mb-0.5" />
          <span className="text-[9px]">Stock</span>
        </button>

        {/* Botón Central Destacado: Escáner de Cámara */}
        <button
          onClick={onQuickScan}
          className="flex flex-col items-center justify-center -mt-5 mx-1"
          title="Escáner Rápido de Cámara"
        >
          <div className="w-12 h-12 p-3 bg-gradient-to-tr from-[#FF6B00] to-amber-500 text-white rounded-full shadow-lg shadow-orange-500/40 ring-4 ring-white dark:ring-[#1A2035] active:scale-90 transition-transform flex items-center justify-center">
            <Camera className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-bold text-[#FF6B00] mt-1">Escanear</span>
        </button>

        {/* Pestaña 3: Ventas (POS) */}
        <button
          onClick={() => onChangeTab('sales')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'sales'
              ? 'text-[#FF6B00] font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShoppingCart className="w-5 h-5 mb-0.5" />
          <span className="text-[9px]">Ventas</span>
        </button>

        {/* Pestaña 4: Ajustes */}
        <button
          onClick={() => onChangeTab('settings')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'settings'
              ? 'text-[#FF6B00] font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[9px]">Ajustes</span>
        </button>
      </div>
    </nav>
  );
};
