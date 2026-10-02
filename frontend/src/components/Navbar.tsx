import React from 'react';
import { Layers, ChevronDown, Users, LogOut, Shield, MapPin, Tag } from 'lucide-react';
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
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Lado Izquierdo: Logo y Selector de Inventario */}
        <div className="flex items-center gap-3">
          {/* Logo PWA */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-600/30 flex-shrink-0">
            <Layers className="w-5 h-5 text-white" />
          </div>

          {/* Selector de Inventario Activo (Multi-Tenancy) */}
          <button
            onClick={onOpenInventorySelector}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-all group text-left max-w-[200px] sm:max-w-xs"
          >
            <div className="truncate">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                Inventario Activo
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-white truncate block group-hover:text-blue-400 transition-colors">
                {currentInventory?.name || 'Seleccionar...'}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white flex-shrink-0" />
          </button>
        </div>

        {/* Lado Derecho: Accesos Rápidos de Gestión y Perfil */}
        <div className="flex items-center gap-2">
          {/* Botón de Categorías (Visible en tablets/desktop) */}
          <button
            onClick={onOpenCategories}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
            title="Categorías y Subcategorías"
          >
            <Tag className="w-3.5 h-3.5 text-blue-400" /> Categorías
          </button>

          {/* Botón de Ubicaciones Físicas y Etiquetas */}
          <button
            onClick={onOpenLocations}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
            title="Ubicaciones y Generador de Etiquetas"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400" /> Ubicaciones
          </button>

          {/* Botón de Colaboradores / Equipo */}
          <button
            onClick={onOpenCollaborators}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded-xl border border-indigo-500/30 transition-all active:scale-95"
            title="Gestionar Colaboradores"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Equipo</span>
          </button>

          {/* Botón de Cerrar Sesión */}
          <button
            onClick={() => signOut()}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
            title={`Cerrar Sesión (${user?.email})`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
