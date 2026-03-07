/**
 * Converts a value to a boolean. Returns `true` only for `true` or `"true"`.
 * Returns `undefined` if the value is `undefined`.
 * @param {*} val
 * @returns {boolean|undefined}
 */
export function toBoolean (val) {
  if (val !== undefined) return val === true || val === 'true'
}
