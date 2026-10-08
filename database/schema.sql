-- ==============================================================================
-- PLATAFORMA DE GESTIÓN DE INVENTARIOS PERSONALIZABLE Y COLABORATIVA (PWA)
-- Motor: Supabase / PostgreSQL 15+
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLA: profiles (Perfiles de Usuario)
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
-- 3. TABLA: inventories (Inventarios Multi-Tenancy)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. TABLA: inventory_users (Colaboradores y Permisos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator')),
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
    role TEXT NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
    color TEXT DEFAULT '#3B82F6',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inventory_id, name)
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_id, name)
);

-- ==============================================================================
-- 8. TABLA: locations (Ubicaciones Físicas y Etiquetas QR)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Ej: "Almacén 1", "Estante B", "Pasillo 3"
    code TEXT NOT NULL, -- Código único ej: "LOC-ALM1-001"
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inventory_id, code)
);

-- ==============================================================================
-- 9. TABLA: products (Productos con Códigos, Fotos y Ubicación)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL, -- SKU o Código de barras (EAN-13, QR, etc.)
    description TEXT,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    images JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de URLs (máximo 3 fotos)
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
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- 12. FUNCIONES DE SEGURIDAD Y TRIGGERS (SIN RECURSIÓN RLS)
-- ==============================================================================

