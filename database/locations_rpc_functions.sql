-- ==============================================================================
-- FUNCIONES RPC: ASIGNACIÓN Y TRASLADO DE PRODUCTOS EN UBICACIONES (MÓDULO UBICACIONES)
-- ==============================================================================

-- 1. ASIGNACIÓN MASIVA POR LOTE DE PRODUCTOS A UNA UBICACIÓN FÍSICA
-- Invocado por: LocationsPage.tsx -> supabase.rpc('assign_product_locations_batch', ...)
CREATE OR REPLACE FUNCTION public.assign_product_locations_batch(
    p_inventory_id UUID,
    p_location_id UUID,
    p_items JSONB,
    p_user_id UUID DEFAULT NULL,
    p_user_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_effective_user_id UUID;
    v_effective_user_email TEXT;
    v_location_name TEXT;
    v_location_code TEXT;
    v_item RECORD;
    v_product RECORD;
    v_assigned_stock NUMERIC(12, 4);
    v_unassigned_stock NUMERIC(12, 4);
    v_assigned_count INT := 0;
BEGIN
    -- Validar existencia del inventario
    IF NOT EXISTS (SELECT 1 FROM public.inventories WHERE id = p_inventory_id) THEN
        RAISE EXCEPTION 'El inventario especificado no existe.';
    END IF;

    -- Validar permisos de acceso al inventario si el usuario está autenticado
    IF auth.uid() IS NOT NULL AND NOT public.has_inventory_access(p_inventory_id) THEN
        RAISE EXCEPTION 'No tienes permiso para operar en este inventario.';
    END IF;

    -- Determinar usuario y correo efectivo (prevenir suplantación)
    v_effective_user_id := COALESCE(auth.uid(), p_user_id);
    v_effective_user_email := COALESCE(auth.jwt()->>'email', NULLIF(TRIM(p_user_email), ''), 'usuario@sistema');

    -- Validar integridad de FK para audit_logs si el usuario no existe en auth.users
    IF v_effective_user_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_effective_user_id) THEN
            v_effective_user_id := NULL;
        END IF;
    END IF;

    -- Validar existencia de la ubicación destino en este inventario
    SELECT name, code INTO v_location_name, v_location_code
    FROM public.locations
    WHERE id = p_location_id AND inventory_id = p_inventory_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La ubicación especificada no existe en este inventario.';
    END IF;

    -- Validar que la lista de items no sea nula ni vacía
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'La lista de productos para asignar está vacía.';
    END IF;

    -- Procesar cada producto del lote
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (
        product_id UUID,
        quantity NUMERIC(12, 4)
    )
    LOOP
        IF v_item.product_id IS NULL THEN
            CONTINUE;
        END IF;

        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'La cantidad asignada debe ser mayor a cero (producto ID: %).', v_item.product_id;
        END IF;

        -- Bloqueo transaccional de fila del producto (FOR UPDATE)
        SELECT id, name, code, stock, location_id, unit_type
        INTO v_product
        FROM public.products
        WHERE id = v_item.product_id AND inventory_id = p_inventory_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto ID % no existe en este inventario.', v_item.product_id;
        END IF;

        -- Calcular stock ya asignado en estantes / ubicaciones
        SELECT COALESCE(SUM(quantity), 0)
        INTO v_assigned_stock
        FROM public.product_locations
        WHERE product_id = v_item.product_id;

        -- Calcular stock pendiente por ubicar
        v_unassigned_stock := GREATEST(0, ROUND((v_product.stock - v_assigned_stock)::numeric, 4));

        -- Validar que la cantidad no supere el saldo pendiente (con margen de tolerancia flotante)
        IF (v_unassigned_stock + 0.0002) < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para asignar en "%" (Código: %). Pendiente por ubicar: %, solicitado: %.',
                v_product.name, v_product.code, ROUND(v_unassigned_stock, 4), ROUND(v_item.quantity, 4);
        END IF;

        -- Upsert atómico en product_locations (incrementa si ya existía en esa ubicación)
        INSERT INTO public.product_locations (
            inventory_id,
            product_id,
            location_id,
            quantity,
            created_at,
            updated_at
        )
        VALUES (
            p_inventory_id,
            v_item.product_id,
            p_location_id,
            v_item.quantity,
            NOW(),
            NOW()
        )
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
            quantity = ROUND((public.product_locations.quantity + EXCLUDED.quantity)::numeric, 4),
            updated_at = NOW();

        -- Si el producto no tenía ubicación asignada por defecto, asociarle esta como principal
        UPDATE public.products
        SET location_id = COALESCE(location_id, p_location_id),
            last_modified_by = v_effective_user_id,
            last_modified_by_email = v_effective_user_email,
            updated_at = NOW()
        WHERE id = v_item.product_id;

        -- Registrar trazabilidad en audit_logs
        INSERT INTO public.audit_logs (
            id,
            inventory_id,
            product_id,
            product_name,
            user_id,
            user_email,
            action_type,
            details,
            metadata,
            created_at
        )
        VALUES (
            gen_random_uuid(),
            p_inventory_id,
            v_item.product_id,
            v_product.name,
            v_effective_user_id,
            v_effective_user_email,
            'ASSIGN',
            'Asignación física de ' || ROUND(v_item.quantity, 2)::text || ' unds a ubicación ' || v_location_name || ' (' || v_location_code || ')',
            jsonb_build_object(
                'location_id', p_location_id,
                'location_code', v_location_code,
                'location_name', v_location_name,
                'quantity_assigned', v_item.quantity,
                'previous_unassigned', v_unassigned_stock,
                'new_unassigned', GREATEST(0, ROUND((v_unassigned_stock - v_item.quantity)::numeric, 4))
            ),
            NOW()
        );

        v_assigned_count := v_assigned_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'assigned_count', v_assigned_count,
        'location_id', p_location_id,
        'location_name', v_location_name
    );
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.assign_product_locations_batch(UUID, UUID, JSONB, UUID, TEXT) TO authenticated, service_role;


