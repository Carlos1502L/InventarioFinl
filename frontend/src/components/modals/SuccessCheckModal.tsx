import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm select-none"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            className="flex flex-col items-center justify-center gap-3.5"
          >
            {/* Contenedor circular negro sólido con sombra profunda */}
            <div className="w-20 h-20 rounded-full bg-neutral-950 flex items-center justify-center shadow-2xl">
              <svg
                className="w-9 h-9 text-white"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <motion.path
                  d="M5 13l4 4L19 7"
                  stroke="#FFFFFF"
                  strokeWidth={2.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.35, delay: 0.12, ease: 'easeOut' }}
                />
              </svg>
            </div>

            {/* Texto debajo del círculo en tipografía sans-serif limpia */}
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, delay: 0.15 }}
              className="font-sans text-sm font-semibold text-white tracking-wide px-3.5 py-1 rounded-full bg-neutral-950/85 shadow-lg"
            >
              {label}
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
