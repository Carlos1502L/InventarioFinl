import React from 'react';
import {
  Search,
  Plus,
  Sun,
  Moon,
  Bell,
  ShoppingCart,
  ChevronDown,
  Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface TopHeaderProps {
  moduleTitle: string;
  onOpenRegisterSale: () => void;
  onSearchGlobal?: (query: string) => void;
  onOpenInventorySelector: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  moduleTitle,
  onOpenRegisterSale,
  onSearchGlobal,
  onOpenInventorySelector
}) => {
  const { user, currentInventory, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Fecha dinámica en formato español (ej: "Jueves, 15 de Octubre 2026")
  const formattedDate = React.useMemo(() => {
    const today = new Date();
    const formatted = new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(today);
    // Capitalizar primera letra
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, []);

  const userInitial = user?.email ? user.email.slice(0, 2).toUpperCase() : 'LM';
  const userName = user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'Lucía Martín');
  const userRole = currentInventory?.is_owner ? 'Administradora' : 'Colaborador';

  return (
    <header className="sticky top-0 z-30 w-full bg-white dark:bg-[#1A2035] border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3 transition-colors duration-200">
      <div className="flex items-center justify-between gap-3">
        {/* Lado Izquierdo: Título del Módulo y Fecha Dinámica */}
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
            {moduleTitle}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {formattedDate}
          </p>
        </div>

        {/* Centro: Búsqueda Global (Visible en Tablets y Desktop) */}
        <div className="hidden md:flex items-center flex-1 max-w-xs lg:max-w-md mx-4">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Buscar productos, SKU, ventas..."
              onChange={e => onSearchGlobal?.(e.target.value)}
              className="w-full bg-[#F8F9FA] dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-[10px] pl-9 pr-3.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] transition-all"
            />
          </div>
        </div>

        {/* Lado Derecho: Acciones, Botón Naranja +Registrar venta, Perfil */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Botón de Cambio de Tema */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Cambiar tema"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Selector Rápido de Inventario */}
          <button
            onClick={onOpenInventorySelector}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
            title="Cambiar inventario activo"
          >
            <Layers className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="max-w-[100px] truncate">{currentInventory?.name || 'Inventario'}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Botón Destacado de Acción Rápida en Naranja (#FF6B00) - RF-03.1 */}
          <Button
            onClick={onOpenRegisterSale}
            variant="orange"
            size="sm"
            className="h-9 px-3.5 text-xs font-bold shadow-md shadow-orange-500/20 whitespace-nowrap flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Registrar venta</span>
            <span className="sm:hidden">Venta</span>
          </Button>

          {/* Tarjeta de Perfil de Usuario con Dropdown (LM - Lucía Martín) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none">
                <Avatar className="h-8 w-8 ring-2 ring-[#FF6B00]/40">
                  <AvatarFallback className="bg-[#1A2035] text-white font-extrabold text-xs">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden xl:block text-left pr-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[120px]">
                    {userName}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                    {userRole}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="text-xs font-bold text-slate-900 dark:text-white">{userName}</p>
                <p className="text-[11px] text-slate-500 font-normal truncate">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onOpenInventorySelector} className="cursor-pointer">
                Cambiar de Inventario...
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenRegisterSale} className="cursor-pointer font-bold text-[#FF6B00]">
                + Registrar Nueva Venta
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer text-rose-600 focus:text-rose-600">
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
