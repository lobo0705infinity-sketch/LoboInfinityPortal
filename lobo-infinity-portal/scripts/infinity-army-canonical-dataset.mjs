import { createHash } from 'node:crypto'

export const CANONICAL_DATASET_SCHEMA_VERSION = 'infinity-army-canonical-dataset-v1'

export function buildCanonicalDataset({ metadata, payloads = [], capturedAt = new Date().toISOString(), language = 'en' } = {}) {
  const units = payloads.flatMap((payload) => payload?.units || [])
  const unitVersion = payloads.map((payload) => payload?.version).filter(Boolean).sort().join(',') || null
  const normalizedMetadata = normalizeMetadata(metadata)
  const normalizedPayloads = payloads.map(normalizeUnitPayload)
  const metadataHash = sha256(normalizedMetadata)
  const unitPayloadHash = sha256(normalizedPayloads)
  const compositeId = `iad-${sha256({ schemaVersion: CANONICAL_DATASET_SCHEMA_VERSION, language, unitVersion, metadataHash, unitPayloadHash }).slice(0, 24)}`
  return {
    schemaVersion: CANONICAL_DATASET_SCHEMA_VERSION,
    datasetId: compositeId,
    capturedAt,
    language,
    sourceUrls: ['https://infinitytheuniverse.com/army/infinity/en/metadata', ...payloads.map((payload) => payload?.url).filter(Boolean)],
    officialUnitVersion: unitVersion,
    metadataHash,
    unitPayloadHash,
    metadata: normalizedMetadata,
    payloads: normalizedPayloads,
    units,
  }
}

export function normalizeMetadata(metadata = {}) {
  return {
    factions: Array.isArray(metadata.factions) ? metadata.factions : [],
    weapons: (metadata.weapons || []).map((weapon) => normalizeWeapon(weapon)),
    skills: Array.isArray(metadata.skills) ? metadata.skills : [],
    equips: Array.isArray(metadata.equips) ? metadata.equips : [],
  }
}

export function normalizeUnitPayload(payload = {}) {
  return { version: payload.version || null, units: Array.isArray(payload.units) ? payload.units : [], fireteamChart: payload.fireteamChart || null }
}

export function normalizeWeapon(weapon = {}) {
  const rawBurst = weapon.burst
  const burst = rawBurst === '-' ? null : (rawBurst == null || rawBurst === '' ? null : Number(rawBurst))
  const burstStatus = rawBurst === '-' ? 'not-applicable' : Number.isFinite(burst) ? 'canonical' : 'unknown'
  return {
    id: Number.isInteger(Number(weapon.id)) ? Number(weapon.id) : null,
    mode: weapon.mode == null ? null : String(weapon.mode),
    variant: weapon.variant == null ? null : String(weapon.variant),
    name: String(weapon.name || ''),
    type: String(weapon.type || ''),
    burst: burstStatus === 'canonical' ? burst : null,
    burstStatus,
  }
}

export function resolveCanonicalWeaponRecords(dataset, references = []) {
  const catalog = dataset?.metadata?.weapons || []
  return references.map((reference) => {
    const id = Number(reference?.id)
    const candidates = catalog.filter((weapon) => weapon.id === id)
    const mode = reference?.mode ?? reference?.variant ?? reference?.name ?? null
    const matched = mode == null ? candidates : candidates.filter((weapon) => weapon.mode === String(mode) || weapon.variant === String(mode) || weapon.name === String(mode))
    const selected = matched.length === 1 ? matched[0] : candidates.length === 1 ? candidates[0] : null
    if (!selected) {
      // Some official mode records intentionally share an ID and have no mode
      // discriminator in the option reference.  They are still safe for a
      // Burst value when the canonical records agree exactly on that value;
      // do not claim that a particular mode was selected.
      const invariant = invariantBurstRecord(candidates)
      if (invariant) return { ...invariant, id: Number.isInteger(id) ? id : null, name: invariant.name || candidates[0]?.name || String(reference?.name || ''), mode: mode == null ? null : String(mode), modeResolution: 'ambiguous', sourceDatasetId: dataset?.datasetId || null }
      return { id: Number.isInteger(id) ? id : null, name: candidates[0]?.name || String(reference?.name || ''), mode: mode == null ? null : String(mode), burst: null, burstStatus: candidates.length ? 'ambiguous' : 'unknown', sourceDatasetId: dataset?.datasetId || null }
    }
    return { ...selected, sourceDatasetId: dataset?.datasetId || null }
  })
}

function invariantBurstRecord(candidates) {
  if (!candidates.length) return null
  const first = candidates[0]
  if (candidates.some((candidate) => candidate.name !== first.name || candidate.type !== first.type || candidate.burstStatus !== first.burstStatus)) return null
  if (first.burstStatus === 'canonical' && candidates.some((candidate) => candidate.burst !== first.burst)) return null
  if (first.burstStatus === 'unknown' && candidates.length > 1) return null
  return { ...first }
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
