import fetch from 'node-fetch'

export default class CoreModules {
  async run () {
    this.manualFile = 'coremodules.md'
    this.replace = {
      VERSION: this.app.pkg.version,
      MODULES: await this.generateMd()
    }
  }

  async getWorkflowBadges (homepage) {
    if (!homepage) return []
    const workflows = ['tests', 'standardjs']
    const results = await Promise.all(workflows.map(async w => {
      const url = `${homepage}/actions/workflows/${w}.yml`
      const badgeUrl = `${url}/badge.svg`
      try {
        const res = await fetch(badgeUrl, { method: 'HEAD' })
        if (res.ok) return `[![${w}](${badgeUrl})](${url})`
      } catch {}
      return null
    }))
    return results.filter(Boolean)
  }

  async generateMd () {
    const rows = await Promise.all(Object.keys(this.app.dependencies).sort().map(async name => {
      const { version, description, homepage } = this.app.dependencies[name]
      const badges = await this.getWorkflowBadges(homepage)
      return `| ${homepage ? `[${name}](${homepage})` : name} | ${version} | ${description} | ${badges.join('<br>')} |`
    }))
    return `| Name | Version | Description | Status |\n| - | :-: | - | :-: |\n${rows.join('\n')}`
  }
}
