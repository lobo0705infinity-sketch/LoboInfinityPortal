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
    component: 'EventHome',
    expectedRoute: `/event/${eventId}`,
    item: 'Overview',
    requiredText: ['July 2026 League'],
    rejectedText: ['Chronological Event History'],
    selector: 'main.event-overview-shell',
  },
  {
    actualRoute: `/event/${eventId}/registration`,
    component: 'EventHome registration',
    expectedRoute: `/event/${eventId}/registration`,
    item: 'Registration',
    requiredText: ['Registration'],
    rejectedText: ['Season Progress', 'Chronological Event History'],
    selector: 'main[data-event-section="registration"]',
  },
  {
    actualRoute: `/match-finder?eventId=${eventId}`,
    component: 'MatchFinder',
    expectedRoute: `/match-finder?eventId=${eventId}`,
    item: 'Match Finder',
    requiredText: ['Match Finder'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: `/event/${eventId}/submit-result`,
    component: 'SubmitResult',
    expectedRoute: `/event/${eventId}/submit-result`,
    item: 'Submit Result',
    requiredText: ['Submit Result'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: `/standings?eventId=${eventId}`,
    component: 'Standings',
    expectedRoute: `/standings?eventId=${eventId}`,
    item: 'Standings',
    requiredText: ['Standings'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: `/schedule?eventId=${eventId}`,
    component: 'Schedule',
    expectedRoute: `/schedule?eventId=${eventId}`,
    item: 'Schedule',
    requiredText: ['Schedule', 'Upcoming Matches'],
    rejectedText: ['Chronological Event History', 'Chronological League History'],
    selector: 'main[data-page="schedule"]',
  },
  {
    actualRoute: `/players?eventId=${eventId}`,
    component: 'Players',
    expectedRoute: `/players?eventId=${eventId}`,
    item: 'Players',
    requiredText: ['Players'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: `/factions?eventId=${eventId}`,
    component: 'Factions',
    expectedRoute: `/factions?eventId=${eventId}`,
    item: 'Factions',
    requiredText: ['Faction Headquarters'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: `/analytics?eventId=${eventId}`,
    component: 'Analytics',
    expectedRoute: `/analytics?eventId=${eventId}`,
    item: 'Statistics',
    requiredText: ['Intelligence'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: `/rules?eventId=${eventId}`,
    component: 'Rules',
    expectedRoute: `/rules?eventId=${eventId}`,
    item: 'Rules',
    requiredText: ['Rules'],
    rejectedText: ['Chronological Event History'],
  },
  {
    actualRoute: '/events',
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
    const pathname = await page.evaluate(() => `${window.location.pathname}${window.location.search}`)
    const activeLabels = await page.locator('.sidebar-button.active').allInnerTexts()
    const selectorFound = route.selector
      ? await page.locator(route.selector).count() > 0
      : true
    const missingText = route.requiredText.filter((text) => !mainText.includes(text))
    const rejectedText = route.rejectedText.filter((text) => mainText.includes(text))
    const routeMatches = pathname === route.expectedRoute
    const pass = routeMatches && selectorFound && missingText.length === 0 && rejectedText.length === 0

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
      failures.push(`${route.item} missing visible text: ${missingText.join(', ')}`)
    }

    if (rejectedText.length > 0) {
      failures.push(`${route.item} rendered wrong page text: ${rejectedText.join(', ')}`)
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
