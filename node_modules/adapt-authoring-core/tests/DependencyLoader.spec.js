import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import DependencyLoader from '../lib/DependencyLoader.js'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('DependencyLoader', () => {
  describe('constructor', () => {
    it('should create an instance with app reference', () => {
      const mockApp = {
        rootDir: '/test'
      }
      const loader = new DependencyLoader(mockApp)

      assert.equal(loader.app, mockApp)
      assert.equal(loader.name, 'dependencyloader')
    })

    it('should initialize empty configs and instances', () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)

      assert.deepEqual(loader.configs, {})
      assert.deepEqual(loader.instances, {})
      assert.deepEqual(loader.peerDependencies, {})
      assert.deepEqual(loader.failedModules, [])
    })

    it('should initialize hooks', () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)

      assert.ok(loader.configsLoadedHook)
      assert.ok(loader.moduleLoadedHook)
      assert.equal(typeof loader.configsLoadedHook.invoke, 'function')
      assert.equal(typeof loader.moduleLoadedHook.invoke, 'function')
    })

    it('should tap logProgress into moduleLoadedHook', () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      assert.ok(loader.moduleLoadedHook.hasObservers)
    })

    it('should derive name from constructor name in lowercase', () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      assert.equal(loader.name, 'dependencyloader')
    })
  })

  describe('#log()', () => {
    it('should not throw when logger is not available', () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)

      assert.doesNotThrow(() => {
        loader.log('info', 'test message')
      })
    })

    it('should call app.logger when available and ready', () => {
      let logged = false
      const mockApp = {
        rootDir: '/test',
        logger: {
          _isReady: true, // Note: Mock uses private property to simulate ready state
          log: () => { logged = true }
        }
      }
      const loader = new DependencyLoader(mockApp)

      loader.log('info', 'test message')

      assert.equal(logged, true)
    })

    it('should fall back to console.log when logger not ready', () => {
      const mockApp = {
        rootDir: '/test',
        logger: {
          _isReady: false, // Note: Mock uses private property to check ready state
          log: () => {}
        }
      }
      const loader = new DependencyLoader(mockApp)

      assert.doesNotThrow(() => {
        loader.log('info', 'test message')
      })
    })

    it('should pass level and args to app.logger.log', () => {
      let loggedLevel, loggedName, loggedArgs
      const mockApp = {
        rootDir: '/test',
        logger: {
          _isReady: true,
          log: (level, name, ...args) => {
            loggedLevel = level
            loggedName = name
            loggedArgs = args
          }
        }
      }
      const loader = new DependencyLoader(mockApp)
      loader.log('warn', 'message1', 'message2')

      assert.equal(loggedLevel, 'warn')
      assert.equal(loggedName, 'dependencyloader')
      assert.deepEqual(loggedArgs, ['message1', 'message2'])
    })
  })

  describe('#logError()', () => {
    it('should call log with error level', () => {
      let loggedLevel
      const mockApp = {
        rootDir: '/test',
        logger: {
          _isReady: true,
          log: (level) => { loggedLevel = level }
        }
      }
      const loader = new DependencyLoader(mockApp)

      loader.logError('error message')

      assert.equal(loggedLevel, 'error')
    })

    it('should pass all arguments through to log', () => {
      let loggedArgs
      const mockApp = {
        rootDir: '/test',
        logger: {
          _isReady: true,
          log: (level, name, ...args) => { loggedArgs = args }
        }
      }
      const loader = new DependencyLoader(mockApp)
      loader.logError('msg1', 'msg2')
      assert.deepEqual(loggedArgs, ['msg1', 'msg2'])
    })
  })

  describe('#getConfig()', () => {
    it('should return undefined when config is not ready', () => {
      const mockApp = {
        rootDir: '/test'
      }
      const loader = new DependencyLoader(mockApp)

      const result = loader.getConfig('someKey')

      assert.equal(result, undefined)
    })

    it('should return config value when config is ready', () => {
      const mockApp = {
        rootDir: '/test',
        config: {
          _isReady: true, // Note: Mock uses private property to simulate ready state
          get: (key) => {
            if (key === 'adapt-authoring-core.testKey') return 'testValue'
          }
        }
      }
      const loader = new DependencyLoader(mockApp)

      const result = loader.getConfig('testKey')

      assert.equal(result, 'testValue')
    })

    it('should return undefined when config exists but is not ready', () => {
      const mockApp = {
        rootDir: '/test',
        config: {
          _isReady: false,
          get: () => 'should not be called'
        }
      }
      const loader = new DependencyLoader(mockApp)

      const result = loader.getConfig('someKey')

      assert.equal(result, undefined)
    })

    it('should always use adapt-authoring-core prefix for config keys', () => {
      let requestedKey
      const mockApp = {
        rootDir: '/test',
        config: {
          _isReady: true,
          get: (key) => { requestedKey = key }
        }
      }
      const loader = new DependencyLoader(mockApp)
      loader.getConfig('myKey')
      assert.equal(requestedKey, 'adapt-authoring-core.myKey')
    })
  })

  describe('#loadConfigs()', () => {
    let testRootDir

    before(async () => {
      testRootDir = path.join(__dirname, 'data', 'loadconfigs-root')
      // create mock node_modules with core and modules that sort before it alphabetically
      const authDir = path.join(testRootDir, 'node_modules', 'adapt-authoring-auth')
      const configDir = path.join(testRootDir, 'node_modules', 'adapt-authoring-config')
      const coreDir = path.join(testRootDir, 'node_modules', 'adapt-authoring-core')
      await fs.ensureDir(authDir)
      await fs.ensureDir(configDir)
      await fs.ensureDir(coreDir)
      await fs.writeJson(path.join(authDir, 'package.json'), { name: 'adapt-authoring-auth' })
      await fs.writeJson(path.join(authDir, 'adapt-authoring.json'), { module: true })
      await fs.writeJson(path.join(configDir, 'package.json'), { name: 'adapt-authoring-config' })
      await fs.writeJson(path.join(configDir, 'adapt-authoring.json'), { module: true })
      await fs.writeJson(path.join(coreDir, 'package.json'), { name: 'adapt-authoring-core' })
      await fs.writeJson(path.join(coreDir, 'adapt-authoring.json'), { module: false })
    })

    after(async () => {
      await fs.remove(testRootDir)
    })

    it('should load core config first', async () => {
      const mockApp = { rootDir: testRootDir, name: 'adapt-authoring-core' }
      const loader = new DependencyLoader(mockApp)
      await loader.loadConfigs()
      const names = Object.keys(loader.configs)
      assert.equal(names[0], 'adapt-authoring-core')
    })
  })

  describe('#loadModuleConfig()', () => {
    let testModuleDir

    before(async () => {
      // Create a temporary test module directory
      testModuleDir = path.join(__dirname, 'data', 'test-module')
      await fs.ensureDir(testModuleDir)

      await fs.writeJson(path.join(testModuleDir, 'package.json'), {
        name: 'test-module',
        version: '1.0.0'
      })

      await fs.writeJson(path.join(testModuleDir, 'adapt-authoring.json'), {
        module: true,
        essentialType: 'api'
      })
    })

    after(async () => {
      // Clean up
      await fs.remove(testModuleDir)
    })

    it('should load and merge package.json and adapt-authoring.json', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)

      const config = await loader.loadModuleConfig(testModuleDir)

      assert.equal(config.name, 'test-module')
      assert.equal(config.version, '1.0.0')
      assert.equal(config.module, true)
      assert.equal(config.essentialType, 'api')
      assert.equal(config.rootDir, testModuleDir)
    })

    it('should override package.json values with adapt-authoring.json values', async () => {
      const overrideDir = path.join(__dirname, 'data', 'override-module')
      await fs.ensureDir(overrideDir)
      await fs.writeJson(path.join(overrideDir, 'package.json'), {
        name: 'pkg-name',
        description: 'from package'
      })
      await fs.writeJson(path.join(overrideDir, 'adapt-authoring.json'), {
        name: 'adapt-name',
        description: 'from adapt'
      })

      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      const config = await loader.loadModuleConfig(overrideDir)

      assert.equal(config.name, 'adapt-name')
      assert.equal(config.description, 'from adapt')

      await fs.remove(overrideDir)
    })

    it('should set rootDir to the module directory', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)

      const config = await loader.loadModuleConfig(testModuleDir)

      assert.equal(config.rootDir, testModuleDir)
    })
  })

  describe('#loadModules()', () => {
    it('should throw DependencyError when module fails without force', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader.configs = { 'nonexistent-module': { module: true, name: 'nonexistent-module' } }

      await assert.rejects(
        loader.loadModules(['nonexistent-module']),
        { name: 'DependencyError' }
      )
    })

    it('should not throw when module fails with force option', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader.configs = { 'nonexistent-module': { module: true, name: 'nonexistent-module' } }

      await loader.loadModules(['nonexistent-module'], { force: true })

      assert.ok(loader.failedModules.includes('nonexistent-module'))
    })

    it('should log peer dependency warnings on failure with force', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader.configs = { 'nonexistent-module': { module: true, name: 'nonexistent-module' } }
      loader.peerDependencies = { 'nonexistent-module': ['dependent-mod'] }

      await loader.loadModules(['nonexistent-module'], { force: true })

      assert.ok(loader.failedModules.includes('nonexistent-module'))
    })

    it('should include module name in DependencyError message', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader.configs = { 'nonexistent-module': { module: true, name: 'nonexistent-module' } }

      await assert.rejects(
        loader.loadModules(['nonexistent-module']),
        (err) => {
          assert.ok(err.message.includes('nonexistent-module'))
          return true
        }
      )
    })

    it('should set cause on DependencyError', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader.configs = { 'nonexistent-module': { module: true, name: 'nonexistent-module' } }

      try {
        await loader.loadModules(['nonexistent-module'])
        assert.fail('should have thrown')
      } catch (err) {
        assert.ok(err.cause)
      }
    })

    it('should handle empty module list', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)

      await loader.loadModules([])

      assert.deepEqual(loader.failedModules, [])
    })
  })

  describe('#loadModule()', () => {
    it('should throw when module already exists', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader.instances = { 'existing-module': {} }

      await assert.rejects(
        loader.loadModule('existing-module'),
        { message: 'Module already exists' }
      )
    })

    it('should skip loading when config.module is false', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader.configs = { 'non-module': { module: false } }

      const result = await loader.loadModule('non-module')

      assert.equal(result, undefined)
    })

    it('should not add to instances when config.module is false', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader.configs = { 'non-module': { module: false } }

      await loader.loadModule('non-module')

      assert.equal(loader.instances['non-module'], undefined)
    })
  })

  describe('#waitForModule()', () => {
    it('should throw for missing module', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader._configsLoaded = true
      loader.configs = {}

      await assert.rejects(
        loader.waitForModule('adapt-authoring-missing'),
        { message: "Missing required module 'adapt-authoring-missing'" }
      )
    })

    it('should throw for failed module', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader._configsLoaded = true
      loader.configs = { 'adapt-authoring-failed': { name: 'adapt-authoring-failed' } }
      loader.failedModules = ['adapt-authoring-failed']

      await assert.rejects(
        loader.waitForModule('adapt-authoring-failed'),
        { message: "Dependency 'adapt-authoring-failed' failed to load" }
      )
    })

    it('should return instance when module is already loaded', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader._configsLoaded = true
      const mockInstance = {
        name: 'adapt-authoring-test',
        _isReady: true,
        onReady: async () => mockInstance
      }
      loader.configs = { 'adapt-authoring-test': { name: 'adapt-authoring-test' } }
      loader.instances = { 'adapt-authoring-test': mockInstance }

      const result = await loader.waitForModule('adapt-authoring-test')

      assert.equal(result, mockInstance)
    })

    it('should prepend adapt-authoring- prefix when not present', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader._configsLoaded = true
      const mockInstance = {
        name: 'adapt-authoring-shortname',
        _isReady: true,
        onReady: async () => mockInstance
      }
      loader.configs = { 'adapt-authoring-shortname': { name: 'adapt-authoring-shortname' } }
      loader.instances = { 'adapt-authoring-shortname': mockInstance }

      const result = await loader.waitForModule('shortname')

      assert.equal(result, mockInstance)
    })

    it('should not double-prefix names that already have the prefix', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader._configsLoaded = true
      const mockInstance = {
        name: 'adapt-authoring-server',
        _isReady: true,
        onReady: async () => mockInstance
      }
      loader.configs = { 'adapt-authoring-server': { name: 'adapt-authoring-server' } }
      loader.instances = { 'adapt-authoring-server': mockInstance }

      const result = await loader.waitForModule('adapt-authoring-server')

      assert.equal(result, mockInstance)
    })

    it('should resolve via moduleLoadedHook when module not yet loaded', async () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader._configsLoaded = true
      loader.configs = { 'adapt-authoring-pending': { name: 'adapt-authoring-pending' } }

      const mockInstance = { name: 'adapt-authoring-pending' }

      const waitPromise = loader.waitForModule('adapt-authoring-pending')

      await loader.moduleLoadedHook.invoke(null, mockInstance)

      const result = await waitPromise
      assert.equal(result, mockInstance)
    })
  })

  describe('#logProgress()', () => {
    it('should not throw when called with valid instance', () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader.configs = {
        'test-module': { name: 'test-module', module: true }
      }
      loader.instances = {
        'test-module': { name: 'test-module', _isReady: true }
      }

      const mockInstance = {
        name: 'test-module',
        initTime: 100
      }

      assert.doesNotThrow(() => {
        loader.logProgress(null, mockInstance)
      })
    })

    it('should return early when error is passed', () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)

      assert.doesNotThrow(() => {
        loader.logProgress(new Error('test error'), null)
      })
    })

    it('should skip modules with module: false in progress count', () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader.configs = {
        'test-module': { name: 'test-module', module: true },
        'non-module': { name: 'non-module', module: false }
      }
      loader.instances = {
        'test-module': { name: 'test-module', _isReady: true, initTime: 50 }
      }

      // Should count 1/1 (100%), ignoring non-module
      assert.doesNotThrow(() => {
        loader.logProgress(null, { name: 'test-module', initTime: 50 })
      })
    })

    it('should count module being loaded as loaded even before _isReady', () => {
      const mockApp = { rootDir: '/test' }
      const loader = new DependencyLoader(mockApp)
      loader.configs = {
        'mod-a': { name: 'mod-a', module: true },
        'mod-b': { name: 'mod-b', module: true }
      }
      loader.instances = {}

      assert.doesNotThrow(() => {
        loader.logProgress(null, { name: 'mod-a', initTime: 10 })
      })
    })

    it('should log init times at 100% progress', () => {
      let loggedTimes
      const mockApp = {
        rootDir: '/test',
        logger: {
          _isReady: true,
          log: (level, name, ...args) => {
            if (typeof args[0] === 'object' && !Array.isArray(args[0]) && typeof args[0] !== 'string') {
              loggedTimes = args[0]
            }
          }
        }
      }
      const loader = new DependencyLoader(mockApp)
      loader.configs = {
        'mod-a': { name: 'mod-a', module: true }
      }
      loader.instances = {
        'mod-a': { name: 'mod-a', _isReady: true, initTime: 42 }
      }

      loader.logProgress(null, { name: 'mod-a', initTime: 42 })

      assert.ok(loggedTimes)
      assert.equal(loggedTimes['mod-a'], 42)
    })

    it('should include failed module names in log output', () => {
      let loggedMessage
      const mockApp = {
        rootDir: '/test',
        logger: {
          _isReady: true,
          log: (level, name, ...args) => {
            if (typeof args[0] === 'string' && args[0] === 'LOAD') {
              loggedMessage = args[1]
            }
          }
        }
      }
      const loader = new DependencyLoader(mockApp)
      loader.configs = {
        'adapt-authoring-ok': { name: 'adapt-authoring-ok', module: true },
        'adapt-authoring-bad': { name: 'adapt-authoring-bad', module: true }
      }
      loader.instances = {
        'adapt-authoring-ok': { name: 'adapt-authoring-ok', _isReady: true, initTime: 10 }
      }
      loader.failedModules = ['adapt-authoring-bad']

      loader.logProgress(null, { name: 'adapt-authoring-ok', initTime: 10 })

      assert.ok(loggedMessage)
      assert.ok(loggedMessage.includes('failed'))
    })
  })
})
