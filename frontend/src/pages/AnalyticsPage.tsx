import React, { useMemo } from 'react';
import {
  BarChart3,
  DollarSign,
  Package,
  AlertTriangle,
  MapPin,
  Tag
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
    const lowStockItems = activeProducts.filter(p => p.stock < (p.min_stock !== undefined && p.min_stock !== null ? p.min_stock : 1) && p.stock > 0);
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
    <div className="space-y-6 pb-28 sm:pb-12 max-w-[1440px] mx-auto font-sans text-slate-900">
      {/* 1. Cabecera Industrial */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-slate-900">
            Métricas y análisis
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Valorización integral, ocupación por almacén y salud del inventario activo.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-xs px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 tabular-nums">
            {locations.length} ubicaciones · {categories.length} categorías
          </span>
        </div>
      </div>

      {/* 2. Tarjetas de Resumen KPI 4x1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-ui-card desktop-hover-lift flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Valor total activo</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-semibold tabular-nums text-slate-900 tracking-[-0.02em] truncate">
              {formatCurrency(stats.totalValuation, currentInventory?.currency)}
            </p>
            <span className="text-xs text-slate-500 block mt-1">En existencias activas</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-ui-card desktop-hover-lift flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Unidades físicas</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-semibold tabular-nums text-slate-900 tracking-[-0.02em]">
              {stats.totalUnits.toLocaleString()} <span className="text-xs font-normal text-slate-500">und</span>
            </p>
            <span className="text-xs text-slate-500 block mt-1 tabular-nums">En {stats.activeCount} SKUs únicos</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-ui-card desktop-hover-lift flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Stock bajo y agotados</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
              stats.lowStockCount > 0 || stats.outOfStockCount > 0
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stats.lowStockCount > 0 || stats.outOfStockCount > 0 ? 'bg-red-600' : 'bg-emerald-500'}`} />
              {stats.lowStockCount > 0 || stats.outOfStockCount > 0 ? 'Atención' : 'Estable'}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-semibold tabular-nums text-slate-900 tracking-[-0.02em]">
              {stats.lowStockCount} <span className="text-xs font-normal text-slate-500">ítems</span>
            </p>
            <span className="text-xs text-red-600 font-medium block mt-1 tabular-nums">
              {stats.outOfStockCount} productos sin existencias
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-ui-card desktop-hover-lift flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Ubicaciones físicas</span>
            <MapPin className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-semibold tabular-nums text-slate-900 tracking-[-0.02em]">
              {locations.length} <span className="text-xs font-normal text-slate-500">espacios</span>
            </p>
            <span className="text-xs text-slate-500 block mt-1">Con rótulos y código QR</span>
          </div>
        </div>
      </div>

      {/* 3. Gráficos de Distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-ui-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="font-semibold text-sm text-slate-900">
              Distribución por ubicación
            </h3>
            <span className="text-xs text-slate-500">Volumen de unidades</span>
          </div>

          <div className="space-y-4">
            {stats.locationStats.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No hay ubicaciones registradas
              </div>
            ) : (
              stats.locationStats.map((loc) => (
                <div key={loc.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-slate-900 truncate">{loc.name}</span>
                      <span className="font-mono text-[10px] text-slate-600 font-medium px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded">
                        {loc.code}
                      </span>
                    </div>
                    <span className="font-mono font-medium text-slate-900 tabular-nums shrink-0">
                      {loc.units} uds ({loc.percent}%)
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-900 rounded-full transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
                      style={{ width: `${Math.max(loc.percent, 3)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                    <span>{loc.productsCount} SKUs asignados</span>
                    <span>{formatCurrency(loc.valuation, currentInventory?.currency)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-ui-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="font-semibold text-sm text-slate-900">
              Valorización por categoría
            </h3>
            <span className="text-xs text-slate-500">Capital inmovilizado</span>
          </div>

          <div className="space-y-4">
            {stats.categoryStats.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No hay categorías registradas
              </div>
            ) : (
              stats.categoryStats.map((cat) => (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color || '#0f172a' }}
                      />
                      <span className="font-semibold text-slate-900 truncate">{cat.name}</span>
                    </div>
                    <span className="font-mono font-medium text-slate-900 tabular-nums shrink-0">
                      {formatCurrency(cat.valuation, currentInventory?.currency)} ({cat.percent}%)
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-700 rounded-full transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
                      style={{ width: `${Math.max(cat.percent, 3)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                    <span>{cat.units} unidades físicas</span>
                    <span>{cat.productsCount} SKUs</span>
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

export default AnalyticsPage;
