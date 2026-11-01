import type { PublicEventProjection } from './publicEventProjection'
import type { PublicArmyList, PublicEvent, PublicGame } from '../public/snapshotTypes'

const eventId = 'event-lobo-s-american-top-40'
export type Top40LiveData = { projection?: PublicEventProjection; generatedAt: string; event: PublicEvent; games: PublicGame[]; armyLists: PublicArmyList[] }
let pending: Promise<Top40LiveData> | undefined
let expires = 0
export function getTop40LivePublicData(force = false): Promise<Top40LiveData> {
  if (!force && pending && Date.now() < expires) return pending
  expires = Date.now() + 15_000
  pending = fetch(`/api/public-event-projection?eventId=${eventId}`, { cache: 'no-cache', signal: AbortSignal.timeout(10_000) }).then(async response => {
    if (!response.ok) throw new Error('Event update unavailable; showing the last published snapshot.')
    const value = await response.json()
    const projection = value.projection
    const data = projection?.publicData
    if (!value.success || projection?.eventId !== eventId || data?.event?.id !== eventId || !Array.isArray(data.games) || !Array.isArray(data.armyLists)
      || data.games.some((game: PublicGame) => game.eventId !== eventId) || data.armyLists.some((list: PublicArmyList) => list.eventId !== eventId)) throw new Error('Public event projection event isolation failed.')
    return { ...data, generatedAt: projection.generatedAt, projection } as Top40LiveData
  }).catch(error => { pending = undefined; expires = 0; throw error })
  return pending
}
export function mergeTop40LiveDataset<T>(dataset: string, baseline: T, live: Top40LiveData): T {
  if (!Array.isArray(baseline)) return baseline
  if (dataset === 'events') return baseline.map(event => event.id === eventId ? live.event : event) as T
  const additions = dataset === 'games' ? live.games : dataset === 'army-lists' ? live.armyLists : null
  return additions ? [...baseline.filter(item => item.eventId !== eventId), ...additions] as T : baseline
}
