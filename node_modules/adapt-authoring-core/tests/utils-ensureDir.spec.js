import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

import { ensureDir } from '../lib/utils/ensureDir.js'

describe('ensureDir()', () => {
  it('should create a directory that does not exist', async () => {
    const tmpDir = path.join(os.tmpdir(), `ensureDir-test-${Date.now()}`)
    try {
      await ensureDir(tmpDir)
      const stat = await fs.stat(tmpDir)
      assert.ok(stat.isDirectory())
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('should create nested directories recursively', async () => {
    const tmpDir = path.join(os.tmpdir(), `ensureDir-nested-${Date.now()}`, 'a', 'b', 'c')
    try {
      await ensureDir(tmpDir)
      const stat = await fs.stat(tmpDir)
      assert.ok(stat.isDirectory())
    } finally {
      await fs.rm(path.join(os.tmpdir(), `ensureDir-nested-${Date.now()}`), { recursive: true, force: true }).catch(() => {})
    }
  })

  it('should not throw if the directory already exists', async () => {
    const tmpDir = path.join(os.tmpdir(), `ensureDir-exists-${Date.now()}`)
    try {
      await fs.mkdir(tmpDir, { recursive: true })
      await assert.doesNotReject(() => ensureDir(tmpDir))
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})
