export type FeaturedGame = {
  id: number
  mission: string
  player1Faction: string
  player2Faction: string
  bestMoment: string
}

export const PINNED_FEATURED_REPORT_ID: number | null
export function selectFeaturedReport<T extends FeaturedGame>(games: readonly T[] | null | undefined, pinnedId?: number | null): T | null
export function featuredReportHighlight(moment?: string | null): string
