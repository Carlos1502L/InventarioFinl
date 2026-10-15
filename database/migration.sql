-- ==============================================================================
-- SCRIPT DE MIGRACIÓN SEGURA PARA SUPABASE (NO DESTRUCTIVO)
-- Aplica nuevas columnas y tablas sin formatear ni borrar registros existentes
-- ==============================================================================

-- 1. Actualización de tabla inventories (Tipo de inventario y Métodos de pago Yape/Plin)
ALTER TABLE public.inventories 
    ADD COLUMN IF NOT EXISTS inventory_type VARCHAR(20) DEFAULT 'BUSINESS' CHECK (inventory_type IN ('PERSONAL', 'BUSINESS')),
    ADD COLUMN IF NOT EXISTS yape_phone TEXT,
    ADD COLUMN IF NOT EXISTS yape_qr_url TEXT,
    ADD COLUMN IF NOT EXISTS plin_phone TEXT,
    ADD COLUMN IF NOT EXISTS plin_qr_url TEXT,
    ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

-- 2. Actualización de tabla products (Precios de costo, markup %, variantes y stock mínimo en 1)
ALTER TABLE public.products 
    ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS markup_percentage NUMERIC(6, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS is_variant BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS variant_attributes JSONB DEFAULT '{}'::jsonb;

-- Ajustar stock mínimo por defecto a 1 unidad (RF-04.1)
ALTER TABLE public.products ALTER COLUMN min_stock SET DEFAULT 1;

-- 3. Nueva Tabla: sales (Registro de Ventas en Inventario de Negocio - RF-06)
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

-- 4. Nueva Tabla: sale_items (Items/Líneas de cada venta)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    product_code TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL,
    cost_price NUMERIC(12, 2) DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Índices para consultas ultra-rápidas
CREATE INDEX IF NOT EXISTS idx_sales_inventory ON public.sales(inventory_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_products_parent ON public.products(parent_id);

-- 6. Función RPC: Transferir Propiedad de Inventario (RF-02.2)
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

    -- Verificar que quien llama sea el dueño actual
    IF NOT EXISTS (
        SELECT 1 FROM public.inventories 
        WHERE id = p_inventory_id AND owner_id = v_uid
    ) THEN
        RAISE EXCEPTION 'Solo el dueño actual puede transferir la propiedad del inventario';
    END IF;

    -- Verificar que el nuevo dueño exista
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_new_owner_id) THEN
        RAISE EXCEPTION 'El usuario destino no existe';
    END IF;

    -- 1. Actualizar el dueño en inventories
    UPDATE public.inventories
    SET owner_id = p_new_owner_id, updated_at = NOW()
    WHERE id = p_inventory_id;

    -- 2. Asegurar que el nuevo dueño tenga rol 'owner' en inventory_users
    INSERT INTO public.inventory_users (inventory_id, user_id, role)
    VALUES (p_inventory_id, p_new_owner_id, 'owner')
    ON CONFLICT (inventory_id, user_id) 
    DO UPDATE SET role = 'owner';

    -- 3. Degradar al antiguo dueño a 'collaborator'
    UPDATE public.inventory_users
    SET role = 'collaborator'
    WHERE inventory_id = p_inventory_id AND user_id = v_uid;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Función RPC: Eliminar Inventario con Palabra de Seguridad "DELETE-INVENTORY" (RF-02.3)
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

    -- Verificar que quien llama sea el dueño
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

-- 8. Seguridad RLS para las nuevas tablas (Sin recursión)
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_all" ON public.sales;
CREATE POLICY "sales_all" ON public.sales FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

DROP POLICY IF EXISTS "sale_items_all" ON public.sale_items;
CREATE POLICY "sale_items_all" ON public.sale_items FOR ALL TO authenticated
    USING (sale_id IN (SELECT id FROM public.sales WHERE public.has_inventory_access(inventory_id)))
    WITH CHECK (sale_id IN (SELECT id FROM public.sales WHERE public.has_inventory_access(inventory_id)));

-- 9. Conceder Permisos SQL (GRANT) para que PostgREST y la API no den error 42501
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
