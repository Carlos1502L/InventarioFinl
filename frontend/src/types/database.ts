export type InventoryRole = 'owner' | 'collaborator';
export type InventoryType = 'PERSONAL' | 'BUSINESS';
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'WITHDRAWN' | 'ARCHIVED';
export type ActionType = 'CREATE' | 'UPDATE' | 'MOVE' | 'WITHDRAW' | 'RESTOCK' | 'DELETE' | 'SALE';
export type PaymentMethod = 'CASH' | 'YAPE' | 'PLIN' | 'CARD' | 'TRANSFER' | 'OTHER';
export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type CouponStatus = 'ACTIVE' | 'INACTIVE';

export interface Coupon {
  id: string;
  inventory_id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  status: CouponStatus;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  owner_id: string;
  inventory_type?: InventoryType; // RF-01.1 vs RF-01.2
  yape_phone?: string | null; // RF-06.3
  yape_qr_url?: string | null;
  plin_phone?: string | null;
  plin_qr_url?: string | null;
  payment_instructions?: string | null;
  created_at: string;
  updated_at: string;
  role?: InventoryRole; // Rol del usuario actual en este inventario
  is_owner?: boolean;
}

export interface InventoryUser {
  id: string;
  inventory_id: string;
  user_id: string;
  role: InventoryRole;
  created_at: string;
  profiles?: Profile;
}

export interface InventoryInvitation {
  id: string;
  inventory_id: string;
  email: string;
  role: InventoryRole;
  status: 'pending' | 'accepted' | 'rejected';
  invited_by: string;
  created_at: string;
  inventories?: Inventory;
}

export interface Category {
  id: string;
  inventory_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: string;
  inventory_id: string;
  category_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  inventory_id: string;
  name: string;
  code: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  product_count?: number;
}

export interface Product {
  id: string;
  inventory_id: string;
  name: string;
  code: string;
  description: string | null;
  price: number; // Precio de Venta Final o Precio Base Personal
  cost_price?: number; // RF-01.2: Precio de Costo
  markup_percentage?: number; // RF-01.2: Porcentaje de Ganancia
  stock: number;
  min_stock: number; // RF-04.1: Configurable desde 1
  category_id: string | null;
  subcategory_id: string | null;
  location_id: string;
  images: string[]; // Máximo 3 URLs
  status: ProductStatus;
  withdrawal_reason?: string | null;
  last_modified_by: string | null;
  last_modified_by_email: string | null;
  // RF-03.1: Variantes de productos
  parent_id?: string | null;
  is_variant?: boolean;
  variant_attributes?: Record<string, string>; // Ej: { "Color": "Rojo", "Región": "USA" }
  variants?: Product[];
  created_at: string;
  updated_at: string;
  categories?: {
    id: string;
    name: string;
    color: string;
  } | null;
  subcategories?: {
    id: string;
    name: string;
  } | null;
  locations?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface AuditLog {
  id: string;
  inventory_id: string;
  product_id: string | null;
  product_name: string | null;
  user_id: string | null;
  user_email: string;
  action_type: ActionType;
  details: string;
  metadata: Record<string, any>;
  created_at: string;
}

// RF-06: Módulo de Ventas
export interface Sale {
  id: string;
  inventory_id: string;
  seller_id: string | null;
  seller_email: string;
  total_amount: number;
  payment_method: PaymentMethod;
  customer_name?: string | null;
  customer_contact?: string | null;
  notes?: string | null;
  created_at: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  cost_price?: number;
  subtotal: number;
  created_at: string;
}
