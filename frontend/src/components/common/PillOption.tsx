import React from 'react';

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
 * Estilo base proveniente de la ventana flotante de Backups con interpolación y transición suave.
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
  const content = children || label;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[38px] rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-all duration-200 ease-out select-none active:scale-95 border ${
        active
          ? 'mobile-tab-active bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-transparent shadow-xs font-semibold'
          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200/70 dark:hover:bg-neutral-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {content && <span>{content}</span>}
      {badge !== undefined && badge !== null && (
        <span
          className={`text-[10px] font-mono font-semibold rounded-full px-2 py-0.5 transition-colors duration-200 ${
            active
              ? 'bg-neutral-800 text-neutral-200 dark:bg-neutral-200 dark:text-neutral-800'
              : 'bg-neutral-200/80 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
};

export default PillOption;
