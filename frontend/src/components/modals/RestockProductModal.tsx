import React from 'react';
import { Product } from '../../types/database';
import { ProductMasterModal } from './ProductMasterModal';

interface RestockProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onRestocked: () => void;
  onViewDetails?: (product: Product) => void;
  onUseCodeAnyway?: (code: string) => void;
}

export const RestockProductModal: React.FC<RestockProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onRestocked,
  onViewDetails,
  onUseCodeAnyway
}) => (
  <ProductMasterModal
    isOpen={isOpen}
    onClose={onClose}
    product={product}
    initialView="RESTOCK"
    onRestocked={onRestocked}
    onSelectProduct={onViewDetails}
    onUseCodeAnyway={onUseCodeAnyway}
  />
);
