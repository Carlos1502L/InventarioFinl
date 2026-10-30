/**
 * Middleware generador para validación y sanitización de schemas con Zod.
 * Transforma y valida req[source] (body, query, params).
 *
 * @param {import('zod').ZodSchema} schema - Esquema Zod a validar
 * @param {'body'|'query'|'params'} [source='body'] - Propiedad del request a validar
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message
        }));

        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Los datos proporcionados no cumplen con el formato requerido.',
          errors: issues,
          timestamp: new Date().toISOString()
        });
      }

      // Asigna los datos validados y transformados
      req[source] = result.data;
      next();
    } catch (err) {
      next(err);
    }
  };
};
