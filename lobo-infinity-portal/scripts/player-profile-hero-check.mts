import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium, type Page } from 'playwright'
import {
  PLAYER_PROFILE_HERO_CANONICAL_ARMIES,
  resolvePlayerProfileHero,
} from '../src/config/playerProfileHeroArtwork.ts'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'

const assetDirectory = new URL('../public/assets/player-profile-heroes/', import.meta.url)
const expected = new Map<string, string>([
  ['ALEPH', 'aleph.png'], ['Ariadna', 'ariadna.png'], ['PanOceania', 'panoceania.png'], ['Yu Jing', 'yu-jing.png'],
  ['Haqqislam', 'haqqislam.png'], ['Nomads', 'nomads.png'], ['Combined Army', 'combined-army.png'],
  ['Military Orders', 'military-orders-43f4197b.png'],
  ['Tohaa', 'tohaa.png'], ['Hassassin Bahram', 'hassassin-bharam.png'],
  ['Morat Aggression Force', 'morat-agrression-force.png'],
  ['Neoterra Capitaline Army', 'neocapitaline-army.png'], ['Tartary Army Corps', 'tartary-army-korps.png'],
  ['Japanese Secessionist Army', 'jsa.png'], ['Japanese Sectorial Army', 'jsa.png'],
  ['Kestrel Colonial Force', 'kestrel.png'], ['Onyx Contact Force', 'onyx.png'],
  ['Shasvastii Expeditionary Force', 'shasvastii.png'], ['Torchlight Brigade', 'torchlight.png'],
  ['Corregidor Jurisdictional Command', 'corregidor.png'],
  ['Jurisdictional Command of Corregidor', 'corregidor.png'],
  ['Bakunin Jurisdictional Command', 'bakunin.png'], ['Jurisdictional Command of Bakunin', 'bakunin.png'],
  ['Tunguska Jurisdictional Command', 'tunguska.png'], ['Jurisdictional Command of Tunguska', 'tunguska.png'],
  ['O-12', 'o12.png'], ['Starmada', 'starmada.png'], ['Operations Subsection', 'operations-subsection.png'],
  ['Steel Phalanx', 'steel-phalanx.png'], ['Next Wave', 'next-wave.png'], ['Oban', 'oban.png'],
  ['Shindenbutai', 'shindenbutai.png'], ['Druze Bayram Security', 'druze.png'],
  ['Dashat Company', 'dashat.png'], ['Ikari Company', 'ikari-company.png'],
  ['White Company', 'white-company.png'], ['StarCo', 'starco.png'], ['Free Company of the Star', 'starco.png'],
  ['Svalarheima Winter Force', 'svalarheima-winter-force.png'],
])

for (const [army, file] of expected) {
  const hero = resolvePlayerProfileHero(army)
  assert.equal(hero?.src, `/assets/player-profile-heroes/${file}`, `${army} mapping`)
  assert.equal(hero?.kind, 'army', `${army} is an army hero`)
}

for (const value of ['No Army Selected', '', '   ', null, undefined]) {
  const hero = resolvePlayerProfileHero(value)
  assert.equal(hero?.src, '/assets/player-profile-heroes/no-army.png')
  assert.equal(hero?.kind, 'no-army')
}
assert.equal(resolvePlayerProfileHero('Unknown Expeditionary Command'), null)

const assets = readdirSync(assetDirectory).filter((file) => file.endsWith('.png')).sort()
assert.equal(assets.length, 46)
const reachableFiles = new Set([
  ...PLAYER_PROFILE_HERO_CANONICAL_ARMIES.map((army) => resolvePlayerProfileHero(army)?.src.split('/').pop()),
  resolvePlayerProfileHero(null)?.src.split('/').pop(),
])
assert.deepEqual(assets.filter((file) => !reachableFiles.has(file)), [], 'every approved asset is reachable')
for (const file of assets) assert.equal(existsSync(new URL(file, assetDirectory)), true)
assert.equal(
  createHash('sha256').update(readFileSync(new URL('military-orders-43f4197b.png', assetDirectory))).digest('hex').toUpperCase(),
  '43F4197B711C7576A125D50990D828B5D12CA254A9842E4B6171550C94E74C51',
  'Military Orders must resolve to the newly approved Player Profile artwork bytes',
)

const canonicalWithoutArtwork = CANONICAL_ARMY_REGISTRY
  .filter((army) => army.active)
  .map((army) => army.name)
  .filter((army) => !resolvePlayerProfileHero(army))
assert.deepEqual(canonicalWithoutArtwork, [])
for (const retiredArmy of ['Foreign Company', 'Spiral Corps']) {
  const registryEntry = CANONICAL_ARMY_REGISTRY.find((army) => army.name === retiredArmy)
  assert.ok(registryEntry, `${retiredArmy} remains recognizable for historical data`)
  assert.equal(registryEntry.active, false, `${retiredArmy} is excluded from current choices`)
}

const publicAppSource = readFileSync(new URL('../src/public/SnapshotPublicApp.tsx', import.meta.url), 'utf8')
assert.match(publicAppSource, /resolvePlayerProfileHero\(p\.preferredArmy\)/)
assert.doesNotMatch(publicAppSource, /resolvePlayerProfileHero\([^)]*(favoriteFaction|armyUsage|history)/)

await verifyRenderedProfiles()
console.log(`Player Profile hero regression passed (${assets.length} assets; ${PLAYER_PROFILE_HERO_CANONICAL_ARMIES.length} army mappings).`)

