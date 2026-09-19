export const pageAnalyticsDisplayNames = {
  dashboard: 'Dashboard',
  players: 'Players',
  'player-profile': 'Player Profile',
  compare: 'Compare Players',
  rivalries: 'Rivalries',
  'game-details': 'Game Details',
  factions: 'Factions',
  'faction-profile': 'Faction Profile',
  missions: 'Missions',
  'mission-profile': 'Mission Profile',
  'army-intelligence': 'Army Intelligence',
  'hall-of-fame': 'Hall of Fame',
  streams: 'Streams',
  'army-lists': 'Army Lists',
  'army-list-submit': 'Submit Army List',
  standings: 'Standings',
  statistics: 'Statistics',
  'league-operations': 'Mission & Map',
  events: 'Past Events',
  'event-overview': 'Event Overview',
  'event-registration': 'Event Registration',
  'submit-game': 'Submit Game',
  schedule: 'League Schedule',
  rules: 'Rules',
  'mobile-menu': 'More',
  'team-tournament-overview': 'Team Tournament Overview',
  'team-tournament-registration': 'Team Tournament Registration',
  'team-tournament-standings': 'Team Tournament Standings',
  'team-tournament-pairings': 'Team Tournament Pairings',
  'team-tournament-teams': 'Team Tournament Teams',
  'team-tournament-results': 'Team Tournament Results',
} as const

export type PageAnalyticsKey = keyof typeof pageAnalyticsDisplayNames

const suppressedPaths = new Set(['/diagnostics', '/integrity', '/automation'])
const redirectOnlyPaths = new Set([
  '/alerts',
  '/casual-result',
  '/intelligence',
  '/match-finder',
  '/news',
  '/notifications',
  '/profile',
  '/timeline',
])

export function normalizePageAnalyticsPath(pathname: string): PageAnalyticsKey | null {
  const path = normalizePathname(pathname)
  const segments = path.split('/').filter(Boolean)

  if (path.startsWith('/commissioner') || suppressedPaths.has(path)) return null
  if (redirectOnlyPaths.has(path)) return null
  if (segments[0] === 'news' || segments[0] === 'career' || segments[0] === 'achievement') return null
  if (segments[0] === 'stream' || segments[0] === 'army-list') return null

  if (path === '/' || path === '/dashboard') return 'dashboard'
  if (path === '/players' || path === '/community') return 'players'
  if (segments.length === 2 && (segments[0] === 'players' || segments[0] === 'player')) return 'player-profile'
  if (path === '/compare') return 'compare'
  if (path === '/rivalries') return 'rivalries'
  if (segments.length === 2 && (segments[0] === 'games' || segments[0] === 'game')) return 'game-details'
  if (path === '/factions') return 'factions'
  if (segments.length === 2 && (segments[0] === 'factions' || segments[0] === 'faction')) return 'faction-profile'
  if (path === '/missions') return 'missions'
  if (segments.length === 2 && (segments[0] === 'missions' || segments[0] === 'mission')) return 'mission-profile'
  if (path === '/army-intelligence') return 'army-intelligence'
  if (path === '/hall-of-fame') return 'hall-of-fame'
  if (path === '/streams') return 'streams'
  if (path === '/army-lists') return 'army-lists'
  if (path === '/army-lists/submit') return 'army-list-submit'
  if (path === '/standings') return 'standings'
  if (path === '/analytics') return 'statistics'
  if (path === '/league-operations') return 'league-operations'
  if (path === '/events') return 'events'
  if (path === '/submit-game') return 'submit-game'
  if (path === '/schedule') return 'schedule'
  if (path === '/rules') return 'rules'
  if (path === '/menu') return 'mobile-menu'
  if (path === '/team-tournament') return 'team-tournament-overview'

  if (segments[0] === 'event' && segments.length >= 2) {
    if (segments[2] === 'submit-result') return null

    if (segments[2] === 'tournament') {
      return normalizeTournamentSection(segments[3])
    }

    if (segments[2] === 'registration') return 'event-registration'
    if (segments.length === 2 || segments.length === 3) return 'event-overview'
  }

  return null
}

function normalizeTournamentSection(section = ''): PageAnalyticsKey {
  if (section === 'registration' || section === 'register') return 'team-tournament-registration'
  if (section === 'standings') return 'team-tournament-standings'
  if (section === 'pairings') return 'team-tournament-pairings'
  if (section === 'teams') return 'team-tournament-teams'
  if (section === 'results') return 'team-tournament-results'
  return 'team-tournament-overview'
}

function normalizePathname(pathname: string) {
  const trimmed = pathname.trim().replace(/\/+$/, '')
  return trimmed || '/'
}
