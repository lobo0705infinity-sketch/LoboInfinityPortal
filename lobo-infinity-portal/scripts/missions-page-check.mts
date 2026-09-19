import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { resolveMissionGeistNavigation } from '../src/config/missionGeistNavigation.ts'
import { buildMissionFactionPerformance, getMissionGames } from '../src/public/missionProfileAnalytics.ts'
import type { PublicGame } from '../src/public/snapshotTypes.ts'

const exporter = fs.readFileSync('backend/PublicSnapshotExporter.gs', 'utf8')
const publicApp = fs.readFileSync('src/public/SnapshotPublicApp.tsx', 'utf8')
const publicCss = fs.readFileSync('src/public/SnapshotPublicApp.css', 'utf8')

function extract(source: string, name: string) {
  const start = source.indexOf(`function ${name}`)
  assert.ok(start >= 0, `missing ${name}`)
  let depth = 0
  let began = false
  for (let end = start; end < source.length; end += 1) {
    if (source[end] === '{') { depth += 1; began = true }
    if (source[end] === '}') depth -= 1
    if (began && depth === 0) return source.slice(start, end + 1)
  }
  throw new Error(`unterminated ${name}`)
}

const sandbox = { Math, Object, String }
vm.createContext(sandbox)
for (const name of [
  'publicSnapshotMostFrequent_',
  'publicSnapshotMissionAverage_',
  'publicSnapshotWinnerScore_',
  'publicSnapshotPercentage_',
  'publicSnapshotRecentGames_',
  'buildPublicSnapshotMissions_',
]) vm.runInContext(extract(exporter, name), sandbox)

const games = [
  { gameId: 1, mission: 'Alpha', division: 'League', player1: 'Winner One', player2: 'Loser One', winner: 'Winner One', player1Faction: 'A', player2Faction: 'B', player1Tp: 3, player2Tp: 99, player1Op: 8, player2Op: 99, player1Vp: 250, player2Vp: 999, firstTurn: 'Player 1', date: '2026-01-01' },
  { gameId: 2, mission: 'Alpha', division: 'League', player1: 'Loser Two', player2: 'Winner Two', winner: 'Winner Two', player1Faction: 'B', player2Faction: 'A', player1Tp: 88, player2Tp: 5, player1Op: 88, player2Op: 10, player1Vp: 888, player2Vp: 300, firstTurn: 'Player 1', date: '2026-01-02' },
  { gameId: 3, mission: 'Alpha', division: 'League', player1: 'Draw One', player2: 'Draw Two', winner: 'Draw', player1Faction: 'A', player2Faction: 'B', player1Tp: 77, player2Tp: 77, player1Op: 77, player2Op: 77, player1Vp: 777, player2Vp: 777, firstTurn: 'Player 1', date: '2026-01-03' },
  { gameId: 5, mission: 'Alpha', division: 'League', player1: 'Winner Three', player2: 'Loser Three', winner: 'Winner Three', player1Faction: 'A', player2Faction: 'B', player1Tp: 7, player2Tp: 66, player1Op: 0, player2Op: 66, player1Vp: 350, player2Vp: 666, player1TpValid: true, player1OpValid: false, player1VpValid: true, firstTurn: 'Player 1', date: '2026-01-05' },
  { gameId: 4, mission: 'Draw Only', division: 'League', player1: 'Draw One', player2: 'Draw Two', winner: '', player1Faction: 'A', player2Faction: 'B', player1Tp: 1, player2Tp: 1, player1Op: 1, player2Op: 1, player1Vp: 1, player2Vp: 1, firstTurn: '', date: '2026-01-04' },
]
const before = JSON.stringify(games)
const missions = sandbox.buildPublicSnapshotMissions_(games)
const alpha = missions.find((mission: { mission: string }) => mission.mission === 'Alpha')
assert.equal(alpha.games, 4)
assert.equal(alpha.averageTP, 5)
assert.equal(alpha.averageOP, 9)
assert.equal(alpha.averageVP, 300)
const drawOnly = missions.find((mission: { mission: string }) => mission.mission === 'Draw Only')
assert.deepEqual([drawOnly.averageTP, drawOnly.averageOP, drawOnly.averageVP], [0, 0, 0])
assert.equal(JSON.stringify(games), before, 'mission aggregation must not mutate games')

const catalog = [
  { id: 'a1', name: 'Alpha', canonicalUrl: 'https://infinitygeist.com/missions/a1', sourceCollectionId: 's1', sourceCollectionName: 'Season 1', rights: {}, current: false },
  { id: 'a2', name: 'Alpha', canonicalUrl: 'https://infinitygeist.com/missions/a2', sourceCollectionId: 's2', sourceCollectionName: 'Season 2', rights: {}, current: true },
  { id: 'u1', name: 'Unique', canonicalUrl: 'https://infinitygeist.com/missions/u1', sourceCollectionId: 's2', sourceCollectionName: 'Season 2', rights: {}, current: true },
]
assert.equal(resolveMissionGeistNavigation({ mission: 'Unique' }, catalog).kind, 'unique')
const ambiguous = resolveMissionGeistNavigation({ mission: 'Alpha' }, catalog)
assert.equal(ambiguous.kind, 'ambiguous')
assert.deepEqual(ambiguous.records.map((record) => record.id), ['a1', 'a2'])
assert.equal(resolveMissionGeistNavigation({ mission: 'Missing' }, catalog).kind, 'unmatched')
assert.equal(resolveMissionGeistNavigation({ mission: 'Alpha', missionGeistId: 'a2', missionGeistCanonicalUrl: catalog[1].canonicalUrl }, catalog).kind, 'exact')
assert.equal(resolveMissionGeistNavigation({ mission: 'Alpha', missionGeistId: 'wrong', missionGeistCanonicalUrl: catalog[1].canonicalUrl }, catalog).kind, 'unmatched')

