import AbstractModule from './AbstractModule.js'
import DependencyLoader from './DependencyLoader.js'
import fs from 'fs'
import path from 'path'
import { metadataFileName, packageFileName, getArgs } from './Utils.js'

let instance
/**
 * Core functionality
 * @namespace core
 */
/**
 * The main application class
 * @memberof core
 * @extends {AbstractModule}
 */
class App extends AbstractModule {
  /**
   * The singleton instance. Self-initialises it if there isn't one.
   * @type {App}
   */
  static get instance () {
    if (!instance) instance = new App()
    return instance
  }

  /** @override */
  constructor () {
    const rootDir = process.env.ROOT_DIR ?? process.cwd()
    const adaptJson = JSON.parse(fs.readFileSync(path.join(rootDir, metadataFileName)))
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, packageFileName)))
    super(null, { ...packageJson, ...adaptJson, name: 'adapt-authoring-core', rootDir })
    this.git = this.getGitInfo()
  }

  /** @override */
  async init () {
    /**
     * Reference to the passed arguments (parsed for easy reference)
     * @type {Object}
     */
    this.args = getArgs()
    /**
     * Instance of App instance (required by all AbstractModules)
     * @type {App}
     */
    this.app = this
    /**
     * Reference to the DependencyLoader instance
     * @type {DependencyLoader}
     */
    this.dependencyloader = new DependencyLoader(this)

    /** @ignore */ this._isStarting = false

    const configRootDir = this.getConfig('rootDir')
    if (configRootDir) /** @ignore */this.rootDir = configRootDir

    let startError
    try {
      await this.start()
      this.log('verbose', 'GIT', 'INFO', this.git)
      this.log('verbose', 'DIR', 'rootDir', this.rootDir)
      this.log('verbose', 'DIR', 'dataDir', this.getConfig('dataDir'))
      this.log('verbose', 'DIR', 'tempDir', this.getConfig('tempDir'))
    } catch (e) {
      startError = e
    }
    const failedMods = this.dependencyloader.failedModules
    if (failedMods.length) this.log('warn', `${failedMods.length} module${failedMods.length === 1 ? '' : 's'} failed to load: ${failedMods}. See above for details`)
    if (startError) {
      process.exitCode = 1
      const e = new Error('Failed to start App')
      e.cause = startError
      throw e
    }
  }

  /**
   * The Adapt module dependencies and their configs
   * @type {Object}
   */
  get dependencies () {
    return this.dependencyloader.configs
  }

  /**
   * Attempts to load and parse the local git data for the root repository
   * @returns {Object}
   */
  getGitInfo () {
    try {
      const gitRoot = path.join(this.rootDir, '.git')
      const gitHead = fs.readFileSync(path.join(gitRoot, 'HEAD'), 'utf8').trim()
      return {
        branch: gitHead.split('/').pop(),
        commit: fs.readFileSync(path.join(gitRoot, gitHead.split(': ')[1]), 'utf8').trim()
      }
    } catch (e) {
      return {}
    }
  }

  /**
   * Starts the app
   * @return {Promise} Resolves when the app has started
   */
  async start () {
    if (this._isReady) throw new Error('warn', 'cannot start app, already started')
    if (this._isStarting) throw new Error('warn', 'cannot start app, already initialising')

    this._isStarting = true

    await this.dependencyloader.load()

    this._isStarting = false
  }

  /**
   * Enables waiting for other modules to load
   * @param {...String} modNames Names of modules to wait for
   * @return {Promise} Resolves when specified module has been loaded
   */
  async waitForModule (...modNames) {
    const results = await Promise.all(modNames.map(m => this.dependencyloader.waitForModule(m)))
    return results.length > 1 ? results : results[0]
  }

  /** @override */
  setReady (error) {
    this._isStarting = false
    super.setReady(error)
  }
}

export default App
