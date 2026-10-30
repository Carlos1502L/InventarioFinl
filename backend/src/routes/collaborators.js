import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth, verifyTenantAccess } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  inviteCollaboratorSchema,
  inventoryIdParamSchema,
  removeCollaboratorParamsSchema
} from '../schemas/collaboratorSchemas.js';

const router = express.Router();

/**
 * GET /api/collaborators/:inventory_id
 * Lista los miembros y las invitaciones pendientes de un inventario
 * Protegido contra BOLA: Solo usuarios autorizados del inventario pueden ver colaboradores
 */
router.get(
  '/:inventory_id',
  requireAuth,
  validate(inventoryIdParamSchema, 'params'),
  verifyTenantAccess({ source: 'params', key: 'inventory_id', requiredRole: 'member' }),
  async (req, res, next) => {
    try {
      const { inventory_id } = req.params;

      // Obtener miembros actuales
      const { data: members, error: errMembers } = await supabaseAdmin
        .from('inventory_users')
        .select(`
          id,
          role,
          created_at,
          user_id,
          profiles (
            id,
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('inventory_id', inventory_id);

      if (errMembers) throw errMembers;

      // Obtener invitaciones pendientes
      const { data: invitations, error: errInv } = await supabaseAdmin
        .from('inventory_invitations')
        .select('*')
        .eq('inventory_id', inventory_id)
        .eq('status', 'pending');

      if (errInv) throw errInv;

      res.json({
        success: true,
        members: members || [],
        invitations: invitations || []
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/collaborators/invite
 * Invita a un usuario por correo electrónico a colaborar en el inventario.
 * Restringido estrictamente al PROPIETARIO del inventario.
 */
router.post(
  '/invite',
  requireAuth,
  validate(inviteCollaboratorSchema, 'body'),
  verifyTenantAccess({ source: 'body', key: 'inventory_id', requiredRole: 'owner' }),
  async (req, res, next) => {
    try {
      const { inventory_id, email, role } = req.body;
      const cleanEmail = email.trim().toLowerCase();

      // 1. Verificar si el usuario ya está registrado en la base de datos (profiles)
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingProfile) {
        // Verificar si ya es miembro
        const { data: alreadyMember } = await supabaseAdmin
          .from('inventory_users')
          .select('id')
          .eq('inventory_id', inventory_id)
          .eq('user_id', existingProfile.id)
          .maybeSingle();

        if (alreadyMember) {
          return res.status(400).json({
            success: false,
            code: 'ALREADY_MEMBER',
            message: 'El usuario ya es colaborador de este inventario.',
            timestamp: new Date().toISOString()
          });
        }

        // Añadir directamente a inventory_users
        const { data: newMember, error: errAdd } = await supabaseAdmin
          .from('inventory_users')
          .insert({
            inventory_id,
            user_id: existingProfile.id,
            role
          })
          .select()
          .single();

        if (errAdd) throw errAdd;

        return res.json({
          success: true,
          message: `El usuario ${cleanEmail} ha sido añadido exitosamente como colaborador.`,
          member: newMember,
          status: 'added_directly'
        });
      }

      // 2. Si no está registrado aún, registrar invitación pendiente
      const { data: invitation, error: errInvite } = await supabaseAdmin
        .from('inventory_invitations')
        .upsert(
          {
            inventory_id,
            email: cleanEmail,
            role,
            status: 'pending',
            invited_by: req.user.id
          },
          { onConflict: 'inventory_id, email' }
        )
        .select()
        .single();

      if (errInvite) throw errInvite;

      res.json({
        success: true,
        message: `Invitación enviada para ${cleanEmail}. Se vinculará automáticamente cuando se registre en la aplicación.`,
        invitation,
        status: 'pending_invitation'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/collaborators/:inventory_id/:user_id
 * Remueve a un colaborador del inventario (Restringido a Dueño)
 */
router.delete(
  '/:inventory_id/:user_id',
  requireAuth,
  validate(removeCollaboratorParamsSchema, 'params'),
  verifyTenantAccess({ source: 'params', key: 'inventory_id', requiredRole: 'owner' }),
  async (req, res, next) => {
    try {
      const { inventory_id, user_id } = req.params;

      // El dueño no puede auto-eliminarse de su inventario
      if (req.user.id === user_id) {
        return res.status(400).json({
          success: false,
          code: 'CANNOT_REMOVE_SELF',
          message: 'El dueño no puede ser removido de su propio inventario.',
          timestamp: new Date().toISOString()
        });
      }

      const { error: errDel } = await supabaseAdmin
        .from('inventory_users')
        .delete()
        .eq('inventory_id', inventory_id)
        .eq('user_id', user_id);

      if (errDel) throw errDel;

      res.json({
        success: true,
        message: 'Colaborador removido exitosamente.'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
