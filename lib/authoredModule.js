const { AbstractModule } = require('adapt-authoring-core');
const AuthoredSchema = require('../schema/authored.schema.json');
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
    mongodb.createHook.tap(this.updateAuthoredValues.bind(this));
    this.setReady();
  }
  /**
  * Function to update authored timestamps on data change
  * @param {Object} d Create data passed by the hook
  * @return {Promise} Resolves with the modified data
  */
  async updateAuthoredValues(d) {
    const jsonschema = await this.app.waitForModule('jsonschema');
    const hasAuthored = jsonschema.schemaExtensions[d.type].includes('authored');
    if(hasAuthored) {
      const now = new Date().toISOString()
      if(!d.createdAt) d.createdAt = now;
      d.updatedAt = now;
    }
    return d;
  }
}

module.exports = AuthoredModule;
