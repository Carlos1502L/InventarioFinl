import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TrendingUp, BarChart2 } from 'lucide-react';
import { formatCurrency } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface SalesChartProps {
  totalRevenue?: number;
}

export const SalesChart: React.FC<SalesChartProps> = ({ totalRevenue = 24680 }) => {
  const { currentInventory } = useAuth();
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  // Datos simulados/proyectados para el gráfico de barras doble tono (lavanda #C4B5FD y violeta #7C3AED)
  const chartData = [
    { label: 'Lun', sales: 4200, orders: 2800 },
    { label: 'Mar', sales: 5800, orders: 3900 },
    { label: 'Mié', sales: 7100, orders: 4800 },
    { label: 'Jue', sales: 6300, orders: 4100 },
    { label: 'Vie', sales: 9400, orders: 6200 },
    { label: 'Sáb', sales: 11200, orders: 7500 },
    { label: 'Dom', sales: 8600, orders: 5400 }
  ];

  const maxVal = 12000;

  return (
    <Card className="col-span-1 lg:col-span-2 flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#FF6B00]" /> Rendimiento de Ventas
          </CardTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Ingresos brutos comparados con el volumen de transacciones
          </p>
        </div>

        {/* Selector de Período (Semana, Mes, Año) */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setPeriod('week')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              period === 'week'
                ? 'bg-white dark:bg-[#1A2035] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              period === 'month'
                ? 'bg-white dark:bg-[#1A2035] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Mes
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              period === 'year'
                ? 'bg-white dark:bg-[#1A2035] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Año
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Leyenda y Total */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white block">
              {formatCurrency(totalRevenue, currentInventory?.currency || 'EUR')}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> +14.2% vs periodo anterior
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-[#7C3AED]" />
              <span>Ingresos (€)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-[#C4B5FD]" />
              <span>Volumen Ventas</span>
            </div>
          </div>
        </div>

        {/* Gráfico de Barras de Doble Tono (Lavanda #C4B5FD y Violeta #7C3AED) */}
        <div className="h-52 w-full flex items-end justify-between gap-2 sm:gap-4 pt-6 pb-2 border-b border-slate-100 dark:border-slate-800">
          {chartData.map((item, idx) => {
            const hSales = Math.round((item.sales / maxVal) * 100);
            const hOrders = Math.round((item.orders / maxVal) * 100);

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="w-full flex items-end justify-center gap-1 h-full">
                  {/* Barra Violeta (Venta Principal) */}
                  <div
                    style={{ height: `${hSales}%` }}
                    className="w-3 sm:w-5 bg-[#7C3AED] rounded-t-lg group-hover:bg-[#6D28D9] transition-all duration-300 relative"
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap z-10 transition-opacity">
                      €{item.sales}
                    </div>
                  </div>

                  {/* Barra Lavanda (Volumen / Base) */}
                  <div
                    style={{ height: `${hOrders}%` }}
                    className="w-3 sm:w-5 bg-[#C4B5FD] dark:bg-[#A78BFA] rounded-t-lg group-hover:opacity-90 transition-all duration-300"
                  />
                </div>

                <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
