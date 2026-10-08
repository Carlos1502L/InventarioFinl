import React from 'react';
import { Layers, ChevronDown, Users, LogOut, MapPin, Tag, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

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
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Lado Izquierdo: Logo y Selector de Inventario */}
        <div className="flex items-center gap-3">
          {/* Logo PWA */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
            <Layers className="w-5 h-5 text-white" />
          </div>

          {/* Selector de Inventario Activo (Multi-Tenancy) */}
          <button
            onClick={onOpenInventorySelector}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl transition-all group text-left max-w-[200px] sm:max-w-xs shadow-sm"
          >
            <div className="truncate">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-bold">
                Inventario Activo
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {currentInventory?.name || 'Seleccionar...'}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white flex-shrink-0" />
          </button>
        </div>

        {/* Lado Derecho: Accesos Rápidos, Modo Oscuro y Perfil */}
        <div className="flex items-center gap-2">
          {/* Botón de Categorías (Visible en tablets/desktop) */}
          <button
            onClick={onOpenCategories}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
            title="Categorías y Subcategorías"
          >
            <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Categorías
          </button>

          {/* Botón de Ubicaciones Físicas y Etiquetas */}
          <button
            onClick={onOpenLocations}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
            title="Ubicaciones y Generador de Etiquetas"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-500" /> Ubicaciones
          </button>

          {/* Botón de Colaboradores / Equipo */}
          <button
            onClick={onOpenCollaborators}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-xl border border-indigo-200 dark:border-indigo-500/30 transition-all active:scale-95"
            title="Gestionar Colaboradores"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Equipo</span>
          </button>

          {/* BOTÓN MODO OSCURO / MODO CLARO */}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:text-white dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
            title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700 transition-transform hover:-rotate-12" />
            )}
          </button>

          {/* Botón de Cerrar Sesión */}
          <button
            onClick={() => signOut()}
            className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title={`Cerrar Sesión (${user?.email})`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
