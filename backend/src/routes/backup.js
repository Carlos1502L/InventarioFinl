import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth, verifyTenantAccess } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  exportBackupSchema,
  exportAndSendBackupSchema,
  saveBackupSettingsSchema,
  restoreBackupSchema,
  sendVerificationCodeSchema,
  verifyCodeSchema
} from '../schemas/backupSchemas.js';
import { backupService } from '../services/backupService.js';
import { emailService } from '../services/emailService.js';
import { otpService } from '../services/otpService.js';
import { calculateNextRunDate } from '../services/backupScheduler.js';

const router = express.Router();

/**
 * POST /api/backup/send-verification-code
 * Envía un código OTP numérico de 6 dígitos al correo destino con expiración de 10 minutos.
 * Restricción estricta: Solo el Propietario (Owner) del inventario.
 */
router.post(
  '/send-verification-code',
  requireAuth,
  validate(sendVerificationCodeSchema, 'body'),
  verifyTenantAccess({ source: 'body', key: 'inventory_id', requiredRole: 'owner' }),
  async (req, res, next) => {
    try {
      const { inventory_id, email } = req.body;
      const invName = req.inventory?.name || 'Inventario';
      const cleanEmail = email.trim().toLowerCase();

      // Generar código OTP de 6 dígitos criptográficamente seguro
      const code = otpService.generateOtp(inventory_id, cleanEmail);

      // Enviar el código al correo mediante emailService
      const emailResult = await emailService.sendOtpEmail({
        to: cleanEmail,
        code,
        inventoryName: invName
      });

      if (!emailResult.success) {
        return res.status(500).json({
          success: false,
          code: 'EMAIL_SEND_FAILED',
          message: emailResult.error || 'No se pudo enviar el código de verificación por correo.',
          emailResult
        });
      }

      return res.json({
        success: true,
        message: `Código de verificación de 6 dígitos enviado exitosamente a ${cleanEmail}.`
      });
    } catch (err) {
      console.error('❌ [send-verification-code] Error despachando OTP:', err);
      return res.status(500).json({
        success: false,
        code: 'OTP_DISPATCH_ERROR',
        message: err.message || 'Error al enviar el código de verificación.',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/backup/verify-code
 * Valida el código OTP de 6 dígitos y emite un token de verificación firmado.
 * Restricción estricta: Solo el Propietario (Owner) del inventario.
 */
router.post(
  '/verify-code',
  requireAuth,
  validate(verifyCodeSchema, 'body'),
  verifyTenantAccess({ source: 'body', key: 'inventory_id', requiredRole: 'owner' }),
  async (req, res, next) => {
    try {
      const { inventory_id, email, code } = req.body;
      const cleanEmail = email.trim().toLowerCase();

      const result = otpService.verifyOtp(inventory_id, cleanEmail, code);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_OR_EXPIRED_CODE',
          message: result.message
        });
      }

      return res.json({
        success: true,
        verified_email: cleanEmail,
        verification_token: result.verification_token,
        message: 'Correo verificado exitosamente.'
      });
    } catch (err) {
      console.error('❌ [verify-code] Error validando OTP:', err);
      return res.status(500).json({
        success: false,
        code: 'OTP_VERIFICATION_ERROR',
        message: err.message || 'Error al validar el código de verificación.',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/backup/export
 * Genera y descarga el archivo .json localmente en el cliente sin enviar ningún correo electrónico.
 * Restricción estricta: Solo el Propietario (Owner) del inventario.
 */
router.post(
  '/export',
  requireAuth,
  validate(exportBackupSchema, 'body'),
  verifyTenantAccess({ source: 'body', key: 'inventory_id', requiredRole: 'owner' }),
  async (req, res, next) => {
    // Extender timeout HTTP en Express a 3 minutos para prevenir cortes por red
    req.setTimeout(180000);
    res.setTimeout(180000);

    try {
      const { inventory_id } = req.body;
      const invName = req.inventory?.name || 'Inventario';

      // 1. Extraer los datos relacionales completos (100% SELECT paralelo - RF-1 y RF-3)
      const payload = await backupService.exportInventoryData(inventory_id);

      const safeName = invName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `backup_${safeName}_${dateStr}.json`;

      // 2. Registrar auditoría con esquema correcto (no bloqueante)
      try {
        await supabaseAdmin.from('audit_logs').insert({
          inventory_id,
          user_id: req.user?.id || null,
          user_email: req.user?.email || 'propietario',
          action_type: 'CREATE',
          details: `Copia de seguridad descargada directamente (${filename})`,
          metadata: {
            filename,
            products_count: payload.data.products?.length || 0,
            sales_count: payload.data.sales?.length || 0,
            download_only: true
          }
        });
      } catch (auditErr) {
        console.warn('⚠️ [export] No se pudo registrar auditoría:', auditErr.message);
      }

      return res.json({
        success: true,
        message: 'Copia de seguridad exportada exitosamente.',
        filename,
        payload
      });
    } catch (err) {
      console.error('❌ [export] Error fatal exportando respaldo:', err);
      return res.status(500).json({
        success: false,
        code: 'BACKUP_EXPORT_ERROR',
        message: err.message || 'Error al exportar la copia de seguridad.',
        timestamp: new Date().toISOString()
      });
    }
  }
);

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
    // Extender timeout HTTP en Express a 3 minutos
    req.setTimeout(180000);
    res.setTimeout(180000);

    try {
      const { inventory_id, verification_token } = req.body;
      const cleanEmail = (req.body.email || req.body.target_email || '').trim().toLowerCase();
      const invName = req.inventory?.name || 'Inventario';

      // Validación estricta del token de verificación OTP (RF-4)
      const tokenCheck = otpService.verifyToken(inventory_id, cleanEmail, verification_token);
      if (!tokenCheck.valid) {
        return res.status(403).json({
          success: false,
          code: 'OTP_VERIFICATION_REQUIRED',
          message: tokenCheck.error || 'Se requiere validación previa del correo mediante código OTP.'
        });
      }

      // 1. Extraer los datos relacionales completos (100% SELECT paralelo - RF-1 y RF-3)
      const payload = await backupService.exportInventoryData(inventory_id);
      const jsonContent = JSON.stringify(payload, null, 2);

      const safeName = invName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `backup_${safeName}_${dateStr}.json`;

      // 2. Enviar por correo con archivo adjunto
      let emailResult = { success: false, mode: 'unknown' };
      try {
        emailResult = await emailService.sendBackupEmail({
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
      } catch (mailErr) {
        console.error('❌ [export-and-send] Error enviando correo:', mailErr);
        emailResult = {
          success: false,
          error: mailErr.message,
          mode: 'error'
        };
      }

      // 3. Registrar auditoría con esquema correcto (no bloqueante)
      try {
        await supabaseAdmin.from('audit_logs').insert({
          inventory_id,
          user_id: req.user?.id || null,
          user_email: req.user?.email || cleanEmail,
          action_type: 'CREATE',
          details: `Copia de seguridad exportada y enviada a ${cleanEmail}`,
          metadata: {
            target_email: cleanEmail,
            filename,
            products_count: payload.data.products?.length || 0,
            sales_count: payload.data.sales?.length || 0,
            email_mode: emailResult?.mode || 'none'
          }
        });
      } catch (auditErr) {
        console.warn('⚠️ [export-and-send] No se pudo registrar auditoría:', auditErr.message);
      }

      // RF-2 Estricto: "Generar y Enviar" NO retorna payload ni causa descargas en el cliente
      return res.json({
        success: true,
        emailSent: Boolean(emailResult.success),
        message: emailResult.success
          ? `Respaldo enviado exitosamente a ${cleanEmail}.`
          : `Aviso de correo: ${emailResult.error || 'No se pudo enviar el correo'}`,
        emailResult
      });
    } catch (err) {
      console.error('❌ [export-and-send] Error fatal exportando respaldo:', err);
      return res.status(500).json({
        success: false,
        code: 'BACKUP_EXPORT_ERROR',
        message: err.message || 'Error al exportar la copia de seguridad.',
        timestamp: new Date().toISOString()
      });
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
      console.error('❌ Error restaurando backup:', err);
      return res.status(err.statusCode || 400).json({
        success: false,
        code: 'RESTORE_ERROR',
        message: err.message || 'Error al restaurar los datos del inventario.',
        timestamp: new Date().toISOString()
      });
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
        if (error.code === '42P01') {
          return res.status(400).json({
            success: false,
            code: 'TABLE_NOT_FOUND',
            message: 'La tabla inventory_backup_settings no existe en la base de datos. Por favor ejecuta el script backup_module.sql en Supabase.',
            timestamp: new Date().toISOString()
          });
        }
        throw error;
      }

      // Registrar auditoría con esquema correcto (no bloqueante)
      try {
        await supabaseAdmin.from('audit_logs').insert({
          inventory_id,
          user_id: req.user?.id || null,
          user_email: req.user?.email || cleanEmail,
          action_type: 'UPDATE',
          details: `Configuración de respaldos programados actualizada (${cleanEmail})`,
          metadata: {
            is_scheduled,
            interval_days,
            execution_time: formattedTime,
            next_run_at: nextRunAt,
            target_email: cleanEmail
          }
        });
      } catch (auditErr) {
        console.warn('⚠️ No se pudo registrar auditoría de settings:', auditErr.message);
      }

      res.json({
        success: true,
        message: 'Configuración de respaldos programados guardada con éxito.',
        settings: data
      });
    } catch (err) {
      console.error('❌ Error restaurando backup:', err);
      return res.status(err.statusCode || 400).json({
        success: false,
        code: 'RESTORE_ERROR',
        message: err.message || 'Error al restaurar los datos del inventario.',
        timestamp: new Date().toISOString()
      });
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
      console.error('❌ Error restaurando backup:', err);
      return res.status(err.statusCode || 400).json({
        success: false,
        code: 'RESTORE_ERROR',
        message: err.message || 'Error al restaurar los datos del inventario.',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;
