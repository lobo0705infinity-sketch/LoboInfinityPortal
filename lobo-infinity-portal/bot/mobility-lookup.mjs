const legacyIndexes = new WeakMap()

export function mobilityKey(combinedId) {
  const parts = String(combinedId || '').split(/[-:]/)
  return parts.length === 5 && parts.every(x => /^\d+$/.test(x)) ? parts.map(Number).join(':') : null
}

export function lookupMobility(catalog, combinedId) {
  if (catalog?.version !== 'mobility-index-v1') return null
  const key = mobilityKey(combinedId)
  if (!key) return null
  const index = catalog.keys[key]
  if (Number.isInteger(index)) return catalog.profiles[index] ?? null
  const [sectorial, unit, group, option, form] = key.split(':')
  if (group !== '0') return null
  // Legacy group zero is accepted only when every compatible exact entry has
  // the same movement record. Ambiguous forms/loadouts never borrow a score.
  let legacy = legacyIndexes.get(catalog)
  if (!legacy) {
    legacy = new Map()
    for (const [candidate, value] of Object.entries(catalog.keys)) {
      const p = candidate.split(':')
      const alias = [p[0], p[1], p[3], p[4]].join(':')
      legacy.set(alias, legacy.has(alias) && legacy.get(alias) !== value ? null : value)
    }
    legacyIndexes.set(catalog, legacy)
  }
  const match = legacy.get([sectorial, unit, option, form].join(':'))
  return Number.isInteger(match) ? catalog.profiles[match] ?? null : null
}
