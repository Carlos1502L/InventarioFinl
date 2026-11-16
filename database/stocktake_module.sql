-- ==============================================================================
-- MÓDULO DE BARRIDO / CONTEO CÍCLICO / TOMA DE INVENTARIO FÍSICO (STOCKTAKE)
-- Stockly v2 - Fase 1 (Mobile-First < 768px)
-- ==============================================================================

-- 1. TABLA: stocktake_sessions (Sesiones de Conteo Cíclico por Estante)
CREATE TABLE IF NOT EXISTS public.stocktake_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (inventory_id, code)
);

-- 2. TABLA: stocktake_items (Ítems Contados vs Esperados por Sesión)
CREATE TABLE IF NOT EXISTS public.stocktake_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.stocktake_sessions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    expected_qty NUMERIC(12, 4) NOT NULL DEFAULT 0,
    counted_qty NUMERIC(12, 4) NOT NULL DEFAULT 0,
    difference_qty NUMERIC(12, 4) GENERATED ALWAYS AS (counted_qty - expected_qty) STORED,
    unit_cost_snapshot NUMERIC(12, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, product_id)
);

-- 3. TABLA: product_audits (Kardex detallado de ajustes de inventario)
CREATE TABLE IF NOT EXISTS public.product_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    action_type TEXT NOT NULL DEFAULT 'INVENTORY_ADJUSTMENT_CYCLE_COUNT',
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    location_code TEXT,
    valor_anterior NUMERIC(12, 4) NOT NULL DEFAULT 0,
    valor_posterior NUMERIC(12, 4) NOT NULL DEFAULT 0,
    difference_qty NUMERIC(12, 4) NOT NULL DEFAULT 0,
    session_code TEXT,
    reason TEXT DEFAULT 'INVENTORY_ADJUSTMENT_CYCLE_COUNT',
    details TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ACTUALIZACIÓN DE CHECK CONSTRAINT EN audit_logs (Para permitir auditorías por barrido)
DO $$
BEGIN
    ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;
    ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_type_check
        CHECK (action_type IN ('CREATE', 'UPDATE', 'MOVE', 'ASSIGN', 'WITHDRAW', 'RESTOCK', 'DELETE', 'SALE', 'INVENTORY_ADJUSTMENT_CYCLE_COUNT'));
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 5. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_stocktake_sessions_inv ON public.stocktake_sessions(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stocktake_sessions_loc ON public.stocktake_sessions(location_id);
CREATE INDEX IF NOT EXISTS idx_stocktake_sessions_status ON public.stocktake_sessions(status);
CREATE INDEX IF NOT EXISTS idx_stocktake_items_session ON public.stocktake_items(session_id);
CREATE INDEX IF NOT EXISTS idx_stocktake_items_product ON public.stocktake_items(product_id);
CREATE INDEX IF NOT EXISTS idx_product_audits_inv ON public.product_audits(inventory_id);
CREATE INDEX IF NOT EXISTS idx_product_audits_prod ON public.product_audits(product_id);

-- 6. SEGURIDAD Y POLÍTICAS RLS (Row Level Security)
ALTER TABLE public.stocktake_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocktake_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stocktake_sessions_all" ON public.stocktake_sessions;
CREATE POLICY "stocktake_sessions_all" ON public.stocktake_sessions FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

DROP POLICY IF EXISTS "stocktake_items_all" ON public.stocktake_items;
CREATE POLICY "stocktake_items_all" ON public.stocktake_items FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.stocktake_sessions s
        WHERE s.id = stocktake_items.session_id
          AND public.has_inventory_access(s.inventory_id)
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.stocktake_sessions s
        WHERE s.id = stocktake_items.session_id
          AND public.has_inventory_access(s.inventory_id)
    ));

DROP POLICY IF EXISTS "product_audits_all" ON public.product_audits;
CREATE POLICY "product_audits_all" ON public.product_audits FOR ALL TO authenticated
    USING (public.has_inventory_access(inventory_id))
    WITH CHECK (public.has_inventory_access(inventory_id));

GRANT ALL ON public.stocktake_sessions TO authenticated, anon, service_role;
GRANT ALL ON public.stocktake_items TO authenticated, anon, service_role;
GRANT ALL ON public.product_audits TO authenticated, anon, service_role;

