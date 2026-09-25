#!/usr/bin/env node

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { readArtifact } from './benchmark-artifacts.mjs'
import { decodeArmyCode } from './infinity-army-decode.mjs'
import { LIVE_ROSTER_UNIT_SLUGS } from '../bot/official-army-rosters.mjs'
import { RANDOM_LIST_COMMAND_DEFINITION, buildRandomListResponse, createRandomListAutocompleteHandler,
  createRandomListInteractionHandler, ensureRandomListCommand, searchRandomListFactions } from '../bot/random-list-command.mjs'
import { formatRandomArmyList, generateRandomArmyList } from '../bot/random-list-generator.mjs'
import { ListBuilderError } from '../bot/build-list-generator.mjs'

const source = await readArtifact(resolve(import.meta.dirname, '..', 'data', 'infinity-army', 'benchmark-official-source.json.gz.b64'))
const payload = source.payloads.find(item => item.url?.endsWith('/units/en/502'))
assert.ok(payload?.units?.length)
const input = { payload, metadata: source.metadata, sectorialId: 502,
  rosterSlugs: LIVE_ROSTER_UNIT_SLUGS.get(502), points: 300, swc: 6 }

const drawn = [
  generateRandomArmyList({ ...input, pickIndex: () => 0 }),
  generateRandomArmyList({ ...input, pickIndex: length => length - 1 }),
  generateRandomArmyList({ ...input, swc: 0, pickIndex: length => Math.floor(length / 2) }),
  generateRandomArmyList({ ...input, points: 150, swc: 2.5, pickIndex: () => 0 }),
]
assert.ok(new Set(drawn.map(list => list.code)).size > 1, 'random decisions produce different lists')
for (const list of drawn) {
  assert.equal(list.legality.status, 'legal', 'every returned Army code passes independent legality checks')
  assert.equal(decodeArmyCode(list.code).sectorialId, 502)
  assert.equal(list.legality.totals.lieutenantCount, 1)
  assert.ok(list.points <= list.pointsLimit && list.swc <= list.swcLimit)
  assert.ok(list.legality.totals.troopers <= 15)
  assert.ok(list.profiles.every(item => input.rosterSlugs.includes(item.slug)))
  assert.ok([1, 2].every(group => list.profiles.filter(item => item.combatGroup === group)
    .reduce((total, item) => total + item.slots, 0) <= 10))
  const message = formatRandomArmyList(list)
  assert.ok(message.content.length <= 2000)
  assert.match(message.content, /Random roster; no ratings, missions, or Fireteam optimization/)
  assert.match(message.content, /Open in Infinity Army/)
}
assert.equal(drawn[2].swc, 0, 'a zero-SWC request is honored')

// This seeded Ariadna draw used to return the first legal roster at 275/300 points.
// Subsequent random draws can fill the requested allotment without rating models.
const ariadna = source.metadata.factions.find(item => item.name === 'Ariadna')
const ariadnaPayload = source.payloads.find(item => item.url?.endsWith(`/units/en/${ariadna.id}`))
let randomState = 7
const seededPickIndex = length => {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
  return Math.floor(randomState / 4294967296 * length)
}
const filled = generateRandomArmyList({ payload: ariadnaPayload, metadata: source.metadata,
  sectorialId: ariadna.id, rosterSlugs: LIVE_ROSTER_UNIT_SLUGS.get(ariadna.id),
  points: 300, swc: 5, pickIndex: seededPickIndex })
assert.equal(filled.points, 300, 'random legal rosters are compared to fill the points limit')
assert.ok(filled.swc <= 5 && filled.legality.status === 'legal')

assert.throws(() => generateRandomArmyList({ ...input, swc: 6.25 }), ListBuilderError)
assert.throws(() => generateRandomArmyList({ ...input, swc: 7 }), ListBuilderError)
assert.throws(() => generateRandomArmyList({ ...input, points: 99 }), ListBuilderError)

assert.deepEqual(RANDOM_LIST_COMMAND_DEFINITION.options.map(option => option.name), ['faction', 'points', 'swc'])
assert.ok(RANDOM_LIST_COMMAND_DEFINITION.options.every(option => option.required))
assert.ok(RANDOM_LIST_COMMAND_DEFINITION.options[0].autocomplete)
assert.equal(RANDOM_LIST_COMMAND_DEFINITION.options[2].type, 10, 'SWC allows half-points')
let autocompleteChoices
const autocomplete = createRandomListAutocompleteHandler({ logger: { error() {} } })
assert.equal(await autocomplete({ isAutocomplete: () => true, commandName: 'random-list',
  options: { getFocused: () => ({ name: 'faction', value: 'corr' }) },
  respond: async choices => { autocompleteChoices = choices } }), true)
assert.deepEqual(autocompleteChoices, [{ name: 'Jurisdictional Command of Corregidor', value: '502' }])
assert.deepEqual(await searchRandomListFactions('Non-Aligned Armies'), [],
  'the incomplete Non-Aligned roster cannot be offered as a playable faction')

let generateArgs
const message = await buildRandomListResponse({ faction: '502', points: 300, swc: 6,
  getSource: async () => ({ payload, metadata: source.metadata, faction: source.metadata.factions.find(item => item.id === 502) }),
  generate: args => { generateArgs = args; return drawn[0] } })
assert.equal(generateArgs.sectorialId, 502)
assert.deepEqual([generateArgs.points, generateArgs.swc], [300, 6])
assert.equal(message.content, formatRandomArmyList(drawn[0]).content)

let interactionArgs, replied
const handler = createRandomListInteractionHandler({ build: async args => { interactionArgs = args; return message }, logger: { error() {} } })
assert.equal(await handler({
  isChatInputCommand: () => true, commandName: 'random-list',
  options: { getString: () => '502', getInteger: () => 300, getNumber: () => 5.5 },
  deferReply: async () => {}, editReply: async result => { replied = result },
}), true)
assert.deepEqual(interactionArgs, { faction: '502', points: 300, swc: 5.5 })
assert.equal(replied.content, message.content)

let created = false, edited = false
const existing = { ...RANDOM_LIST_COMMAND_DEFINITION, id: 'command-id', applicationId: 'app-id',
  options: RANDOM_LIST_COMMAND_DEFINITION.options.map(option => ({ ...option,
    min_value: option.minValue, max_value: option.maxValue, minValue: undefined, maxValue: undefined })),
  edit: async () => { edited = true; return existing } }
const guild = { id: 'guild-id', commands: { fetch: async () => [existing],
  create: async () => { created = true; return existing } } }
assert.deepEqual(await ensureRandomListCommand({ guilds: { cache: new Map([['guild-id', guild]]) },
  application: { commands: { fetch: async () => [] } } }),
[{ applicationId: 'app-id', guildId: 'guild-id', id: 'command-id' }])
assert.equal(created, false)
assert.equal(edited, false, 'an up-to-date command is left alone at startup')
guild.commands.fetch = async () => []
assert.equal((await ensureRandomListCommand({ guilds: { cache: new Map([['guild-id', guild]]) },
  application: { commands: { fetch: async () => [] } } })).length, 1)
assert.equal(created, true, 'a new guild receives the slash command')

console.log('PASS - /random-list fills points with legal random profiles, respects custom SWC, and exposes faction autocomplete.')
