import React from 'react';
import { LayoutDashboard, Package, Camera, Receipt, Settings } from 'lucide-react';

export type TabType = 'home' | 'inventory' | 'sales' | 'sales-history' | 'reports' | 'analytics' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onQuickScan: () => void;
  isBusiness?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  onQuickScan
}) => {
  return (
    <nav className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-50 sm:hidden">
      {/* Contenedor Flotante Estilo Dock Simétrico Suizo */}
      <div className="bg-white/95 backdrop-blur-md border border-[#cacaca] rounded-full px-2 py-1.5 shadow-md flex items-center justify-between">
        
        {/* 1. Home (Dashboard) */}
        <button
          onClick={() => onChangeTab('home')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors min-h-[44px] ${
            activeTab === 'home'
              ? 'text-black'
              : 'text-[#616161] hover:text-black'
          }`}
          title="Resumen General"
        >
          <LayoutDashboard className="w-4 h-4 stroke-[1.5] mb-0.5" />
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] font-normal">
            HOME
          </span>
          {activeTab === 'home' && (
            <span className="w-1 h-1 rounded-full bg-black mt-0.5" />
          )}
        </button>

        {/* 2. Stock (Catálogo de existencias) */}
        <button
          onClick={() => onChangeTab('inventory')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors min-h-[44px] ${
            activeTab === 'inventory'
              ? 'text-black'
              : 'text-[#616161] hover:text-black'
          }`}
          title="Catálogo de Stock"
        >
          <Package className="w-4 h-4 stroke-[1.5] mb-0.5" />
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] font-normal">
            STOCK
          </span>
          {activeTab === 'inventory' && (
            <span className="w-1 h-1 rounded-full bg-black mt-0.5" />
          )}
        </button>

        {/* 3. Escanear (Acción Central Simétrica Sobria en Negro Carbón) */}
        <button
          onClick={onQuickScan}
          className="flex flex-col items-center justify-center px-2 py-0.5 min-h-[44px] active:scale-95 transition-transform"
          title="Escanear Código de Barras o QR"
        >
          <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center border border-black hover:bg-[#1a1b1e] transition-colors">
            <Camera className="w-4 h-4 stroke-[1.75]" />
          </div>
          <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-[#616161] font-normal mt-0.5">
            ESCANEAR
          </span>
        </button>

        {/* 4. Historial (Ventas y transacciones) */}
        <button
          onClick={() => onChangeTab('sales-history')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors min-h-[44px] ${
            activeTab === 'sales-history'
              ? 'text-black'
              : 'text-[#616161] hover:text-black'
          }`}
          title="Historial de Ventas"
        >
          <Receipt className="w-4 h-4 stroke-[1.5] mb-0.5" />
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] font-normal">
            HISTORIAL
          </span>
          {activeTab === 'sales-history' && (
            <span className="w-1 h-1 rounded-full bg-black mt-0.5" />
          )}
        </button>

        {/* 5. Ajustes (Configuración) */}
        <button
          onClick={() => onChangeTab('settings')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors min-h-[44px] ${
            activeTab === 'settings'
              ? 'text-black'
              : 'text-[#616161] hover:text-black'
          }`}
          title="Ajustes y Configuración"
        >
          <Settings className="w-4 h-4 stroke-[1.5] mb-0.5" />
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] font-normal">
            AJUSTES
          </span>
          {activeTab === 'settings' && (
            <span className="w-1 h-1 rounded-full bg-black mt-0.5" />
          )}
        </button>

      </div>
    </nav>
  );
};
