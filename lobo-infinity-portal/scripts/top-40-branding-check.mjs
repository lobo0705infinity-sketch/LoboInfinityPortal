import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { describePublicSearchPage } from '../shared/public-search-content.mjs'

const read = path => readFileSync(path, 'utf8')
const eventId = 'event-lobo-s-american-top-40'
const oldName = "Lobo's American Top 40"
const newName = "Lobo's Top 40"
const forms = [0, 1].map(() => ({
  title: oldName, destination: 'existing-sheet', questions: ['Player', 'Opponent'], responses: [1, 2],
  setTitle(value) { this.title = value; return this },
  setDescription(value) { this.description = value; return this },
  getTitle() { return this.title },
  getPublishedUrl() { return 'https://existing-registration/viewform' },
  getDestinationId() { return this.destination },
}))
const rows = [['ID', 'Name'], [eventId, oldName], ['another-event', 'Other Event']]
const writes = []
const sheet = {
  getDataRange: () => ({ getValues: () => rows }),
  getRange: (row, col) => ({ setValue: value => { rows[row - 1][col - 1] = value; writes.push([row, col, value]) } }),
}
let released = 0
const ctx = vm.createContext({
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { released++ } }) },
  CONFIG: { SHEETS: { EVENTS: 'Events' } },
  getEventEngineRuntimeSheet: () => sheet,
  lifGetTargetSpreadsheet_: () => ({ getId: () => 'existing-sheet', getSheetByName: () => ({ getFormUrl: () => 'existing-form' }) }),
  PUBLIC_SNAPSHOT_TOP40_REGISTRATION_SHEET: 'Form Responses 2',
  TOP40_PORTAL_REGISTRATION_FORM_URL: 'https://existing-registration/viewform',
  FormApp: { openByUrl: () => forms[0], openById: () => forms[1] },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'existing-submission-id' }) },
  invalidateEventManagerCaches: id => assert.equal(id, eventId),
  Logger: { log() {} },
})
vm.runInContext(read('backend/Constants.gs') + '\n' + read('backend/Top40Form.gs'), ctx)
for (let i = 0; i < 2; i++) {
  const result = ctx.updateTop40Branding()
  assert.equal(result.eventId, eventId)
  assert.equal(result.name, newName)
}
assert.deepEqual(rows, [['ID', 'Name'], [eventId, newName], ['another-event', 'Other Event']])
for (const form of forms) {
  assert.ok(form.title.startsWith(newName))
  assert.deepEqual(form.questions, ['Player', 'Opponent'])
  assert.deepEqual(form.responses, [1, 2])
  assert.equal(form.destination, 'existing-sheet')
}
rows.push([eventId, 'Duplicate'])
assert.throws(() => ctx.updateTop40Branding(), /exactly one/)
assert.equal(writes.length, 2, 'ambiguous events must not be modified')
assert.equal(released, 3, 'lock releases even on failure')

function load(path, globals = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, ...globals })
  return module.exports
}
const branding = load('src/config/eventBranding.ts')
const snapshotId = '20261021T120000Z'
const eventData = [{ id: eventId, name: oldName, registeredCount: 18 }, { id: 'another-event', name: 'Other Event' }]
const snapshots = load('src/services/publicSnapshot.ts', {
  require: path => path.includes('eventLifecycle') ? load('src/config/eventLifecycle.ts') : branding, URL,
  fetch: async url => ({ ok: true, json: async () => String(url).endsWith('current.json')
    ? { schemaVersion: 1, snapshotId, basePath: `public-snapshots/${snapshotId}/`, sourceCutoff: '2026-10-21T12:00:00Z' }
    : { snapshotId, data: eventData } }),
})
const events = await snapshots.getPublicSnapshotDataset('events')
assert.equal(events[0].name, newName)
assert.equal(events[0].id, eventId)
assert.equal(events[0].registeredCount, 18)
assert.equal(events[1].name, 'Other Event')
assert.equal(eventData[0].name, oldName, 'published source remains immutable')
const searchPage = describePublicSearchPage(`/event/${eventId}`, { events: eventData })
assert.equal(searchPage.heading, newName)
assert.ok(!searchPage.title.includes(oldName))
assert.ok(describePublicSearchPage('/events', { events: eventData }).links.some(link => link.label.startsWith(newName)))
console.log('PASS Top 40 rename preserves event IDs, form questions, responses and destinations; retries safely; rejects duplicate event IDs; normalizes old public snapshots.')

assert.equal(branding.resolveEventId('lobos-top-40'), eventId)
assert.equal(branding.resolveEventId(eventId), eventId)
assert.equal(branding.eventUrlSlug(eventId), 'lobos-top-40')
assert.equal(branding.eventUrlSlug('another-event'), 'another-event')
const newPath = '/event/lobos-top-40'
const aliasPage = describePublicSearchPage(newPath, { events: eventData })
assert.equal(aliasPage.heading, newName)
assert.equal(aliasPage.canonicalPath, newPath)
assert.equal(searchPage.canonicalPath, newPath)
assert.ok(describePublicSearchPage('/events', { events: eventData }).links.some(link => link.href === newPath))
const redirects = JSON.parse(read('vercel.json')).redirects
for (const suffix of ['', '/:path*']) {
  assert.ok(redirects.some(rule => rule.source === `/event/${eventId}${suffix}` && rule.destination === `${newPath}${suffix}` && rule.permanent))
}
console.log('PASS Top 40 public URL alias resolves existing data and canonical links; legacy overview and section URLs redirect permanently.')
