import { supabaseAdmin } from '../config/supabase.js';
import { backupService } from './backupService.js';
import { emailService } from './emailService.js';

/**
 * Calcula la próxima fecha de ejecución basada en interval_days y execution_time (HH:MM:SS)
 *
 * @param {number} intervalDays
 * @param {string} executionTime - ej: "02:00:00" o "02:00"
 * @returns {Date}
 */
export function calculateNextRunDate(intervalDays = 7, executionTime = '02:00:00') {
  const parts = executionTime.split(':');
  const hours = parseInt(parts[0] || '2', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  const seconds = parseInt(parts[2] || '0', 10);

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + Math.max(1, intervalDays));
  nextDate.setHours(hours, minutes, seconds, 0);

  return nextDate;
}

/**
 * Procesa las copias de seguridad programadas pendientes en la base de datos
 */
export async function runScheduledBackupsCheck() {
  try {
    const nowIso = new Date().toISOString();

    // Consultar configuraciones activas cuyo next_run_at <= NOW()
    const { data: pendingSettings, error } = await supabaseAdmin
      .from('inventory_backup_settings')
      .select(`
        inventory_id,
        target_email,
        is_scheduled,
        interval_days,
        execution_time,
        timezone,
        next_run_at,
        inventories (
          id,
          name
        )
      `)
      .eq('is_scheduled', true)
      .or(`next_run_at.lte.${nowIso},next_run_at.is.null`);

    if (error) {
      // Si la tabla aún no ha sido migrada, no saturar la consola
      if (error.code === '42P01') return;
      console.error('⚠️ [BackupScheduler] Error consultando respaldos programados:', error.message);
      return;
    }

    if (!pendingSettings || pendingSettings.length === 0) {
      return;
    }

    console.log(`⏱️ [BackupScheduler] Ejecutando ${pendingSettings.length} respaldo(s) programado(s)...`);

    for (const setting of pendingSettings) {
      try {
        const invName = setting.inventories?.name || 'Inventario';
        const safeName = invName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `backup_${safeName}_${dateStr}.json`;

        // 1. Extraer datos
        const payload = await backupService.exportInventoryData(setting.inventory_id);
        const jsonContent = JSON.stringify(payload, null, 2);

        // 2. Despachar correo adjunto
        await emailService.sendBackupEmail({
          to: setting.target_email,
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

        // 3. Recalcular y actualizar próximo run
        const nextRun = calculateNextRunDate(setting.interval_days, setting.execution_time);
        await supabaseAdmin
          .from('inventory_backup_settings')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRun.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('inventory_id', setting.inventory_id);

        console.log(`✅ [BackupScheduler] Respaldo automático completado para ${invName}. Próxima ejecución: ${nextRun.toISOString()}`);
      } catch (itemErr) {
        console.error(`❌ [BackupScheduler] Error procesando inventario ${setting.inventory_id}:`, itemErr);
      }
    }
  } catch (err) {
    console.error('❌ [BackupScheduler] Error en ciclo del scheduler:', err);
  }
}

/**
 * Inicializa el timer en segundo plano para verificar periódicamente
 * la ejecución de respaldos (cada 15 minutos).
 */
export function initBackupScheduler() {
  const INTERVAL_MS = 15 * 60 * 1000; // 15 minutos
  console.log('⏰ [BackupScheduler] Motor de respaldos automáticos iniciado (revisión cada 15 min).');

  // Primera ejecución tras arranque breve (30 seg)
  setTimeout(() => {
    runScheduledBackupsCheck();
  }, 30 * 1000);

  // Intervalo continuo
  setInterval(() => {
    runScheduledBackupsCheck();
  }, INTERVAL_MS);
}
