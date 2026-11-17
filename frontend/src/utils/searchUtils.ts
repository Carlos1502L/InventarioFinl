/**
 * Utilidades de búsqueda y filtrado tolerante a diacríticos y acentos (RF-SEARCH-016)
 *
 * Criterios de Aceptación:
 * 1. Búsqueda insensible a tildes (ej: "Super" <-> "Súper").
 * 2. Soporte completo para vocales (a/á, e/é, i/í, o/ó, u/ú, ü).
 * 3. Alto rendimiento táctil para móvil (cero lag al escribir).
 * 4. Normalización unificada para memoria, IndexedDB y bases de datos.
 */

/**
 * Normaliza una cadena eliminando tildes, diéresis y marcas diacríticas,
 * convirtiéndola a minúsculas y limpiando espacios laterales.
 *
 * @example
 * normalizeText("Súper") -> "super"
 * normalizeText("CANCIÓN") -> "cancion"
 * normalizeText("Pingüino") -> "pinguino"
 */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Comprueba si un texto objetivo incluye el término de búsqueda de forma tolerante a acentos.
 *
 * @param target Texto donde buscar (ej: nombre de producto)
 * @param query Término digitado por el usuario (o ya normalizado)
 */
export function matchesSearch(
  target: string | null | undefined,
  query: string | null | undefined
): boolean {
  if (!target || !query) return false;
  const normQuery = normalizeText(query);
  if (!normQuery) return true;
  return normalizeText(target).includes(normQuery);
}

/**
 * Comprueba si al menos uno de los campos especificados coincide con la consulta.
 * Optimizado para abortar en la primera coincidencia (short-circuit).
 *
 * @param fields Lista de campos a evaluar (ej: [prod.name, prod.code, prod.sku])
 * @param query Término de búsqueda
 */
export function matchesAnyField(
  fields: (string | null | undefined)[],
  query: string | null | undefined
): boolean {
  if (!query) return true;
  const normQuery = normalizeText(query);
  if (!normQuery) return true;

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (field && normalizeText(field).includes(normQuery)) {
      return true;
    }
  }
  return false;
}

/**
 * Convierte un término de búsqueda en una expresión regular tolerante a diacríticos
 * para PostgreSQL / Supabase PostgREST (filtro 'imatch' o SQL '~*').
 *
 * @example
 * toDiacriticRegexPattern("super") -> "s[uúùüû]p[eéèëê]r"
 * toDiacriticRegexPattern("Súper") -> "s[uúùüû]p[eéèëê]r"
 */
export function toDiacriticRegexPattern(query: string | null | undefined): string {
  if (!query) return '';
  const clean = normalizeText(query);
  return clean
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/a/g, '[aáàäâ]')
    .replace(/e/g, '[eéèëê]')
    .replace(/i/g, '[iíìïî]')
    .replace(/o/g, '[oóòöô]')
    .replace(/u/g, '[uúùüû]');
}
