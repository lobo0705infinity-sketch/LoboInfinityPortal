import { createHash } from 'node:crypto'
import { evaluateAroProfile } from './gunfighter-rating.mjs'
import { canonicalProfileKey } from './gunfighter-benchmark-catalog.mjs'

export const ARO_CATALOG_SCHEMA = 'infinity-aro-benchmark-v1'
export const ARO_BENCHMARK_VERSION = 'aro-benchmark-v1-top-30'

export function selectBenchmarkAttackers(profiles, gunfighterCatalog, { limit = 30 } = {}) {
  const catalogByKey = new Map(gunfighterCatalog.entries.map((entry) => [entry.key, entry]))
  const candidates = profiles.flatMap((profile) => {
    const entry = catalogByKey.get(canonicalProfileKey(profile))
    if (!entry) return []
    const state = [...(entry.result.states || [])].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))[0]
    return state ? [{ profile, specialDice: Number(state.fireteamSpecialDice || 0), state: state.id, rating: Number(state.rating || 0), key: entry.key }] : []
  }).sort((a, b) => b.rating - a.rating || a.key.localeCompare(b.key))

  const unique = new Map()
  for (const candidate of candidates) {
    const signature = attackerSignature(candidate.profile, candidate.specialDice)
    if (!unique.has(signature)) unique.set(signature, candidate)
    if (unique.size >= limit) break
  }
  return [...unique.values()]
}

export function buildAroBenchmarkCatalog({ profiles, attackers, officialDataVersion, generatedAt = new Date().toISOString(), options = {} }) {
  if (!officialDataVersion) throw new Error('ARO catalog requires an official Army-data version.')
  if (!Array.isArray(profiles) || !profiles.length) throw new Error('ARO catalog requires canonical profiles.')
  if (!Array.isArray(attackers) || attackers.length !== 30) throw new Error('ARO benchmark requires exactly 30 canonical attackers.')
  const evaluationCache = new Map()
  const entries = profiles.map((profile, index) => {
    const signature = combatSignature(profile, null)
    let states = evaluationCache.get(signature)
    if (!states) {
      states = compactResult(evaluateAroProfile(profile, attackers, options)).states
      evaluationCache.set(signature, states)
    }
    if ((index + 1) % 100 === 0 || index + 1 === profiles.length) console.log(`Evaluated ARO profiles ${index + 1}/${profiles.length} (${evaluationCache.size} unique combat profiles)`)
    return {
      key: canonicalProfileKey(profile),
      sectorialId: Number(profile.sectorialId),
      unitId: Number(profile.unitId),
      groupId: Number(profile.groupId),
      optionId: Number(profile.optionId),
      profileId: Number(profile.profileId),
      result: { profileId: profile.id, name: profile.name, states },
    }
  }).sort((a, b) => a.key.localeCompare(b.key))
  applyRelativeRatings(entries, evaluationCache)
  const benchmarkAttackers = attackers.map((entry, index) => ({
    rank: index + 1,
    key: entry.key,
    name: entry.profile.name,
    state: entry.state,
    specialDice: entry.specialDice,
    gunfighterRating: entry.rating,
  }))
  const fingerprint = fingerprintCatalog({ officialDataVersion, benchmarkAttackers, options, entries })
  return {
    schemaVersion: ARO_CATALOG_SCHEMA,
    benchmarkVersion: ARO_BENCHMARK_VERSION,
    officialDataVersion,
    generatedAt,
    fingerprint,
    entryCount: entries.length,
    benchmarkAttackers,
    entries,
  }
}

export function lookupAroRatings(catalog, decodedArmy) {
  if (catalog?.schemaVersion !== ARO_CATALOG_SCHEMA) throw new Error('Unsupported ARO benchmark catalog.')
  const byKey = new Map(catalog.entries.map((entry) => [entry.key, entry]))
  const members = decodedArmy.combatGroups.flatMap((group) => group.members || group.entries || [])
  return members.flatMap((member, memberIndex) => {
    const key = canonicalProfileKey({ ...member, sectorialId: decodedArmy.sectorialId })
    const match = byKey.get(key) || catalog.entries.find((entry) => (
      Number(entry.unitId) === Number(member.unitId)
      && Number(entry.groupId) === Number(member.groupId)
      && Number(entry.optionId) === Number(member.optionId)
      && Number(entry.profileId) === Number(member.profileId ?? String(member.combinedId || '').split('-').at(-1) ?? 1)
    ))
    if (match) return [{ status: 'matched', key, result: match.result, memberIndex }]
    if (Number(member.groupId) === 0) {
      const expanded = catalog.entries.filter((entry) => (
        Number(entry.sectorialId) === Number(decodedArmy.sectorialId)
        && Number(entry.unitId) === Number(member.unitId)
        && Number(entry.optionId) === Number(member.optionId)
      ))
      if (expanded.length) return expanded.map((entry) => ({ status: 'matched', key: entry.key, result: entry.result, memberIndex, expandedFromLegacyGroup: true }))
    }
    return [{ status: 'missing', key, result: null, memberIndex }]
  })
}

