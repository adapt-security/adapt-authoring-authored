const { AbstractModule } = require('adapt-authoring-core');
/**
 * Add supplementary data to existing schemas which defines how and when data was authored
 * @extends {AbstractModule}
 */
class AuthoredModule extends AbstractModule {
  /** @override */
  constructor(...args) {
    super(...args);
    /**
     * Name of the schema extension
     * @type {String}
     */
    this.schemaName = 'authored';
    /**
     * Store of all modules registered to use this plugin
     * @type {Array<AbstractModule>}
     */
    this.registeredModules = [];
  }
  /**
   * Registers a module for use with this plugin
   * @param {AbstractApiModule} mod
   */
  async registerModule(mod) {
    if(this.registeredModules.includes(mod)) {
      throw new Error(`Module '${mod.name}' already registered with authored module`);
    }
    if(!mod.isApiModule) {
      throw new Error(`Module '${mod.name}' must extend AbstractApiModule`);
    }
    if(mod.schemaName) {
      const jsonschema = await this.app.waitForModule('jsonschema');
      jsonschema.extendSchema(mod.schemaName, this.schemaName);
    }
    this.registeredModules.push(mod);

    mod.requestHook.tap(this.updateAuthor);
    mod.insertHook.tap((insertData) => this.updateTimestamps('insert', insertData));
    mod.updateHook.tap((ogDoc, updateData) => this.updateTimestamps('update', updateData));

    mod.accessCheckHook.tap((...args) => this.checkAccess(mod, ...args));
  }
  /**
   * Function to update author on data change
   * @param {ClientRequest} req
   * @return {Promise} Resolves with the modified data
   */
  async updateAuthor(req) {
    if(req.method === 'POST' && req.apiData.config.modifying && !req.apiData.data.createdBy) {
      req.apiData.data.createdBy = req.auth.user._id.toString();
    }
  }
  /**
   * Function to update authored timestamp on data change
   * @param {String} action
   * @param {Object} data
   * @return {Promise}
   */
  async updateTimestamps(action, data) {
    data.updatedAt = new Date().toISOString();
    if(action === 'insert') data.createdAt = data.updatedAt;
  }
  /**
   * Function to update authored timestamp on data change
   * @param {AbstractModule} mod
   * @param {ClientRequest} req
   * @param {Object} data
   * @return {Promise} Resolves with boolean
   */
  async checkAccess(mod, req, data) {
    const createdBy = data.createdBy || (await mod.find({ _id: data._id })).createdBy;
    return createdBy && createdBy.toString() === req.auth.user._id.toString();
  }
}

module.exports = AuthoredModule;
