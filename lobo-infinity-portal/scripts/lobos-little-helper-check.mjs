#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  InfListRenderError,
  buildOfficialArmyUrl,
} from './inf-list-render-poc.mjs'
import {
  SUCCESS_TEXT,
  USAGE_TEXT,
  createConcurrencyLimiter,
  createInfListMessageHandler,
  parseInfListCommand,
} from '../bot/inf-list-command.mjs'
import {
  BOT_NAME,
  DISCORD_TOKEN_ENV,
  REQUIRED_INTENTS,
  createLobosLittleHelper,
} from '../bot/lobos-little-helper.mjs'
import { GatewayIntentBits } from 'discord.js'

const testCode = 'QUJDRA=='
const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const readableImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x02])
const officialArmyUrl = buildOfficialArmyUrl(testCode)
const renderCalls = []
const handler = createInfListMessageHandler({
  render: async ({ input }) => {
    renderCalls.push(input)
    return { imageBuffer, officialArmyUrl, readableImageBuffer }
  },
})

assert.equal(BOT_NAME, "Lobo's Little Helper")
assert.equal(DISCORD_TOKEN_ENV, 'DISCORD_BOT_TOKEN')
assert.deepEqual(REQUIRED_INTENTS, [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
])
assert.deepEqual(parseInfListCommand(`!!inf-list\r\n ${testCode}\r\n`), { armyCode: testCode })
assert.equal(parseInfListCommand('!!inf-list-c anything'), null)
assert.equal(parseInfListCommand('!!inf anything'), null)

let message = mockMessage(`!!inf-list ${testCode}`)
assert.equal(await handler(message), true)
assert.deepEqual(renderCalls, [testCode])
assert.equal(message.replies.length, 1)
assert.equal(message.replies[0].content, `${SUCCESS_TEXT}\n\n[Open in Infinity Army](${officialArmyUrl})`)
assert.equal(message.replies[0].files[0].attachment, imageBuffer)
assert.equal(message.replies[0].files[0].name, 'infinity-army-list.png')
assert.equal(message.replies[0].files[1].attachment, readableImageBuffer)
assert.equal(message.replies[0].files[1].name, 'infinity-army-list-readable.png')

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
  assert.equal(await createInfListMessageHandler()(liveMessage), true)
  assert.equal(liveMessage.replies.length, 1)
  assert.match(liveMessage.replies[0].content, new RegExp(`^${SUCCESS_TEXT}\\n\\n\\[Open in Infinity Army\\]\\(https://infinitytheuniverse\\.com/army/list/`))
  const livePng = liveMessage.replies[0].files[0].attachment
  assert.ok(Buffer.isBuffer(livePng))
  assert.equal(livePng.subarray(0, 4).toString('hex'), '89504e47')
  assert.ok(livePng.length > 10_000)
  const readablePng = liveMessage.replies[0].files[1].attachment
  assert.ok(Buffer.isBuffer(readablePng))
  assert.equal(readablePng.subarray(0, 4).toString('hex'), '89504e47')
  assert.ok(readablePng.length > livePng.length)
}

console.log(`PASS - ${BOT_NAME} implements only !!inf-list${process.argv.includes('--live') ? ' with live renderer coverage' : ''}.`)

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
