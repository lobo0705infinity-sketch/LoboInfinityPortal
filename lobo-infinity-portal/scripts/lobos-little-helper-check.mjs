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
  SUCCESS_TEXT,
  USAGE_TEXT,
  INF_LIST_COMMAND_DEFINITION,
  createInfListInteractionHandler,
  createConcurrencyLimiter,
  createInfListMessageHandler,
  ensureInfListCommand,
  parseInfListCommand,
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
import { GatewayIntentBits } from 'discord.js'
import { MISSION_COMMAND_DEFINITION } from '../bot/mission-command.mjs'
import { INF_ID_COMMAND_DEFINITION } from '../bot/inf-id-command.mjs'
import { RULES_COMMAND_DEFINITION } from '../bot/rules-command.mjs'

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
const renderCalls = []
const handler = createInfListMessageHandler({
  render: async (options) => {
    renderCalls.push(options)
    return { legality, officialArmyUrl, profilePages, readableImageBuffer, tacticalPages }
  },
})

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
assert.deepEqual(await filterUnannouncedMapChanges(noHistoryChannel, [{ kind: 'added', item: mapFixture }], 'bot-1'), [{ kind: 'added', item: mapFixture }])
assert.deepEqual(await filterUnannouncedWorkshopChanges(noHistoryChannel, [workshopFixture], 'bot-1'), [workshopFixture])
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
assert.deepEqual(parseInfListCommand(`!!inf-list\r\n ${testCode}\r\n`), { armyCode: testCode })
assert.equal(parseInfListCommand('!!inf-list-c anything'), null)
assert.equal(parseInfListCommand('!!inf anything'), null)

let message = mockMessage(`!!inf-list ${testCode}`)
assert.equal(await handler(message), true)
assert.deepEqual(renderCalls, [{ input: testCode }])
assert.equal(message.replies.length, 1)
assert.equal(message.replies[0].content, `${legalityText}\n\n${SUCCESS_TEXT}\n\n[Open in Infinity Army](${officialArmyUrl})`)
assert.equal(message.replies[0].files[0].attachment, readableImageBuffer)
assert.equal(message.replies[0].files[0].name, 'infinity-army-list-readable.png')
assert.equal(message.replies[0].files[1].attachment, tacticalPages[0].imageBuffer)
assert.equal(message.replies[0].files[1].name, 'infinity-army-tactical-brief.png')
assert.equal(message.replies[0].files.length, 2)

const slashRenderCalls = []
const slashInteraction = mockInteraction(testCode)
const slashHandler = createInfListInteractionHandler({
  render: async ({ input }) => {
    slashRenderCalls.push(input)
    return { legality, officialArmyUrl, profilePages, readableImageBuffer, tacticalPages }
  },
  logger: { error() {} },
})
assert.equal(await slashHandler(slashInteraction), true)
assert.equal(slashInteraction.deferred, true)
assert.deepEqual(slashRenderCalls, [testCode])
assert.deepEqual(slashInteraction.edits, message.replies)

const invalidSlash = mockInteraction('not$a$code')
assert.equal(await slashHandler(invalidSlash), true)
assert.equal(invalidSlash.deferred, true)
assert.deepEqual(invalidSlash.edits, ["That doesn't look like a valid Infinity Army code."])

message = mockMessage('!!inf-list')
assert.equal(await handler(message), true)
assert.deepEqual(message.replies, [USAGE_TEXT])

for (const badInput of ['not$a$code', 'https://example.com/army/list/code']) {
  message = mockMessage(`!!inf-list ${badInput}`)
  assert.equal(await handler(message), true)
  assert.deepEqual(message.replies, ["That doesn't look like a valid Infinity Army code."])
}

for (const [code, expected] of [
  ['renderer_rejected', 'That Army code could not be rendered.'],
  ['renderer_timeout', 'The Army list renderer is temporarily unavailable. Try again shortly.'],
]) {
  const failingHandler = createInfListMessageHandler({
    render: async () => { throw new InfListRenderError(code, 'private upstream detail') },
  })
  message = mockMessage(`!!inf-list ${testCode}`)
  assert.equal(await failingHandler(message), true)
  assert.deepEqual(message.replies, [expected])
}

