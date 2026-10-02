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
-- 12. FUNCIONES DE SEGURIDAD (RLS HELPERS)
-- ==============================================================================
-- Función para verificar si el usuario autenticado tiene acceso al inventario
CREATE OR REPLACE FUNCTION public.is_inventory_member(inv_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.inventory_users iu
        WHERE iu.inventory_id = inv_id 
          AND iu.user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 
        FROM public.inventories i
        WHERE i.id = inv_id 
          AND i.owner_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Trigger para mantener updated_at actualizado
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_inventories_updated_at
    BEFORE UPDATE ON public.inventories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_subcategories_updated_at
    BEFORE UPDATE ON public.subcategories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_locations_updated_at
    BEFORE UPDATE ON public.locations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 13. TRIGGER AUTOMÁTICO DE REGISTRO DE USUARIO (Nuevo Usuario)
-- Crea: Perfil, Inventario Inicial por Defecto, Asignación de Owner, y verifica Invitaciones
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_inv_id UUID;
    cat_elec_id UUID;
    cat_hogar_id UUID;
    loc_alm_id UUID;
    loc_est_id UUID;
    invitation_record RECORD;
BEGIN
    -- 1. Crear Perfil
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    );

    -- 2. Crear Inventario Principal
    INSERT INTO public.inventories (name, description, owner_id)
    VALUES (
        'Mi Inventario Principal',
        'Inventario inicial generado automáticamente',
        NEW.id
    )
    RETURNING id INTO new_inv_id;

    -- 3. Vincular como Dueño en inventory_users
    INSERT INTO public.inventory_users (inventory_id, user_id, role)
    VALUES (new_inv_id, NEW.id, 'owner');

    -- 4. Crear Ubicaciones Iniciales de Ejemplo
    INSERT INTO public.locations (inventory_id, name, code, description)
    VALUES 
        (new_inv_id, 'Almacén Central', 'LOC-ALM-001', 'Almacén físico principal'),
        (new_inv_id, 'Estante A (Exhibición)', 'LOC-EST-A01', 'Estantería de fácil acceso')
    RETURNING id INTO loc_alm_id;

    -- 5. Crear Categorías Iniciales de Ejemplo
    INSERT INTO public.categories (inventory_id, name, color, description)
    VALUES (new_inv_id, 'Electrónicos', '#3B82F6', 'Dispositivos, gadgets y accesorios')
    RETURNING id INTO cat_elec_id;

    INSERT INTO public.categories (inventory_id, name, color, description)
    VALUES (new_inv_id, 'Herramientas y Equipos', '#10B981', 'Equipamiento de trabajo y mantenimiento')
    RETURNING id INTO cat_hogar_id;

    -- 6. Crear Subcategorías de Ejemplo
    INSERT INTO public.subcategories (inventory_id, category_id, name, description)
    VALUES 
        (new_inv_id, cat_elec_id, 'Cómputo', 'Computadoras y laptops'),
        (new_inv_id, cat_elec_id, 'Audio y Video', 'Audífonos, bocinas y monitores');

    -- 7. Revisar si hay invitaciones pendientes para este email y aceptarlas automáticamente
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparador en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 14. ROW LEVEL SECURITY (RLS) ESTRICTO
-- ==============================================================================

-- Activar RLS en todas las tablas
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
CREATE POLICY "Usuarios pueden ver su propio perfil y el de colaboradores"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.inventory_users iu1
            JOIN public.inventory_users iu2 ON iu1.inventory_id = iu2.inventory_id
            WHERE iu1.user_id = auth.uid() AND iu2.user_id = profiles.id
        )
    );

CREATE POLICY "Usuarios pueden actualizar su propio perfil"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid());

-- 14.2 INVENTORIES POLICIES
CREATE POLICY "Miembros pueden ver sus inventarios"
    ON public.inventories FOR SELECT
    TO authenticated
    USING (public.is_inventory_member(id));

CREATE POLICY "Usuarios pueden crear inventarios"
    ON public.inventories FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Dueño puede actualizar su inventario"
    ON public.inventories FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid());

CREATE POLICY "Dueño puede eliminar su inventario"
    ON public.inventories FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- 14.3 INVENTORY USERS POLICIES
CREATE POLICY "Miembros pueden ver los colaboradores de su inventario"
    ON public.inventory_users FOR SELECT
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

