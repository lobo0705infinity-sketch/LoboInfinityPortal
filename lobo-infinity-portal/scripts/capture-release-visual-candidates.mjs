import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import http from 'node:http'
import { resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { chromium } from 'playwright'
import { currentGitState, fail, pass, repoRoot } from './release-utils.mjs'

let baseUrl = process.env.VISUAL_BASE_URL || ''
const state = currentGitState()
const outputDir = resolve(repoRoot, '.release-artifacts', 'visual-candidates', state.commit)
const baselineDir = resolve(repoRoot, 'tests', 'visual-baselines')
mkdirSync(outputDir, { recursive: true })
mkdirSync(baselineDir, { recursive: true })
const staticServer = baseUrl ? null : await startStaticServer()
baseUrl = baseUrl || staticServer.baseUrl
const compareBaselines = process.env.VISUAL_COMPARE_BASELINES === '1'
const updateBaselines = process.env.UPDATE_VISUAL_BASELINES === '1'

const player = 'Lobo'
const now = '2026-07-15T12:00:00.000Z'
const leagueName = 'July 2026 League'
const preferredArmy = 'Operations Subsection'
const fixtureToken =
  'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJlbWFpbCI6InJldmlld0Bsb2JvLmxvY2FsIiwibmFtZSI6IkxvYm8iLCJhdWQiOiJjYW5kaWRhdGUtY2xpZW50IiwiaWF0IjoxNzg0MTEwODAwLCJleHAiOjE3ODQxMTQ0MDB9.signature'

const surfaces = [
  {
    forbidden: ['API response is missing summary.', 'Operations error'],
    markers: ['Command Center', 'Events', 'Players', 'Automation', 'System'],
    name: 'commissioner-sidebar-desktop',
    route: '/commissioner',
    width: 1440,
    height: 1000,
  },
  {
    markers: [leagueName, 'Main Man', '#2', '#2 of 10', '2-0', 'Safe', preferredArmy, '2 Wins'],
    name: 'my-profile-desktop-dashboard',
    route: '/profile',
    screenshot: 'viewport',
    width: 1440,
    height: 1050,
  },
  {
    markers: ['Last Five League Games', 'Featured Battle Story', 'Edit Profile', preferredArmy],
    name: 'my-profile-desktop-analytics-settings',
    route: '/profile',
    hideAppChrome: true,
    scrollTo: '.my-profile-v3-support',
    screenshot: 'viewport',
    width: 1440,
    height: 1050,
  },
  {
    markers: [leagueName, 'Main Man', '#2', '#2 of 10', '2-0', 'Safe', 'Current Season'],
    name: 'my-profile-mobile-dashboard',
    route: '/profile',
    hideAppChrome: true,
    screenshotSelector: '.my-profile-v3-dashboard',
    width: 390,
    height: 844,
  },
  {
    markers: ['Featured Battle Story', 'Edit Profile', preferredArmy],
    name: 'my-profile-mobile-analytics-settings',
    route: '/profile',
    hideAppChrome: true,
    screenshotSelector: '.profile-editor-panel',
    width: 390,
    height: 844,
  },
  { name: 'dashboard-desktop', route: '/', width: 1440, height: 1000 },
  { name: 'players-desktop', route: '/players', width: 1440, height: 1000 },
  { name: 'submit-game-desktop', route: '/submit-game', width: 1440, height: 1000 },
  { name: 'submit-army-list-desktop', route: '/army-lists/submit', width: 1440, height: 1000 },
  { name: 'events-desktop', route: '/events', width: 1440, height: 1000 },
  { name: 'commissioner-system-desktop', route: '/commissioner/system', width: 1440, height: 1000 },
].filter(includeSurface)

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
await context.addInitScript((token) => {
  window.localStorage.setItem(
    'lobo-google-id-token',
    token,
  )
}, fixtureToken)

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
    surface.markers?.forEach((marker) => {
      if (!text.includes(marker)) {
        failures.push(`${surface.name} missing deterministic profile marker: ${marker}`)
      }
    })
    surface.forbidden?.forEach((marker) => {
      if (text.includes(marker)) {
        failures.push(`${surface.name} rendered forbidden text: ${marker}`)
      }
    })

    if (surface.hideAppChrome) {
      await page.addStyleTag({
        content: `
          .portal-header,
          .mobile-submit-fab {
            display: none !important;
          }
        `,
      })
    }
    if (surface.scrollTo) {
      await page.locator(surface.scrollTo).waitFor({ state: 'visible', timeout: 5000 })
      await page.evaluate((selector) => {
        document.querySelector(selector)?.scrollIntoView({ block: 'start' })
      }, surface.scrollTo)
      await page.waitForTimeout(250)
    }
    const screenshotPath = resolve(outputDir, `${surface.name}.png`)
    let screenshot
    if (surface.screenshotSelector) {
      const region = page.locator(surface.screenshotSelector).first()
      await region.scrollIntoViewIfNeeded({ timeout: 5000 })
      await page.waitForTimeout(250)
      screenshot = await region.screenshot()
    } else {
      screenshot = await page.screenshot({ fullPage: surface.screenshot !== 'viewport' })
    }
    writeFileSync(screenshotPath, screenshot)

    if (updateBaselines) {
      writeFileSync(resolve(baselineDir, `${surface.name}.png`), screenshot)
    } else if (compareBaselines) {
      const baselinePath = resolve(baselineDir, `${surface.name}.png`)
      if (!existsSync(baselinePath)) {
        failures.push(`${surface.name} has no approved visual baseline.`)
      } else {
        const comparison = comparePng(readFileSync(baselinePath), screenshot)
        if (!comparison.passed) {
          failures.push(
            `${surface.name} differs from approved visual baseline: ${comparison.message}`,
          )
        }
      }
    }
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

pass(`${compareBaselines ? 'visual regression check passed' : 'candidate visual screenshots captured'} in ${outputDir}`)

function includeSurface(surface) {
  const requested = (process.env.VISUAL_CANDIDATE_SURFACES || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  const approvedReleaseSurfaces = [
    'commissioner-sidebar-desktop',
    'my-profile-desktop-dashboard',
    'my-profile-desktop-analytics-settings',
    'my-profile-mobile-dashboard',
    'my-profile-mobile-analytics-settings',
  ]

  if (requested.length > 0) {
    return requested.includes(surface.name)
  }

  return !compareBaselines || approvedReleaseSurfaces.includes(surface.name)
}

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
    case 'operationsSummary':
    case 'operations':
    case 'operationsIdentity':
    case 'operationsContent':
    case 'operationsLifecycle':
    case 'operationsDiscord':
    case 'operationsNotifications':
      return operations()
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
    currentSeason: leagueName,
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
        eventId: 'july-2026-league',
        eventName: leagueName,
        eventRole: 'Player',
        eventType: 'League',
        preferredTeam: '',
        registeredAt: '2026-07-01',
        registration: { eventName: leagueName, eventType: 'League', status: 'Approved' },
        status: 'Approved',
        team: '',
        updatedAt: now,
      },
    ],
    favoriteFaction: preferredArmy,
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
      leaguePerformance: {
        currentStreak: '2 Wins',
        longestStreak: '2 Wins',
        recentForm: 'WW',
      },
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
    activePlayers: 10,
    gamesPlayed: 48,
    leader: standing(1, 'League Leader'),
    leagueOverview: {
      currentSeason: leagueName,
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
        eventId: 'july-2026-league',
        eventName: leagueName,
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
      eventName: leagueName,
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

function operations() {
  const auditSummary = { critical: 0, informational: 2, warning: 0 }
  const discord = {
    adminChannel: '#commissioners',
    announcementChannel: '#announcements',
    automationEvents: ['round-open', 'standings-published'],
    configured: true,
    enabled: true,
    failures: 0,
    lastAutomationRun: now,
    lastResult: null,
    log: [],
    preview: {
      content: 'July 2026 League status is healthy.',
      embeds: [],
      event: 'standings-published',
      label: 'Standings update',
    },
    queueDepth: 0,
    rateLimitPerHour: 12,
    retryLimit: 2,
    webhookMasked: 'https://discord.com/api/webhooks/.../candidate',
  }

  return {
    success: true,
    alerts: [],
    audit: { issues: [], summary: auditSummary },
    discord,
    eventLifecycle: eventLifecycle(),
    identity: {
      audits: [],
      records: [
        {
          brokenMapping: false,
          displayName: player,
          division: 'Main Man',
          duplicateEmail: false,
          duplicatePlayer: false,
          enabled: true,
          googleEmail: 'review@lobo.local',
          id: 'review@lobo.local',
          lastLogin: now,
          lastSeen: now,
          linked: true,
          missingEmail: false,
          neverLoggedIn: false,
          player,
          portalUser: player,
          role: 'Commissioner',
        },
      ],
    },
    news: [],
    pendingArmyLists: [armyList()],
    players: standings().map((standing) => ({
      displayName: standing.displayName,
      division: standing.division,
      games: standing.games,
      player: standing.player,
      rank: standing.rank,
    })),
    settings: settings(),
    streams: [],
    summary: {
      cacheStatus: {
        cacheAge: '45 seconds',
        entries: [],
        lastRefresh: now,
        performance: {
          averageApiResponse: '92ms',
          cacheHitRate: 0.98,
          totalCacheRefreshes: 4,
        },
        status: 'Healthy',
        version: state.commit.slice(0, 7),
      },
      deploymentStatus: {
        appsScriptVersion: 'candidate',
        checkedAt: now,
        deploymentUrl: baseUrl,
        gitCommit: state.commit,
        portalVersion: 'candidate',
      },
      discordStatus: discord,
      identityStatus: {
        assistantUsers: 1,
        commissionerUsers: 1,
        disabledUsers: 0,
        enabledUsers: 1,
        linkedUsers: 1,
        playersWithEmail: 10,
        playersWithoutEmail: 0,
        playersWithoutUser: 9,
        totalUsers: 1,
        unlinkedUsers: 0,
      },
      leagueAuditSummary: auditSummary,
      leagueStatistics: {
        activePlayers: 10,
        factions: 8,
        games: 12,
        missions: 5,
      },
      notificationStatus: {
        highPriority: 0,
        normalPriority: 2,
        total: 2,
      },
      pendingArmyLists: 1,
      pendingNews: 0,
      pendingStreams: 0,
      recentMatchSubmissions: [recentGame()],
      seasonStatus: {
        currentSeasonName: leagueName,
        endDate: '2026-09-30',
        matchesPlayed: 12,
        registrationOpen: true,
        remainingMatches: 38,
        startDate: '2026-07-01',
        weeksCompleted: 2,
      },
      systemHealth: {
        api: 'Healthy',
        cache: 'Healthy',
        identity: 'Healthy',
        release: 'Candidate',
      },
    },
    timeline: [],
  }
}

function eventLifecycle() {
  return {
    auditLog: [],
    automation: {
      destinations: ['portal'],
      enabled: true,
      eventType: 'League',
      template: {
        body: 'Round status updated for July 2026 League.',
        enabled: true,
        title: 'League update',
      },
    },
    currentRound: 'Round 2',
    currentSeason: leagueName,
    currentStage: 'active',
    discord: {
      configured: true,
      enabled: true,
      preview: {
        content: 'July 2026 League is active.',
        embeds: [],
        event: 'round-open',
        label: 'Round open',
      },
      status: 'Healthy',
      webhookMasked: 'https://discord.com/api/webhooks/.../candidate',
    },
    endDate: '2026-09-30',
    event: {
      achievements: 'Enabled',
      archive: '',
      automation: 'Enabled',
      commissioners: 'review@lobo.local',
      communityId: 'lobo-infinity',
      createdAt: '2026-07-01',
      description: 'Deterministic release candidate fixture.',
      discord: 'Enabled',
      endDate: '2026-09-30',
      history: '',
      id: 'july-2026-league',
      lifecycleStage: 'active',
      name: leagueName,
      owner: 'Lobo Infinity League',
      participants: '10',
      registration: 'Open',
      rules: 'ITS',
      scoringModel: 'League',
      seriesId: 'july-2026',
      standingsModel: 'Divisions',
      startDate: '2026-07-01',
      status: 'Active',
      templateId: 'league',
      type: 'League',
      updatedAt: now,
    },
    health: {
      automationHealth: 'Healthy',
      discordStatus: 'Healthy',
      gamesCompleted: 12,
      gamesRemaining: 38,
      latePlayers: [],
      missingPairings: 0,
      participants: 10,
      playersWithoutIdentity: 0,
      registrationProgress: '10 of 10 approved',
      rounds: 5,
    },
    nextTransition: {
      available: true,
      blockedReason: '',
      confirmationBody: ['Advance the fixture event to the next round.'],
      confirmationTitle: 'Advance event',
      label: 'Advance to next round',
      repairAction: '',
      targetStage: 'round-3',
    },
    participants: 10,
    registration: 'Open',
    rollback: {
      available: true,
      label: 'Rollback to previous round',
      reason: '',
      targetStage: 'round-1',
    },
    rounds: 5,
    startDate: '2026-07-01',
    status: 'Active',
    supportedStages: ['registration', 'active', 'complete'],
    validation: {
      blockingIssues: [],
      color: 'green',
      healthScore: 100,
      issues: [],
      overallStatus: 'Healthy',
      repairable: 0,
    },
    warnings: [],
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
      event: { id: 'july-2026-league', name: leagueName },
      eventId: 'july-2026-league',
      standings: standings(),
      summary: {
        activePlayers: 10,
        gamesPlayed: 6,
        leader: standing(1, 'League Leader'),
        players: 10,
      },
    },
  ]
}

