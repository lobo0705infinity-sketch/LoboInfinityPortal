import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.join(process.cwd(), 'dist')
const port = 4187
const eventId = 'event-august-2026-team-tournament'
const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}

const routes = [
  {
    activeLabel: 'Registration',
    expectedSection: 'registration',
    path: 'registration',
    requiredText: ['Registration Status'],
  },
  {
    activeLabel: 'Teams',
    expectedSection: 'teams',
    path: 'teams',
    requiredText: ['Registered Teams'],
  },
  {
    activeLabel: 'Pairings',
    expectedSection: 'pairings',
    path: 'pairings',
    requiredText: ['Pairings'],
  },
  {
    activeLabel: 'Standings',
    expectedSection: 'standings',
    path: 'standings',
    requiredText: ['TEAM STANDINGS', 'Rankings'],
  },
  {
    activeLabel: 'Results',
    expectedSection: 'results',
    path: 'results',
    requiredText: ['LATEST RESULTS', 'Event Games'],
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
    freeAgent: true,
    notes: '',
    player: name,
    preferredTeam: '',
    registeredAt: '2026-08-01',
    role: 'Player',
    seed: '',
    status,
    team: '',
    updatedAt: '2026-08-01',
  }
}

const registration = {
  capacity: {
    maximumPlayers: 32,
    maximumTeams: 8,
    unlimited: false,
    waitlistEnabled: true,
  },
  captains: [registrationEntry('Lobo')],
  currentPlayer: null,
  eventId,
  eventName: 'August 2026 Team Tournament',
  eventType: 'Team Tournament',
  freeAgents: [registrationEntry('FlashPulse')],
  registeredCount: 5,
  registrationOpen: true,
  registrationWindow: {
    endDate: '2026-08-20',
    startDate: '2026-08-01',
  },
  registrations: [
    registrationEntry('Lobo'),
    registrationEntry('FlashPulse'),
    registrationEntry('JoshPosh'),
    registrationEntry('Chainsaw'),
    registrationEntry('Greyscale'),
  ],
  status: 'Registration Open',
  teamCount: 1,
  teams: [],
  waitlistCount: 0,
}

