import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

// Mock the AbstractModule from adapt-authoring-core
class MockAbstractModule {
  async init () {}
}

// Create a test version of AuthoredModule that doesn't require adapt-authoring-core
class AuthoredModuleTest extends MockAbstractModule {
  async init () {
    await super.init()
    this.schemaName = 'authored'
    this.registeredModules = []

    const jsonschema = await this.app.waitForModule('jsonschema')
    jsonschema.registerSchemasHook.tap(this.registerSchemas.bind(this))
  }

  async registerModule (mod, options = {}) {
    if (this.registeredModules.includes(mod)) {
      throw this.app.errors.DUPL_AUTHORED_MODULE_NAME
        .setData({ name: mod.name })
    }
    if (!mod.isApiModule) {
      throw this.app.errors.API_MODULE_INVALID_CLASS
        .setData({ name: mod.name })
    }
    if (mod.schemaName) {
      const jsonschema = await this.app.waitForModule('jsonschema')
      jsonschema.extendSchema(mod.schemaName, this.schemaName)
    }
    this.registeredModules.push(mod)
    await this.registerSchemas()

    mod.requestHook.tap(this.updateAuthor)
    mod.preInsertHook.tap((insertData) => this.updateTimestamps('insert', insertData))
    mod.preUpdateHook.tap((ogDoc, updateData) => this.updateTimestamps('update', updateData))
    mod.preDeleteHook.tap((ogDoc) => this.updateCourseTimestamp(ogDoc))
  }

  async registerSchemas () {
    const jsonschema = await this.app.waitForModule('jsonschema')
    this.registeredModules.forEach(mod => {
      try {
        jsonschema.extendSchema(mod.schemaName, this.schemaName)
      } catch (e) {}
    })
  }

  async updateAuthor (req) {
    if (req.method === 'POST' && req.apiData.modifying && !req.apiData.data.createdBy) {
      req.apiData.data.createdBy = req.auth.user._id.toString()
    }
  }

  async updateTimestamps (action, data) {
    data.updatedAt = new Date().toISOString()
    if (action === 'insert') data.createdAt = data.updatedAt
    await this.updateCourseTimestamp(data)
  }

  async updateCourseTimestamp (data) {
    const [content, mongodb] = await this.app.waitForModule('content', 'mongodb')
    const [config] = await content.find({ _type: 'config', _courseId: data._courseId })
    if (!config) return
    const formattedData = { $set: { updatedAt: new Date().toISOString() } }
    await mongodb.update(content.collectionName, { _id: config._id }, formattedData)
  }
}