function standings() {
  return [
    standing(1, 'League Leader'),
    standing(2, player),
    standing(3, 'Rival One'),
    standing(4, 'Rival Two'),
    standing(5, 'Rival Three'),
    standing(6, 'Rival Four'),
    standing(7, 'Rival Five'),
    standing(8, 'Rival Six'),
    standing(9, 'Rival Seven'),
    standing(10, 'Rival Eight'),
  ]
}

function standing(rank, name) {
  return {
    displayName: name,
    division: 'Main Man',
    draws: 0,
    eventId: 'july-2026-league',
    favoriteArmy: name === player ? preferredArmy : 'O-12',
    faction: name === player ? preferredArmy : 'O-12',
    games: name === player ? 2 : 3,
    losses: name === player ? 0 : rank,
    op: name === player ? 8 : 10,
    player: name,
    rank,
    tp: name === player ? 6 : 9,
    vp: name === player ? 178 : 260,
    winRate: name === player ? 1 : 0.67,
    wins: name === player ? 2 : 2,
  }
}

function playerRecord() {
  return {
    ...standing(2, player),
    bestFaction: preferredArmy,
    bestMission: 'Supplies',
    favoriteFaction: preferredArmy,
    favoriteMission: 'Supplies',
    firstTurnGames: 1,
    firstTurnWinRate: 1,
    name: player,
    nemesis: 'Rival Two',
    rival: 'Rival One',
    secondTurnGames: 1,
    secondTurnWinRate: 1,
  }
}

