import React from 'react';
import { Layers, ChevronDown, Users, LogOut, MapPin, Tag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onOpenInventorySelector: () => void;
  onOpenCollaborators: () => void;
  onOpenLocations: () => void;
  onOpenCategories: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenInventorySelector,
  onOpenCollaborators,
  onOpenLocations,
  onOpenCategories
}) => {
  const { currentInventory, user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#cacaca] transition-colors">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Lado Izquierdo: Placa de Marca & Selector de Inventario */}
        <div className="flex items-center gap-3">
          {/* Logo Plate Freitag Monochrome */}
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center flex-shrink-0">
            <Layers className="w-5 h-5 text-white stroke-[1.5]" />
          </div>

          {/* Selector de Inventario Activo (Píldora con borde de 1px) */}
          <button
            onClick={onOpenInventorySelector}
            className="flex items-center gap-2.5 px-4 py-2 bg-white hover:bg-[#fafafa] border border-[#cacaca] hover:border-black rounded-full transition-all group text-left max-w-[210px] sm:max-w-xs"
          >
            <div className="truncate">
              <span className="text-[9px] text-[#616161] uppercase tracking-[0.15em] block font-mono">
                DEPÓSITO ACTIVO
              </span>
              <span className="text-xs font-normal uppercase tracking-wider text-black truncate block group-hover:underline">
                {currentInventory?.name || 'SELECCIONAR...'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#616161] group-hover:text-black flex-shrink-0" />
          </button>
        </div>

        {/* Lado Derecho: Acciones Técnicas en Píldora */}
        <div className="flex items-center gap-2 font-mono">
          {/* Botón de Categorías */}
          <button
            onClick={onOpenCategories}
            className="hidden md:inline-flex items-center gap-1.5 px-4 min-h-[36px] bg-white hover:bg-[#fafafa] text-black text-xs uppercase tracking-wider rounded-full border border-[#cacaca] hover:border-black transition-colors"
            title="Categorías y Subcategorías"
          >
            <Tag className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>CATEGORÍAS</span>
          </button>

          {/* Botón de Ubicaciones Físicas y Etiquetas */}
          <button
            onClick={onOpenLocations}
            className="hidden md:inline-flex items-center gap-1.5 px-4 min-h-[36px] bg-white hover:bg-[#fafafa] text-black text-xs uppercase tracking-wider rounded-full border border-[#cacaca] hover:border-black transition-colors"
            title="Ubicaciones y Generador de Etiquetas"
          >
            <MapPin className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>UBICACIONES</span>
          </button>

          {/* Botón de Colaboradores / Equipo */}
          <button
            onClick={onOpenCollaborators}
            className="inline-flex items-center gap-1.5 px-4 min-h-[36px] bg-white hover:bg-[#fafafa] text-black text-xs uppercase tracking-wider rounded-full border border-[#cacaca] hover:border-black transition-all active:scale-95"
            title="Gestionar Colaboradores"
          >
            <Users className="w-3.5 h-3.5 stroke-[1.5]" />
            <span className="hidden sm:inline">EQUIPO</span>
          </button>

          {/* Botón de Salir */}
          <button
            onClick={() => signOut()}
            className="min-h-[36px] min-w-[36px] rounded-full border border-[#cacaca] hover:border-black text-[#616161] hover:text-black flex items-center justify-center transition-colors"
            title={`Cerrar Sesión (${user?.email})`}
          >
            <LogOut className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>
        </div>
      </div>
    </header>
  );
};
