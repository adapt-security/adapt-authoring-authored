import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import App from '../lib/App.js'

mock.getter(App, 'instance', () => ({
  log () {},
  errors: {
    SPAWN: {
      setData (data) {
        const e = new Error('SPAWN')
        e.data = data
        return e
      }
    }
  }
}))

const { spawn } = await import('../lib/utils/spawn.js')

describe('spawn()', () => {
  it('should resolve with stdout on success', async () => {
    const result = await spawn({ cmd: 'echo', args: ['hello'] })
    assert.equal(result.trim(), 'hello')
  })

  it('should resolve with empty string when command produces no output', async () => {
    const result = await spawn({ cmd: 'true' })
    assert.equal(result, '')
  })

  it('should reject with SPAWN error on non-zero exit code', async () => {
    await assert.rejects(
      () => spawn({ cmd: 'false' }),
      (err) => {
        assert.equal(err.message, 'SPAWN')
        return true
      }
    )
  })

  it('should reject with stderr data on failure', async () => {
    await assert.rejects(
      () => spawn({ cmd: 'node', args: ['-e', 'process.stderr.write("oops"); process.exit(1)'] }),
      (err) => {
        assert.equal(err.message, 'SPAWN')
        assert.equal(err.data.error, 'oops')
        return true
      }
    )
  })

  it('should default cwd to empty string when not provided', async () => {
    const result = await spawn({ cmd: 'echo', args: ['test'] })
    assert.equal(result.trim(), 'test')
  })

  it('should use provided cwd', async () => {
    const result = await spawn({ cmd: 'pwd', cwd: '/tmp' })
    assert.match(result.trim(), /tmp/)
  })

  it('should pass args to the command', async () => {
    const result = await spawn({ cmd: 'echo', args: ['-n', 'no newline'] })
    assert.equal(result, 'no newline')
  })

  it('should reject with error event data for invalid commands', async () => {
    await assert.rejects(
      () => spawn({ cmd: 'nonexistent-command-that-does-not-exist' }),
      (err) => {
        assert.equal(err.message, 'SPAWN')
        return true
      }
    )
  })
})
