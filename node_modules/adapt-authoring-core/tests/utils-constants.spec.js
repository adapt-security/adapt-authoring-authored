import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { metadataFileName, packageFileName } from '../lib/utils/constants.js'

describe('metadataFileName', () => {
  it('should be adapt-authoring.json', () => {
    assert.equal(metadataFileName, 'adapt-authoring.json')
  })
})

describe('packageFileName', () => {
  it('should be package.json', () => {
    assert.equal(packageFileName, 'package.json')
  })
})
