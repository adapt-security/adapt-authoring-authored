import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { toBoolean } from '../lib/utils/toBoolean.js'

describe('toBoolean()', () => {
  it('should return true for true', () => {
    assert.equal(toBoolean(true), true)
  })

  it('should return true for "true"', () => {
    assert.equal(toBoolean('true'), true)
  })

  it('should return false for false', () => {
    assert.equal(toBoolean(false), false)
  })

  it('should return false for "false"', () => {
    assert.equal(toBoolean('false'), false)
  })

  it('should return false for 0', () => {
    assert.equal(toBoolean(0), false)
  })

  it('should return false for an empty string', () => {
    assert.equal(toBoolean(''), false)
  })

  it('should return false for null', () => {
    assert.equal(toBoolean(null), false)
  })

  it('should return undefined for undefined', () => {
    assert.equal(toBoolean(undefined), undefined)
  })

  it('should return false for a non-"true" string', () => {
    assert.equal(toBoolean('yes'), false)
  })
})
