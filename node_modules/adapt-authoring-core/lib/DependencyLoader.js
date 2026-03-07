/* eslint no-console: 0 */
import _ from 'lodash'
import fs from 'fs-extra'
import { glob } from 'glob'
import path from 'path'
import Hook from './Hook.js'
import { metadataFileName, packageFileName } from './Utils.js'
/**
 * Handles the loading of Adapt authoring tool module dependencies.
 * @memberof core
 */
class DependencyLoader {
  /**
   * Creates a new DependencyLoader instance
   * @param {App} app The main app instance
   */
  constructor (app) {
    /**
     * Name of the class (convenience function to stay consistent with other classes)
     * @type {string}
     */
    this.name = this.constructor.name.toLowerCase()
    /**
     * Reference to the main app
     * @type {App}
     */
    this.app = app
    /**
     * Key/value store of all the Adapt dependencies' configs. Note this includes dependencies which are not loaded as Adapt modules (i.e. `module: false`).
     * @type {Object<string, Object>}
     */
    this.configs = {}
    /**
     * Map of module names to their loaded instances
     * @type {Object<string, Object>}
     */
    this.instances = {}
    /**
     * Map of module names to arrays of modules that depend on them as peer dependencies
     * @type {Object<string, Array<string>>}
     */
    this.peerDependencies = {}
    /**
     * List of module names which have failed to load
     * @type {Array<string>}
     */
    this.failedModules = []
    /**
     * Hook called once all module configs are loaded
     * @type {Hook}
     */
    this.configsLoadedHook = new Hook()
    /**
     * Hook for individual module load
     * @type {Hook}
     */
    this.moduleLoadedHook = new Hook()

    this.moduleLoadedHook.tap(this.logProgress, this)
  }

  /**
   * Loads all Adapt module dependencies. Essential modules are loaded first, then non-essential modules (with force mode).
   * @return {Promise<void>}
   * @throws {Error} When any essential module fails to load
   */
  async load () {
    await this.loadConfigs()

    const configValues = Object.values(this.configs)
    // sort dependencies into priority
    const { essential, theRest } = configValues.reduce((m, c) => {
      this.app.pkg.essentialApis.includes(c.essentialType) ? m.essential.push(c.name) : m.theRest.push(c.name)
      return m
    }, { essential: [], theRest: [] })
    // load each set of deps
    await this.loadModules(essential)
    await this.loadModules(theRest, { force: true })

    if (this.failedModules.length) {
      throw new Error(`Failed to load modules ${this.failedModules.join(', ')}`)
    }
  }

  /**
   * Loads configuration files for all Adapt dependencies found in node_modules.
   * @return {Promise<void>}
   */
  async loadConfigs () {
    /** @ignore */ this._configsLoaded = false
    const files = await glob(`${this.app.rootDir}/node_modules/**/${metadataFileName}`)
    const deps = files
      .map(d => d.replace(`${metadataFileName}`, ''))
      .sort((a, b) => a.length < b.length ? -1 : 1)

    // sort so that core is loaded first, as other modules may use its config values
    const corePathSegment = `/${this.app.name}/`
    deps.sort((a, b) => {
      if (a.endsWith(corePathSegment)) return -1
      if (b.endsWith(corePathSegment)) return 1
      return 0
    })
    for (const d of deps) {
      try {
        const c = await this.loadModuleConfig(d)
        if (!this.configs[c.name]) {
          this.configs[c.name] = c
          if (c.peerDependencies) {
            Object.keys(c.peerDependencies).forEach(p => {
              this.peerDependencies[p] = [...(this.peerDependencies[p] || []), c.name]
            })
          }
        }
      } catch (e) {
        this.logError(`Failed to load config for '${d}', module will not be loaded`)
        this.logError(e)
      }
    }
    this._configsLoaded = true
    await this.configsLoadedHook.invoke()
  }

  /**
   * Loads the relevant configuration files for an Adapt module by reading and merging package.json and adapt.json
   * @param {string} modDir Absolute path to the module directory
   * @return {Promise<Object>} Resolves with configuration object
   */
  async loadModuleConfig (modDir) {
    return {
      ...await fs.readJson(path.join(modDir, packageFileName)),
      ...await fs.readJson(path.join(modDir, metadataFileName)),
      rootDir: modDir
    }
  }

  /**
   * Loads a single Adapt module by dynamically importing it, instantiating it, and waiting for its onReady promise. Should not need to be called directly.
   * @param {string} modName Name of the module to load (e.g., 'adapt-authoring-core')
   * @return {Promise<Object>} Resolves with module instance when module.onReady completes
   * @throws {Error} When module already exists, is in an unknown format or cannot be initialised (or initialisation exceeds 60 second timeout)
   */
  async loadModule (modName) {
    if (this.instances[modName]) {
      throw new Error('Module already exists')
    }
    const config = this.configs[modName]

    if (config.module === false) {
      return
    }
    const { default: ModClass } = await import(modName)

    if (!_.isFunction(ModClass)) {
      throw new Error('Expected class to be exported')
    }
    const instance = new ModClass(this.app, config)

    if (!_.isFunction(instance.onReady)) {
      throw new Error('Module must define onReady function')
    }
    try {
      // all essential modules will use hard-coded value, as config won't be loaded yet
      const timeout = this.getConfig('moduleLoadTimeout') ?? 10000
      await Promise.race([
        instance.onReady(),
        new Promise((resolve, reject) => setTimeout(() => reject(new Error(`${modName} load exceeded timeout (${timeout})`)), timeout))
      ])
      this.instances[modName] = instance
      await this.moduleLoadedHook.invoke(null, instance)
      return instance
    } catch (e) {
      await this.moduleLoadedHook.invoke(e)
      throw e
    }
  }

