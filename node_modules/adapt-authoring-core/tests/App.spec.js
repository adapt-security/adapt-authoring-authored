import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import App from '../lib/App.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('App', () => {
  let testRootDir
  let originalRootDir

  before(async () => {
    testRootDir = path.join(__dirname, 'data', 'app-test')
    await fs.ensureDir(testRootDir)
    await fs.writeJson(path.join(testRootDir, 'package.json'), {
      name: 'test-app',
      version: '1.0.0'
    })
    await fs.writeJson(path.join(testRootDir, 'adapt-authoring.json'), {
      essentialApis: []
    })
    originalRootDir = process.env.ROOT_DIR
    process.env.ROOT_DIR = testRootDir
  })

  after(async () => {
    if (originalRootDir !== undefined) {
      process.env.ROOT_DIR = originalRootDir
    } else {
      delete process.env.ROOT_DIR
    }
    await fs.remove(testRootDir)
  })

  describe('.instance', () => {
    it('should return an App instance', () => {
      const app = App.instance
      assert.ok(app instanceof App)
    })

    it('should return the same instance on subsequent calls (singleton)', () => {
      const app1 = App.instance
      const app2 = App.instance
      assert.equal(app1, app2)
    })
  })

  describe('constructor', () => {
    it('should set name to adapt-authoring-core', () => {
      const app = App.instance
      assert.equal(app.name, 'adapt-authoring-core')
    })

    it('should set rootDir from ROOT_DIR env var', () => {
      const app = App.instance
      assert.equal(app.rootDir, testRootDir)
    })

    it('should initialize git info', () => {
      const app = App.instance
      assert.equal(typeof app.git, 'object')
    })
  })

  describe('#dependencies', () => {
    it('should return the dependency configs from dependencyloader', () => {
      const app = App.instance
      assert.equal(typeof app.dependencies, 'object')
      assert.equal(app.dependencies, app.dependencyloader.configs)
    })
  })

  describe('#getGitInfo()', () => {
    it('should return an object', () => {
      const app = App.instance
      const info = app.getGitInfo()
      assert.equal(typeof info, 'object')
    })

    it('should return empty object when .git directory does not exist', () => {
      const app = App.instance
      const origRootDir = app.rootDir
      app.rootDir = '/nonexistent/path'
      const info = app.getGitInfo()
      app.rootDir = origRootDir
      assert.deepEqual(info, {})
    })

    it('should return object with branch and commit when .git exists', async () => {
      const gitDir = path.join(testRootDir, '.git')
      const refsDir = path.join(gitDir, 'refs', 'heads')
      await fs.ensureDir(refsDir)
      await fs.writeFile(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n')
      await fs.writeFile(path.join(refsDir, 'main'), 'abc123def456\n')

      const app = App.instance
      const origRootDir = app.rootDir
      app.rootDir = testRootDir
      const info = app.getGitInfo()
      app.rootDir = origRootDir

      assert.equal(info.branch, 'main')
      assert.equal(info.commit, 'abc123def456')

      await fs.remove(gitDir)
    })
  })

  describe('#waitForModule()', () => {
    it('should delegate to dependencyloader.waitForModule', async () => {
      const app = App.instance
      let calledWith
      const origWaitForModule = app.dependencyloader.waitForModule.bind(app.dependencyloader)
      app.dependencyloader.waitForModule = async (name) => {
        calledWith = name
        return { name }
      }
      const result = await app.waitForModule('test-mod')
      app.dependencyloader.waitForModule = origWaitForModule

      assert.equal(calledWith, 'test-mod')
      assert.deepEqual(result, { name: 'test-mod' })
    })

    it('should return array when multiple module names are passed', async () => {
      const app = App.instance
      const origWaitForModule = app.dependencyloader.waitForModule.bind(app.dependencyloader)
      app.dependencyloader.waitForModule = async (name) => ({ name })
      const result = await app.waitForModule('mod-a', 'mod-b')
      app.dependencyloader.waitForModule = origWaitForModule

      assert.ok(Array.isArray(result))
      assert.equal(result.length, 2)
      assert.deepEqual(result[0], { name: 'mod-a' })
      assert.deepEqual(result[1], { name: 'mod-b' })
    })

    it('should return single result (not array) for single module', async () => {
      const app = App.instance
      const origWaitForModule = app.dependencyloader.waitForModule.bind(app.dependencyloader)
      app.dependencyloader.waitForModule = async (name) => ({ name })
      const result = await app.waitForModule('single-mod')
      app.dependencyloader.waitForModule = origWaitForModule

      assert.ok(!Array.isArray(result))
      assert.deepEqual(result, { name: 'single-mod' })
    })
  })

  describe('#setReady()', () => {
    it('should set _isStarting to false', async () => {
      const app = App.instance
      app._isStarting = true
      await app.setReady()
      assert.equal(app._isStarting, false)
    })
  })
})