const teamTournamentPayload = {
  success: true,
  tournament: {
    champion: null,
    completedMatches: 1,
    currentRound: { name: 'Round 1' },
    event: {
      id: eventId,
      lifecycleStage: 'Round Active',
      name: 'August 2026 Team Tournament',
      standingsModel: 'Team Standings',
      status: 'Round Active',
      type: 'Team Tournament',
    },
    freeAgents: [registrationEntry('FlashPulse')],
    invitations: [],
    latestResults: [
      {
        bestMoment: 'Test',
        date: '2026-08-02',
        division: 'Team Tournament',
        eventId,
        firstTurn: 'Lobo',
        id: 1,
        loser: 'FlashPulse',
        loserDisplayName: 'FlashPulse',
        loserFaction: 'Nomads',
        mission: 'Supremacy',
        op: '8',
        tp: '3',
        vp: '200',
        winner: 'Lobo',
        winnerDisplayName: 'Lobo',
        winnerFaction: 'PanO',
      },
    ],
    news: ['Tournament news'],
    pairings: [
      {
        createdAt: '2026-08-01',
        eventId,
        playerPairings: 'Lobo vs FlashPulse',
        results: '',
        round: 'Round 1',
        roundId: 'r1',
        status: 'Published',
        teamA: 'OnlyPans',
        teamB: 'Jersey Devils',
        updatedAt: '2026-08-01',
      },
    ],
    quickActions: [],
    registeredTeams: 1,
    registration,
    resultStatuses: [
      {
        opponent: 'FlashPulse',
        player: 'Lobo',
        resultId: 'res1',
        round: 'Round 1',
        roundId: 'r1',
        status: 'Submitted',
        table: '1',
        teamA: 'OnlyPans',
        teamB: 'Jersey Devils',
      },
    ],
    standings: [
      {
        captain: 'Lobo',
        losses: 0,
        objectivePoints: 8,
        players: ['Lobo', 'FlashPulse', 'JoshPosh', 'Chainsaw', 'Greyscale'],
        rank: 1,
        strengthOfSchedule: 0,
        teamId: 't1',
        teamName: 'OnlyPans',
        tournamentPoints: 3,
        victoryPoints: 200,
        wins: 1,
      },
    ],
    status: 'Round Active',
    teams: [
      {
        captain: 'Lobo',
        createdAt: '2026-08-01',
        discordContact: 'Lobo#0001',
        eventId,
        factionRestrictions: '',
        logoUrl: '',
        players: 'Lobo, FlashPulse, JoshPosh, Chainsaw, Greyscale',
        status: 'Ready',
        teamId: 't1',
        teamName: 'OnlyPans',
        updatedAt: '2026-08-01',
      },
    ],
    timeline: [
      {
        body: 'Pairings published',
        timestamp: '2026-08-01',
        title: 'Round 1',
        type: 'Pairings',
      },
    ],
    tournamentResults: [],
    upcomingPairings: [],
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
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    throw new Error('dist/index.html not found. Run npm run build before the routing check.')
  }

  const server = createServer()
  await listen(server)

  const failures = []
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.route('https://script.google.com/**', async (route) => {
    const url = new URL(route.request().url())
    const action = url.searchParams.get('action')

    if (action === 'teamTournament') {
      await route.fulfill({
        body: JSON.stringify(teamTournamentPayload),
        contentType: 'application/json',
        status: 200,
      })
      return
    }

    await route.fulfill({
      body: JSON.stringify({ error: 'mocked non-tournament request', success: false }),
      contentType: 'application/json',
      status: 200,
    })
  })

  for (const route of routes) {
    const url = `http://127.0.0.1:${port}/event/${eventId}/tournament/${route.path}`
    await page.goto(url, { timeout: 60000, waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    const mainText = await page.locator('main').innerText()
    const mountedSections = await page
      .locator('main [data-tournament-section]')
      .evaluateAll((nodes) =>
        Array.from(new Set(nodes.map((node) => node.getAttribute('data-tournament-section') ?? ''))),
      )
    const activeLabels = await page.locator('.sidebar-button.active').allInnerTexts()

    const wrongSections = mountedSections.filter(
      (section) => section !== route.expectedSection,
    )
    const missingText = route.requiredText.filter((text) => !mainText.includes(text))
    const activeMatches = activeLabels.length === 1 && activeLabels[0] === route.activeLabel

    console.log(
      [
        route.path,
        `mounted=${mountedSections.join(',')}`,
        `active=${activeLabels.join(',')}`,
        `required=${route.requiredText.join(',')}`,
      ].join(' | '),
    )

    if (wrongSections.length > 0) {
      failures.push(`${route.path} mounted wrong sections: ${wrongSections.join(', ')}`)
    }

    if (missingText.length > 0) {
      failures.push(`${route.path} missing visible text: ${missingText.join(', ')}`)
    }

    if (!activeMatches) {
      failures.push(`${route.path} active nav mismatch: ${activeLabels.join(', ') || 'none'}`)
    }
  }

  await page.goto(`http://127.0.0.1:${port}/event/${eventId}/tournament/registration`, {
    timeout: 60000,
    waitUntil: 'networkidle',
  })
  await page.goto(`http://127.0.0.1:${port}/event/${eventId}/tournament/teams`, {
    timeout: 60000,
    waitUntil: 'networkidle',
  })
  await page.goto(`http://127.0.0.1:${port}/event/${eventId}/tournament/pairings`, {
    timeout: 60000,
    waitUntil: 'networkidle',
  })

  await page.goBack({ timeout: 60000, waitUntil: 'networkidle' })
  const backActive = await page.locator('.sidebar-button.active').allInnerTexts()
  if (backActive.length !== 1 || backActive[0] !== 'Teams') {
    failures.push(`browser back active nav mismatch: ${backActive.join(', ') || 'none'}`)
  }

  await page.goForward({ timeout: 60000, waitUntil: 'networkidle' })
  const forwardActive = await page.locator('.sidebar-button.active').allInnerTexts()
  if (forwardActive.length !== 1 || forwardActive[0] !== 'Pairings') {
    failures.push(`browser forward active nav mismatch: ${forwardActive.join(', ') || 'none'}`)
  }

  await browser.close()
  server.close()

  if (failures.length > 0) {
    throw new Error(`Team Tournament routing check failed:\n${failures.join('\n')}`)
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
