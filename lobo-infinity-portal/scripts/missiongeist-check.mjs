import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  buildCaptureRanges,
  captureMissionGeistScenario,
  fetchMissionGeistCatalog,
  flattenMissionGeistListing,
  getMissionScenario,
  MISSIONGEIST_ORIGIN,
  normalizeMissionName,
  resolveMissionQuery,
  validateCanonicalMissionUrl,
} from './missiongeist-scenarios.mjs'
import { createMissionInteractionHandler, ensureMissionCommand, MISSION_COMMAND_DEFINITION } from '../bot/mission-command.mjs'

const fixtureListing = {
  contentHash: 'test', generatedAt: '2026-09-05T00:00:00Z', seasons: [
    { id: 's17', name: 'ITS Season 17', current: false, missions: [
      mission('s17_supplies', 'Supplies'), mission('s17_acquisition', 'Acquisition'),
    ] },
    { id: 's18', name: 'ITS Season 18', current: true, missions: [
      mission('s18_supplies', 'Supplies'), mission('s18_highly_classified', 'Highly Classified'),
      mission('s18_capture_and_protect', 'Capture and Protect'), mission('s18_acquisition', 'Acquisition'),
    ] },
  ],
}
const fixtureMissions = flattenMissionGeistListing(fixtureListing)

assert.equal(MISSION_COMMAND_DEFINITION.name, 'mission')
assert.equal(MISSION_COMMAND_DEFINITION.options[0].required, true)
await testGuildCommandRegistration()
assert.equal(normalizeMissionName('  HIGHLY—Classified! '), 'highly classified')
assert.equal(normalizeMissionName('Capture &   Protect'), 'capture and protect')
for (const query of ['Supplies', 'supplies', 'SUPPLIES']) {
  assert.equal(resolveMissionQuery(query, fixtureMissions).mission.id, 's18_supplies')
}
assert.equal(resolveMissionQuery('HC', fixtureMissions).mission.id, 's18_highly_classified')
assert.equal(resolveMissionQuery('Unmaskng', [...fixtureMissions, missionRecord('s18_unmasking', 'Unmasking', true)]).mission.id, 's18_unmasking')
assert.notEqual(resolveMissionQuery('capture', fixtureMissions).kind, 'resolved')
assert.equal(resolveMissionQuery('acqui', fixtureMissions).kind, 'not_found')
assert.equal(resolveMissionQuery('classified', [...fixtureMissions, missionRecord('s18_classified_kill', 'Classified Kill', true)]).kind, 'ambiguous')
assert.equal(resolveMissionQuery('no such mission', fixtureMissions).kind, 'not_found')
assert.throws(() => validateCanonicalMissionUrl('https://example.com/mission/s18_supplies'), /unsafe/)
assert.throws(() => validateCanonicalMissionUrl('http://infinitygeist.com/mission/s18_supplies'), /unsafe/)
assert.equal(validateCanonicalMissionUrl(`${MISSIONGEIST_ORIGIN}/mission/s18_supplies`), `${MISSIONGEIST_ORIGIN}/mission/s18_supplies`)

const ranges = buildCaptureRanges({ height: 4100, boundaries: [1300, 1470, 2700, 2890] })
assert.equal(ranges.length, 3)
assert.equal(ranges[0].start, 0)
assert.equal(ranges.at(-1).end, 4100)
assert.ok(ranges.every((range) => range.end - range.start >= 1000 && range.end - range.start <= 1500))
for (let index = 1; index < ranges.length; index += 1) {
  assert.ok(ranges[index].start <= ranges[index - 1].end, 'capture ranges have no gaps')
  assert.ok(ranges[index - 1].end - ranges[index].start <= 80, 'capture overlap stays small')
}

await testInteractionResponses()
await testCacheReuseAndConcurrency()

if (process.argv.includes('--live')) {
  const { clearMissionGeistMemoryCacheForTests } = await import('./missiongeist-scenarios.mjs')
  clearMissionGeistMemoryCacheForTests()
  await runLiveAudit()
}
else console.log('MissionGeist regression passed. Add --live for live resolution and capture audits.')

