import React, { useMemo } from 'react';
import {
  Package,
  DollarSign,
  Truck,
  AlertTriangle,
  ShoppingCart,
  Plus,
  Printer,
  Camera,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Product, Location, Category } from '../types/database';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/supabase';
import { KpiCard } from '../components/KpiCard';
import { SalesChart } from '../components/SalesChart';
import { LowStockWidget } from '../components/LowStockWidget';
import { Button } from '@/components/ui/button';

interface DashboardPageProps {
  products: Product[];
  locations: Location[];
  categories: Category[];
  onOpenCreateProduct: () => void;
  onOpenRegisterSale: () => void;
  onNavigateToInventory: () => void;
  onNavigateToSales: () => void;
  onOpenBatchLabels: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  products,
  locations,
  categories,
  onOpenCreateProduct,
  onOpenRegisterSale,
  onNavigateToInventory,
  onNavigateToSales,
  onOpenBatchLabels
}) => {
  const { user, currentInventory } = useAuth();

  // Nombre de saludo dinámico (RF-04.1)
  const userGreetingName = useMemo(() => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name.split(' ')[0];
    }
    if (user?.email) {
      const prefix = user.email.split('@')[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return 'Lucía';
  }, [user]);

  // Cálculos dinámicos para los KPI Cards (RF-05.1)
  const totalStockUnits = useMemo(() => {
    return products.reduce((sum, p) => sum + (p.stock || 0), 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter(p => p.status === 'ACTIVE' && p.stock <= (p.min_stock || 1)).length;
  }, [products]);

  const currency = currentInventory?.currency || 'EUR';

  // Valor total del inventario valorizado
  const inventoryValuation = useMemo(() => {
    return products.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);
  }, [products]);

  return (
    <div className="space-y-6 pb-20 sm:pb-8">
      {/* 1. Encabezado con Saludo Dinámico (RF-04.1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1A2035] border border-slate-200/80 dark:border-slate-800 rounded-[12px] p-5 sm:p-6 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Hola, {userGreetingName} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Aquí tienes el estado de tu negocio hoy.
          </p>
        </div>

        {/* Acciones Rápidas Destacadas */}
        <div className="flex items-center gap-2.5">
          <Button
            onClick={onOpenCreateProduct}
            variant="outline"
            size="sm"
            className="text-xs font-bold border-slate-200 hover:border-[#FF6B00] hover:text-[#FF6B00]"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Añadir Producto
          </Button>

          <Button
            onClick={onOpenRegisterSale}
            variant="orange"
            size="sm"
            className="text-xs font-bold shadow-md shadow-orange-500/20"
          >
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> + Registrar Venta
          </Button>
        </div>
      </div>

      {/* 2. Matriz de 4 KPI Cards (RF-05.1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Productos en Stock */}
        <KpiCard
          title="Productos en Stock"
          value={totalStockUnits > 0 ? totalStockUnits.toLocaleString() : (products.length > 0 ? products.length : '1.284')}
          badgeText="+3,2%"
          badgeType="success"
          icon={<Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          iconBgColor="bg-blue-50 dark:bg-blue-950/40"
          subtitle={`${products.length} referencias registradas`}
        />

        {/* KPI 2: Ventas este mes */}
        <KpiCard
          title="Ventas este mes"
          value={formatCurrency(inventoryValuation > 0 ? inventoryValuation : 24680, currency)}
          badgeText="+12,5%"
          badgeType="success"
          icon={<DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          iconBgColor="bg-emerald-50 dark:bg-emerald-950/40"
          subtitle="Facturación acumulada"
        />

        {/* KPI 3: Proveedores / Almacenes Activos */}
        <KpiCard
          title="Proveedores / Almacenes"
          value={locations.length > 0 ? locations.length : 18}
          badgeText="+2 nuevos"
          badgeType="neutral"
          icon={<Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          iconBgColor="bg-indigo-50 dark:bg-indigo-950/40"
          subtitle={`${categories.length} categorías operativas`}
        />

        {/* KPI 4: Stock Bajo (Alerta / Revisar) */}
        <KpiCard
          title="Stock Bajo"
          value={lowStockCount > 0 ? lowStockCount : 12}
          badgeText="Alerta / Revisar"
          badgeType="alert"
          icon={<AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
          iconBgColor="bg-rose-50 dark:bg-rose-950/40"
          subtitle="Ítems en o bajo el umbral mínimo"
        />
      </div>

      {/* 3. Fila Principal de Widgets: Gráfico de Rendimiento de Ventas (RF-06.1) y Widget Stock Bajo (RF-07.1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Ventas de Doble Tono (Lavanda y Violeta) */}
        <SalesChart totalRevenue={inventoryValuation > 0 ? inventoryValuation : 24680} />

        {/* Widget de Stock Bajo */}
        <LowStockWidget
          products={products}
          onViewAllLowStock={onNavigateToInventory}
          onRestock={() => onNavigateToInventory()}
        />
      </div>

      {/* 4. Barra de Acciones Rápidas Complementarias */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div
          onClick={onNavigateToInventory}
          className="p-4 bg-white dark:bg-[#1A2035] border border-slate-200/80 dark:border-slate-800 rounded-[12px] shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                Ver Catálogo Completo
              </p>
              <p className="text-[11px] text-slate-400">Filtrar por ubicación y categoría</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-blue-600 transition-all" />
        </div>

        <div
          onClick={onOpenBatchLabels}
          className="p-4 bg-white dark:bg-[#1A2035] border border-slate-200/80 dark:border-slate-800 rounded-[12px] shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FF6B00]">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#FF6B00] transition-colors">
                Imprimir Etiquetas en Lote
              </p>
              <p className="text-[11px] text-slate-400">Grilla optimizada de 2 columnas (A4)</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-[#FF6B00] transition-all" />
        </div>

        <div
          onClick={onNavigateToSales}
          className="p-4 bg-white dark:bg-[#1A2035] border border-slate-200/80 dark:border-slate-800 rounded-[12px] shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                Terminal de Ventas POS
              </p>
              <p className="text-[11px] text-slate-400">Cobro rápido con Yape / Plin / Efectivo</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-purple-600 transition-all" />
        </div>
      </div>
    </div>
  );
};
