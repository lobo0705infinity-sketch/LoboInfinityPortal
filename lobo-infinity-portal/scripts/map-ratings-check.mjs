import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { buildMapRatings } from '../src/public/mapRatings.ts'
import { loboWorkshopMaps, loboWorkshopMapSections } from '../shared/lobo-workshop-maps.mjs'

const source = (file) => readFileSync(new URL(`../backend/${file}`, import.meta.url), 'utf8')
const context = vm.createContext({
  Date, Number, String,
  lifNormalizeArmyCode_: (value) => String(value || ''),
  lifNormalize_: (value) => String(value || '').trim().toLowerCase(),
  canonicalValidationResult_: (errors, value) => ({ valid: errors.length === 0, errors, value }),
  Session: { getScriptTimeZone: () => 'UTC' },
  Utilities: { formatDate: () => '2026-09-28' },
})
for (const file of ['GamePipelineReliability.gs', 'Constants.gs', 'WorkshopMapCatalog.gs', 'ResponseImporter.gs', 'CanonicalValidationService.gs', 'GameFactory.gs'])
  vm.runInContext(source(file), context, { filename: file })

const options = (type) => Array.from(context.lifWorkshopMapChoices_(type))
assert.equal(options('casual').length, 47)
assert.equal(options('league').length, 16)
assert.equal(options('team-tournament').length, 3)
for (const section of loboWorkshopMapSections.slice(1)) {
  const type = section.id.includes('team-tournament') ? 'team-tournament' : 'league'
  const expected = section.layouts.flatMap((layout) => layout.saves.map((map) => map.slug)).sort()
  const actual = options(type).map((label) => context.lifWorkshopMapSlug_(type, label)).sort()
  assert.deepEqual(actual, expected, `${type} choices match its map collection`)
}
assert.throws(() => context.lifWorkshopMapSlug_('league', options('team-tournament')[0]), /not in this submission form/)
assert.throws(() => context.lifWorkshopMapSlug_('team-tournament', options('league')[0]), /not in this submission form/)

const fields = vm.runInContext('LIF_FORMS.FIELDS', context)
const selectedLabel = options('league')[0]
const named = { [fields.WORKSHOP_MAP]: [selectedLabel], [fields.MAP_RATING]: ['5'] }
const submission = context.lifReadSubmission_(named, 'casual', new Date(), null)
assert.equal(submission.mapSlug, context.lifWorkshopMapSlug_('league', selectedLabel))
assert.equal(submission.mapRating, '5')

const validSubmission = {
  ...submission, player: 'Alpha', opponent: 'Bravo', mission: 'Data Harvest',
  playerFaction: 'Ariadna', opponentFaction: 'Yu Jing', playerArmyCode: 'aaa', opponentArmyCode: 'bbb',
  gameResult: 'Player Victory', firstTurn: 'Player',
  playerTp: '5', opponentTp: '0', playerOp: '8', opponentOp: '2', playerVp: '180', opponentVp: '80',
}
assert.equal(context.canonicalValidateGoogleFormGame_(validSubmission).valid, true)
for (const bad of [{ mapRating: '6' }, { mapRating: '0' }, { mapRating: '3', mapSlug: '' }])
  assert.equal(context.canonicalValidateGoogleFormGame_({ ...validSubmission, ...bad }).valid, false)

const row = context.buildCanonicalGameRow({ ...validSubmission, mapRating: '5', mapSlug: submission.mapSlug })
assert.equal(row.length, 25)
assert.equal(row[23], submission.mapSlug)
assert.equal(row[24], 5)

