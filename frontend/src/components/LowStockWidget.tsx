import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowRight, RefreshCw, Package } from 'lucide-react';
import { Product } from '../types/database';

interface LowStockWidgetProps {
  products: Product[];
  onViewAllLowStock: () => void;
  onRestock: (product: Product) => void;
}

export const LowStockWidget: React.FC<LowStockWidgetProps> = ({
  products,
  onViewAllLowStock,
  onRestock
}) => {
  // Filtrar productos con stock <= min_stock
  const lowStockProducts = products
    .filter(p => p.status === 'ACTIVE' && p.stock <= (p.min_stock || 1))
    .slice(0, 5);

  return (
    <Card className="col-span-1 flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500" /> Stock Bajo
        </CardTitle>

        {/* Enlace "Ver todos" en tono naranja (#FF6B00) - RF-07.1 */}
        <button
          onClick={onViewAllLowStock}
          className="text-xs font-bold text-[#FF6B00] hover:underline flex items-center gap-0.5"
        >
          <span>Ver todos</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </CardHeader>

      <CardContent className="space-y-3 flex-1">
        {lowStockProducts.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-1.5">
            <Package className="w-8 h-8 mx-auto text-emerald-500/70" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">¡Inventario Saludable!</p>
            <p className="text-[11px] text-slate-400">No hay productos en umbral de alerta.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {lowStockProducts.map(prod => {
              const categoryInitial = prod.categories?.name
                ? prod.categories.name.slice(0, 2).toUpperCase()
                : 'GE';

              return (
                <div
                  key={prod.id}
                  className="py-2.5 flex items-center justify-between gap-3 group hover:bg-slate-50/60 dark:hover:bg-slate-800/30 px-1 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Badge con iniciales de categoría */}
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-[10px] flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                      {categoryInitial}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {prod.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {prod.code}
                      </p>
                    </div>
                  </div>

                  {/* Cantidad en Rojo */}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400 block">
                      {prod.stock} uds.
                    </span>
                    <span className="text-[9px] text-slate-400 block">
                      Mín: {prod.min_stock || 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Botón Inferior "Reponer inventario" (RF-07.1) */}
      <CardFooter className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <Button
          onClick={onViewAllLowStock}
          variant="outline"
          className="w-full text-xs font-bold flex items-center justify-center gap-1.5 border-[#FF6B00]/40 text-[#FF6B00] hover:bg-orange-50 dark:hover:bg-orange-950/20"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reponer inventario
        </Button>
      </CardFooter>
    </Card>
  );
};
