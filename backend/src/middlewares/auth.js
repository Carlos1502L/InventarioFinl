import { supabaseAdmin } from '../config/supabase.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'No se proporcionó un token de autorización válido en la cabecera (Bearer <token>).',
        timestamp: new Date().toISOString()
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Sesión inválida o expirada. Por favor, inicia sesión nuevamente.',
        timestamp: new Date().toISOString()
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Error en middleware requireAuth:', err);
    return res.status(500).json({
      success: false,
      code: 'AUTH_ERROR',
      message: 'Error interno de autenticación en el servidor.',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Middleware para validar que el usuario autenticado tiene membresía o propiedad
 * sobre el inventario especificado en params, body o query (Prevención BOLA/IDOR).
 *
 * @param {Object} options
 * @param {'params'|'body'|'query'} [options.source='params'] - Dónde buscar el inventoryId
 * @param {string} [options.key='inventory_id'] - Nombre de la propiedad
 * @param {'member'|'owner'} [options.requiredRole='member'] - Rol mínimo requerido
 */
export const verifyTenantAccess = ({ source = 'params', key = 'inventory_id', requiredRole = 'member' } = {}) => {
  return async (req, res, next) => {
    try {
      const inventoryId = req[source]?.[key];
      if (!inventoryId) {
        return res.status(400).json({
          success: false,
          code: 'BAD_REQUEST',
          message: `El parámetro requerido '${key}' no fue proporcionado en ${source}.`,
          timestamp: new Date().toISOString()
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuario no autenticado.',
          timestamp: new Date().toISOString()
        });
      }

      // 1. Verificar si el usuario es dueño directo en la tabla inventories
      const { data: inv, error: invError } = await supabaseAdmin
        .from('inventories')
        .select('id, owner_id, name')
        .eq('id', inventoryId)
        .maybeSingle();

      if (invError || !inv) {
        return res.status(404).json({
          success: false,
          code: 'NOT_FOUND',
          message: 'El inventario especificado no existe.',
          timestamp: new Date().toISOString()
        });
      }

      const isOwner = inv.owner_id === userId;

      if (requiredRole === 'owner') {
        if (!isOwner) {
          return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'Acceso restringido: Se requiere rol de Propietario para esta acción.',
            timestamp: new Date().toISOString()
          });
        }
        req.inventory = { id: inv.id, role: 'owner', isOwner: true, name: inv.name };
        return next();
      }

      // Si se requiere rol de miembro ('member'):
      if (isOwner) {
        req.inventory = { id: inv.id, role: 'owner', isOwner: true, name: inv.name };
        return next();
      }

      // 2. Si no es dueño directo, verificar en inventory_users
      const { data: membership, error: memError } = await supabaseAdmin
        .from('inventory_users')
        .select('role')
        .eq('inventory_id', inventoryId)
        .eq('user_id', userId)
        .maybeSingle();

      if (memError || !membership) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'No tienes permisos de acceso ni membresía en este inventario.',
          timestamp: new Date().toISOString()
        });
      }

      req.inventory = { id: inv.id, role: membership.role, isOwner: membership.role === 'owner', name: inv.name };
      return next();
    } catch (err) {
      console.error('Error en middleware verifyTenantAccess:', err);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Error al verificar permisos del inventario.',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Middleware para validar acceso a través del ID de una ubicación (locations.id).
 * Previene BOLA / IDOR en generación de etiquetas y códigos QR.
 */
export const verifyLocationAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'ID de ubicación no proporcionado.',
        timestamp: new Date().toISOString()
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Usuario no autenticado.',
        timestamp: new Date().toISOString()
      });
    }

    // Consultar ubicación y su inventario asociado
    const { data: location, error } = await supabaseAdmin
      .from('locations')
      .select(`
        id,
        name,
        code,
        description,
        inventory_id,
        inventories (
          id,
          owner_id,
          name
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error || !location) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Ubicación no encontrada.',
        timestamp: new Date().toISOString()
      });
    }

    const isOwner = location.inventories?.owner_id === userId;

    if (!isOwner) {
      // Verificar si es miembro en inventory_users
      const { data: membership } = await supabaseAdmin
        .from('inventory_users')
        .select('role')
        .eq('inventory_id', location.inventory_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!membership) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'No tienes autorización para acceder a la ubicación de este inventario.',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Adjuntar la ubicación precargada para evitar doble consulta en el controlador
    req.location = location;
    return next();
  } catch (err) {
    console.error('Error en middleware verifyLocationAccess:', err);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Error al verificar permisos sobre la ubicación.',
      timestamp: new Date().toISOString()
    });
  }
};
