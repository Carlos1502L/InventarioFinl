import React from 'react';
import { Product, Location } from '../../types/database';
import { ProductMasterModal } from './ProductMasterModal';

interface MoveProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onMoved: () => void;
  locations: Location[];
}

export const MoveProductModal: React.FC<MoveProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onMoved,
  locations
}) => (
  <ProductMasterModal
    isOpen={isOpen}
    onClose={onClose}
    product={product}
    initialView="MOVE"
    locations={locations}
    onMoved={onMoved}
  />
);
