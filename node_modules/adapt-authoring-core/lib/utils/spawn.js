import App from '../App.js'
import { spawn as nodeSpawn } from 'child_process'

/**
 * Reusable Promise-based spawn wrapper, which handles output/error handling
 * @param {Object} options
 * @param {String} options.cmd Command to run
 * @param {String} options.cwd Current working directory
 * @param {Array<String>} options.args
 * @returns Promise
 */
export async function spawn (options) {
  return new Promise((resolve, reject) => {
    if (!options.cwd) options.cwd = ''
    App.instance.log('verbose', 'SPAWN', options)
    const task = nodeSpawn(options.cmd, options.args ?? [], { cwd: options.cwd })
    let stdout = ''
    let stderr = ''
    let error
    task.stdout.on('data', data => {
      stdout += data
    })
    task.stderr.on('data', data => {
      stderr += data
    })
    task.on('error', e => {
      error = e
    })
    task.on('close', exitCode => {
      exitCode !== 0 ? reject(App.instance.errors.SPAWN.setData({ error: error ?? stderr ?? stdout })) : resolve(stdout)
    })
  })
}