-- Función segura para verificar membresía sin recursión infinita
CREATE OR REPLACE FUNCTION public.is_inventory_member(inv_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_uid UUID;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Es dueño directo
    IF EXISTS (SELECT 1 FROM public.inventories WHERE id = inv_id AND owner_id = v_uid) THEN
        RETURN TRUE;
    END IF;

    -- Es colaborador en inventory_users
    IF EXISTS (SELECT 1 FROM public.inventory_users WHERE inventory_id = inv_id AND user_id = v_uid) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_inventories_updated_at ON public.inventories;
CREATE TRIGGER set_inventories_updated_at BEFORE UPDATE ON public.inventories FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_categories_updated_at ON public.categories;
CREATE TRIGGER set_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_subcategories_updated_at ON public.subcategories;
CREATE TRIGGER set_subcategories_updated_at BEFORE UPDATE ON public.subcategories FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_locations_updated_at ON public.locations;
CREATE TRIGGER set_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 13. FUNCIÓN RPC: AUTO-INICIALIZACIÓN DE INVENTARIO
-- (Permite al frontend o triggers inicializar el entorno si el usuario no tiene nada)
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
    loc_alm_id UUID;
    invitation_record RECORD;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    -- Obtener datos del usuario desde auth.users
    SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
    INTO v_email, v_name
    FROM auth.users
    WHERE id = v_uid;

    -- 1. Crear Perfil si no existe
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (v_uid, v_email, v_name)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

    -- 2. Revisar si ya pertenece a algún inventario
    SELECT id INTO new_inv_id
    FROM public.inventories
    WHERE owner_id = v_uid
    LIMIT 1;

    IF new_inv_id IS NOT NULL THEN
        RETURN new_inv_id;
    END IF;

    SELECT inventory_id INTO new_inv_id
    FROM public.inventory_users
    WHERE user_id = v_uid
    LIMIT 1;

    IF new_inv_id IS NOT NULL THEN
        RETURN new_inv_id;
    END IF;

    -- 3. Crear Inventario Principal
    INSERT INTO public.inventories (name, description, owner_id)
    VALUES ('Mi Inventario Principal', 'Inventario inicial de trabajo', v_uid)
    RETURNING id INTO new_inv_id;

    -- 4. Asignar como dueño
    INSERT INTO public.inventory_users (inventory_id, user_id, role)
    VALUES (new_inv_id, v_uid, 'owner')
    ON CONFLICT (inventory_id, user_id) DO NOTHING;

    -- 5. Ubicaciones iniciales
    INSERT INTO public.locations (inventory_id, name, code, description)
    VALUES (new_inv_id, 'Almacén Central', 'LOC-ALM-001', 'Almacén físico principal')
    RETURNING id INTO loc_alm_id;

    INSERT INTO public.locations (inventory_id, name, code, description)
    VALUES (new_inv_id, 'Estante A', 'LOC-EST-A01', 'Estantería de fácil acceso')
    ON CONFLICT (inventory_id, code) DO NOTHING;

    -- 6. Categorías iniciales
    INSERT INTO public.categories (inventory_id, name, color, description)
    VALUES (new_inv_id, 'General', '#3B82F6', 'Categoría general de productos')
    RETURNING id INTO cat_gen_id;

    INSERT INTO public.categories (inventory_id, name, color, description)
    VALUES (new_inv_id, 'Herramientas y Equipos', '#10B981', 'Materiales y herramientas')
    RETURNING id INTO cat_herr_id;

    -- 7. Subcategorías
    INSERT INTO public.subcategories (inventory_id, category_id, name)
    VALUES 
        (new_inv_id, cat_gen_id, 'Suministros'),
        (new_inv_id, cat_herr_id, 'Manuales')
    ON CONFLICT (category_id, name) DO NOTHING;

    -- 8. Aceptar invitaciones pendientes si existen
    FOR invitation_record IN 
        SELECT id, inventory_id, role FROM public.inventory_invitations 
        WHERE LOWER(email) = LOWER(v_email) AND status = 'pending'
    LOOP
        INSERT INTO public.inventory_users (inventory_id, user_id, role)
        VALUES (invitation_record.inventory_id, v_uid, invitation_record.role)
        ON CONFLICT (inventory_id, user_id) DO NOTHING;

        UPDATE public.inventory_invitations
        SET status = 'accepted'
        WHERE id = invitation_record.id;
    END LOOP;

    RETURN new_inv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger automático al crearse un nuevo usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_inv_id UUID;
    cat_gen_id UUID;
    cat_herr_id UUID;
    loc_alm_id UUID;
    invitation_record RECORD;
BEGIN
    -- 1. Crear Perfil
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Crear Inventario Principal
    INSERT INTO public.inventories (name, description, owner_id)
    VALUES ('Mi Inventario Principal', 'Inventario inicial generado automáticamente', NEW.id)
    RETURNING id INTO new_inv_id;

    -- 3. Vincular como Dueño
    INSERT INTO public.inventory_users (inventory_id, user_id, role)
    VALUES (new_inv_id, NEW.id, 'owner')
    ON CONFLICT (inventory_id, user_id) DO NOTHING;

    -- 4. Ubicaciones Iniciales
    INSERT INTO public.locations (inventory_id, name, code, description)
    VALUES 
        (new_inv_id, 'Almacén Central', 'LOC-ALM-001', 'Almacén físico principal'),
        (new_inv_id, 'Estante A', 'LOC-EST-A01', 'Estantería de fácil acceso')
    RETURNING id INTO loc_alm_id;

    -- 5. Categorías Iniciales
    INSERT INTO public.categories (inventory_id, name, color, description)
    VALUES (new_inv_id, 'General', '#3B82F6', 'Categoría general')
    RETURNING id INTO cat_gen_id;

    INSERT INTO public.categories (inventory_id, name, color, description)
    VALUES (new_inv_id, 'Herramientas y Equipos', '#10B981', 'Equipamiento de trabajo')
    RETURNING id INTO cat_herr_id;

    -- 6. Subcategorías
    INSERT INTO public.subcategories (inventory_id, category_id, name, description)
    VALUES 
        (new_inv_id, cat_gen_id, 'Suministros', 'Artículos varios'),
        (new_inv_id, cat_herr_id, 'Manuales', 'Herramientas de mano');

    -- 7. Revisar invitaciones pendientes
    FOR invitation_record IN 
        SELECT id, inventory_id, role FROM public.inventory_invitations 
        WHERE LOWER(email) = LOWER(NEW.email) AND status = 'pending'
    LOOP
        INSERT INTO public.inventory_users (inventory_id, user_id, role)
        VALUES (invitation_record.inventory_id, NEW.id, invitation_record.role)
        ON CONFLICT (inventory_id, user_id) DO NOTHING;

        UPDATE public.inventory_invitations
        SET status = 'accepted'
        WHERE id = invitation_record.id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 14. ROW LEVEL SECURITY (RLS) SEGURO Y LIMPIO
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

-- 14.1 PROFILES POLICIES
DROP POLICY IF EXISTS "Ver perfiles" ON public.profiles;
CREATE POLICY "Ver perfiles" ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR TRUE);

DROP POLICY IF EXISTS "Actualizar perfil propio" ON public.profiles;
CREATE POLICY "Actualizar perfil propio" ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Crear perfil propio" ON public.profiles;
CREATE POLICY "Crear perfil propio" ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- 14.2 INVENTORIES POLICIES
DROP POLICY IF EXISTS "Ver inventarios" ON public.inventories;
CREATE POLICY "Ver inventarios" ON public.inventories FOR SELECT TO authenticated
    USING (owner_id = auth.uid() OR public.is_inventory_member(id));

