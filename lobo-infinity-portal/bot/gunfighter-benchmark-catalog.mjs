import { createHash } from 'node:crypto'
import { evaluateGunfighterProfile } from './gunfighter-rating.mjs'

export const GUNFIGHTER_CATALOG_SCHEMA = 'infinity-gunfighter-benchmark-v2'

export function buildGunfighterBenchmarkCatalog({ profiles, defenders, officialDataVersion, benchmarkVersion, generatedAt = new Date().toISOString(), options = {} }) {
  if (!officialDataVersion) throw new Error('Gunfighter catalog requires an official Army-data version.')
  if (!benchmarkVersion) throw new Error('Gunfighter catalog requires a benchmark version.')
  if (!Array.isArray(profiles) || !profiles.length) throw new Error('Gunfighter catalog requires canonical profiles.')
  const evaluationCache = new Map()
  const entries = profiles.map((profile, index) => {
    const signature = combatProfileSignature(profile)
    let states = evaluationCache.get(signature)
    if (!states) {
      states = compactResult(evaluateGunfighterProfile(profile, defenders, options)).states
      evaluationCache.set(signature, states)
    }
    if ((index + 1) % 100 === 0 || index + 1 === profiles.length) {
      console.log(`Evaluated catalog profiles ${index + 1}/${profiles.length} (${evaluationCache.size} unique combat profiles)`)
    }
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
  const fingerprint = fingerprintCatalog({ officialDataVersion, benchmarkVersion, defenders, options, entries })
  return {
    schemaVersion: GUNFIGHTER_CATALOG_SCHEMA,
    officialDataVersion,
    benchmarkVersion,
    generatedAt,
    fingerprint,
    entryCount: entries.length,
    entries,
  }
}

function combatProfileSignature(profile) {
  return JSON.stringify({
    bs: profile.bs,
    ph: profile.ph,
    arm: profile.arm,
    bts: profile.bts,
    vitality: profile.vitality,
    structure: profile.structure,
    skills: profile.skills,
    equipment: profile.equipment,
    weapons: profile.weapons,
    fireteamCapable: Boolean(profile.fireteamCapable),
  })
}

export function lookupGunfighterRatings(catalog, decodedArmy) {
  if (catalog?.schemaVersion !== GUNFIGHTER_CATALOG_SCHEMA) throw new Error('Unsupported gunfighter benchmark catalog.')
  const byKey = new Map(catalog.entries.map((entry) => [entry.key, entry]))
  return decodedArmy.combatGroups.flatMap((group) => group.members || group.entries || []).map((member) => {
    const key = canonicalProfileKey({ ...member, sectorialId: decodedArmy.sectorialId })
    const match = byKey.get(key)
    return match ? { status: 'matched', key, result: match.result } : { status: 'missing', key, result: null }
  })
}

export function rankArmyGunfighters(catalog, decodedArmy, { limit = 4 } = {}) {
  const members = decodedArmy.combatGroups.flatMap((group) => group.members || group.entries || [])
  const lookups = lookupGunfighterRatings(catalog, decodedArmy)
  return lookups.map((lookup, index) => {
    const member = members[index]
    const states = lookup.result?.states || []
    return {
      status: lookup.status,
      key: lookup.key,
      rosterPosition: member?.rosterPosition || null,
      unitName: member?.unitName || member?.unit || lookup.result?.name || null,
      profileName: member?.profileName || member?.profile || null,
      normal: states.find((state) => state.id === 'normal')?.rating ?? null,
      fireteam: states.find((state) => state.id === 'fireteam')?.rating ?? null,
      result: lookup.result,
    }
  }).sort((left, right) => {
    const leftScore = Math.max(left.normal ?? -1, left.fireteam ?? -1)
    const rightScore = Math.max(right.normal ?? -1, right.fireteam ?? -1)
    return rightScore - leftScore || String(left.unitName).localeCompare(String(right.unitName))
  }).slice(0, Math.max(0, Number(limit) || 0))
}

export function canonicalProfileKey(profile) {
  const sectorialId = integer(profile.sectorialId, 'sectorialId')
  const unitId = integer(profile.unitId, 'unitId')
  const groupId = integer(profile.groupId, 'groupId')
  const optionId = integer(profile.optionId, 'optionId')
  const profileId = integer(profile.profileId ?? profile.combinedId?.split('-').at(-1) ?? 1, 'profileId')
  return `${sectorialId}:${unitId}:${groupId}:${optionId}:${profileId}`
}

function integer(value, label) {
  const number = Number(value)
  if (!Number.isInteger(number)) throw new Error(`Canonical gunfighter identity is missing ${label}.`)
  return number
}

function compactResult(result) {
  return {
    profileId: result.profileId,
    name: result.name,
    states: result.states.map((state) => ({
      id: state.id,
      fireteamSpecialDice: state.fireteamSpecialDice,
      rating: state.rating,
    })),
  }
}

function fingerprintCatalog({ officialDataVersion, benchmarkVersion, defenders, options, entries }) {
  const hash = createHash('sha256')
  for (const value of [officialDataVersion, benchmarkVersion, defenders, options]) {
    hash.update(JSON.stringify(value))
    hash.update('\0')
  }
  for (const entry of entries) {
    hash.update(JSON.stringify(entry))
    hash.update('\n')
  }
  return hash.digest('hex')
}
