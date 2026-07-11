import { type EventCapability } from './eventNavigation'
import type { LeagueEvent } from '../types/dashboard'

export type { EventCapability } from './eventNavigation'

const labelCapabilities: Record<string, EventCapability> = {
  factions: 'factions',
  intelligence: 'intelligence',
  map: 'map',
  matchfinder: 'matchFinder',
  objectives: 'objectives',
  overview: 'overview',
  pairings: 'pairings',
  players: 'players',
  registration: 'registration',
  results: 'results',
  rules: 'rules',
  schedule: 'schedule',
  standings: 'standings',
  statistics: 'statistics',
  submitresult: 'submitResult',
  teams: 'teams',
  territories: 'territories',
}

const campaignCapabilities: EventCapability[] = [
  'overview',
  'registration',
  'matchFinder',
  'map',
  'territories',
  'standings',
  'objectives',
  'statistics',
  'intelligence',
  'rules',
]

const leagueCapabilities: EventCapability[] = [
  'overview',
  'registration',
  'matchFinder',
  'submitResult',
  'standings',
  'schedule',
  'players',
  'factions',
  'statistics',
  'intelligence',
  'rules',
]

const tournamentCapabilities: EventCapability[] = [
  'overview',
  'registration',
  'matchFinder',
  'submitResult',
  'teams',
  'pairings',
  'standings',
  'results',
  'statistics',
  'intelligence',
  'rules',
]

export function resolveEventCapabilities(
  event: LeagueEvent,
  navigation: Array<{ href: string; label: string }> = [],
): EventCapability[] {
  if (event.capabilities.length > 0) {
    return event.capabilities as EventCapability[]
  }

  const navigationCapabilities = navigation
    .map((item) => labelCapabilities[item.label.toLowerCase().replace(/[^a-z]/g, '')])
    .filter((capability): capability is EventCapability => Boolean(capability))

  if (navigationCapabilities.length > 0) {
    return ['overview', ...navigationCapabilities]
  }

  const type = event.type.toLowerCase()

  if (type.includes('campaign')) {
    return campaignCapabilities
  }

  if (type.includes('tournament')) {
    return tournamentCapabilities
  }

  return leagueCapabilities
}

export function hasEventCapability(
  capabilities: EventCapability[],
  capability: EventCapability,
) {
  return capabilities.includes(capability)
}

export function getEventOverviewKind(capabilities: EventCapability[]) {
  if (
    capabilities.includes('map') ||
    capabilities.includes('territories') ||
    capabilities.includes('objectives')
  ) {
    return 'campaign'
  }

  if (capabilities.includes('teams') || capabilities.includes('pairings')) {
    return 'tournament'
  }

  return 'league'
}