CREATE POLICY "Dueños pueden insertar colaboradores"
    ON public.inventory_users FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.inventories i 
            WHERE i.id = inventory_id AND i.owner_id = auth.uid()
        )
    );

CREATE POLICY "Dueños pueden eliminar colaboradores"
    ON public.inventory_users FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.inventories i 
            WHERE i.id = inventory_id AND i.owner_id = auth.uid()
        )
    );

-- 14.4 INVITATIONS POLICIES
CREATE POLICY "Miembros pueden ver invitaciones de su inventario"
    ON public.inventory_invitations FOR SELECT
    TO authenticated
    USING (public.is_inventory_member(inventory_id) OR LOWER(email) = LOWER(auth.jwt()->>'email'));

CREATE POLICY "Dueños y colaboradores pueden enviar invitaciones"
    ON public.inventory_invitations FOR INSERT
    TO authenticated
    WITH CHECK (public.is_inventory_member(inventory_id));

CREATE POLICY "Actualizar estado de invitación"
    ON public.inventory_invitations FOR UPDATE
    TO authenticated
    USING (public.is_inventory_member(inventory_id) OR LOWER(email) = LOWER(auth.jwt()->>'email'));

-- 14.5 CATEGORIES POLICIES (Colaboración Completa)
CREATE POLICY "Miembros pueden ver categorías"
    ON public.categories FOR SELECT
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

CREATE POLICY "Miembros pueden crear categorías"
    ON public.categories FOR INSERT
    TO authenticated
    WITH CHECK (public.is_inventory_member(inventory_id));

CREATE POLICY "Miembros pueden actualizar categorías"
    ON public.categories FOR UPDATE
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

CREATE POLICY "Miembros pueden eliminar categorías"
    ON public.categories FOR DELETE
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

-- 14.6 SUBCATEGORIES POLICIES
CREATE POLICY "Miembros pueden ver subcategorías"
    ON public.subcategories FOR SELECT
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

CREATE POLICY "Miembros pueden crear subcategorías"
    ON public.subcategories FOR INSERT
    TO authenticated
    WITH CHECK (public.is_inventory_member(inventory_id));

CREATE POLICY "Miembros pueden actualizar subcategorías"
    ON public.subcategories FOR UPDATE
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

CREATE POLICY "Miembros pueden eliminar subcategorías"
    ON public.subcategories FOR DELETE
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

-- 14.7 LOCATIONS POLICIES
CREATE POLICY "Miembros pueden ver ubicaciones"
    ON public.locations FOR SELECT
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

CREATE POLICY "Miembros pueden crear ubicaciones"
    ON public.locations FOR INSERT
    TO authenticated
    WITH CHECK (public.is_inventory_member(inventory_id));

CREATE POLICY "Miembros pueden actualizar ubicaciones"
    ON public.locations FOR UPDATE
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

CREATE POLICY "Miembros pueden eliminar ubicaciones"
    ON public.locations FOR DELETE
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

-- 14.8 PRODUCTS POLICIES (Permisos Completos para Colaboradores)
CREATE POLICY "Miembros pueden ver productos"
    ON public.products FOR SELECT
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

CREATE POLICY "Miembros pueden crear productos"
    ON public.products FOR INSERT
    TO authenticated
    WITH CHECK (public.is_inventory_member(inventory_id));

CREATE POLICY "Miembros pueden actualizar productos"
    ON public.products FOR UPDATE
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

CREATE POLICY "Miembros pueden eliminar productos"
    ON public.products FOR DELETE
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

-- 14.9 AUDIT LOGS POLICIES
CREATE POLICY "Miembros pueden ver historial de auditoría"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_inventory_member(inventory_id));

CREATE POLICY "Miembros pueden registrar logs de auditoría"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.is_inventory_member(inventory_id));

-- ==============================================================================
-- 15. CONFIGURACIÓN DE STORAGE (BUCKET: product-images)
-- ==============================================================================
-- Nota: En Supabase Storage, crear el bucket 'product-images' con acceso público para lectura
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Cualquier usuario autenticado puede ver fotos de productos"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'product-images');

CREATE POLICY "Usuarios autenticados pueden subir fotos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Usuarios autenticados pueden actualizar fotos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'product-images');

CREATE POLICY "Usuarios autenticados pueden eliminar fotos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'product-images');
