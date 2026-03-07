import fs from 'fs/promises'

/**
 * Writes data as formatted JSON to a file.
 * @param {string} filepath - Absolute path to the JSON file
 * @param {*} data - Data to serialise
 * @returns {Promise<void>}
 */
export function writeJson (filepath, data) {
  return fs.writeFile(filepath, JSON.stringify(data, null, 2))
}