-- ==============================================================================
-- 7. FUNCIÓN RPC: create_stocktake_session
-- Inicia una sesión con código correlativo único (ej. BRR-0001)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_stocktake_session(
    p_inventory_id UUID,
    p_location_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_user_email TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code TEXT;
    v_effective_user_id UUID;
    v_session_id UUID;
    v_seq_num INT;
    v_location_name TEXT;
    v_location_code TEXT;
BEGIN
    -- Validar que el inventario exista
    IF NOT EXISTS (SELECT 1 FROM public.inventories WHERE id = p_inventory_id) THEN
        RAISE EXCEPTION 'El inventario especificado no existe.';
    END IF;

    -- Validar permisos de acceso al inventario
    IF auth.uid() IS NOT NULL AND NOT public.has_inventory_access(p_inventory_id) THEN
        RAISE EXCEPTION 'No tienes permiso para operar en este inventario.';
    END IF;

    -- Validar que la ubicación exista en este inventario
    SELECT name, code INTO v_location_name, v_location_code
    FROM public.locations
    WHERE id = p_location_id AND inventory_id = p_inventory_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La ubicación especificada no existe en este inventario.';
    END IF;

    v_effective_user_id := COALESCE(auth.uid(), p_user_id);

    -- Generar código correlativo BRR-XXXX
    SELECT COALESCE(MAX(NULLIF(SUBSTRING(code FROM 5), '')::INTEGER), 0) + 1
    INTO v_seq_num
    FROM public.stocktake_sessions
    WHERE inventory_id = p_inventory_id;

    v_code := 'BRR-' || LPAD(v_seq_num::TEXT, 4, '0');

    -- Insertar sesión
    INSERT INTO public.stocktake_sessions (
        inventory_id,
        location_id,
        code,
        status,
        created_by,
        started_at,
        notes
    ) VALUES (
        p_inventory_id,
        p_location_id,
        v_code,
        'IN_PROGRESS',
        v_effective_user_id,
        NOW(),
        p_notes
    )
    RETURNING id INTO v_session_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session_id,
        'code', v_code,
        'location_id', p_location_id,
        'location_name', v_location_name,
        'location_code', v_location_code,
        'status', 'IN_PROGRESS'
    );
END;
$$;

