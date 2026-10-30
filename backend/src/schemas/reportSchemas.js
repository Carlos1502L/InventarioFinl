import { z } from 'zod';

export const reportQuerySchema = z.object({
  inventory_id: z.string().uuid({ message: 'inventory_id debe ser un UUID válido.' }),
  category_id: z.string().uuid({ message: 'category_id debe ser un UUID válido.' }).optional(),
  location_id: z.string().uuid({ message: 'location_id debe ser un UUID válido.' }).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'ARCHIVED']).optional()
});