export function rankArmyAros(catalog, decodedArmy) {
  const members = decodedArmy.combatGroups.flatMap((group) => group.members || group.entries || [])
  return lookupAroRatings(catalog, decodedArmy).map((lookup, index) => {
    const member = members[lookup.memberIndex ?? index]
    const normal = lookup.result?.states?.find((state) => state.id === 'normal')
    const fireteam = lookup.result?.states?.find((state) => state.id === 'fireteam')
    return {
      status: lookup.status,
      key: lookup.key,
      unitName: member?.unitName || member?.unit || lookup.result?.name || null,
      profileName: member?.profileName || member?.profile || null,
      nonLinked: normal || null,
      fireteamLinked: fireteam || null,
      normal: normal?.rating ?? null,
      fireteam: fireteam?.rating ?? null,
    }
  })
}

function compactResult(result) {
  return {
    states: result.states.map((state) => ({
      id: state.id,
      fireteamSpecialDice: state.fireteamSpecialDice,
      rating: state.rating,
      weaponsUsed: summarizeWeaponsUsed(state.matchups),
    })),
  }
}

function summarizeWeaponsUsed(matchups) {
  const totals = new Map()
  for (const matchup of matchups || []) {
    const response = matchup.selected?.optimalResponse
    if (!response?.aro || ['dodge', 'no-aro'].includes(String(response.aro).toLowerCase())) continue
    const label = response.aro.split(':').slice(0, -1).join(':') || response.aro
    const current = totals.get(label) || { weapon: label, selections: 0, scoreContribution: 0 }
    current.selections += 1
    current.scoreContribution += Number(response.defenderScore || 0)
    totals.set(label, current)
  }
  return [...totals.values()]
    .sort((a, b) => b.scoreContribution - a.scoreContribution || b.selections - a.selections || a.weapon.localeCompare(b.weapon))
    .map((item) => ({ ...item, scoreContribution: round(item.scoreContribution) }))
}

function applyRelativeRatings(entries, evaluationCache) {
  const distributions = new Map()
  for (const states of evaluationCache.values()) for (const state of states) distributions.set(state.id, [...(distributions.get(state.id) || []), Number(state.rating || 0)])
  for (const entry of entries) for (const state of entry.result.states) {
    const values = distributions.get(state.id) || []
    state.percentile = values.length ? round(100 * values.filter((value) => value <= Number(state.rating || 0)).length / values.length) : null
    state.grade = state.percentile == null ? null : state.percentile >= 95 ? 'S' : state.percentile >= 80 ? 'A' : state.percentile >= 60 ? 'B' : state.percentile >= 40 ? 'C' : state.percentile >= 20 ? 'D' : 'F'
  }
}

function combatSignature(profile, specialDice) {
  return JSON.stringify({
    bs: profile.bs, ph: profile.ph, arm: profile.arm, bts: profile.bts,
    vitality: profile.vitality, structure: profile.structure,
    skills: profile.skills, equipment: profile.equipment, weapons: profile.weapons,
    fireteamCapable: Boolean(profile.fireteamCapable),
    ...(specialDice == null ? {} : { specialDice }),
  })
}

function attackerSignature(profile, specialDice) {
  const relevant = (values = []) => values.filter((value) => /bs attack|mimetism|marksmanship|warhorse|total reaction|neurocinetics|surprise attack|dodge|no wound incapacitation|dogged|immunity|multispectral visor|x visor|albedo/i.test(String(value)))
  return JSON.stringify({
    bs: profile.bs, ph: profile.ph, arm: profile.arm, bts: profile.bts,
    vitality: profile.vitality, structure: profile.structure,
    skills: relevant(profile.skills), equipment: relevant(profile.equipment), weapons: profile.weapons,
    specialDice,
  })
}

function fingerprintCatalog(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
function round(value) { return Math.round(Number(value) * 100) / 100 }
