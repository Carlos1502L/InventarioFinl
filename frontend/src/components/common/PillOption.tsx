import React from 'react';
import { useIsDarkModal } from '../modals/ModalShell';

export interface PillOptionProps {
  active: boolean;
  onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  children?: React.ReactNode;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

/**
 * Componente unificado para botones tipo píldora (PillOption).
 * Adapta automáticamente sus tokens entre páginas claras y modales Dark Industrial Slate.
 */
export const PillOption: React.FC<PillOptionProps> = ({
  active,
  onClick,
  children,
  label,
  icon,
  badge,
  disabled = false,
  className = '',
  type = 'button'
}) => {
  const isDarkModal = useIsDarkModal();
  const content = children || label;

  const toneClasses = isDarkModal
    ? active
      ? 'bg-slate-100 text-slate-950 border-transparent font-semibold shadow-sm'
      : 'bg-slate-800/75 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white font-medium'
    : active
    ? 'mobile-tab-active bg-slate-900 text-white border-transparent shadow-xs font-semibold'
    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70 font-medium';

  const badgeClasses = isDarkModal
    ? active
      ? 'bg-slate-900/15 text-slate-900'
      : 'bg-slate-900/80 text-slate-300 border border-slate-700/70'
    : active
    ? 'bg-slate-800 text-slate-200'
    : 'bg-slate-200/80 text-slate-600';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] lg:min-h-[36px] rounded-full text-xs cursor-pointer whitespace-nowrap transition-[background-color,color,border-color,transform] duration-150 ease-out select-none active:scale-[0.97] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${toneClasses} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {content && <span>{content}</span>}
      {badge !== undefined && badge !== null && (
        <span
          className={`text-[10px] font-mono tabular-nums font-semibold rounded-full px-2 py-0.5 transition-colors duration-150 ${badgeClasses}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
};

export default PillOption;
