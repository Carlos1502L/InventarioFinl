import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Camera,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight
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
  // Configuración condicional según tipo de inventario
  // Negocio: 6 módulos completos
  // Personal: 4 módulos (se ocultan Ventas y Reportes)
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

  // Mapear tab activa a índice de items (soporta alias secundarios como sales-history y analytics)
  const activeIndex = useMemo(() => {
    let key = activeTab;
    if (key === 'sales-history') key = 'sales';
    if (key === 'analytics') key = 'reports';
    const idx = items.findIndex(it => it.tabKey === key);
    return idx >= 0 ? idx : 0;
  }, [items, activeTab]);

  // Estado de arrastre fluido táctil y por puntero
  const [dragDeltaX, setDragDeltaX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const startXRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const hasMovedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Seleccionar ítem
  const selectItem = useCallback((item: DialItem) => {
    if (item.isAction) {
      onQuickScan();
    } else if (item.tabKey) {
      onChangeTab(item.tabKey);
    }
  }, [onQuickScan, onChangeTab]);

  // Paso angular entre ítems y distancia píxel por salto
  const total = items.length;
  const angleStep = total === 4 ? 40 : 30; // grados entre items
  const pixelsPerItem = 48; // distancia de arrastre en px que equivale a 1 item
  const radius = 120; // radio de arco del dial

  // Iniciar arrastre fluido
  const handlePointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX;
    startTimeRef.current = Date.now();
    hasMovedRef.current = false;
    setIsDragging(true);
    setDragDeltaX(0);

    // Capturar puntero para seguimiento continuo incluso fuera del contenedor
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Fallback si no es soportado
    }
  };

  // Movimiento continuo sin límites artificiales (1:1 con el dedo)
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const diff = currentX - startXRef.current;

    if (Math.abs(diff) > 5) {
      hasMovedRef.current = true;
    }
    setDragDeltaX(diff);
  };

  // Finalizar arrastre con cálculo de inercia y salto múltiple fluido
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Fallback
    }

    if (hasMovedRef.current && Math.abs(dragDeltaX) > 10) {
      const elapsed = Math.max(1, Date.now() - startTimeRef.current);
      const velocity = dragDeltaX / elapsed; // px por ms

      // Inercia proyectada según la velocidad del swipe
      const momentumDeltaX = dragDeltaX + (velocity * 140);
      const steps = Math.round(momentumDeltaX / pixelsPerItem);

      if (steps !== 0) {
        let targetIndex = (activeIndex - steps) % total;
        if (targetIndex < 0) targetIndex += total;
        selectItem(items[targetIndex]);
      }
    }

    setDragDeltaX(0);
  };

  const handlePointerCancel = () => {
    setIsDragging(false);
    setDragDeltaX(0);
  };

  // Nudge rápido manual (izq / der)
  const handleStep = (direction: -1 | 1) => {
    let nextIdx = (activeIndex + direction) % total;
    if (nextIdx < 0) nextIdx += total;
    selectItem(items[nextIdx]);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex flex-col items-center pointer-events-none lg:hidden pb-safe">
      {/* Indicador Editorial Superior de la Selección */}
      <div className="pointer-events-auto mb-1.5 bg-white/95 backdrop-blur-md px-4 py-1 rounded-full border border-[#E5E7EB] shadow-sm flex items-center gap-2 font-mono text-[10px] text-[#1E3A5F] transition-all">
        <span className="w-1.5 h-1.5 rounded-full bg-[#E8B4A0] animate-pulse" />
        <span className="text-[#616161]">0{activeIndex + 1} //</span>
        <span className="tracking-wider uppercase font-semibold text-[#1E3A5F]">
          {items[activeIndex]?.label || 'NAVEGACIÓN'}
        </span>
      </div>

      {/* Chasis de Semicírculo Radial con Soporte Táctil Continuo */}
      <div className="relative pointer-events-auto flex items-center justify-center">
        {/* Nudge flecha izquierda */}
        <button
          type="button"
          onClick={() => handleStep(-1)}
          aria-label="Anterior"
          className="absolute -left-1 sm:left-1 z-30 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm border border-[#E5E7EB] text-[#1E3A5F] flex items-center justify-center shadow-sm hover:bg-white active:scale-90 transition-transform"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Arco Semicircular Interactivo */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className={`relative w-[330px] sm:w-[370px] h-[86px] bg-white/95 backdrop-blur-xl border-t border-x border-[#E5E7EB] rounded-t-[170px] shadow-[0_-8px_25px_rgba(30,58,95,0.08)] flex items-center justify-center overflow-hidden touch-none select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {/* Guía decorativa en semicírculo de Nude */}
          <div className="absolute inset-x-7 top-3 bottom-0 border-t-2 border-dashed border-[#E8B4A0]/40 rounded-t-[150px] pointer-events-none" />

          {/* Marcador del Ápex (Centro Superior) */}
          <div className="absolute top-1.5 w-6 h-1 rounded-full bg-[#1E3A5F]/20 pointer-events-none" />

          {/* Elementos distribuidos fluidamente sobre el arco */}
          <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
            {items.map((item, index) => {
              // Calcular posición angular relativa al índice activo con envoltura circular simétrica
              let relativeDiff = index - activeIndex;
              let diff = relativeDiff % total;
              if (diff > total / 2) diff -= total;
              if (diff < -total / 2) diff += total;

              // Desplazamiento angular dinámico según el arrastre del dedo
              const dragAngle = (dragDeltaX / pixelsPerItem) * angleStep;
              const angleDeg = diff * angleStep + dragAngle;
              const angleRad = (angleDeg * Math.PI) / 180;

              // Coordenadas cartesianas a lo largo de la curva del arco
              const x = Math.sin(angleRad) * radius;
              const y = (1 - Math.cos(angleRad)) * 36 + 6;

              // Medida de cercanía al ápice (centro superior = 0°)
              const distFromCenter = Math.abs(angleDeg);
              const isAtApex = distFromCenter < angleStep / 2;
              const opacity = Math.max(0.35, 1 - distFromCenter / 100);
              const scale = isAtApex ? 1.18 : Math.max(0.82, 1 - distFromCenter / 180);
              const zIndex = isAtApex ? 30 : Math.round(20 - distFromCenter / 10);

              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!hasMovedRef.current) {
                      selectItem(item);
                    }
                  }}
                  style={{
                    transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
                    opacity,
                    zIndex,
                    transition: isDragging
                      ? 'none'
                      : 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease, background-color 0.25s ease',
                  }}
                  className={`pointer-events-auto absolute top-1 p-2.5 rounded-full flex flex-col items-center justify-center active:scale-95 transition-shadow ${
                    isAtApex
                      ? 'bg-[#1E3A5F] text-white shadow-lg ring-2 ring-[#E8B4A0]'
                      : item.isAction
                      ? 'bg-[#E8B4A0] text-[#1E3A5F] shadow-sm hover:bg-[#d89e88]'
                      : 'bg-white text-[#616161] hover:text-[#1E3A5F] border border-[#E5E7EB] shadow-sm'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 ${isAtApex ? 'stroke-[2.2]' : 'stroke-[1.6]'}`} />
                </button>
              );
            })}
          </div>

          {/* Indicador inferior estético */}
          <div className="absolute bottom-1 w-10 h-1 rounded-full bg-[#1E3A5F]/15 pointer-events-none" />
        </div>

        {/* Nudge flecha derecha */}
        <button
          type="button"
          onClick={() => handleStep(1)}
          aria-label="Siguiente"
          className="absolute -right-1 sm:right-1 z-30 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm border border-[#E5E7EB] text-[#1E3A5F] flex items-center justify-center shadow-sm hover:bg-white active:scale-90 transition-transform"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
