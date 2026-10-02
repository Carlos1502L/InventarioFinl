import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

/**
 * GET /api/collaborators/:inventory_id
 * Lista los miembros y las invitaciones pendientes de un inventario
 */
router.get('/:inventory_id', requireAuth, async (req, res) => {
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
    console.error('Error obteniendo colaboradores:', error);
    res.status(500).json({ error: 'Error al consultar colaboradores: ' + error.message });
  }
});

/**
 * POST /api/collaborators/invite
 * Invita a un usuario por correo electrónico a colaborar en el inventario
 */
router.post('/invite', requireAuth, async (req, res) => {
  try {
    const { inventory_id, email, role = 'collaborator' } = req.body;

    if (!inventory_id || !email) {
      return res.status(400).json({ error: 'inventory_id y email son obligatorios.' });
    }

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
        return res.status(400).json({ error: 'El usuario ya es colaborador de este inventario.' });
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
    console.error('Error invitando colaborador:', error);
    res.status(500).json({ error: 'Error al enviar invitación: ' + error.message });
  }
});

/**
 * DELETE /api/collaborators/:inventory_id/:user_id
 * Remueve a un colaborador del inventario (Solo Dueño)
 */
router.delete('/:inventory_id/:user_id', requireAuth, async (req, res) => {
  try {
    const { inventory_id, user_id } = req.params;

    // Verificar que quien hace la petición sea el dueño
    const { data: inv } = await supabaseAdmin
      .from('inventories')
      .select('owner_id')
      .eq('id', inventory_id)
      .single();

    if (!inv || inv.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo el dueño del inventario puede remover colaboradores.' });
    }

    if (inv.owner_id === user_id) {
      return res.status(400).json({ error: 'El dueño no puede ser removido de su propio inventario.' });
    }

    const { error: errDel } = await supabaseAdmin
      .from('inventory_users')
      .delete()
      .eq('inventory_id', inventory_id)
      .eq('user_id', user_id);

    if (errDel) throw errDel;

    res.json({ success: true, message: 'Colaborador removido exitosamente.' });
  } catch (error) {
    console.error('Error eliminando colaborador:', error);
    res.status(500).json({ error: 'Error al remover colaborador: ' + error.message });
  }
});

export default router;
