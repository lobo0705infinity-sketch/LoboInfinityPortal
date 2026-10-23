import type { PublicEvent } from '../public/snapshotTypes'

type ReportingEvent = Partial<Pick<PublicEvent, 'status' | 'lifecycleStage' | 'bracket'>>
export function top40ReportingAvailability(event?: ReportingEvent, now = new Date()) {
  const status = (event?.status || '').trim().toLowerCase()
  const stage = (event?.lifecycleStage || '').trim().toLowerCase()
  if (['completed', 'closed', 'cancelled', 'canceled', 'archived'].includes(status)
    || ['completed', 'archived'].includes(stage)) return { open: false, message: 'Tournament result reporting is closed.' }
  const active = ['active', 'in progress', 'in-progress', 'running']
  if (active.includes(status) || active.includes(stage)
    || event?.bracket?.some(match => String(match.status).trim().toLowerCase() === 'active')) return { open: true, message: '' }
  return { open: false, message: now < new Date('2026-11-01T00:00:00-04:00')
    ? 'Tournament play starts November 1. Result reporting opens when matches are released.'
    : 'Result reporting opens when tournament matches are released.' }
}
