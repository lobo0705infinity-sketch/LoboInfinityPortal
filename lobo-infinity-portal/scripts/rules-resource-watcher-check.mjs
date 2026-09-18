import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkRulesResources,
  diffResourceLinks,
  isTrustedRulesResource,
  parseResourceLinks,
} from '../bot/rules-resource-watcher.mjs'

const first = `## Resources
- [Infinity Rules](https://experience.corvusbelli.com/en/resources/rules)
- [The calculator](https://infinitythecalculator.com)
`
const second = `${first}- [Infinity FAQ](https://downloads.corvusbelli.com/infinity/faq-n5.pdf)\n`
const links = parseResourceLinks(second)
assert.equal(links.length, 3)
assert.equal(isTrustedRulesResource(links.find((item) => item.label === 'Infinity FAQ')), true)
assert.equal(isTrustedRulesResource(links.find((item) => item.label === 'The calculator')), false)
assert.equal(diffResourceLinks(parseResourceLinks(first), links).added[0].label, 'Infinity FAQ')

const directory = await mkdtemp(join(tmpdir(), 'rules-resource-watcher-'))
const statePath = join(directory, 'state.json')
let body = first
let changed = null
const fetchImpl = async () => ({ ok: true, json: async () => ({ body_md: body, updated_at: 1 }) })
const silent = { info() {}, error() {} }
assert.equal((await checkRulesResources({ statePath, fetchImpl, logger: silent })).status, 'BASELINED')
assert.equal((await checkRulesResources({ statePath, fetchImpl, logger: silent })).status, 'UNCHANGED')
body = second
const result = await checkRulesResources({ statePath, fetchImpl, logger: silent, onChange: async (event) => { changed = event } })
assert.equal(result.status, 'CHANGED')
assert.equal(changed.trustedRulesAdded.length, 1)
assert.equal(JSON.parse(await readFile(statePath, 'utf8')).links.length, 3)

console.log('Rules resource watcher checks passed.')
