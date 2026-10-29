import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface MinimalDropdownOption {
  value: string;
  label: string;
  badge?: string;
}

interface MinimalDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: MinimalDropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const MinimalDropdown: React.FC<MinimalDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar opción...',
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);
  const hasRealSelection = Boolean(selectedOption && selectedOption.value !== '');

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className="mobile-dropdown-trigger w-full flex items-center justify-between bg-neutral-50 border border-neutral-200/60 rounded-2xl py-3 px-4 text-sm text-neutral-800 font-medium hover:bg-neutral-100/60 transition-colors disabled:opacity-50 disabled:pointer-events-none text-left font-sans normal-case tracking-normal"
      >
        {hasRealSelection && selectedOption ? (
          <span className="truncate">
            {selectedOption.label}
            {selectedOption.badge && (
              <span className="text-xs text-neutral-400 font-normal ml-2">
                {selectedOption.badge}
              </span>
            )}
          </span>
        ) : (
          <span className="truncate text-neutral-400 font-normal">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-neutral-400 shrink-0 ml-2 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="mobile-dropdown-menu absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-2xl border border-neutral-200/80 shadow-xl p-1.5 overflow-hidden max-h-60 overflow-y-auto overscroll-contain font-sans normal-case tracking-normal">
          {options.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-neutral-400 text-center">
              Sin opciones disponibles
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value || '__empty__'}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`mobile-dropdown-option w-full rounded-xl px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 transition-colors flex items-center justify-between cursor-pointer text-left ${
                    isSelected ? 'bg-neutral-100/80 font-semibold text-neutral-950' : ''
                  }`}
                >
                  <div className="truncate pr-2">
                    <span>{opt.label}</span>
                    {opt.badge && (
                      <span className="text-xs text-neutral-400 font-normal ml-2">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-neutral-950 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
