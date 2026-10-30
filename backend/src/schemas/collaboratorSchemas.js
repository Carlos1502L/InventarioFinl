import { z } from 'zod';

export const inviteCollaboratorSchema = z.object({
  inventory_id: z.string().uuid({ message: 'inventory_id debe ser un UUID válido.' }),
  email: z.string().email({ message: 'Debe proporcionar un correo electrónico válido.' }).max(255),
  role: z.enum(['collaborator', 'owner']).default('collaborator')
});

export const inventoryIdParamSchema = z.object({
  inventory_id: z.string().uuid({ message: 'inventory_id debe ser un UUID válido.' })
});

export const removeCollaboratorParamsSchema = z.object({
  inventory_id: z.string().uuid({ message: 'inventory_id debe ser un UUID válido.' }),
  user_id: z.string().uuid({ message: 'user_id debe ser un UUID válido.' })
});
