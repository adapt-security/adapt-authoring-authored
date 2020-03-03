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
    * Store of all modules registered to use this plugin
    * @type {Array<AbstractModule>}
    */
    this.registeredModules = [];
    this.setReady();
  }
  /**
  * Registers a module for use with this plugin
  * @param {AbstractModule} mod
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
    mod.requestHook.tap(this.updateAuthoredValues.bind(this));
  }
  /**
  * Function to update authored timestamps on data change
  * @param {ClientRequest} req
  * @return {Promise} Resolves with the modified data
  */
  async updateAuthoredValues(req) {
    if(!req.apiData.config.modifying || !req.apiData.data) {
      return;
    }
    const now = new Date().toISOString();
    if(!req.apiData.data.createdAt) {
      req.apiData.data.createdAt = now;
      req.apiData.data.createdBy = '123456789012';
    }
    req.apiData.data.updatedAt = now;
  }
}

module.exports = AuthoredModule;
