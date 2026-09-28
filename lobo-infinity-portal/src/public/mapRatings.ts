import { loboWorkshopMapBySlug, loboWorkshopMaps } from '../../shared/lobo-workshop-maps.mjs'
import type { PublicGame } from './snapshotTypes'

export type MapRating = { average: number; count: number; rank: number }

// Ratings belong to the terrain layout. Multiple Workshop saves, or the same
// layout in two event sections, must not create competing rankings.
export function buildMapRatings(games: PublicGame[]): Map<number, MapRating> {
  const totals = new Map<number, { total: number; count: number }>()
  const seenGames = new Set<number>()
  for (const game of games) {
    if (seenGames.has(game.id)) continue
    seenGames.add(game.id)
    const map = loboWorkshopMapBySlug.get(game.mapSlug ?? '')
    const rating = game.mapRating
    if (!map || typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) continue
    const current = totals.get(map.layoutKey) ?? { total: 0, count: 0 }
    current.total += rating
    current.count += 1
    totals.set(map.layoutKey, current)
  }
  const names = new Map(loboWorkshopMaps.map((map) => [map.layoutKey, map.name]))
  const ranked = [...totals].sort(([leftKey, left], [rightKey, right]) =>
    right.total / right.count - left.total / left.count ||
    right.count - left.count ||
    (names.get(leftKey) ?? String(leftKey)).localeCompare(names.get(rightKey) ?? String(rightKey)))
  return new Map(ranked.map(([key, { total, count }], index) =>
    [key, { average: total / count, count, rank: index + 1 }]))
}

export function mapRatingLabel(rating?: MapRating) {
  return rating ? `★ ${rating.average.toFixed(1)} / 5 · ${rating.count} ${rating.count === 1 ? 'rating' : 'ratings'} · #${rating.rank}` : 'No ratings yet'
}
