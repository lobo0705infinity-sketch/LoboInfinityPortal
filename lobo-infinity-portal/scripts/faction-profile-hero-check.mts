import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import {
  FACTION_PROFILE_HERO_CANONICAL_FACTIONS,
  resolveFactionProfileHero,
} from '../src/config/factionProfileHeroArtwork.ts'

const assetDirectory = fileURLToPath(
  new URL('../public/assets/faction-profile-heroes/', import.meta.url),
)
const assets = readdirSync(assetDirectory).filter((file) => file.endsWith('.png')).sort()
const activeArmies = CANONICAL_ARMY_REGISTRY.filter((army) => army.active)
const expectedMissing: string[] = []
const actualMissing = activeArmies
  .filter((army) => !resolveFactionProfileHero(army.name))
  .map((army) => army.name)
  .sort()

assert.equal(activeArmies.length, 45)
assert.equal(assets.length, 45)
assert.deepEqual(actualMissing, expectedMissing)
assert.equal(FACTION_PROFILE_HERO_CANONICAL_FACTIONS.length, 45)

const resolvedPaths: string[] = []

for (const faction of FACTION_PROFILE_HERO_CANONICAL_FACTIONS) {
  const artwork = resolveFactionProfileHero(faction)
  assert.ok(artwork, `${faction} should resolve`)
  const assetFile = artwork.src.split('/').pop()?.split('?')[0] ?? ''
  assert.ok(assets.includes(assetFile), `${faction} asset should exist`)
  resolvedPaths.push(artwork.src)
}

assert.equal(new Set(FACTION_PROFILE_HERO_CANONICAL_FACTIONS).size, 45)
assert.equal(new Set(resolvedPaths).size, 45)
assert.equal(resolvedPaths.some((path) => path.includes('player-profile')), false)
assert.equal(resolvedPaths.some((path) => /latest(?:\(\d+\))?\.png/i.test(path)), false)

assert.equal(
  resolveFactionProfileHero('Caledonian Highlander Army')?.src,
  '/assets/faction-profile-heroes/caledonian-highlander-army.png?v=4be81bf7dc4d',
)
assert.equal(
  resolveFactionProfileHero('Kosmoflot')?.src,
  '/assets/faction-profile-heroes/kosmoflot.png?v=4be81bf7dc4d',
)
assert.equal(resolveFactionProfileHero('Dashat Company')?.src, '/assets/faction-profile-heroes/dashat-company.png?v=4be81bf7dc4d')
assert.equal(resolveFactionProfileHero('O-12')?.src, '/assets/faction-profile-heroes/o-12.png?v=4be81bf7dc4d')
assert.equal(resolveFactionProfileHero('Oban')?.src, '/assets/faction-profile-heroes/oban.png?v=4be81bf7dc4d')
assert.equal(resolveFactionProfileHero('Tohaa')?.src, '/assets/faction-profile-heroes/tohaa.png?v=4be81bf7dc4d')
assert.equal(resolveFactionProfileHero('Unknown Army'), null)
assert.notEqual(resolveFactionProfileHero('Tohaa')?.src, resolveFactionProfileHero('Next Wave')?.src)

console.log(
  `Faction Profile hero mapping passed (${assets.length} assets; ${activeArmies.length} active armies; ${actualMissing.length} excluded invalid sources).`,
)
