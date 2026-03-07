import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import AbstractModule from '../lib/AbstractModule.js'

describe('AbstractModule', () => {
  describe('.MODULE_READY', () => {
    it('should return MODULE_READY constant', () => {
      assert.equal(AbstractModule.MODULE_READY, 'MODULE_READY')
    })
  })

  describe('constructor', () => {
    it('should create an instance with app and pkg', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const pkg = { name: 'test-module', rootDir: '/test' }
      const module = new AbstractModule(mockApp, pkg)

      await module.onReady().catch(() => {}) // Wait for init

      assert.equal(module.app, mockApp)
      assert.equal(module.pkg, pkg)
      assert.equal(module.name, 'test-module')
      assert.equal(module.rootDir, '/test')
    })

    it('should use constructor name if pkg.name is not provided', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, {})

      await module.onReady().catch(() => {})

      assert.equal(module.name, 'AbstractModule')
    })

    it('should initialize readyHook for lifecycle management', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test' })

      await module.onReady().catch(() => {})

      // readyHook should be initialized and usable
      assert.ok(module.readyHook)
      let hookCalled = false
      module.readyHook.tap(() => { hookCalled = true })
      await module.readyHook.invoke()
      assert.equal(hookCalled, true)
    })

    it('should use constructor name when pkg is undefined', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, undefined)
      await module.onReady()
      assert.equal(module.name, 'AbstractModule')
    })

    it('should use subclass constructor name when pkg.name is empty', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }

      class MyCustomModule extends AbstractModule {
        async init () {}
      }

      const module = new MyCustomModule(mockApp, { name: '' })
      await module.onReady()
      assert.equal(module.name, 'MyCustomModule')
    })

    it('should set _startTime during construction', async () => {
      const before = Date.now()
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test' })
      const after = Date.now()
      await module.onReady()
      assert.ok(module._startTime >= before)
      assert.ok(module._startTime <= after)
    })

    it('should initialise initTime as undefined', () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test' })
      assert.equal(module.initTime, undefined)
    })
  })

  describe('#init()', () => {
    it('should be called automatically during construction', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      let initCalled = false

      class TestModule extends AbstractModule {
        async init () {
          initCalled = true
        }
      }

      const module = new TestModule(mockApp, { name: 'test' })
      await module.onReady()

      assert.equal(initCalled, true)
    })

    it('should handle errors thrown in init', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }

      class TestModule extends AbstractModule {
        async init () {
          throw new Error('init error')
        }
      }

      const module = new TestModule(mockApp, { name: 'test' })
      await assert.rejects(module.onReady(), { message: 'init error' })
    })

    it('should handle async init that resolves', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      let completed = false

      class TestModule extends AbstractModule {
        async init () {
          await new Promise(resolve => setTimeout(resolve, 5))
          completed = true
        }
      }

      const module = new TestModule(mockApp, { name: 'test' })
      await module.onReady()
      assert.equal(completed, true)
    })

    it('should default init to a no-op that resolves', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test' })
      await module.onReady()
      assert.equal(module._isReady, true)
    })
  })

  describe('#setReady()', () => {
    it('should set _isReady to true when no error', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test' })

      await module.onReady()

      assert.equal(module._isReady, true)
    })

    it('should not set _isReady when error is passed', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }

      class TestModule extends AbstractModule {
        async init () {
          throw new Error('test error')
        }
      }

      const module = new TestModule(mockApp, { name: 'test' })

      try {
        await module.onReady()
      } catch (e) {
        // Expected
      }

      assert.equal(module._isReady, false)
    })

    it('should calculate initTime', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test' })

      await module.onReady()

      assert.equal(typeof module.initTime, 'number')
      assert.ok(module.initTime >= 0)
    })

    it('should not call setReady multiple times', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test' })

      await module.onReady()
      const firstInitTime = module.initTime

      await module.setReady()

      assert.equal(module.initTime, firstInitTime)
    })

    it('should calculate initTime even on error', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }

      class TestModule extends AbstractModule {
        async init () {
          throw new Error('fail')
        }
      }

      const module = new TestModule(mockApp, { name: 'test' })
      try { await module.onReady() } catch (e) { /* expected */ }
      assert.equal(typeof module.initTime, 'number')
      assert.ok(module.initTime >= 0)
    })
  })

  describe('#onReady()', () => {
    it('should return a promise', () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test' })
      const result = module.onReady()

      assert.ok(result instanceof Promise)
    })

    it('should resolve when module is ready', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test' })

      const resolvedModule = await module.onReady()

      assert.equal(resolvedModule, module)
    })

    it('should reject when module initialization fails', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }

      class TestModule extends AbstractModule {
        async init () {
          throw new Error('init failed')
        }
      }

      const module = new TestModule(mockApp, { name: 'test' })

      await assert.rejects(module.onReady(), { message: 'init failed' })
    })

    it('should resolve immediately if already ready', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test' })

      await module.onReady()

      const resolvedModule = await module.onReady()

      assert.equal(resolvedModule, module)
    })

    // TODO: Bug - onReady() hangs forever after a failed init, because _isReady
    // remains false and readyHook has already been invoked, so the tap never fires.
    // Calling onReady() a second time after a failure will never resolve or reject.
    it('should support multiple concurrent onReady calls', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test' })
      const [r1, r2] = await Promise.all([module.onReady(), module.onReady()])
      assert.equal(r1, module)
      assert.equal(r2, module)
    })
  })

  describe('#getConfig()', () => {
    it('should return undefined when app.config is not available', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test-module' })

      await module.onReady()

      const result = module.getConfig('someKey')

      assert.equal(result, undefined)
    })

    it('should return config value when available', async () => {
      const mockApp = {
        config: {
          get: (key) => {
            if (key === 'test-module.testKey') return 'testValue'
          }
        },
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test-module' })

      await module.onReady()

      const result = module.getConfig('testKey')

      assert.equal(result, 'testValue')
    })

    it('should return undefined if config.get throws', async () => {
      const mockApp = {
        config: {
          get: () => {
            throw new Error('config error')
          }
        },
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test-module' })

      await module.onReady()

      const result = module.getConfig('someKey')

      assert.equal(result, undefined)
    })

    it('should construct key from module name and config key', async () => {
      let requestedKey
      const mockApp = {
        config: {
          get: (key) => { requestedKey = key; return 'value' }
        },
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'my-module' })

      await module.onReady()

      module.getConfig('myKey')

      assert.equal(requestedKey, 'my-module.myKey')
    })
  })

  describe('#log()', () => {
    it('should not throw when logger is not available', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test' })

      await module.onReady()

      assert.doesNotThrow(() => {
        module.log('info', 'test message')
      })
    })

    it('should call logger when available', async () => {
      let loggedMessage
      const mockApp = {
        logger: {
          name: 'logger',
          log: (level, moduleName, ...args) => {
            loggedMessage = { level, moduleName, args }
          }
        },
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'adapt-authoring-test' })

      await module.onReady()

      module.log('info', 'test message')

      assert.equal(loggedMessage.level, 'info')
      assert.equal(loggedMessage.moduleName, 'test')
      assert.deepEqual(loggedMessage.args, ['test message'])
    })

    it('should strip adapt-authoring- prefix from module name in log', async () => {
      let loggedModuleName
      const mockApp = {
        logger: {
          name: 'logger',
          log: (level, moduleName) => {
            loggedModuleName = moduleName
          }
        },
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'adapt-authoring-mymod' })

      await module.onReady()

      module.log('debug', 'hello')

      assert.equal(loggedModuleName, 'mymod')
    })

    it('should not strip prefix when name does not start with adapt-authoring-', async () => {
      let loggedModuleName
      const mockApp = {
        logger: {
          name: 'logger',
          log: (level, moduleName) => {
            loggedModuleName = moduleName
          }
        },
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'custom-module' })

      await module.onReady()

      module.log('debug', 'hello')

      assert.equal(loggedModuleName, 'custom-module')
    })

    it('should pass multiple rest arguments to logger', async () => {
      let loggedArgs
      const mockApp = {
        logger: {
          name: 'logger',
          log: (level, moduleName, ...args) => {
            loggedArgs = args
          }
        },
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test' })

      await module.onReady()

      module.log('info', 'arg1', 'arg2', 'arg3')

      assert.deepEqual(loggedArgs, ['arg1', 'arg2', 'arg3'])
    })

    it('should queue log and deliver when logger module loads', async () => {
      let loggedLevel
      let tapCallback
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: (fn) => { tapCallback = fn },
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test-mod' })
      await module.onReady()

      module.log('warn', 'deferred message')
      assert.ok(tapCallback)

      mockApp.logger = {
        name: 'adapt-authoring-logger',
        log: (level) => {
          loggedLevel = level
        }
      }

      tapCallback(null, { name: 'adapt-authoring-logger' })
      assert.equal(loggedLevel, 'warn')
    })

    it('should not log when loaded module is not the logger', async () => {
      const logCalled = false
      let tapCallback
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: (fn) => { tapCallback = fn },
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, { name: 'test-mod' })
      await module.onReady()

      // No logger set yet, so log queues the callback
      module.log('info', 'some message')
      assert.ok(tapCallback)

      // Now simulate a non-logger module loading - _log checks !this.app.logger
      // which is true (no logger), so it returns false
      const result = tapCallback(null, { name: 'adapt-authoring-other' })
      assert.equal(result, false)
      assert.equal(logCalled, false)
    })
  })

  describe('constructor with null pkg', () => {
    it('should use constructor name when pkg is null', async () => {
      const mockApp = {
        dependencyloader: {
          moduleLoadedHook: {
            tap: () => {},
            untap: () => {}
          }
        }
      }
      const module = new AbstractModule(mockApp, null)

      await module.onReady()

      assert.equal(module.name, 'AbstractModule')
      assert.equal(module.rootDir, undefined)
    })
  })
})
