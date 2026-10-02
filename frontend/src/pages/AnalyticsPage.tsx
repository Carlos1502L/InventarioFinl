import React, { useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  MapPin,
  Tag,
  Boxes,
  PieChart,
  Layers
} from 'lucide-react';
import { Product, Category, Location } from '../types/database';
import { formatCurrency } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface AnalyticsPageProps {
  products: Product[];
  categories: Category[];
  locations: Location[];
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  products,
  categories,
  locations
}) => {
  const { currentInventory } = useAuth();

  // Cálculos Globales
  const stats = useMemo(() => {
    const activeProducts = products.filter(p => p.status === 'ACTIVE');
    const withdrawnProducts = products.filter(p => p.status === 'WITHDRAWN');
    const totalUnits = activeProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
    const totalValuation = activeProducts.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);
    const lowStockItems = activeProducts.filter(p => p.stock <= (p.min_stock || 5) && p.stock > 0);
    const outOfStockItems = activeProducts.filter(p => p.stock === 0);

    // Distribución por Ubicación (Ocupación y Unidades)
    const locationStats = locations.map(loc => {
      const prodsInLoc = activeProducts.filter(p => p.location_id === loc.id);
      const units = prodsInLoc.reduce((sum, p) => sum + (p.stock || 0), 0);
      const valuation = prodsInLoc.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);
      const percent = totalUnits > 0 ? (units / totalUnits) * 100 : 0;
      return {
        id: loc.id,
        name: loc.name,
        code: loc.code,
        productsCount: prodsInLoc.length,
        units,
        valuation,
        percent: Math.round(percent)
      };
    }).sort((a, b) => b.units - a.units);

    // Distribución por Categoría (Valorización y Cantidad)
    const categoryStats = categories.map(cat => {
      const prodsInCat = activeProducts.filter(p => p.category_id === cat.id);
      const units = prodsInCat.reduce((sum, p) => sum + (p.stock || 0), 0);
      const valuation = prodsInCat.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);
      const percent = totalValuation > 0 ? (valuation / totalValuation) * 100 : 0;
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color || '#3B82F6',
        productsCount: prodsInCat.length,
        units,
        valuation,
        percent: Math.round(percent)
      };
    }).sort((a, b) => b.valuation - a.valuation);

    return {
      activeCount: activeProducts.length,
      withdrawnCount: withdrawnProducts.length,
      totalUnits,
      totalValuation,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      locationStats,
      categoryStats
    };
  }, [products, categories, locations]);

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* 1. Título */}
      <div>
        <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
          <BarChart3 className="w-6 h-6 text-indigo-400" /> Estadísticas y Ocupación del Inventario
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Métricas clave de valorización, nivel de existencias y distribución por almacén
        </p>
      </div>

      {/* 2. Tarjetas de Resumen KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Valor Total */}
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-4 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Valor Total Activo</span>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-400">
            {formatCurrency(stats.totalValuation, currentInventory?.currency)}
          </p>
          <span className="text-[11px] text-slate-500 block">En existencias disponibles</span>
        </div>

        {/* Total Unidades */}
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-4 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Unidades</span>
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-white">
            {stats.totalUnits.toLocaleString()} <span className="text-xs font-normal text-slate-400">uds</span>
          </p>
          <span className="text-[11px] text-slate-500 block">En {stats.activeCount} productos únicos</span>
        </div>

        {/* Alerta de Stock Bajo */}
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-4 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Alertas de Stock</span>
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-amber-400">
            {stats.lowStockCount} <span className="text-xs font-normal text-slate-400">bajo stock</span>
          </p>
          <span className="text-[11px] text-rose-400 font-medium block">
            {stats.outOfStockCount} productos agotados (0 stock)
          </span>
        </div>

        {/* Ubicaciones Activas */}
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-4 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Ubicaciones Físicas</span>
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-white">
            {locations.length} <span className="text-xs font-normal text-slate-400">almacenes</span>
          </p>
          <span className="text-[11px] text-slate-500 block">Con códigos QR generados</span>
        </div>
      </div>

      {/* 3. Gráficos de Distribución (Almacenes y Categorías) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución y Ocupación por Almacén / Ubicación */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-600/20 text-amber-400 rounded-xl">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Distribución por Almacén / Ubicación</h3>
                <p className="text-xs text-slate-400">Ocupación porcentual según volumen de unidades</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {stats.locationStats.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">No hay ubicaciones registradas</div>
            ) : (
              stats.locationStats.map((loc) => (
                <div key={loc.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{loc.name}</span>
                      <span className="font-mono text-[10px] text-slate-400 px-1.5 py-0.2 bg-slate-800 rounded">
                        {loc.code}
                      </span>
                    </div>
                    <span className="text-slate-300 font-semibold">
                      {loc.units} uds ({loc.percent}%)
                    </span>
                  </div>

                  {/* Barra de Progreso Visual */}
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(loc.percent, 3)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{loc.productsCount} productos asignados</span>
                    <span>{formatCurrency(loc.valuation, currentInventory?.currency)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Valorización por Categoría */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Valorización por Categoría</h3>
                <p className="text-xs text-slate-400">Participación monetaria en el inventario</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {stats.categoryStats.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">No hay categorías registradas</div>
            ) : (
              stats.categoryStats.map((cat) => (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-bold text-white">{cat.name}</span>
                    </div>
                    <span className="text-emerald-400 font-bold">
                      {formatCurrency(cat.valuation, currentInventory?.currency)} ({cat.percent}%)
                    </span>
                  </div>

                  {/* Barra de Progreso con el color de la categoría */}
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        backgroundColor: cat.color,
                        width: `${Math.max(cat.percent, 3)}%`
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{cat.units} unidades físicas</span>
                    <span>{cat.productsCount} productos</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