  /**
   * Loads a list of Adapt modules. Should not need to be called directly.
   * @param {Array<string>} modules Module names to load
   * @param {Object} [options] Loading options
   * @param {boolean} [options.force=false] If true, logs errors and continues loading other modules when a module fails. If false, throws a DependencyError on first failure.
   * @return {Promise<void>} Resolves when all modules have loaded (or failed to load in force mode)
   * @throws {DependencyError} When a module fails to load and options.force is not true
   */
  async loadModules (modules, options = {}) {
    await Promise.all(modules.map(async m => {
      try {
        await this.loadModule(m)
      } catch (e) {
        if (options.force !== true) {
          const error = new Error(`Failed to load '${m}'`)
          error.name = 'DependencyError'
          error.cause = e
          throw error
        }
        this.logError(`Failed to load '${m}',`, e)
        const deps = this.peerDependencies[m]
        if (deps && deps.length) {
          this.logError('The following modules are peer dependencies, and may not work:')
          deps.forEach(d => this.logError(`- ${d}`))
        }
        this.failedModules.push(m)
      }
    }))
  }

  /**
   * Waits for a single module to load. Returns the instance (if loaded), or hooks into moduleLoadedHook to wait for it.
   * @param {string} modName Name of module to wait for (accepts short names without 'adapt-authoring-' prefix)
   * @return {Promise<Object>} Resolves with module instance when module.onReady completes
   * @throws {Error} When module is missing from configs or has failed to load
   */
  async waitForModule (modName) {
    if (!this._configsLoaded) {
      await this.configsLoadedHook.onInvoke()
    }
    const longPrefix = 'adapt-authoring-'
    if (!modName.startsWith(longPrefix)) modName = `adapt-authoring-${modName}`
    if (!this.configs[modName]) {
      throw new Error(`Missing required module '${modName}'`)
    }
    const DependencyError = new Error(`Dependency '${modName}' failed to load`)
    if (this.failedModules.includes(modName)) {
      throw DependencyError
    }
    const instance = this.instances[modName]
    if (instance) {
      return instance.onReady()
    }
    return new Promise((resolve, reject) => {
      this.moduleLoadedHook.tap((error, instance) => {
        if (error) return reject(DependencyError)
        if (instance?.name === modName) resolve(instance)
      })
    })
  }

  /**
   * Logs load progress
   * @param {AbstractModule} instance The last loaded instance
   */
  logProgress (error, instance) {
    if (error) {
      return
    }
    const toShort = names => names.map(n => n.replace('adapt-authoring-', '')).join(', ')
    const loaded = []
    const notLoaded = []
    let totalCount = 0
    Object.keys(this.configs).forEach(key => {
      if (this.configs[key].module === false) return
      this.instances[key]?._isReady || key === instance.name ? loaded.push(key) : notLoaded.push(key)
      totalCount++
    })
    const progress = Math.round((loaded.length / totalCount) * 100)
    this.log('verbose', 'LOAD', [
      toShort([instance.name]),
      `${loaded.length}/${totalCount} (${progress}%)`,
      notLoaded.length && `awaiting: ${toShort(notLoaded)}`,
      this.failedModules.length && `failed: ${toShort(this.failedModules)}`
    ].filter(Boolean).join(', '))

    if (progress === 100) {
      const initTimes = Object.entries(this.instances)
        .sort((a, b) => a[1].initTime < b[1].initTime ? -1 : a[1].initTime > b[1].initTime ? 1 : 0)
        .reduce((memo, [modName, instance]) => Object.assign(memo, { [modName]: instance.initTime }), {})
      this.log('verbose', initTimes)
    }
  }

  /**
   * Logs a message using the app logger if available, otherwise falls back to console.log
   * @param {...*} args Arguments to be logged
   */
  log (level, ...args) {
    if (this.app.logger?._isReady) {
      this.app.logger.log(level, this.name, ...args)
    } else {
      console.log(...args)
    }
  }

  /**
   * Logs an error message using the app logger if available, otherwise falls back to console.log
   * @param {...*} args Arguments to be logged
   */
  logError (...args) {
    this.log('error', ...args)
  }

  /**
   * Retrieves a configuration value from this module's config
   * @param {string} key - The configuration key to retrieve
   * @returns {*|undefined} The configuration value if config is ready, undefined otherwise
   */
  getConfig (key) {
    if (this.app.config?._isReady) {
      return this.app.config.get(`adapt-authoring-core.${key}`)
    }
  }
}

export default DependencyLoader
