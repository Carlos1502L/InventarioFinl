import React, { Suspense, useEffect, useState } from 'react';

interface LazyModalSlotProps {
  open: boolean;
  children: React.ReactNode;
}

/**
 * Mantiene montado un modal React.lazy una vez abierto por primera vez para evitar
 * desmontajes bruscos al cerrar y re-suspensiones durante transiciones sucesivas.
 */
export const LazyModalSlot: React.FC<LazyModalSlotProps> = ({ open, children }) => {
  const [hasMounted, setHasMounted] = useState(open);

  useEffect(() => {
    if (open && !hasMounted) {
      setHasMounted(true);
    }
  }, [open, hasMounted]);

  if (!hasMounted && !open) {
    return null;
  }

  return <Suspense fallback={null}>{children}</Suspense>;
};
