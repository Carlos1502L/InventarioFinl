import React from 'react';
import {
  Home,
  MapPin,
  Package,
  ShoppingCart,
  Settings
} from 'lucide-react';

export type TabType = 'home' | 'inventory' | 'locations' | 'sales' | 'sales-history' | 'reports' | 'analytics' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onQuickScan?: () => void;
  isBusiness?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  isBusiness = true
}) => {
  const navItems = [
    {
      id: 'home',
      label: 'Home // Resumen',
      icon: Home,
      targetTab: 'home' as TabType,
      isActive: activeTab === 'home',
      visible: true
    },
    {
      id: 'locations',
      label: 'Ubicaciones // Almacén',
      icon: MapPin,
      targetTab: 'locations' as TabType,
      isActive: activeTab === 'locations',
      visible: true
    },
    {
      id: 'inventory',
      label: 'Stock // Inventario',
      icon: Package,
      targetTab: 'inventory' as TabType,
      isActive: activeTab === 'inventory',
      visible: true
    },
    {
      id: 'sales',
      label: 'Punto de Venta / Ventas',
      icon: ShoppingCart,
      targetTab: 'sales' as TabType,
      isActive: activeTab === 'sales' || activeTab === 'sales-history',
      visible: isBusiness
    },
    {
      id: 'settings',
      label: 'Configuración',
      icon: Settings,
      targetTab: 'settings' as TabType,
      isActive: activeTab === 'settings' || activeTab === 'reports' || activeTab === 'analytics',
      visible: true
    }
  ].filter(item => item.visible);

  return (
    <nav
      aria-label="Navegación principal móvil"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-neutral-950 text-neutral-400 rounded-full px-5 py-2.5 shadow-2xl flex items-center gap-5 z-50 backdrop-blur-md border border-neutral-800 lg:hidden select-none"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChangeTab(item.targetTab)}
            aria-label={item.label}
            title={item.label}
            className={`w-9 h-9 -my-0.5 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
              item.isActive
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 stroke-[1.8]" />
          </button>
        );
      })}
    </nav>
  );
};