describe('AuthoredModule', () => {
  let instance
  let mockApp
  let mockJsonSchema
  let mockMod
  let mockMongodb
  let mockContent

  beforeEach(() => {
    // Create mock jsonschema module
    mockJsonSchema = {
      registerSchemasHook: {
        tap: mock.fn()
      },
      extendSchema: mock.fn()
    }

    // Create mock mongodb module
    mockMongodb = {
      update: mock.fn()
    }

    // Create mock content module
    mockContent = {
      collectionName: 'content',
      find: mock.fn()
    }

    // Create mock app
    mockApp = {
      waitForModule: mock.fn(async (...names) => {
        const modules = names.map(name => {
          if (name === 'jsonschema') return mockJsonSchema
          if (name === 'mongodb') return mockMongodb
          if (name === 'content') return mockContent
          return null
        })
        return modules.length === 1 ? modules[0] : modules
      }),
      errors: {
        DUPL_AUTHORED_MODULE_NAME: {
          setData: mock.fn((data) => ({ name: 'DUPL_AUTHORED_MODULE_NAME', data }))
        },
        API_MODULE_INVALID_CLASS: {
          setData: mock.fn((data) => ({ name: 'API_MODULE_INVALID_CLASS', data }))
        }
      }
    }

    // Create mock API module
    mockMod = {
      name: 'testModule',
      isApiModule: true,
      schemaName: 'testSchema',
      requestHook: {
        tap: mock.fn()
      },
      preInsertHook: {
        tap: mock.fn()
      },
      preUpdateHook: {
        tap: mock.fn()
      },
      preDeleteHook: {
        tap: mock.fn()
      }
    }

    instance = new AuthoredModuleTest()
    instance.app = mockApp
  })

  describe('#init()', () => {
    it('should initialize with schema name and empty registered modules', async () => {
      await instance.init()
      assert.equal(instance.schemaName, 'authored')
      assert.ok(Array.isArray(instance.registeredModules))
      assert.equal(instance.registeredModules.length, 0)
    })

    it('should register schemas hook', async () => {
      await instance.init()
      assert.ok(mockJsonSchema.registerSchemasHook.tap.mock.calls.length > 0)
    })
  })

  describe('#registerModule()', () => {
    beforeEach(async () => {
      await instance.init()
      // Reset the registered modules for clean tests
      instance.registeredModules = []
    })

    it('should register a valid API module', async () => {
      await instance.registerModule(mockMod)
      assert.equal(instance.registeredModules.includes(mockMod), true)
    })

    it('should throw error when registering duplicate module', async () => {
      instance.registeredModules = [mockMod]
      await assert.rejects(
        async () => await instance.registerModule(mockMod),
        { name: 'DUPL_AUTHORED_MODULE_NAME' }
      )
    })

    it('should throw error when module is not an API module', async () => {
      const invalidMod = {
        name: 'invalidModule',
        isApiModule: false
      }
      await assert.rejects(
        async () => await instance.registerModule(invalidMod),
        { name: 'API_MODULE_INVALID_CLASS' }
      )
    })

    it('should extend schema if module has schemaName', async () => {
      instance.registeredModules = []
      const callsBefore = mockJsonSchema.extendSchema.mock.calls.length
      await instance.registerModule(mockMod)
      assert.ok(mockJsonSchema.extendSchema.mock.calls.length > callsBefore)
    })

    it('should register hooks on module', async () => {
      instance.registeredModules = []
      await instance.registerModule(mockMod)
      assert.ok(mockMod.requestHook.tap.mock.calls.length > 0)
      assert.ok(mockMod.preInsertHook.tap.mock.calls.length > 0)
      assert.ok(mockMod.preUpdateHook.tap.mock.calls.length > 0)
      assert.ok(mockMod.preDeleteHook.tap.mock.calls.length > 0)
    })
  })

  describe('#registerSchemas()', () => {
    it('should extend schemas for all registered modules', async () => {
      await instance.init()
      instance.registeredModules = [mockMod]
      const callsBefore = mockJsonSchema.extendSchema.mock.calls.length
      await instance.registerSchemas()
      assert.ok(mockJsonSchema.extendSchema.mock.calls.length > callsBefore)
    })

    it('should not throw if schema extension fails', async () => {
      mockJsonSchema.extendSchema = mock.fn(() => {
        throw new Error('Schema extension failed')
      })
      instance.registeredModules = [mockMod]
      // Should not throw
      await assert.doesNotReject(async () => await instance.registerSchemas())
    })
  })

  describe('#updateAuthor()', () => {
    it('should set createdBy for POST requests with modifying data', async () => {
      const req = {
        method: 'POST',
        apiData: {
          modifying: true,
          data: {}
        },
        auth: {
          user: {
            _id: {
              toString: () => 'user123'
            }
          }
        }
      }
      await instance.updateAuthor(req)
      assert.equal(req.apiData.data.createdBy, 'user123')
    })

    it('should not set createdBy if already present', async () => {
      const req = {
        method: 'POST',
        apiData: {
          modifying: true,
          data: {
            createdBy: 'existingUser'
          }
        },
        auth: {
          user: {
            _id: {
              toString: () => 'user123'
            }
          }
        }
      }
      await instance.updateAuthor(req)
      assert.equal(req.apiData.data.createdBy, 'existingUser')
    })

    it('should not set createdBy for non-POST requests', async () => {
      const req = {
        method: 'GET',
        apiData: {
          modifying: true,
          data: {}
        },
        auth: {
          user: {
            _id: {
              toString: () => 'user123'
            }
          }
        }
      }
      await instance.updateAuthor(req)
      assert.equal(req.apiData.data.createdBy, undefined)
    })

    it('should not set createdBy if not modifying', async () => {
      const req = {
        method: 'POST',
        apiData: {
          modifying: false,
          data: {}
        },
        auth: {
          user: {
            _id: {
              toString: () => 'user123'
            }
          }
        }
      }
      await instance.updateAuthor(req)
      assert.equal(req.apiData.data.createdBy, undefined)
    })
  })

  describe('#updateTimestamps()', () => {
    it('should set updatedAt timestamp', async () => {
      const data = { _courseId: 'course123' }
      mockContent.find = mock.fn(async () => [])
      const beforeTime = new Date().toISOString()
      await instance.updateTimestamps('update', data)
      const afterTime = new Date().toISOString()
      assert.ok(data.updatedAt)
      assert.ok(data.updatedAt >= beforeTime)
      assert.ok(data.updatedAt <= afterTime)
    })

    it('should set createdAt timestamp for insert action', async () => {
      const data = { _courseId: 'course123' }
      mockContent.find = mock.fn(async () => [])
      await instance.updateTimestamps('insert', data)
      assert.ok(data.createdAt)
      assert.ok(data.updatedAt)
      assert.equal(data.createdAt, data.updatedAt)
    })

    it('should not set createdAt timestamp for update action', async () => {
      const data = { _courseId: 'course123' }
      mockContent.find = mock.fn(async () => [])
      await instance.updateTimestamps('update', data)
      assert.ok(data.updatedAt)
      assert.equal(data.createdAt, undefined)
    })

    it('should format timestamps as ISO strings', async () => {
      const data = { _courseId: 'course123' }
      mockContent.find = mock.fn(async () => [])
      await instance.updateTimestamps('insert', data)
      assert.equal(typeof data.updatedAt, 'string')
      assert.equal(typeof data.createdAt, 'string')
      // Verify ISO format
      assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(data.updatedAt))
    })
  })

  describe('#updateCourseTimestamp()', () => {
    it('should update course config timestamp when config exists', async () => {
      const mockConfig = { _id: 'config123' }
      mockContent.find = mock.fn(async () => [mockConfig])
      mockMongodb.update = mock.fn(async () => {})

      const data = { _courseId: 'course123' }
      await instance.updateCourseTimestamp(data)

      assert.ok(mockContent.find.mock.calls.length > 0)
      assert.ok(mockMongodb.update.mock.calls.length > 0)
    })

    it('should not update if no config found', async () => {
      mockContent.find = mock.fn(async () => [])
      mockMongodb.update = mock.fn(async () => {})

      const data = { _courseId: 'course123' }
      const updateCallsBefore = mockMongodb.update.mock.calls.length
      await instance.updateCourseTimestamp(data)

      assert.equal(mockMongodb.update.mock.calls.length, updateCallsBefore)
    })

    it('should query for correct course config', async () => {
      mockContent.find = mock.fn(async (query) => {
        assert.equal(query._type, 'config')
        assert.equal(query._courseId, 'course456')
        return []
      })

      const data = { _courseId: 'course456' }
      await instance.updateCourseTimestamp(data)
    })

    it('should update with current timestamp', async () => {
      const mockConfig = { _id: 'config123' }
      mockContent.find = mock.fn(async () => [mockConfig])
      mockMongodb.update = mock.fn(async (collection, query, updateData) => {
        assert.equal(collection, 'content')
        assert.deepEqual(query, { _id: 'config123' })
        assert.ok(updateData.$set)
        assert.ok(updateData.$set.updatedAt)
        assert.equal(typeof updateData.$set.updatedAt, 'string')
      })

      const data = { _courseId: 'course123' }
      await instance.updateCourseTimestamp(data)
    })
  })
})
