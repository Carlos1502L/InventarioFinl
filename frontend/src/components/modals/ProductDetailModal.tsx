import React from 'react';
import { Product, Location } from '../../types/database';
import { ProductMasterModal } from './ProductMasterModal';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onMove: (product: Product) => void;
  onAssignLocation?: (product: Product) => void;
  onWithdraw: (product: Product) => void;
  locations: Location[];
  allProducts?: Product[];
  onSelectProduct?: (product: Product) => void;
  onUpdated?: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onAssignLocation,
  onWithdraw,
  locations,
  allProducts = [],
  onSelectProduct,
  onUpdated
}) => (
  <ProductMasterModal
    isOpen={isOpen}
    onClose={onClose}
    product={product}
    initialView="DETAIL"
    locations={locations}
    products={allProducts}
    onSelectProduct={onSelectProduct}
    onAssignLocation={onAssignLocation}
    onWithdraw={onWithdraw}
    onUpdated={onUpdated}
    onSaved={() => onUpdated?.()}
    onRestocked={onUpdated}
    onMoved={onUpdated}
  />
);
