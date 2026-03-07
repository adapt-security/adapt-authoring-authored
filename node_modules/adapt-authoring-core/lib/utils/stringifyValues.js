/**
 * Clones an object and converts any Dates and ObjectIds to Strings
 * @param {Object} data
 * @returns A clone object with stringified ObjectIds
 * @memberof core
 */
export function stringifyValues (data) {
  return Object.entries(data).reduce((cloned, [key, val]) => {
    const type = val?.constructor?.name
    cloned[key] =
      type === 'Date' || type === 'ObjectId'
        ? val.toString()
        : type === 'Array' || type === 'Object'
          ? stringifyValues(val)
          : val
    return cloned
  }, Array.isArray(data) ? [] : {})
}
