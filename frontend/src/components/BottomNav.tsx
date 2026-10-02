import React from 'react';
import { Package, Camera, FileText, BarChart3, Settings } from 'lucide-react';

export type TabType = 'inventory' | 'reports' | 'analytics' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onQuickScan: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  onQuickScan
}) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 pb-safe sm:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {/* Pestaña 1: Inventario */}
        <button
          onClick={() => onChangeTab('inventory')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'inventory' ? 'text-blue-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Inventario</span>
        </button>

        {/* Pestaña 2: Reportes */}
        <button
          onClick={() => onChangeTab('reports')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'reports' ? 'text-blue-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Reportes</span>
        </button>

        {/* Botón Central Destacado: Escáner de Cámara */}
        <button
          onClick={onQuickScan}
          className="flex flex-col items-center justify-center -mt-5 mx-1"
          title="Escáner Rápido de Cámara"
        >
          <div className="w-13 h-13 p-3 bg-gradient-to-tr from-blue-600 to-indigo-500 text-white rounded-full shadow-lg shadow-blue-600/40 ring-4 ring-slate-900 active:scale-90 transition-transform flex items-center justify-center">
            <Camera className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-blue-400 mt-1">Escanear</span>
        </button>

        {/* Pestaña 3: Estadísticas */}
        <button
          onClick={() => onChangeTab('analytics')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'analytics' ? 'text-blue-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Estadísticas</span>
        </button>

        {/* Pestaña 4: Ajustes */}
        <button
          onClick={() => onChangeTab('settings')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'settings' ? 'text-blue-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Ajustes</span>
        </button>
      </div>
    </nav>
  );
};
