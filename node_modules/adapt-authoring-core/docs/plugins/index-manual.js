import https from 'https'

/**
 * Documentation plugin that generates a list of contributors
 * from all adapt-authoring-* repositories in the adapt-security organisation.
 */
export default class Contributors {
  ICON_SIZE = 55
  BORDER_WIDTH = 3
  MIN_CONTRIBUTIONS = 1

  constructor (app, config, outputDir) {
    this.org = 'adapt-security'
    this.repoPrefix = 'adapt-authoring'
    this.perPage = 100
    this.excludeUsers = ['dependabot[bot]', 'dependabot-preview[bot]', 'greenkeeper[bot]', 'semantic-release-bot', 'snyk-bot']
    // Contribution tiers
    this.tiers = [
      { name: 'gold', count: 3, border: '#FFD700' },
      { name: 'silver', count: 6, border: '#C0C0C0' },
      { name: 'bronze', count: 9, border: '#CD7F32' },
      { name: 'contributor' }
    ]
  }

  async run () {
    this.manualFile = 'index-manual.md'
    this.replace = { CONTRIBUTORS: await this.generateContributorsList() }
  }

  /**
   * Makes an HTTPS GET request to the GitHub API
   */
  async githubRequest (path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path,
        method: 'GET',
        headers: {
          'User-Agent': 'adapt-authoring-docs',
          Accept: 'application/vnd.github.v3+json'
        }
      }

      // Add auth token if available (increases rate limit)
      if (process.env.GITHUB_TOKEN) {
        options.headers.Authorization = `token ${process.env.GITHUB_TOKEN}`
      }

      const req = https.request(options, res => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error(`Failed to parse GitHub response: ${e.message}`))
          }
        })
      })

      req.on('error', reject)
      req.end()
    })
  }

  /**
   * Fetches all repositories matching the prefix from the organisation
   */
  async fetchRepos () {
    const repos = []
    let page = 1

    while (true) {
      const response = await this.githubRequest(
        `/orgs/${this.org}/repos?per_page=${this.perPage}&page=${page}`
      )

      if (!Array.isArray(response) || response.length === 0) break

      const matchingRepos = response
        .filter(repo => repo.name.startsWith(this.repoPrefix))
        .map(repo => repo.name)

      repos.push(...matchingRepos)

      if (response.length < this.perPage) break
      page++
    }

    return repos
  }

  /**
   * Fetches contributors for a single repository
   */
  async fetchRepoContributors (repoName) {
    const contributors = []
    let page = 1

    while (true) {
      const response = await this.githubRequest(
        `/repos/${this.org}/${repoName}/contributors?per_page=${this.perPage}&page=${page}`
      )

      if (!Array.isArray(response) || response.length === 0) break

      contributors.push(...response)

      if (response.length < this.perPage) break
      page++
    }

    return contributors
  }

  /**
   * Aggregates contributors across all repositories
   */
  async aggregateContributors () {
    const repos = await this.fetchRepos()
    const contributorMap = new Map()

    for (const repo of repos) {
      try {
        const contributors = await this.fetchRepoContributors(repo)

        for (const contributor of contributors) {
          if (this.excludeUsers.includes(contributor.login)) continue
          if (contributor.type !== 'User') continue

          if (contributorMap.has(contributor.login)) {
            const existing = contributorMap.get(contributor.login)
            existing.contributions += contributor.contributions
          } else {
            contributorMap.set(contributor.login, {
              login: contributor.login,
              avatarUrl: contributor.avatar_url,
              profileUrl: contributor.html_url,
              contributions: contributor.contributions
            })
          }
        }
      } catch (e) {
        console.warn(`Failed to fetch contributors for ${repo}: ${e.message}`)
      }
    }

    // Sort by contributions (descending) and return as array
    return Array.from(contributorMap.values())
      .sort((a, b) => b.contributions - a.contributions)
  }

  /**
   * Determines the tier for a contributor based on rank and contribution count
   */
  getTier (contributor, rank) {
    let position = 0
    for (const tier of this.tiers) {
      const tierMax = position + (tier.count || Infinity)
      const rankMatch = !tier.count || (rank > position && rank <= tierMax)
      const minContributions = tier.count ? this.MIN_CONTRIBUTIONS : 0
      const countMatch = contributor.contributions >= minContributions

      if (rankMatch && countMatch) {
        return tier
      }
      position = tierMax
    }
    return this.tiers[this.tiers.length - 1]
  }

  /**
   * Generates the HTML for a single contributor avatar
   */
  contributorToHtml (contributor, tier) {
    const hexClipPath = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
    const isHexagon = tier.name !== 'contributor'

    const wrapperStyle = [
      `width: ${this.ICON_SIZE}px`,
      `height: ${this.ICON_SIZE}px`,
      isHexagon ? `clip-path: ${hexClipPath}` : 'border-radius: 50%',
      tier.border ? `background: ${tier.border}` : '',
      'display: inline-block',
      'transition: transform 0.2s'
    ].filter(Boolean).join('; ')

    const imgSize = this.ICON_SIZE - (this.BORDER_WIDTH * 2)

    const imgStyle = [
      `width: ${imgSize}px`,
      `height: ${imgSize}px`,
      isHexagon ? `clip-path: ${hexClipPath}` : 'border-radius: 50%',
      'display: block',
      `margin: ${this.BORDER_WIDTH}px`
    ].join('; ')

    return `<a href="${contributor.profileUrl}" title="${contributor.login} (${contributor.contributions} contributions)" target="_blank" rel="noopener" style="${wrapperStyle}"><img src="${contributor.avatarUrl}" alt="${contributor.login}" class="contributor-avatar contributor-${tier.name}" style="${imgStyle}" /></a>`
  }

  /**
   * Generates the full contributors list HTML
   */
  async generateContributorsList () {
    try {
      const contributors = await this.aggregateContributors()

      if (contributors.length === 0) {
        return '<p>No contributors found.</p>'
      }

      // Group contributors by tier
      const tierGroups = new Map()
      contributors.forEach((contributor, index) => {
        const tier = this.getTier(contributor, index + 1)
        if (!tierGroups.has(tier.name)) {
          tierGroups.set(tier.name, [])
        }
        tierGroups.get(tier.name).push(this.contributorToHtml(contributor, tier))
      })

      // Generate HTML for each tier row
      const rows = Array.from(tierGroups.entries())
        .map(([tierName, avatars]) =>
          `<div class="contributors-row contributors-${tierName}">\n${avatars.join('\n')}\n</div>`
        )
        .join('\n')

      return `<div class="contributors-grid">\n${rows}\n</div>
      <style>
.contributors-grid {
  margin: 0 auto;
  max-width: 600px;
  padding: 20px 0;
}
.contributors-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-bottom: 12px;
  text-align: center;
}
.contributors-grid a:hover {
  transform: scale(1.1);
}
.contributor-avatar {
  object-fit: cover;
  vertical-align: middle;
}
</style>`
    } catch (e) {
      console.error('Failed to generate contributors list:', e)
      return '<p>Unable to load contributors list.</p>'
    }
  }
}
