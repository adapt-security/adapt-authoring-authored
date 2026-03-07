import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

import { loadDependencyFiles } from '../lib/utils/loadDependencyFiles.js'

async function makeTempDir (suffix) {
  return fs.mkdtemp(path.join(os.tmpdir(), `loadDepFiles-${suffix}-`))
}

describe('loadDependencyFiles()', () => {
  it('should return file paths grouped by module name', async () => {
    const dir = await makeTempDir('paths')
    await fs.writeFile(path.join(dir, 'a.json'), '{"x":1}')
    const deps = { mymod: { name: 'mymod', rootDir: dir } }
    try {
      const result = await loadDependencyFiles('*.json', { dependencies: deps })
      assert.ok(result.mymod, 'should have entry for mymod')
      assert.equal(result.mymod.length, 1)
      assert.ok(result.mymod[0].endsWith('a.json'))
    } finally {
      await fs.rm(dir, { recursive: true })
    }
  })

  it('should parse JSON when parse option is true', async () => {
    const dir = await makeTempDir('parse')
    await fs.writeFile(path.join(dir, 'b.json'), '{"key":"value"}')
    const deps = { mymod: { name: 'mymod', rootDir: dir } }
    try {
      const result = await loadDependencyFiles('*.json', { parse: true, dependencies: deps })
      assert.ok(result.mymod, 'should have entry for mymod')
      assert.equal(result.mymod.length, 1)
      assert.deepEqual(result.mymod[0], { key: 'value' })
    } finally {
      await fs.rm(dir, { recursive: true })
    }
  })

  it('should return empty object when no files match', async () => {
    const dir = await makeTempDir('nomatch')
    const deps = { mymod: { name: 'mymod', rootDir: dir } }
    try {
      const result = await loadDependencyFiles('errors/*.json', { dependencies: deps })
      assert.deepEqual(result, {})
    } finally {
      await fs.rm(dir, { recursive: true })
    }
  })

  it('should group files by module name across multiple deps', async () => {
    const dir1 = await makeTempDir('multi1')
    const dir2 = await makeTempDir('multi2')
    await fs.writeFile(path.join(dir1, 'x.json'), '"a"')
    await fs.writeFile(path.join(dir2, 'y.json'), '"b"')
    const deps = {
      mod1: { name: 'mod1', rootDir: dir1 },
      mod2: { name: 'mod2', rootDir: dir2 }
    }
    try {
      const result = await loadDependencyFiles('*.json', { dependencies: deps })
      assert.ok(result.mod1)
      assert.ok(result.mod2)
      assert.equal(result.mod1.length, 1)
      assert.equal(result.mod2.length, 1)
    } finally {
      await fs.rm(dir1, { recursive: true })
      await fs.rm(dir2, { recursive: true })
    }
  })

  it('should not include modules with no matching files', async () => {
    const dir1 = await makeTempDir('partial1')
    const dir2 = await makeTempDir('partial2')
    await fs.writeFile(path.join(dir1, 'match.json'), '{}')
    const deps = {
      mod1: { name: 'mod1', rootDir: dir1 },
      mod2: { name: 'mod2', rootDir: dir2 }
    }
    try {
      const result = await loadDependencyFiles('*.json', { dependencies: deps })
      assert.ok(result.mod1)
      assert.equal(result.mod2, undefined)
    } finally {
      await fs.rm(dir1, { recursive: true })
      await fs.rm(dir2, { recursive: true })
    }
  })
})
