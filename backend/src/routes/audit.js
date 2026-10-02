import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

/**
 * GET /api/audit/:inventory_id
 * Obtiene el historial de auditoría de un inventario con filtros
 */
router.get('/:inventory_id', requireAuth, async (req, res) => {
  try {
    const { inventory_id } = req.params;
    const { product_id, action_type, limit = 50, page = 1 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('inventory_id', inventory_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (product_id) {
      query = query.eq('product_id', product_id);
    }

    if (action_type) {
      query = query.eq('action_type', action_type);
    }

    const { data: logs, count, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      logs: logs || [],
      total: count,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    console.error('Error obteniendo registros de auditoría:', error);
    res.status(500).json({ error: 'Error al consultar logs de auditoría: ' + error.message });
  }
});

/**
 * POST /api/audit
 * Inserta un registro de trazabilidad/auditoría
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { inventory_id, product_id, product_name, action_type, details, metadata } = req.body;

    if (!inventory_id || !action_type || !details) {
      return res.status(400).json({
        error: 'Los campos inventory_id, action_type y details son obligatorios.'
      });
    }

    const { data: log, error } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        inventory_id,
        product_id: product_id || null,
        product_name: product_name || null,
        user_id: req.user.id,
        user_email: req.user.email,
        action_type,
        details,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({ success: true, log });
  } catch (error) {
    console.error('Error insertando registro de auditoría:', error);
    res.status(500).json({ error: 'Error al guardar log de auditoría: ' + error.message });
  }
});

export default router;