const exported = source('PublicSnapshotExporter.gs')
function functionSource(text, name) {
  const start = text.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `${name} is present`)
  let depth = 0
  let opened = false
  for (let end = start; end < text.length; end += 1) {
    if (text[end] === '{') { depth += 1; opened = true }
    if (text[end] === '}') depth -= 1
    if (opened && depth === 0) return text.slice(start, end + 1)
  }
  throw new Error(`Incomplete function ${name}`)
}
Object.assign(context, {
  FORM: { DIVISION: 1, DATE: 2, MISSION: 3, PLAYER1: 4, PLAYER2: 5,
    P1TP: 6, P2TP: 7, P1OP: 8, P2OP: 9, P1VP: 10, P2VP: 11, FIRSTTURN: 12,
    WINNINGFACTION: 13, LOSINGFACTION: 14, MOMENT: 15, EVENT_ID: 16,
    GAME_TYPE: 17, GAME_RESULT: 18, WINNER_ARMY_LIST_ID: 21, LOSER_ARMY_LIST_ID: 22,
    WORKSHOP_MAP_SLUG: 23, MAP_RATING: 24 },
  EVENT_ENGINE_DEFAULT_EVENT_ID: 'event-current-league',
  normalizeGameType: value => String(value || 'league').trim().toLowerCase(),
  determineWinner: () => 1,
  getGameEnginePlayerArmyCode: () => '',
  getArmyIntelligenceHash: () => '',
  resolvePublicSnapshotParticipant_: (_, player) => ({ player, displayName: player }),
  publicSnapshotScoreCellIsValid_: () => true,
})
for (const name of ['buildPublicSnapshotGameContext_', 'buildPublicSnapshotGames_', 'publicSnapshotScore_'])
  vm.runInContext(functionSource(exported, name), context)
const publicSource = context.buildPublicSnapshotGameContext_({ rows: [row] }, {})
const publicGame = context.buildPublicSnapshotGames_(publicSource, [])[0]
assert.equal(publicGame.mapSlug, submission.mapSlug)
assert.equal(publicGame.mapRating, 5)
const legacyGame = context.buildPublicSnapshotGameContext_({ rows: [row.slice(0, 23)] }, {})[0]
assert.equal(legacyGame.mapSlug, '')
assert.equal(legacyGame.mapRating, null)

const formIds = { LIF_LEAGUE_FORM_ID: 'league-id', LIF_TEAM_FORM_ID: 'team-id', LIF_CASUAL_FORM_ID: 'casual-id' }
const forms = new Map(Object.values(formIds).map((id) => [id, {
  items: [{ title: 'Mission', getTitle() { return this.title }, getType: () => 'TEXT' }],
  getId() { return id },
  getItems(type) { return type ? this.items.filter((item) => item.getType() === type) : this.items },
  addListItem() {
    const item = { title: '', values: [], getTitle() { return this.title }, getType: () => 'LIST',
      asListItem() { return this }, setTitle(title) { this.title = title; return this },
      setChoiceValues(values) { this.values = values; return this }, setRequired() { return this },
      setHelpText() { return this } }
    this.items.push(item)
    return item
  },
}]))
context.PropertiesService = { getScriptProperties: () => ({ getProperty: (key) => formIds[key] }) }
context.FormApp = { ItemType: { LIST: 'LIST' }, openById: (id) => forms.get(id) }
vm.runInContext(functionSource(source('LeagueForm.gs'), 'synchronizeWorkshopMapSubmissionForms'), context)
for (let pass = 0; pass < 2; pass += 1) {
  const result = context.synchronizeWorkshopMapSubmissionForms()
  assert.deepEqual(Array.from(result, (item) => item.mapChoices), [16, 3, 47])
  for (const form of forms.values()) {
    assert.equal(form.items.length, 3, 'sync preserves old questions and creates each map question only once')
    assert.equal(form.items[0].getTitle(), 'Mission')
  }
}

const sameLayout = loboWorkshopMaps.filter((map) => map.layoutKey === loboWorkshopMaps[24].layoutKey)
assert.ok(sameLayout.length >= 2, 'fixture includes a terrain layout with two saves')
const otherMap = loboWorkshopMaps.find((map) => map.layoutKey !== sameLayout[0].layoutKey)
const ratings = buildMapRatings([
  { id: 1, mapSlug: sameLayout[0].slug, mapRating: 5 },
  { id: 2, mapSlug: sameLayout[1].slug, mapRating: 3 },
  { id: 3, mapSlug: otherMap.slug, mapRating: 4 },
  { id: 4, mapSlug: otherMap.slug, mapRating: 6 },
  { id: 2, mapSlug: otherMap.slug, mapRating: 1 },
  { id: 5, mapSlug: 'unknown-map', mapRating: 5 },
])
assert.equal(ratings.size, 2)
assert.equal(ratings.get(sameLayout[0].layoutKey).average, 4)
assert.equal(ratings.get(sameLayout[0].layoutKey).count, 2)
assert.equal(ratings.get(sameLayout[0].layoutKey).rank, 1)
assert.equal(ratings.get(otherMap.layoutKey).rank, 2)

console.log('Workshop form scopes, saved map ratings, and layout rankings passed.')
