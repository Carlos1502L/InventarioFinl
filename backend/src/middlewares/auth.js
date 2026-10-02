import { supabaseAdmin } from '../config/supabase.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No se proporcionó un token de autorización válido en la cabecera (Bearer <token>).'
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Sesión inválida o expirada. Por favor, inicia sesión nuevamente.'
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Error en middleware requireAuth:', err);
    return res.status(500).json({
      success: false,
      error: 'Error interno de autenticación en el servidor.'
    });
  }
};
