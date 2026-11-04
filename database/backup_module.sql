-- ==============================================================================
-- MÓDULO DE RESPALDOS: CONFIGURACIÓN PROGRAMADA, DIVISAS Y RESTAURACIÓN ATÓMICA
-- ==============================================================================

-- 0. Columnas de Divisas y Tipo de Cambio en Inventarios (RF-1.1)
ALTER TABLE public.inventories 
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10, 3) NOT NULL DEFAULT 1.000,
  ADD COLUMN IF NOT EXISTS exchange_rate_updated_at TIMESTAMPTZ DEFAULT NOW();

-- 1. Tabla de Configuración de Respaldos Programados
CREATE TABLE IF NOT EXISTS public.inventory_backup_settings (
  inventory_id UUID PRIMARY KEY REFERENCES public.inventories(id) ON DELETE CASCADE,
  target_email TEXT NOT NULL,
  is_scheduled BOOLEAN DEFAULT false,
  interval_days INTEGER DEFAULT 7 CHECK (interval_days >= 1), -- cada cuántos días (ej. 1, 7, 15, o N personalizado)
  execution_time TIME NOT NULL DEFAULT '02:00:00', -- Hora de envío (ej. 02:00 AM)
  timezone TEXT NOT NULL DEFAULT 'America/Lima',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.inventory_backup_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad: Solo el Propietario (Owner) puede consultar o modificar
DROP POLICY IF EXISTS "Owners can view their backup settings" ON public.inventory_backup_settings;
CREATE POLICY "Owners can view their backup settings"
  ON public.inventory_backup_settings
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT owner_id FROM public.inventories WHERE id = inventory_id
    )
  );

DROP POLICY IF EXISTS "Owners can upsert their backup settings" ON public.inventory_backup_settings;
CREATE POLICY "Owners can upsert their backup settings"
  ON public.inventory_backup_settings
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT owner_id FROM public.inventories WHERE id = inventory_id
    )
  );

