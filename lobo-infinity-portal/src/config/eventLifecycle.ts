/** Explicit commissioner decisions take precedence over stale source labels.
 * Event IDs stay permanent: each future edition must receive a new ID.
 */
export type EventLifecycle = 'Upcoming' | 'Registration Open' | 'In Progress' | 'Completed' | 'Archived'
export type LifecycleEvent = { id: string; status?: string; lifecycleStage?: string; startDate?: string; endDate?: string }
export const archivedEventEditions: Record<string, { name: string; completed: string }> = {
  'event-august-2026-team-tournament': { name: 'August 2026 Team Tournament', completed: '2026-10-29' },
}

export function eventLifecycle(event: LifecycleEvent): EventLifecycle {
  if (archivedEventEditions[event.id]) return 'Archived'
  const labels = [event.lifecycleStage, event.status].map(value => (value || '').trim().toLowerCase())
  if (labels.some(value => /^(archived|archive)$/.test(value))) return 'Archived'
  if (labels.some(value => /^(completed|complete|finished|awards)$/.test(value))) return 'Completed'
  if (labels.some(value => /^(active|in progress|in-progress|running|midseason|final week|round \d+|final round)$/.test(value))) return 'In Progress'
  if (labels.includes('registration open')) return 'Registration Open'
  return 'Upcoming'
}
export function isPastEvent(event: LifecycleEvent) {
  return ['Completed', 'Archived'].includes(eventLifecycle(event))
}
export function eventEditionName(event: LifecycleEvent & { name: string }) {
  return archivedEventEditions[event.id]?.name || event.name
}
export function eventReportingClosure(event?: LifecycleEvent) {
  return event && isPastEvent(event) ? 'This event is complete. Result reporting is closed; contact the Commissioner for a correction.' : undefined
}
