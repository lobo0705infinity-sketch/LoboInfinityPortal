import type { MissionGeistCatalogMission } from '../services/publicSnapshot'

export type MissionGeistNavigation = {
  kind: 'exact' | 'unique' | 'ambiguous' | 'unmatched'
  records: MissionGeistCatalogMission[]
}

export function resolveMissionGeistNavigation(
  mission: { mission: string; missionGeistId?: string; missionGeistCanonicalUrl?: string },
  catalog: MissionGeistCatalogMission[],
): MissionGeistNavigation {
  if (mission.missionGeistId || mission.missionGeistCanonicalUrl) {
    const exact = catalog.find((record) => record.id === mission.missionGeistId)
    return exact && exact.canonicalUrl === mission.missionGeistCanonicalUrl
      ? { kind: 'exact', records: [exact] }
      : { kind: 'unmatched', records: [] }
  }
  const key = mission.mission.trim().toLocaleLowerCase()
  const records = catalog.filter((record) => record.name.trim().toLocaleLowerCase() === key)
  return { kind: records.length === 0 ? 'unmatched' : records.length === 1 ? 'unique' : 'ambiguous', records }
}
