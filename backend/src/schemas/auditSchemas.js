import { z } from 'zod';

export const createAuditLogSchema = z.object({
  inventory_id: z.string().uuid({ message: 'inventory_id debe ser un UUID válido.' }),
  action_type: z.string().min(1, 'action_type es requerido.').max(50, 'action_type excede los 50 caracteres.'),
  details: z.string().min(1, 'details es requerido.').max(2000, 'details no puede exceder 2000 caracteres.'),
  product_id: z.string().uuid({ message: 'product_id debe ser un UUID válido.' }).optional().nullable(),
  product_name: z.string().max(255).optional().nullable(),
  metadata: z.record(z.any()).optional().default({})
});

export const getAuditLogsQuerySchema = z.object({
  product_id: z.string().uuid({ message: 'product_id debe ser un UUID válido.' }).optional(),
  action_type: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(1).default(1)
});