for (const ignored of ['hello', '!!inf thing', '!!inf-list-c thing', 'prefix !!inf-list thing']) {
  message = mockMessage(ignored)
  assert.equal(await handler(message), false)
  assert.deepEqual(message.replies, [])
}

message = mockMessage(`!!inf-list ${testCode}`, { bot: true })
assert.equal(await handler(message), false)
assert.deepEqual(message.replies, [])

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
client.destroy()

if (process.argv.includes('--live')) {
  const memberFixtureSource = await readFile('scripts/infinity-army-member-format-check.mjs', 'utf8')
  const currentCode = memberFixtureSource.match(/const loboCode =\s*\n?\s*'([^']+)'/)?.[1]
  assert.ok(currentCode, 'Established current-format Lobo fixture was not found.')
  const liveMessage = mockMessage(`!!inf-list ${currentCode}`)
  let legacyRendered
  assert.equal(await createInfListMessageHandler({ render: async (args) => { legacyRendered = await renderInfListPng(args); return legacyRendered } })(liveMessage), true)
  assert.equal(liveMessage.replies.length, 1)
  assert.match(liveMessage.replies[0].content, /^(✅ \*\*LEGAL ARMY LIST\*\*|❌ \*\*ILLEGAL ARMY LIST\*\*|⚠️ \*\*ARMY LIST VALIDATION UNAVAILABLE\*\*)/)
  assert.equal(liveMessage.replies[0].files.length, 4)
  const readablePng = liveMessage.replies[0].files[0].attachment
  assert.ok(Buffer.isBuffer(readablePng))
  assert.equal(readablePng.subarray(0, 4).toString('hex'), '89504e47')
  assert.ok(readablePng.length > 10_000)
  assert.equal(readablePng.readUInt32BE(16), 686)
  assert.equal(readablePng.readUInt32BE(20), 651)
  const tacticalPng = liveMessage.replies[0].files[1].attachment
  assert.equal(liveMessage.replies[0].files[1].name, 'infinity-army-tactical-brief.png')
  assert.equal(tacticalPng.readUInt32BE(16), 1440)
  assert.ok(tacticalPng.readUInt32BE(20) <= 7500)
  assert.deepEqual(Object.keys(legacyRendered.tacticalAnalysis.categories), ['apex', 'competent', 'hacking', 'valuableAro', 'disposableAro', 'alternative', 'defensive'])
  assert.equal(Object.values(legacyRendered.tacticalAnalysis.categories).every((entries) => entries.length > 0), true)
  for (const [index, file] of liveMessage.replies[0].files.slice(2).entries()) {
    assert.equal(file.name, `infinity-army-profiles-${index + 1}.png`)
    assert.ok(Buffer.isBuffer(file.attachment))
    assert.equal(file.attachment.subarray(0, 4).toString('hex'), '89504e47')
    assert.ok(file.attachment.length > 10_000)
  }
  const liveSlash = mockInteraction(currentCode)
  let slashRendered
  assert.equal(await createInfListInteractionHandler({ render: async (args) => { slashRendered = await renderInfListPng(args); return slashRendered } })(liveSlash), true)
  assert.equal(liveSlash.deferred, true)
  assert.equal(liveSlash.edits.length, 1)
  assert.equal(liveSlash.edits[0].content, liveMessage.replies[0].content)
  assert.deepEqual(liveSlash.edits[0].files.map((file) => file.name), liveMessage.replies[0].files.map((file) => file.name))
  assert.equal(slashRendered.officialArmyUrl, legacyRendered.officialArmyUrl)
  assert.deepEqual(slashRendered.profilePages.map((page) => page.sections), legacyRendered.profilePages.map((page) => page.sections))
  assert.deepEqual(slashRendered.profilePages.map((page) => [page.width, page.height]), legacyRendered.profilePages.map((page) => [page.width, page.height]))
}

console.log(`PASS - ${BOT_NAME} preserves !!inf-list and registers /inf-list, /mission, /inf-id, and /rules${process.argv.includes('--live') ? ' with live renderer coverage' : ''}.`)

function mockMessage(content, author = { bot: false }) {
  return {
    author,
    content,
    replies: [],
    async reply(response) {
      this.replies.push(response)
    },
  }
}

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
    async reply(response) { this.replied = true; this.edits.push(response) },
  }
}
