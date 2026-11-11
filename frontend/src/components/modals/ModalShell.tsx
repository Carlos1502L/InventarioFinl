import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

const ModalSurfaceContext = createContext<boolean>(false);

/** Indica si el componente actual se renderiza dentro de una ventana flotante Stockly (Dark Industrial Slate). */
export function useIsDarkModal(): boolean {
  return useContext(ModalSurfaceContext);
}

/** Detecta viewports desktop (>= 1024px) sincronizado con el breakpoint `lg` de Tailwind. */
export function useIsDesktopViewport(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isDesktop;
}

export type ModalMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl';

const WIDTH_CLASS_MAP: Record<ModalMaxWidth, string> = {
  sm: 'lg:max-w-md',
  md: 'lg:max-w-lg',
  lg: 'lg:max-w-xl',
  xl: 'lg:max-w-2xl',
  '2xl': 'lg:max-w-3xl',
  '4xl': 'lg:max-w-4xl',
  '5xl': 'lg:max-w-5xl'
};

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: ModalMaxWidth;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  disableDismiss?: boolean;
  formId?: string;
  onSubmitShortcut?: () => void;
  className?: string;
}

const ModalDragContext = createContext<{
  startDrag: (e: React.PointerEvent) => void;
  isDesktop: boolean;
} | null>(null);