function stats() {
  return {
    averageObjectivePoints: 4,
    averageTournamentPoints: 3,
    averageVictoryPoints: 89,
    division: 'Main Man',
    draws: 0,
    games: 2,
    losses: 0,
    objectivePoints: 8,
    op: 8,
    promotionStatus: 'Safe',
    rank: 2,
    seasonProgress: 22,
    tournamentPoints: 6,
    tp: 6,
    victoryPoints: 178,
    vp: 178,
    winPercentage: 100,
    wins: 2,
  }
}

function recentGame() {
  return {
    bestMoment: 'Lobo held the center, protected the console, and closed the match without conceding tempo.',
    date: '2026-07-12',
    division: 'Main Man',
    eventId: 'july-2026-league',
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
    vp: '89',
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
    armyName: 'Operations Subsection Strike Group',
    description: 'Candidate baseline list.',
    downvotes: 0,
    event: leagueName,
    faction: preferredArmy,
    id: 101,
    mission: 'Supplies',
    player,
    playerDisplayName: player,
    score: 5,
    sectorial: preferredArmy,
    submissionDate: '2026-07-10',
    submitterEmail: 'review@lobo.local',
    upvotes: 5,
  }
}

function comparePng(expected, actual) {
  const baseline = decodePng(expected)
  const current = decodePng(actual)

  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      message: `dimensions are ${current.width}x${current.height}; expected ${baseline.width}x${baseline.height}`,
      passed: false,
    }
  }

  let changedPixels = 0
  let largestDelta = 0
  for (let index = 0; index < baseline.pixels.length; index += 4) {
    const dr = Math.abs(baseline.pixels[index] - current.pixels[index])
    const dg = Math.abs(baseline.pixels[index + 1] - current.pixels[index + 1])
    const db = Math.abs(baseline.pixels[index + 2] - current.pixels[index + 2])
    const da = Math.abs(baseline.pixels[index + 3] - current.pixels[index + 3])
    const delta = Math.max(dr, dg, db, da)
    largestDelta = Math.max(largestDelta, delta)

    if (delta > 4) {
      changedPixels += 1
    }
  }

  const totalPixels = baseline.width * baseline.height
  const changedRatio = changedPixels / totalPixels
  const passed = changedPixels <= 500 || changedRatio <= 0.0005

  return {
    message: `${changedPixels} changed pixels (${(changedRatio * 100).toFixed(4)}%), max channel delta ${largestDelta}`,
    passed,
  }
}

