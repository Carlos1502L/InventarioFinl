import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, WifiOff, AlertTriangle } from 'lucide-react';

export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
}

/**
 * Dispara una notificación toast flotante minimalista en cualquier parte de la app.
 */
export function showAppToast(
  message: string,
  type: 'success' | 'info' | 'warning' | 'error' = 'info',
  duration = 4000
) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: {
          id: `${Date.now()}-${Math.random()}`,
          message,
          type,
          duration
        }
      })
    );
  }
}

/**
 * Contenedor visual discreto de Toasts (Zero-Disruption, overlay superior flotante).
 */
export const ToastNotification: React.FC = () => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastData>;
      if (!customEvent.detail) return;

      const newToast = customEvent.detail;
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration || 4000);
    };

    window.addEventListener('app-toast', handleToastEvent);
    return () => window.removeEventListener('app-toast', handleToastEvent);
  }, []);

  // Promover notificaciones al Top Layer para que sigan visibles encima de <dialog>.showModal()
  useEffect(() => {
    const el = popoverRef.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!el || typeof el.showPopover !== 'function') return;

    const promote = () => {
      try {
        if (el.matches(':popover-open')) {
          el.hidePopover?.();
        }
        if (toasts.length > 0) {
          el.showPopover?.();
        }
      } catch {
        // Ignorar si no está montado en el documento
      }
    };

    if (toasts.length > 0) {
      promote();
      window.addEventListener('stockly-modal-opened', promote);
      return () => window.removeEventListener('stockly-modal-opened', promote);
    } else if (el.matches(':popover-open')) {
      try {
        el.hidePopover?.();
      } catch {
        // Ignorar
      }
    }
  }, [toasts.length]);

  return (
    <div
      ref={popoverRef}
      {...({ popover: 'manual' } as Record<string, string>)}
      className="fixed top-4 left-1/2 -translate-x-1/2 m-0 p-0 border-0 bg-transparent overflow-visible z-[9999] pointer-events-none flex flex-col items-center gap-2 max-w-[92vw] w-max select-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="pointer-events-auto bg-slate-900/95 text-slate-100 backdrop-blur-md px-4 py-2.5 rounded-full text-xs font-medium shadow-2xl border border-slate-700/80 flex items-center gap-2.5"
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'info' && <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span className="leading-tight">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
