import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { PublicEvent, PublicGame } from '../src/public/snapshotTypes.ts'
import { buildTop40ResultRows, filterTop40ResultRows, getTop40ResultsSummary } from '../src/public/top40ResultsModel.ts'

const [page, styles, publicApp, artwork] = await Promise.all([
  readFile(new URL('../src/public/Top40ResultsPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/public/Top40ResultsPage.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/public/SnapshotPublicApp.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/events/top-40-results.png', import.meta.url)),
])

assert.equal(createHash('sha256').update(artwork).digest('hex').toUpperCase(), '6A3945574D6502268A4FAE443D77428F38078900661DBE4188537E333EDC7E0A')
assert.match(publicApp, /path="\/event\/event-lobo-s-american-top-40\/results" element=\{<Top40ResultsPage \/>\}/)
assert.match(page, /useSnapshotData<PublicEvent\[]>\('events'\)/)
assert.match(page, /useSnapshotData<PublicGame\[]>\('games'\)/)
assert.match(page, /src="\/assets\/events\/top-40-results\.png\?v=6a394557"/)
assert.match(styles, /\.top40-results-hero img[\s\S]*width: 100%;[\s\S]*height: auto;[\s\S]*object-fit: contain;/)
assert.match(styles, /overflow-x: clip;/)
assert.doesNotMatch(page, /fetch\(|axios|Apps Script|Google Sheets|poll|retry/i)
assert.doesNotMatch(page, /Tournament Leaders|Most OP|Highest VP/)
for (const text of ['Players', 'Matches Complete', 'Active Matches', 'Eliminated', 'Latest Results', 'Bracket', 'Round', 'Player', 'TP', 'OP', 'VP', 'Winner', 'View Match']) assert.ok(page.includes(text), `Missing results field: ${text}`)

const event = {
  id: 'event-lobo-s-american-top-40',
  registeredCount: 40,
  participants: [],
  bracket: [
    { bracket: 'Winners', bracketRound: 2, gameId: 41, status: 'Completed', loser: 'Alpha' },
    { bracket: 'Losers', bracketRound: 3, gameId: 42, status: 'Completed', loser: 'Bravo' },
    { bracket: 'Losers', bracketRound: 4, status: 'Active' },
  ],
} as unknown as PublicEvent
const games = [
  { id: 41, date: '2026-09-06', player1: 'Alpha', player1DisplayName: 'Alpha', player1Faction: 'Ariadna', player2: 'Bravo', player2DisplayName: 'Bravo', player2Faction: 'Nomads', winner: 'Alpha', winnerDisplayName: 'Alpha', tp: '3-0', op: '8-2', vp: '120-80' },
  { id: 42, date: '2026-09-07', player1: 'Bravo', player1DisplayName: 'Bravo', player1Faction: 'Nomads', player2: 'Charlie', player2DisplayName: 'Charlie', player2Faction: 'PanOceania', winner: 'Charlie', winnerDisplayName: 'Charlie', tp: '0-3', op: '1-9', vp: '70-140' },
] as PublicGame[]
const rows = buildTop40ResultRows(event, games)
assert.equal(rows[0].game.id, 42)
assert.equal(rows[0].bracket, 'Losers Bracket')
assert.equal(rows[0].round, 'Round 3')
assert.deepEqual(getTop40ResultsSummary(event, rows), { activeMatches: 1, eliminated: 1, matchesComplete: 2, players: 40 })
assert.equal(filterTop40ResultRows(rows, 'Winners Bracket', '', 'alpha').length, 1)
assert.equal(filterTop40ResultRows(rows, '', 'Round 3', 'charlie').length, 1)
assert.equal(buildTop40ResultRows({ ...event, bracket: [] }, []).length, 0)
assert.match(page, /No results yet/)

console.log('Top 40 Results page checks passed')
