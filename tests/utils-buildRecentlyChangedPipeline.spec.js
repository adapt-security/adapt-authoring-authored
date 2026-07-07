import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import buildRecentlyChangedPipeline from '../lib/utils/buildRecentlyChangedPipeline.js'

describe('buildRecentlyChangedPipeline()', () => {
  it('should use the first collection as the base and union the rest', () => {
    const pipeline = buildRecentlyChangedPipeline(['content', 'assets'])
    const unions = pipeline.filter(s => s.$unionWith)
    assert.equal(unions.length, 1)
    assert.equal(unions[0].$unionWith.coll, 'assets')
  })

  it('should project the common row shape with a literal collection name per branch', () => {
    const pipeline = buildRecentlyChangedPipeline(['content', 'assets'])
    const baseProject = pipeline.find(s => s.$project).$project
    assert.deepEqual(baseProject.collection, { $literal: 'content' })
    assert.deepEqual(Object.keys(baseProject).sort(), ['_id', 'collection', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'].sort())

    const unionProject = pipeline.find(s => s.$unionWith).$unionWith.pipeline.find(s => s.$project).$project
    assert.deepEqual(unionProject.collection, { $literal: 'assets' })
  })

  it('should apply a per-collection filter as the branch $match', () => {
    const filters = { content: { _type: 'course' } }
    const pipeline = buildRecentlyChangedPipeline(['content', 'assets'], { filters })
    assert.deepEqual(pipeline[0].$match, { _type: 'course' })
    assert.deepEqual(pipeline.find(s => s.$unionWith).$unionWith.pipeline[0].$match, {})
  })

  it('should default the branch $match to an empty query when no filter is given', () => {
    const pipeline = buildRecentlyChangedPipeline(['content'])
    assert.deepEqual(pipeline[0].$match, {})
  })

  it('should sort by updatedAt descending and apply the limit', () => {
    const pipeline = buildRecentlyChangedPipeline(['content'], { limit: 5 })
    assert.deepEqual(pipeline.at(-2), { $sort: { updatedAt: -1 } })
    assert.deepEqual(pipeline.at(-1), { $limit: 5 })
  })

  it('should default the limit to 25', () => {
    const pipeline = buildRecentlyChangedPipeline(['content'])
    assert.deepEqual(pipeline.at(-1), { $limit: 25 })
  })

  it('should produce no $unionWith stage for a single collection', () => {
    const pipeline = buildRecentlyChangedPipeline(['content'])
    assert.equal(pipeline.filter(s => s.$unionWith).length, 0)
  })
})