DROP POLICY IF EXISTS "Crear inventarios" ON public.inventories;
CREATE POLICY "Crear inventarios" ON public.inventories FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Actualizar inventarios" ON public.inventories;
CREATE POLICY "Actualizar inventarios" ON public.inventories FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR public.is_inventory_member(id));

DROP POLICY IF EXISTS "Eliminar inventarios" ON public.inventories;
CREATE POLICY "Eliminar inventarios" ON public.inventories FOR DELETE TO authenticated
    USING (owner_id = auth.uid());

-- 14.3 INVENTORY USERS POLICIES (Sin recursión)
DROP POLICY IF EXISTS "Ver miembros de inventario" ON public.inventory_users;
CREATE POLICY "Ver miembros de inventario" ON public.inventory_users FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Insertar miembros de inventario" ON public.inventory_users;
CREATE POLICY "Insertar miembros de inventario" ON public.inventory_users FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Eliminar miembros de inventario" ON public.inventory_users;
CREATE POLICY "Eliminar miembros de inventario" ON public.inventory_users FOR DELETE TO authenticated
    USING (public.is_inventory_member(inventory_id));

-- 14.4 INVITATIONS POLICIES
DROP POLICY IF EXISTS "Ver invitaciones" ON public.inventory_invitations;
CREATE POLICY "Ver invitaciones" ON public.inventory_invitations FOR SELECT TO authenticated
    USING (public.is_inventory_member(inventory_id) OR LOWER(email) = LOWER(auth.jwt()->>'email'));

