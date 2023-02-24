import { AbstractModule } from 'adapt-authoring-core';
/**
 * Add supplementary data to existing schemas which defines how and when data was authored
 * @memberof authored
 * @extends {AbstractModule}
 */
class AuthoredModule extends AbstractModule {
  /** @override */
  async init() {
    await super.init();
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
   * @param {Object} options
   * @param {Boolean} options.accessCheck Whether an access check should be performed
   */
  async registerModule(mod, options = { accessCheck: true }) {
    if(this.registeredModules.includes(mod)) {
      throw this.app.errors.DUPL_AUTHORED_MODULE_NAME
        .setData({ name: mod.name });
    }
    if(!mod.isApiModule) {
      throw this.app.errors.API_MODULE_INVALID_CLASS
        .setData({ name: mod.name });
    }
    if(mod.schemaName) {
      const jsonschema = await this.app.waitForModule('jsonschema');
      jsonschema.extendSchema(mod.schemaName, this.schemaName);
    }
    this.registeredModules.push(mod);

    mod.requestHook.tap(this.updateAuthor);
    mod.preInsertHook.tap((insertData) => this.updateTimestamps('insert', insertData));
    mod.preUpdateHook.tap((ogDoc, updateData) => this.updateTimestamps('update', updateData));

    if(options.accessCheck) mod.accessCheckHook.tap((...args) => this.checkAccess(mod, ...args));
  }
  /**
   * Function to update author on data change
   * @param {external:ExpressRequest} req
   * @return {Promise} Resolves with the modified data
   */
  async updateAuthor(req) {
    if(req.method === 'POST' && req.apiData.modifying && !req.apiData.data.createdBy) {
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
   * @param {external:ExpressRequest} req
   * @param {Object} data
   * @return {Promise} Resolves with boolean
   */
  async checkAccess(mod, req, data) {
    const createdBy = data.createdBy || (await mod.find({ _id: data._id })).createdBy;
    return createdBy && createdBy.toString() === req.auth.user._id.toString();
  }
}

export default AuthoredModule;