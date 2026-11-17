import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/** Pila LIFO global para que la tecla Esc cierre únicamente el modal superior activo */
const activeModalStack: symbol[] = [];

/**
 * Maneja cierre seguro con tecla Escape respetando modales apilados
 * y menús desplegables abiertos dentro del modal.
 */
export function useModalEscape(
  isOpen: boolean,
  onClose: () => void,
  disabled = false
): void {
  const tokenRef = useRef<symbol | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const token = Symbol('stockly-modal');
    tokenRef.current = token;
    activeModalStack.push(token);

    return () => {
      const idx = activeModalStack.lastIndexOf(token);
      if (idx !== -1) {
        activeModalStack.splice(idx, 1);
      }
      if (tokenRef.current === token) {
        tokenRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const topToken = activeModalStack[activeModalStack.length - 1];
      if (topToken !== tokenRef.current) return;

      // Si hay un dropdown personalizado abierto, permitir que cierre primero el dropdown
      if (document.querySelector('[data-dropdown-open="true"]')) return;

      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, disabled]);
}

/**
 * Protege el backdrop frente a cierres accidentales al arrastrar texto desde dentro hacia afuera.
 */
export function useBackdropDismiss(onClose: () => void, enabled = true) {
  const pressedOnBackdropRef = useRef(false);

  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      pressedOnBackdropRef.current = enabled && e.target === e.currentTarget;
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const releasedOnBackdrop = e.target === e.currentTarget;
      const shouldClose = pressedOnBackdropRef.current && releasedOnBackdrop && enabled;
      pressedOnBackdropRef.current = false;
      if (shouldClose) {
        onClose();
      }
    }
  };
}

/**
 * Conserva la última referencia válida durante la animación de salida (<AnimatePresence>).
 */
export function useLatestValue<T>(value: T | null): T | null {
  const ref = useRef<T | null>(value);
  if (value !== null) {
    ref.current = value;
  }
  return value ?? ref.current;
}

/**
 * Detecta viewport escritorio (< 1024px vs >= 1024px) de forma reactiva.
 */
function useIsWideScreen(): boolean {
  const [isWide, setIsWide] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isWide;
}

/**
 * Presets de animación Framer Motion GPU-only (transform + opacity) sin alterar estilos ni diseño.
 */
export function useModalMotion() {
  const shouldReduceMotion = useReducedMotion();
  const isWide = useIsWideScreen();

  return useMemo(() => {
    const backdropMotion = {
      initial: { opacity: 0 },
      animate: {
        opacity: 1,
        transition: { duration: shouldReduceMotion ? 0.08 : 0.18, ease: [0.22, 1, 0.36, 1] as const }
      },
      exit: {
        opacity: 0,
        transition: { duration: shouldReduceMotion ? 0.08 : 0.13, ease: [0.4, 0, 1, 1] as const }
      }
    };

    const panelMotion = {
      initial: shouldReduceMotion
        ? { opacity: 0 }
        : isWide
          ? { opacity: 0, scale: 0.985, y: 4 }
          : { opacity: 0, scale: 0.985, y: 6 },
      animate: shouldReduceMotion
        ? { opacity: 1, transition: { duration: 0.1 } }
        : {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }
          },
      exit: shouldReduceMotion
        ? { opacity: 0, transition: { duration: 0.08 } }
        : {
            opacity: 0,
            scale: 0.99,
            y: 3,
            transition: { duration: 0.12, ease: [0.4, 0, 1, 1] as const }
          }
    };

    const sheetMotion = {
      initial: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 },
      animate: shouldReduceMotion
        ? { opacity: 1, transition: { duration: 0.1 } }
        : {
            opacity: 1,
            y: 0,
            transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }
          },
      exit: shouldReduceMotion
        ? { opacity: 0, transition: { duration: 0.08 } }
        : {
            opacity: 0,
            y: 10,
            transition: { duration: 0.13, ease: [0.4, 0, 1, 1] as const }
          }
    };

    const tabContentMotion = {
      initial: { opacity: 0 },
      animate: {
        opacity: 1,
        transition: { duration: shouldReduceMotion ? 0.06 : 0.15, ease: [0.22, 1, 0.36, 1] as const }
      },
      exit: {
        opacity: 0,
        transition: { duration: shouldReduceMotion ? 0.05 : 0.09, ease: [0.4, 0, 1, 1] as const }
      }
    };

    return {
      shouldReduceMotion,
      backdropMotion,
      panelMotion,
      sheetMotion,
      tabContentMotion
    };
  }, [shouldReduceMotion, isWide]);
}
