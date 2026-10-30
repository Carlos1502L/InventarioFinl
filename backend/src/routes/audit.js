import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth, verifyTenantAccess } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createAuditLogSchema, getAuditLogsQuerySchema } from '../schemas/auditSchemas.js';

const router = express.Router();

/**
 * GET /api/audit/:inventory_id
 * Obtiene el historial de auditoría de un inventario con filtros y paginación.
 * Protegido contra BOLA con verifyTenantAccess y validación de query con Zod.
 */
router.get(
  '/:inventory_id',
  requireAuth,
  verifyTenantAccess({ source: 'params', key: 'inventory_id', requiredRole: 'member' }),
  validate(getAuditLogsQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { inventory_id } = req.params;
      const { product_id, action_type, limit, page } = req.query;

      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('inventory_id', inventory_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

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
        total: count || 0,
        page,
        limit
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/audit
 * Inserta un registro de trazabilidad/auditoría.
 * Protegido con esquema Zod y verificación de membresía en el inventario.
 */
router.post(
  '/',
  requireAuth,
  validate(createAuditLogSchema, 'body'),
  verifyTenantAccess({ source: 'body', key: 'inventory_id', requiredRole: 'member' }),
  async (req, res, next) => {
    try {
      const { inventory_id, product_id, product_name, action_type, details, metadata } = req.body;

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

      res.status(201).json({
        success: true,
        log
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
