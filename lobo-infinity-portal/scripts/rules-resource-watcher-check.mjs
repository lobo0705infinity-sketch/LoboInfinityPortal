import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkRulesResources,
  diffWorkshopItems,
  fetchWorkshopItems,
  diffResourceLinks,
  parseResourceLinks,
} from '../bot/rules-resource-watcher.mjs'

const first = `## Resources
- [Infinity Rules](https://experience.corvusbelli.com/en/resources/rules)
- [The calculator](https://infinitythecalculator.com)
`
const second = `${first}- [Infinity FAQ](https://downloads.corvusbelli.com/infinity/faq-n5.pdf)\n`
const links = parseResourceLinks(second)
assert.equal(links.length, 3)
assert.equal(diffResourceLinks(parseResourceLinks(first), links).added[0].label, 'Infinity FAQ')

const directory = await mkdtemp(join(tmpdir(), 'rules-resource-watcher-'))
const statePath = join(directory, 'state.json')
let body = first
let changed = null
let workshopUpdatedAt = 1
const fetchImpl = async (url) => String(url).includes('GetPublishedFileDetails')
  ? { ok: true, json: async () => ({ response: { publishedfiledetails: [{ result: 1, publishedfileid: '3719263238', title: 'Workshop Fixture', time_updated: workshopUpdatedAt }] } }) }
  : { ok: true, json: async () => ({ body_md: body, updated_at: 1 }) }
const silent = { info() {}, error() {} }
const baselineResult = await checkRulesResources({ statePath, fetchImpl, logger: silent, onChange: async (event) => { changed = event } })
assert.equal(baselineResult.status, 'BASELINED')
assert.equal(changed.changes.workshops[0].id, '3719263238')
assert.equal((await checkRulesResources({ statePath, fetchImpl, logger: silent })).status, 'UNCHANGED')
body = second
const result = await checkRulesResources({ statePath, fetchImpl, logger: silent, onChange: async (event) => { changed = event } })
assert.equal(result.status, 'CHANGED')
assert.equal(changed.changes.added.length, 1)
assert.equal(JSON.parse(await readFile(statePath, 'utf8')).links.length, 3)
assert.equal((await fetchWorkshopItems(['3719263238'], fetchImpl))[0].title, 'Workshop Fixture')
assert.equal(diffWorkshopItems([{ id: '3719263238', title: 'Workshop Fixture', updatedAt: 1 }], [{ id: '3719263238', title: 'Workshop Fixture', updatedAt: 2 }]).length, 1)
workshopUpdatedAt = 2
const workshopResult = await checkRulesResources({ statePath, fetchImpl, logger: silent, onChange: async (event) => { changed = event } })
assert.equal(workshopResult.status, 'CHANGED')
assert.equal(changed.changes.workshops[0].id, '3719263238')

console.log('Rules resource watcher checks passed.')
