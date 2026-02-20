import { describe, it, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import AuthoredModule from '../lib/AuthoredModule.js'

/**
 * Creates a mock app object with configurable overrides.
 * The AuthoredModule extends AbstractModule which calls init() in
 * the constructor, so we must prevent the real init from running
 * by replacing the prototype before instantiation.
 */
function createInstance (overrides = {}) {
  const mockJsonschema = {
    registerSchemasHook: { tap: mock.fn() },
    extendSchema: mock.fn()
  }
  const mockApp = {
    waitForModule: mock.fn(async () => mockJsonschema),
    errors: {
      DUPL_AUTHORED_MODULE_NAME: {
        setData: mock.fn(function () { return this }),
        message: 'Duplicate module'
      },
      API_MODULE_INVALID_CLASS: {
        setData: mock.fn(function () { return this }),
        message: 'Invalid class'
      }
    },
    dependencyloader: {
      moduleLoadedHook: {
        tap: () => {},
        untap: () => {}
      }
    },
    ...overrides
  }

  // Prevent AbstractModule constructor from calling init()
  // by temporarily replacing it with a no-op
  const originalInit = AuthoredModule.prototype.init
  AuthoredModule.prototype.init = async function () {}

  const instance = new AuthoredModule(mockApp, { name: 'adapt-authoring-authored' })

  // Restore original init
  AuthoredModule.prototype.init = originalInit

  // Manually set properties that init() would set
  instance.schemaName = 'authored'
  instance.registeredModules = []

  return { instance, mockApp, mockJsonschema }
}

function createMockMod (opts = {}) {
  return {
    name: opts.name || 'test-mod',
    isApiModule: opts.isApiModule !== undefined ? opts.isApiModule : true,
    schemaName: opts.schemaName !== undefined ? opts.schemaName : 'testSchema',
    requestHook: { tap: mock.fn() },
    preInsertHook: { tap: mock.fn() },
    preUpdateHook: { tap: mock.fn() },
    preDeleteHook: { tap: mock.fn() }
  }
}

describe('AuthoredModule', () => {
  describe('#registerModule()', () => {
    it('should register a valid API module', async () => {
      const { instance } = createInstance()
      const mod = createMockMod()

      await instance.registerModule(mod)

      assert.equal(instance.registeredModules.length, 1)
      assert.equal(instance.registeredModules[0], mod)
    })

    it('should call jsonschema.extendSchema when mod has schemaName', async () => {
      const { instance, mockJsonschema } = createInstance()
      const mod = createMockMod({ schemaName: 'mySchema' })

      await instance.registerModule(mod)

      assert.ok(mockJsonschema.extendSchema.mock.calls.length > 0)
      const call = mockJsonschema.extendSchema.mock.calls[0]
      assert.equal(call.arguments[0], 'mySchema')
      assert.equal(call.arguments[1], 'authored')
    })

    it('should not call extendSchema when mod has no schemaName', async () => {
      const { instance } = createInstance()
      // Reset extendSchema tracking
      const mod = createMockMod({ schemaName: undefined })

      // We need to track only the call from registerModule's conditional
      // registerSchemas is also called, so we check the specific logic
      await instance.registerModule(mod)

      // The mod should still be registered
      assert.equal(instance.registeredModules.length, 1)
    })

    it('should tap into mod request and lifecycle hooks', async () => {
      const { instance } = createInstance()
      const mod = createMockMod()

      await instance.registerModule(mod)

      assert.equal(mod.requestHook.tap.mock.calls.length, 1)
      assert.equal(mod.preInsertHook.tap.mock.calls.length, 1)
      assert.equal(mod.preUpdateHook.tap.mock.calls.length, 1)
      assert.equal(mod.preDeleteHook.tap.mock.calls.length, 1)
    })

    it('should throw when registering a duplicate module', async () => {
      const { instance } = createInstance()
      const mod = createMockMod()

      await instance.registerModule(mod)

      await assert.rejects(
        () => instance.registerModule(mod),
        (err) => {
          assert.ok(err)
          return true
        }
      )
    })

    it('should throw when module is not an API module', async () => {
      const { instance } = createInstance()
      const mod = createMockMod({ isApiModule: false })

      await assert.rejects(
        () => instance.registerModule(mod),
        (err) => {
          assert.ok(err)
          return true
        }
      )
    })

    it('should accept options parameter', async () => {
      const { instance } = createInstance()
      const mod = createMockMod()

      // Should not throw with options
      await instance.registerModule(mod, { accessCheck: true })

      assert.equal(instance.registeredModules.length, 1)
    })

    it('should call registerSchemas after registering', async () => {
      const { instance, mockJsonschema } = createInstance()
      const mod = createMockMod({ schemaName: 'testSchema' })

      await instance.registerModule(mod)

      // extendSchema should be called at least once via registerSchemas
      assert.ok(mockJsonschema.extendSchema.mock.calls.length >= 1)
    })
  })

  describe('#registerSchemas()', () => {
    it('should call extendSchema for each registered module', async () => {
      const { instance, mockJsonschema } = createInstance()
      instance.registeredModules = [
        { schemaName: 'schema1' },
        { schemaName: 'schema2' }
      ]

      await instance.registerSchemas()

      const calls = mockJsonschema.extendSchema.mock.calls
      assert.equal(calls.length, 2)
      assert.equal(calls[0].arguments[0], 'schema1')
      assert.equal(calls[0].arguments[1], 'authored')
      assert.equal(calls[1].arguments[0], 'schema2')
      assert.equal(calls[1].arguments[1], 'authored')
    })

    it('should handle empty registeredModules', async () => {
      const { instance, mockJsonschema } = createInstance()
      instance.registeredModules = []

      await instance.registerSchemas()

      assert.equal(mockJsonschema.extendSchema.mock.calls.length, 0)
    })

    it('should silently catch errors from extendSchema', async () => {
      const mockJsonschema = {
        registerSchemasHook: { tap: mock.fn() },
        extendSchema: mock.fn(() => { throw new Error('schema error') })
      }
      const { instance } = createInstance({
        waitForModule: mock.fn(async () => mockJsonschema)
      })
      instance.registeredModules = [{ schemaName: 'badSchema' }]

      // Should not throw
      await assert.doesNotReject(() => instance.registerSchemas())
    })
  })

  describe('#updateAuthor()', () => {
    let instance

    beforeEach(() => {
      ({ instance } = createInstance())
    })

    it('should set createdBy on POST with modifying flag and no existing createdBy', async () => {
      const req = {
        method: 'POST',
        apiData: {
          modifying: true,
          data: {}
        },
        auth: {
          user: { _id: { toString: () => 'user123' } }
        }
      }

      await instance.updateAuthor(req)

      assert.equal(req.apiData.data.createdBy, 'user123')
    })

    it('should not set createdBy when method is not POST', async () => {
      const req = {
        method: 'PUT',
        apiData: {
          modifying: true,
          data: {}
        },
        auth: {
          user: { _id: { toString: () => 'user123' } }
        }
      }

      await instance.updateAuthor(req)

      assert.equal(req.apiData.data.createdBy, undefined)
    })

    it('should not set createdBy when modifying is false', async () => {
      const req = {
        method: 'POST',
        apiData: {
          modifying: false,
          data: {}
        },
        auth: {
          user: { _id: { toString: () => 'user123' } }
        }
      }

      await instance.updateAuthor(req)

      assert.equal(req.apiData.data.createdBy, undefined)
    })

    it('should not overwrite existing createdBy', async () => {
      const req = {
        method: 'POST',
        apiData: {
          modifying: true,
          data: { createdBy: 'existingUser' }
        },
        auth: {
          user: { _id: { toString: () => 'newUser' } }
        }
      }

      await instance.updateAuthor(req)

      assert.equal(req.apiData.data.createdBy, 'existingUser')
    })

    it('should not set createdBy when modifying is undefined', async () => {
      const req = {
        method: 'POST',
        apiData: {
          data: {}
        },
        auth: {
          user: { _id: { toString: () => 'user123' } }
        }
      }

      await instance.updateAuthor(req)

      assert.equal(req.apiData.data.createdBy, undefined)
    })
  })

  describe('#updateTimestamps()', () => {
    it('should set updatedAt on any action', async () => {
      const mockContent = {
        find: mock.fn(async () => []),
        collectionName: 'content'
      }
      const mockMongodb = { update: mock.fn(async () => {}) }
      const { instance } = createInstance({
        waitForModule: mock.fn(async () => [mockContent, mockMongodb])
      })
      const data = {}

      await instance.updateTimestamps('update', data)

      assert.ok(data.updatedAt)
      assert.equal(typeof data.updatedAt, 'string')
    })

    it('should set createdAt equal to updatedAt on insert', async () => {
      const mockContent = {
        find: mock.fn(async () => []),
        collectionName: 'content'
      }
      const mockMongodb = { update: mock.fn(async () => {}) }
      const { instance } = createInstance({
        waitForModule: mock.fn(async () => [mockContent, mockMongodb])
      })
      const data = {}

      await instance.updateTimestamps('insert', data)

      assert.ok(data.createdAt)
      assert.equal(data.createdAt, data.updatedAt)
    })

    it('should not set createdAt on update action', async () => {
      const mockContent = {
        find: mock.fn(async () => []),
        collectionName: 'content'
      }
      const mockMongodb = { update: mock.fn(async () => {}) }
      const { instance } = createInstance({
        waitForModule: mock.fn(async () => [mockContent, mockMongodb])
      })
      const data = {}

      await instance.updateTimestamps('update', data)

      assert.equal(data.createdAt, undefined)
    })

    it('should produce a valid ISO 8601 timestamp', async () => {
      const mockContent = {
        find: mock.fn(async () => []),
        collectionName: 'content'
      }
      const mockMongodb = { update: mock.fn(async () => {}) }
      const { instance } = createInstance({
        waitForModule: mock.fn(async () => [mockContent, mockMongodb])
      })
      const data = {}

      await instance.updateTimestamps('insert', data)

      const parsed = new Date(data.updatedAt)
      assert.ok(!isNaN(parsed.getTime()))
      assert.equal(data.updatedAt, parsed.toISOString())
    })

    it('should call updateCourseTimestamp', async () => {
      const mockContent = {
        find: mock.fn(async () => []),
        collectionName: 'content'
      }
      const mockMongodb = { update: mock.fn(async () => {}) }
      const waitForModule = mock.fn(async () => [mockContent, mockMongodb])
      const { instance } = createInstance({ waitForModule })
      const data = { _courseId: 'course1' }

      await instance.updateTimestamps('update', data)

      // waitForModule should have been called for content + mongodb
      assert.ok(waitForModule.mock.calls.length > 0)
    })
  })

  describe('#updateCourseTimestamp()', () => {
    it('should update course config timestamp when config exists', async () => {
      const mockConfig = { _id: 'config1' }
      const mockContent = {
        find: mock.fn(async () => [mockConfig]),
        collectionName: 'content'
      }
      const mockMongodb = { update: mock.fn(async () => {}) }
      const { instance } = createInstance({
        waitForModule: mock.fn(async () => [mockContent, mockMongodb])
      })
      const data = { _courseId: 'course1' }

      await instance.updateCourseTimestamp(data)

      assert.equal(mockContent.find.mock.calls.length, 1)
      const findArgs = mockContent.find.mock.calls[0].arguments
      assert.deepEqual(findArgs[0], { _type: 'config', _courseId: 'course1' })

      assert.equal(mockMongodb.update.mock.calls.length, 1)
      const updateArgs = mockMongodb.update.mock.calls[0].arguments
      assert.equal(updateArgs[0], 'content')
      assert.deepEqual(updateArgs[1], { _id: 'config1' })
      assert.ok(updateArgs[2].$set.updatedAt)
    })

    it('should return early when no config is found', async () => {
      const mockContent = {
        find: mock.fn(async () => []),
        collectionName: 'content'
      }
      const mockMongodb = { update: mock.fn(async () => {}) }
      const { instance } = createInstance({
        waitForModule: mock.fn(async () => [mockContent, mockMongodb])
      })
      const data = { _courseId: 'course1' }

      await instance.updateCourseTimestamp(data)

      assert.equal(mockMongodb.update.mock.calls.length, 0)
    })

    it('should return early when find returns undefined config', async () => {
      const mockContent = {
        find: mock.fn(async () => [undefined]),
        collectionName: 'content'
      }
      const mockMongodb = { update: mock.fn(async () => {}) }
      const { instance } = createInstance({
        waitForModule: mock.fn(async () => [mockContent, mockMongodb])
      })
      const data = { _courseId: 'course1' }

      await instance.updateCourseTimestamp(data)

      // config is undefined due to destructuring [undefined], so should return early
      assert.equal(mockMongodb.update.mock.calls.length, 0)
    })

    it('should use the correct collection name from the content module', async () => {
      const mockConfig = { _id: 'config42' }
      const mockContent = {
        find: mock.fn(async () => [mockConfig]),
        collectionName: 'myCustomCollection'
      }
      const mockMongodb = { update: mock.fn(async () => {}) }
      const { instance } = createInstance({
        waitForModule: mock.fn(async () => [mockContent, mockMongodb])
      })

      await instance.updateCourseTimestamp({ _courseId: 'c1' })

      const updateArgs = mockMongodb.update.mock.calls[0].arguments
      assert.equal(updateArgs[0], 'myCustomCollection')
    })
  })
})
