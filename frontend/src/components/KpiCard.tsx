import React from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, AlertTriangle } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  badgeText: string;
  badgeType: 'success' | 'alert' | 'neutral';
  icon: React.ReactNode;
  iconBgColor?: string;
  subtitle?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  badgeText,
  badgeType,
  icon,
  iconBgColor = 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
  subtitle
}) => {
  return (
    <Card className="p-5 flex flex-col justify-between hover:shadow-md transition-all duration-200 border-slate-200/80 dark:border-slate-800">
      <div className="flex items-start justify-between">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <div className={`p-2.5 rounded-xl ${iconBgColor}`}>
          {icon}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {value}
          </span>

          {/* Badge de Estado: Verde para éxito, Rojo suave para alerta */}
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
              badgeType === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                : badgeType === 'alert'
                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60 animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {badgeType === 'success' && <TrendingUp className="w-3 h-3 text-emerald-600" />}
            {badgeType === 'alert' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
            {badgeText}
          </span>
        </div>

        {subtitle && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            {subtitle}
          </p>
        )}
      </div>
    </Card>
  );
};
