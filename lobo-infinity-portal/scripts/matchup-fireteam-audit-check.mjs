import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { readArtifact } from './benchmark-artifacts.mjs'
import { buildOfficialCombatSource } from '../bot/official-combat-source.mjs'
import { annotateMatchupPool, compareMatchup, markMatchupFireteamCapabilities } from '../bot/matchup-command.mjs'
import { buildAttackPool } from '../bot/gunfighter-rating.mjs'

const capture = await readArtifact(resolve(import.meta.dirname, '..', 'data', 'infinity-army', 'benchmark-official-source.json.gz.b64'))
const source = buildOfficialCombatSource(capture)
const profiles = markMatchupFireteamCapabilities(source.profiles)
const identity = (profile) => [profile.unitId, profile.groupId, profile.optionId, profile.profileId].map(Number).join(':')
const originalByIdentity = Map.groupBy(source.profiles, identity)
const markedByIdentity = Map.groupBy(profiles, identity)

let capableIdentityCount = 0
for (const [key, originals] of originalByIdentity) {
  const anyCapable = originals.some((profile) => profile.fireteamCapable)
  const marked = markedByIdentity.get(key) || []
  assert.ok(marked.length, `matchup capability audit retained ${key}`)
  assert.ok(marked.every((profile) => profile.fireteamCapable === anyCapable), `all copies of ${key} agree on whether the model can receive Fireteam +1SD`)
  if (anyCapable) capableIdentityCount += 1
}

const ftoProfiles = profiles.filter((profile) => /(?:^|\s)fto(?:\s|$)/i.test(profile.name))
assert.ok(ftoProfiles.length > 0, 'official catalog contains FTO profiles')
assert.ok(ftoProfiles.every((profile) => profile.fireteamCapable), 'every FTO copy inherits capability from its eligible sectorial copy')

let nativeBurstModes = 0
let nativeSpecialDiceModes = 0
let nativeBurstProfiles = 0
let nativeSpecialDiceProfiles = 0
for (const profile of profiles) for (const weapon of profile.weapons || []) for (const mode of weapon.modes || []) {
  const neurocinetics = (profile.skills || []).some((skill) => /^neurocinetics$/i.test(skill))
  const rawPool = buildAttackPool(profile, profile, weapon, mode, 0, profile.fireteamCapable ? 1 : 0, { cover: false }, { aro: neurocinetics })
  const pool = annotateMatchupPool(rawPool, profile, { aro: neurocinetics })
  const normalizedSkills = (profile.skills || []).map((skill) => String(skill).toLowerCase().replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim())
  const skillBurstBonus = normalizedSkills.reduce((sum, skill) => sum + Number(skill.match(/^bs attack\s*\+?(\d+)\s*b$/)?.[1] || 0), 0)
  const skillSpecialDice = normalizedSkills.reduce((sum, skill) => sum + Number(skill.match(/^bs attack\s*\+?(\d+)\s*sd$/)?.[1] || 0), 0)
  if (skillBurstBonus > 0 && !mode.longSkill && mode.attackType !== 'direct-template') {
    nativeBurstProfiles += 1
    assert.ok(pool.diceSources.includes(`Native BS Attack +${skillBurstBonus}B`), `${profile.id} exposes native BS Attack +B`)
  }
  if (skillSpecialDice > 0 && !mode.longSkill && mode.attackType !== 'direct-template') {
    nativeSpecialDiceProfiles += 1
    assert.ok(pool.diceSources.includes(`Native BS Attack +${skillSpecialDice}SD`), `${profile.id} exposes native BS Attack +SD`)
  }
  if (Number(mode.burstBonus || 0) > 0) {
    nativeBurstModes += 1
    assert.ok(pool.diceSources.includes(`Native Weapon +${Number(mode.burstBonus)}B`), `${profile.id} ${weapon.name} exposes native +B`)
  }
  if (Number(mode.specialDice || 0) > 0 && mode.attackType !== 'direct-template' && !mode.longSkill) {
    nativeSpecialDiceModes += 1
    assert.ok(pool.diceSources.includes(`Native Weapon +${Number(mode.specialDice)}SD`), `${profile.id} ${weapon.name} exposes native +SD`)
  }
  if (profile.fireteamCapable && mode.attackType !== 'direct-template' && !mode.longSkill) {
    assert.ok(pool.diceSources.includes('Fireteam +1SD'), `${profile.id} ${weapon.name} exposes Fireteam +1SD`)
  }
}
assert.ok(nativeBurstModes > 0, 'catalog-wide audit exercised native +B weapons')
assert.ok(nativeSpecialDiceModes > 0, 'catalog-wide audit exercised native +SD weapons')
assert.ok(nativeBurstProfiles > 0, 'catalog-wide audit exercised native BS Attack +B profiles')
assert.ok(nativeSpecialDiceProfiles > 0, 'catalog-wide audit exercised native BS Attack +SD profiles')

const result = await compareMatchup({ modelOne: '1001:1779:1:3:1', modelTwo: '501:1896:1:9:1' })
assert.deepEqual(result.directions.map((direction) => direction.variants.length), [1, 1], 'matchup renders one automatically resolved Fireteam state per attack direction')

const linked = result.directions[0].variants[0]
assert.equal(linked.attackerState, 'fireteam', 'eligible Nimrod automatically receives Fireteam +1SD')
assert.equal(linked.defenderState, 'fireteam', 'eligible Coyote automatically receives Fireteam +1SD')
const linkedBand = linked.bands.find((band) => band.range === '16-24')
assert.match(linkedBand.attackerAction, /Thunderbolt/)
assert.equal(linkedBand.attackerPool.baseBurst, 2)
assert.equal(linkedBand.attackerPool.burst, 3)
assert.equal(linkedBand.attackerPool.specialDice, 1)
assert.deepEqual(linkedBand.attackerPool.diceSources, ['Native Weapon +1B', 'Fireteam +1SD'])
assert.equal(linkedBand.defenderPool.baseBurst, 1)
assert.equal(linkedBand.defenderPool.specialDice, 2)
assert.deepEqual(linkedBand.defenderPool.diceSources, ['Native BS Attack +1SD', 'Fireteam +1SD'])

console.log(`PASS - audited ${profiles.length} profiles, ${capableIdentityCount} Fireteam-capable identities, ${nativeBurstModes} weapon +B modes, ${nativeSpecialDiceModes} weapon +SD modes, ${nativeBurstProfiles} BS Attack +B pools, and ${nativeSpecialDiceProfiles} BS Attack +SD pools.`)
