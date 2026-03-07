import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

import { writeJson } from '../lib/utils/writeJson.js'

describe('writeJson()', () => {
  it('should write formatted JSON to a file', async () => {
    const tmpFile = path.join(os.tmpdir(), `writeJson-test-${Date.now()}.json`)
    const data = { name: 'test', items: [1, 2, 3] }
    try {
      await writeJson(tmpFile, data)
      const content = await fs.readFile(tmpFile, 'utf-8')
      assert.equal(content, JSON.stringify(data, null, 2))
    } finally {
      await fs.unlink(tmpFile).catch(() => {})
    }
  })

  it('should overwrite an existing file', async () => {
    const tmpFile = path.join(os.tmpdir(), `writeJson-overwrite-${Date.now()}.json`)
    try {
      await writeJson(tmpFile, { old: true })
      await writeJson(tmpFile, { new: true })
      const content = JSON.parse(await fs.readFile(tmpFile, 'utf-8'))
      assert.equal(content.new, true)
      assert.equal(content.old, undefined)
    } finally {
      await fs.unlink(tmpFile).catch(() => {})
    }
  })
})
