import React from 'react';

export interface CancelButtonProps {
  onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'reset' | 'submit';
}

/**
 * Componente unificado y estandarizado para botones "Cancelar" en ventanas flotantes y modales.
 * Fuente única de la verdad: Modal "Editar Información" (EditInventoryModal.tsx).
 */
export const CancelButton: React.FC<CancelButtonProps> = ({
  onClick,
  label = 'Cancelar',
  disabled = false,
  className = '',
  type = 'button'
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`mobile-cancel-btn px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all duration-150 cursor-pointer active:scale-[0.98] active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {label}
    </button>
  );
};

export default CancelButton;
