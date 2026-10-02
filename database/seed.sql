-- ==============================================================================
-- DATOS DE PRUEBA (SEED DATA PARA INVENTARIO)
-- ==============================================================================
-- Instrucciones:
-- 1. Regístrate en tu app (ej: admin@tuempresa.com).
-- 2. El trigger 'on_auth_user_created' creará automáticamente tu perfil y tu
--    primer inventario 'Mi Inventario Principal' con categorías y ubicaciones base.
-- 3. Si deseas poblar productos de demostración con trazabilidad, copia el UUID
--    de tu usuario (auth.users o profiles) y ejecuta este bloque:

/*
DO $$
DECLARE
    v_user_id UUID := 'REEMPLAZAR_CON_TU_USER_UUID'::UUID;
    v_inventory_id UUID;
    v_cat_elec UUID;
    v_cat_herr UUID;
    v_sub_comp UUID;
    v_sub_aud UUID;
    v_loc_alm UUID;
    v_loc_est UUID;
    v_prod1_id UUID;
    v_prod2_id UUID;
BEGIN
    -- Obtener el inventario principal del usuario
    SELECT id INTO v_inventory_id FROM public.inventories WHERE owner_id = v_user_id LIMIT 1;
    
    -- Si no existiera inventario, crearlo
    IF v_inventory_id IS NULL THEN
        INSERT INTO public.inventories (name, description, owner_id)
        VALUES ('Mi Inventario Principal', 'Inventario demostrativo de existencias', v_user_id)
        RETURNING id INTO v_inventory_id;
        
        INSERT INTO public.inventory_users (inventory_id, user_id, role)
        VALUES (v_inventory_id, v_user_id, 'owner');
    END IF;

    -- Obtener o crear ubicaciones
    SELECT id INTO v_loc_alm FROM public.locations WHERE inventory_id = v_inventory_id AND code = 'LOC-ALM-001' LIMIT 1;
    IF v_loc_alm IS NULL THEN
        INSERT INTO public.locations (inventory_id, name, code, description)
        VALUES (v_inventory_id, 'Almacén Central', 'LOC-ALM-001', 'Depósito principal de mercadería')
        RETURNING id INTO v_loc_alm;
    END IF;

    SELECT id INTO v_loc_est FROM public.locations WHERE inventory_id = v_inventory_id AND code = 'LOC-EST-A01' LIMIT 1;
    IF v_loc_est IS NULL THEN
        INSERT INTO public.locations (inventory_id, name, code, description)
        VALUES (v_inventory_id, 'Estante A (Exhibición)', 'LOC-EST-A01', 'Vitrina frontal de acceso rápido')
        RETURNING id INTO v_loc_est;
    END IF;

    -- Categorías
    SELECT id INTO v_cat_elec FROM public.categories WHERE inventory_id = v_inventory_id AND name = 'Electrónicos' LIMIT 1;
    IF v_cat_elec IS NULL THEN
        INSERT INTO public.categories (inventory_id, name, color, description)
        VALUES (v_inventory_id, 'Electrónicos', '#3B82F6', 'Equipos tecnológicos y periféricos')
        RETURNING id INTO v_cat_elec;
    END IF;

    SELECT id INTO v_sub_comp FROM public.subcategories WHERE category_id = v_cat_elec AND name = 'Cómputo' LIMIT 1;
    IF v_sub_comp IS NULL THEN
        INSERT INTO public.subcategories (inventory_id, category_id, name)
        VALUES (v_inventory_id, v_cat_elec, 'Cómputo')
        RETURNING id INTO v_sub_comp;
    END IF;

    -- Producto 1: Laptop Gamer
    INSERT INTO public.products (
        inventory_id, name, code, description, price, stock, min_stock,
        category_id, subcategory_id, location_id, images, status, last_modified_by, last_modified_by_email
    ) VALUES (
        v_inventory_id,
        'Laptop ThinkPad Pro 16" 32GB RAM',
        '7751000234567',
        'Procesador Intel i7 13va gen, 1TB NVMe, Pantalla IPS 165Hz',
        1450.00,
        12,
        3,
        v_cat_elec,
        v_sub_comp,
        v_loc_alm,
        '["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600"]'::jsonb,
        'ACTIVE',
        v_user_id,
        'admin@tuempresa.com'
    ) RETURNING id INTO v_prod1_id;

    -- Auditoría Producto 1
    INSERT INTO public.audit_logs (inventory_id, product_id, product_name, user_id, user_email, action_type, details)
    VALUES (
        v_inventory_id,
        v_prod1_id,
        'Laptop ThinkPad Pro 16" 32GB RAM',
        v_user_id,
        'admin@tuempresa.com',
        'CREATE',
        'Producto registrado en inventario inicial con 12 unidades en Almacén Central'
    );

    -- Producto 2: Auriculares Inalámbricos (En alerta de bajo stock)
    INSERT INTO public.products (
        inventory_id, name, code, description, price, stock, min_stock,
        category_id, subcategory_id, location_id, images, status, last_modified_by, last_modified_by_email
    ) VALUES (
        v_inventory_id,
        'Auriculares Bluetooth Noise Cancelling',
        '7751000891234',
        'Cancelación activa de ruido, 40h de batería, estuche de carga USB-C',
        89.90,
        2,
        5,
        v_cat_elec,
        v_sub_comp,
        v_loc_est,
        '["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600"]'::jsonb,
        'ACTIVE',
        v_user_id,
        'admin@tuempresa.com'
    ) RETURNING id INTO v_prod2_id;

    -- Auditoría Producto 2
    INSERT INTO public.audit_logs (inventory_id, product_id, product_name, user_id, user_email, action_type, details)
    VALUES (
        v_inventory_id,
        v_prod2_id,
        'Auriculares Bluetooth Noise Cancelling',
        v_user_id,
        'admin@tuempresa.com',
        'CREATE',
        'Producto dado de alta en Estante A con stock de 2 unidades'
    );

END $$;
*/
