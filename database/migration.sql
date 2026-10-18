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

-- ==============================================================================
-- 9. TABLA: coupons (Cupones de Descuento para Ventas)
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

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coupons_all" ON public.coupons;
CREATE POLICY "coupons_all" ON public.coupons FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

-- ==============================================================================
-- 10. ESTADOS DE PRODUCTO (ACTIVO / INACTIVO) & RELACIÓN DE COLABORADORES
-- ==============================================================================
-- Permitir estado INACTIVE en products
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'WITHDRAWN', 'ARCHIVED'));

-- Asegurar relación entre inventory_users y profiles para PostgREST
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

-- Permitir a los miembros del inventario ver la lista de colaboradores
DROP POLICY IF EXISTS "inv_users_select" ON public.inventory_users;
CREATE POLICY "inv_users_select" ON public.inventory_users FOR SELECT TO authenticated
    USING (public.has_inventory_access(inventory_id));

-- ==============================================================================
-- 11. RPC: process_pos_sale (TRANSACCIÓN CON FOR UPDATE PARA EVITAR SOBREVENTA)
-- ==============================================================================
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
    v_current_stock INT;
    v_product_name TEXT;
    v_sale_id UUID;
BEGIN
    -- Validar que el usuario tenga acceso al inventario
    IF NOT public.has_inventory_access(p_inventory_id) THEN
        RAISE EXCEPTION 'No tienes permiso para operar en este inventario.';
    END IF;

    -- 1. BLOQUEO TRANSACCIONAL DE CADA PRODUCTO (FOR UPDATE)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (
        product_id UUID,
        product_name TEXT,
        product_code TEXT,
        quantity INT,
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

        IF v_current_stock < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: % uds, Solicitado: % uds.', 
                v_product_name, v_current_stock, v_item.quantity;
        END IF;
    END LOOP;

    -- 2. INSERTAR VENTA PRINCIPAL
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

    -- 3. INSERTAR ÍTEMS Y DESCONTAR STOCK ATÓMICAMENTE
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (
        product_id UUID,
        product_name TEXT,
        product_code TEXT,
        quantity INT,
        unit_price NUMERIC(12, 2),
        cost_price NUMERIC(12, 2),
        subtotal NUMERIC(12, 2)
    )
    LOOP
        UPDATE public.products
        SET stock = stock - v_item.quantity,
            last_modified_by = p_seller_id,
            last_modified_by_email = p_seller_email,
            updated_at = NOW()
        WHERE id = v_item.product_id;

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

-- 12. Conceder Permisos SQL (GRANT)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

