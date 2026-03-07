/**
 * Determines if param is a Javascript object (note: returns false for arrays, functions and null)
 * @param {*} o
 * @return {Boolean}
 */
export function isObject (o) {
  return typeof o === 'object' && o !== null && !Array.isArray(o)
}