-- 2. TRASLADO ENTRE UBICACIONES FÍSICAS (MOVER STOCK)
-- Invocado por: LocationsPage.tsx -> supabase.rpc('move_product_location', ...)
CREATE OR REPLACE FUNCTION public.move_product_location(
    p_inventory_id UUID,
    p_product_id UUID,
    p_from_location_id UUID,
    p_to_location_id UUID,
    p_quantity NUMERIC(12, 4),
    p_reason TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_user_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_effective_user_id UUID;
    v_effective_user_email TEXT;
    v_product_name TEXT;
    v_product_code TEXT;
    v_from_loc_name TEXT;
    v_from_loc_code TEXT;
    v_to_loc_name TEXT;
    v_to_loc_code TEXT;
    v_current_from_stock NUMERIC(12, 4);
    v_new_from_stock NUMERIC(12, 4);
    v_detail_text TEXT;
BEGIN
    -- Validar inventario
    IF NOT EXISTS (SELECT 1 FROM public.inventories WHERE id = p_inventory_id) THEN
        RAISE EXCEPTION 'El inventario especificado no existe.';
    END IF;

    IF auth.uid() IS NOT NULL AND NOT public.has_inventory_access(p_inventory_id) THEN
        RAISE EXCEPTION 'No tienes permiso para operar en este inventario.';
    END IF;

    v_effective_user_id := COALESCE(auth.uid(), p_user_id);
    v_effective_user_email := COALESCE(auth.jwt()->>'email', NULLIF(TRIM(p_user_email), ''), 'usuario@sistema');

    IF v_effective_user_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_effective_user_id) THEN
            v_effective_user_id := NULL;
        END IF;
    END IF;

    -- Validar que origen y destino sean distintos
    IF p_from_location_id = p_to_location_id THEN
        RAISE EXCEPTION 'La ubicación de origen y destino no pueden ser iguales.';
    END IF;

    -- Validar cantidad
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'La cantidad a trasladar debe ser mayor a cero.';
    END IF;

    -- Bloqueo transaccional del producto
    SELECT name, code INTO v_product_name, v_product_code
    FROM public.products
    WHERE id = p_product_id AND inventory_id = p_inventory_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto no existe en este inventario.';
    END IF;

    -- Validar ubicaciones origen y destino
    SELECT name, code INTO v_from_loc_name, v_from_loc_code
    FROM public.locations
    WHERE id = p_from_location_id AND inventory_id = p_inventory_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La ubicación de origen no existe en este inventario.';
    END IF;

    SELECT name, code INTO v_to_loc_name, v_to_loc_code
    FROM public.locations
    WHERE id = p_to_location_id AND inventory_id = p_inventory_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La ubicación de destino no existe en este inventario.';
    END IF;

    -- Validar saldo en ubicación origen
    SELECT quantity INTO v_current_from_stock
    FROM public.product_locations
    WHERE product_id = p_product_id AND location_id = p_from_location_id
    FOR UPDATE;

    IF NOT FOUND OR (v_current_from_stock + 0.0002) < p_quantity THEN
        RAISE EXCEPTION 'Saldo insuficiente en la ubicación de origen "%". Disponible: %, Solicitado: %.',
            v_from_loc_name, COALESCE(ROUND(v_current_from_stock, 4), 0), ROUND(p_quantity, 4);
    END IF;

    v_new_from_stock := GREATEST(0, ROUND((v_current_from_stock - p_quantity)::numeric, 4));

    -- Actualizar saldo en ubicación origen
    UPDATE public.product_locations
    SET quantity = v_new_from_stock,
        updated_at = NOW()
    WHERE product_id = p_product_id AND location_id = p_from_location_id;

    -- Incrementar saldo en ubicación destino
    INSERT INTO public.product_locations (
        inventory_id,
        product_id,
        location_id,
        quantity,
        created_at,
        updated_at
    )
    VALUES (
        p_inventory_id,
        p_product_id,
        p_to_location_id,
        p_quantity,
        NOW(),
        NOW()
    )
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET
        quantity = ROUND((public.product_locations.quantity + EXCLUDED.quantity)::numeric, 4),
        updated_at = NOW();

    -- Actualizar usuario modificador en el producto
    UPDATE public.products
    SET last_modified_by = v_effective_user_id,
        last_modified_by_email = v_effective_user_email,
        updated_at = NOW()
    WHERE id = p_product_id;

    -- Registrar trazabilidad en audit_logs
    v_detail_text := 'Traslado de ' || ROUND(p_quantity, 2)::text || ' unds desde "' || v_from_loc_name || '" hacia "' || v_to_loc_name || '"';
    IF p_reason IS NOT NULL AND TRIM(p_reason) != '' THEN
        v_detail_text := v_detail_text || '. Motivo: ' || TRIM(p_reason);
    END IF;

    INSERT INTO public.audit_logs (
        id,
        inventory_id,
        product_id,
        product_name,
        user_id,
        user_email,
        action_type,
        details,
        metadata,
        created_at
    )
    VALUES (
        gen_random_uuid(),
        p_inventory_id,
        p_product_id,
        v_product_name,
        v_effective_user_id,
        v_effective_user_email,
        'MOVE',
        v_detail_text,
        jsonb_build_object(
            'from_location_id', p_from_location_id,
            'from_location_code', v_from_loc_code,
            'from_location_name', v_from_loc_name,
            'to_location_id', p_to_location_id,
            'to_location_code', v_to_loc_code,
            'to_location_name', v_to_loc_name,
            'quantity', p_quantity,
            'reason', p_reason
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'product_id', p_product_id,
        'from_location_id', p_from_location_id,
        'to_location_id', p_to_location_id,
        'quantity', p_quantity
    );
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.move_product_location(UUID, UUID, UUID, UUID, NUMERIC, TEXT, UUID, TEXT) TO authenticated, service_role;

-- Recargar la caché de esquema de PostgREST en Supabase de forma inmediata
NOTIFY pgrst, 'reload schema';
