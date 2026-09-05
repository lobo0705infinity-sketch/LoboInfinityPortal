import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const leagueFormatting = readFileSync('backend/LeagueFormatting.gs', 'utf8')
const discordApi = readFileSync('backend/DiscordApi.gs', 'utf8')

const sentLog = []
const context = vm.createContext({
  console,
  Date,
  JSON,
  getPlayerDisplayName: (value) => String(value || '').trim(),
  getDiscordConfig: () => ({ brandingColor: 12653087, thumbnailUrl: '' }),
  getDiscordLogEntries: () => sentLog,
  getEventByIdSnapshot: (eventId) => eventId === 'event-august-2026-team-tournament'
    ? { id: eventId, name: 'August 2026 Team Tournament' }
    : null,
  buildDeepLink: (_type, game) => ({ url: `https://lobo-infinity-portal.vercel.app/games/${game.id}` }),
})

vm.runInContext(`${leagueFormatting}\n${discordApi}`, context)
context.getDiscordConfig = () => ({ brandingColor: 12653087, thumbnailUrl: '' })
context.getDiscordLogEntries = () => sentLog

const game85 = {
  id: 85,
  eventId: 'event-august-2026-team-tournament',
  gameType: 'tournament',
  date: '9/5/2026',
  division: 'Team Tournament',
  player1: 'Chainsaw',
  player1DisplayName: 'Chainsaw',
  player2: 'ADangerousFrog',
  player2DisplayName: 'ADangerousFrog',
  winner: 'Draw',
  winnerDisplayName: 'Draw',
  loser: 'Draw',
  loserDisplayName: 'Draw',
  gameResult: 'Draw',
  mission: 'Neutralization',
  tp: '3–3',
  op: '5–5',
  vp: '111–205',
}

const drawPayload = context.buildDiscordGamePayload(game85)
const drawEmbed = drawPayload.embeds[0]
assert.equal(drawEmbed.title, 'Chainsaw vs ADangerousFrog')
assert.match(drawEmbed.description, /ended in a draw/i)
assert.match(drawEmbed.description, /Mission: Neutralization/)
assert.doesNotMatch(JSON.stringify(drawPayload), /Draw vs Draw|defeated|Winner|Loser/i)
assert.deepEqual(fieldValues(drawEmbed), {
  Open: '[View Match](https://lobo-infinity-portal.vercel.app/games/85)',
  'Tournament Points': '3–3 TP',
  'Objective Points': '5–5 OP',
  'Victory Points': '111–205 VP',
  Event: 'August 2026 Team Tournament',
  Date: '9/5/2026',
})

const player1Win = standardGame({
  gameResult: 'Player 1 Victory',
  winner: 'Alpha', winnerDisplayName: 'Alpha',
  loser: 'Bravo', loserDisplayName: 'Bravo',
})
const player1Payload = context.buildDiscordGamePayload(player1Win)
assert.equal(player1Payload.embeds[0].title, 'Alpha defeated Bravo')
assert.equal(player1Payload.embeds[0].description, 'Mission: Supplies')
assert.equal(fieldValues(player1Payload.embeds[0])['Winner Faction'], 'Nomads')
assert.equal(fieldValues(player1Payload.embeds[0])['Loser Faction'], 'Combined Army')

const player2Win = standardGame({
  gameResult: 'Player 2 Victory',
  player1: 'Alpha', player1DisplayName: 'Alpha',
  player2: 'Bravo', player2DisplayName: 'Bravo',
  winner: 'Bravo', winnerDisplayName: 'Bravo',
  loser: 'Alpha', loserDisplayName: 'Alpha',
  winnerFaction: 'Combined Army', loserFaction: 'Nomads',
})
const player2Payload = context.buildDiscordGamePayload(player2Win)
assert.equal(player2Payload.embeds[0].title, 'Bravo defeated Alpha')
assert.equal(player2Payload.embeds[0].description, 'Mission: Supplies')

const legacyDraw = context.buildDiscordGamePayload({
  ...game85,
  id: 80,
  player1: '', player1DisplayName: '',
  player2: '', player2DisplayName: '',
  winner: 'Legacy One', winnerDisplayName: 'Legacy One',
  loser: 'Legacy Two', loserDisplayName: 'Legacy Two',
})
assert.equal(legacyDraw.embeds[0].title, 'Legacy One vs Legacy Two')

for (const outcome of ['Draw', 'Tie', 'Tied']) {
  const malformed = context.buildDiscordGamePayload({
    ...game85,
    player1: '', player1DisplayName: '',
    player2: '', player2DisplayName: '',
    winner: outcome, winnerDisplayName: outcome,
    loser: outcome, loserDisplayName: outcome,
  })
  assert.equal(malformed.embeds[0].title, 'Unknown player 1 vs Unknown player 2')
  assert.doesNotMatch(malformed.embeds[0].title, /Draw|Tie|Tied/i)
}

const loggedPayload = context.buildDiscordLogPayload(drawPayload, {
  dedupeKey: 'gameSubmitted-game-85',
  automationEventId: 'evt-game-85',
})
sentLog.push({
  event: 'gameSubmitted',
  payload: JSON.stringify(loggedPayload),
  success: true,
  status: 'Sent',
})
assert.equal(context.isDuplicateDiscordAnnouncement('gameSubmitted', loggedPayload), true)
assert.equal(context.isDuplicateDiscordAnnouncement('gameSubmitted', context.buildDiscordLogPayload(drawPayload, {
  dedupeKey: 'gameSubmitted-game-86',
})), false)

const automation = readFileSync('backend/AutomationApi.gs', 'utf8')
assert.match(automation, /dedupeKey:\s*item\.queueId/)
assert.match(automation, /buildAutomationGamePayloadById_[\s\S]*buildDiscordGamePayload\(game \|\| eventPayload\)/)

console.log('Discord draw game regression passed.')
console.log(JSON.stringify(drawPayload, null, 2))

function standardGame(overrides) {
  return {
    id: 84,
    eventId: 'event-current-league',
    eventName: 'Lobo Infinity League',
    date: '9/4/2026',
    division: 'Main Man',
    player1: 'Alpha', player1DisplayName: 'Alpha',
    player2: 'Bravo', player2DisplayName: 'Bravo',
    winnerFaction: 'Nomads', loserFaction: 'Combined Army',
    mission: 'Supplies', tp: '4–1', op: '8–2', vp: '100–40',
    ...overrides,
  }
}

function fieldValues(embed) {
  return Object.fromEntries(embed.fields.map((field) => [field.name, field.value]))
}