/**
 * Primitiva unificada de Ventana Flotante / Bottom Sheet para Stockly.
 * - Desktop (>= 1024px): Diálogo centrado Dark Industrial Slate (`bg-slate-900/95`),
 *   borde sutil multi-capa (`border-slate-800/80`), animaciones spring crisp, atajo Esc / Ctrl+Enter.
 * - Móvil (< 1024px): Bottom sheet nativo deslizable (`y: 100% -> 0`), handle táctil superior,
 *   cierre por arrastre con física de momento y targets táctiles >= 44px.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = 'md',
  ariaLabel,
  ariaLabelledBy,
  disableDismiss = false,
  formId,
  onSubmitShortcut,
  className = ''
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedBackdropRef = useRef(false);
  const [rendered, setRendered] = useState(isOpen);
  const isDesktop = useIsDesktopViewport();
  const shouldReduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const fallbackTitleId = useId();

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
    }
  }, [isOpen]);

  // Sincronizar con Top Layer nativo <dialog>.showModal() antes del paint y re-promover toasts activos
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !rendered) return;

    if (isOpen && !dialog.open) {
      try {
        dialog.showModal();
        window.dispatchEvent(new CustomEvent('stockly-modal-opened'));
      } catch {
        // Fallback silencioso si el nodo fue desmontado en transición rápida
      }
    }
  }, [isOpen, rendered]);

  // Limpiar <dialog> si el componente se desmonta directamente desde un padre condicional
  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) {
        try {
          dialog.close();
        } catch {
          // Ignorar
        }
      }
    };
  }, []);

  // Soporte global de Ctrl/Cmd + Enter para envío en escritorio
  useEffect(() => {
    if (!isOpen || !isDesktop) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (onSubmitShortcut) {
          e.preventDefault();
          onSubmitShortcut();
          return;
        }
        if (formId) {
          const targetForm = document.getElementById(formId) as HTMLFormElement | null;
          if (targetForm) {
            e.preventDefault();
            targetForm.requestSubmit();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDesktop, onSubmitShortcut, formId]);

  const startHeaderDrag = (e: React.PointerEvent) => {
    if (isDesktop || disableDismiss) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, [role="button"]')) {
      return;
    }
    dragControls.start(e);
  };

  if (!rendered && !isOpen) return null;

  const panelInitial = shouldReduceMotion
    ? { opacity: 0 }
    : isDesktop
    ? { opacity: 0, scale: 0.98, y: 10 }
    : { y: '100%', opacity: 1 };

  const panelAnimate = shouldReduceMotion
    ? { opacity: 1 }
    : isDesktop
    ? { opacity: 1, scale: 1, y: 0 }
    : { y: 0, opacity: 1 };

  const panelExit = shouldReduceMotion
    ? { opacity: 0 }
    : isDesktop
    ? { opacity: 0, scale: 0.98 }
    : { y: '100%' };

  const panelTransition = shouldReduceMotion
    ? { duration: 0.14 }
    : isDesktop
    ? { type: 'spring' as const, damping: 30, stiffness: 380 }
    : { type: 'spring' as const, damping: 32, stiffness: 320 };

  return (
    <ModalSurfaceContext.Provider value={true}>
      <ModalDragContext.Provider value={{ startDrag: startHeaderDrag, isDesktop }}>
        <dialog
          ref={dialogRef}
          data-stockly-dialog="true"
          data-stockly-modal="true"
          aria-labelledby={ariaLabelledBy || (ariaLabel ? undefined : fallbackTitleId)}
          aria-label={ariaLabel}
          onCancel={(e) => {
            e.preventDefault();
            if (!disableDismiss) {
              onClose();
            }
          }}
          className="fixed inset-0 m-0 p-0 border-0 bg-transparent text-slate-100 w-screen max-w-none h-[100dvh] max-h-none overflow-hidden focus:outline-none open:block"
        >
          <AnimatePresence
            onExitComplete={() => {
              const dialog = dialogRef.current;
              if (dialog?.open) {
                try {
                  dialog.close();
                } catch {
                  // Ignorar si ya cerró
                }
              }
              setRendered(false);
            }}
          >
            {isOpen && (
              <motion.div
                key="stockly-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                onPointerDown={(e) => {
                  pressedBackdropRef.current = e.target === e.currentTarget;
                }}
                onPointerUp={(e) => {
                  const releasedBackdrop = e.target === e.currentTarget;
                  if (pressedBackdropRef.current && releasedBackdrop && !disableDismiss) {
                    onClose();
                  }
                  pressedBackdropRef.current = false;
                }}
                className="fixed inset-0 w-full h-full flex items-end lg:items-center justify-center p-0 lg:p-6 bg-slate-950/60 backdrop-blur-sm overscroll-contain"
              >
                <motion.div
                  key="stockly-modal-panel"
                  data-stockly-panel="true"
                  initial={panelInitial}
                  animate={panelAnimate}
                  exit={panelExit}
                  transition={panelTransition}
                  drag={!isDesktop && !disableDismiss && !shouldReduceMotion ? 'y' : false}
                  dragControls={dragControls}
                  dragListener={false}
                  dragConstraints={{ top: 0 }}
                  dragElastic={{ top: 0.03, bottom: 0.25 }}
                  onDragEnd={(_, info) => {
                    if (!isDesktop && !disableDismiss && (info.offset.y > 90 || info.velocity.y > 480)) {
                      onClose();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`stockly-modal-panel mobile-dark-modal relative w-full ${WIDTH_CLASS_MAP[maxWidth]} bg-slate-900/95 text-slate-100 border border-slate-800/80 ring-1 ring-inset ring-white/[0.06] rounded-t-3xl lg:rounded-2xl shadow-[0_24px_64px_-12px_rgba(2,6,23,0.78)] flex flex-col max-h-[92dvh] lg:max-h-[88vh] overflow-hidden font-sans origin-center ${className}`}
                >
                  {/* Barra táctil de arrastre superior exclusiva para Bottom Sheets móviles (< 1024px) */}
                  <div
                    onPointerDown={startHeaderDrag}
                    className="lg:hidden w-full pt-3 pb-1 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing shrink-0 select-none bg-slate-900/95"
                    aria-hidden="true"
                  >
                    <span className="w-11 h-1.5 rounded-full bg-slate-500/75 block" />
                  </div>

                  {children}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </dialog>
      </ModalDragContext.Provider>
    </ModalSurfaceContext.Provider>
  );
};

export interface ModalHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconTone?: 'default' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'sky';
  onClose?: () => void;
  closeDisabled?: boolean;
  rightSlot?: React.ReactNode;
  titleId?: string;
  showEscHint?: boolean;
}

