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
    <div className="space-y-6 pb-28 sm:pb-12 max-w-7xl mx-auto font-normal text-[#1E3A5F]">
      {/* 1. Cabecera Editorial */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#E8B4A0] uppercase block">
            STOCK TELEMETRY // SPATIAL & METRIC AUDIT
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E3A5F] uppercase">
            Telemetría de Stock & Métricas
          </h1>
          <p className="text-xs text-[#616161] font-light mt-0.5">
            Valorización integral, distribución espacial por almacén y estado de contingencia del catálogo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-full bg-[#F8F9FA] border border-[#E5E7EB] text-[#1E3A5F] font-mono text-xs uppercase">
            {locations.length} depósitos // {categories.length} categorías
          </div>
        </div>
      </div>

      {/* 2. Tarjetas de Resumen KPI 4x1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Valor Total Activo */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#616161]">
              Valor Total Activo
            </span>
            <DollarSign className="w-4 h-4 text-[#E8B4A0]" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#1E3A5F] font-mono mt-1">
            {formatCurrency(stats.totalValuation, currentInventory?.currency)}
          </p>
          <span className="text-[10px] font-mono text-[#616161] block">En existencias activas</span>
        </div>

        {/* Total Unidades */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#616161]">
              Unidades Físicas
            </span>
            <Package className="w-4 h-4 text-[#E8B4A0]" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#1E3A5F] font-mono mt-1">
            {stats.totalUnits.toLocaleString()} <span className="text-xs font-normal text-[#616161]">uds</span>
          </p>
          <span className="text-[10px] font-mono text-[#616161] block">En {stats.activeCount} SKUs únicos</span>
        </div>

        {/* Alerta de Stock Bajo con Dot Nude #E8B4A0 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#616161]">
              Stock Bajo / Alerta
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#E8B4A0] shadow-sm animate-pulse" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#1E3A5F] font-mono mt-1">
            {stats.lowStockCount} <span className="text-xs font-normal text-[#616161]">ítems</span>
          </p>
          <span className="text-[10px] font-mono text-rose-600 block">
            {stats.outOfStockCount} productos agotados (0 uds)
          </span>
        </div>

        {/* Ubicaciones Físicas */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#616161]">
              Ubicaciones Físicas
            </span>
            <MapPin className="w-4 h-4 text-[#E8B4A0]" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#1E3A5F] font-mono mt-1">
            {locations.length} <span className="text-xs font-normal text-[#616161]">espacios</span>
          </p>
          <span className="text-[10px] font-mono text-[#616161] block">Con rótulos y códigos QR</span>
        </div>
      </div>

      {/* 3. Gráficos de Distribución (Almacenes y Categorías) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución y Ocupación por Almacén / Ubicación */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#E8B4A0] block">
                OCUPACIÓN FÍSICA
              </span>
              <h3 className="font-bold text-base text-[#1E3A5F] uppercase tracking-tight">
                Distribución por Ubicación
              </h3>
            </div>
            <span className="text-xs font-mono text-[#616161]">
              Volumen de unidades
            </span>
          </div>

          <div className="space-y-4">
            {stats.locationStats.length === 0 ? (
              <div className="text-center py-8 text-xs font-mono text-[#616161] uppercase">
                No hay ubicaciones registradas
              </div>
            ) : (
              stats.locationStats.map((loc) => (
                <div key={loc.id} className="space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1E3A5F] uppercase">{loc.name}</span>
                      <span className="text-[10px] text-[#616161] font-semibold px-1.5 py-0.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-full">
                        {loc.code}
                      </span>
                    </div>
                    <span className="text-[#1E3A5F]">
                      {loc.units} uds ({loc.percent}%)
                    </span>
                  </div>

                  {/* Barra de Progreso Minimalista Awwwards */}
                  <div className="w-full h-2 bg-[#F8F9FA] border border-[#E5E7EB] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1E3A5F] rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(loc.percent, 3)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#616161]">
                    <span>{loc.productsCount} SKUs asignados</span>
                    <span>{formatCurrency(loc.valuation, currentInventory?.currency)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Valorización por Categoría */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#E8B4A0] block">
                PARTICIPACIÓN FINANCIERA
              </span>
              <h3 className="font-bold text-base text-[#1E3A5F] uppercase tracking-tight">
                Valorización por Categoría
              </h3>
            </div>
            <span className="text-xs font-mono text-[#616161]">
              Capital inmovilizado
            </span>
          </div>

          <div className="space-y-4">
            {stats.categoryStats.length === 0 ? (
              <div className="text-center py-8 text-xs font-mono text-[#616161] uppercase">
                No hay categorías registradas
              </div>
            ) : (
              stats.categoryStats.map((cat) => (
                <div key={cat.id} className="space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cat.color || '#E8B4A0' }}
                      />
                      <span className="font-bold text-[#1E3A5F] uppercase">{cat.name}</span>
                    </div>
                    <span className="text-[#1E3A5F]">
                      {formatCurrency(cat.valuation, currentInventory?.currency)} ({cat.percent}%)
                    </span>
                  </div>

                  {/* Barra de Progreso */}
                  <div className="w-full h-2 bg-[#F8F9FA] border border-[#E5E7EB] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E8B4A0] rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(cat.percent, 3)}%`
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#616161]">
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
