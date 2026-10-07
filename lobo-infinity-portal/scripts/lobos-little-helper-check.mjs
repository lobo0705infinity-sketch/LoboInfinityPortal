#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  InfListRenderError,
  buildOfficialArmyUrl,
  fetchOfficialClassificationData,
  renderInfListPng,
} from './inf-list-render-poc.mjs'
import {
  INF_LIST_COMMAND_DEFINITION,
  createInfListInteractionHandler,
  createConcurrencyLimiter,
  ensureInfListCommand,
} from '../bot/inf-list-command.mjs'
import {
  BOT_NAME,
  DISCORD_TOKEN_ENV,
  REQUIRED_INTENTS,
  createLobosLittleHelper,
  filterUnannouncedMapChanges,
  filterUnannouncedWorkshopChanges,
  formatMapAnnouncement,
  formatWorkshopAnnouncement,
  mapAnnouncementMarker,
  workshopAnnouncementMarker,
} from '../bot/lobos-little-helper.mjs'
import { installFeedbackCapture } from '../bot/bot-feedback.mjs'
import { GatewayIntentBits } from 'discord.js'
import { Events } from 'discord.js'
import { MISSION_COMMAND_DEFINITION } from '../bot/mission-command.mjs'
import { INF_ID_COMMAND_DEFINITION } from '../bot/inf-id-command.mjs'
import { RULES_COMMAND_DEFINITION } from '../bot/rules-command.mjs'
import { AVAILABILITY_COMMAND_DEFINITION, FIND_GAME_COMMAND_DEFINITION } from '../bot/matchmaking-command.mjs'

