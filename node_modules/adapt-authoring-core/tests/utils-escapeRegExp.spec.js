import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { escapeRegExp } from '../lib/utils/escapeRegExp.js'

describe('escapeRegExp()', () => {
  it('should escape dots', () => {
    assert.equal(escapeRegExp('file.js'), 'file\\.js')
  })

  it('should escape asterisks', () => {
    assert.equal(escapeRegExp('a*b'), 'a\\*b')
  })

  it('should escape plus signs', () => {
    assert.equal(escapeRegExp('a+b'), 'a\\+b')
  })

  it('should escape question marks', () => {
    assert.equal(escapeRegExp('a?b'), 'a\\?b')
  })

  it('should escape parentheses and pipe', () => {
    assert.equal(escapeRegExp('(a|b)'), '\\(a\\|b\\)')
  })

  it('should escape square brackets', () => {
    assert.equal(escapeRegExp('[abc]'), '\\[abc\\]')
  })

  it('should escape curly braces', () => {
    assert.equal(escapeRegExp('{1,2}'), '\\{1,2\\}')
  })

  it('should escape caret and dollar', () => {
    assert.equal(escapeRegExp('^start$'), '\\^start\\$')
  })

  it('should escape backslashes', () => {
    assert.equal(escapeRegExp('a\\b'), 'a\\\\b')
  })

  it('should escape hyphens', () => {
    assert.equal(escapeRegExp('a-b'), 'a\\-b')
  })

  it('should return plain strings unchanged', () => {
    assert.equal(escapeRegExp('hello'), 'hello')
  })

  it('should escape all special characters', () => {
    const special = '.*+\\-?^${}()|[]'
    const escaped = escapeRegExp(special)
    const re = new RegExp(escaped)
    assert.ok(re.test(special))
  })

  it('should produce a string usable in RegExp', () => {
    const input = 'file.name+(v2)[1].js'
    const escaped = escapeRegExp(input)
    const regex = new RegExp(escaped)
    assert.ok(regex.test(input))
    assert.ok(!regex.test('filexname'))
  })
})