async function testInteractionResponses() {
  const replies = []
  const lifecycle = []
  const handler = createMissionInteractionHandler({
    retrieve: async () => {
      lifecycle.push('retrieve')
      return { kind: 'ambiguous', query: 'class', matches: fixtureMissions.slice(0, 2) }
    },
    logger: { error() {}, info() {} },
  })
  const handled = await handler({
    commandName: 'mission', deferred: false,
    deferReply: async function () { lifecycle.push('defer'); this.deferred = true },
    editReply: async (value) => replies.push(value),
    isChatInputCommand: () => true, options: { getString: () => 'class' },
  })
  assert.equal(handled, true)
  assert.deepEqual(lifecycle, ['defer', 'retrieve'], 'Discord acknowledgement precedes all MissionGeist work')
  assert.match(replies[0], /multiple possible missions/)

  const acknowledgementReplies = []
  const acknowledgementErrors = []
  const acknowledgementFailureHandler = createMissionInteractionHandler({
    retrieve: async () => assert.fail('retrieve must not run after acknowledgement failure'),
    logger: { error: (...values) => acknowledgementErrors.push(values), info() {} },
  })
  await acknowledgementFailureHandler({
    commandName: 'mission', deferred: false, replied: false,
    deferReply: async () => { throw new Error('acknowledgement rejected') },
    isChatInputCommand: () => true, options: { getString: () => 'Supplies' },
    reply: async (value) => acknowledgementReplies.push(value),
  })
  assert.equal(acknowledgementErrors.length, 1, 'acknowledgement failure is logged')
  assert.equal(acknowledgementReplies.length, 1, 'pre-acknowledgement failure attempts a safe initial reply')
  assert.equal(acknowledgementReplies[0].ephemeral, true)

  const deferredErrors = []
  const deferredReplies = []
  const deferredFailureHandler = createMissionInteractionHandler({
    retrieve: async () => { throw new Error('capture failed') },
    logger: { error: (...values) => deferredErrors.push(values), info() {} },
  })
  await deferredFailureHandler({
    commandName: 'mission', deferred: false, replied: false,
    deferReply: async function () { this.deferred = true },
    editReply: async (value) => deferredReplies.push(value),
    isChatInputCommand: () => true, options: { getString: () => 'Supplies' },
  })
  assert.equal(deferredErrors.length, 1)
  assert.deepEqual(deferredReplies, ["I couldn't retrieve that MissionGeist scenario right now."])

  const successReplies = []
  const successHandler = createMissionInteractionHandler({ retrieve: async () => ({
    kind: 'resolved', mission: fixtureMissions[0], segments: [
      { imageBuffer: Buffer.from('one') }, { imageBuffer: Buffer.from('two') },
    ],
  }) })
  await successHandler({
    commandName: 'mission', deferReply: async () => {}, followUp: async () => {},
    editReply: async (value) => successReplies.push(value), isChatInputCommand: () => true,
    options: { getString: () => 'Supplies' },
  })
  assert.match(successReplies[0].content, /MissionGeist:/)
  assert.equal(successReplies[0].files.length, 2)
  assert.deepEqual(successReplies[0].files.map((file) => file.name), ['supplies-01.png', 'supplies-02.png'])

  const attachmentReplies = []
  const attachmentFollowUps = []
  const manyAttachmentsHandler = createMissionInteractionHandler({ retrieve: async () => ({
    kind: 'resolved', mission: fixtureMissions[0],
    segments: Array.from({ length: 11 }, () => ({ imageBuffer: Buffer.from('segment') })),
  }) })
  await manyAttachmentsHandler({
    commandName: 'mission', deferReply: async () => {},
    editReply: async (value) => attachmentReplies.push(value),
    followUp: async (value) => attachmentFollowUps.push(value),
    isChatInputCommand: () => true, options: { getString: () => 'Supplies' },
  })
  assert.equal(attachmentReplies[0].files.length, 10, 'Discord attachment batch stays within ten files')
  assert.equal(attachmentFollowUps[0].files.length, 1, 'overflow attachments continue in order')
}

async function testGuildCommandRegistration() {
  const deletedGlobals = []
  const createdGuildCommands = []
  const globalMission = { name: 'mission', delete: async () => deletedGlobals.push('mission') }
  const client = {
    application: { commands: { fetch: async () => [globalMission] } },
    guilds: { cache: new Map([['guild-1', {
      id: 'guild-1',
      commands: {
        fetch: async () => [],
        create: async (definition) => {
          createdGuildCommands.push(definition)
          return { applicationId: 'app-1', guildId: 'guild-1', id: 'command-1' }
        },
      },
    }]]) },
  }
  const commands = await ensureMissionCommand(client)
  assert.equal(createdGuildCommands.length, 1, 'mission is registered in the bot guild')
  assert.equal(createdGuildCommands[0].name, 'mission')
  assert.deepEqual(deletedGlobals, ['mission'], 'only the obsolete global mission command is removed')
  assert.deepEqual(commands, [{ applicationId: 'app-1', guildId: 'guild-1', id: 'command-1' }])
}

