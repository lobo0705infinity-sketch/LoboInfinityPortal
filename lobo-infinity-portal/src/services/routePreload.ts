const routeLoaders = new Map<string, () => Promise<unknown>>([
  ['/', () => import('../pages/Dashboard')],
  ['/analytics', () => import('../pages/Analytics')],
  ['/army-lists', () => import('../pages/ArmyLists')],
  ['/automation', () => import('../pages/AutomationCenter')],
  ['/commissioner', () => import('../pages/CommissionerDashboard')],
  ['/compare', () => import('../pages/PlayerComparison')],
  ['/diagnostics', () => import('../pages/Diagnostics')],
  ['/games', () => import('../pages/GameDetails')],
  ['/factions', () => import('../pages/Factions')],
  ['/faction-detail', () => import('../pages/FactionProfile')],
  ['/hall-of-fame', () => import('../pages/HallOfFame')],
  ['/integrity', () => import('../pages/LeagueIntegrity')],
  ['/match-finder', () => import('../pages/MatchFinder')],
  ['/missions', () => import('../pages/Missions')],
  ['/mission-detail', () => import('../pages/MissionProfile')],
  ['/news', () => import('../pages/CommissionerNews')],
  ['/notifications', () => import('../pages/Notifications')],
  ['/players', () => import('../pages/Players')],
  ['/player-detail', () => import('../pages/PlayerProfile')],
  ['/profile', () => import('../pages/MyProfile')],
  ['/rivalries', () => import('../pages/Rivalries')],
  ['/rules', () => import('../pages/Rules')],
  ['/standings', () => import('../pages/Standings')],
  ['/streams', () => import('../pages/StreamedGames')],
  ['/timeline', () => import('../pages/Timeline')],
])

const loadedRoutes = new Set<string>()

export function preloadRoute(path: string) {
  const normalizedPath = normalizeRoutePath(path)
  const loader = routeLoaders.get(normalizedPath)

  if (!loader || loadedRoutes.has(normalizedPath)) {
    return
  }

  loadedRoutes.add(normalizedPath)
  void loader().catch(() => {
    loadedRoutes.delete(normalizedPath)
  })
}

function normalizeRoutePath(path: string) {
  const [pathname] = path.split('?')

  if (pathname === '/') {
    return '/'
  }

  const [, firstSegment] = pathname.split('/')

  if (!firstSegment) {
    return '/'
  }

  const basePath = `/${firstSegment}`

  if (basePath === '/army-list') {
    return '/army-lists'
  }

  if (basePath === '/faction') {
    return '/faction-detail'
  }

  if (basePath === '/game') {
    return '/games'
  }

  if (basePath === '/mission') {
    return '/mission-detail'
  }

  if (basePath === '/player') {
    return '/player-detail'
  }

  if (basePath === '/players' && pathname !== '/players') {
    return '/player-detail'
  }

  if (basePath === '/factions' && pathname !== '/factions') {
    return '/faction-detail'
  }

  if (basePath === '/missions' && pathname !== '/missions') {
    return '/mission-detail'
  }

  return basePath
}
