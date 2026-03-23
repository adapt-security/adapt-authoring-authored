import { AbstractModule, DataCache } from 'adapt-authoring-core'
/**
 * Add supplementary data to existing schemas which defines how and when data was authored
 * @memberof authored
 * @extends {AbstractModule}
 */
class AuthoredModule extends AbstractModule {
  /** @override */
  async init () {
    await super.init()
    /**
     * Name of the schema extension
     * @type {String}
     */
    this.schemaName = 'authored'
    /**
     * Store of all modules registered to use this plugin
     * @type {Array<AbstractModule>}
     */
    this.registeredModules = []
    /**
     * Cache for user existence checks
     * @type {DataCache}
     */
    this.userCache = new DataCache({ enable: true, lifespan: 60000 })
    /**
     * Cache for course ID lookups
     * @type {DataCache}
     */
    this.courseCache = new DataCache({ enable: true, lifespan: 30000 })

    const jsonschema = await this.app.waitForModule('jsonschema')
    jsonschema.registerSchemasHook.tap(this.registerSchemas.bind(this))
  }

  /**
   * Registers a module for use with this plugin
   * @param {AbstractApiModule} mod
   * @param {Object} options
   * @param {Boolean} options.accessCheck Whether an access check should be performed
   */
  async registerModule (mod, options = {}) {
    if (this.registeredModules.includes(mod)) {
      throw this.app.errors.DUPL_AUTHORED_MODULE_NAME
        .setData({ name: mod.name })
    }
    if (!mod.isApiModule) {
      throw this.app.errors.API_MODULE_INVALID_CLASS
        .setData({ name: mod.name })
    }
    if (mod.schemaName) {
      const jsonschema = await this.app.waitForModule('jsonschema')
      jsonschema.extendSchema(mod.schemaName, this.schemaName)
    }
    this.registeredModules.push(mod)
    await this.registerSchemas()

    mod.requestHook.tap(this.updateAuthor, this)
    mod.preInsertHook.tap((insertData) => this.updateTimestamps('insert', insertData))
    mod.preUpdateHook.tap((ogDoc, updateData) => this.updateTimestamps('update', { ...updateData, _courseId: updateData._courseId ?? ogDoc._courseId }))
    mod.preDeleteHook.tap((ogDoc) => this.updateCourseTimestamp(ogDoc))
  }

  /**
   * Adds schema extensions
   */
  async registerSchemas () {
    const jsonschema = await this.app.waitForModule('jsonschema')
    this.registeredModules.forEach(mod => {
      try {
        jsonschema.extendSchema(mod.schemaName, this.schemaName)
      } catch (e) {}
    })
  }

  /**
   * Function to update author on data change
   * @param {external:ExpressRequest} req
   * @return {Promise} Resolves with the modified data
   */
  async updateAuthor (req) {
    if (!req.apiData.modifying) return
    if (req.method === 'POST' && !req.apiData.data.createdBy) {
      req.apiData.data.createdBy = req.auth.user._id.toString()
      return
    }
    if (!req.apiData.data.createdBy) return
    const [user] = await this.userCache.get(
      { _id: req.apiData.data.createdBy },
      { collectionName: 'users' },
      { projection: { _id: 1 } }
    )
    if (!user) {
      throw this.app.errors.INVALID_CREATED_BY.setData({ id: req.apiData.data.createdBy })
    }
  }

  /**
   * Function to update authored timestamp on data change
   * @param {String} action
   * @param {Object} data
   * @return {Promise}
   */
  async updateTimestamps (action, data) {
    data.updatedAt = new Date().toISOString()
    if (action === 'insert') data.createdAt = data.updatedAt
    await this.updateCourseTimestamp(data)
  }

  async updateCourseTimestamp (data) {
    if (!data._courseId) return
    const [course] = await this.courseCache.get(
      { _type: 'course', _courseId: data._courseId },
      { collectionName: 'content' },
      { projection: { _id: 1 } }
    )
    if (!course) return
    const mongodb = await this.app.waitForModule('mongodb')
    await mongodb.update('content', { _id: course._id }, { $set: { updatedAt: new Date().toISOString() } })
  }
}

export default AuthoredModule
