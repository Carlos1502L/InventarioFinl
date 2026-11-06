import { useState, useEffect } from 'react';

/**
 * RNF-UI-LAYOUT-002 / RN-PERF-02: Hooks reactivos para detección de viewport y dispositivo.
 * Evalúan el estado de forma síncrona en memoria antes del primer render y asumen vista móvil
 * por defecto en entornos ambiguos o PWA para evitar destellos de interfaz desktop (FOUL / CLS).
 */
export function useIsDesktop(minWidth = 768): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= minWidth && window.matchMedia(`(min-width: ${minWidth}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(`(min-width: ${minWidth}px)`);
    const updateMatch = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop(e.matches);
    };

    // Sincronización inmediata
    setIsDesktop(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMatch);
      return () => mediaQuery.removeEventListener('change', updateMatch);
    } else {
      mediaQuery.addListener(updateMatch);
      return () => mediaQuery.removeListener(updateMatch);
    }
  }, [minWidth]);

  return isDesktop;
}

export function useIsMobile(maxWidth = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth < maxWidth;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(`(max-width: ${maxWidth - 1}px)`);
    const updateMatch = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMatch);
      return () => mediaQuery.removeEventListener('change', updateMatch);
    } else {
      mediaQuery.addListener(updateMatch);
      return () => mediaQuery.removeListener(updateMatch);
    }
  }, [maxWidth]);

  return isMobile;
}
