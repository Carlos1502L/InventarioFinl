-- ==============================================================================
-- PLATAFORMA DE GESTIÓN DE INVENTARIOS COLABORATIVA (PWA)
-- ESQUEMA COMPLETO Y ACTUALIZADO PARA SUPABASE (PRODUCCIÓN V2)
-- Incluye: Auth Profiles, Inventarios (Personal/Negocio), Pasarelas Yape/Plin,
--          Categorías/Subcategorías, Ubicaciones Físicas y Product Locations,
--          Productos (UNIT y BOX con unidades_por_caja, stock numérico fraccionable),
--          Ventas, Sale Items, Cupones, Auditoría, Storage Bucket y RLS Idempotente
-- ==============================================================================

-- 1. Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLA: profiles (Perfiles vinculados a auth.users de Supabase)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. TABLA: inventories (Espacios de trabajo Multi-Tenancy)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    currency VARCHAR(10) NOT NULL DEFAULT 'PEN',
    inventory_type VARCHAR(20) NOT NULL DEFAULT 'BUSINESS' CHECK (inventory_type IN ('PERSONAL', 'BUSINESS')),
    yape_phone TEXT,
    yape_qr_url TEXT,
    plin_phone TEXT,
    plin_qr_url TEXT,
    payment_instructions TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. TABLA: inventory_users (Miembros y Colaboradores)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inventory_id, user_id)
);

-- Relación explícita con profiles para consultas PostgREST con profiles(*)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_inventory_users_profiles'
    ) THEN
        ALTER TABLE public.inventory_users 
            ADD CONSTRAINT fk_inventory_users_profiles 
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ==============================================================================
-- 5. TABLA: inventory_invitations (Invitaciones por Correo)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator')),
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inventory_id, email)
);

-- ==============================================================================
-- 6. TABLA: categories (Categorías Dinámicas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color VARCHAR(30) NOT NULL DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 7. TABLA: subcategories (Subcategorías Dinámicas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 8. TABLA: locations (Ubicaciones Físicas / Estantes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inventory_id, code)
);

-- ==============================================================================
-- 9. TABLA: products (Catálogo de Productos - Unidades y Cajas Fraccionables)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    markup_percentage NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    unit_type VARCHAR(10) NOT NULL DEFAULT 'UNIT' CHECK (unit_type IN ('UNIT', 'BOX')),
    units_per_box INTEGER NULL,
    stock NUMERIC(12, 4) NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 1,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
    location_id UUID NULL REFERENCES public.locations(id) ON DELETE SET NULL,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    parent_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    is_variant BOOLEAN NOT NULL DEFAULT FALSE,
    variant_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'WITHDRAWN', 'ARCHIVED')),
    withdrawal_reason TEXT,
    last_modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    last_modified_by_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inventory_id, code)
);

-- ==============================================================================
-- 10. TABLA: product_locations (Distribución Física de Stock por Estante)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.product_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, location_id)
);

-- ==============================================================================
-- 11. TABLA: sales (Cabecera de Ventas / Terminal POS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    seller_email TEXT NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'YAPE', 'PLIN', 'CARD', 'TRANSFER', 'OTHER')),
    customer_name TEXT,
    customer_contact TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 12. TABLA: sale_items (Detalle de Productos Vendidos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    product_code TEXT NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL,
    cost_price NUMERIC(12, 2) DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 13. TABLA: coupons (Cupones de Descuento en Ventas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE' CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
    discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_value >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inventory_id, code)
);

