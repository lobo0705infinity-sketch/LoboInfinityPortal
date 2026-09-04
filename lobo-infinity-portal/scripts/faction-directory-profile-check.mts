import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { resolveFactionProfileHero } from '../src/config/factionProfileHeroArtwork.ts'
import {
  buildFactionMissionPerformance,
  buildFactionPlayerPerformance,
  getFactionGameObservations,
  summarizeFactionObservations,
} from '../src/public/factionAnalytics.ts'
import type { PublicGame } from '../src/public/snapshotTypes.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const app = readFileSync(`${root}src/public/SnapshotPublicApp.tsx`, 'utf8')
const css = readFileSync(`${root}src/public/SnapshotPublicApp.css`, 'utf8')
const nav = readFileSync(`${root}src/components/sidebarNavigation.ts`, 'utf8')
const assets = readdirSync(`${root}public/assets/faction-profile-heroes`).filter((file) => file.endsWith('.png'))
const directoryHero = readFileSync(`${root}public/assets/faction-directory/faction-header-59140cf3.png`)
const active = CANONICAL_ARMY_REGISTRY.filter((army) => army.active)

assert.equal(active.length, 45)
assert.equal(assets.length, 45)
assert.equal(active.some((army) => army.name === 'Foreign Company'), false)
assert.equal(active.some((army) => army.name === 'Spiral Corps'), false)
assert.match(nav, /label:\s*'Factions',\s*to:\s*'\/factions'/)
assert.match(app, /CANONICAL_ARMY_REGISTRY\.filter\(\(army\) => army\.active\)|CANONICAL_ARMY_REGISTRY\.filter\(a=>a\.active\)/)
assert.match(app, /stats\?\.games\?\?0/)
assert.match(app, /function Factions\(\)[\s\S]*?data-page="factions"[\s\S]*?snapshot-factions-directory-hero/)
assert.match(app, /src="\/assets\/faction-directory\/faction-header-59140cf3\.png"/)
assert.doesNotMatch(app.match(/function Factions\(\)[\s\S]*?function FactionProfile/)?.[0] ?? '', /<Page title="Factions"/)
assert.equal(createHash('sha256').update(directoryHero).digest('hex'), '59140cf33e73ce661cf6edda612e614a6243ae9b78a970eaad99f6c6fcc6e413')
assert.match(css, /\.snapshot-factions-directory-hero\s*\{[^}]*max-width:\s*1320px;[^}]*margin:\s*0 auto;[^}]*overflow:\s*hidden;/s)
assert.match(css, /\.snapshot-factions-directory-hero img\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;[^}]*object-fit:\s*contain;/s)
assert.match(app, /resolveFactionProfileHero\(factionName\)/)
assert.match(app, /assets\/faction-profile-heroes|resolveFactionProfileHero/)
assert.doesNotMatch(app.match(/function FactionProfile[\s\S]*?function Missions/)?.[0] ?? '', /resolvePlayerProfileHero/)
assert.equal(resolveFactionProfileHero('ALEPH')?.src, '/assets/faction-profile-heroes/aleph.png')
assert.equal(resolveFactionProfileHero('Caledonian Highlander Army')?.src, '/assets/faction-profile-heroes/caledonian-highlander-army.png')
assert.equal(resolveFactionProfileHero('Kosmoflot')?.src, '/assets/faction-profile-heroes/kosmoflot.png')
assert.equal(resolveFactionProfileHero('Tohaa')?.src, '/assets/faction-profile-heroes/tohaa.png')
assert.equal(resolveFactionProfileHero('Next Wave')?.src, '/assets/faction-profile-heroes/next-wave.png')
assert.notEqual(resolveFactionProfileHero('Tohaa')?.src, resolveFactionProfileHero('Next Wave')?.src)