DROP POLICY IF EXISTS "Crear invitaciones" ON public.inventory_invitations;
CREATE POLICY "Crear invitaciones" ON public.inventory_invitations FOR INSERT TO authenticated
    WITH CHECK (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Actualizar invitaciones" ON public.inventory_invitations;
CREATE POLICY "Actualizar invitaciones" ON public.inventory_invitations FOR UPDATE TO authenticated
    USING (public.is_inventory_member(inventory_id) OR LOWER(email) = LOWER(auth.jwt()->>'email'));

-- 14.5 CATEGORIES POLICIES
DROP POLICY IF EXISTS "Ver categorías" ON public.categories;
CREATE POLICY "Ver categorías" ON public.categories FOR SELECT TO authenticated
    USING (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Crear categorías" ON public.categories;
CREATE POLICY "Crear categorías" ON public.categories FOR INSERT TO authenticated
    WITH CHECK (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Actualizar categorías" ON public.categories;
CREATE POLICY "Actualizar categorías" ON public.categories FOR UPDATE TO authenticated
    USING (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Eliminar categorías" ON public.categories;
CREATE POLICY "Eliminar categorías" ON public.categories FOR DELETE TO authenticated
    USING (public.is_inventory_member(inventory_id));

-- 14.6 SUBCATEGORIES POLICIES
DROP POLICY IF EXISTS "Ver subcategorías" ON public.subcategories;
CREATE POLICY "Ver subcategorías" ON public.subcategories FOR SELECT TO authenticated
    USING (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Crear subcategorías" ON public.subcategories;
CREATE POLICY "Crear subcategorías" ON public.subcategories FOR INSERT TO authenticated
    WITH CHECK (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Actualizar subcategorías" ON public.subcategories;
CREATE POLICY "Actualizar subcategorías" ON public.subcategories FOR UPDATE TO authenticated
    USING (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Eliminar subcategorías" ON public.subcategories;
CREATE POLICY "Eliminar subcategorías" ON public.subcategories FOR DELETE TO authenticated
    USING (public.is_inventory_member(inventory_id));

-- 14.7 LOCATIONS POLICIES
DROP POLICY IF EXISTS "Ver ubicaciones" ON public.locations;
CREATE POLICY "Ver ubicaciones" ON public.locations FOR SELECT TO authenticated
    USING (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Crear ubicaciones" ON public.locations;
CREATE POLICY "Crear ubicaciones" ON public.locations FOR INSERT TO authenticated
    WITH CHECK (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Actualizar ubicaciones" ON public.locations;
CREATE POLICY "Actualizar ubicaciones" ON public.locations FOR UPDATE TO authenticated
    USING (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Eliminar ubicaciones" ON public.locations;
CREATE POLICY "Eliminar ubicaciones" ON public.locations FOR DELETE TO authenticated
    USING (public.is_inventory_member(inventory_id));

-- 14.8 PRODUCTS POLICIES
DROP POLICY IF EXISTS "Ver productos" ON public.products;
CREATE POLICY "Ver productos" ON public.products FOR SELECT TO authenticated
    USING (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Crear productos" ON public.products;
CREATE POLICY "Crear productos" ON public.products FOR INSERT TO authenticated
    WITH CHECK (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Actualizar productos" ON public.products;
CREATE POLICY "Actualizar productos" ON public.products FOR UPDATE TO authenticated
    USING (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Eliminar productos" ON public.products;
CREATE POLICY "Eliminar productos" ON public.products FOR DELETE TO authenticated
    USING (public.is_inventory_member(inventory_id));

-- 14.9 AUDIT LOGS POLICIES
DROP POLICY IF EXISTS "Ver historial auditoría" ON public.audit_logs;
CREATE POLICY "Ver historial auditoría" ON public.audit_logs FOR SELECT TO authenticated
    USING (public.is_inventory_member(inventory_id));

DROP POLICY IF EXISTS "Crear logs auditoría" ON public.audit_logs;
CREATE POLICY "Crear logs auditoría" ON public.audit_logs FOR INSERT TO authenticated
    WITH CHECK (public.is_inventory_member(inventory_id));

-- ==============================================================================
-- 15. CONFIGURACIÓN DE STORAGE (BUCKET: product-images)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Ver fotos de productos pública" ON storage.objects;
CREATE POLICY "Ver fotos de productos pública" ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Subir fotos de productos" ON storage.objects;
CREATE POLICY "Subir fotos de productos" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Actualizar fotos de productos" ON storage.objects;
CREATE POLICY "Actualizar fotos de productos" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Eliminar fotos de productos" ON storage.objects;
CREATE POLICY "Eliminar fotos de productos" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'product-images');

-- ==============================================================================
-- 16. AUTO-RECUPERACIÓN: SINCRONIZAR USUARIOS YA REGISTRADOS
-- (Si ya te registraste en Supabase antes de correr este script, este bloque te
-- crea tu perfil, tu inventario y tus ubicaciones iniciales de inmediato)
-- ==============================================================================
DO $$
DECLARE
    u RECORD;
    v_inv_id UUID;
    v_cat_gen UUID;
    v_cat_herr UUID;
    v_loc_alm UUID;
BEGIN
    FOR u IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
        -- 1. Crear Perfil
        INSERT INTO public.profiles (id, email, full_name)
        VALUES (
            u.id,
            u.email,
            COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
        )
        ON CONFLICT (id) DO NOTHING;

        -- 2. Si no tiene inventario, crearlo
        IF NOT EXISTS (SELECT 1 FROM public.inventories WHERE owner_id = u.id) AND
           NOT EXISTS (SELECT 1 FROM public.inventory_users WHERE user_id = u.id) THEN

            INSERT INTO public.inventories (name, description, owner_id)
            VALUES ('Mi Inventario Principal', 'Inventario inicial de trabajo', u.id)
            RETURNING id INTO v_inv_id;

            INSERT INTO public.inventory_users (inventory_id, user_id, role)
            VALUES (v_inv_id, u.id, 'owner')
            ON CONFLICT (inventory_id, user_id) DO NOTHING;

            INSERT INTO public.locations (inventory_id, name, code, description)
            VALUES (v_inv_id, 'Almacén Central', 'LOC-ALM-001', 'Almacén físico principal')
            RETURNING id INTO v_loc_alm;

            INSERT INTO public.locations (inventory_id, name, code, description)
            VALUES (v_inv_id, 'Estante A', 'LOC-EST-A01', 'Estantería de fácil acceso')
            ON CONFLICT (inventory_id, code) DO NOTHING;

            INSERT INTO public.categories (inventory_id, name, color, description)
            VALUES (v_inv_id, 'General', '#3B82F6', 'Categoría general')
            RETURNING id INTO v_cat_gen;

            INSERT INTO public.categories (inventory_id, name, color, description)
            VALUES (v_inv_id, 'Herramientas y Equipos', '#10B981', 'Equipamiento de trabajo')
            RETURNING id INTO v_cat_herr;

            INSERT INTO public.subcategories (inventory_id, category_id, name)
            VALUES 
                (v_inv_id, v_cat_gen, 'Suministros'),
                (v_inv_id, v_cat_herr, 'Manuales')
            ON CONFLICT (category_id, name) DO NOTHING;
        END IF;
    END LOOP;
END $$;
