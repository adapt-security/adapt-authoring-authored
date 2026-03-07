import fs from 'fs/promises'

/**
 * Ensures a directory exists, creating it recursively if needed.
 * @param {string} dir - Absolute path to the directory
 * @returns {Promise<void>}
 */
export async function ensureDir (dir) {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch (e) {
    if (e.code !== 'EEXIST') throw e
  }
}