const game = (overrides: Partial<PublicGame>): PublicGame => ({
  id: 1, eventId: 'event', eventName: 'Event', gameType: 'League', date: '2026-01-01',
  division: 'A', player1: 'alpha', player1DisplayName: 'Alpha', player1Faction: 'Nomads',
  player2: 'beta', player2DisplayName: 'Beta', player2Faction: 'PanOceania',
  winner: 'beta', winnerDisplayName: 'Beta', loser: 'alpha', loserDisplayName: 'Alpha',
  winnerFaction: 'PanOceania', loserFaction: 'Nomads', mission: 'The Dig',
  tp: '5 - 1', op: '9 - 3', vp: '280 - 120', bestMoment: '', firstTurn: '',
  winnerArmyListId: '', loserArmyListId: '', ...overrides,
})
const games = [
  game({}),
  game({ id: 2, player1: 'gamma', player1DisplayName: 'Gamma', player1Faction: 'PanOceania', player2: 'delta', player2DisplayName: 'Delta', player2Faction: 'Nomads', winner: 'gamma', winnerDisplayName: 'Gamma', loser: 'delta', loserDisplayName: 'Delta', winnerFaction: 'PanOceania', loserFaction: 'Nomads', mission: 'Area of Interest', tp: '5 - 2', op: '8 - 4', vp: '250 - 150' }),
  game({ id: 3, winner: 'Draw', winnerDisplayName: 'Draw', loser: '', loserDisplayName: '', winnerFaction: '', loserFaction: '', mission: 'The Dig', tp: '2 - 2', op: '5 - 5', vp: '200 - 200' }),
]
const pano = getFactionGameObservations('PanOceania', games)
const summary = summarizeFactionObservations(pano)
assert.deepEqual({ games: summary.games, wins: summary.wins, losses: summary.losses, draws: summary.draws }, { games: 3, wins: 2, losses: 0, draws: 1 })
assert.equal(summary.averageTP, 4)
assert.equal(summary.averageOP, 22 / 3)
assert.equal(summary.averageVP, 730 / 3)
assert.deepEqual(buildFactionMissionPerformance(pano).map((row) => [row.mission, row.games]), [['The Dig', 2], ['Area of Interest', 1]])
assert.deepEqual(buildFactionPlayerPerformance(pano).map((row) => [row.player, row.games]), [['beta', 2], ['gamma', 1]])
assert.deepEqual(summarizeFactionObservations([]), { games: 0, wins: 0, losses: 0, draws: 0, winRate: 0, averageTP: 0, averageOP: 0, averageVP: 0 })
assert.match(app, /MissionCatalogNavigation mission={m} catalog={catalog}/)
assert.doesNotMatch(app.match(/function FactionProfile[\s\S]*?function Missions/)?.[0] ?? '', /fetch\(|UrlFetchApp|apiClient/)
assert.match(css, /\.snapshot-faction-directory\s*{[^}]*grid-auto-rows:\s*max-content;[^}]*align-content:\s*start;/s)
assert.match(css, /\.snapshot-faction-group\s*{[^}]*grid-template-rows:\s*auto auto;[^}]*align-content:\s*start;/s)
assert.match(css, /\.snapshot-faction-directory-grid\s*{[^}]*grid-auto-rows:\s*max-content;[^}]*align-items:\s*stretch;/s)
assert.match(css, /\.snapshot-faction-directory-card\s*{[^}]*align-content:\s*start;[^}]*min-height:\s*0;[^}]*height:\s*auto;/s)
assert.match(app, /army\.type==='Vanilla'\?' snapshot-faction-directory-card--vanilla':''/)
assert.match(css, /\.snapshot-faction-group h2::after\s*{[^}]*linear-gradient/s)
assert.match(css, /calc\(\(100% - 4\.25rem\) \/ 6\)/)
assert.match(css, /\.snapshot-faction-directory-card--vanilla\s*{[^}]*border-color:[^}]*box-shadow:/s)
assert.match(css, /\.snapshot-faction-directory-card > \.eyebrow\s*{[^}]*opacity:\s*0\.7;/s)
assert.match(css, /\.snapshot-faction-directory-card dl\s*{[^}]*border-top:/s)

console.log('Faction Directory/Profile regression passed (45 active factions; faction-side analytics; snapshot-only runtime).')
