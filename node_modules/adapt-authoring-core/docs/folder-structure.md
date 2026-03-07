# Folder structure

This guide explains the folder structure of an Adapt authoring tool installation.

## Overview

A typical installation has the following structure:

```
adapt-authoring/
├── APP_DATA/            # Application runtime data
│   ├── data/            # Persistent files
│   └── temp/            # Temporary files
├── bin/                 # CLI scripts
├── conf/                # Environment configuration files
└── node_modules/        # Installed modules and dependencies
```

## `APP_DATA`

The `APP_DATA` folder contains all files required to run an Adapt authoring tool instance (with the exception of the source code, which are found in `node_modules`).

### `data`

The data directory stores persistent application data that must survive restarts and updates. By default this is `APP_DATA/data/`, but can be configured via the `dataDir` config option.

> **Warning:** Never modify or delete the data directory while the application is running. Doing so will cause data loss and runtime errors.

### Using the data directory

Module developers should store any data that must persist between restarts in this directory. You can use the `$DATA` variable in your config schema to automatically populate this value at runtime:

```json
{
  "myDataPath": {
    "type": "string",
    "isDirectory": true,
    "default": "$DATA/mymodule"
  }
}
```

See the [configuration guide](configuration.md) for more information.


### `temp`

The temp directory stores temporary files used at runtime. By default this is `APP_DATA/temp/`, but can be configured via `tempDir`. Files in this directory may be removed at any time when the application is stopped.

#### Using the temp directory

Developers should use the temp directory to store any files which are not needed permanently. Please try to remove any temporary files once they're no longer needed to conserve disk space and reduce the need for manual housekeeping by the server admin.

Examples of the kind of data found in the temp directory: generated asset thumbnails, documentation build output, compiled UI app code and file uploads.

As with the data directory, there is a custom variable (`$TEMP`) which can be used in config schemas to populate the correct value at runtime:

```json
{
  "myCachePath": {
    "type": "string",
    "isDirectory": true,
    "default": "$TEMP/mymodule-cache"
  }
}
```

### Clearing the temp directory

It is safe to delete the temp directory when the application is stopped. On restart, the application will recreate any required directories. This can be useful for:

- Freeing disk space
- Preparing for updates

> **Warning:** Do not delete the temp directory while the application is running. Users will encounter errors and builds will fail.

## `bin`

Command-line tools are found in the `bin` folder. Modules can also provide their own CLIs which are available via `npx`. See the [CLI reference](binscripts.md) for available commands.

## `docs`

The `docs` folder contains documentation pages. These are picked up and compiled by the documentation generation tools when running `at-docgen`. See the [Building the docs](building-docs) for details.

## `conf`

The `conf/` directory contains configuration files. The application loads the file matching your `NODE_ENV` value (e.g., `production.config.js` when `NODE_ENV=production`). If `NODE_ENV` is not set, it defaults to `production`. 

See the [configuration guide](configuration.md) for details.

## `node_modules`

The Adapt authoring tool is built from modular components, each published as an npm package. All modules are installed into the `node_modules/` directory as standard npm dependencies.

Core modules follow the naming convention `adapt-authoring-*` and are listed as dependencies in `package.json`, e.g.

```json
{
  "dependencies": {
    "adapt-authoring-auth": "^1.0.0",
    "adapt-authoring-content": "^1.0.0",
    "adapt-authoring-mongodb": "^1.0.0"
  }
}
```