async function verifyRenderedProfiles() {
  const server = await createServer({ mode: 'production', server: { host: '127.0.0.1', port: 4186, strictPort: false } })
  await server.listen()
  const address = server.httpServer?.address()
  const port = typeof address === 'object' && address ? address.port : 4186
  const browser = await chromium.launch({ headless: true })
  try {
    await verifyProfile(browser.newPage({ viewport: { width: 1280, height: 900 } }), port, 'ALEPH', 'aleph.png')
    await verifyProfile(browser.newPage({ viewport: { width: 1024, height: 900 } }), port, 'Tartary Army Corps', 'tartary-army-korps.png')
    await verifyProfile(browser.newPage({ viewport: { width: 1280, height: 900 } }), port, 'Military Orders', 'military-orders-43f4197b.png')
    await verifyProfile(browser.newPage({ viewport: { width: 390, height: 844 } }), port, 'No Army Selected', 'no-army.png')
    const failedPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await mockSnapshot(failedPage, 'ALEPH')
    await failedPage.route('**/assets/player-profile-heroes/aleph.png', (route) => route.abort())
    await failedPage.goto(`http://127.0.0.1:${port}/players/Test%20Pilot`, { waitUntil: 'networkidle' })
    await failedPage.waitForSelector('.snapshot-player-profile-fallback')
    assert.equal(await failedPage.locator('.snapshot-player-profile-hero img').count(), 0)
    assert.equal(await failedPage.getByRole('heading', { name: 'Test Pilot' }).count(), 1)
    await failedPage.close()
  } finally {
    await browser.close()
    await server.close()
  }
}

async function verifyProfile(pagePromise: Promise<Page>, port: number, preferredArmy: string, file: string) {
  const page = await pagePromise
  await mockSnapshot(page, preferredArmy)
  await page.goto(`http://127.0.0.1:${port}/players/Test%20Pilot`, { waitUntil: 'networkidle' })
  const image = page.locator('.snapshot-player-profile-hero img')
  try {
    await image.waitFor({ timeout: 10_000 })
  } catch {
    throw new Error(`Player Profile hero did not render:\n${await page.locator('body').innerText()}`)
  }
  assert.match(await image.getAttribute('src') ?? '', new RegExp(`${file.replace('.', '\\.')}$$`))
  assert.equal(await page.getByRole('heading', { name: 'Test Pilot' }).count(), 1)
  assert.equal(await page.getByText('Game History', { exact: true }).count(), 1)
  assert.equal(await page.getByText('8-2-1', { exact: true }).count(), 1)
  const layout = await page.evaluate(() => {
    const img = document.querySelector('.snapshot-player-profile-hero img') as HTMLImageElement
    return {
      complete: img.complete && img.naturalWidth > 0,
      objectFit: getComputedStyle(img).objectFit,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      ratio: img.getBoundingClientRect().width / img.getBoundingClientRect().height,
    }
  })
  assert.equal(layout.complete, true)
  assert.equal(layout.objectFit, 'contain')
  assert.equal(layout.overflow, false)
  assert.ok(Math.abs(layout.ratio - 1670 / 942) < 0.02)
  await page.close()
}

async function mockSnapshot(page: Page, preferredArmy: string) {
  await page.addInitScript(() => {
    AbortController.prototype.abort = function abortForDeterministicFixture() {}
  })
  const pointer = { schemaVersion: 1, snapshotId: '20260903T150551Z', sourceCutoff: '2026-09-03T15:06:16.964Z', basePath: 'public-snapshots/20260903T150551Z/' }
  const player = { player: 'Test Pilot', displayName: 'Test Pilot', division: 'main-man', divisionLabel: 'Main Man', rank: 1, games: 11, wins: 8, losses: 2, draws: 1, tp: 40, op: 70, vp: 1200, faction: 'Wrong Faction', favoriteArmy: 'Wrong Army', favoriteFaction: 'Wrong Faction', preferredArmy, armyUsage: [{ army: 'Wrong Army', parentFaction: 'Wrong Faction', classification: 'sectorial', games: 99, mostRecentGameDate: '', mostRecentGameId: 1, tiedForHighestUsage: false }], favoriteMission: '', lastActive: '', statusBadges: [] }
  const game = { id: 1, eventId: 'event', eventName: 'Event', gameType: 'Casual', date: '2026-09-03', division: '', player1: 'Test Pilot', player1DisplayName: 'Test Pilot', player1Faction: 'ALEPH', player2: 'Opponent', player2DisplayName: 'Opponent', player2Faction: 'Nomads', winner: 'Test Pilot', winnerDisplayName: 'Test Pilot', loser: 'Opponent', loserDisplayName: 'Opponent', winnerFaction: 'ALEPH', loserFaction: 'Nomads', mission: 'The Dig', tp: '5–0', op: '8–2', vp: '100–50', bestMoment: '', firstTurn: '', winnerArmyListId: '', loserArmyListId: '' }
  await page.route('https://ecwefvuvauaqpary.public.blob.vercel-storage.com/**', async (route) => {
    const url = route.request().url()
    const body = url.endsWith('/current.json') ? pointer : { schemaVersion: 1, snapshotId: pointer.snapshotId, sourceCutoff: pointer.sourceCutoff, data: url.endsWith('/players.json') ? [player] : url.endsWith('/games.json') ? [game] : [] }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}
