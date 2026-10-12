import type { PublicArmyList, PublicEvent, PublicMissionAssignment, PublicSchedule } from './snapshotTypes'

export const TOP40_EVENT_ID = 'event-lobo-s-american-top-40'
// Start date announced by the Commissioner; the event snapshot takes precedence.
export const TOP40_ANNOUNCED_START_DATE = '2026-11-01'
export type Top40Registration = { generatedAt: string; players: Array<{ name: string; position: number }> }
export type PreparationAssignment = { id: string; label: string; mission: string; missionGeistId?: string; missionGeistCanonicalUrl?: string; maps: string[] }

export function isTop40Registration(value: unknown): value is Top40Registration {
  if (!value || typeof value !== 'object') return false
  const item = value as Top40Registration
  return typeof item.generatedAt === 'string' && Number.isFinite(Date.parse(item.generatedAt))
    && Array.isArray(item.players) && item.players.every((player, index) => typeof player?.name === 'string' && player.name.trim() && player.position === index + 1)
}

function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function assignedMaps(record: Record<string, unknown>) {
  const maps = Array.isArray(record.maps) ? record.maps : [record.mapSlug || record.map]
  return [...new Set(maps.map(text).filter(Boolean))]
}

export function buildPreparationAssignments(event: PublicEvent, schedules: PublicSchedule[]): PreparationAssignment[] {
  const sources: PublicMissionAssignment[] = event.bracketMissions?.length ? event.bracketMissions : event.rounds ?? []
  const schedule = schedules.find(item => item.eventId === event.id)
  const useSchedulePool = !sources.some(record => text(record.mission)) && Boolean(schedule?.missions.length)
  const records: PublicMissionAssignment[] = useSchedulePool ? schedule!.missions : sources
  return records.map((record, index) => {
    const mission = text(record.mission)
    const scheduled = schedule?.missions.find(item => mission && item.mission === mission)
    const maps = assignedMaps(record)
    const bracket = text(record.bracket)
    const round = text(String(record.bracketRound ?? record.number ?? ''))
    const label = text(record.name) || (useSchedulePool ? 'Mission pool' : bracket === 'Grand Final' ? bracket : bracket ? `${bracket} Bracket${round ? ` · Round ${round}` : ''}` : `Round ${round || index + 1}`)
    return { id: text(record.id) || `${bracket}-${round}-${index}`, label, mission,
      missionGeistId: text(record.missionGeistId) || scheduled?.missionGeistId,
      missionGeistCanonicalUrl: text(record.missionGeistCanonicalUrl) || scheduled?.missionGeistCanonicalUrl,
      maps: maps.length ? maps : assignedMaps(scheduled ?? {}),
    }
  })
}

export function activePreparationMatches(event: PublicEvent) {
  return (event.bracket ?? []).filter(record => text(record.status).toLowerCase() === 'active')
    .map(record => ({ id: text(record.matchId), playerA: text(record.playerA), playerB: text(record.playerB), deadline: text(record.deadline) }))
}

export function groupPublicEventLists(lists: PublicArmyList[], eventId: string) {
  const groups = new Map<string, { player: string; displayName: string; lists: PublicArmyList[] }>()
  for (const list of lists) {
    if (list.eventId !== eventId || list.approved === false) continue
    const group = groups.get(list.player) ?? { player: list.player, displayName: list.playerDisplayName || list.player, lists: [] }
    group.lists.push(list)
    groups.set(list.player, group)
  }
  return [...groups.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)).map(group => ({ ...group,
    lists: [...group.lists].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || a.id.localeCompare(b.id)),
  }))
}

export function preparationDate(value: string): string {
  if (!value) return 'To be announced'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return 'To be announced'
    return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  }
  // Preserve published wall times when no timezone was supplied.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(value)) return `${value.replace('T', ' ')} (published time)`
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return 'To be announced'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'To be announced'
}

export function top40RegistrationState(event?: PublicEvent): 'open' | 'closed' | 'unknown' {
  if (!event) return 'unknown'
  const state = `${event.status} ${event.lifecycleStage}`.toLowerCase()
  if (/registration closed|\bactive\b|\bcompleted\b|\barchived\b/.test(state)) return 'closed'
  return /registration open/.test(state) ? 'open' : 'unknown'
}
