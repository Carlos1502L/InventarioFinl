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
 * Garantiza centrado vertical perfecto del círculo interno (misma distancia arriba y abajo)
 * y transición suave sin desbordamiento (overshoot) fuera del recuadro.
 */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  id,
  disabled = false,
  ariaLabel,
  className = '',
  size = 'md',
  activeColor = 'bg-[#1E3A5F] max-md:bg-neutral-950'
}) => {
  const sizeStyles = {
    sm: {
      track: 'h-5 w-9 p-[2px]',
      thumb: 'h-4 w-4',
      translate: 'translate-x-4'
    },
    md: {
      track: 'h-6 w-11 p-[2px]',
      thumb: 'h-5 w-5',
      translate: 'translate-x-5'
    },
    lg: {
      track: 'h-7 w-14 p-[2px]',
      thumb: 'h-6 w-6',
      translate: 'translate-x-7'
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
      className={`relative inline-flex items-center shrink-0 cursor-pointer rounded-full border-0 p-[2px] transition-colors duration-250 ease-out select-none outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles.track} ${
        checked
          ? activeColor
          : 'bg-neutral-300 dark:bg-neutral-700'
      } ${className}`}
    >
      <span
        className={`pointer-events-none block rounded-full bg-white shadow-sm ring-0 transform transition-transform duration-250 ease-out will-change-transform ${sizeStyles.thumb} ${
          checked ? sizeStyles.translate : 'translate-x-0'
        }`}
      />
    </button>
  );
};

export default Switch;
