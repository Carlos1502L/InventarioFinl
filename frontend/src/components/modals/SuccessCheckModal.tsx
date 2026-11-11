import React, { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

interface SuccessCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  label?: string;
}

export const SuccessCheckModal: React.FC<SuccessCheckModalProps> = ({
  isOpen,
  onClose,
  label = 'Cobro exitoso'
}) => {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, 1500);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="success-check-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.08 : 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm select-none"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.1 }
                : { type: 'spring', stiffness: 360, damping: 24 }
            }
            className="flex flex-col items-center justify-center gap-3.5"
          >
            <div className="w-20 h-20 rounded-full bg-slate-900 border border-emerald-500/40 ring-4 ring-emerald-500/15 flex items-center justify-center shadow-2xl">
              <svg
                className="w-9 h-9 text-emerald-400"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <motion.path
                  d="M5 13l4 4L19 7"
                  stroke="#34d399"
                  strokeWidth={2.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.3, delay: 0.08, ease: 'easeOut' }}
                />
              </svg>
            </div>

            <motion.span
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.12 }}
              className="font-sans text-sm font-semibold text-slate-100 tracking-wide px-4 py-1.5 rounded-full bg-slate-900/95 border border-slate-700/80 shadow-xl"
            >
              {label}
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
