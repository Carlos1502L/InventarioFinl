-- ==============================================================================
-- PLATAFORMA DE GESTIÓN DE INVENTARIOS COLABORATIVA (PWA)
-- ESQUEMA COMPLETO, IDEMPOTENTE Y 100% LIBRE DE RECURSIÓN RLS
-- ==============================================================================

-- 1. Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABLA: profiles (Perfiles vinculados a Supabase Auth)
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
-- 3. TABLA: inventories (Multi-tenancy / Espacios de trabajo)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. TABLA: inventory_users (Colaboración y Permisos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inventory_id, user_id)
);

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
-- 8. TABLA: locations (Ubicaciones Físicas y Etiquetas)
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
-- 9. TABLA: products (Catálogo de Productos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 5,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.locations(id) ON DELETE RESTRICT,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'WITHDRAWN', 'ARCHIVED')),
    withdrawal_reason TEXT,
    last_modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    last_modified_by_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inventory_id, code)
);

-- ==============================================================================
-- 10. TABLA: audit_logs (Trazabilidad e Historial de Cambios)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'MOVE', 'WITHDRAW', 'RESTOCK', 'DELETE')),
    details TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 11. ÍNDICES DE RENDIMIENTO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_inventory_users_user ON public.inventory_users(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_users_inv ON public.inventory_users(inventory_id);
CREATE INDEX IF NOT EXISTS idx_products_inventory ON public.products(inventory_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_products_location ON public.products(location_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_locations_inventory ON public.locations(inventory_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_product ON public.audit_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_inventory ON public.audit_logs(inventory_id);

-- ==============================================================================
-- 12. FUNCIONES DE SEGURIDAD PARA RLS (SECURITY DEFINER = CERO RECURSIÓN)
-- ==============================================================================

-- Función 1: Verificar si el usuario tiene acceso (dueño o colaborador) al inventario
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

-- Función 2: Verificar si el usuario es dueño del inventario
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
-- 13. LIMPIEZA DINÁMICA DE TODAS LAS POLÍTICAS PREVIAS EN SCHEMA PUBLIC
-- (Elimina cualquier política residual que causaba bucles o recursión infinita)
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

-- ==============================================================================
-- 14. HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 15. POLÍTICAS RLS LIMPIAS Y BLINDADAS
-- ==============================================================================

-- 15.1 profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- 15.2 inventories
CREATE POLICY "inventories_select" ON public.inventories FOR SELECT TO authenticated
    USING (owner_id = auth.uid() OR public.has_inventory_access(id));

CREATE POLICY "inventories_insert" ON public.inventories FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "inventories_update" ON public.inventories FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR public.has_inventory_access(id));

CREATE POLICY "inventories_delete" ON public.inventories FOR DELETE TO authenticated
    USING (owner_id = auth.uid());

-- 15.3 inventory_users (usa is_inventory_owner que es SECURITY DEFINER para evitar recursión)
CREATE POLICY "inv_users_select" ON public.inventory_users FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_inventory_owner(inventory_id));

CREATE POLICY "inv_users_insert" ON public.inventory_users FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_inventory_owner(inventory_id));

CREATE POLICY "inv_users_delete" ON public.inventory_users FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR public.is_inventory_owner(inventory_id));

-- 15.4 inventory_invitations
CREATE POLICY "invitations_select" ON public.inventory_invitations FOR SELECT TO authenticated
    USING (public.is_inventory_owner(inventory_id) OR LOWER(email) = LOWER(auth.jwt()->>'email'));

CREATE POLICY "invitations_insert" ON public.inventory_invitations FOR INSERT TO authenticated
    WITH CHECK (public.is_inventory_owner(inventory_id));

CREATE POLICY "invitations_update" ON public.inventory_invitations FOR UPDATE TO authenticated
    USING (public.is_inventory_owner(inventory_id) OR LOWER(email) = LOWER(auth.jwt()->>'email'));

CREATE POLICY "invitations_delete" ON public.inventory_invitations FOR DELETE TO authenticated
    USING (public.is_inventory_owner(inventory_id));