const testCode = 'QUJDRA=='
const readableImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x02])
const profilePages = [
  { imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x03]) },
  { imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x04]) },
]
const tacticalPages = [
  { imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x05]) },
]
const officialArmyUrl = buildOfficialArmyUrl(testCode)
const legality = {
  status: 'legal',
  limits: { points: 300, swc: 6, troopers: 15 },
  totals: { lieutenantCount: 1, points: 300, swc: 6, troopers: 15 },
  unavailable: [],
  violations: [],
  version: 'fixture',
}
const legalityText = '✅ **LEGAL ARMY LIST**\n300/300 Points · 6/6 SWC · 15/15 Troopers'
const fetchedUrls = []
const officialData = await fetchOfficialClassificationData(604, async (url) => {
  fetchedUrls.push(url)
  return { ok: true, async json() { return url.endsWith('/metadata') ? { skills: [{ id: 1, name: 'Skill' }] } : { version: 'fixture', units: [{ id: 783 }] } } }
})
assert.deepEqual(fetchedUrls, ['https://api.corvusbelli.com/army/infinity/en/metadata', 'https://api.corvusbelli.com/army/units/en/604'])
assert.equal(officialData.metadata.skills[0].name, 'Skill')
assert.equal(officialData.payload.units[0].id, 783)
assert.equal(officialData.payload.url, 'https://api.corvusbelli.com/army/units/en/604')
assert.equal(BOT_NAME, "Lobo's Little Helper")
assert.equal(DISCORD_TOKEN_ENV, 'DISCORD_BOT_TOKEN')
assert.deepEqual(REQUIRED_INTENTS, [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
])
const workshopFixture = { id: '3719263238', title: "Lobo's Infinity Maps", updatedAt: 1_795_464_480, url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3719263238' }
const workshopMarker = workshopAnnouncementMarker(workshopFixture)
assert.equal(workshopMarker, 'steam-workshop:3719263238:1795464480')
assert.match(formatWorkshopAnnouncement(workshopFixture), new RegExp(workshopMarker))
assert.match(formatWorkshopAnnouncement(workshopFixture), /Infinity TTS Workshop Updated/)
const mapFixture = {
  id: '27',
  name: 'Oil Refinery',
  createdAt: '2026-09-21T11:12:59.000Z',
  pageUrl: 'http://51.255.44.29/infinity/maps?map=oil-refinery',
  jsonUrl: 'http://51.255.44.29/infinity/api/tts-maps/27/json',
  images: ['http://51.255.44.29/infinity/api/tts-maps/27/pictures/oil_refinery_01.jpg'],
  contentSignature: '0123456789ABCDEF0123456789ABCDEF',
}
const mapMarker = mapAnnouncementMarker(mapFixture)
assert.equal(mapMarker, 'tts-map:27:0123456789ABCDEF')
assert.match(formatMapAnnouncement({ item: mapFixture, kind: 'added' }), /New Infinity TTS Map/)
assert.match(formatMapAnnouncement({ item: mapFixture, kind: 'added' }), /Download TTS JSON/)
assert.match(formatMapAnnouncement({ item: mapFixture, kind: 'updated' }), /Infinity TTS Map Updated/)
const workshopMapFixture = {
  id: '3719263238:abc123',
  source: 'lobo-workshop',
  workshopId: '3719263238',
  name: 'LL Map 15 The Dig/Provisioning',
  createdAt: '2026-09-22T03:48:37.000Z',
  pageUrl: workshopFixture.url,
  previewUrl: 'https://images.steamusercontent.com/workshop-preview.jpg',
  objectCount: 142,
  contentSignature: 'ABCDEF0123456789ABCDEF0123456789',
}
const workshopMapAnnouncement = formatMapAnnouncement({ item: workshopMapFixture, kind: 'added' })
assert.match(workshopMapAnnouncement, /New Lobo Workshop Map/)
assert.match(workshopMapAnnouncement, /142 table objects/)
assert.match(workshopMapAnnouncement, /Open Lobo's Infinity Maps workshop/)
assert.doesNotMatch(workshopMapAnnouncement, /Download TTS JSON/)
assert.match(formatMapAnnouncement({ item: workshopMapFixture, kind: 'updated' }), /Lobo Workshop Map Updated/)
const priorAnnouncements = new Map([
  ['message-1', { author: { id: 'bot-1' }, content: `-# ${workshopMarker}` }],
  ['message-2', { author: { id: 'bot-1' }, content: `-# ${mapMarker}` }],
])
const announcementChannel = { messages: { fetch: async () => priorAnnouncements } }
assert.deepEqual(await filterUnannouncedWorkshopChanges(announcementChannel, [workshopFixture], 'bot-1'), [])
assert.deepEqual(await filterUnannouncedWorkshopChanges(announcementChannel, [{ ...workshopFixture, updatedAt: workshopFixture.updatedAt + 1 }], 'bot-1'), [{ ...workshopFixture, updatedAt: workshopFixture.updatedAt + 1 }])
assert.deepEqual(await filterUnannouncedMapChanges(announcementChannel, [{ kind: 'added', item: mapFixture }], 'bot-1'), [])
const revisedMap = { ...mapFixture, contentSignature: 'FEDCBA98765432100123456789ABCDEF' }
assert.deepEqual(await filterUnannouncedMapChanges(announcementChannel, [{ kind: 'updated', item: revisedMap }], 'bot-1'), [{ kind: 'updated', item: revisedMap }])
const noHistoryChannel = { messages: { fetch: async () => { throw new Error('Missing Read Message History') } } }
await assert.rejects(filterUnannouncedMapChanges(noHistoryChannel, [{ kind: 'added', item: mapFixture }], 'bot-1'), /posts are deferred/)
await assert.rejects(filterUnannouncedWorkshopChanges(noHistoryChannel, [workshopFixture], 'bot-1'), /posts are deferred/)
assert.equal(MISSION_COMMAND_DEFINITION.name, 'mission')
assert.equal(MISSION_COMMAND_DEFINITION.options[0].name, 'scenario')
assert.equal(MISSION_COMMAND_DEFINITION.options[0].required, true)
assert.equal(INF_ID_COMMAND_DEFINITION.name, 'inf-id')
assert.equal(INF_ID_COMMAND_DEFINITION.options[0].name, 'army-code')
assert.equal(INF_ID_COMMAND_DEFINITION.options[0].required, true)
assert.equal(RULES_COMMAND_DEFINITION.name, 'rules')
assert.equal(RULES_COMMAND_DEFINITION.options[0].name, 'question')
assert.equal(RULES_COMMAND_DEFINITION.options[0].required, true)
assert.equal(INF_LIST_COMMAND_DEFINITION.name, 'inf-list')
assert.equal(INF_LIST_COMMAND_DEFINITION.options[0].name, 'army-code')
assert.equal(INF_LIST_COMMAND_DEFINITION.options[0].required, true)
assert.equal(INF_LIST_COMMAND_DEFINITION.options[1].name, 'mobile-gunfighter')
assert.equal(INF_LIST_COMMAND_DEFINITION.options[1].required, false)
assert.equal(AVAILABILITY_COMMAND_DEFINITION.name, 'availability')
assert.equal(FIND_GAME_COMMAND_DEFINITION.name, 'find-game')
const registeredSlashCommands = []
const commandClient = {
  application: { commands: { fetch: async () => [] } },
  guilds: { cache: new Map([['guild-1', { id: 'guild-1', commands: {
    fetch: async () => registeredSlashCommands,
    create: async (definition) => {
      const command = { id: 'inf-list-1', name: definition.name, applicationId: 'app-1', guildId: 'guild-1', description: definition.description, options: definition.options.map(option => ({ ...option, ...(option.max_length ? { maxLength: option.max_length } : {}) })) }
      registeredSlashCommands.push(command)
      return command
    },
  } }]]) },
}
assert.equal((await ensureInfListCommand(commandClient)).length, 1)
assert.equal((await ensureInfListCommand(commandClient)).length, 1)
assert.equal(registeredSlashCommands.filter((command) => command.id === 'inf-list-1').length, 1)
let infListEdits = 0
registeredSlashCommands[0].options = registeredSlashCommands[0].options.slice(0, 1)
registeredSlashCommands[0].edit = async definition => {
  infListEdits++
  registeredSlashCommands[0].options = definition.options.map(option => ({ ...option, ...(option.max_length ? { maxLength: option.max_length } : {}) }))
  return registeredSlashCommands[0]
}
await ensureInfListCommand(commandClient)
await ensureInfListCommand(commandClient)
assert.equal(infListEdits, 1)
assert.equal(registeredSlashCommands[0].options[1].name, 'mobile-gunfighter')
const slashRenderCalls = []
const slashInteraction = mockInteraction(testCode)
const slashHandler = createInfListInteractionHandler({
  render: async ({ input }) => {
    slashRenderCalls.push(input)
    return { legality, officialArmyUrl, profilePages, readableImageBuffer, tacticalPages }
  },
  logger: { error() {} },
})
installFeedbackCapture(slashInteraction)
assert.equal(await slashHandler(slashInteraction), true)
assert.equal(slashInteraction.deferred, true)
assert.deepEqual(slashRenderCalls, [testCode])
assert.ok(slashInteraction.edits[0].components.at(-1).components[0].custom_id.startsWith('bot-report:'))
assert.equal(slashInteraction.edits[0].content, `${legalityText}\n\n[Open in Infinity Army](${officialArmyUrl})`)
assert.equal(slashInteraction.edits[0].files[0].attachment, readableImageBuffer)
assert.equal(slashInteraction.edits[0].files[0].name, 'infinity-army-list-readable.png')
assert.equal(slashInteraction.edits[0].files.length, 1)

const invalidSlash = mockInteraction('not$a$code')
assert.equal(await slashHandler(invalidSlash), true)
assert.equal(invalidSlash.deferred, true)
assert.deepEqual(invalidSlash.edits, ["That doesn't look like a valid Infinity Army code."])

for (const badInput of ['not$a$code', 'https://example.com/army/list/code']) {
  const invalid = mockInteraction(badInput)
  assert.equal(await slashHandler(invalid), true)
  assert.deepEqual(invalid.edits, ["That doesn't look like a valid Infinity Army code."])
}
for (const [code, expected] of [
  ['renderer_rejected', 'That Army code could not be rendered.'],
  ['renderer_timeout', 'The Army list renderer is temporarily unavailable. Try again shortly.'],
]) {
  const failingHandler = createInfListInteractionHandler({
    render: async () => { throw new InfListRenderError(code, 'private upstream detail') }, logger: { error() {} },
  })
  const failed = mockInteraction(testCode)
  assert.equal(await failingHandler(failed), true)
  assert.deepEqual(failed.edits, [expected])
}

let active = 0
let maximumActive = 0
const withSlot = createConcurrencyLimiter(2)
await Promise.all(Array.from({ length: 5 }, () => withSlot(async () => {
  active += 1
  maximumActive = Math.max(maximumActive, active)
  await new Promise((resolve) => setTimeout(resolve, 5))
  active -= 1
})))
assert.equal(maximumActive, 2)

const client = createLobosLittleHelper()
assert.equal(client.listenerCount(Events.InteractionCreate), 20)
assert.equal(client.listenerCount(Events.MessageCreate), 0)
let messageReplies = 0
for (const content of ['!!inf-list QUJDRA==', '!!inf-list', '!!build-list', '!!rules question', '!!anything']) {
  client.emit(Events.MessageCreate, { content, author: { bot: false }, reply: async () => { messageReplies++ } })
}
await new Promise(resolve => setImmediate(resolve))
assert.equal(messageReplies, 0, 'prefix messages must not invoke commands or reply')
client.destroy()

if (process.argv.includes('--live')) {
  const memberFixtureSource = await readFile('scripts/infinity-army-member-format-check.mjs', 'utf8')
  const currentCode = memberFixtureSource.match(/const loboCode =\s*\n?\s*'([^']+)'/)?.[1]
  assert.ok(currentCode, 'Established current-format Lobo fixture was not found.')
  const liveSlash = mockInteraction(currentCode)
  let rendered
  installFeedbackCapture(liveSlash)
  assert.equal(await createInfListInteractionHandler({ render: async args => { rendered = await renderInfListPng(args); return rendered } })(liveSlash), true)
  assert.equal(liveSlash.deferred, true)
  assert.equal(liveSlash.edits.length, 1)
  assert.match(liveSlash.edits[0].content, /^(✅ \*\*LEGAL ARMY LIST\*\*|❌ \*\*ILLEGAL ARMY LIST\*\*|⚠️ \*\*ARMY LIST VALIDATION UNAVAILABLE\*\*)/)
  assert.equal(liveSlash.edits[0].files.length, 2)
  const readablePng = liveSlash.edits[0].files[0].attachment
  assert.ok(Buffer.isBuffer(readablePng))
  assert.equal(readablePng.subarray(0, 4).toString('hex'), '89504e47')
  assert.ok(readablePng.length > 10_000)
  assert.equal(readablePng.readUInt32BE(16), 686)
  assert.equal(readablePng.readUInt32BE(20), 651)
  assert.ok(liveSlash.edits[0].files[1].name.endsWith('-tts-2d.json'))
  const tacticalPng = rendered.tacticalPages[0].imageBuffer
  assert.equal(tacticalPng.readUInt32BE(16), 1440)
  assert.ok(tacticalPng.readUInt32BE(20) <= 7500)
  assert.ok(rendered.tacticalAnalysis.categories.gunfighters.length > 0)
}

console.log(`PASS - ${BOT_NAME} handles army slash interactions, safe errors and concurrency; prefix message commands are removed${process.argv.includes('--live') ? ' with live renderer coverage' : ''}.`)

function mockInteraction(armyCode) {
  return {
    commandName: 'inf-list',
    deferred: false,
    replied: false,
    edits: [],
    isChatInputCommand: () => true,
    options: { getString: (name, required) => name === 'army-code' && required ? armyCode : null },
    async deferReply() { this.deferred = true },
    async editReply(response) { this.edits.push(response) },
    async followUp(response) { this.edits.push(response) },
    async reply(response) { this.replied = true; this.edits.push(response) },
  }
}
