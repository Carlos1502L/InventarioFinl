import React from 'react';
import { Product, Category, Subcategory, Location } from '../../types/database';
import { ProductMasterModal } from './ProductMasterModal';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (savedProduct?: Product) => void;
  productToEdit?: Product | null;
  categories: Category[];
  subcategories: Subcategory[];
  locations: Location[];
  products?: Product[];
  onRedirectToStock?: (product: Product) => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  productToEdit = null,
  categories,
  subcategories,
  locations,
  products = [],
  onRedirectToStock
}) => (
  <ProductMasterModal
    isOpen={isOpen}
    onClose={onClose}
    product={productToEdit}
    initialView="EDIT"
    categories={categories}
    subcategories={subcategories}
    locations={locations}
    products={products}
    onSaved={onSaved}
    onRedirectToStock={onRedirectToStock}
  />
);
