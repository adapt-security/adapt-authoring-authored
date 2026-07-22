import { AbstractModule, DataCache } from 'adapt-authoring-core'
import { addAccessClause } from 'adapt-authoring-api'
import { buildRecentlyChangedPipeline } from './utils.js'
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

    const users = await this.app.waitForModule('users')
    users.preDeleteHook.tap(this.blockOwnerDelete.bind(this))
  }

  /**
   * Registers a module for use with this plugin
   * @param {AbstractApiModule} mod
   * @param {Object} options
   * @param {Boolean} [options.accessCheck=true] Whether to grant the creator ownership access to their own documents
   */
  async registerModule (mod, options = {}) {
    const { accessCheck = true } = options
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
    // pass the real updateData so updatedAt lands on the written $set; the
    // course id is passed separately so it isn't injected into the document
    mod.preUpdateHook.tap((ogDoc, updateData) => this.updateTimestamps('update', updateData, updateData._courseId ?? ogDoc._courseId))
    // deletes carry no acting user, so bump the course timestamp only (no updatedBy)
    mod.preDeleteHook.tap((ogDoc) => this.updateCourseTimestamp({ _courseId: ogDoc._courseId }))

    // grant the creator additive access to their own documents (owner dimension of _access)
    if (accessCheck) {
      mod.accessCheckHook.tap(this.grantCreatorItem)
      mod.accessQueryHook.tap(this.grantCreatorQuery)
    }
  }

  /**
   * Per-item ownership grant (an `accessCheckHook` observer): grants access when the
   * requesting user created the resource.
   * @param {external:ExpressRequest} req
   * @param {Object} resource
   * @return {Boolean}
   */
  grantCreatorItem (req, resource) {
    const _id = req.auth?.user?._id
    return !!_id && !!resource?.createdBy && String(resource.createdBy) === String(_id)
  }

  /**
   * Query-level ownership grant (an `accessQueryHook` observer): widens the query to include
   * the requesting user's own documents so they aren't missing from list endpoints. Required
   * alongside the per-item grant to keep pagination counts accurate. No-op when unauthenticated.
   * @param {external:ExpressRequest} req
   */
  grantCreatorQuery (req) {
    const _id = req.auth?.user?._id
    if (_id) addAccessClause(req.apiData.query, { createdBy: _id.toString() })
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
    if (req.auth?.user) req.apiData.data.updatedBy = req.auth.user._id.toString()
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
   * @param {Object} data The data being written (mutated in place)
   * @param {String} [courseId] Course to bump, when not present on `data`
   * @return {Promise}
   */
  async updateTimestamps (action, data, courseId = data._courseId) {
    data.updatedAt = new Date().toISOString()
    if (action === 'insert') data.createdAt = data.updatedAt
    await this.updateCourseTimestamp({ _courseId: courseId, updatedBy: data.updatedBy })
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
    const $set = { updatedAt: new Date().toISOString() }
    if (data.updatedBy) $set.updatedBy = data.updatedBy
    await mongodb.update('content', { _id: course._id }, { $set })
  }

  /**
   * Refuses deletion of a user who still owns authored content, preventing orphaned documents.
   * Tapped on the users module's `preDeleteHook`.
   * @param {Object} user The user document about to be deleted
   * @return {Promise}
   */
  async blockOwnerDelete (user) {
    const counts = await this.getOwnedCounts(user._id)
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
    if (total > 0) {
      throw this.app.errors.USER_OWNS_CONTENT.setData({ _id: user._id.toString(), total, counts })
    }
  }

  /**
   * Counts the documents owned (via `createdBy`) by a user in every registered collection.
   * @param {String} userId
   * @return {Promise<Object>} Map of collection name to owned-document count
   */
  async getOwnedCounts (userId) {
    const mongodb = await this.app.waitForModule('mongodb')
    const createdBy = userId.toString()
    const counts = {}
    for (const mod of this.registeredModules) {
      if (mod.collectionName) counts[mod.collectionName] = await mongodb.count(mod.collectionName, { createdBy })
    }
    return counts
  }

  /**
   * Lists the courses and assets owned (via `createdBy`) by a user, for a transfer preview.
   * @param {String} userId
   * @return {Promise<Object>} `{ courses: [{_id,title}], assets: [{_id,title}] }`
   */
  async getOwnedSummary (userId) {
    const mongodb = await this.app.waitForModule('mongodb')
    const createdBy = userId.toString()
    const [courses, assets] = await Promise.all([
      mongodb.find('content', { createdBy, _type: 'course' }, { projection: { title: 1, displayTitle: 1 } }),
      mongodb.find('assets', { createdBy }, { projection: { title: 1 } })
    ])
    return {
      courses: courses.map(c => ({ _id: c._id, title: c.title || c.displayTitle || String(c._id) })),
      assets: assets.map(a => ({ _id: a._id, title: a.title || String(a._id) }))
    }
  }

  /**
   * Reassigns ownership of every document created by one user to another, across all registered
   * collections. Only `createdBy` is changed; sharing grants and timestamps are left untouched.
   * @param {String} fromUserId The current owner
   * @param {String} toUserId The new owner
   * @return {Promise<Object>} Map of collection name to number of documents reassigned
   */
  async transferOwnership (fromUserId, toUserId) {
    const mongodb = await this.app.waitForModule('mongodb')
    const from = fromUserId.toString()
    const to = toUserId.toString()
    const moved = {}
    for (const mod of this.registeredModules) {
      if (!mod.collectionName) continue
      const count = await mongodb.count(mod.collectionName, { createdBy: from })
      if (count) await mongodb.updateMany(mod.collectionName, { createdBy: from }, { $set: { createdBy: to } })
      moved[mod.collectionName] = count
    }
    return moved
  }

  /**
   * Returns the most-recently-changed documents across all registered collections, newest first
   * @param {Object} options
   * @param {Number} options.limit Maximum number of rows to return
   * @param {Object} options.filters Per-collection match query keyed by collection name (e.g. access filters)
   * @return {Promise<Array>} Rows of { _id, collection, createdAt, updatedAt, createdBy, updatedBy }
   */
  async getRecentlyChanged ({ limit = 25, filters = {} } = {}) {
    const collections = this.registeredModules.map(m => m.collectionName).filter(Boolean)
    if (!collections.length) return []
    const pipeline = buildRecentlyChangedPipeline(collections, { limit, filters })
    const mongodb = await this.app.waitForModule('mongodb')
    return mongodb.getCollection(collections[0]).aggregate(pipeline).toArray()
  }
}

export default AuthoredModule