function decodePng(buffer) {
  const signature = '89504e470d0a1a0a'
  if (buffer.subarray(0, 8).toString('hex') !== signature) {
    throw new Error('visual baseline is not a PNG')
  }

  let offset = 8
  let width = 0
  let height = 0
  let colorType = 0
  const idat = []

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    offset += length + 12

    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const bitDepth = data[8]
      colorType = data[9]
      if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
        throw new Error(`unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`)
      }
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
  }

  const raw = inflateSync(Buffer.concat(idat))
  const bytesPerPixel = colorType === 6 ? 4 : 3
  const stride = width * bytesPerPixel
  const decoded = Buffer.alloc(width * height * bytesPerPixel)
  let rawOffset = 0

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset]
    rawOffset += 1
    const row = raw.subarray(rawOffset, rawOffset + stride)
    const previousRow = y === 0 ? null : decoded.subarray((y - 1) * stride, y * stride)
    const outputRow = decoded.subarray(y * stride, (y + 1) * stride)
    rawOffset += stride

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? outputRow[x - bytesPerPixel] : 0
      const up = previousRow ? previousRow[x] : 0
      const upLeft = previousRow && x >= bytesPerPixel ? previousRow[x - bytesPerPixel] : 0
      let value = row[x]

      if (filter === 1) {
        value += left
      } else if (filter === 2) {
        value += up
      } else if (filter === 3) {
        value += Math.floor((left + up) / 2)
      } else if (filter === 4) {
        value += paeth(left, up, upLeft)
      } else if (filter !== 0) {
        throw new Error(`unsupported PNG filter: ${filter}`)
      }

      outputRow[x] = value & 0xff
    }
  }

  if (colorType === 6) {
    return { height, pixels: decoded, width }
  }

  const pixels = Buffer.alloc(width * height * 4)
  for (let source = 0, target = 0; source < decoded.length; source += 3, target += 4) {
    pixels[target] = decoded[source]
    pixels[target + 1] = decoded[source + 1]
    pixels[target + 2] = decoded[source + 2]
    pixels[target + 3] = 255
  }

  return { height, pixels, width }
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft
  const leftDistance = Math.abs(estimate - left)
  const upDistance = Math.abs(estimate - up)
  const upLeftDistance = Math.abs(estimate - upLeft)

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left
  }
  return upDistance <= upLeftDistance ? up : upLeft
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

  const requestedPort = Number(process.env.VISUAL_STATIC_PORT || 49991)
  await new Promise((resolveListen) => {
    server.listen(requestedPort, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  }
}
