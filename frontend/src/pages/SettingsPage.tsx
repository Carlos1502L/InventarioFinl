import React from 'react';
import {
  Settings,
  Tag,
  MapPin,
  Users,
  Layers,
  Smartphone,
  Info,
  ChevronRight,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { formatDate } from '../lib/supabase';

interface SettingsPageProps {
  onOpenCategories: () => void;
  onOpenLocations: () => void;
  onOpenCollaborators: () => void;
  onOpenInventorySelector: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onOpenCategories,
  onOpenLocations,
  onOpenCollaborators,
  onOpenInventorySelector
}) => {
  const { currentInventory, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-6 pb-24 sm:pb-8 max-w-3xl mx-auto">
      {/* 1. Título */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-slate-500 dark:text-slate-400" /> Configuración del Sistema
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Estructura de catálogo, ubicaciones físicas, equipo y preferencias PWA
          </p>
        </div>

        {/* Botón de cambio de tema rápido */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-4 h-4 text-indigo-500" /> Modo Oscuro
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 text-amber-400" /> Modo Claro
            </>
          )}
        </button>
      </div>

      {/* 2. Tarjeta del Inventario Activo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">
                Inventario Activo
              </span>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-lg">{currentInventory?.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{currentInventory?.description || 'Sin descripción'}</p>
            </div>
          </div>
          <button
            onClick={onOpenInventorySelector}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow transition-all active:scale-95"
          >
            Cambiar
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
          <div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Moneda:</span>
            <span className="font-bold text-slate-900 dark:text-white">{currentInventory?.currency || 'USD'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Tu Rol:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400 capitalize">{currentInventory?.role || 'owner'}</span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Fecha Creación:</span>
            <span className="font-medium text-slate-500 dark:text-slate-400">{formatDate(currentInventory?.created_at)}</span>
          </div>
        </div>
      </div>

      {/* 3. Menú de Configuración Libre */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
        {/* Categorías */}
        <button
          onClick={onOpenCategories}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left group"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-105 transition-transform">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Categorías y Subcategorías Dinámicas</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Creación libre de etiquetas, colores y familias</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
        </button>

        {/* Ubicaciones Físicas y Etiquetas */}
        <button
          onClick={onOpenLocations}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left group"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-600/10 text-amber-600 dark:text-amber-400 rounded-xl group-hover:scale-105 transition-transform">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Gestión de Ubicaciones Físicas</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Almacenes, pasillos y generador de etiquetas (85.6 × 53.9 mm)</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
        </button>

        {/* Equipo y Colaboradores */}
        <button
          onClick={onOpenCollaborators}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left group"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Equipo y Colaboradores</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Invitar por correo electrónico y gestionar permisos</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
        </button>
      </div>

      {/* 4. Información de PWA y Dispositivo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Aplicación Web Progresiva (PWA)</h4>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Esta plataforma está optimizada para smartphones Android e iOS. Puedes añadirla a tu pantalla de inicio directamente desde las opciones del navegador para usarla como una aplicación nativa a pantalla completa y con acceso instantáneo a la cámara.
        </p>
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-300">
            <Info className="w-3.5 h-3.5" /> ¿Cómo instalarla en tu teléfono?
          </div>
          <p>
            <strong>En Safari (iOS):</strong> Pulsa el botón "Compartir" y selecciona "Añadir a la pantalla de inicio".
          </p>
          <p>
            <strong>En Chrome (Android):</strong> Pulsa los 3 puntos del menú y selecciona "Instalar aplicación".
          </p>
        </div>
      </div>

      {/* 5. Sesión de Usuario */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex items-center justify-between shadow-sm">
        <div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Sesión Activa</span>
          <p className="text-xs font-bold text-slate-900 dark:text-white">{user?.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 dark:bg-rose-600/20 hover:bg-rose-100 dark:hover:bg-rose-600/30 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs font-semibold transition-all active:scale-95"
        >
          <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
        </button>
      </div>
    </div>
  );
};
