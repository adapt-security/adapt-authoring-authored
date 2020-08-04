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
    this.setReady();
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
    mod.insertHook.tap(data => this.updateTimestamps(data));
    mod.updateHook.tap((oldData, newData) => this.updateTimestamps(newData));
    mod.accessCheckHook.tap((...args) => this.checkAccess(mod, ...args));
  }
  /**
  * Function to update author on data change
  * @param {ClientRequest} req
  * @return {Promise} Resolves with the modified data
  */
  async updateAuthor(req) {
    if(req.apiData.config.modifying && !req.apiData.data.createdAt) {
      req.apiData.data.createdBy = req.auth.userId;
    }
  }
  /**
  * Function to update authored timestamps on data change
  * @param {Object} data
  * @return {Promise} Resolves with the modified data
  */
  async updateTimestamps(data) {
    const now = new Date().toISOString();
    if(!data.createdAt) data.createdAt = now;
    data.updatedAt = now;
  }
  async checkAccess(mod, req, data) {
    const createdBy = data.createdBy || (await mod.find({ _id: data._id })).createdBy;
    return createdBy && createdBy.toString() === req.auth.user._id.toString();
  }
}

module.exports = AuthoredModule;
