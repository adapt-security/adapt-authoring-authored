/**
 * Builds an aggregation pipeline returning the most-recently-changed documents
 * across several collections, newest first. The first collection is the
 * aggregation base; the rest are unioned in.
 * @param {Array} collections Collection names to union (non-empty)
 * @param {Object} options
 * @param {Number} options.limit Maximum number of rows to return
 * @param {Object} options.filters Per-collection match query keyed by collection name
 * @return {Array} The aggregation pipeline
 */
export default function buildRecentlyChangedPipeline (collections, { limit = 25, filters = {} } = {}) {
  const branch = name => [
    { $match: filters[name] ?? {} },
    {
      $project: {
        _id: 1,
        collection: { $literal: name },
        createdAt: 1,
        updatedAt: 1,
        createdBy: 1,
        updatedBy: 1
      }
    }
  ]
  const [base, ...rest] = collections
  return [
    ...branch(base),
    ...rest.map(name => ({ $unionWith: { coll: name, pipeline: branch(name) } })),
    { $sort: { updatedAt: -1 } },
    { $limit: limit }
  ]
}
