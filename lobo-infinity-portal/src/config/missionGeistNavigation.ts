import type { MissionGeistCatalogMission } from '../services/publicSnapshot'

export type MissionGeistNavigation = {
  kind: 'exact' | 'unique' | 'ambiguous' | 'unmatched'
  records: MissionGeistCatalogMission[]
}

// Submitted names can omit the author credit used by the catalog.
// Resolve known aliases by stable ID instead of guessing a URL or mission version.
const missionCatalogAliases: Record<string, string> = {
  "dead man's switch": 'cm_lobo_dead_mans_switch',
}

function missionNameKey(name: string) {
  return name.normalize('NFKC').replace(/[\u2018\u2019]/g, "'").trim().toLocaleLowerCase()
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
  const key = missionNameKey(mission.mission)
  let records = catalog.filter((record) => missionNameKey(record.name) === key)
  if (records.length === 0 && missionCatalogAliases[key]) {
    records = catalog.filter((record) => record.id === missionCatalogAliases[key])
  }
  return { kind: records.length === 0 ? 'unmatched' : records.length === 1 ? 'unique' : 'ambiguous', records }
}

// Campaign mission names also exist in older ITS seasons. Show one official
// reference, prefer current records, and retain the edition for an honest label.
export function resolveAuroraMissionReference(mission: string, catalog: MissionGeistCatalogMission[]) {
  const candidates = resolveMissionGeistNavigation({ mission }, catalog).records.filter(record => {
    try {
      const url = new URL(record.canonicalUrl)
      return record.rights.official === true && url.protocol === 'https:' && url.hostname === 'infinitygeist.com'
    } catch { return false }
  })
  const season = (record: MissionGeistCatalogMission) => Number(/^s(\d+)$/.exec(record.sourceCollectionId)?.[1] ?? -1)
  return candidates.sort((left, right) => Number(right.current) - Number(left.current)
    || season(right) - season(left) || left.id.localeCompare(right.id))[0]
}
