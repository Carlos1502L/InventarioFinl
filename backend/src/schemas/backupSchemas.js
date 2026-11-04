import { z } from 'zod';

export const exportBackupSchema = z.object({
  inventory_id: z.string().uuid({ message: 'El ID de inventario debe ser un UUID válido.' })
});

export const sendVerificationCodeSchema = z.object({
  inventory_id: z.string().uuid({ message: 'El ID de inventario debe ser un UUID válido.' }),
  email: z.string().email({ message: 'Debe proporcionar un correo electrónico válido.' }).max(255)
});

export const verifyCodeSchema = z.object({
  inventory_id: z.string().uuid({ message: 'El ID de inventario debe ser un UUID válido.' }),
  email: z.string().email({ message: 'Debe proporcionar un correo electrónico válido.' }).max(255),
  code: z.string().regex(/^\d{6}$/, { message: 'El código de verificación debe contener exactamente 6 dígitos numéricos.' })
});

export const exportAndSendBackupSchema = z.object({
  inventory_id: z.string().uuid({ message: 'El ID de inventario debe ser un UUID válido.' }),
  email: z.string().email({ message: 'Debe proporcionar un correo electrónico válido.' }).max(255).optional(),
  target_email: z.string().email({ message: 'Debe proporcionar un correo electrónico de destino válido.' }).max(255).optional(),
  verification_token: z.string().optional()
}).refine((data) => data.email || data.target_email, {
  message: 'Debe proporcionar el correo electrónico de destino (email o target_email).'
});

export const saveBackupSettingsSchema = z.object({
  inventory_id: z.string().uuid({ message: 'El ID de inventario debe ser un UUID válido.' }),
  target_email: z.string().email({ message: 'Debe proporcionar un correo electrónico válido.' }).max(255),
  is_scheduled: z.boolean().default(false),
  interval_days: z.number().int().min(1, { message: 'El intervalo debe ser de al menos 1 día.' }).default(7),
  execution_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, {
    message: 'El formato de hora debe ser HH:MM (24 horas).'
  }).default('02:00:00'),
  timezone: z.string().default('America/Lima')
});

export const restoreBackupSchema = z.object({
  inventory_id: z.string().uuid({ message: 'El ID de inventario debe ser un UUID válido.' }),
  backup_payload: z.object({
    version: z.literal('1.0', {
      errorMap: () => ({ message: 'La versión del archivo de respaldo debe ser exactamente "1.0".' })
    }),
    exported_at: z.string(),
    source_inventory_id: z.string(),
    inventory_metadata: z.record(z.any()).optional().default({}),
    data: z.object({
      categories: z.array(z.any()).default([]),
      locations: z.array(z.any()).default([]),
      products: z.array(z.any()).default([]),
      product_locations: z.array(z.any()).default([]),
      sales: z.array(z.any()).default([]),
      coupons: z.array(z.any()).optional().default([]),
      audit_logs: z.array(z.any()).optional().default([])
    })
  })
});