-- 2. Función Transaccional de Restauración Atómica de Inventario (ID Remapping, Wipe & Restore & Conversión)
CREATE OR REPLACE FUNCTION public.restore_inventory_backup(
  p_inventory_id UUID,
  p_backup_payload JSONB,
  p_currency_conversion JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version TEXT;
  v_owner_id UUID;
  v_current_user UUID;
  v_categories JSONB;
  v_locations JSONB;
  v_products JSONB;
  v_product_locations JSONB;
  v_sales JSONB;
  v_coupons JSONB;
  
  v_elem JSONB;
  v_item JSONB;
  v_new_cat_id UUID;
  v_new_loc_id UUID;
  v_new_prod_id UUID;
  v_new_sale_id UUID;
  v_mapped_cat_id UUID;
  v_mapped_loc_id UUID;
  v_mapped_prod_id UUID;
  v_loc_code TEXT;
  v_prod_code TEXT;
  v_conversion_factor NUMERIC := 1.0;
  
  v_count_cat INT := 0;
  v_count_loc INT := 0;
  v_count_prod INT := 0;
  v_count_pl INT := 0;
  v_count_sales INT := 0;
  v_count_coupons INT := 0;
BEGIN
  -- 1. Validar que el inventario destino existe
  SELECT owner_id INTO v_owner_id FROM public.inventories WHERE id = p_inventory_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'El inventario destino especificado no existe o no tiene propietario válido.';
  END IF;

  -- Validar permisos: Solo el Propietario (Owner) puede restaurar
  v_current_user := auth.uid();
  IF v_current_user IS NOT NULL AND v_current_user != v_owner_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.inventory_users 
      WHERE inventory_id = p_inventory_id 
        AND user_id = v_current_user 
        AND role = 'owner'
    ) THEN
      RAISE EXCEPTION 'Acceso denegado: Solo el Propietario puede restaurar respaldos en este inventario.';
    END IF;
  END IF;

  -- 2. Validar estructura del Payload (RF-1: versión estricta 1.0)
  v_version := p_backup_payload->>'version';
  IF v_version IS NULL OR v_version != '1.0' THEN
    RAISE EXCEPTION 'Versión de respaldo inválida o no soportada: %', COALESCE(v_version, 'desconocida');
  END IF;

  IF p_backup_payload->'data' IS NULL THEN
    RAISE EXCEPTION 'Estructura de datos corrupta: Falta la sección "data".';
  END IF;

  v_categories := COALESCE(p_backup_payload->'data'->'categories', '[]'::jsonb);
  v_locations := COALESCE(p_backup_payload->'data'->'locations', '[]'::jsonb);
  v_products := COALESCE(p_backup_payload->'data'->'products', '[]'::jsonb);
  v_product_locations := COALESCE(p_backup_payload->'data'->'product_locations', '[]'::jsonb);
  v_sales := COALESCE(p_backup_payload->'data'->'sales', '[]'::jsonb);
  v_coupons := COALESCE(p_backup_payload->'data'->'coupons', '[]'::jsonb);

  -- Factor de conversión de divisa si fue activado (RF-3.1)
  IF p_currency_conversion IS NOT NULL 
     AND (p_currency_conversion->>'enabled')::BOOLEAN = true 
     AND (p_currency_conversion->>'rate')::NUMERIC > 0 THEN
    IF p_currency_conversion->>'operation' = 'DIVIDE' THEN
      v_conversion_factor := 1.0 / (p_currency_conversion->>'rate')::NUMERIC;
    ELSE
      v_conversion_factor := (p_currency_conversion->>'rate')::NUMERIC;
    END IF;
  END IF;

  -- RF-4.1: Modo Wipe & Restore (Reemplazo Total Limpio)
  -- Purgar en cascada únicamente los registros asociados al inventario destino
  DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE inventory_id = p_inventory_id);
  DELETE FROM public.sales WHERE inventory_id = p_inventory_id;
  DELETE FROM public.product_locations WHERE inventory_id = p_inventory_id OR product_id IN (SELECT id FROM public.products WHERE inventory_id = p_inventory_id);
  DELETE FROM public.products WHERE inventory_id = p_inventory_id;
  DELETE FROM public.categories WHERE inventory_id = p_inventory_id;
  DELETE FROM public.locations WHERE inventory_id = p_inventory_id;
  DELETE FROM public.coupons WHERE inventory_id = p_inventory_id;

  -- 3. Tablas temporales en memoria para Remapeo Dinámico de Identificadores (RF-2)
  CREATE TEMPORARY TABLE IF NOT EXISTS _restore_cat_map (
    old_id TEXT PRIMARY KEY,
    new_id UUID NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE _restore_cat_map;

  CREATE TEMPORARY TABLE IF NOT EXISTS _restore_loc_map (
    old_id TEXT PRIMARY KEY,
    new_id UUID NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE _restore_loc_map;

  CREATE TEMPORARY TABLE IF NOT EXISTS _restore_prod_map (
    old_id TEXT PRIMARY KEY,
    new_id UUID NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE _restore_prod_map;

  -- 4. Inserción y Remapeo de Categorías
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_categories)
  LOOP
    IF v_elem->>'name' IS NOT NULL AND TRIM(v_elem->>'name') != '' THEN
      v_new_cat_id := gen_random_uuid();
      
      INSERT INTO public.categories (
        id,
        inventory_id,
        name,
        color,
        description,
        created_at,
        updated_at
      )
      VALUES (
        v_new_cat_id,
        p_inventory_id,
        TRIM(v_elem->>'name'),
        COALESCE(v_elem->>'color', '#3B82F6'),
        NULLIF(TRIM(v_elem->>'description'), ''),
        COALESCE((v_elem->>'created_at')::TIMESTAMPTZ, NOW()),
        NOW()
      );

      IF v_elem->>'id' IS NOT NULL THEN
        INSERT INTO _restore_cat_map (old_id, new_id) 
        VALUES (v_elem->>'id', v_new_cat_id)
        ON CONFLICT (old_id) DO UPDATE SET new_id = EXCLUDED.new_id;
      END IF;
      v_count_cat := v_count_cat + 1;
    END IF;
  END LOOP;

  -- 5. Inserción y Remapeo de Ubicaciones
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_locations)
  LOOP
    IF v_elem->>'name' IS NOT NULL AND TRIM(v_elem->>'name') != '' THEN
      v_new_loc_id := gen_random_uuid();
      v_loc_code := COALESCE(NULLIF(TRIM(v_elem->>'code'), ''), NULLIF(TRIM(v_elem->>'qr_code'), ''), 'LOC-' || UPPER(SUBSTRING(v_new_loc_id::text, 1, 6)));

      INSERT INTO public.locations (
        id,
        inventory_id,
        name,
        code,
        description,
        created_at,
        updated_at
      )
      VALUES (
        v_new_loc_id,
        p_inventory_id,
        TRIM(v_elem->>'name'),
        v_loc_code,
        NULLIF(TRIM(v_elem->>'description'), ''),
        COALESCE((v_elem->>'created_at')::TIMESTAMPTZ, NOW()),
        NOW()
      )
      ON CONFLICT (inventory_id, code) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          updated_at = NOW()
      RETURNING id INTO v_new_loc_id;

      IF v_elem->>'id' IS NOT NULL THEN
        INSERT INTO _restore_loc_map (old_id, new_id) 
        VALUES (v_elem->>'id', v_new_loc_id)
        ON CONFLICT (old_id) DO UPDATE SET new_id = EXCLUDED.new_id;
      END IF;
      v_count_loc := v_count_loc + 1;
    END IF;
  END LOOP;

  -- 6. Inserción y Remapeo de Productos
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_products)
  LOOP
    v_new_prod_id := gen_random_uuid();
    v_prod_code := COALESCE(NULLIF(TRIM(v_elem->>'sku'), ''), NULLIF(TRIM(v_elem->>'code'), ''), 'SKU-' || UPPER(SUBSTRING(v_new_prod_id::text, 1, 8)));
    v_mapped_cat_id := NULL;
    v_mapped_loc_id := NULL;

    IF v_elem->>'category_id' IS NOT NULL THEN
      SELECT new_id INTO v_mapped_cat_id FROM _restore_cat_map WHERE old_id = v_elem->>'category_id';
    END IF;

    IF v_elem->>'location_id' IS NOT NULL THEN
      SELECT new_id INTO v_mapped_loc_id FROM _restore_loc_map WHERE old_id = v_elem->>'location_id';
    END IF;

    INSERT INTO public.products (
      id,
      inventory_id,
      name,
      code,
      description,
      price,
      cost_price,
      markup_percentage,
      unit_type,
      units_per_box,
      stock,
      min_stock,
      category_id,
      location_id,
      images,
      status,
      created_at,
      updated_at
    )
    VALUES (
      v_new_prod_id,
      p_inventory_id,
      COALESCE(NULLIF(TRIM(v_elem->>'name'), ''), 'Producto Restaurado'),
      v_prod_code,
      NULLIF(TRIM(v_elem->>'description'), ''),
      ROUND(GREATEST(0.00, COALESCE((v_elem->>'price')::NUMERIC, 0.00)) * v_conversion_factor, 2),
      ROUND(GREATEST(0.00, COALESCE((v_elem->>'cost_price')::NUMERIC, 0.00)) * v_conversion_factor, 2),
      GREATEST(0.00, COALESCE((v_elem->>'markup_percentage')::NUMERIC, 0.00)),
      CASE WHEN v_elem->>'unit_type' = 'BOX' THEN 'BOX' ELSE 'UNIT' END,
      (v_elem->>'units_per_box')::INTEGER,
      GREATEST(0, COALESCE((v_elem->>'stock')::NUMERIC, 0)),
      GREATEST(1, COALESCE((v_elem->>'min_stock_alert')::INTEGER, (v_elem->>'min_stock')::INTEGER, 1)),
      v_mapped_cat_id,
      v_mapped_loc_id,
      COALESCE(v_elem->'images', '[]'::jsonb),
      CASE WHEN (v_elem->>'is_active')::BOOLEAN = false OR v_elem->>'status' = 'INACTIVE' THEN 'INACTIVE' ELSE 'ACTIVE' END,
      COALESCE((v_elem->>'created_at')::TIMESTAMPTZ, NOW()),
      NOW()
    )
    ON CONFLICT (inventory_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        cost_price = EXCLUDED.cost_price,
        markup_percentage = EXCLUDED.markup_percentage,
        unit_type = EXCLUDED.unit_type,
        units_per_box = EXCLUDED.units_per_box,
        stock = EXCLUDED.stock,
        min_stock = EXCLUDED.min_stock,
        category_id = EXCLUDED.category_id,
        location_id = EXCLUDED.location_id,
        images = EXCLUDED.images,
        status = EXCLUDED.status,
        updated_at = NOW()
    RETURNING id INTO v_new_prod_id;

    IF v_elem->>'id' IS NOT NULL THEN
      INSERT INTO _restore_prod_map (old_id, new_id) 
      VALUES (v_elem->>'id', v_new_prod_id)
      ON CONFLICT (old_id) DO UPDATE SET new_id = EXCLUDED.new_id;
    END IF;
    v_count_prod := v_count_prod + 1;
  END LOOP;

  -- 7. Inserción de Stock en Ubicaciones (product_locations)
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_product_locations)
  LOOP
    v_mapped_prod_id := NULL;
    v_mapped_loc_id := NULL;

    IF v_elem->>'product_id' IS NOT NULL THEN
      SELECT new_id INTO v_mapped_prod_id FROM _restore_prod_map WHERE old_id = v_elem->>'product_id';
    END IF;

    IF v_elem->>'location_id' IS NOT NULL THEN
      SELECT new_id INTO v_mapped_loc_id FROM _restore_loc_map WHERE old_id = v_elem->>'location_id';
    END IF;

    IF v_mapped_prod_id IS NOT NULL AND v_mapped_loc_id IS NOT NULL THEN
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
        v_mapped_prod_id,
        v_mapped_loc_id,
        GREATEST(0, COALESCE((v_elem->>'quantity')::NUMERIC, (v_elem->>'quantity_units')::NUMERIC, 0)),
        NOW(),
        NOW()
      )
      ON CONFLICT (product_id, location_id) DO UPDATE
      SET quantity = EXCLUDED.quantity,
          updated_at = NOW();
      v_count_pl := v_count_pl + 1;
    END IF;
  END LOOP;

  -- 8. Inserción de Ventas y Detalle de Comprobantes
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_sales)
  LOOP
    v_new_sale_id := gen_random_uuid();
    
    INSERT INTO public.sales (
      id,
      inventory_id,
      seller_email,
      total_amount,
      payment_method,
      customer_name,
      customer_contact,
      notes,
      created_at
    )
    VALUES (
      v_new_sale_id,
      p_inventory_id,
      COALESCE(v_elem->>'seller_email', 'backup_restored@system.local'),
      ROUND(GREATEST(0.00, COALESCE((v_elem->>'total_amount')::NUMERIC, 0.00)) * v_conversion_factor, 2),
      COALESCE(v_elem->>'payment_method', 'OTHER'),
      v_elem->>'customer_name',
      v_elem->>'customer_contact',
      v_elem->>'notes',
      COALESCE((v_elem->>'created_at')::TIMESTAMPTZ, NOW())
    );

    IF v_elem->'items' IS NOT NULL AND jsonb_array_length(v_elem->'items') > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_elem->'items')
      LOOP
        v_mapped_prod_id := NULL;
        IF v_item->>'product_id' IS NOT NULL THEN
          SELECT new_id INTO v_mapped_prod_id FROM _restore_prod_map WHERE old_id = v_item->>'product_id';
        END IF;

        INSERT INTO public.sale_items (
          id,
          sale_id,
          product_id,
          product_name,
          product_code,
          quantity,
          unit_price,
          cost_price,
          subtotal,
          created_at
        )
        VALUES (
          gen_random_uuid(),
          v_new_sale_id,
          v_mapped_prod_id,
          COALESCE(v_item->>'product_name', 'Producto Restaurado'),
          COALESCE(v_item->>'product_code', 'SKU-RESTORED'),
          GREATEST(1, COALESCE((v_item->>'quantity')::NUMERIC, (v_item->>'quantity_units')::NUMERIC, 1)),
          ROUND(GREATEST(0.00, COALESCE((v_item->>'unit_price')::NUMERIC, 0.00)) * v_conversion_factor, 2),
          ROUND(GREATEST(0.00, COALESCE((v_item->>'cost_price')::NUMERIC, 0.00)) * v_conversion_factor, 2),
          ROUND(GREATEST(0.00, COALESCE((v_item->>'subtotal')::NUMERIC, (v_item->>'unit_price')::NUMERIC * COALESCE((v_item->>'quantity')::NUMERIC, 1))) * v_conversion_factor, 2),
          COALESCE((v_elem->>'created_at')::TIMESTAMPTZ, NOW())
        );
      END LOOP;
    END IF;

    v_count_sales := v_count_sales + 1;
  END LOOP;
          COALESCE((v_elem->>'created_at')::TIMESTAMPTZ, NOW())
        );
      END LOOP;
    END IF;

    v_count_sales := v_count_sales + 1;
  END LOOP;

  -- 9. Cupones
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_coupons)
  LOOP
    IF v_elem->>'code' IS NOT NULL AND TRIM(v_elem->>'code') != '' THEN
      INSERT INTO public.coupons (
        inventory_id,
        code,
        discount_type,
        discount_value,
        status,
        description,
        created_at,
        updated_at
      )
      VALUES (
        p_inventory_id,
        UPPER(TRIM(v_elem->>'code')),
        COALESCE(v_elem->>'discount_type', 'PERCENTAGE'),
        GREATEST(0.00, COALESCE((v_elem->>'discount_value')::NUMERIC, 0.00)),
        CASE WHEN (v_elem->>'is_active')::BOOLEAN = false OR v_elem->>'status' = 'INACTIVE' THEN 'INACTIVE' ELSE 'ACTIVE' END,
        v_elem->>'description',
        COALESCE((v_elem->>'created_at')::TIMESTAMPTZ, NOW()),
        NOW()
      )
      ON CONFLICT (inventory_id, code) DO UPDATE
      SET discount_type = EXCLUDED.discount_type,
          discount_value = EXCLUDED.discount_value,
          status = EXCLUDED.status,
          updated_at = NOW();
      v_count_coupons := v_count_coupons + 1;
    END IF;
  END LOOP;

  -- 10. Validación de Integridad (RF-3): Prohibido falso positivo si venían productos
  IF jsonb_array_length(v_products) > 0 AND v_count_prod = 0 THEN
    RAISE EXCEPTION 'Fallo de integridad: No se pudo restaurar ningún producto del respaldo.';
  END IF;

  -- 11. Auditoría
  INSERT INTO public.audit_logs (
    id,
    inventory_id,
    user_id,
    user_email,
    action_type,
    details,
    metadata
  )
  VALUES (
    gen_random_uuid(),
    p_inventory_id,
    v_current_user,
    'backup_system',
    'UPDATE',
    FORMAT('Copia de seguridad restaurada exitosamente (%s productos, %s categorías, %s ubicaciones)', v_count_prod, v_count_cat, v_count_loc),
    jsonb_build_object(
      'version', v_version,
      'exported_at', p_backup_payload->>'exported_at',
      'restored_categories', v_count_cat,
      'restored_locations', v_count_loc,
      'restored_products', v_count_prod,
      'restored_product_locations', v_count_pl,
      'restored_sales', v_count_sales,
      'restored_coupons', v_count_coupons
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Restauración atómica y desvinculada completada exitosamente.',
    'restored_counts', jsonb_build_object(
      'categories', v_count_cat,
      'locations', v_count_loc,
      'products', v_count_prod,
      'product_locations', v_count_pl,
      'sales', v_count_sales,
      'coupons', v_count_coupons
    )
  );
END;
$$;

-- ==============================================================================
-- 3. Función Transaccional para Recalcular Precios por Tipo de Cambio (RF-1.2)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_inventory_prices(
  p_inventory_id UUID,
  p_new_rate NUMERIC,
  p_user_id UUID DEFAULT NULL,
  p_new_currency TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_rate NUMERIC;
  v_prev_currency TEXT;
  v_ratio NUMERIC;
  v_updated_count INT := 0;
BEGIN
  -- 1. Obtener la tasa y moneda previas del inventario
  SELECT exchange_rate, currency 
  INTO v_prev_rate, v_prev_currency
  FROM public.inventories
  WHERE id = p_inventory_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventario % no encontrado.', p_inventory_id;
  END IF;

  v_prev_rate := COALESCE(NULLIF(v_prev_rate, 0), 1.000);
  p_new_rate := COALESCE(NULLIF(p_new_rate, 0), 1.000);

  -- Factor de conversión: (Nueva Tasa / Tasa Anterior)
  v_ratio := p_new_rate / v_prev_rate;

  -- 2. Recalcular precios de venta y costos de productos activos en el inventario destino
  UPDATE public.products
  SET 
    price = ROUND(price * v_ratio, 2),
    cost_price = ROUND(cost_price * v_ratio, 2),
    updated_at = NOW()
  WHERE inventory_id = p_inventory_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- 3. Actualizar la tasa y moneda en inventories
  UPDATE public.inventories
  SET 
    exchange_rate = p_new_rate,
    currency = COALESCE(NULLIF(p_new_currency, ''), currency),
    exchange_rate_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_inventory_id;

  -- 4. Registrar en audit_logs
  INSERT INTO public.audit_logs (
    id,
    inventory_id,
    user_id,
    user_email,
    action_type,
    details,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    p_inventory_id,
    p_user_id,
    'currency_system',
    'BULK_PRICE_CURRENCY_UPDATE',
    FORMAT('Ajuste masivo de precios por tipo de cambio de %s a %s (%s). %s productos actualizados.', 
           ROUND(v_prev_rate, 3), ROUND(p_new_rate, 3), COALESCE(p_new_currency, v_prev_currency), v_updated_count),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'updated_products', v_updated_count,
    'previous_rate', v_prev_rate,
    'new_rate', p_new_rate,
    'currency', COALESCE(p_new_currency, v_prev_currency),
    'ratio', v_ratio
  );
END;
$$;