async function testCacheReuseAndConcurrency() {
  const cacheDir = resolve('.tmp', 'missiongeist-unit-cache')
  await rm(cacheDir, { recursive: true, force: true })
  let launches = 0
  const captureImpl = async () => {
    launches += 1
    await new Promise((done) => setTimeout(done, 10))
    return { contentHeight: 900, contentWidth: 900, segments: [{
      bytes: 8, end: 900, height: 900, imageBuffer: Buffer.from('fake png'), start: 0, width: 900,
    }] }
  }
  const fetchImpl = async () => ({ ok: true, json: async () => fixtureListing })
  const [first, concurrent] = await Promise.all([
    getMissionScenario({ query: 'Supplies', captureImpl, cacheDir, fetchImpl }),
    getMissionScenario({ query: 'Supplies', captureImpl, cacheDir, fetchImpl }),
  ])
  assert.equal(launches, 1, 'concurrent identical captures share one browser job')
  assert.equal(first.segments.length, 1)
  assert.equal(concurrent.segments.length, 1)
  const repeated = await getMissionScenario({ query: 'Supplies', captureImpl, cacheDir, fetchImpl })
  assert.equal(repeated.cacheHit, true)
  assert.equal(launches, 1, 'repeat request reuses disk cache')
  await rm(cacheDir, { recursive: true, force: true })
}

async function runLiveAudit() {
  const catalog = await fetchMissionGeistCatalog()
  const cases = ['Supplies', 'Acquisition', 'Highly Classified', 'Unmaskng', 'Frostbyte']
  for (const query of cases) {
    const result = resolveMissionQuery(query, catalog.missions)
    assert.equal(result.kind, 'resolved', `${query} resolves`)
    assert.match(result.mission.canonicalUrl, /^https:\/\/infinitygeist\.com\/mission\//)
    console.log(`${query} -> ${result.mission.sourceCollectionName} / ${result.mission.name} / ${result.mission.canonicalUrl}`)
  }
  assert.notEqual(resolveMissionQuery('capture', catalog.missions).kind, 'resolved')
  assert.equal(resolveMissionQuery('definitely not a real scenario zzz', catalog.missions).kind, 'not_found')

  const auditDir = resolve('.tmp', 'audit-missiongeist-captures')
  await mkdir(auditDir, { recursive: true })
  const selected = [
    resolveMissionQuery('Supplies', catalog.missions).mission,
    resolveMissionQuery('Acquisition', catalog.missions).mission,
    resolveMissionQuery('Undisclosed Desires', catalog.missions).mission,
  ]
  for (const selectedMission of selected) {
    const capture = await captureMissionGeistScenario({ canonicalUrl: selectedMission.canonicalUrl, missionName: selectedMission.name })
    assert.ok(capture.segments.length >= 1)
    if (selectedMission.name === 'Undisclosed Desires') assert.equal(capture.segments.length, 1, 'short scenario uses one image')
    if (selectedMission.name === 'Supplies') assert.ok(capture.segments.length > 1, 'long scenario uses multiple images')
    assert.equal(capture.segments[0].start, 0)
    assert.equal(capture.segments.at(-1).end, capture.contentHeight)
    for (let index = 1; index < capture.segments.length; index += 1) {
      assert.ok(capture.segments[index].start <= capture.segments[index - 1].end)
    }
    for (const [index, segment] of capture.segments.entries()) {
      const filename = `${slug(selectedMission.name)}-${String(index + 1).padStart(2, '0')}.png`
      await writeFile(resolve(auditDir, filename), segment.imageBuffer)
      console.log(`${filename}: ${segment.width}x${segment.height}, ${segment.bytes} bytes, ${segment.start}-${segment.end}`)
    }
  }
  console.log('MissionGeist live resolution and capture audit passed.')
}

function mission(id, name) {
  return { id, name, canonicalUrl: `${MISSIONGEIST_ORIGIN}/mission/${id}`, rights: { official: true } }
}

function missionRecord(id, name, current = false) {
  return { ...mission(id, name), current, sourceCollectionId: current ? 's18' : 's17', sourceCollectionName: current ? 'ITS Season 18' : 'ITS Season 17' }
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
