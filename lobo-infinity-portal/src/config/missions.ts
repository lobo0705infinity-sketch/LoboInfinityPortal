export const CANONICAL_MISSIONS = [
  'Area of Interest',
  'Akial Interference',
  'B-Pong',
  'Corporate Appropriation',
  'Critical Intervention',
  'Crossing Lines',
  'Evacuation',
  'Hardlock',
  'Last Launch',
  'Neutralization',
  'Outbreak',
  'Panic Room',
  'Provisioning',
  'Annihilation',
  'Battleground',
  'Cutthroat',
  'Superiority',
  'Uplink Center',
] as const

export type CanonicalMission = (typeof CANONICAL_MISSIONS)[number]

const canonicalMissionByKey = new Map(
  CANONICAL_MISSIONS.map((mission) => [normalizeMissionKey(mission), mission]),
)

export function getCanonicalMissionName(value: string | undefined | null) {
  return canonicalMissionByKey.get(normalizeMissionKey(value ?? '')) ?? ''
}

export function isCanonicalMission(value: string | undefined | null) {
  return getCanonicalMissionName(value) !== ''
}

export function getCanonicalMissionOptions() {
  return CANONICAL_MISSIONS.map((mission) => ({
    label: mission,
    value: mission,
  }))
}

export function filterCanonicalMissionNames(values: string[]) {
  const seen = new Set<string>()
  const missions: string[] = []

  values.forEach((value) => {
    const mission = getCanonicalMissionName(value)

    if (!mission || seen.has(mission)) {
      return
    }

    seen.add(mission)
    missions.push(mission)
  })

  return missions
}

export function filterCanonicalMissionRecords<T extends { mission: string }>(
  records: T[],
) {
  const seen = new Set<string>()
  const missions: T[] = []

  records.forEach((record) => {
    const mission = getCanonicalMissionName(record.mission)

    if (!mission || seen.has(mission)) {
      return
    }

    seen.add(mission)
    missions.push({
      ...record,
      mission,
    })
  })

  return missions
}

function normalizeMissionKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}
