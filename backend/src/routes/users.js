import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

/**
 * DELETE /api/users/me
 * RF-AUTH-006: Eliminación definitiva de cuenta de usuario y purga en cascada
 */
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Purgar inventarios donde el usuario es dueño directo
    const { data: ownedInventories } = await supabaseAdmin
      .from('inventories')
      .select('id')
      .eq('owner_id', userId);

    if (ownedInventories && ownedInventories.length > 0) {
      const ownedIds = ownedInventories.map((i) => i.id);
      await supabaseAdmin.from('inventories').delete().in('id', ownedIds);
    }

    // 2. Purgar membresías asociadas
    await supabaseAdmin.from('inventory_users').delete().eq('user_id', userId);

    // 3. Purgar perfil público
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // 4. Eliminar usuario en Supabase Auth Admin
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.warn('Advertencia al eliminar usuario de auth.admin:', authDeleteError.message);
    }

    return res.json({
      success: true,
      code: 'ACCOUNT_DELETED',
      message: 'Cuenta eliminada permanentemente y datos purgados con éxito.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error al procesar baja de cuenta:', err);
    return res.status(500).json({
      success: false,
      code: 'ACCOUNT_DELETION_ERROR',
      message: 'Error interno al procesar la baja de la cuenta.',
      error: err.message
    });
  }
});

export default router;
