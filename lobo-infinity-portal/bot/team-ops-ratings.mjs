import { readArtifact } from '../scripts/benchmark-artifacts.mjs'
import { buildCanonicalDataset } from '../scripts/infinity-army-canonical-dataset.mjs'
import { buildOfficialCombatSource } from './official-combat-source.mjs'
import { buildCanonicalGunfighterProfiles } from './gunfighter-profile-canonicalizer.mjs'
import { buildCanonicalCloseCombatProfiles } from './close-combat-canonicalizer.mjs'
import { buildStandardGunfighterDefenders } from './gunfighter-standard-benchmark.mjs'
import { buildStandardCloseCombatDefenders } from './close-combat-standard-benchmark.mjs'
import { evaluateGunfighterProfile, evaluateAroProfile } from './gunfighter-rating.mjs'
import { evaluateCloseCombatProfile } from './close-combat-benchmark.mjs'
import { compactResult as compactGunfighter, combatProfileSignature, rankArmyGunfighters } from './gunfighter-benchmark-catalog.mjs'
import { compactResult as compactAro, combatSignature, rankArmyAros } from './aro-benchmark-catalog.mjs'
import { compactResult as compactCc, rankSubmittedCloseCombat } from './close-combat-catalog.mjs'
import { applyTeamOpsToUnit } from './team-ops-upgrades.mjs'
import { buildMobilityProfiles } from './mobility-rating.mjs'
import { mobilityIndex } from './mobility-index.mjs'
import { lookupMobility } from './mobility-lookup.mjs'
import { anchoredGunfighterScore, MOBILE_WEIGHT } from './mobile-gunfighter.mjs'

let bundledContext
async function benchmarkContext() {
  bundledContext ||= readArtifact(new URL('../data/infinity-army/benchmark-official-source.json.gz.b64', import.meta.url).pathname).then(capture => {
    const source = buildOfficialCombatSource(capture)
    return { source, byKey: new Map(source.profiles.map(p => [p.id, p])), defenders: buildStandardGunfighterDefenders(source.weaponChart, [], { canonicalProfiles: source.profiles }) }
  }).catch(error => { bundledContext = null; throw error })
  return bundledContext
}

// Reuse the published benchmark cohorts. Upgrades do not change everyone else's grades.
function cohort(catalog, source, signature) {
  const entries = new Map(catalog.entries.map(e => [e.key, e]))
  const unique = new Map()
  for (const profile of source.profiles) {
    const entry = entries.get(profile.id)
    if (entry) unique.set(signature(profile), entry.result.states)
  }
  return [...unique.values()].flat().map(s => s.rating)
}
function grade(percentile) { return percentile >= 95 ? 'S' : percentile >= 80 ? 'A' : percentile >= 60 ? 'B' : percentile >= 40 ? 'C' : percentile >= 20 ? 'D' : 'F' }
function gradeStates(states, values, midrank = false) {
  for (const state of states) {
    const below = values.filter(v => v < state.rating).length
    const equal = values.filter(v => v === state.rating).length
    const p = midrank ? (values.length < 2 ? 100 : 100 * (below + Math.max(0, equal - 1) / 2) / (values.length - 1)) : 100 * (below + equal) / values.length
    state.percentile = Math.round(Math.max(0, Math.min(100, p)) * 100) / 100
    state.grade = grade(state.percentile)
  }
}

