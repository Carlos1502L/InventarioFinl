/**
 * Utilidades de Seguridad y Sanitización Frontend (OWASP Top 10 A03: Injection & XSS)
 */

/**
 * Sanitiza cualquier texto para ser interpolado seguramente dentro de HTML,
 * previniendo inyección de scripts maliciosos (Stored y Reflected DOM-XSS).
 *
 * @param str Cadena de texto de entrada potencialmente maliciosa
 * @returns Cadena de texto con entidades HTML codificadas de forma segura
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Valida y sanitiza una URL para asegurar que solo contenga esquemas seguros (http, https, data).
 * Bloquea esquemas peligrosos como javascript: o vbscript:
 */
export function sanitizeUrl(url: unknown): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (/^(?:https?|data:image\/):/i.test(trimmed)) {
    return trimmed;
  }
  return '';
}
