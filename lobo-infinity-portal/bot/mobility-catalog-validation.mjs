export const MOBILITY_CATALOG_SCHEMA = 'mobility-catalog-v2'

export function validateMobilityCapture(capture) {
  if (capture?.failures?.length) throw Error('Refusing an incomplete official capture: reported failures')
  if (!Array.isArray(capture?.metadata?.factions) || !capture.metadata.factions.length) throw Error('Missing official faction manifest')
  if (!Array.isArray(capture.payloads)) throw Error('Missing faction payloads')
  const expected = capture.metadata.factions.map(x => x.id)
  const actual = capture.payloads.map(x => x.sectorialId ?? Number(x.url?.split('/').pop()))
  for (const [label, ids] of [['manifest', expected], ['payloads', actual]]) {
    if (ids.some(x => !Number.isInteger(x) || x <= 0)) throw Error(`Invalid faction ID in ${label}`)
    if (new Set(ids).size !== ids.length) throw Error(`Duplicate faction ID in ${label}`)
  }
  const missing = expected.filter(x => !actual.includes(x))
  const unexpected = actual.filter(x => !expected.includes(x))
  if (missing.length || unexpected.length) throw Error(`Incomplete faction coverage: missing [${missing}], unexpected [${unexpected}]`)
  for (const payload of capture.payloads) {
    if (!Array.isArray(payload.units) || !payload.units.length) throw Error('Missing or empty official unit payload')
    if (!payload.version) throw Error('Missing official payload version')
    for (const unit of payload.units) {
      if (!Array.isArray(unit.profileGroups) || !unit.profileGroups.length) throw Error(`Missing profile groups: ${unit.id}`)
      for (const group of unit.profileGroups) {
        if (!Array.isArray(group.options) || !Array.isArray(group.profiles) || !group.profiles.length) throw Error(`Incomplete profile group: ${unit.id}:${group.id}`)
      }
    }
  }
  return { expectedPayloads: expected.length, actualPayloads: actual.length }
}

export function validateMobilityEntries(entries) {
  if (!entries.length) throw Error('Official capture contains no profiles')
  const seen = new Set()
  for (const entry of entries) {
    if (![entry.sectorialId, entry.unitId, entry.groupId, entry.optionId, entry.profileId].every(x => Number.isInteger(x) && x > 0)) throw Error(`Invalid profile identity: ${entry.id}`)
    if (seen.has(entry.id)) throw Error(`Duplicate profile: ${entry.id}`)
    seen.add(entry.id)
    if (entry.mobility.status === 'missing-movement') throw Error(`Missing movement: ${entry.id}`)
    if ([...entry.skills, ...entry.equipment].some(x => /Unknown\s+\d/.test(x))) throw Error(`Unresolved trait: ${entry.id}`)
    if (entry.mov && !(typeof entry.ph === 'number' && entry.ph > 0)) throw Error(`Missing PH for mobile profile: ${entry.id}`)
  }
  return { uniqueEntries: seen.size, missingMovement: 0, unresolvedTraits: 0 }
}
