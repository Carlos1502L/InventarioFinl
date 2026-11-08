import React from 'react';

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
 * Garantiza centrado vertical perfecto del círculo interno y dimensiones bloqueadas
 * inmutables para evitar desbordamientos o estiramientos no deseados.
 */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  id,
  disabled = false,
  ariaLabel,
  className = '',
  size = 'md',
  activeColor = 'bg-black'
}) => {
  const sizeStyles = {
    sm: {
      track: 'h-5 w-9 p-[2px]',
      thumb: 'h-4 w-4',
      translate: 'translate-x-4',
      dims: { width: '36px', height: '20px' }
    },
    md: {
      track: 'h-7 w-12',
      thumb: 'h-5 w-5',
      translate: 'translate-x-5',
      dims: { width: '48px', height: '28px' }
    },
    lg: {
      track: 'h-7 w-14 p-[2px]',
      thumb: 'h-6 w-6',
      translate: 'translate-x-7',
      dims: { width: '56px', height: '28px' }
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
        flexShrink: 0
      }}
      className={`relative inline-flex items-center shrink-0 cursor-pointer rounded-full border-0 transition-colors duration-200 ease-in-out select-none outline-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles.track} ${
        checked
          ? activeColor
          : 'bg-gray-300 dark:bg-neutral-700'
      } ${className}`}
    >
      <span
        className={`pointer-events-none inline-block rounded-full bg-white shadow-md transform transition duration-200 ease-in-out mt-1 ml-1 ${sizeStyles.thumb} ${
          checked ? sizeStyles.translate : 'translate-x-0'
        }`}
      />
    </button>
  );
};

export default Switch;
