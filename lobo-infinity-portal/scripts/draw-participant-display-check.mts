import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getGameParticipants } from '../src/public/gameParticipants.ts'
import { getPlayerGameResult } from '../src/public/playerGameResult.ts'
import type { PublicGame } from '../src/public/snapshotTypes.ts'

const game85 = game({
  player1: 'Chainsaw', player1DisplayName: 'Chainsaw',
  player2: 'ADangerousFrog', player2DisplayName: 'ADangerousFrog',
  winner: 'Draw', winnerDisplayName: 'Draw', loser: 'Draw', loserDisplayName: 'Draw',
})
assert.deepEqual(getGameParticipants(game85), ['Chainsaw', 'ADangerousFrog'])
assert.notDeepEqual(getGameParticipants(game85), ['Draw', 'Draw'])
assert.equal(getPlayerGameResult(game85, 'Chainsaw'), 'DRAW')

const ordinary = game({
  id: 84, player1: 'Spiroo', player1DisplayName: 'Spiroo',
  player2: 'brickwarrior', player2DisplayName: 'brickwarrior',
  winner: 'Spiroo', winnerDisplayName: 'Spiroo',
  loser: 'brickwarrior', loserDisplayName: 'brickwarrior',
})
assert.deepEqual(getGameParticipants(ordinary), ['Spiroo', 'brickwarrior'])

const reversed = game({
  player1: 'First', player1DisplayName: 'First', player2: 'Second', player2DisplayName: 'Second',
  winner: 'Second', winnerDisplayName: 'Second', loser: 'First', loserDisplayName: 'First',
})
assert.deepEqual(getGameParticipants(reversed), ['First', 'Second'])

const legacy = game({
  player1: '', player1DisplayName: '', player2: '', player2DisplayName: '',
  winner: 'Legacy Winner', winnerDisplayName: 'Legacy Winner',
  loser: 'Legacy Loser', loserDisplayName: 'Legacy Loser',
})
assert.deepEqual(getGameParticipants(legacy), ['Legacy Winner', 'Legacy Loser'])

const legacyDraw = game({
  player1: '', player1DisplayName: '', player2: '', player2DisplayName: '',
  winner: 'Draw', winnerDisplayName: 'Draw', loser: 'Draw', loserDisplayName: 'Draw',
})
assert.deepEqual(getGameParticipants(legacyDraw), ['Unknown player 1', 'Unknown player 2'])
assert.equal(getGameParticipants(legacyDraw).includes('Draw'), false)

const publicApp = readFileSync(new URL('../src/public/SnapshotPublicApp.tsx', import.meta.url), 'utf8')
assert.match(publicApp, /function DashboardGameTable[\s\S]*?<GameParticipants game=\{game\}/)
assert.match(publicApp, /function GameTable[\s\S]*?<GameParticipants game=\{g\}/)
assert.match(publicApp, /function GameDetail[\s\S]*?getGameParticipants\(g\)/)
assert.match(publicApp, /function Rivalries[\s\S]*?getGameParticipants\(g\)/)

console.log('Draw participant display regression passed.')

function game(overrides: Partial<PublicGame>): PublicGame {
  return {
    id: 85,
    eventId: 'event-august-2026-team-tournament',
    eventName: 'August 2026 Team Tournament',
    gameType: 'tournament',
    date: '2026-09-05T04:00:00.000Z',
    division: 'Team Tournament',
    player1: '', player1DisplayName: '', player1Faction: 'Torchlight Brigade',
    player2: '', player2DisplayName: '', player2Faction: 'PanOceania',
    winner: '', winnerDisplayName: '', loser: '', loserDisplayName: '',
    winnerFaction: 'Torchlight Brigade', loserFaction: 'PanOceania',
    mission: 'Neutralization', tp: '3–3', op: '5–5', vp: '111–205',
    bestMoment: '', firstTurn: '', winnerArmyListId: '', loserArmyListId: '',
    ...overrides,
  }
}
