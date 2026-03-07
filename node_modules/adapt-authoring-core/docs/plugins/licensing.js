import fetch from 'node-fetch'
import fs from 'fs/promises'
import { glob } from 'glob'
import path from 'path'

export default class Licensing {
  async run () {
    this.manualFile = 'licensing.md'
    this.licenses = {}
    this.dependencies = []

    await this.loadDependencies()

    const adaptLicense = this.licenses[JSON.parse((await fs.readFile(path.resolve(this.config.app.rootDir, 'package.json'))).toString()).license]

    this.replace = {
      ADAPT_LICENSE: adaptLicense.name,
      ADAPT_LICENSE_TEXT: adaptLicense.description,
      ADAPT_LICENSE_PERMISSIONS: adaptLicense.permissions.map(p => `- ${this.permissionsMap(p)}`).join('\n'),
      LICENSES: await this.generateLicenseSummaryMd(),
      LICENSE_DETAILS: await this.generateLicenseDetailsMd(),
      MODULES: await this.generateMd(),
      MODULE_COUNT: this.dependencies.length,
      UNKNOWN_LICENSES: this.generateUnknownLicenseMd()
    }
  }

  async loadDependencies () {
    const files = await glob('node_modules/*/package.json')
    await Promise.all(files.map(async f => {
      const packageName = path.dirname(f).replace('node_modules/', '')
      if (packageName.startsWith('adapt-authoring')) {
        return
      }
      const pkg = JSON.parse((await fs.readFile(f)).toString())
      this.dependencies.push(pkg)
      await this.storeLicenseData(pkg)
    }))
  }

  async storeLicenseData (pkg) {
    if (!pkg.license) {
      const l = 'Undefined'
      if (!this.licenses[l]) this.licenses[l] = { count: 0, packages: [] }
      this.licenses[l].count++
      this.licenses[l].packages.push(pkg.name)
      return
    }
    if (typeof pkg.license === 'object') {
      pkg.license = pkg.license.type
    }
    const licenses = pkg.license.replace('(', '').replace(')', '').split(/\s(?:AND|OR)\s/)
    for (let l of licenses) {
      l = this.licenseNameMap(l)
      if (this.licenses[l]) {
        this.licenses[l].count++
        this.licenses[l].packages.push(pkg.name)
        return
      }
      this.licenses[l] = { count: 1, packages: [pkg.name] }
      try {
        const { GITHUB_USER, GITHUB_TOKEN } = process.env
        const res = await fetch(`https://api.github.com/licenses/${l.toLowerCase()}`, { headers: { Authorization: `Basic ${Buffer.from(`${GITHUB_USER}:${GITHUB_TOKEN}`).toString('base64')}` } })
        const body = await res.json()
        if (res.ok) Object.assign(this.licenses[l], body)
        else console.log(`Could not fetch '${l}' license from GitHub API (${res.status}), will list as unknown`)
      } catch (e) {
        console.error(e)
      }
    }
  }

  licenseNameMap (name) {
    switch (name) {
      case 'Apache2':
        return 'Apache-2.0'
      case 'GPL-3.0-or-later':
        return 'GPL-3.0'
      default:
        return name
    }
  }

  permissionsMap (p) {
    return `${p[0].toUpperCase()}${p.slice(1).replaceAll('-', ' ')}`
  }

  async generateLicenseSummaryMd () {
    let md = '| License | Modules using license |\n| - | :-: |\n'

    Object.keys(this.licenses)
      .sort()
      .forEach(l => {
        md += `| ${l} | ${this.licenses[l].count} |\n`
      })

    return md
  }

  async generateLicenseDetailsMd () {
    let md = ''
    Object.entries(this.licenses).forEach(([key, { name, spdx_id: spdxId, description, body, permissions }]) => {
      if (!name) return
      md += '<details>\n'
      md += `<summary>${name}${spdxId ? ` (${spdxId})` : ''}</summary>\n`
      md += `<p>${description}</p>\n`
      md += `<p>This license allows the following:\n<ul>${permissions.map(p => `<li>${this.permissionsMap(p)}</li>`).join('\n')}</ul></p>\n`
      md += '<p>The original license text is as follows:</p>\n'
      md += `<pre>${body}</pre>\n`
      md += '</details>\n\n'
    })
    return md
  }

  generateUnknownLicenseMd () {
    const unknowns = Object.entries(this.licenses).filter(([, { name }]) => !name)
    if (!unknowns.length) return ''
    let md = 'No information is held on the following licenses, please do your own research to determine their suitability.\n\n'
    unknowns.forEach(([key, { packages }]) => {
      md += `- **${key}**: ${packages.join(', ')}\n`
    })
    return md
  }

  async generateMd () {
    let md = '<tr><th>Name</th><th>Version</th><th>License</th><th>Description</th></tr>\n'
    this.dependencies.forEach(pkg => {
      md += `<tr><td>${pkg.homepage ? `<a href="${pkg.homepage}" target="_blank">${pkg.name}</a>` : pkg.name}</td><td>${pkg.version}</td><td>${pkg.license}</td><td>${pkg.description}</tr>\n`
    })
    return `<details>\n<summary>Module dependency list</summary>\n<table>${md}</table>\n</details>`
  }
}
