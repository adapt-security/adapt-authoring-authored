import fs from 'fs/promises'
import { glob } from 'glob'
import App from '../App.js'

/**
 * Scans files matching a glob pattern across all module dependency directories.
 * @param {string} pattern - Glob pattern to match files (e.g. 'errors/*.json')
 * @param {Object} [options] - Options
 * @param {boolean} [options.parse=false] - If true, reads and parses each matched file as JSON
 * @param {Object} [options.dependencies] - Custom dependencies map (defaults to App.instance.dependencies)
 * @returns {Promise<Object>} Map of module name to array of file paths (or parsed JSON objects if parse is true)
 */
export async function loadDependencyFiles (pattern, options = {}) {
  const { parse = false, dependencies = App.instance.dependencies } = options
  const results = {}
  await Promise.all(Object.values(dependencies).map(async dep => {
    const files = await glob(pattern, { cwd: dep.rootDir, absolute: true })
    if (!files.length) return
    results[dep.name] = await Promise.all(files.map(async f => {
      if (parse) return JSON.parse(await fs.readFile(f, 'utf8'))
      return f
    }))
  }))
  return results
}
