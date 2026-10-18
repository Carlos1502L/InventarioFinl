import React, { useState, useRef, useMemo } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Camera,
  FileText,
  Settings
} from 'lucide-react';

export type TabType = 'home' | 'inventory' | 'sales' | 'sales-history' | 'reports' | 'analytics' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onQuickScan: () => void;
  isBusiness?: boolean;
}

interface DialItem {
  id: string;
  tabKey?: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isAction?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  onQuickScan,
  isBusiness = true
}) => {
  // Configuración condicional de módulos según el tipo de inventario
  const items: DialItem[] = useMemo(() => {
    if (isBusiness) {
      return [
        { id: 'home', tabKey: 'home', label: 'HOME', icon: LayoutDashboard },
        { id: 'inventory', tabKey: 'inventory', label: 'STOCK', icon: Package },
        { id: 'sales', tabKey: 'sales', label: 'VENTAS', icon: ShoppingCart },
        { id: 'scan', label: 'ESCANEAR', icon: Camera, isAction: true },
        { id: 'reports', tabKey: 'reports', label: 'REPORTES', icon: FileText },
        { id: 'settings', tabKey: 'settings', label: 'AJUSTES', icon: Settings },
      ];
    } else {
      return [
        { id: 'home', tabKey: 'home', label: 'HOME', icon: LayoutDashboard },
        { id: 'inventory', tabKey: 'inventory', label: 'STOCK', icon: Package },
        { id: 'scan', label: 'ESCANEAR', icon: Camera, isAction: true },
        { id: 'settings', tabKey: 'settings', label: 'AJUSTES', icon: Settings },
      ];
    }
  }, [isBusiness]);

  // Manejo de Swipe Táctil
  const touchStartX = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);

  // Determinar índice actual activo
  const activeIndex = useMemo(() => {
    const idx = items.findIndex(it => it.tabKey === activeTab);
    return idx >= 0 ? idx : 0;
  }, [items, activeTab]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    setDragOffset(Math.max(-40, Math.min(40, diff)));
  };

  const handleTouchEnd = () => {
    if (Math.abs(dragOffset) > 20) {
      if (dragOffset > 0) {
        // Deslizar a la derecha -> item anterior
        const prevIdx = (activeIndex - 1 + items.length) % items.length;
        selectItem(items[prevIdx]);
      } else {
        // Deslizar a la izquierda -> item siguiente
        const nextIdx = (activeIndex + 1) % items.length;
        selectItem(items[nextIdx]);
      }
    }
    touchStartX.current = null;
    setDragOffset(0);
  };

  const selectItem = (item: DialItem) => {
    if (item.isAction) {
      onQuickScan();
    } else if (item.tabKey) {
      onChangeTab(item.tabKey);
    }
  };

  // Cálculo de distribución en arco semicircular
  // El centro superior está en el ángulo 90° (arriba)
  const radius = 115; // radio del arco en px

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex flex-col items-center pointer-events-none lg:hidden pb-safe">
      {/* Indicador de título activo arriba del dial */}
      <div className="pointer-events-auto mb-1 bg-white/95 backdrop-blur-md px-3.5 py-1 rounded-full border border-[#E5E7EB] shadow-sm flex items-center gap-1.5 font-mono text-[10px] text-[#1E3A5F]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#E8B4A0]" />
        <span className="tracking-wider uppercase font-medium">
          {items[activeIndex]?.label || 'NAVEGACIÓN'}
        </span>
      </div>

      {/* Semicírculo Ruleta Radial */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="pointer-events-auto relative w-[320px] sm:w-[360px] h-[78px] bg-white/90 backdrop-blur-xl border-t border-x border-[#E5E7EB] rounded-t-[160px] shadow-lg flex items-center justify-center overflow-hidden"
      >
        {/* Arco de referencia sutil en Nude */}
        <div className="absolute inset-x-8 top-3 bottom-0 border-t-2 border-dashed border-[#E8B4A0]/40 rounded-t-[140px] pointer-events-none" />

        {/* Elementos distribuidos sobre el arco */}
        <div className="relative w-full h-full flex items-center justify-center">
          {items.map((item, index) => {
            // Calcular posición relativa al índice activo
            const total = items.length;
            let relativePos = index - activeIndex;
            if (relativePos > total / 2) relativePos -= total;
            if (relativePos < -total / 2) relativePos += total;

            // Ángulo por elemento (aprox 28° a 36° entre adyacentes)
            const angleStep = total === 4 ? 36 : 28;
            const angleDeg = relativePos * angleStep;
            const angleRad = (angleDeg * Math.PI) / 180;

            // Coordenadas x, y sobre el arco
            const x = Math.sin(angleRad) * radius + dragOffset * 0.4;
            const y = (1 - Math.cos(angleRad)) * 32 + 10;

            const isActive = index === activeIndex;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => selectItem(item)}
                style={{
                  transform: `translate(${x}px, ${y}px) scale(${isActive ? 1.15 : 0.88})`,
                  transition: touchStartX.current ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                }}
                className={`absolute top-1 p-2.5 rounded-full flex flex-col items-center justify-center transition-colors ${
                  isActive
                    ? 'bg-[#1E3A5F] text-white shadow-md ring-2 ring-[#E8B4A0]'
                    : item.isAction
                    ? 'bg-[#E8B4A0] text-[#1E3A5F] hover:bg-[#D89E88]'
                    : 'bg-white text-[#616161] hover:text-[#1E3A5F] border border-[#E5E7EB]'
                }`}
                title={item.label}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2]' : 'stroke-[1.5]'}`} />
              </button>
            );
          })}
        </div>

        {/* Punto de anclaje visual inferior */}
        <div className="absolute bottom-1 w-8 h-1 rounded-full bg-[#1E3A5F]/20" />
      </div>
    </div>
  );
};
