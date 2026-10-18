import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Camera,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown
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
  // Negocio: 6 módulos completos | Personal: 4 módulos
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

  // Mapear tab activa a índice de items (soporta alias secundarios)
  const activeIndex = useMemo(() => {
    let key = activeTab;
    if (key === 'sales-history') key = 'sales';
    if (key === 'analytics') key = 'reports';
    const idx = items.findIndex(it => it.tabKey === key);
    return idx >= 0 ? idx : 0;
  }, [items, activeTab]);

  // Estado para ocultar/mostrar la barra inferior al deslizar hacia abajo/arriba
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Estado de arrastre fluido táctil y por puntero
  const [dragDeltaX, setDragDeltaX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const hasMovedRef = useRef<boolean>(false);
  const isVerticalSwipeRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Seleccionar ítem
  const selectItem = useCallback((item: DialItem) => {
    if (item.isAction) {
      onQuickScan();
    } else if (item.tabKey) {
      onChangeTab(item.tabKey);
    }
  }, [onQuickScan, onChangeTab]);

  // Parámetros del semicírculo refinado y más fino
  const total = items.length;
  const angleStep = total === 4 ? 38 : 28; // distribución simétrica
  const pixelsPerItem = 46;
  const radius = 115; // radio ajustado para perfil estilizado

  // Iniciar arrastre fluido
  const handlePointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    hasMovedRef.current = false;
    isVerticalSwipeRef.current = false;
    setIsDragging(true);
    setDragDeltaX(0);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignorar fallback
    }
  };

  // Movimiento continuo con detección bidireccional (horizontal = giro, vertical = colapso)
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const currentY = e.clientY;
    const diffX = currentX - startXRef.current;
    const diffY = currentY - startYRef.current;

    // Detectar si el usuario está haciendo un gesto vertical para ocultar
    if (!hasMovedRef.current && Math.abs(diffY) > 12 && Math.abs(diffY) > Math.abs(diffX) * 1.5) {
      isVerticalSwipeRef.current = true;
    }

    if (Math.abs(diffX) > 4 || Math.abs(diffY) > 4) {
      hasMovedRef.current = true;
    }

    if (!isVerticalSwipeRef.current) {
      setDragDeltaX(diffX);
    }
  };

  // Finalizar arrastre
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignorar fallback
    }

    const currentY = e.clientY;
    const diffY = currentY - startYRef.current;

    // Si fue un swipe hacia abajo intencional, ocultar nav
    if (diffY > 30) {
      setIsCollapsed(true);
      setDragDeltaX(0);
      return;
    }

    // Si fue un arrastre horizontal fluido con inercia
    if (hasMovedRef.current && !isVerticalSwipeRef.current && Math.abs(dragDeltaX) > 10) {
      const elapsed = Math.max(1, Date.now() - startTimeRef.current);
      const velocity = dragDeltaX / elapsed; // px por ms

      const momentumDeltaX = dragDeltaX + (velocity * 135);
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
    <div className="fixed bottom-0 inset-x-0 z-50 flex flex-col items-center pointer-events-none lg:hidden select-none">
      
      {/* Botón Flotante para reabrir cuando el carrusel está oculto (swipe up / tap) */}
      {isCollapsed && (
        <div className="pointer-events-auto mb-3 pb-[env(safe-area-inset-bottom,0.5rem)] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            aria-label="Mostrar navegación"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-[#E5E7EB] text-[#1E3A5F] shadow-md font-mono text-[10px] tracking-wider uppercase active:scale-95 transition-transform"
          >
            <ChevronUp className="w-3.5 h-3.5 text-[#E8B4A0]" />
            <span className="font-medium">MENÚ</span>
          </button>
        </div>
      )}

      {/* Contenedor del Carrusel Radial Móvil */}
      <div
        className={`pointer-events-none flex flex-col items-center transition-all duration-300 ease-out ${
          isCollapsed ? 'translate-y-[110%] opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        {/* Indicador de título activo y pestaña de ocultar */}
        <div className="pointer-events-auto mb-1 flex items-center gap-1.5">
          <div className="bg-white/95 backdrop-blur-md px-3.5 py-0.5 rounded-full border border-[#E5E7EB] shadow-sm flex items-center gap-2 font-mono text-[10px] text-[#1E3A5F]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E8B4A0] animate-pulse" />
            <span className="text-[#616161]">0{activeIndex + 1} //</span>
            <span className="tracking-wider uppercase font-semibold text-[#1E3A5F]">
              {items[activeIndex]?.label || 'NAVEGACIÓN'}
            </span>
          </div>

          {/* Botón sutil para deslizar/ocultar el dial */}
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            title="Ocultar menú"
            className="w-5 h-5 rounded-full bg-white/90 backdrop-blur-md border border-[#E5E7EB] text-[#616161] hover:text-[#1E3A5F] flex items-center justify-center shadow-xs active:scale-90 transition-transform"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Chasis de Semicírculo Fino y Estilizado */}
        <div className="relative pointer-events-auto flex items-center justify-center">
          {/* Nudge flecha izquierda */}
          <button
            type="button"
            onClick={() => handleStep(-1)}
            aria-label="Anterior"
            className="absolute -left-1 sm:left-1 z-30 w-6 h-6 rounded-full bg-white/85 backdrop-blur-sm border border-[#E5E7EB] text-[#1E3A5F] flex items-center justify-center shadow-xs hover:bg-white active:scale-90 transition-transform"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Arco Semicircular Interactivo Fino y Pegado al Fondo */}
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className={`relative w-[320px] sm:w-[350px] h-[50px] bg-white/95 backdrop-blur-xl border-t border-x border-[#E5E7EB] rounded-t-[160px] shadow-[0_-4px_18px_rgba(30,58,95,0.06)] flex items-center justify-center overflow-hidden touch-none select-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* Guía decorativa en semicírculo fino de Nude */}
            <div className="absolute inset-x-7 top-1.5 bottom-0 border-t border-dashed border-[#E8B4A0]/35 rounded-t-[140px] pointer-events-none" />

            {/* Marcador del Ápex (Centro Superior) */}
            <div className="absolute top-1 w-5 h-0.5 rounded-full bg-[#1E3A5F]/25 pointer-events-none" />

            {/* Elementos distribuidos fluidamente sobre el arco */}
            <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
              {items.map((item, index) => {
                let relativeDiff = index - activeIndex;
                let diff = relativeDiff % total;
                if (diff > total / 2) diff -= total;
                if (diff < -total / 2) diff += total;

                // Ángulo interactivo con arrastre 1:1
                const dragAngle = (dragDeltaX / pixelsPerItem) * angleStep;
                const angleDeg = diff * angleStep + dragAngle;
                const angleRad = (angleDeg * Math.PI) / 180;

                // Coordenadas calculadas para el semicírculo fino
                const x = Math.sin(angleRad) * radius;
                const y = (1 - Math.cos(angleRad)) * 22 + 2;

                const distFromCenter = Math.abs(angleDeg);
                const isAtApex = distFromCenter < angleStep / 2;
                const opacity = Math.max(0.35, 1 - distFromCenter / 95);
                const scale = isAtApex ? 1.12 : Math.max(0.82, 1 - distFromCenter / 170);
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
                        : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
                    }}
                    className={`pointer-events-auto absolute top-0.5 p-2 rounded-full flex flex-col items-center justify-center active:scale-95 transition-shadow ${
                      isAtApex
                        ? 'bg-[#1E3A5F] text-white shadow-md ring-1.5 ring-[#E8B4A0]'
                        : item.isAction
                        ? 'bg-[#E8B4A0] text-[#1E3A5F] shadow-xs hover:bg-[#d89e88]'
                        : 'bg-white text-[#616161] hover:text-[#1E3A5F] border border-[#E5E7EB] shadow-xs'
                    }`}
                    title={item.label}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isAtApex ? 'stroke-[2.2]' : 'stroke-[1.6]'}`} />
                  </button>
                );
              })}
            </div>

            {/* Manija táctil inferior sutil */}
            <div className="absolute bottom-0.5 w-8 h-0.5 rounded-full bg-[#1E3A5F]/15 pointer-events-none" />
          </div>

          {/* Nudge flecha derecha */}
          <button
            type="button"
            onClick={() => handleStep(1)}
            aria-label="Siguiente"
            className="absolute -right-1 sm:right-1 z-30 w-6 h-6 rounded-full bg-white/85 backdrop-blur-sm border border-[#E5E7EB] text-[#1E3A5F] flex items-center justify-center shadow-xs hover:bg-white active:scale-90 transition-transform"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Faldón seguro transparente/vidrio para la barra de inicio de iOS (iPhone 16 Pro) */}
        <div className="w-[320px] sm:w-[350px] bg-white/95 backdrop-blur-xl border-x border-[#E5E7EB] h-[env(safe-area-inset-bottom,0px)] pointer-events-auto" />
      </div>
    </div>
  );
};