const ICON_TONE_CLASSES: Record<NonNullable<ModalHeaderProps['iconTone']>, string> = {
  default: 'bg-slate-800/90 text-slate-200 border-slate-700/80',
  indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  sky: 'bg-sky-500/15 text-sky-300 border-sky-500/30'
};

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  subtitle,
  icon,
  iconTone = 'default',
  onClose,
  closeDisabled = false,
  rightSlot,
  titleId,
  showEscHint = true
}) => {
  const dragCtx = useContext(ModalDragContext);

  return (
    <div
      onPointerDown={dragCtx?.startDrag}
      className="flex items-center justify-between gap-3 px-4 lg:px-6 pt-2 lg:py-4 pb-3.5 border-b border-slate-800/80 bg-slate-900/95 shrink-0 select-none"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon && (
          <div
            className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl border flex items-center justify-center shrink-0 ${ICON_TONE_CLASSES[iconTone]}`}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3
            id={titleId}
            className="text-sm lg:text-base font-semibold tracking-tight text-slate-100 truncate"
          >
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {rightSlot}
        {onClose && (
          <div className="flex items-center gap-1.5">
            {showEscHint && (
              <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/80 font-mono text-[10px] font-medium text-slate-400 select-none">
                Esc
              </kbd>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              aria-label="Cerrar ventana"
              className="min-h-[44px] min-w-[44px] lg:min-h-[34px] lg:min-w-[34px] lg:w-8 lg:h-8 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export interface ModalTabsBarProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalTabsBar: React.FC<ModalTabsBarProps> = ({ children, className = '' }) => (
  <div
    className={`mobile-tabs-bar flex items-center gap-2 px-4 lg:px-6 py-2.5 border-b border-slate-800/80 bg-slate-950/35 shrink-0 overflow-x-auto no-scrollbar ${className}`}
  >
    {children}
  </div>
);

export interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalBody: React.FC<ModalBodyProps> = ({ children, className = '' }) => (
  <div
    className={`flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar-dark px-4 lg:px-6 pt-3 lg:py-5 pb-6 ${className}`}
  >
    {children}
  </div>
);

export interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
  shortcutLabel?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
  children,
  className = '',
  shortcutLabel
}) => (
  <div
    className={`px-4 lg:px-6 py-3.5 lg:py-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-4 border-t border-slate-800/80 bg-slate-950/55 shrink-0 ${className}`}
  >
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
      {shortcutLabel ? (
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400">
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700/80 font-mono text-[10px] text-slate-300">
            Ctrl+Enter
          </kbd>
          <span>{shortcutLabel}</span>
        </div>
      ) : (
        <span className="hidden sm:block" />
      )}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
        {children}
      </div>
    </div>
  </div>
);

/** Clases estandarizadas Dark Industrial Slate reutilizables en todos los formularios modales */
export const modalFieldInputClass =
  'w-full min-h-[44px] bg-slate-950/75 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-400/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-400 transition-[border-color,background-color,box-shadow] duration-150 box-border';

export const modalFieldCompactInputClass =
  'w-full min-h-[44px] lg:min-h-[38px] bg-slate-950/75 border border-slate-800 rounded-xl px-3 py-2 text-sm lg:text-xs text-slate-100 placeholder:text-slate-400/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-400 transition-[border-color,background-color,box-shadow] duration-150 box-border';

export const modalFieldLabelClass =
  'block text-xs font-medium text-slate-300 mb-1.5 leading-snug';

export const modalSurfaceCardClass =
  'bg-slate-950/45 border border-slate-800/80 rounded-2xl p-4';

export const modalPrimaryButtonClass =
  'min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold rounded-xl shadow-sm transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50';

export const modalSecondaryButtonClass =
  'min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-medium rounded-xl transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50';

export const modalDangerButtonClass =
  'min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:opacity-45 disabled:hover:bg-rose-600 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50';
