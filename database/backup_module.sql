-- ==============================================================================
-- MÓDULO DE RESPALDOS: CONFIGURACIÓN PROGRAMADA Y RESTAURACIÓN ATÓMICA
-- ==============================================================================

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

-- 2. Función Transaccional de Restauración Atómica de Inventario
CREATE OR REPLACE FUNCTION public.restore_inventory_backup(
  p_inventory_id UUID,
  p_backup_payload JSONB
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
  v_audit_logs JSONB;
  
  v_elem JSONB;
  v_item JSONB;
  v_sale_id UUID;
  v_count_cat INT := 0;
  v_count_loc INT := 0;
  v_count_prod INT := 0;
  v_count_pl INT := 0;
  v_count_sales INT := 0;
  v_count_coupons INT := 0;
  v_count_audit INT := 0;
BEGIN
  -- 1. Validar que el usuario que ejecuta la función sea el Propietario del inventario
  v_current_user := auth.uid();
  SELECT owner_id INTO v_owner_id FROM public.inventories WHERE id = p_inventory_id;
  
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'El inventario especificado no existe o no tiene propietario válido.';
  END IF;

  -- Si se ejecuta desde sesión autenticada de Supabase (no service role), exigir que sea el owner
  IF v_current_user IS NOT NULL AND v_current_user != v_owner_id THEN
    RAISE EXCEPTION 'Acceso denegado: Solo el Propietario puede restaurar respaldos en este inventario.';
  END IF;

  -- 2. Validar estructura del Payload
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
  v_audit_logs := COALESCE(p_backup_payload->'data'->'audit_logs', '[]'::jsonb);

  -- 3. Inserción / Sincronización en orden estricto de precedencia relacional

  -- A. Categorías
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_categories)
  LOOP
    INSERT INTO public.categories (id, inventory_id, name, created_at)
    VALUES (
      (v_elem->>'id')::UUID,
      p_inventory_id,
      v_elem->>'name',
      COALESCE((v_elem->>'created_at')::TIMESTAMPTZ, NOW())
    )
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        inventory_id = EXCLUDED.inventory_id;
    v_count_cat := v_count_cat + 1;
  END LOOP;

  -- B. Ubicaciones
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_locations)
  LOOP
    INSERT INTO public.locations (id, inventory_id, name, code, description, created_at)
    VALUES (
      (v_elem->>'id')::UUID,
      p_inventory_id,
      v_elem->>'name',
      COALESCE(v_elem->>'code', 'LOC-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6))),
      v_elem->>'description',
      COALESCE((v_elem->>'created_at')::TIMESTAMPTZ, NOW())
    )
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        code = EXCLUDED.code,
        description = EXCLUDED.description,
        inventory_id = EXCLUDED.inventory_id;
    v_count_loc := v_count_loc + 1;
  END LOOP;

  -- C. Productos
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_products)
  LOOP
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
      images,
      status,
      created_at,
      updated_at
    )
    VALUES (
      (v_elem->>'id')::UUID,
      p_inventory_id,
      v_elem->>'name',
      COALESCE(v_elem->>'sku', v_elem->>'code', 'SKU-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6))),
      v_elem->>'description',
      COALESCE((v_elem->>'price')::NUMERIC, 0.00),
      COALESCE((v_elem->>'cost_price')::NUMERIC, 0.00),
      COALESCE((v_elem->>'markup_percentage')::NUMERIC, 0.00),
      COALESCE(v_elem->>'unit_type', 'UNIT'),
      (v_elem->>'units_per_box')::INTEGER,
      COALESCE((v_elem->>'stock')::NUMERIC, 0),
      COALESCE((v_elem->>'min_stock_alert')::INTEGER, (v_elem->>'min_stock')::INTEGER, 1),
      (v_elem->>'category_id')::UUID,
      COALESCE(v_elem->'images', '[]'::jsonb),
      CASE WHEN (v_elem->>'is_active')::BOOLEAN = false THEN 'INACTIVE' ELSE 'ACTIVE' END,
      COALESCE((v_elem->>'created_at')::TIMESTAMPTZ, NOW()),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        code = EXCLUDED.code,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        cost_price = EXCLUDED.cost_price,
        markup_percentage = EXCLUDED.markup_percentage,
        unit_type = EXCLUDED.unit_type,
        units_per_box = EXCLUDED.units_per_box,
        stock = EXCLUDED.stock,
        min_stock = EXCLUDED.min_stock,
        category_id = EXCLUDED.category_id,
        images = EXCLUDED.images,
        status = EXCLUDED.status,
        inventory_id = EXCLUDED.inventory_id,
        updated_at = NOW();
    v_count_prod := v_count_prod + 1;
  END LOOP;

  -- D. Relación Stock - Ubicación (product_locations)
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_product_locations)
  LOOP
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
      (v_elem->>'product_id')::UUID,
      (v_elem->>'location_id')::UUID,
      COALESCE((v_elem->>'quantity')::NUMERIC, (v_elem->>'quantity_units')::NUMERIC, 0),
      NOW(),
      NOW()
    )
    ON CONFLICT (product_id, location_id) DO UPDATE
    SET quantity = EXCLUDED.quantity,
        updated_at = NOW();
    v_count_pl := v_count_pl + 1;
  END LOOP;

  -- E. Ventas y Detalle de Comprobantes
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_sales)
  LOOP
    v_sale_id := (v_elem->>'id')::UUID;
    
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
      v_sale_id,
      p_inventory_id,
      COALESCE(v_elem->>'seller_email', 'backup_restored@system.local'),
      COALESCE((v_elem->>'total_amount')::NUMERIC, 0.00),
      COALESCE(v_elem->>'payment_method', 'OTHER'),
      v_elem->>'customer_name',
      v_elem->>'customer_contact',
      v_elem->>'notes',
      COALESCE((v_elem->>'created_at')::TIMESTAMPTZ, NOW())
    )
    ON CONFLICT (id) DO UPDATE
    SET total_amount = EXCLUDED.total_amount,
        payment_method = EXCLUDED.payment_method,
        customer_name = EXCLUDED.customer_name,
        notes = EXCLUDED.notes;

    -- Detalle de items de venta
    IF v_elem->'items' IS NOT NULL AND jsonb_array_length(v_elem->'items') > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_elem->'items')
      LOOP
        INSERT INTO public.sale_items (
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
          v_sale_id,
          (v_item->>'product_id')::UUID,
          COALESCE(v_item->>'product_name', 'Producto Restaurado'),
          COALESCE(v_item->>'product_code', 'SKU-RESTORED'),
          COALESCE((v_item->>'quantity')::NUMERIC, (v_item->>'quantity_units')::NUMERIC, 1),
          COALESCE((v_item->>'unit_price')::NUMERIC, 0.00),
          COALESCE((v_item->>'cost_price')::NUMERIC, 0.00),
          COALESCE((v_item->>'subtotal')::NUMERIC, (v_item->>'unit_price')::NUMERIC * COALESCE((v_item->>'quantity')::NUMERIC, 1)),
          COALESCE((v_elem->>'created_at')::TIMESTAMPTZ, NOW())
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    v_count_sales := v_count_sales + 1;
  END LOOP;

  -- F. Cupones
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_coupons)
  LOOP
    INSERT INTO public.coupons (
      inventory_id,
      code,
      discount_type,
      discount_value,
      max_uses,
      current_uses,
      is_active,
      expires_at,
      created_at
    )
    VALUES (
      p_inventory_id,
      v_elem->>'code',
      COALESCE(v_elem->>'discount_type', 'PERCENTAGE'),
      COALESCE((v_elem->>'discount_value')::NUMERIC, 0),
      (v_elem->>'max_uses')::INTEGER,
      COALESCE((v_elem->>'current_uses')::INTEGER, 0),
      COALESCE((v_elem->>'is_active')::BOOLEAN, true),
      (v_elem->>'expires_at')::TIMESTAMPTZ,
      COALESCE((v_elem->>'created_at')::TIMESTAMPTZ, NOW())
    )
    ON CONFLICT (inventory_id, code) DO UPDATE
    SET discount_type = EXCLUDED.discount_type,
        discount_value = EXCLUDED.discount_value,
        is_active = EXCLUDED.is_active;
    v_count_coupons := v_count_coupons + 1;
  END LOOP;

  -- G. Registro de Auditoría de la Restauración
  INSERT INTO public.audit_logs (
    inventory_id,
    user_id,
    user_email,
    action,
    entity_type,
    metadata
  )
  VALUES (
    p_inventory_id,
    v_current_user,
    'backup_system',
    'BACKUP_RESTORED',
    'BACKUP',
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
    'message', 'Restauración atómica completada exitosamente.',
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