-- ==============================================================================
-- 8. FUNCIÓN RPC TRANSACCIONAL: commit_stocktake_session
-- Cierre, conciliación, ajuste físico y registro en Kardex
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.commit_stocktake_session(
    p_session_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_user_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_location_name TEXT;
    v_location_code TEXT;
    v_effective_user_id UUID;
    v_effective_user_email TEXT;
    v_unscanned RECORD;
    v_item RECORD;
    v_diff NUMERIC(12, 4);
    v_total_items INT := 0;
    v_adjusted_count INT := 0;
    v_surplus_count INT := 0;
    v_deficit_count INT := 0;
    v_matched_count INT := 0;
    v_total_cost_impact NUMERIC(12, 2) := 0.00;
BEGIN
    -- 1. Validar existencia y estado de la sesión
    SELECT * INTO v_session
    FROM public.stocktake_sessions
    WHERE id = p_session_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La sesión de barrido especificada no existe.';
    END IF;

    IF v_session.status <> 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'La sesión de barrido ya fue cerrada o cancelada previamente (Estado actual: %).', v_session.status;
    END IF;

    -- Validar permisos de acceso al inventario
    IF auth.uid() IS NOT NULL AND NOT public.has_inventory_access(v_session.inventory_id) THEN
        RAISE EXCEPTION 'No tienes permiso para operar en este inventario.';
    END IF;

    v_effective_user_id := COALESCE(auth.uid(), p_user_id);
    v_effective_user_email := COALESCE(auth.jwt()->>'email', NULLIF(TRIM(p_user_email), ''), 'operador@stockly');

    -- Obtener datos de la ubicación
    SELECT name, code INTO v_location_name, v_location_code
    FROM public.locations
    WHERE id = v_session.location_id;

    -- 2. Bloquear con FOR UPDATE los registros de product_locations en esa ubicación
    PERFORM 1
    FROM public.product_locations
    WHERE location_id = v_session.location_id
    FOR UPDATE;

    -- 3. Identificar productos que figuraban en product_locations con stock > 0
    --    pero que NO fueron escaneados en esta sesión (Faltante total en ese estante)
    FOR v_unscanned IN
        SELECT pl.product_id, pl.quantity, COALESCE(p.cost_price, 0) AS cost_price
        FROM public.product_locations pl
        JOIN public.products p ON p.id = pl.product_id
        WHERE pl.location_id = v_session.location_id
          AND pl.quantity > 0
          AND NOT EXISTS (
              SELECT 1 FROM public.stocktake_items si
              WHERE si.session_id = p_session_id
                AND si.product_id = pl.product_id
          )
    LOOP
        INSERT INTO public.stocktake_items (
            session_id,
            product_id,
            expected_qty,
            counted_qty,
            unit_cost_snapshot
        ) VALUES (
            p_session_id,
            v_unscanned.product_id,
            v_unscanned.quantity,
            0,
            v_unscanned.cost_price
        );
    END LOOP;

    -- 4. Actualizar expected_qty y unit_cost_snapshot de todos los productos en stocktake_items
    --    con el stock teórico real de product_locations en ese momento
    UPDATE public.stocktake_items si
    SET expected_qty = COALESCE(pl.quantity, 0),
        unit_cost_snapshot = COALESCE(p.cost_price, 0),
        updated_at = NOW()
    FROM public.products p
    LEFT JOIN public.product_locations pl
        ON pl.product_id = p.id AND pl.location_id = v_session.location_id
    WHERE si.session_id = p_session_id
      AND si.product_id = p.id;

    -- 5. Procesar cada ítem: actualizar product_locations, sincronizar products.stock y auditar
    FOR v_item IN
        SELECT
            si.id,
            si.product_id,
            si.expected_qty,
            si.counted_qty,
            (si.counted_qty - si.expected_qty) AS diff,
            si.unit_cost_snapshot,
            p.name AS product_name,
            p.code AS product_code,
            p.stock AS current_total_stock
        FROM public.stocktake_items si
        JOIN public.products p ON p.id = si.product_id
        WHERE si.session_id = p_session_id
    LOOP
        v_diff := v_item.diff;
        v_total_items := v_total_items + 1;

        -- Actualizar product_locations fijando exactamente counted_qty
        INSERT INTO public.product_locations (
            inventory_id,
            product_id,
            location_id,
            quantity,
            updated_at
        ) VALUES (
            v_session.inventory_id,
            v_item.product_id,
            v_session.location_id,
            v_item.counted_qty,
            NOW()
        )
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
            quantity = EXCLUDED.quantity,
            updated_at = NOW();

        -- Sincronizar stock total en products y registrar auditoría si hubo diferencia
        IF v_diff <> 0 THEN
            UPDATE public.products
            SET stock = GREATEST(0, stock + v_diff),
                last_modified_by = v_effective_user_id,
                last_modified_by_email = v_effective_user_email,
                updated_at = NOW()
            WHERE id = v_item.product_id;

            -- Registrar en audit_logs (Kardex tradicional Stockly)
            INSERT INTO public.audit_logs (
                inventory_id,
                product_id,
                product_name,
                user_id,
                user_email,
                action_type,
                details,
                metadata,
                created_at
            ) VALUES (
                v_session.inventory_id,
                v_item.product_id,
                v_item.product_name,
                v_effective_user_id,
                v_effective_user_email,
                'INVENTORY_ADJUSTMENT_CYCLE_COUNT',
                'Ajuste por Barrido ' || v_session.code || ' en ' || v_location_name || ' (' || v_location_code || '): Esperado ' || ROUND(v_item.expected_qty, 2) || ', Contado ' || ROUND(v_item.counted_qty, 2) || ' (' || CASE WHEN v_diff > 0 THEN '+' ELSE '' END || ROUND(v_diff, 2) || ' unds)',
                jsonb_build_object(
                    'session_id', p_session_id,
                    'session_code', v_session.code,
                    'location_id', v_session.location_id,
                    'location_code', v_location_code,
                    'location_name', v_location_name,
                    'valor_anterior', v_item.expected_qty,
                    'valor_posterior', v_item.counted_qty,
                    'difference_qty', v_diff,
                    'unit_cost', v_item.unit_cost_snapshot,
                    'total_cost_impact', ROUND((v_diff * v_item.unit_cost_snapshot)::numeric, 2),
                    'reason', 'INVENTORY_ADJUSTMENT_CYCLE_COUNT'
                ),
                NOW()
            );

            -- Registrar en product_audits (Requerimiento 2.B.5)
            INSERT INTO public.product_audits (
                inventory_id,
                product_id,
                user_id,
                user_email,
                action_type,
                location_id,
                location_code,
                valor_anterior,
                valor_posterior,
                difference_qty,
                session_code,
                reason,
                details,
                metadata,
                created_at
            ) VALUES (
                v_session.inventory_id,
                v_item.product_id,
                v_effective_user_id,
                v_effective_user_email,
                'INVENTORY_ADJUSTMENT_CYCLE_COUNT',
                v_session.location_id,
                v_location_code,
                v_item.expected_qty,
                v_item.counted_qty,
                v_diff,
                v_session.code,
                'Ajuste por Barrido',
                'Diferencia de ' || ROUND(v_diff, 2)::text || ' unidades en estante ' || v_location_code,
                jsonb_build_object(
                    'session_id', p_session_id,
                    'session_code', v_session.code,
                    'unit_cost', v_item.unit_cost_snapshot
                ),
                NOW()
            );

            v_adjusted_count := v_adjusted_count + 1;
            IF v_diff > 0 THEN
                v_surplus_count := v_surplus_count + 1;
            ELSE
                v_deficit_count := v_deficit_count + 1;
            END IF;

            v_total_cost_impact := v_total_cost_impact + (v_diff * v_item.unit_cost_snapshot);
        ELSE
            v_matched_count := v_matched_count + 1;
        END IF;
    END LOOP;

    -- 6. Marcar sesión como COMPLETED
    UPDATE public.stocktake_sessions
    SET status = 'COMPLETED',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'code', v_session.code,
        'location_id', v_session.location_id,
        'location_name', v_location_name,
        'location_code', v_location_code,
        'total_items', v_total_items,
        'adjusted_count', v_adjusted_count,
        'surplus_count', v_surplus_count,
        'deficit_count', v_deficit_count,
        'matched_count', v_matched_count,
        'total_cost_impact', ROUND(v_total_cost_impact::numeric, 2),
        'completed_at', NOW()
    );
END;
$$;

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.create_stocktake_session(UUID, UUID, UUID, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.commit_stocktake_session(UUID, UUID, TEXT) TO authenticated, anon, service_role;
