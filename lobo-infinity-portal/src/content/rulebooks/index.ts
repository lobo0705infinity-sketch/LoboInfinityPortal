import type { Rulebook } from './types'

export type RulebookId = 'league' | 'teamTournament'

const rulebookLoaders: Record<RulebookId, () => Promise<{ default: Rulebook }>> = {
  league: () => import('./league'),
  teamTournament: () => import('./teamTournament'),
}

export function loadRulebook(rulebookId: RulebookId) {
  return rulebookLoaders[rulebookId]()
}

export function resolveRulebookIdForEvent(event: {
  id: string
  type: string
}): RulebookId {
  if (
    event.id === 'event-august-2026-team-tournament' ||
    event.type.toLowerCase().includes('tournament')
  ) {
    return 'teamTournament'
  }

  return 'league'
}
