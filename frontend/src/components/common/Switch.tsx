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
 * Componente Switch estandarizado con animación fluida de activación y desactivación.
 * Aplica curvas bezier naturales inspiradas en física elástica (cubic-bezier)
 * y respuesta táctil inmediata para interfaces móviles y de escritorio.
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
      track: 'h-5 w-9 p-0.5',
      thumb: 'h-4 w-4',
      translate: 'translate-x-4'
    },
    md: {
      track: 'h-6 w-11 p-0.5',
      thumb: 'h-5 w-5',
      translate: 'translate-x-5'
    },
    lg: {
      track: 'h-7 w-12 p-0.5',
      thumb: 'h-6 w-6',
      translate: 'translate-x-5'
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
      className={`relative inline-flex shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles.track} ${
        checked
          ? activeColor
          : 'bg-neutral-200 dark:bg-neutral-700'
      } ${className}`}
    >
      <span
        className={`pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0 transform transition-transform duration-300 ease-[cubic-bezier(0.34,1.25,0.64,1)] will-change-transform ${sizeStyles.thumb} ${
          checked ? sizeStyles.translate : 'translate-x-0'
        }`}
      />
    </button>
  );
};

export default Switch;
