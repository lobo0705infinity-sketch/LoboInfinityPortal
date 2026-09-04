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

for (const faction of FACTION_PROFILE_HERO_CANONICAL_FACTIONS) {
  const artwork = resolveFactionProfileHero(faction)
  assert.ok(artwork, `${faction} should resolve`)
  assert.ok(assets.includes(artwork.src.split('/').pop() ?? ''), `${faction} asset should exist`)
}

assert.equal(
  resolveFactionProfileHero('Caledonian Highlander Army')?.src,
  '/assets/faction-profile-heroes/caledonian-highlander-army.png',
)
assert.equal(
  resolveFactionProfileHero('Kosmoflot')?.src,
  '/assets/faction-profile-heroes/kosmoflot.png',
)
assert.equal(resolveFactionProfileHero('Unknown Army'), null)
assert.notEqual(resolveFactionProfileHero('Tohaa')?.src, resolveFactionProfileHero('Next Wave')?.src)

console.log(
  `Faction Profile hero mapping passed (${assets.length} assets; ${activeArmies.length} active armies; ${actualMissing.length} excluded invalid sources).`,
)
