import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import storyWorker from '../api/game-story-for-discord.mjs'

const game = {
  id: 9081, date: '9/28/2026', mission: 'Area of Interest',
  winner: 'Winner', winnerDisplayName: 'Winner', winnerFaction: 'PanOceania',
  loser: 'Loser', loserDisplayName: 'Loser', loserFaction: 'Druze Bayram Security',
  winnerArmyListId: 'list-winner', loserArmyListId: 'list-loser',
  tp: '5–2', op: '6–3', vp: '150–100', gameResult: 'win',
}
const entry = {
  unit: 'TEST TROOPER', profile: 'TEST TROOPER', canonicalUnitId: 0, combinedId: 'test-1',
  points: 30, specialist: true, hacker: false, engineer: true, doctor: true,
  forwardObserver: false, bs: 13, weapons: ['AP Heavy Machine Gun', 'CC Weapon'],
  skills: ['Martial Arts', 'Doctor', 'Engineer'], equipment: [], troopType: 'LI', orderTypes: ['regular'],
}
const lists = [
  { armyListId: 'list-winner', player: 'Winner', sectorial: 'PanOceania',
    status: 'decoded', decoded: { combatGroups: [{ entries: [entry] }] } },
  { armyListId: 'list-loser', player: 'Loser', sectorial: 'Druze Bayram Security',
    status: 'decoded', decoded: { combatGroups: [{ entries: [entry] }] } },
]

const originalToken = process.env.ARMY_INTELLIGENCE_WORKER_TOKEN
process.env.ARMY_INTELLIGENCE_WORKER_TOKEN = 'local-story-worker-token'
const invoke = async (body: unknown, token = 'local-story-worker-token', method = 'POST') => {
  const reply: { statusCode: number; body: Record<string, unknown>; headers: Record<string, string> } = {
    statusCode: 200, body: {}, headers: {},
  }
  const response = {
    setHeader(name: string, value: string) { reply.headers[name] = value; return this },
    status(value: number) { reply.statusCode = value; return this },
    json(value: Record<string, unknown>) { reply.body = value; return this },
  }
  await storyWorker({ method, headers: { authorization: `Bearer ${token}` }, body }, response)
  return reply
}

let generatedStory = ''
try {
  assert.equal((await invoke({ game, lists }, 'bad-token')).statusCode, 401)
  assert.equal((await invoke({ game, lists }, undefined, 'GET')).statusCode, 405)
  assert.equal((await invoke({ lists })).statusCode, 400, 'no submitted game, no story')
  const oneList = await invoke({ game, lists: [lists[0], { ...lists[1], status: 'pending', decoded: null }] })
  assert.equal(oneList.body.pending, true, 'story waits for both decoded game-linked lists')
  const wrongList = await invoke({ game, lists: [lists[0], { ...lists[1], armyListId: 'another-game' }] })
  assert.equal(wrongList.body.pending, true, 'an unrelated decoded roster cannot start the story')
  const ready = await invoke({ game, lists })
  assert.equal(ready.statusCode, 200)
  assert.equal(ready.body.success, true)
  generatedStory = String(ready.body.story)
  assert.match(generatedStory, /Winner/)
  assert.match(generatedStory, /Loser/)
  assert.equal(generatedStory.split(/\n\n/).length, 4)
  const idlessGame = { ...game, winnerArmyListId: '', loserArmyListId: '' }
  const idlessLists = lists.map((list, index) => ({ ...list, armyListId: '',
    opponent: index ? 'Winner' : 'Loser', mission: game.mission, date: game.date }))
  assert.equal((await invoke({ game: idlessGame, lists: idlessLists })).body.success, true,
    'a submitted game without stored list IDs can use the unique report linkage')
  assert.equal((await invoke({ game: idlessGame, lists: [...idlessLists, { ...idlessLists[0] }] })).body.pending, true,
    'an ambiguous ID-less list cannot generate a story')
  const sharedCodeGame = { ...game, loserArmyCode: 'roster-from-submission%3D' }
  const savedByAnotherPlayer = { ...lists[1], player: 'Earlier list owner',
    armyCode: 'roster-from-submission=' }
  assert.equal((await invoke({ game: sharedCodeGame,
    lists: [lists[0], savedByAnotherPlayer] })).body.success, true,
  'a code submitted in this game may use the same decoded list saved under another name')
  assert.equal((await invoke({ game: sharedCodeGame,
    lists: [lists[0], { ...savedByAnotherPlayer, armyCode: 'other=' }] })).body.pending, true,
  'a different code stays pending even when its list ID matches')
} finally {
  if (originalToken === undefined) delete process.env.ARMY_INTELLIGENCE_WORKER_TOKEN
  else process.env.ARMY_INTELLIGENCE_WORKER_TOKEN = originalToken
}

