import fs from 'fs-extra'
import { parse } from 'comment-parser'

export default class BinScripts {
  async run () {
    this.manualFile = 'binscripts.md'
    this.replace = { CONTENT: await this.generateMd() }
  }

  async generateMd () {
    const allDeps = await Promise.all(Object.values(this.app.dependencies).map(this.processDep))
    return allDeps
      .reduce((m, d) => d ? m.concat(d) : m, [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(d => this.dataToMd(d))
      .join('\n')
  }

  async processDep ({ name, bin, rootDir }) {
    if (!bin || typeof bin === 'string') {
      return
    }
    return await Promise.all(Object.entries(bin).map(async ([scriptName, filePath]) => {
      const data = { name: scriptName, description: 'No description provided.', moduleName: name }
      const contents = (await fs.readFile(`${rootDir}/${filePath}`)).toString()
      const match = contents.match(/^#!\/usr\/bin\/env node(\s*)?\/\*\*([\s\S]+?)\*\//)
      if (match) {
        const [{ description, tags }] = parse(match[0])
        const params = tags.reduce((m, t) => {
          if (t.tag === 'param') m.push({ name: t.name, description: t.description })
          return m
        }, [])
        data.description = description
        if (params.length) data.params = params
      }
      return data
    }))
  }

  dataToMd ({ name, description, moduleName, params }) {
    let content = `<h2 class="script" id="${name}">${name} <span class="module">from ${moduleName}</span></h2>`
    content += `<div class="details"><p class="description">${description}</p>`
    if (params) {
      content += `<p><b>Params</b><ul>${params.reduce((s, p) => `${s}<li><code>${p.name}</code> ${p.description}</li>`, '')}</ul></p>`
    }
    return content
  }
}
