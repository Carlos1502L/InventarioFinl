import React from 'react';
import { useIsDarkModal } from '../modals/ModalShell';

export interface CancelButtonProps {
  onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'reset' | 'submit';
}

/**
 * Componente unificado y estandarizado para botones "Cancelar" / "Cerrar" en ventanas flotantes y modales.
 */
export const CancelButton: React.FC<CancelButtonProps> = ({
  onClick,
  label = 'Cancelar',
  disabled = false,
  className = '',
  type = 'button'
}) => {
  const isDarkModal = useIsDarkModal();

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[44px] lg:min-h-[40px] px-4 py-2 text-xs font-semibold rounded-xl transition-[background-color,color,border-color,transform] duration-150 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
        isDarkModal
          ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80'
          : 'mobile-cancel-btn text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200'
      } ${className}`}
    >
      {label}
    </button>
  );
};

export default CancelButton;