// Run the Apps Script queue in an isolated VM. No Discord message or network
// request is made; this tests the transition across all four real stages.
const scheduler = readFileSync('backend/ArmyIntelligenceScheduler.gs', 'utf8')
const automation = readFileSync('backend/AutomationApi.gs', 'utf8')
const steps: string[] = []
let lastWorkerLists: Array<{ player: string }> = []
let canonicalGame: typeof game | null = null
let decodedLists: typeof lists = []
let workerResult: Record<string, unknown> = { success: true, story: generatedStory }
let discordResult: Record<string, unknown> = { success: true }
const queueUpdates: Array<{ status: string; attempts: number }> = []
const context = vm.createContext({ console, Date, JSON,
  UrlFetchApp: { fetch(_url: string, options: { payload: string }) {
    steps.push('story-generated')
    const request = JSON.parse(options.payload)
    lastWorkerLists = request.lists
    assert.equal(request.game.id, game.id)
    assert.equal(request.lists.length, 2)
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(workerResult) }
  } },
})
vm.runInContext(`${scheduler}\n${automation}`, context)
const buildFromSubmittedRow = context.buildAutomationGamePayloadById_
context.CONFIG = { SHEETS: { FORM: 'Form Responses' } }
context.lifGetTargetSpreadsheet_ = () => ({ getSheetByName: () => ({
  getLastRow: () => game.id + 1,
  getLastColumn: () => 2,
  getRange: () => ({ getValues: () => [['first-player-code', 'second-player-code']] }),
}) })
context.validateGame = () => true
context.determineWinner = () => 2
context.buildAnalyticsRow = () => []
context.getRecentGameColumns = () => ({})
context.getGameAnalyticsHeaders = () => [[]]
context.buildRecentGame = () => ({ ...game, winnerArmyCode: '', loserArmyCode: '' })
context.getGameEnginePlayerArmyCode = (row: string[], playerNumber: number) => row[playerNumber - 1]
const gameWithSubmittedCodes = buildFromSubmittedRow(game.id)
assert.equal(gameWithSubmittedCodes.winnerArmyCode, 'second-player-code',
  'worker must read the submitted winner code even when an analytics row omits it')
assert.equal(gameWithSubmittedCodes.loserArmyCode, 'first-player-code')
context.parseAutomationPayload = (value: string) => typeof value === 'string' ? JSON.parse(value) : value
context.buildAutomationGamePayloadById_ = (id: number) => {
  steps.push('game-read')
  assert.equal(id, game.id)
  return canonicalGame
}
context.readArmyIntelligenceReadModelPayload = () => { steps.push('lists-read'); return { lists: decodedLists } }
context.getArmyIntelligenceSchedulerToken_ = () => 'local-story-worker-token'
context.buildDiscordGamePayload = (_game: typeof game, story: string) => {
  steps.push('discord-payload')
  assert.equal(story, generatedStory)
  return { content: story }
}
context.sendDiscordAnnouncementPayload = (_event: string, payload: { content: string }, options: { storyGenerated: boolean }) => {
  steps.push(discordResult.skipped === true ? 'discord-skipped' : 'discord-sent')
  assert.equal(payload.content, generatedStory)
  assert.equal(options.storyGenerated, true)
  return discordResult
}
context.updateAutomationQueueItem = (_id: string, status: string, attempts: number) => {
  queueUpdates.push({ status, attempts })
}
const item = {
  queueId: 'gameSubmitted-game-9081-discord', eventId: 'gameSubmitted-game-9081',
  eventType: 'gameSubmitted', destination: 'discord', status: 'Pending', attempts: 0,
  rowNumber: 2, payload: JSON.stringify({ payload: { gameId: game.id } }),
}

assert.equal(context.processDiscordQueueItem(item, false).status, 'Waiting')
assert.deepEqual(steps, ['game-read'])
canonicalGame = game
assert.equal(context.processDiscordQueueItem(item, false).status, 'Waiting')
assert.deepEqual(steps.slice(-2), ['game-read', 'lists-read'])
decodedLists = [lists[0]]
assert.equal(context.processDiscordQueueItem(item, false).status, 'Waiting')
decodedLists = lists
workerResult = { success: false, pending: true, error: 'Still waiting for a linked story.' }
assert.equal(context.processDiscordQueueItem(item, false).status, 'Waiting')
assert.equal(steps.includes('discord-sent'), false)
workerResult = { success: true, story: generatedStory }
discordResult = { success: true, skipped: true }
assert.equal(context.processDiscordQueueItem(item, false).status, 'Waiting',
  'paused Discord must retain the generated story in the queue for later delivery')
