-- ==============================================================================
-- INVENTARIO COOP - PARCHE DE ENDURECIMIENTO DE SEGURIDAD (POSTGRESQL / SUPABASE)
-- Aplicar directamente en el SQL Editor de Supabase
-- ==============================================================================

-- 1. CORRECCIÓN DE POLÍTICA RLS CONTRA ESCALADA DE PRIVILEGIOS EN INVENTORY_USERS
-- Previene que un usuario autenticado arbitrario se inserte a sí mismo en inventarios ajenos.
DROP POLICY IF EXISTS "inv_users_insert" ON public.inventory_users;

CREATE POLICY "inv_users_insert" ON public.inventory_users FOR INSERT TO authenticated
    WITH CHECK (
        public.is_inventory_owner(inventory_id)
        OR (
            user_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM public.inventory_invitations
                WHERE inventory_id = public.inventory_users.inventory_id
                  AND LOWER(email) = LOWER(auth.jwt()->>'email')
                  AND status = 'pending'
            )
        )
    );

-- 2. CORRECCIÓN DE SUPLANTACIÓN DE VENDEDOR EN RPC PROCESS_POS_SALE
-- Enforce de auth.uid() y auth.jwt()->>'email' cuando la llamada proviene de un usuario autenticado.
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
    v_effective_seller_id UUID;
    v_effective_seller_email TEXT;
BEGIN
    IF NOT public.has_inventory_access(p_inventory_id) THEN
        RAISE EXCEPTION 'No tienes permiso para operar en este inventario.';
    END IF;

    -- Prevenir suplantación de identidad (Impersonation): Forzar auth.uid() si el caller está autenticado
    v_effective_seller_id := CASE WHEN auth.uid() IS NOT NULL THEN auth.uid() ELSE p_seller_id END;
    v_effective_seller_email := CASE WHEN auth.jwt()->>'email' IS NOT NULL THEN auth.jwt()->>'email' ELSE p_seller_email END;

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
        p_inventory_id, v_effective_seller_id, v_effective_seller_email, p_total_amount, p_payment_method,
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
            last_modified_by = v_effective_seller_id,
            last_modified_by_email = v_effective_seller_email,
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
                UPDATE public.product_locations SET quantity = ROUND((quantity - v_remaining_deduct)::numeric, 4), updated_at = NOW() WHERE id = v_loc.id;
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
        'sale_id', v_sale_id,
        'message', 'Venta procesada con éxito y stock actualizado.'
    );
END;
$$;
