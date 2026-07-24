import { type EventCapability } from './eventNavigation'
import type { LeagueEvent } from '../types/dashboard'

export type { EventCapability } from './eventNavigation'

const labelCapabilities: Record<string, EventCapability> = {
  factions: 'factions',
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
  'rules',
]

const leagueCapabilities: EventCapability[] = [
  'overview',
  'registration',
  'matchFinder',
  'standings',
  'schedule',
  'statistics',
  'rules',
]

const tournamentCapabilities: EventCapability[] = [
  'overview',
  'registration',
  'teams',
  'pairings',
  'standings',
  'results',
  'statistics',
  'rules',
]

export function resolveEventCapabilities(
  event: LeagueEvent,
  navigation: Array<{ href: string; label: string }> = [],
): EventCapability[] {
  if (event.capabilities.length > 0) {
    return filterOperationalEventCapabilities(
      event,
      event.capabilities as EventCapability[],
    )
  }

  const navigationCapabilities = navigation
    .map((item) => labelCapabilities[item.label.toLowerCase().replace(/[^a-z]/g, '')])
    .filter((capability): capability is EventCapability => Boolean(capability))

  if (navigationCapabilities.length > 0) {
    return filterOperationalEventCapabilities(event, [
      'overview',
      ...navigationCapabilities,
    ])
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

function filterOperationalEventCapabilities(
  event: LeagueEvent,
  capabilities: EventCapability[],
) {
  const type = event.type.toLowerCase()

  if (type.includes('tournament')) {
    return withOverview(capabilities.filter((capability) =>
      tournamentCapabilities.includes(capability),
    ))
  }

  if (type.includes('league')) {
    return withOverview(capabilities.filter((capability) =>
      leagueCapabilities.includes(capability),
    ))
  }

  return capabilities
}

function withOverview(capabilities: EventCapability[]): EventCapability[] {
  return capabilities.includes('overview')
    ? capabilities
    : ['overview' as EventCapability, ...capabilities]
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
