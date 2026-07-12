import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.join(process.cwd(), 'dist')
const port = Number(process.env.PORT || 4191)
const baseUrl = process.env.BASE_URL || `http://127.0.0.1:${port}`
const eventId = 'event-current-league'
const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}

const routes = [
  {
    actualRoute: `/event/${eventId}`,
    activeLabel: 'Overview',
    component: 'EventHome',
    expectedRoute: `/event/${eventId}`,
    item: 'Overview',
    requiredText: ['July 2026 League'],
    rejectedText: ['Chronological Event History'],
    selector: 'main.event-overview-shell',
  },
  {
    actualRoute: `/event/${eventId}/registration`,
    activeLabel: 'Registration',
    component: 'EventHome registration',
    expectedRoute: `/event/${eventId}/registration`,
    item: 'Registration',
    requiredText: ['Registration'],
    rejectedText: ['Season Progress', 'Chronological Event History'],
    selector: 'main[data-event-section="registration"]',
  },
  {
    actualRoute: `/match-finder?eventId=${eventId}`,
    activeLabel: 'Match Finder',
    component: 'MatchFinder',
    expectedRoute: `/match-finder?eventId=${eventId}`,
    item: 'Match Finder',
    requiredText: ['Match Finder'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: `/submit-game?eventId=${eventId}&gameType=event`,
    activeLabel: 'Submit Game',
    component: 'SubmitResult',
    expectedRoute: `/submit-game?eventId=${eventId}&gameType=event`,
    item: 'Submit Game',
    requiredText: ['Submit Game'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: `/standings?eventId=${eventId}`,
    activeLabel: 'Standings',
    component: 'Standings',
    expectedRoute: `/standings?eventId=${eventId}`,
    item: 'Standings',
    requiredText: ['Standings'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: `/schedule?eventId=${eventId}`,
    activeLabel: 'Schedule',
    component: 'Schedule',
    expectedRoute: `/schedule?eventId=${eventId}`,
    item: 'Schedule',
    requiredText: ['Schedule', 'Upcoming Matches'],
    rejectedText: ['Chronological Event History', 'Chronological League History'],
    selector: 'main[data-page="schedule"]',
  },
  {
    actualRoute: `/players?eventId=${eventId}`,
    activeLabel: 'Players',
    component: 'Players',
    expectedRoute: `/players?eventId=${eventId}`,
    item: 'Players',
    requiredText: ['Players'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: `/factions?eventId=${eventId}`,
    activeLabel: 'Factions',
    component: 'Factions',
    expectedRoute: `/factions?eventId=${eventId}`,
    item: 'Factions',
    requiredText: ['Faction Headquarters'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: `/analytics?eventId=${eventId}`,
    activeLabel: 'Statistics',
    component: 'Analytics',
    expectedRoute: `/analytics?eventId=${eventId}`,
    item: 'Statistics',
    requiredText: ['Event Statistics', 'Player Analytics', 'Faction Analytics', 'Mission Analytics'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: `/intelligence?eventId=${eventId}`,
    activeLabel: 'Intelligence',
    component: 'Intelligence',
    expectedRoute: `/intelligence?eventId=${eventId}`,
    item: 'Intelligence',
    requiredText: ['Event Intelligence', 'Hot Streaks', 'League Records', 'Mission Meta'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: `/rules?eventId=${eventId}`,
    activeLabel: 'Rules',
    component: 'Rules',
    expectedRoute: `/rules?eventId=${eventId}`,
    item: 'Rules',
    requiredText: ['The Lobo Infinity League'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: '/events',
    activeLabel: 'Past Events',
    component: 'PastEvents',
    expectedRoute: '/events',
    item: 'Past Events',
    requiredText: ['Past Events'],
    rejectedText: ['July 2026 League Schedule', 'Chronological Event History'],
    selector: 'main[data-page="past-events"]',
  },
]

function registrationEntry(name, status = 'Approved') {
  return {
    captain: false,
    discord: `${name}#0001`,
    displayName: name,
    email: '',
    eventId,
    faction: 'PanO',
    freeAgent: false,
    notes: 'Proving Grounds A',
    player: name,
    preferredTeam: '',
    registeredAt: '2026-07-01',
    role: 'Player',
    seed: '',
    status,
    team: '',
    updatedAt: '2026-07-01',
  }
}

const registration = {
  capacity: {
    maximumPlayers: 32,
    maximumTeams: 0,
    unlimited: false,
    waitlistEnabled: true,
  },
  captains: [],
  currentPlayer: registrationEntry('Lobo'),
  eventId,
  eventName: 'July 2026 League',
  eventType: 'League',
  freeAgents: [],
  registeredCount: 10,
  registrationOpen: true,
  registrationWindow: {
    endDate: '2026-07-20',
    startDate: '2026-07-01',
  },
  registrations: [registrationEntry('Lobo'), registrationEntry('FlashPulse')],
  status: 'Registration Open',
  teamCount: 0,
  teams: [],
  waitlistCount: 0,
}

const eventHomePayload = {
  success: true,
  home: {
    currentRound: { mission: 'Supremacy', name: 'Round 1' },
    event: {
      description: 'July league event workspace.',
      endDate: '2026-07-31',
      id: eventId,
      lifecycleStage: 'Round Active',
      name: 'July 2026 League',
      rules: 'League rules apply.',
      scoringModel: 'ITS',
      standingsModel: 'League Standings',
      startDate: '2026-07-01',
      status: 'Registration Open',
      type: 'League',
    },
    navigation: [],
    news: ['League news'],
    playerStatus: {
      captain: false,
      currentTeam: '',
      notifications: [],
      outstandingAction: 'Find a match.',
      registrationStatus: 'Approved',
      upcomingMatch: 'FlashPulse',
    },
    quickActions: [
      {
        action: 'matchFinder',
        enabled: true,
        href: `/match-finder?eventId=${eventId}`,
        label: 'Find Match',
      },
    ],
    registration,
    rounds: [{ mission: 'Supremacy', name: 'Round 1' }],
    statistics: {
      completedGames: 1,
      completionPercentage: 10,
      currentRound: 'Round 1',
      gamesRemaining: 9,
      lifecycleStage: 'Round Active',
      registeredPlayers: 10,
      registrationStatus: 'Registration Open',
      teams: 0,
    },
    timeline: [
      {
        body: 'Round opened.',
        timestamp: '2026-07-01',
        title: 'Round 1',
        type: 'Schedule',
      },
    ],
  },
}

const schedulingPayload = {
  success: true,
  scheduling: {
    activity: [],
    availability: {
      city: 'Jersey City',
      discordHandle: 'Lobo#0001',
      friday: '',
      homeStore: 'Lobo HQ',
      maxTravelDistance: '',
      monday: '',
      notes: '',
      player: 'Lobo',
      preferredDays: 'Saturday',
      preferredLocations: 'Lobo HQ',
      preferredTimes: 'Evening',
      saturday: '',
      status: 'Available',
      sunday: '',
      thursday: '',
      tuesday: '',
      updatedAt: '2026-07-01',
      wednesday: '',
    },
    commissioner: {
      behind: 0,
      division: 'Proving Grounds A',
      finished: 1,
      latePlayers: [],
      missingPairings: 0,
    },
    completedOpponents: [],
    currentSeason: 'July 2026 Season',
    event: eventHomePayload.home.event,
    eventId,
    opponents: [],
    player: {
      division: 'Proving Grounds A',
      displayName: 'Lobo',
      games: 0,
      losses: 0,
      op: 0,
      player: 'Lobo',
      rank: 1,
      tp: 0,
      vp: 0,
      wins: 0,
    },
    progress: {
      completionPercentage: 10,
      gamesCompleted: 1,
      gamesRemaining: 9,
      gamesRequired: 9,
      midseasonProgress: 0,
      opponentsCompleted: 0,
      opponentsRemaining: 9,
      seasonProgress: 10,
    },
    quickActions: [],
    recommendations: [],
    remainingOpponents: [],
    requests: {
      history: [],
      incoming: [],
      outgoing: [],
      pending: [
        {
          createdAt: '2026-07-01',
          eventId,
          fromPlayer: 'Lobo',
          id: 'req1',
          location: 'Lobo HQ',
          message: 'Round 1',
          proposedDate: '2026-07-12',
          proposedTime: '18:00',
          responseMessage: '',
          status: 'Pending',
          toPlayer: 'FlashPulse',
          updatedAt: '2026-07-01',
        },
      ],
      upcoming: [],
    },
    seasonProgress: {
      division: {
        completionPercentage: 10,
        gamesCompleted: 1,
        gamesRemaining: 9,
        players: 10,
      },
      league: [],
      player: {},
    },
  },
}

const standing = {
  displayName: 'Lobo',
  eventId,
  games: 3,
  losses: 1,
  op: 18,
  player: 'Lobo',
  rank: 1,
  tp: 8,
  vp: 520,
  wins: 2,
}

const playersPayload = {
  divisions: [
    {
      division: 'pga',
      divisionLabel: 'Proving Grounds A',
      eventId,
      standings: [
        standing,
        {
          ...standing,
          displayName: 'FlashPulse',
          games: 2,
          losses: 1,
          op: 12,
          player: 'FlashPulse',
          rank: 2,
          tp: 5,
          vp: 420,
          wins: 1,
        },
      ],
      summary: {
        activePlayers: 2,
        gamesPlayed: 3,
        leader: standing,
        players: 2,
      },
      success: true,
    },
  ],
  success: true,
}

const factionsPayload = {
  factions: [
    {
      averageOP: 6,
      averageTP: 2.5,
      averageVP: 210,
      divisionBreakdown: [
        { division: 'Proving Grounds A', games: 3 },
      ],
      games: 3,
      lastPlayed: '2026-07-10',
      losses: 1,
      name: 'PanOceania',
      topPlayer: 'Lobo',
      topPlayerDisplayName: 'Lobo',
      winRate: 66.67,
      wins: 2,
    },
  ],
  success: true,
}

const missionsPayload = {
  missions: [
    {
      averageOP: 6,
      averageTP: 2.5,
      averageVP: 210,
      firstTurnWinRate: 50,
      games: 3,
      lastPlayed: '2026-07-10',
      mission: 'Supremacy',
      mostSuccessfulFaction: 'PanOceania',
    },
  ],
  success: true,
}

const records = {
  highestScoringGame: {
    date: '2026-07-10',
    id: 1,
    loser: 'FlashPulse',
    loserDisplayName: 'FlashPulse',
    mission: 'Supremacy',
    story: 'Highest scoring test game.',
    value: 18,
    winner: 'Lobo',
    winnerDisplayName: 'Lobo',
  },
  largestOPMargin: {
    date: '2026-07-10',
    id: 1,
    loser: 'FlashPulse',
    loserDisplayName: 'FlashPulse',
    mission: 'Supremacy',
    story: 'Largest OP margin.',
    value: 6,
    winner: 'Lobo',
    winnerDisplayName: 'Lobo',
  },
  mostActiveFaction: {
    faction: 'PanOceania',
    games: 3,
    name: 'PanOceania',
    story: 'Most active faction.',
    type: 'faction',
  },
  mostActiveMission: {
    games: 3,
    name: 'Supremacy',
    story: 'Most active mission.',
    type: 'mission',
  },
}

const recordsPayload = {
  records,
  success: true,
}

const intelligencePayload = {
  biggestVictories: [records.largestOPMargin],
  closestGames: [records.highestScoringGame],
  factionMomentum: [
    {
      faction: 'PanOceania',
      games: 3,
      losses: 1,
      story: 'PanOceania is setting the early pace.',
      trend: 'Rising',
      wins: 2,
    },
  ],
  highestVPGames: [records.highestScoringGame],
  losingStreaks: [],
  missionTrends: [
    {
      firstTurnWinRate: 50,
      games: 3,
      averageOP: 6,
      averageTP: 2.5,
      averageVP: 210,
      mission: 'Supremacy',
      mostSuccessfulFaction: 'PanOceania',
      story: 'Supremacy remains contested.',
    },
  ],
  promotionBattle: [],
  recentUpsets: [],
  records,
  relegationBattle: [],
  success: true,
  winStreaks: [
    {
      displayName: 'Lobo',
      games: 2,
      player: 'Lobo',
      story: 'Lobo has momentum.',
    },
  ],
}

function createServer() {
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname)
    let file = path.normalize(path.join(root, pathname))

    if (!file.startsWith(root)) {
      response.writeHead(403)
      response.end('forbidden')
      return
    }

    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, 'index.html')
    }

    if (!fs.existsSync(file)) {
      file = path.join(root, 'index.html')
    }

    response.setHeader('Content-Type', contentTypes[path.extname(file)] ?? 'application/octet-stream')
    response.end(fs.readFileSync(file))
  })
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', resolve)
  })
}

async function run() {
  let server = null
  if (!process.env.BASE_URL) {
    if (!fs.existsSync(path.join(root, 'index.html'))) {
      throw new Error('dist/index.html not found. Run npm run build before the navigation check.')
    }

    server = createServer()
    await listen(server)
  }

  const failures = []
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.route('https://script.google.com/**', async (route) => {
    const url = new URL(route.request().url())
    const action = url.searchParams.get('action')

    if (action === 'eventHome') {
      await route.fulfill({
        body: JSON.stringify(eventHomePayload),
        contentType: 'application/json',
        status: 200,
      })
      return
    }

    if (action === 'schedulingCenter') {
      await route.fulfill({
        body: JSON.stringify(schedulingPayload),
        contentType: 'application/json',
        status: 200,
      })
      return
    }

    if (action === 'players') {
      await route.fulfill({
        body: JSON.stringify(playersPayload),
        contentType: 'application/json',
        status: 200,
      })
      return
    }

    if (action === 'factions') {
      await route.fulfill({
        body: JSON.stringify(factionsPayload),
        contentType: 'application/json',
        status: 200,
      })
      return
    }

    if (action === 'missions') {
      await route.fulfill({
        body: JSON.stringify(missionsPayload),
        contentType: 'application/json',
        status: 200,
      })
      return
    }

    if (action === 'records') {
      await route.fulfill({
        body: JSON.stringify(recordsPayload),
        contentType: 'application/json',
        status: 200,
      })
      return
    }

    if (action === 'intelligence') {
      await route.fulfill({
        body: JSON.stringify(intelligencePayload),
        contentType: 'application/json',
        status: 200,
      })
      return
    }

    await route.fulfill({
      body: JSON.stringify({ error: 'mocked navigation audit response', success: false }),
      contentType: 'application/json',
      status: 200,
    })
  })

  const report = []

  for (const route of routes) {
    const url = new URL(route.actualRoute, baseUrl).toString()
    await page.goto(url, { timeout: 60000, waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      (requiredText) => {
        const text = document.querySelector('main')?.textContent ?? ''
        return requiredText.every((item) => text.includes(item))
      },
      route.requiredText,
      { timeout: 10000 },
    ).catch(() => undefined)

    const mainText = await page.locator('main').innerText().catch(() => '')
    const normalizedMainText = mainText.toLowerCase()
    const pathname = await page.evaluate(() => `${window.location.pathname}${window.location.search}`)
    const activeLabels = await page.locator('.sidebar-button.active').allInnerTexts()
    const selectorFound = route.selector
      ? await page.locator(route.selector).count() > 0
      : true
    const missingText = route.requiredText.filter((text) => !normalizedMainText.includes(text.toLowerCase()))
    const rejectedText = route.rejectedText.filter((text) => normalizedMainText.includes(text.toLowerCase()))
    const routeMatches = pathname === route.expectedRoute
    const activeMatches = activeLabels.length === 1 && activeLabels[0] === route.activeLabel
    const pass =
      routeMatches &&
      selectorFound &&
      missingText.length === 0 &&
      rejectedText.length === 0 &&
      activeMatches

    report.push({
      actualRoute: pathname,
      component: route.component,
      expectedRoute: route.expectedRoute,
      item: route.item,
      pass,
    })

    console.log(
      [
        route.item,
        `expected=${route.expectedRoute}`,
        `actual=${pathname}`,
        `component=${route.component}`,
        `active=${activeLabels.join(',') || 'none'}`,
        pass ? 'PASS' : 'FAIL',
      ].join(' | '),
    )

    if (!routeMatches) {
      failures.push(`${route.item} route mismatch: expected ${route.expectedRoute}, got ${pathname}`)
    }

    if (!selectorFound) {
      failures.push(`${route.item} missing page marker: ${route.selector}`)
    }

    if (missingText.length > 0) {
      failures.push(`${route.item} missing visible text: ${missingText.join(', ')}; main=${mainText.slice(0, 220)}`)
    }

    if (rejectedText.length > 0) {
      failures.push(`${route.item} rendered wrong page text: ${rejectedText.join(', ')}`)
    }

    if (!activeMatches) {
      failures.push(`${route.item} active nav mismatch: ${activeLabels.join(', ') || 'none'}`)
    }
  }

  await browser.close()
  server?.close()

  if (failures.length > 0) {
    throw new Error(`League navigation check failed:\n${failures.join('\n')}`)
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
