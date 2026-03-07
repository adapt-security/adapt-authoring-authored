import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { getArgs } from '../lib/utils/getArgs.js'

describe('getArgs()', () => {
  it('should return an object with parsed arguments', () => {
    const args = getArgs()
    assert.equal(typeof args, 'object')
    assert.ok(Array.isArray(args.params))
  })

  it('should include the underscore array from minimist', () => {
    const args = getArgs()
    assert.ok(Array.isArray(args._))
  })

  it('should derive params by slicing first two entries from _', () => {
    const args = getArgs()
    assert.deepEqual(args.params, args._.slice(2))
  })
})
