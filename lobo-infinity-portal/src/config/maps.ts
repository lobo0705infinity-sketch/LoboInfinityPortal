export const CANONICAL_MAPS = [
  'Industrial Zone',
  'Orbital Relay',
  'Desert Outpost',
  'Research Facility',
  'Urban Sprawl',
  'Cargo Port',
  'Data Center',
  'Research Labs',
  'Power Station',
  'Spaceport',
  'Hab Block',
  'Military Depot',
  'Market District',
  'Comms Array',
  'Bio-Dome',
  'Transit Hub',
] as const

export type CanonicalMap = (typeof CANONICAL_MAPS)[number]

const canonicalMapByKey = new Map(
  CANONICAL_MAPS.map((map) => [normalizeMapKey(map), map]),
)

export function getCanonicalMapName(value: string | undefined | null) {
  return canonicalMapByKey.get(normalizeMapKey(value ?? '')) ?? ''
}

export function isCanonicalMap(value: string | undefined | null) {
  return getCanonicalMapName(value) !== ''
}

export function getCanonicalMapOptions() {
  return CANONICAL_MAPS.map((map) => ({
    label: map,
    value: map,
  }))
}

function normalizeMapKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}
