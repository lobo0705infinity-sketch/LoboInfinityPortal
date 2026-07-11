import type { PortalIconName } from '../components/PortalIcon'

export type EventCapability =
  | 'overview'
  | 'registration'
  | 'matchFinder'
  | 'submitResult'
  | 'standings'
  | 'schedule'
  | 'players'
  | 'factions'
  | 'intelligence'
  | 'statistics'
  | 'rules'
  | 'teams'
  | 'pairings'
  | 'results'
  | 'map'
  | 'territories'
  | 'objectives'

export type EventNavigationConfig = {
  capabilities: EventCapability[]
  id: string
  label: string
  routeOverrides?: Partial<Record<EventCapability, string>>
  type: string
}

export type EventCapabilityNavigationItem = {
  capability: EventCapability
  icon: PortalIconName
  label: string
  mobileNav?: string
  to: string
}

export const capabilityLabels: Record<EventCapability, string> = {
  factions: 'Factions',
  intelligence: 'Intelligence',
  map: 'Map',
  matchFinder: 'Match Finder',
  objectives: 'Objectives',
  overview: 'Overview',
  pairings: 'Pairings',
  players: 'Players',
  registration: 'Registration',
  results: 'Results',
  rules: 'Rules',
  schedule: 'Schedule',
  submitResult: 'Submit Result',
  standings: 'Standings',
  statistics: 'Statistics',
  teams: 'Teams',
  territories: 'Territories',
}

const capabilityIcons: Record<EventCapability, PortalIconName> = {
  factions: 'factions',
  intelligence: 'analytics',
  map: 'timeline',
  matchFinder: 'compare',
  objectives: 'missions',
  overview: 'dashboard',
  pairings: 'compare',
  players: 'players',
  registration: 'submit',
  results: 'timeline',
  rules: 'rules',
  schedule: 'timeline',
  submitResult: 'submit',
  standings: 'standings',
  statistics: 'analytics',
  teams: 'players',
  territories: 'factions',
}

const defaultCapabilityRoutes: Record<EventCapability, string> = {
  factions: '/factions?eventId=:eventId',
  intelligence: '/intelligence?eventId=:eventId',
  map: '/event/:eventId#map',
  matchFinder: '/match-finder?eventId=:eventId',
  objectives: '/event/:eventId#objectives',
  overview: '/event/:eventId',
  pairings: '/event/:eventId#pairings',
  players: '/players?eventId=:eventId',
  registration: '/event/:eventId/registration',
  results: '/event/:eventId#results',
  rules: '/rules?eventId=:eventId',
  schedule: '/schedule?eventId=:eventId',
  submitResult: '/event/:eventId/submit-result',
  standings: '/standings?eventId=:eventId',
  statistics: '/analytics?eventId=:eventId',
  teams: '/event/:eventId#teams',
  territories: '/event/:eventId#territories',
}

const mobileNavTargets: Partial<Record<EventCapability, string>> = {
  matchFinder: '/match-finder',
  standings: '/standings',
}

export const currentEventNavigation: EventNavigationConfig = {
  capabilities: [
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
  ],
  id: 'event-current-league',
  label: 'July 2026 League',
  type: 'League',
}

export const eventNavigation: EventNavigationConfig[] = [
  {
    capabilities: [
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
    ],
    id: 'event-august-2026-team-tournament',
    label: 'Team Tournament',
    routeOverrides: {
      pairings: '/event/:eventId/tournament/pairings',
      registration: '/event/:eventId/tournament/registration',
      results: '/event/:eventId/tournament/results',
      standings: '/event/:eventId/tournament/standings',
      submitResult: '/event/:eventId/submit-result',
      teams: '/event/:eventId/tournament/teams',
    },
    type: 'Team Tournament',
  },
]

export const eventNavigationOptions: EventNavigationConfig[] = [
  currentEventNavigation,
  ...eventNavigation,
]

export function getEventNavigationConfig(eventId: string) {
  return eventNavigationOptions.find((event) => event.id === eventId) ?? null
}

export function buildCapabilityNavigation(
  event: Pick<EventNavigationConfig, 'capabilities' | 'id' | 'routeOverrides'>,
) {
  return event.capabilities.map((capability) =>
    buildCapabilityNavigationItem(event, capability),
  )
}

export function buildCapabilityNavigationItem(
  event: Pick<EventNavigationConfig, 'id' | 'routeOverrides'>,
  capability: EventCapability,
): EventCapabilityNavigationItem {
  const routeTemplate =
    event.routeOverrides?.[capability] ?? defaultCapabilityRoutes[capability]
  const to = routeTemplate.replaceAll(':eventId', encodeURIComponent(event.id))

  return {
    capability,
    icon: capabilityIcons[capability],
    label: capabilityLabels[capability],
    mobileNav: mobileNavTargets[capability],
    to,
  }
}
