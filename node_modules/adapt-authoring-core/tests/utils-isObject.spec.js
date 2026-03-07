import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { isObject } from '../lib/utils/isObject.js'

describe('isObject()', () => {
  const validObjects = [
    { value: {}, label: 'empty object' },
    { value: { key: 'value' }, label: 'object with properties' },
    { value: { nested: { key: 'value' } }, label: 'nested object' }
  ]

  validObjects.forEach(({ value, label }) => {
    it(`should return true for ${label}`, () => {
      assert.equal(isObject(value), true)
    })
  })

  const objectLikeButValid = [
    { value: new Date(), label: 'Date instance' },
    { value: /regex/, label: 'RegExp instance' }
  ]

  objectLikeButValid.forEach(({ value, label }) => {
    it(`should return true for ${label}`, () => {
      assert.equal(isObject(value), true)
    })
  })

  const invalidObjects = [
    { value: null, label: 'null' },
    { value: [], label: 'empty array' },
    { value: [1, 2, 3], label: 'array with values' },
    { value: 'string', label: 'string' },
    { value: 123, label: 'number' },
    { value: true, label: 'boolean' },
    { value: undefined, label: 'undefined' },
    { value: () => {}, label: 'function' },
    { value: 0, label: 'zero' },
    { value: '', label: 'empty string' },
    { value: NaN, label: 'NaN' }
  ]

  invalidObjects.forEach(({ value, label }) => {
    it(`should return false for ${label}`, () => {
      assert.equal(isObject(value), false)
    })
  })
})