-- 15.5 categories
CREATE POLICY "categories_all" ON public.categories FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- 15.6 subcategories
CREATE POLICY "subcategories_all" ON public.subcategories FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- 15.7 locations
CREATE POLICY "locations_all" ON public.locations FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- 15.8 products
CREATE POLICY "products_all" ON public.products FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- 15.9 audit_logs
CREATE POLICY "audit_logs_all" ON public.audit_logs FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- ==============================================================================
-- 16. FUNCIÓN RPC: AUTO-INICIALIZACIÓN DE INVENTARIO
-- ==============================================================================
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

    -- Datos de usuario
    SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
    INTO v_email, v_name
    FROM auth.users
    WHERE id = v_uid;

    -- Perfil
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (v_uid, v_email, v_name)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

    -- Revisar si ya tiene inventario
    SELECT id INTO new_inv_id FROM public.inventories WHERE owner_id = v_uid LIMIT 1;
    IF new_inv_id IS NOT NULL THEN
        RETURN new_inv_id;
    END IF;

    SELECT inventory_id INTO new_inv_id FROM public.inventory_users WHERE user_id = v_uid LIMIT 1;
    IF new_inv_id IS NOT NULL THEN
        RETURN new_inv_id;
    END IF;

    -- Crear Inventario Personal
    INSERT INTO public.inventories (name, description, currency, owner_id)
    VALUES ('Mi Inventario Principal', 'Inventario personal creado automáticamente', 'USD', v_uid)
    RETURNING id INTO new_inv_id;

    -- Asignar como dueño
    INSERT INTO public.inventory_users (inventory_id, user_id, role)
    VALUES (new_inv_id, v_uid, 'owner')
    ON CONFLICT (inventory_id, user_id) DO NOTHING;

    -- Ubicaciones Físicas Iniciales
    INSERT INTO public.locations (inventory_id, name, code, description) VALUES
        (new_inv_id, 'Almacén Central', 'LOC-ALM-001', 'Área física principal de almacenamiento'),
        (new_inv_id, 'Estante A', 'LOC-EST-A01', 'Estantería de fácil acceso');

    -- Categorías Iniciales
    INSERT INTO public.categories (inventory_id, name, color, description)
    VALUES (new_inv_id, 'General', '#3B82F6', 'Categoría general de productos')
    RETURNING id INTO cat_gen_id;

    INSERT INTO public.categories (inventory_id, name, color, description)
    VALUES (new_inv_id, 'Herramientas y Equipos', '#10B981', 'Materiales y herramientas')
    RETURNING id INTO cat_herr_id;

    -- Subcategorías Iniciales
    INSERT INTO public.subcategories (inventory_id, category_id, name) VALUES 
        (new_inv_id, cat_gen_id, 'Suministros'),
        (new_inv_id, cat_herr_id, 'Manuales');

    RETURN new_inv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para nuevos usuarios
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

    INSERT INTO public.inventories (name, description, currency, owner_id)
    VALUES ('Mi Inventario Principal', 'Inventario personal generado automáticamente', 'USD', NEW.id)
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

-- ==============================================================================
-- 17. SUPABASE STORAGE (Bucket product-images)
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
-- 18. AUTO-REPARACIÓN DE CUENTAS EXISTENTES (Backfill)
-- ==============================================================================
DO $$
DECLARE
    r RECORD;
    v_new_inv_id UUID;
    cat_gen_id UUID;
BEGIN
    FOR r IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
        -- Asegurar perfil
        INSERT INTO public.profiles (id, email, full_name)
        VALUES (r.id, r.email, COALESCE(r.raw_user_meta_data->>'full_name', split_part(r.email, '@', 1)))
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

        -- Si no tiene inventario, creárselo
        IF NOT EXISTS (SELECT 1 FROM public.inventories WHERE owner_id = r.id) 
           AND NOT EXISTS (SELECT 1 FROM public.inventory_users WHERE user_id = r.id) THEN

            INSERT INTO public.inventories (name, description, currency, owner_id)
            VALUES (
                'Mi Inventario Principal',
                'Espacio de trabajo creado automáticamente',
                'USD',
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
