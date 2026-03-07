/**
 * Escapes special regex characters in a string.
 * @param {string} string
 * @returns {string}
 */
export function escapeRegExp (string) {
  return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&')
}
