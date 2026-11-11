import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useIsDarkModal } from '../modals/ModalShell';

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
  const isDarkModal = useIsDarkModal();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

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
        aria-expanded={isOpen}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`w-full min-h-[44px] lg:min-h-[38px] flex items-center justify-between rounded-xl py-2.5 lg:py-2 px-3.5 text-sm lg:text-xs font-medium transition-[background-color,border-color,box-shadow] duration-150 disabled:opacity-50 disabled:pointer-events-none text-left font-sans normal-case tracking-normal cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
          isDarkModal
            ? 'bg-slate-950/75 border border-slate-800 text-slate-100 hover:bg-slate-800/70 hover:border-slate-700'
            : 'mobile-dropdown-trigger bg-slate-50 border border-slate-200 text-slate-900 hover:bg-slate-100 hover:border-slate-300'
        }`}
      >
        {hasRealSelection && selectedOption ? (
          <span className="truncate">
            {selectedOption.label}
            {selectedOption.badge && (
              <span
                className={`text-[11px] font-mono tabular-nums font-normal ml-2 ${
                  isDarkModal ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {selectedOption.badge}
              </span>
            )}
          </span>
        ) : (
          <span className={`truncate font-normal ${isDarkModal ? 'text-slate-400' : 'text-slate-400'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 shrink-0 ml-2 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${
            isDarkModal ? 'text-slate-400' : 'text-slate-500'
          } ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && !disabled && (
        <div
          className={`mobile-dropdown-menu custom-scrollbar-dark absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border p-1.5 max-h-60 overflow-y-auto overscroll-contain font-sans normal-case tracking-normal ${
            isDarkModal
              ? 'bg-slate-900 border-slate-700/90 text-slate-200 shadow-[0_20px_40px_-8px_rgba(2,6,23,0.75)]'
              : 'bg-white border-slate-200 text-slate-800 shadow-xl'
          }`}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-slate-400 text-center">
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
                  className={`mobile-dropdown-option w-full min-h-[42px] lg:min-h-[34px] rounded-lg px-3 py-2 text-sm lg:text-xs transition-colors duration-150 flex items-center justify-between cursor-pointer text-left ${
                    isDarkModal
                      ? isSelected
                        ? 'bg-slate-800 font-semibold text-white'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                      : isSelected
                      ? 'bg-slate-100 font-semibold text-slate-900'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="truncate pr-2">
                    <span>{opt.label}</span>
                    {opt.badge && (
                      <span
                        className={`text-[11px] font-mono tabular-nums font-normal ml-2 ${
                          isDarkModal ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check
                      className={`w-4 h-4 shrink-0 ${
                        isDarkModal ? 'text-indigo-400' : 'text-slate-900'
                      }`}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
