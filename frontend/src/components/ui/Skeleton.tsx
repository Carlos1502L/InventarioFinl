import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Componente base atómico de Skeleton con animación de pulso suave.
 * Soporta de forma nativa temas claro y oscuro mediante clases semánticas.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      className={`animate-pulse bg-neutral-200/90 dark:bg-neutral-800/80 rounded-xl transition-colors duration-200 ${className}`}
      {...props}
    />
  );
};

/**
 * Skeleton para las tarjetas de inventario (Wallet Stack móvil y KPIs desktop).
 * Replica fielmente el tamaño, margen y elevación de la tarjeta principal.
 */
export const InventoryCardsSkeleton: React.FC<{ isDesktop?: boolean }> = ({ isDesktop = false }) => {
  if (isDesktop) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="w-24 h-4 rounded-md" />
              <Skeleton className="w-8 h-8 rounded-xl" />
            </div>
            <Skeleton className="w-32 h-7 rounded-lg mt-2" />
            <Skeleton className="w-20 h-3 rounded-md mt-1" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full relative min-h-[220px] sm:min-h-[240px] px-1">
      <div className="w-full h-[220px] sm:h-[240px] rounded-3xl bg-neutral-900/90 dark:bg-neutral-950 p-6 flex flex-col justify-between shadow-xl border border-neutral-800 animate-pulse">
        {/* Cabecera de la tarjeta */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="w-32 h-5 rounded-md bg-neutral-800 dark:bg-neutral-850" />
            <div className="w-24 h-3 rounded-md bg-neutral-800/60 dark:bg-neutral-850" />
          </div>
          <div className="w-9 h-9 rounded-2xl bg-neutral-800 dark:bg-neutral-850" />
        </div>

        {/* Valuación central */}
        <div className="space-y-2 my-auto">
          <div className="w-20 h-3 rounded-md bg-neutral-800/60" />
          <div className="w-44 h-8 rounded-lg bg-neutral-800" />
        </div>

        {/* Métricas inferiores */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-800/80">
          <div className="space-y-1">
            <div className="w-12 h-2.5 rounded bg-neutral-800/60" />
            <div className="w-16 h-4 rounded bg-neutral-800" />
          </div>
          <div className="space-y-1">
            <div className="w-12 h-2.5 rounded bg-neutral-800/60" />
            <div className="w-16 h-4 rounded bg-neutral-800" />
          </div>
          <div className="space-y-1">
            <div className="w-12 h-2.5 rounded bg-neutral-800/60" />
            <div className="w-16 h-4 rounded bg-neutral-800" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton para la tabla y listado de productos de InventoryPage.
 * En desktop muestra filas tabulares con cabeceras y en móvil tarjetas compactas.
 */
export const ProductTableSkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-4">
      {/* Vista Desktop (>= 768px): Tabla con filas */}
      <div className="hidden md:block bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Encabezado */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-neutral-50 dark:bg-neutral-850 border-b border-neutral-200 dark:border-neutral-800">
          <Skeleton className="col-span-4 h-4 rounded" />
          <Skeleton className="col-span-2 h-4 rounded" />
          <Skeleton className="col-span-2 h-4 rounded" />
          <Skeleton className="col-span-2 h-4 rounded" />
          <Skeleton className="col-span-2 h-4 rounded" />
        </div>
        {/* Filas */}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
              <div className="col-span-4 flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="w-3/4 h-4 rounded" />
                  <Skeleton className="w-1/2 h-3 rounded" />
                </div>
              </div>
              <div className="col-span-2">
                <Skeleton className="w-20 h-5 rounded-full" />
              </div>
              <div className="col-span-2">
                <Skeleton className="w-16 h-5 rounded" />
              </div>
              <div className="col-span-2">
                <Skeleton className="w-20 h-5 rounded" />
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <Skeleton className="w-8 h-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vista Móvil (< 768px): Tarjetas de producto */}
      <div className="block md:hidden space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="space-y-2 min-w-0 flex-1">
                <Skeleton className="w-3/4 h-4 rounded" />
                <div className="flex items-center gap-2">
                  <Skeleton className="w-16 h-3 rounded" />
                  <Skeleton className="w-12 h-3 rounded" />
                </div>
              </div>
            </div>
            <div className="text-right space-y-1.5 shrink-0">
              <Skeleton className="w-16 h-4 rounded ml-auto" />
              <Skeleton className="w-12 h-5 rounded-full ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton para el resumen y transacciones de SalesHistoryPage y recientes en Home.
 */
export const SalesHistorySkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-6">
      {/* Tarjetas KPI Superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="w-20 h-3 rounded" />
              <Skeleton className="w-7 h-7 rounded-lg" />
            </div>
            <Skeleton className="w-28 h-6 rounded-md" />
            <Skeleton className="w-16 h-2.5 rounded" />
          </div>
        ))}
      </div>

      {/* Lista de Transacciones */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-xs divide-y divide-neutral-100 dark:divide-neutral-800/60">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-24 h-4 rounded" />
                  <Skeleton className="w-14 h-4 rounded-full" />
                </div>
                <Skeleton className="w-36 h-3 rounded" />
              </div>
            </div>
            <div className="text-right space-y-1 shrink-0">
              <Skeleton className="w-20 h-5 rounded ml-auto" />
              <Skeleton className="w-14 h-3 rounded ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
