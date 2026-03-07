import Hook from './Hook.js'
/**
 * Abstract class for authoring tool modules. All custom modules must extend this class.
 * @memberof core
 */
class AbstractModule {
  /** @ignore */
  static get MODULE_READY () {
    return 'MODULE_READY'
  }

  /**
   * Create the Module instance
   * @param {Object} app Reference to the main application
   * @param {Object} pkg Config object from package.json for this module
   */
  constructor (app, pkg) {
    /** @ignore */
    this._startTime = Date.now()
    /** @ignore */
    this._isReady = false
    /**
     * Reference to the main app instance
     * @type {App}
     */
    this.app = app
    /**
     * Module config options
     * @type {Object}
     */
    this.pkg = pkg
    /**
     * Name of the module
     * @type {String}
     */
    this.name = pkg?.name || this.constructor.name
    /**
     * Root directory of this module
     * @type {String}
     */
    this.rootDir = pkg?.rootDir
    /**
     * Time taken in milliseconds for module to initialise
     * @type {Number}
     */
    this.initTime = undefined
    /**
     * Hook invoked on module ready
     * @type {Hook}
     */
    this.readyHook = new Hook()

    this.init()
      .then(() => this.setReady())
      .catch(e => this.setReady(e))
  }

  /**
   * Initialises the module. Any custom initialisation tasks should go here. Any uncaught errors thrown here will be caught later and halt the module's load, so make sure any non-fatal errors are handled.
   * @return {Promise}
   */
  async init () {
  }

  /**
   * Signals that the module is loaded
   * @param {Error} error
   * @return {Promise}
   */
  async setReady (error) {
    if (this._isReady) {
      return
    }
    if (!error) {
      this._isReady = true
    }
    /** @ignore */ this._initError = error
    this.initTime = Math.round((Date.now() - this._startTime))
    this.log('verbose', AbstractModule.MODULE_READY, this.initTime)
    await this.readyHook.invoke(error)
  }

  /**
   * Used to listen to the module's ready signal. The returned promise will be resolved when the module has completed initialisation successfully.
   * @return {Promise}
   */
  async onReady () {
    return new Promise((resolve, reject) => {
      if (this._isReady) {
        return resolve(this)
      }
      if (this._initError) {
        return reject(this._initError)
      }
      this.readyHook.tap(error => {
        /** @ignore */this._initError = error
        error ? reject(error) : resolve(this)
      })
    })
  }

  /**
   * Shortcut for retrieving config values
   * @param {String} key
   * @return {*}
   */
  getConfig (key) {
    try {
      return this.app.config.get(`${this.name}.${key}`)
    } catch (e) {
      return undefined
    }
  }

  /**
   * Log a message using the Logger module
   * @param {String} level Log level of message
   * @param {...*} rest Arguments to log
   */
  log (level, ...rest) {
    const _log = (e, instance) => {
      if (!this.app.logger || (instance && instance.name !== this.app.logger.name)) return false
      this.app.dependencyloader.moduleLoadedHook.untap(_log)
      this.app.logger.log(level, this.name.replace(/^adapt-authoring-/, ''), ...rest)
      return true
    }
    if (!_log()) this.app.dependencyloader.moduleLoadedHook.tap(_log)
  }
}

export default AbstractModule
