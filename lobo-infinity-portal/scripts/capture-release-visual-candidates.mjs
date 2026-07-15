import { mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import http from 'node:http'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { currentGitState, fail, pass, repoRoot } from './release-utils.mjs'

let baseUrl = process.env.VISUAL_BASE_URL || ''
const state = currentGitState()
const outputDir = resolve(repoRoot, '.release-artifacts', 'visual-candidates', state.commit)
mkdirSync(outputDir, { recursive: true })
const staticServer = baseUrl ? null : await startStaticServer()
baseUrl = baseUrl || staticServer.baseUrl

const player = 'Lobo'
const now = '2026-07-15T12:00:00.000Z'

const surfaces = [
  { name: 'commissioner-sidebar-desktop', route: '/commissioner', width: 1440, height: 1000 },
  { name: 'my-profile-desktop', route: '/profile', width: 1440, height: 1200 },
  { name: 'my-profile-mobile', route: '/profile', width: 390, height: 1000 },
  { name: 'dashboard-desktop', route: '/', width: 1440, height: 1000 },
  { name: 'players-desktop', route: '/players', width: 1440, height: 1000 },
  { name: 'submit-game-desktop', route: '/submit-game', width: 1440, height: 1000 },
  { name: 'submit-army-list-desktop', route: '/army-lists/submit', width: 1440, height: 1000 },
  { name: 'events-desktop', route: '/events', width: 1440, height: 1000 },
  { name: 'commissioner-system-desktop', route: '/commissioner/system', width: 1440, height: 1000 },
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
await context.addInitScript(() => {
  window.localStorage.setItem(
    'lobo-google-id-token',
    'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJlbWFpbCI6InJldmlld0Bsb2JvLmxvY2FsIiwibmFtZSI6IkxvYm8iLCJhdWQiOiJjYW5kaWRhdGUtY2xpZW50IiwiaWF0IjoxNzg0MTEwODAwLCJleHAiOjE3ODQxMTQ0MDB9.signature',
  )
})

await context.route('**/exec**', async (route) => {
  const request = route.request()
  const url = new URL(request.url())
  let action = url.searchParams.get('action') || ''

  if (request.method() === 'POST') {
    const body = new URLSearchParams(request.postData() || '')
    action = action || body.get('action') || ''
  }

  await route.fulfill({
    body: JSON.stringify(mockResponse(action)),
    contentType: 'application/json',
    status: 200,
  })
})

const failures = []

for (const surface of surfaces) {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: surface.width, height: surface.height })

  try {
    const response = await page.goto(new URL(surface.route, baseUrl).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)
    await page.waitForTimeout(500)
    const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')

    if (!response || response.status() >= 400) {
      failures.push(`${surface.name} returned HTTP ${response ? response.status() : 'none'}`)
    }
    if (errors.length) {
      failures.push(`${surface.name} runtime errors: ${errors.join('; ')}`)
    }
    if (text.trim().length < 40) {
      failures.push(`${surface.name} rendered an empty or nearly empty shell.`)
    }

    const screenshotPath = resolve(outputDir, `${surface.name}.png`)
    writeFileSync(screenshotPath, await page.screenshot({ fullPage: true }))
  } catch (error) {
    failures.push(`${surface.name}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await page.close()
  }
}

await context.close()
await browser.close()
await staticServer?.close()

if (failures.length) {
  fail('candidate visual capture failed', failures)
}

pass(`candidate visual screenshots captured in ${outputDir}`)

function mockResponse(action) {
  switch (action) {
    case 'settings':
      return { success: true, settings: settings() }
    case 'session':
      return session()
    case 'myProfile':
      return profile()
    case 'dashboard':
      return dashboard()
    case 'home':
      return home()
    case 'players':
      return { success: true, divisions: standingsDivisions() }
    case 'standings':
      return { success: true, ...standingsDivisions()[0] }
    case 'events':
      return events()
    case 'armyLists':
      return { success: true, lists: [armyList()], community: {} }
    case 'eventRegistration':
      return eventRegistration()
    case 'communityCommandCenter':
      return commandCenter()
    case 'operations':
    case 'reliability':
      return { success: true }
    case 'automation':
      return automation()
    default:
      return { success: true, items: [], records: [], results: [] }
  }
}

function settings() {
  return {
    currentSeason: 'Lobo Infinity League 2026',
    leagueName: 'Lobo Infinity League',
    googleFormUrl: '',
    discordInvite: '',
    leagueWebsite: '',
    submissionEnabled: 'TRUE',
    submissionButtonText: 'Submit Game',
    submissionButtonVisible: 'TRUE',
    bannerImage: '',
    leagueLogo: '',
    commissionerContact: 'commissioner@lobo.local',
    themeAccentColor: '#2f7dd1',
    seasonStartDate: '2026-07-01',
    seasonEndDate: '2026-09-30',
    registrationOpen: 'TRUE',
    googleOAuthClientId: 'candidate-client',
    commissionerEmails: 'review@lobo.local',
    portalVersion: 'candidate',
    gitCommit: state.commit,
    deploymentUrl: baseUrl,
  }
}

function session() {
  return {
    success: true,
    authenticated: true,
    code: 'AUTH_OK',
    diagnostics: {},
    error: '',
    oauthConfigured: true,
    permissions: {
      manageCache: true,
      manageNews: true,
      manageSettings: true,
      readPortal: true,
      runLeagueAudit: true,
      runSeasonControl: true,
      submitLists: true,
      updateProfile: true,
      viewOperations: true,
      vote: true,
    },
    stage: 'candidate',
    user: portalUser(),
  }
}

function portalUser() {
  return {
    archivedAlerts: [],
    avatarUrl: '',
    canonicalPlayer: player,
    created: '2026-07-01',
    discordName: 'Lobo#0001',
    dismissedAlerts: [],
    displayName: 'Lobo',
    email: 'review@lobo.local',
    enabled: true,
    eventRegistrations: [
      {
        eventId: 'league-2026',
        eventName: 'Lobo Infinity League 2026',
        eventRole: 'Player',
        eventType: 'League',
        preferredTeam: '',
        registeredAt: '2026-07-01',
        registration: { eventName: 'Lobo Infinity League 2026', eventType: 'League', status: 'Approved' },
        status: 'Approved',
        team: '',
        updatedAt: now,
      },
    ],
    favoriteFaction: 'O-12',
    lastLogin: now,
    lastPage: '/profile',
    lastSeen: now,
    leagueDivision: 'Main Man',
    leaguePlayer: player,
    notificationPreferences: {},
    playerDisplayName: 'Lobo',
    profileVisibility: 'Public',
    readAlerts: [],
    role: 'Commissioner',
    searchHistory: [],
    themePreference: 'system',
  }
}

function profile() {
  return {
    success: true,
    profile: {
      achievements: [],
      careerStatistics: stats(),
      currentSeasonStatistics: stats(),
      futureSections: [],
      intelligence: {},
      leaguePerformance: {},
      leagueStatistics: playerRecord(),
      recentActivity: [],
      recentGames: [recentGame()],
      submittedLists: [armyList()],
      user: portalUser(),
      votesCast: 2,
    },
  }
}

function dashboard() {
  return {
    success: true,
    activePlayers: 32,
    gamesPlayed: 48,
    leader: standing(1, player),
    leagueOverview: {
      currentSeason: 'Lobo Infinity League 2026',
      divisions: standingsDivisions(),
      recentGames: [recentGame()],
      seasonProgress: { completedGames: 48, targetGames: 144 },
    },
    mainManStandings: standings(),
    topFaction: 'O-12',
  }
}

function home() {
  return {
    success: true,
    allStandings: standingsDivisions(),
    armyListCommunity: {},
    armyLists: [armyList()],
    dashboard: dashboard(),
    hallOfFame: null,
    intelligence: null,
    news: [],
    quickStats: { activePlayers: 32, armyLists: 1, games: 48, news: 0, recentGames: 1, streams: 0 },
    recentGames: [recentGame()],
    records: {},
    settings: settings(),
    streams: [],
  }
}

function events() {
  return {
    success: true,
    events: [
      {
        active: true,
        eventId: 'league-2026',
        eventName: 'Lobo Infinity League 2026',
        eventType: 'League',
        registrationOpen: true,
        status: 'Active',
      },
    ],
  }
}

function eventRegistration() {
  return {
    success: true,
    registration: {
      currentPlayer: portalUser().eventRegistrations[0],
      eventName: 'Lobo Infinity League 2026',
      freeAgents: [],
      registeredCount: 32,
      registrationOpen: true,
      registrations: portalUser().eventRegistrations,
      status: 'Approved',
      teamCount: 0,
      teams: [],
      waitlistCount: 0,
    },
  }
}

function commandCenter() {
  return {
    success: true,
    commandCenter: {
      activeEvents: [],
      communityActivity: {},
      eventSwitcher: [],
      intelligence: [],
      matchRequests: {},
      nudgeEngine: [],
      nextActions: [],
      opponentTracker: {},
      promotion: {},
      quickActions: [],
      schedule: {},
      today: [],
      welcome: { currentActiveEvents: 1, currentDivision: 'Main Man' },
    },
  }
}

function automation() {
  return {
    success: true,
    events: [],
    jobs: [],
    queue: [],
    rules: [],
    templates: [],
  }
}

function standingsDivisions() {
  return [
    {
      division: 'main',
      divisionLabel: 'Main Man',
      event: { id: 'league-2026', name: 'Lobo Infinity League 2026' },
      eventId: 'league-2026',
      standings: standings(),
      summary: {
        activePlayers: 3,
        gamesPlayed: 9,
        leader: standing(1, player),
        players: 3,
      },
    },
  ]
}

function standings() {
  return [
    standing(1, player),
    standing(2, 'Rival One'),
    standing(3, 'Rival Two'),
  ]
}

function standing(rank, name) {
  return {
    displayName: name,
    division: 'Main Man',
    draws: 1,
    eventId: 'league-2026',
    favoriteArmy: 'O-12',
    faction: 'O-12',
    games: 6,
    losses: rank === 1 ? 1 : 3,
    op: rank === 1 ? 18 : 10,
    player: name,
    rank,
    tp: rank === 1 ? 14 : 8,
    vp: rank === 1 ? 412 : 300,
    winRate: rank === 1 ? 0.67 : 0.33,
    wins: rank === 1 ? 4 : 2,
  }
}

function playerRecord() {
  return {
    ...standing(1, player),
    bestFaction: 'O-12',
    bestMission: 'Supplies',
    favoriteFaction: 'O-12',
    favoriteMission: 'Supplies',
    firstTurnGames: 3,
    firstTurnWinRate: 0.67,
    name: player,
    nemesis: 'Rival Two',
    rival: 'Rival One',
    secondTurnGames: 3,
    secondTurnWinRate: 0.67,
  }
}

function stats() {
  return {
    draws: 1,
    games: 6,
    losses: 1,
    objectivePoints: 18,
    tournamentPoints: 14,
    victoryPoints: 412,
    winPercentage: 67,
    wins: 4,
  }
}

function recentGame() {
  return {
    bestMoment: 'Held the center and secured promotion pressure.',
    date: '2026-07-12',
    division: 'Main Man',
    eventId: 'league-2026',
    firstTurn: player,
    gameResult: 'Win',
    gameType: 'League',
    id: 101,
    loser: 'Rival One',
    loserDisplayName: 'Rival One',
    loserFaction: 'Nomads',
    mission: 'Supplies',
    op: '4',
    tp: '3',
    vp: '88',
    winner: player,
    winnerDisplayName: player,
    winnerFaction: 'O-12',
  }
}

function armyList() {
  return {
    approved: true,
    armyCode: 'candidate',
    armyLink: '',
    armyName: 'Candidate Operations Group',
    description: 'Candidate baseline list.',
    downvotes: 0,
    event: 'Lobo Infinity League 2026',
    faction: 'O-12',
    id: 101,
    mission: 'Supplies',
    player,
    playerDisplayName: player,
    score: 5,
    sectorial: 'Starmada',
    submissionDate: '2026-07-10',
    submitterEmail: 'review@lobo.local',
    upvotes: 5,
  }
}

async function startStaticServer() {
  const distRoot = resolve(repoRoot, 'dist')
  const contentTypes = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
  }
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url || '/', 'http://localhost').pathname
      const relativePath =
        pathname === '/' || !pathname.split('/').at(-1)?.includes('.')
          ? '/index.html'
          : pathname
      const filePath = resolve(distRoot, `.${relativePath}`)
      const body = await readFile(filePath).catch(() => readFile(resolve(distRoot, 'index.html')))
      const extension = filePath.slice(filePath.lastIndexOf('.'))
      response.writeHead(200, {
        'content-type': contentTypes[extension] || 'application/octet-stream',
      })
      response.end(body)
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain' })
      response.end(error instanceof Error ? error.message : String(error))
    }
  })

  await new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  }
}
