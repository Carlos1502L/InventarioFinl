import React from 'react';
import { useIsDarkModal } from '../modals/ModalShell';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  activeColor?: string;
}

/**
 * Componente Switch estandarizado y reutilizable.
 */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  id,
  disabled = false,
  ariaLabel,
  className = '',
  size = 'md',
  activeColor
}) => {
  const isDarkModal = useIsDarkModal();
  const resolvedActiveColor = activeColor || (isDarkModal ? 'bg-indigo-500' : 'bg-slate-900');

  const sizeStyles = {
    sm: {
      track: 'h-5 w-9 p-[2px]',
      thumb: 'h-4 w-4',
      translate: 'translate-x-4',
      dims: { width: '36px', height: '20px', padding: '2px' }
    },
    md: {
      track: 'h-7 w-12 p-1',
      thumb: 'h-5 w-5',
      translate: 'translate-x-5',
      dims: { width: '48px', height: '28px', padding: '4px' }
    },
    lg: {
      track: 'h-8 w-14 p-1',
      thumb: 'h-6 w-6',
      translate: 'translate-x-6',
      dims: { width: '56px', height: '32px', padding: '4px' }
    }
  }[size];

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      style={{
        width: sizeStyles.dims.width,
        minWidth: sizeStyles.dims.width,
        maxWidth: sizeStyles.dims.width,
        height: sizeStyles.dims.height,
        minHeight: sizeStyles.dims.height,
        maxHeight: sizeStyles.dims.height,
        padding: sizeStyles.dims.padding,
        boxSizing: 'border-box',
        flexShrink: 0
      }}
      className={`relative inline-flex items-center shrink-0 cursor-pointer rounded-full border-0 transition-colors duration-200 ease-in-out select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles.track} ${
        checked
          ? resolvedActiveColor
          : isDarkModal
          ? 'bg-slate-700'
          : 'bg-slate-300'
      } ${className}`}
    >
      <span
        className={`pointer-events-none inline-block rounded-full bg-white shadow-md transform transition duration-200 ease-in-out ${sizeStyles.thumb} ${
          checked ? sizeStyles.translate : 'translate-x-0'
        }`}
      />
    </button>
  );
};

export default Switch;