assert.match(publicApp, /useSnapshotData<MissionGeistCatalog>\('mission-catalog'\)/)
assert.match(publicApp, /resolveMissionGeistNavigation\(mission,catalog\)/)
assert.match(publicApp, /Courtesy of Mission Geist/)
assert.match(publicApp, /<details className="snapshot-mission-geist-versions">/)
assert.doesNotMatch(publicApp, /getPublicMissionGeistCatalog/)
assert.doesNotMatch(publicApp, /fetch\([^)]*infinitygeist/i)
assert.equal((publicApp.match(/function MissionCatalogNavigation/g) || []).length, 1)
const formatMissionAverageSource = publicApp.match(/function formatMissionAverage\(value:number\)\{[^}]+\}/)?.[0]
assert.ok(formatMissionAverageSource, 'missing Mission Profile average formatter')
const formatMissionAverage = Function(`${formatMissionAverageSource.replace('(value:number)', '(value)')}; return formatMissionAverage`)()
for (const [value, expected] of [[5, '5.00'], [4.5, '4.50'], [10, '10.00'], [6.1, '6.10'], [275, '275.00'], [238.9, '238.90'], [7.67, '7.67']] as const) {
  assert.equal(formatMissionAverage(value), expected)
}
assert.match(publicApp, /\['Average TP',formatMissionAverage\(m\.averageTP\)\]/)
assert.match(publicApp, /\['Average OP',formatMissionAverage\(m\.averageOP\)\]/)
assert.match(publicApp, /\['Average VP',formatMissionAverage\(m\.averageVP\)\]/)
assert.match(publicApp, /\['Games',m\.games\]/)
assert.match(publicApp, /\['First-turn Win Rate',formatPercent\(m\.firstTurnWinRate\)\]/)
assert.match(publicApp, /function MetricGrid\(\{items\}[\s\S]*<strong>\{value\|\|'—'\}<\/strong>/)

const profileGames = [
  { id: 1, mission: 'Profile Mission', date: '2026-01-01', player1: 'one', player1DisplayName: 'One', player1Faction: 'Faction A', player2: 'two', player2DisplayName: 'Two', player2Faction: 'Faction B', winner: 'one', winnerDisplayName: 'One', tp: '5-1', op: '8-3', vp: '250-100' },
  { id: 2, mission: 'Profile Mission', date: '2026-01-02', player1: 'three', player1DisplayName: 'Three', player1Faction: 'Faction C', player2: 'one', player2DisplayName: 'One', player2Faction: 'Faction A', winner: 'three', winnerDisplayName: 'Three', tp: '5-2', op: '9-4', vp: '275-150' },
  { id: 3, mission: 'Other Mission', date: '2026-01-03', player1: 'one', player1DisplayName: 'One', player1Faction: 'Faction A', player2: 'two', player2DisplayName: 'Two', player2Faction: 'Faction B', winner: 'one', winnerDisplayName: 'One', tp: '5-1', op: '8-3', vp: '250-100' },
] as PublicGame[]
assert.deepEqual(getMissionGames('Profile Mission', profileGames).map((game) => game.id), [2, 1])
const profileFactions = buildMissionFactionPerformance('Profile Mission', profileGames)
assert.deepEqual(profileFactions.map(({ faction, games, wins, losses, draws }) => ({ faction, games, wins, losses, draws })), [
  { faction: 'Faction A', games: 2, wins: 1, losses: 1, draws: 0 },
  { faction: 'Faction C', games: 1, wins: 1, losses: 0, draws: 0 },
  { faction: 'Faction B', games: 1, wins: 0, losses: 1, draws: 0 },
])
assert.deepEqual(getMissionGames('No Games', profileGames), [])
assert.deepEqual(buildMissionFactionPerformance('No Games', profileGames), [])

assert.match(publicApp, /data-page="mission-profile"/)
assert.match(publicApp, /className="snapshot-mission-dossier"/)
assert.match(publicApp, /Mission Intelligence/)
assert.match(publicApp, /title="Faction Performance"/)
assert.match(publicApp, /title="Recent Games on This Mission"/)
assert.match(publicApp, /useSnapshotData<PublicGame\[]>\('games'\)/)
assert.equal((publicApp.match(/function MissionsDirectory/g) || []).length, 1, 'Missions directory must remain intact')
assert.doesNotMatch(fs.readFileSync('src/public/missionProfileAnalytics.ts', 'utf8'), /preferredArmy|favoriteFaction/)
assert.match(publicCss, /\.snapshot-mission-profile\s*\{\s*align-content:\s*start;/)
assert.match(publicCss, /@media \(max-width:\s*820px\)[\s\S]*\.snapshot-mission-dossier\s*\{\s*grid-template-columns:\s*1fr;/)

console.log('PASS: compact Mission Profile dossier, mission-side faction performance, recent games, winner-only averages, and snapshot-native Mission Geist navigation')