export async function rateSubmittedTeamOps({ decoded, profiles, metadata, payload, gunfighterCatalog, aroCatalog, closeCombatCatalog, mobilityCatalog }) {
  const changed = profiles.some(p => p.modifiers?.length)
  if (!changed) return {
    gunfighterRatings: gunfighterCatalog ? rankArmyGunfighters(gunfighterCatalog, decoded, { limit: 4 }) : [],
    aroRatings: aroCatalog ? rankArmyAros(aroCatalog, decoded) : [],
    closeCombatRatings: closeCombatCatalog ? rankSubmittedCloseCombat(closeCombatCatalog, profiles, { sectorialId: decoded.sectorialId, limit: 4 }) : [],
  }
  const context = await benchmarkContext()
  for (const catalog of [gunfighterCatalog, aroCatalog]) {
    if (catalog?.source?.captureFingerprint !== context.source.captureFingerprint) throw Error('Team-Ops benchmark source is out of date')
  }
  const gunValues = changed && gunfighterCatalog ? cohort(gunfighterCatalog, context.source, combatProfileSignature) : []
  const aroValues = changed && aroCatalog ? cohort(aroCatalog, context.source, p => combatSignature(p, null)) : []
  const attackers = changed && aroCatalog ? aroCatalog.benchmarkAttackers.map(a => {
    const profile = context.byKey.get(a.key)
    if (!profile) throw Error('Team-Ops ARO benchmark attacker unavailable')
    return { ...a, profile }
  }) : []
  const mobileCohorts = Object.fromEntries(['normal', 'fireteam'].map(state => [state,
    (gunfighterCatalog?.entries || []).flatMap(e => {
      const combat = e.result.states.find(s => s.id === state)
      const movement = lookupMobility(mobilityCatalog, e.key)
      return combat && movement?.status === 'rated' ? [{ gunfighter: combat.rating, mobility: movement.score }] : []
    })
  ]))
  const gunfighters = [], aros = [], closeCombat = []
  for (const submitted of profiles) {
    const key = `${decoded.sectorialId}:${submitted.unitId}:${submitted.groupId}:${submitted.optionId}:${submitted.profileId}`
    const member = { ...submitted, combinedId: key.replaceAll(':', '-') }
    const army = { sectorialId: decoded.sectorialId, combatGroups: [{ members: [member] }] }
    let gun = gunfighterCatalog, aro = aroCatalog, cc = closeCombatCatalog
    if (submitted.modifiers?.length) {
      const unit = payload.units.find(u => Number(u.id) === submitted.unitId)
      const upgraded = applyTeamOpsToUnit(unit, member, metadata, payload)
      const official = { metadata, payloads: [{ ...payload, sectorialId: decoded.sectorialId, units: [upgraded] }] }
      const dataset = buildCanonicalDataset(official)
      dataset.metadata.skills = [...(metadata.skills || []), ...(payload.filters?.skills || [])]
      dataset.metadata.equips = [...(metadata.equips || []), ...(payload.filters?.equip || [])]
      dataset.metadata.types = payload.filters?.type || []
      const canonical = buildCanonicalGunfighterProfiles({ dataset, weaponChart: context.source.weaponChart, sectorialId: decoded.sectorialId }).find(p => p.id === key)
      if (!canonical) throw Error('Team-Ops combat profile unavailable')
      canonical.fireteamCapable = context.byKey.get(key)?.fireteamCapable ?? false
      if (gun) {
        const result = compactGunfighter(evaluateGunfighterProfile(canonical, context.defenders, { surpriseAttack: false }))
        gradeStates(result.states, gunValues)
        gun = { ...gun, entries: [{ key, result }] }
      }
      if (aro) {
        const result = compactAro(evaluateAroProfile(canonical, attackers))
        gradeStates(result.states, aroValues)
        aro = { ...aro, entries: [{ key, result }] }
      }
      if (cc) {
        const fighter = buildCanonicalCloseCombatProfiles({ official }).find(p => p.aliases.some(a => a.key === key))
        const entries = []
        if (fighter) {
          const entry = compactCc(fighter, evaluateCloseCombatProfile(fighter, buildStandardCloseCombatDefenders()))
          gradeStates(entry.states, cc.entries.flatMap(e => e.states.map(s => s.rating)), true)
          const primary = { rating: entry.rating }
          gradeStates([primary], cc.entries.map(e => e.rating), true)
          entries.push({ ...entry, grade: primary.grade, percentile: primary.percentile })
        }
        cc = { ...cc, entries }
      }
      const movement = buildMobilityProfiles(official).find(p => p.id === key)
      if (!movement) throw Error('Team-Ops mobility profile unavailable')
      const rating = mobilityIndex(movement, mobilityCatalog?.weights)
      const s = rating.scenarios
      submitted.upgradedMobility = { ...rating, mov: movement.mov, travel: s?.openBestTravel ?? null, jump: s?.horizontalJumpAndShoot ?? null, climb: s?.climbAndShoot ?? null, dodge: s?.normalDodge.expectedDistance ?? null }
    }
    const annotate = rows => rows.map(row => ({ ...row, upgradeSignature: submitted.upgradeSignature, rosterPosition: submitted.rosterPosition }))
    const g = gun ? annotate(rankArmyGunfighters(gun, army, { limit: Infinity })) : []
    gunfighters.push(...g)
    if (aro) aros.push(...annotate(rankArmyAros(aro, army)))
    if (cc) closeCombat.push(...annotate(rankSubmittedCloseCombat(cc, [member], { sectorialId: decoded.sectorialId, limit: Infinity })))
    if (submitted.modifiers?.length) {
      const movement = submitted.upgradedMobility || lookupMobility(mobilityCatalog, submitted.combinedId)
      submitted.upgradedMobile = Object.fromEntries(['normal', 'fireteam'].map(state => {
        const combat = state === 'normal' ? g[0]?.nonLinked : g[0]?.fireteamLinked
        const reference = mobileCohorts[state]
        const percentile = (value, field) => {
          const below = reference.filter(r => r[field] < value).length
          const equal = reference.filter(r => r[field] === value).length
          return reference.length < 2 ? 50 : Math.max(0, Math.min(100, 100 * (below + Math.max(0, equal - 1) / 2) / (reference.length - 1)))
        }
        return [state, combat && movement?.status === 'rated' ? { gunfighter: combat.rating, mobility: movement.score, gunfighterNormalized: anchoredGunfighterScore(combat.rating), gunfighterPercentile: percentile(combat.rating, "gunfighter"), mobilityPercentile: percentile(movement.score, "mobility"), score: (1 - MOBILE_WEIGHT) * anchoredGunfighterScore(combat.rating) + MOBILE_WEIGHT * movement.score } : null]
      }))
    }
  }
  gunfighters.sort((a,b) => Math.max(b.normal ?? -1,b.fireteam ?? -1) - Math.max(a.normal ?? -1,a.fireteam ?? -1))
  closeCombat.sort((a,b) => b.rating - a.rating)
  return { gunfighterRatings: gunfighters.slice(0,4), aroRatings: aros, closeCombatRatings: closeCombat.slice(0,4) }
}
