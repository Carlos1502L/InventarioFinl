import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth, verifyTenantAccess } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  exportAndSendBackupSchema,
  saveBackupSettingsSchema,
  restoreBackupSchema
} from '../schemas/backupSchemas.js';
import { backupService } from '../services/backupService.js';
import { emailService } from '../services/emailService.js';
import { calculateNextRunDate } from '../services/backupScheduler.js';

const router = express.Router();

/**
 * POST /api/backup/export-and-send
 * Genera el archivo .json con toda la información relacional y lo despacha como adjunto al correo.
 * Restricción estricta: Solo el Propietario (Owner) del inventario.
 */
router.post(
  '/export-and-send',
  requireAuth,
  validate(exportAndSendBackupSchema, 'body'),
  verifyTenantAccess({ source: 'body', key: 'inventory_id', requiredRole: 'owner' }),
  async (req, res, next) => {
    try {
      const { inventory_id, target_email } = req.body;
      const invName = req.inventory?.name || 'Inventario';
      const cleanEmail = target_email.trim().toLowerCase();

      // 1. Extraer los datos relacionales completos
      const payload = await backupService.exportInventoryData(inventory_id);
      const jsonContent = JSON.stringify(payload, null, 2);

      const safeName = invName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `backup_${safeName}_${dateStr}.json`;

      // 2. Enviar por correo con archivo adjunto
      const emailResult = await emailService.sendBackupEmail({
        to: cleanEmail,
        inventoryName: invName,
        jsonContent,
        filename,
        summary: {
          products: payload.data.products?.length || 0,
          locations: payload.data.locations?.length || 0,
          categories: payload.data.categories?.length || 0,
          sales: payload.data.sales?.length || 0
        }
      });

      // 3. Registrar auditoría
      await supabaseAdmin.from('audit_logs').insert({
        inventory_id,
        user_id: req.user.id,
        user_email: req.user.email,
        action: 'BACKUP_EXPORTED_AND_SENT',
        entity_type: 'BACKUP',
        metadata: {
          target_email: cleanEmail,
          filename,
          products_count: payload.data.products?.length || 0,
          sales_count: payload.data.sales?.length || 0,
          email_mode: emailResult.mode
        }
      });

      res.json({
        success: true,
        message: `Respaldo generado y enviado exitosamente a ${cleanEmail}.`,
        filename,
        payload, // Se retorna también para permitir descarga local inmediata si el cliente lo desea
        emailResult
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/backup/settings/:inventory_id
 * Obtiene la configuración de respaldos programados actual del inventario.
 * Restricción: Solo el Propietario (Owner).
 */
router.get(
  '/settings/:inventory_id',
  requireAuth,
  verifyTenantAccess({ source: 'params', key: 'inventory_id', requiredRole: 'owner' }),
  async (req, res, next) => {
    try {
      const { inventory_id } = req.params;

      const { data, error } = await supabaseAdmin
        .from('inventory_backup_settings')
        .select('*')
        .eq('inventory_id', inventory_id)
        .maybeSingle();

      if (error && error.code !== '42P01') {
        throw error;
      }

      res.json({
        success: true,
        settings: data || {
          inventory_id,
          target_email: req.user.email || '',
          is_scheduled: false,
          interval_days: 7,
          execution_time: '02:00:00',
          timezone: 'America/Lima',
          last_run_at: null,
          next_run_at: null
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/backup/settings
 * Guarda o actualiza la configuración de respaldos automáticos programados.
 * Restricción: Solo el Propietario (Owner).
 */
router.post(
  '/settings',
  requireAuth,
  validate(saveBackupSettingsSchema, 'body'),
  verifyTenantAccess({ source: 'body', key: 'inventory_id', requiredRole: 'owner' }),
  async (req, res, next) => {
    try {
      const { inventory_id, target_email, is_scheduled, interval_days, execution_time, timezone } = req.body;
      const cleanEmail = target_email.trim().toLowerCase();

      // Formatear execution_time asegurando formato HH:MM:SS
      const formattedTime = execution_time.length === 5 ? `${execution_time}:00` : execution_time;

      // Calcular la fecha y hora del próximo despacho si está programado
      const nextRunAt = is_scheduled
        ? calculateNextRunDate(interval_days, formattedTime).toISOString()
        : null;

      const payload = {
        inventory_id,
        target_email: cleanEmail,
        is_scheduled,
        interval_days,
        execution_time: formattedTime,
        timezone: timezone || 'America/Lima',
        next_run_at: nextRunAt,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabaseAdmin
        .from('inventory_backup_settings')
        .upsert(payload, { onConflict: 'inventory_id' })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Registrar auditoría
      await supabaseAdmin.from('audit_logs').insert({
        inventory_id,
        user_id: req.user.id,
        user_email: req.user.email,
        action: 'BACKUP_SETTINGS_UPDATED',
        entity_type: 'BACKUP',
        metadata: {
          is_scheduled,
          interval_days,
          execution_time: formattedTime,
          next_run_at: nextRunAt,
          target_email: cleanEmail
        }
      });

      res.json({
        success: true,
        message: 'Configuración de respaldos programados guardada con éxito.',
        settings: data
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/backup/restore
 * Ejecuta la restauración atómica de un archivo de respaldo previo.
 * Restricción estricta: Solo el Propietario (Owner) del inventario.
 */
router.post(
  '/restore',
  requireAuth,
  validate(restoreBackupSchema, 'body'),
  verifyTenantAccess({ source: 'body', key: 'inventory_id', requiredRole: 'owner' }),
  async (req, res, next) => {
    try {
      const { inventory_id, backup_payload } = req.body;

      const result = await backupService.restoreInventoryData(inventory_id, backup_payload, req.user.id);

      res.json({
        success: true,
        message: 'Copia de seguridad restaurada exitosamente en el inventario.',
        result
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
