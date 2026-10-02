export type InventoryRole = 'owner' | 'collaborator';
export type ProductStatus = 'ACTIVE' | 'WITHDRAWN' | 'ARCHIVED';
export type ActionType = 'CREATE' | 'UPDATE' | 'MOVE' | 'WITHDRAW' | 'RESTOCK' | 'DELETE';

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
  price: number;
  stock: number;
  min_stock: number;
  category_id: string | null;
  subcategory_id: string | null;
  location_id: string;
  images: string[]; // Máximo 3 URLs
  status: ProductStatus;
  withdrawal_reason?: string | null;
  last_modified_by: string | null;
  last_modified_by_email: string | null;
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
