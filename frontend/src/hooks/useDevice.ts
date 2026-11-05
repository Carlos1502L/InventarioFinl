import { useState, useEffect } from 'react';

/**
 * RN-PERF-02: Hook reactivo para detección de viewport/dispositivo.
 * Permite renderizado condicional real (montaje/desmontaje en DOM) evitando
 * el uso de clases CSS ocultas (display: none / hidden) para componentes pesados de escritorio.
 */
export function useIsDesktop(minWidth = 768): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(min-width: ${minWidth}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(`(min-width: ${minWidth}px)`);
    const updateMatch = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop(e.matches);
    };

    // Sincronización inicial
    setIsDesktop(mediaQuery.matches);

    // Listener reactivo eficiente
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMatch);
      return () => mediaQuery.removeEventListener('change', updateMatch);
    } else {
      // Fallback para navegadores antiguos
      mediaQuery.addListener(updateMatch);
      return () => mediaQuery.removeListener(updateMatch);
    }
  }, [minWidth]);

  return isDesktop;
}
