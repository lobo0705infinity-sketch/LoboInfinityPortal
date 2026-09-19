import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getCanonicalArmyListForIntelligenceSource } from '../src/services/armyIntelligenceExplorer.ts'
import { getInfinityArmyTarget } from '../src/services/infinityArmyLinks.ts'

const tartaryArmyCode = 'gTEHdGFydGFyeRtUYWNrc3NzIHRlYW1zICAzIG1vcmUgZGlzY2%2BBLAIBAAcBhH4BBAAChzYBAwADhfQBAQAEgPIBg0UABYDuAQUABoRuAZBWAAeA5QEDAAIACAGA5wECAAKA8AECAAOA8AECAASA8QEBAAWHNQEEAAaBCQECAAeA8gGDRQAIh1IBAQA%3D7'
const canonicalLists = [
  {
    id: 4304763863,
    armyCode: tartaryArmyCode,
    armyLink: '',
    armyName: 'Tacksss teams 3 more disc',
    faction: 'Ariadna',
    player: 'KaktusGalaxus',
    playerDisplayName: 'KaktusGalaxus',
    points: 300,
    sectorial: 'Tartary Army Corps',
    source: 'Team Tournament',
    submissionDate: '2026-08-19',
    swc: 6,
  },
]

const matched = getCanonicalArmyListForIntelligenceSource(
  { armyCode: tartaryArmyCode, sourceId: '4304763863' },
  canonicalLists,
)
assert.ok(matched)
assert.equal(matched.armyCode, tartaryArmyCode)
assert.equal(
  getCanonicalArmyListForIntelligenceSource(
    { armyCode: tartaryArmyCode, sourceId: '61' },
    canonicalLists,
  )?.id,
  4304763863,
)
assert.equal(
  getCanonicalArmyListForIntelligenceSource(
    { armyCode: 'different-canonical-code', sourceId: '4304763864' },
    canonicalLists,
  ),
  null,
)

const target = getInfinityArmyTarget(matched.armyCode)
assert.equal(target.status, 'available')
if (target.status === 'available') {
  assert.equal(
    target.href,
    `https://infinitytheuniverse.com/army/list/${encodeURIComponent(decodeURIComponent(tartaryArmyCode))}`,
  )
}

const page = readFileSync(new URL('../src/pages/ArmyIntelligence.tsx', import.meta.url), 'utf8')
assert.match(page, /buildExplorerRowsFromSelectedLists\(matchingLists, factionData\?\.armyLists \?\? \[\]\)/)
assert.match(page, /getCanonicalArmyListForIntelligenceSource\(list, canonicalArmyLists\)/)
assert.match(page, /<ArmyIntelligenceOpenList armyCode=\{list\.armyCode\} \/>/)
assert.match(page, /getInfinityArmyTarget\(armyCode\)/)
assert.match(page, /target="_blank"/)
assert.doesNotMatch(page, /armyCode: ''/)

console.log('Army Intelligence explorer canonical-link regression check passed.')