-- ==============================================================================
-- 14. TABLA: audit_logs (Trazabilidad y Auditoría)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'MOVE', 'ASSIGN', 'WITHDRAW', 'RESTOCK', 'DELETE', 'SALE')),
    details TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 15. ÍNDICES DE RENDIMIENTO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_inventory_users_user ON public.inventory_users(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_users_inv ON public.inventory_users(inventory_id);
CREATE INDEX IF NOT EXISTS idx_products_inventory ON public.products(inventory_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_products_location ON public.products(location_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_parent ON public.products(parent_id);
CREATE INDEX IF NOT EXISTS idx_prod_locs_prod ON public.product_locations(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_locs_loc ON public.product_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_prod_locs_inv ON public.product_locations(inventory_id);
CREATE INDEX IF NOT EXISTS idx_locations_inventory ON public.locations(inventory_id);
CREATE INDEX IF NOT EXISTS idx_sales_inventory ON public.sales(inventory_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_coupons_inv ON public.coupons(inventory_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_product ON public.audit_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_inventory ON public.audit_logs(inventory_id);

-- ==============================================================================
-- 16. PRIVILEGIOS DE ACCESO SQL (CRÍTICO: SOLUCIONA ERROR 42501 PERMISSION DENIED)
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- ==============================================================================
-- 17. FUNCIONES DE SEGURIDAD PARA RLS (SECURITY DEFINER = CERO RECURSIÓN)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.has_inventory_access(p_inv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (
    EXISTS (SELECT 1 FROM public.inventories WHERE id = p_inv_id AND owner_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.inventory_users WHERE inventory_id = p_inv_id AND user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_inventory_owner(p_inv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inventories WHERE id = p_inv_id AND owner_id = auth.uid()
  );
$$;

-- ==============================================================================
-- 18. HABILITACIÓN DE ROW LEVEL SECURITY (RLS) & POLÍTICAS
-- ==============================================================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 18.1 profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- 18.2 inventories
CREATE POLICY "inventories_select" ON public.inventories FOR SELECT TO authenticated
    USING (owner_id = auth.uid() OR public.has_inventory_access(id));
CREATE POLICY "inventories_insert" ON public.inventories FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());
CREATE POLICY "inventories_update" ON public.inventories FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR public.has_inventory_access(id));
CREATE POLICY "inventories_delete" ON public.inventories FOR DELETE TO authenticated
    USING (owner_id = auth.uid());

-- 18.3 inventory_users
CREATE POLICY "inv_users_select" ON public.inventory_users FOR SELECT TO authenticated
    USING (public.has_inventory_access(inventory_id));
CREATE POLICY "inv_users_insert" ON public.inventory_users FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_inventory_owner(inventory_id));
CREATE POLICY "inv_users_delete" ON public.inventory_users FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR public.is_inventory_owner(inventory_id));

-- 18.4 inventory_invitations
CREATE POLICY "invitations_select" ON public.inventory_invitations FOR SELECT TO authenticated
    USING (public.is_inventory_owner(inventory_id) OR LOWER(email) = LOWER(auth.jwt()->>'email'));
CREATE POLICY "invitations_insert" ON public.inventory_invitations FOR INSERT TO authenticated
    WITH CHECK (public.is_inventory_owner(inventory_id));
CREATE POLICY "invitations_update" ON public.inventory_invitations FOR UPDATE TO authenticated
    USING (public.is_inventory_owner(inventory_id) OR LOWER(email) = LOWER(auth.jwt()->>'email'));
CREATE POLICY "invitations_delete" ON public.inventory_invitations FOR DELETE TO authenticated
    USING (public.is_inventory_owner(inventory_id));

-- 18.5 categories
CREATE POLICY "categories_all" ON public.categories FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- 18.6 subcategories
CREATE POLICY "subcategories_all" ON public.subcategories FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- 18.7 locations
CREATE POLICY "locations_all" ON public.locations FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- 18.8 products
CREATE POLICY "products_all" ON public.products FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- 18.9 product_locations
CREATE POLICY "product_locations_all" ON public.product_locations FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- 18.10 sales
CREATE POLICY "sales_all" ON public.sales FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- 18.11 sale_items
CREATE POLICY "sale_items_all" ON public.sale_items FOR ALL TO authenticated
    USING (sale_id IN (SELECT id FROM public.sales WHERE public.has_inventory_access(inventory_id)))
    WITH CHECK (sale_id IN (SELECT id FROM public.sales WHERE public.has_inventory_access(inventory_id)));

-- 18.12 coupons
CREATE POLICY "coupons_all" ON public.coupons FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- 18.13 audit_logs
CREATE POLICY "audit_logs_all" ON public.audit_logs FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- ==============================================================================
-- 19. FUNCIONES RPC DE NEGOCIO (RPC DE TRANSACCIONES Y SEGURIDAD)
-- ==============================================================================

-- 19.1 Inicialización de Inventario al registrarse
CREATE OR REPLACE FUNCTION public.initialize_user_inventory()
RETURNS UUID AS $$
DECLARE
    v_uid UUID;
    v_email TEXT;
    v_name TEXT;
    new_inv_id UUID;
    cat_gen_id UUID;
    cat_herr_id UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
    INTO v_email, v_name
    FROM auth.users
    WHERE id = v_uid;

    INSERT INTO public.profiles (id, email, full_name)
    VALUES (v_uid, v_email, v_name)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

    SELECT id INTO new_inv_id FROM public.inventories WHERE owner_id = v_uid LIMIT 1;
    IF new_inv_id IS NOT NULL THEN
        RETURN new_inv_id;
    END IF;

    SELECT inventory_id INTO new_inv_id FROM public.inventory_users WHERE user_id = v_uid LIMIT 1;
    IF new_inv_id IS NOT NULL THEN
        RETURN new_inv_id;
    END IF;

    INSERT INTO public.inventories (name, description, currency, inventory_type, owner_id)
    VALUES ('Mi Inventario Principal', 'Inventario personal creado automáticamente', 'PEN', 'BUSINESS', v_uid)
    RETURNING id INTO new_inv_id;

    INSERT INTO public.inventory_users (inventory_id, user_id, role)
    VALUES (new_inv_id, v_uid, 'owner')
    ON CONFLICT (inventory_id, user_id) DO NOTHING;

    INSERT INTO public.locations (inventory_id, name, code, description) VALUES
        (new_inv_id, 'Almacén Central', 'LOC-ALM-001', 'Área física principal de almacenamiento'),
        (new_inv_id, 'Estante A', 'LOC-EST-A01', 'Estantería de fácil acceso');

    INSERT INTO public.categories (inventory_id, name, color, description)
    VALUES (new_inv_id, 'General', '#3B82F6', 'Categoría general de productos')
    RETURNING id INTO cat_gen_id;

    INSERT INTO public.categories (inventory_id, name, color, description)
    VALUES (new_inv_id, 'Herramientas y Equipos', '#10B981', 'Materiales y herramientas')
    RETURNING id INTO cat_herr_id;

    INSERT INTO public.subcategories (inventory_id, category_id, name) VALUES 
        (new_inv_id, cat_gen_id, 'Suministros'),
        (new_inv_id, cat_herr_id, 'Manuales');

    RETURN new_inv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger automático al crearse un usuario en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_inv_id UUID;
    cat_gen_id UUID;
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventories (name, description, currency, inventory_type, owner_id)
    VALUES ('Mi Inventario Principal', 'Inventario generado automáticamente', 'PEN', 'BUSINESS', NEW.id)
    RETURNING id INTO new_inv_id;

    INSERT INTO public.inventory_users (inventory_id, user_id, role)
    VALUES (new_inv_id, NEW.id, 'owner')
    ON CONFLICT (inventory_id, user_id) DO NOTHING;

    INSERT INTO public.locations (inventory_id, name, code, description) VALUES
        (new_inv_id, 'Almacén Central', 'LOC-ALM-001', 'Área física principal de almacenamiento'),
        (new_inv_id, 'Estante A', 'LOC-EST-A01', 'Estantería de fácil acceso');

    INSERT INTO public.categories (inventory_id, name, color, description)
    VALUES (new_inv_id, 'General', '#3B82F6', 'Categoría general')
    RETURNING id INTO cat_gen_id;

    INSERT INTO public.subcategories (inventory_id, category_id, name)
    VALUES (new_inv_id, cat_gen_id, 'Suministros');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 19.2 Transferir Propiedad de Inventario
CREATE OR REPLACE FUNCTION public.transfer_inventory_ownership(
    p_inventory_id UUID,
    p_new_owner_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.inventories 
        WHERE id = p_inventory_id AND owner_id = v_uid
    ) THEN
        RAISE EXCEPTION 'Solo el dueño actual puede transferir la propiedad del inventario';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_new_owner_id) THEN
        RAISE EXCEPTION 'El usuario destino no existe';
    END IF;

    UPDATE public.inventories
    SET owner_id = p_new_owner_id, updated_at = NOW()
    WHERE id = p_inventory_id;

    INSERT INTO public.inventory_users (inventory_id, user_id, role)
    VALUES (p_inventory_id, p_new_owner_id, 'owner')
    ON CONFLICT (inventory_id, user_id) 
    DO UPDATE SET role = 'owner';

    UPDATE public.inventory_users
    SET role = 'collaborator'
    WHERE inventory_id = p_inventory_id AND user_id = v_uid;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 19.3 Eliminar Inventario con Palabra de Seguridad
CREATE OR REPLACE FUNCTION public.delete_inventory(
    p_inventory_id UUID,
    p_confirmation TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    IF p_confirmation <> 'DELETE-INVENTORY' THEN
        RAISE EXCEPTION 'Palabra de seguridad inválida. Debe escribir exactamente: DELETE-INVENTORY';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.inventories 
        WHERE id = p_inventory_id AND owner_id = v_uid
    ) THEN
        RAISE EXCEPTION 'Solo el dueño puede eliminar este inventario';
    END IF;

    DELETE FROM public.inventories WHERE id = p_inventory_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 19.4 Procesar Venta POS con Bloqueo Transaccional (FOR UPDATE)
CREATE OR REPLACE FUNCTION public.process_pos_sale(
    p_inventory_id UUID,
    p_seller_id UUID,
    p_seller_email TEXT,
    p_total_amount NUMERIC(12, 2),
    p_payment_method VARCHAR(30),
    p_customer_name TEXT,
    p_customer_contact TEXT,
    p_notes TEXT,
    p_items JSONB,
    p_coupon_code TEXT DEFAULT NULL,
    p_discount_amount NUMERIC(12, 2) DEFAULT 0.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_current_stock NUMERIC(12, 4);
    v_product_name TEXT;
    v_sale_id UUID;
    v_loc RECORD;
    v_remaining_deduct NUMERIC(12, 4);
BEGIN
    IF NOT public.has_inventory_access(p_inventory_id) THEN
        RAISE EXCEPTION 'No tienes permiso para operar en este inventario.';
    END IF;

    -- 1. BLOQUEO TRANSACCIONAL DE CADA PRODUCTO (FOR UPDATE)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (
        product_id UUID,
        product_name TEXT,
        product_code TEXT,
        quantity NUMERIC(12, 4),
        unit_price NUMERIC(12, 2),
        cost_price NUMERIC(12, 2),
        subtotal NUMERIC(12, 2)
    )
    LOOP
        SELECT stock, name INTO v_current_stock, v_product_name
        FROM public.products
        WHERE id = v_item.product_id AND inventory_id = p_inventory_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto "%" no existe en este inventario.', v_item.product_name;
        END IF;

        IF (v_current_stock + 0.0002) < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, Solicitado: %.', 
                v_product_name, v_current_stock, v_item.quantity;
        END IF;
    END LOOP;

    -- 2. INSERTAR REGISTRO DE VENTA
    INSERT INTO public.sales (
        inventory_id, seller_id, seller_email, total_amount, payment_method,
        customer_name, customer_contact, notes
    ) VALUES (
        p_inventory_id, p_seller_id, p_seller_email, p_total_amount, p_payment_method,
        p_customer_name, p_customer_contact,
        CASE WHEN p_coupon_code IS NOT NULL AND p_coupon_code <> '' 
             THEN COALESCE(p_notes, '') || ' [Cupón: ' || p_coupon_code || ' (-' || p_discount_amount || ')]'
             ELSE p_notes END
    ) RETURNING id INTO v_sale_id;

    -- 3. INSERTAR ÍTEMS, DESCONTAR STOCK Y AJUSTAR PRODUCT_LOCATIONS
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (
        product_id UUID,
        product_name TEXT,
        product_code TEXT,
        quantity NUMERIC(12, 4),
        unit_price NUMERIC(12, 2),
        cost_price NUMERIC(12, 2),
        subtotal NUMERIC(12, 2)
    )
    LOOP
        UPDATE public.products
        SET stock = GREATEST(0, ROUND((stock - v_item.quantity)::numeric, 4)),
            last_modified_by = p_seller_id,
            last_modified_by_email = p_seller_email,
            updated_at = NOW()
        WHERE id = v_item.product_id;

        -- Descontar proporcionalmente de product_locations si están asignadas
        v_remaining_deduct := v_item.quantity;
        FOR v_loc IN 
            SELECT id, quantity 
            FROM public.product_locations 
            WHERE product_id = v_item.product_id AND quantity > 0
            ORDER BY created_at ASC 
            FOR UPDATE
        LOOP
            IF v_remaining_deduct <= 0 THEN
                EXIT;
            END IF;

            IF v_loc.quantity <= v_remaining_deduct THEN
                UPDATE public.product_locations SET quantity = 0, updated_at = NOW() WHERE id = v_loc.id;
                v_remaining_deduct := v_remaining_deduct - v_loc.quantity;
            ELSE
                UPDATE public.product_locations 
                SET quantity = ROUND((quantity - v_remaining_deduct)::numeric, 4), updated_at = NOW() 
                WHERE id = v_loc.id;
                v_remaining_deduct := 0;
            END IF;
        END LOOP;

        INSERT INTO public.sale_items (
            sale_id, product_id, product_name, product_code,
            quantity, unit_price, cost_price, subtotal
        ) VALUES (
            v_sale_id, v_item.product_id, v_item.product_name, v_item.product_code,
            v_item.quantity, v_item.unit_price, v_item.cost_price, v_item.subtotal
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id
    );
END;
$$;

-- ==============================================================================
-- 20. SUPABASE STORAGE (Bucket product-images)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "storage_select_product_images" ON storage.objects;
DROP POLICY IF EXISTS "storage_insert_product_images" ON storage.objects;
DROP POLICY IF EXISTS "storage_update_product_images" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_product_images" ON storage.objects;

CREATE POLICY "storage_select_product_images" ON storage.objects
    FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "storage_insert_product_images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "storage_update_product_images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "storage_delete_product_images" ON storage.objects
    FOR DELETE USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- ==============================================================================
-- 21. AUTO-REPARACIÓN DE CUENTAS EXISTENTES (Backfill para usuarios ya creados)
-- ==============================================================================
DO $$
DECLARE
    r RECORD;
    v_new_inv_id UUID;
    cat_gen_id UUID;
BEGIN
    FOR r IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
        INSERT INTO public.profiles (id, email, full_name)
        VALUES (r.id, r.email, COALESCE(r.raw_user_meta_data->>'full_name', split_part(r.email, '@', 1)))
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

        IF NOT EXISTS (SELECT 1 FROM public.inventories WHERE owner_id = r.id) 
           AND NOT EXISTS (SELECT 1 FROM public.inventory_users WHERE user_id = r.id) THEN

            INSERT INTO public.inventories (name, description, currency, inventory_type, owner_id)
            VALUES (
                'Mi Inventario Principal',
                'Espacio de trabajo creado automáticamente',
                'PEN',
                'BUSINESS',
                r.id
            )
            RETURNING id INTO v_new_inv_id;

            INSERT INTO public.inventory_users (inventory_id, user_id, role)
            VALUES (v_new_inv_id, r.id, 'owner')
            ON CONFLICT DO NOTHING;

            INSERT INTO public.locations (inventory_id, name, code, description) VALUES
                (v_new_inv_id, 'Almacén Central', 'LOC-ALM-001', 'Área física principal'),
                (v_new_inv_id, 'Estante A', 'LOC-EST-A01', 'Estantería de fácil acceso');

            INSERT INTO public.categories (inventory_id, name, color, description)
            VALUES (v_new_inv_id, 'General', '#3B82F6', 'Categoría general')
            RETURNING id INTO cat_gen_id;

            INSERT INTO public.subcategories (inventory_id, category_id, name)
            VALUES (v_new_inv_id, cat_gen_id, 'Suministros');
        END IF;
    END LOOP;
END;
$$;
