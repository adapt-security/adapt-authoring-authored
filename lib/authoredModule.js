const { AbstractModule } = require('adapt-authoring-core');
const AuthoredSchema = require('../schema/authored.schema.json');
/**
*
* @extends {AbstractModule}
*/
class AuthoredModule extends AbstractModule {
  preload(app, resolve, reject) {
    super.preload(app, () => {
      const _preload = () => {
        app.getModule('jsonschema').extendSchema('course', AuthoredSchema);
        app.getModule('mongodb').createHook.tap(this.updateAuthoredValues.bind(this));
        resolve();
      };
      const courses = app.getModule('courses');
      if(!courses.hasPreloaded) return courses.on('preload', _preload);
      _preload();
    }, reject);
  }
  updateAuthoredValues(d) {
    return new Promise((resolve, reject) => {
      if(this.getConfig('targetModels').contains(d.type)) {
        return resolve(d);
      }
      if(!d.createdAt) d.createdAt = new Date().toISOString();
      if(!d.updatedAt) d.updatedAt = new Date().toISOString();
      resolve(d);
    });
  }
}

module.exports = AuthoredModule;
