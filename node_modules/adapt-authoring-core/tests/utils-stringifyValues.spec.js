import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { stringifyValues } from '../lib/utils/stringifyValues.js'

describe('stringifyValues()', () => {
  it('should pass through plain values unchanged', () => {
    const data = { a: 'hello', b: 42, c: true, d: null }
    assert.deepEqual(stringifyValues(data), data)
  })

  it('should convert Date values to strings', () => {
    const date = new Date('2025-01-01T00:00:00.000Z')
    const result = stringifyValues({ date })
    assert.equal(typeof result.date, 'string')
    assert.equal(result.date, date.toString())
  })

  it('should convert ObjectId-like values to strings', () => {
    class ObjectId {
      constructor (id) { this.id = id }
      toString () { return this.id }
    }
    const data = { _id: new ObjectId('abc123') }
    const result = stringifyValues(data)
    assert.equal(typeof result._id, 'string')
    assert.equal(result._id, 'abc123')
  })

  it('should recursively process nested objects', () => {
    const date = new Date('2025-01-01')
    const data = { nested: { value: 'test', date } }
    const result = stringifyValues(data)
    assert.equal(typeof result.nested, 'object')
    assert.equal(typeof result.nested.date, 'string')
    assert.equal(result.nested.value, 'test')
  })

  it('should recursively process arrays', () => {
    const date = new Date('2025-01-01')
    const data = { items: [date, 'text', 42] }
    const result = stringifyValues(data)
    assert.ok(Array.isArray(result.items))
    assert.equal(typeof result.items[0], 'string')
    assert.equal(result.items[1], 'text')
    assert.equal(result.items[2], 42)
  })

  it('should return an array when input is an array', () => {
    const result = stringifyValues([{ a: 1 }, { b: 2 }])
    assert.ok(Array.isArray(result))
    assert.equal(result.length, 2)
  })

  it('should not mutate the original data', () => {
    const date = new Date('2025-01-01')
    const data = { date }
    stringifyValues(data)
    assert.ok(data.date instanceof Date)
  })

  it('should handle deeply nested structures', () => {
    const date = new Date('2025-01-01')
    const data = { a: { b: { c: { date } } } }
    const result = stringifyValues(data)
    assert.equal(typeof result.a.b.c.date, 'string')
  })
})
