const { AbstractModule } = require('adapt-authoring-core');
/**
* Add supplementary data to existing schemas which defines how and when data was authored
* @extends {AbstractModule}
*/
class AuthoredModule extends AbstractModule {
  /** @override */
  constructor(...args) {
    super(...args);
    this.init();
  }
  /**
  * Initialises the module
  * @return {Promise}
  */
  async init() {
    const mongodb = await this.app.waitForModule('mongodb');
    mongodb.insertHook.tap(this.updateAuthoredValues.bind(this));
    mongodb.replaceHook.tap(this.updateAuthoredValues.bind(this));
    this.setReady();
  }
  /**
  * Function to update authored timestamps on data change
  * @param {String} collectionName MongoDB collection name
  * @param {Object} data Create data passed by the hook
  * @return {Promise} Resolves with the modified data
  */
  async updateAuthoredValues(collectionName, data) {
    const jsonschema = await this.app.waitForModule('jsonschema');
    const schemaExtensions = jsonschema.schemaExtensions[collectionName] || [];
    if(schemaExtensions.includes('authored')) {
      const now = new Date().toISOString();
      if(!data.createdAt) data.createdAt = now;
      data.updatedAt = now;
    }
    return data;
  }
}

module.exports = AuthoredModule;
