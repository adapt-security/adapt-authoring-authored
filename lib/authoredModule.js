const { AbstractModule, Hook } = require('adapt-authoring-core');
/**
* Add supplementary data to existing schemas which defines how and when data was authored
* @extends {AbstractModule}
*/
class AuthoredModule extends AbstractModule {
  /** @override */
  constructor(...args) {
    super(...args);
    this.registeredModules = [];
    this.setReady();
  }
  async registerModule(mod) {
    if(this.registeredModules.includes(mod)) {
      throw new Error(`Module '${mod.name}' already registered with authored module`);
    }
    if(!mod.isApiModule) {
      throw new Error(`Module '${mod.name}' must extend AbstractApiModule`);
    }
    const jsonschema = await this.app.waitForModule('jsonschema');
    jsonschema.extendSchema(mod.schemaName, 'authored');
    this.registeredModules.push(mod);
    mod.requestHook.tap(this.updateAuthoredValues.bind(this));
  }
  /**
  * Function to update authored timestamps on data change
  * @param {String} collectionName MongoDB collection name
  * @param {Object} data Create data passed by the hook
  * @return {Promise} Resolves with the modified data
  */
  async updateAuthoredValues(req) {
    if(!req.apiData.data) {
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
