import { mobilityKey, lookupMobility } from './mobility-lookup.mjs'

export const MOBILE_GUNFIGHTER_VERSION = 'mobile-gunfighter-v1'
export const MOBILE_WEIGHT = 0.15

export function midrankPercentiles(values) {
  if (!values.length) return []
  if (values.some(x => !Number.isFinite(x))) throw Error('Nonfinite percentile input')
  if (values.length === 1) return [50]
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
  const result = []
  for (let i = 0; i < sorted.length;) {
    let j = i + 1
    while (j < sorted.length && sorted[j].value === sorted[i].value) j++
    const percentile = 100 * (i + (j - i - 1) / 2) / (sorted.length - 1)
    for (let k = i; k < j; k++) result[sorted[k].index] = percentile
    i = j
  }
  return result
}

export function buildMobileGunfighterCatalog(gunfighter, mobility, fireteamEligible = () => true) {
  const entries = new Map(), coverage = {}
  for (const state of ['normal', 'fireteam']) {
    const cohort = []
    for (const entry of gunfighter.entries) {
      if (state === 'fireteam' && !fireteamEligible(entry.key)) continue
      const combat = entry.result.states.find(s => s.id === state)
      const movement = lookupMobility(mobility, entry.key)
      if (!Number.isFinite(combat?.rating) || movement?.status !== 'rated') continue
      cohort.push({ key: entry.key, gunfighter: combat.rating, mobility: movement.score })
    }
    const gp = midrankPercentiles(cohort.map(x => x.gunfighter)), mp = midrankPercentiles(cohort.map(x => x.mobility))
    coverage[state] = cohort.length
    cohort.forEach((row, index) => {
      if (!entries.has(row.key)) entries.set(row.key, { normal: null, fireteam: null })
      entries.get(row.key)[state] = { gunfighter: row.gunfighter, mobility: row.mobility, gunfighterPercentile: gp[index], mobilityPercentile: mp[index], score: (1 - MOBILE_WEIGHT) * gp[index] + MOBILE_WEIGHT * mp[index] }
    })
  }
  const profiles = [], keys = {}, signatures = new Map()
  for (const [key, record] of entries) {
    const signature = JSON.stringify(record)
    if (!signatures.has(signature)) { signatures.set(signature, profiles.length); profiles.push(record) }
    keys[key] = signatures.get(signature)
  }
  return { version: MOBILE_GUNFIGHTER_VERSION, mobilityWeight: MOBILE_WEIGHT, gunfighterFingerprint: gunfighter.fingerprint, mobilityFingerprint: mobility.fingerprint, coverage, profiles, keys }
}

// Deliberately exact: no cross-faction, group, option or form borrowing.
export function lookupMobileGunfighter(catalog, combinedId, state = 'normal') {
  if (catalog?.version !== MOBILE_GUNFIGHTER_VERSION || !['normal', 'fireteam'].includes(state)) return null
  const key = mobilityKey(combinedId)
  const index = key ? catalog.keys[key] : undefined
  return Number.isInteger(index) ? catalog.profiles[index]?.[state] ?? null : null
}
