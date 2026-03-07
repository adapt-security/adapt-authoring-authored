# Writing a module

Modules are the building blocks of the Adapt authoring tool; each adding new functionality, or augmenting the existing feature-set.

This page gives a brief outline of how to write your own Adapt authoring tool modules.

## 1. Set up your folder structure

The first necessary step is to make sure your module has the correct folder structure.

There are very few assumptions made by the authoring tool when it comes to which files you must include in your modules. At the bare minimum, you need:

- A `package.json` (as all modules are managed by npm)
- A [main](https://docs.npmjs.com/files/package.json#main) script containing relevant exports ([see below](#a-note-on-exports) for more)
- An `adapt-authoring.json` metadata file which is used by the authoring tool module loader.

Although an authoring module _can_ consist of the above files, in all but the simplest of cases you'll find yourself wanting to split up your module into multiple files and folders.

The below is what we recommend, and is the approach taken by the the core dev team for all core-supported modules. It is also the structure required by some Adapt modules (e.g. the documentation generator, JavaScript linter and testing suite).

| Name | Type | Description |
| ---- | ---- | ----------- |
| `conf` | Folder | All config files go here (in `.schema.json` format) |
| `docs` | Folder | Documentation files go here (in `.md` format) |
| `lib` | Folder | All `.js` code should go here |
| `tests` | Folder | Test scripts go here (in `*.spec.js`) |
| `index.js` | File | Contains all of the exports for your module |
| `adapt-authoring.json` | File | Adapt-specific metadata file used when initialising the app |
| `package.json` | File | npm configuration file |
| `routes.json` | File | _(Optional)_ Declarative route definitions for modules that expose HTTP endpoints. See [Handling server requests](server-requests.md) and [Authentication and permissions](auth-permissions.md) for details. |

##### A note on exports:
Your module class must be the **default export** — this is what `DependencyLoader` imports. For additional exports, use named exports:

```javascript
// index.js
export { default } from './lib/MyModule.js'
export { MyUtilsClass } from './lib/utils.js'
```

## 2. Set up your package.json

As all Adapt authoring tool modules are managed by npm, you'll need a valid `package.json` file. See [this page](https://docs.npmjs.com/creating-a-package-json-file) in the npm docs for more information.

> You can execute `npm init` in the root of your module to run the npm CLI questionnaire and guide you through this process.

## 3. Configure adapt-authoring.json

In order for the authoring tool to recognise an npm dependency as an Adapt authoring module, you must include an `adapt-authoring.json` file in the root folder of your module, with a `module` attribute set to `true`:

```json
{
  "module": true,
  // other Adapt authoring tool-specific config goes here...
}
```

> Other Adapt authoring modules may make use of this metadata file to store their own configuration settings. Please check the documentation for the individual modules for more.

## 4. Write your module code

The next, and arguably most important, step is to write the actual code for your module.

### Inheritance

Depending on the required functionality of your module, there are two abstract classes you can inherit from to add a lot of standard boilerplate functionality without you needing to write the code yourself:

| Class | Description |
| ----- | ----------- |
| AbstractModule | Implements all the boilerplate functionality for a barebones module to function. |
| AbstractApiModule | Extends from AbstractModule, and adds functions to aid in implementing REST APIs, and interacting with the database. |

### Initialisation

For any initialisation tasks, the AbstractModule class includes the aptly named `init` [async](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) function. Perform any async (or sync) tasks in here, and the app will auto-detect when your module is ready and continue. If anything fails, just throw an error from here and the app will handle this and log/exit as appropriate.

If you need to wait for another module to initialise before you can continue, then you can make use of the `App#waitForModule` function which will return a Promise and resolve with the module instance when that module has loaded appropriately.

See below for an example:

```javascript
import { AbstractModule } from 'adapt-authoring-core'

export default class MyModule extends AbstractModule {
  /** @override */
  async init() {
    // Initialisation tasks go in here

    // Wait for a single module like this:
    // (note that every AbstracModule has a handy app instance var)
    const mongodb = await this.app.waitForModule('mongodb');
    // We know the mongodb module is ready here

    // Wait for multiple modules like this:
    const [api, jsonschema] = await this.app.waitForModule('api', 'jsonschema');
    // We know the api and jsonschema modules are ready here
  }
}
```

### _Optional task: add a configuration schema_

If you plan to add user-configurable settings to your module, you can add a `config.schema.json` to define which settings users need to add. See [this page](defining-config) for more information.

### _Optional task: add MongoDB schemas_

Any data you wish to push to the database must be accompanied with a schema to define the shape and content of the data. You may be able to make use of schemas defined in other modules, but you will most likely need to create your own for your specific uses. For more information on creating schemas, see [this page](schemas-introduction).

### _Optional task: write unit tests_

Unit tests are a vital component to ensuring your module functions as expected, and doesn't suffer from undetected 'regression' bugs in the future. See [this page](writing-tests) for more information on writing tests.

## 5. Add your module to the app dependencies

Your new module won't be loaded by the app unless you add it as a dependency to the main `adapt-authoring` app. To do this, simply add the name and version to the dependencies in the `package.json` for your local copy of `adapt-authoring`. See the npm docs for more info.

If you don't want to publish your module to npm, you can simply provide the URL for the hosted git repository:

```json
{
  "dependencies": {
    "adapt-authoring-mymodule": "https://github.com/MY_GITHUB_ACCOUNT/GITHUB_REPO_NAME.git"
  }
}
```