assert.equal(steps.at(-1), 'discord-skipped')
assert.deepEqual(queueUpdates.at(-1), { status: 'Waiting', attempts: 0 })
discordResult = { success: true }
assert.equal(context.processDiscordQueueItem(item, false).success, true)
assert.deepEqual(steps.slice(-5), ['game-read', 'lists-read', 'story-generated', 'discord-payload', 'discord-sent'])
assert.deepEqual(queueUpdates.map((item) => item.status), ['Waiting', 'Waiting', 'Waiting', 'Waiting', 'Waiting', 'Sent'])
assert.deepEqual(queueUpdates.map((item) => item.attempts), [0, 0, 0, 0, 0, 1])

canonicalGame = { ...game, loserArmyCode: 'roster-from-submission%3D' }
decodedLists = [lists[0], { ...lists[1], player: 'Earlier list owner',
  armyCode: 'roster-from-submission=' }]
assert.equal(context.processDiscordQueueItem(item, false).success, true,
  'the queue should pass an exact code match to the story worker regardless of saved owner')
assert.equal(lastWorkerLists[1]?.player, 'Earlier list owner',
  'the backend passes decoded contents; the worker binds them to the game player')
decodedLists = [lists[0], { ...decodedLists[1], status: 'failed', decoded: null,
  error: 'Invalid IDs in Army Code: out-of-date unit option.' }]
const failedDecodeQueue = context.processDiscordQueueItem(item, false)
assert.equal(failedDecodeQueue.status, 'Waiting',
  'decoder failures retain the queue item for a later verified refresh')
assert.match(failedDecodeQueue.reason, /decoder repair/i,
  'the queue must expose a known decoder rejection rather than hiding it as missing data')
decodedLists = [lists[0], { ...decodedLists[1], status: 'decoded',
  decoded: lists[1].decoded, armyCode: 'different-code=' }]
assert.equal(context.processDiscordQueueItem(item, false).status, 'Waiting',
  'the queue must reject a reused list ID if the submitted code differs')

canonicalGame = { ...game, winnerArmyListId: '', loserArmyListId: '' }
decodedLists = lists.map((list, index) => ({ ...list, armyListId: '',
  opponent: index ? 'Winner' : 'Loser', mission: game.mission, date: game.date }))
assert.equal(context.processDiscordQueueItem(item, false).success, true,
  'an ID-less Google Form game also reaches Discord after both lists decode')
assert.deepEqual(steps.slice(-5), ['game-read', 'lists-read', 'story-generated', 'discord-payload', 'discord-sent'])

context.getDiscordConfig = () => ({ retryLimit: 3 })
context.getAutomationString = (value: unknown) => String(value ?? '').trim()
context.ensureAutomationQueueSheet = () => ({ getLastRow: () => 3,
  getRange: () => ({ getValues: () => [
    ['old', 'event-1', 'gameSubmitted', 'discord', 'Waiting', '2026-09-28T00:00:00Z', 0,
      '2026-09-28T00:05:00Z', 'Waiting', item.payload],
    ['new', 'event-2', 'gameSubmitted', 'discord', 'Pending', '2026-09-28T00:06:00Z', 0, '', '', item.payload],
  ] }),
})
assert.equal(context.selectPendingAutomationQueueItems_(1)[0].queueId, 'new',
  'an undecoded waiting game cannot starve a newer submission')
context.ensureAutomationQueueSheet = () => ({ getLastRow: () => 104,
  getRange: (firstRow: number) => {
    assert.equal(firstRow, 2, 'the oldest waiting game must remain reachable after 100 newer events')
    return { getValues: () => [
      ['old', 'event-1', 'gameSubmitted', 'discord', 'Waiting', '2026-09-28T00:00:00Z', 0,
        '2026-09-28T00:05:00Z', 'Waiting', item.payload],
      ...Array.from({ length: 102 }, (_unused, index) => [
        `sent-${index}`, 'event', 'other', 'discord', 'Sent', '', 1, '', '', '',
      ]),
    ] }
  },
})
assert.equal(context.selectPendingAutomationQueueItems_(1)[0].queueId, 'old')
console.log('Story delivery order: canonical submission, both decoded lists, generated story, then Discord.')
