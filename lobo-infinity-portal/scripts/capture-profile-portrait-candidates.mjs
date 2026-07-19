import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { chromium } from 'playwright'

const DEFAULT_BASE_URL = 'http://127.0.0.1:4183'
const root = path.join(process.cwd(), 'dist')
const outputDir = path.resolve(process.cwd(), '..', '.codex-screenshots', 'profile-portrait-candidates')

const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
}

const portalUser = {
  archivedAlerts: [],
  avatarUrl: '',
  canonicalPlayer: 'Test Pilot',
  created: '2026-07-19',
  discordName: 'test-pilot',
  dismissedAlerts: [],
  displayName: 'Test Pilot',
  email: 'test.pilot@example.com',
  enabled: true,
  eventRegistrations: [],
  favoriteFaction: 'Bakunin Jurisdictional Command',
  lastLogin: '2026-07-19',
  lastPage: '/profile',
  lastSeen: '2026-07-19',
  leagueDivision: 'Main Man',
  leaguePlayer: 'Test Pilot',
  notificationPreferences: {},
  playerDisplayName: 'Test Pilot',
  profileVisibility: 'Public',
  readAlerts: [],
  role: 'League Member',
  searchHistory: [],
  themePreference: 'system',
}

const seasonStats = {
  averageObjectivePoints: 4.7,
  averageTournamentPoints: 2.5,
  averageVictoryPoints: 128,
  division: 'Main Man',
  draws: 1,
  games: 6,
  losses: 1,
  op: 28,
  promotionStatus: 'In contention',
  rank: 2,
  seasonProgress: 6,
  tp: 15,
  vp: 768,
  winPercentage: 66.7,
  wins: 4,
}

const profilePayload = {
  profile: {
    achievements: [],
    careerStatistics: seasonStats,
    currentSeasonStatistics: seasonStats,
    futureSections: [],
    intelligence: {
      division: 'Main Man',
      divisionAverage: averageBlock(),
      leagueAverage: averageBlock(),
      player: 'Test Pilot',
      ranks: {
        objectivePoints: 4,
        tournamentPoints: 2,
        victoryPoints: 3,
        winPercentage: 2,
      },
      topThreeAverage: averageBlock(),
    },
    leaguePerformance: {
      bestOpponent: 'Community Player',
      closestVictory: null,
      currentStreak: 'W2',
      fallbackBestOpponent: '',
      fallbackWorstOpponent: '',
      longestLosingStreak: 1,
      longestWinStreak: 2,
      mostPlayedOpponent: 'Community Player',
      worstDefeat: null,
      worstOpponent: 'Community Player',
    },
    leagueStatistics: {
      armyListSummary: {
        averageRating: 0,
        favoriteFaction: 'Bakunin Jurisdictional Command',
        highestRated: null,
        newest: null,
        submitted: 0,
      },
      availability: {},
      bestFaction: 'Bakunin Jurisdictional Command',
      bestMission: 'Supplies',
      city: '',
      discordHandle: 'test-pilot',
      displayName: 'Test Pilot',
      division: 'Main Man',
      draws: 1,
      favoriteFaction: 'Bakunin Jurisdictional Command',
      favoriteMission: 'Supplies',
      firstTurnGames: 3,
      firstTurnWinRate: 66.7,
      games: 6,
      homeStore: '',
      losses: 1,
      name: 'Test Pilot',
      nemesis: '',
      op: 28,
      preferredLocations: '',
      profilePicture: '',
      rank: 2,
      registeredEvents: [],
      rival: '',
      scheduleLink: '',
      secondTurnGames: 3,
      secondTurnWinRate: 66.7,
      tp: 15,
      vp: 768,
      winPercentage: 66.7,
      wins: 4,
      armyLists: [],
    },
    recentActivity: [],
    recentGames: [],
    submittedLists: [],
    user: portalUser,
    votesCast: 0,
  },
}

const settingsPayload = {
  settings: {
    googleOAuthClientId: '',
    leagueName: 'Lobo Infinity League',
    portalVersion: 'candidate',
    submissionButtonText: 'Submit Game',
    submissionButtonVisible: 'true',
    submissionEnabled: 'true',
  },
}

const sessionPayload = {
  authenticated: true,
  code: '',
  diagnostics: {},
  error: '',
  oauthConfigured: false,
  permissions: {},
  stage: 'candidate',
  user: portalUser,
}

fs.mkdirSync(outputDir, { recursive: true })

const server = await startStaticServer()
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()

try {
  await capture('desktop', 1440, 1000)
  await capture('mobile', 390, 844)
} finally {
  await context.close()
  await browser.close()
  server.close()
}

console.log(
  JSON.stringify(
    {
      outputDir,
      screenshots: ['my-profile-portrait-desktop.png', 'my-profile-portrait-mobile.png'],
      status: 'captured',
    },
    null,
    2,
  ),
)

async function capture(name, width, height) {
  const page = await context.newPage()
  await page.setViewportSize({ width, height })
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (url.searchParams.has('action')) {
      const action = url.searchParams.get('action')
      const body = request.method() === 'POST' ? request.postData() || '' : ''
      const bodyParams = new URLSearchParams(body)
      const division = url.searchParams.get('division') || bodyParams.get('division') || ''

      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(readApiFixture(action, division)),
      })
    }

    return route.continue()
  })

  await page.goto(`${DEFAULT_BASE_URL}/profile`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForSelector('.my-profile-faction-portrait img', { timeout: 10_000 })
  await page.waitForLoadState('networkidle')

  const validation = await page.evaluate(() => {
    const image = document.querySelector('.my-profile-faction-portrait img')
    const dashboard = document.querySelector('.my-profile-v3-dashboard')
    const portraitPanel = document.querySelector('.my-profile-faction-portrait')
    const badge = document.querySelector('.my-profile-operator-badge')
    const identity = document.querySelector('.my-profile-operator-hero .profile-hero-main')

    if (!(image instanceof HTMLImageElement) || !dashboard || !portraitPanel || !badge || !identity) {
      return {
        errors: ['Required portrait layout elements are missing.'],
      }
    }

    const img = image
    const style = window.getComputedStyle(img)
    const dashboardRect = dashboard.getBoundingClientRect()
    const portraitRect = portraitPanel.getBoundingClientRect()
    const badgeRect = badge.getBoundingClientRect()
    const identityRect = identity.getBoundingClientRect()
    const imageTransparency = inspectImageTransparency(img)
    const isDesktopGrid = window.innerWidth > 920
    const errors = []

    if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
      errors.push('Portrait image did not load.')
    }

    if (style.objectFit !== 'contain') {
      errors.push(`Portrait object-fit is ${style.objectFit}, expected contain.`)
    }

    if (!imageTransparency.hasUsableTransparency) {
      errors.push(
        `Portrait asset has no usable transparency: ${imageTransparency.transparentPixels} transparent and ${imageTransparency.translucentPixels} translucent pixels.`,
      )
    }

    if (imageTransparency.hasOpaqueRectangularBackground) {
      errors.push('Portrait asset has an opaque white/checkerboard rectangular background.')
    }

    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 2) {
      errors.push('Page has horizontal overflow.')
    }

    if (dashboardRect.width > document.documentElement.clientWidth + 2) {
      errors.push('Profile dashboard overflows the viewport.')
    }

    if (rectanglesOverlap(badgeRect, identityRect)) {
      errors.push('Badge overlaps identity content.')
    }

    if (rectanglesOverlap(portraitRect, identityRect)) {
      errors.push('Portrait panel overlaps identity content.')
    }

    if (isDesktopGrid && !(badgeRect.left < identityRect.left && identityRect.left < portraitRect.left)) {
      errors.push('Desktop profile hero is not ordered as badge, identity, portrait.')
    }

    if (!isDesktopGrid && !(badgeRect.top <= portraitRect.top && portraitRect.top <= identityRect.top)) {
      errors.push('Mobile profile hero is not stacked as badge, portrait, identity.')
    }

    return {
      errors,
      complete: img.complete,
      height: portraitRect.height,
      imageTransparency,
      naturalHeight: img.naturalHeight,
      naturalWidth: img.naturalWidth,
      objectFit: style.objectFit,
      src: img.getAttribute('src'),
      width: portraitRect.width,
    }

    function inspectImageTransparency(img) {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })

      if (!context) {
        return {
          hasOpaqueRectangularBackground: true,
          hasUsableTransparency: false,
          opaqueLightEdgeRatio: 1,
          totalPixels: 0,
          translucentPixels: 0,
          transparentPixels: 0,
        }
      }

      context.drawImage(img, 0, 0)
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data
      let transparentPixels = 0
      let translucentPixels = 0
      const edgeSamples = []
      const sampleStride = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / 28))

      for (let index = 3; index < data.length; index += 4) {
        const alpha = data[index]

        if (alpha === 0) {
          transparentPixels += 1
        } else if (alpha < 255) {
          translucentPixels += 1
        }
      }

      for (let x = 0; x < canvas.width; x += sampleStride) {
        edgeSamples.push(readPixel(data, canvas.width, x, 0))
        edgeSamples.push(readPixel(data, canvas.width, x, canvas.height - 1))
      }

      for (let y = 0; y < canvas.height; y += sampleStride) {
        edgeSamples.push(readPixel(data, canvas.width, 0, y))
        edgeSamples.push(readPixel(data, canvas.width, canvas.width - 1, y))
      }

      const opaqueLightEdgeSamples = edgeSamples.filter(
        (sample) =>
          sample.alpha === 255 &&
          sample.red >= 228 &&
          sample.green >= 228 &&
          sample.blue >= 228,
      ).length
      const totalPixels = canvas.width * canvas.height
      const opaqueLightEdgeRatio = opaqueLightEdgeSamples / edgeSamples.length

      return {
        hasOpaqueRectangularBackground: opaqueLightEdgeRatio > 0.85,
        hasUsableTransparency: (transparentPixels + translucentPixels) / totalPixels > 0.05,
        opaqueLightEdgeRatio,
        totalPixels,
        translucentPixels,
        transparentPixels,
      }
    }

    function readPixel(pixels, width, x, y) {
      const index = (y * width + x) * 4

      return {
        red: pixels[index],
        green: pixels[index + 1],
        blue: pixels[index + 2],
        alpha: pixels[index + 3],
      }
    }

    function rectanglesOverlap(first, second) {
      const left = Math.max(first.left, second.left)
      const right = Math.min(first.right, second.right)
      const top = Math.max(first.top, second.top)
      const bottom = Math.min(first.bottom, second.bottom)

      return Math.max(0, right - left) * Math.max(0, bottom - top) > 16
    }
  })

  if (validation.errors.length > 0) {
    throw new Error(`${name} portrait failed validation: ${JSON.stringify(validation, null, 2)}`)
  }

  await page.locator('.my-profile-v3-dashboard').screenshot({
    path: path.join(outputDir, `my-profile-portrait-${name}.png`),
  })
  await page.close()
}

function readApiFixture(action, division) {
  if (action === 'settings') {
    return settingsPayload
  }

  if (action === 'session') {
    return sessionPayload
  }

  if (action === 'myProfile') {
    return profilePayload
  }

  if (action === 'standings') {
    return standingsPayload(division)
  }

  return {}
}

function standingsPayload(division) {
  const isMain = division === 'main'
  const standing = {
    currentWinStreak: 2,
    displayName: 'Test Pilot',
    division: isMain ? 'Main Man' : division.toUpperCase(),
    draws: isMain ? 1 : 0,
    eventId: 'event-current-league',
    faction: isMain ? 'Bakunin Jurisdictional Command' : '',
    favoriteArmy: isMain ? 'Bakunin Jurisdictional Command' : '',
    games: isMain ? 6 : 0,
    losses: isMain ? 1 : 0,
    op: isMain ? 28 : 0,
    player: 'Test Pilot',
    rank: isMain ? 2 : 0,
    tp: isMain ? 15 : 0,
    vp: isMain ? 768 : 0,
    wins: isMain ? 4 : 0,
  }

  return {
    division: division || 'main',
    divisionLabel: isMain ? 'Main Man' : division.toUpperCase(),
    eventId: 'event-current-league',
    standings: isMain ? [standing] : [],
    summary: {
      activePlayers: isMain ? 10 : 0,
      gamesPlayed: isMain ? 6 : 0,
      leader: isMain ? standing : null,
      players: isMain ? 10 : 0,
    },
  }
}

function averageBlock() {
  return {
    averageOP: 4.3,
    averageTP: 2.1,
    averageVP: 118,
    games: 12,
    players: 6,
    winPercentage: 50,
  }
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url || '/', DEFAULT_BASE_URL)
      let file = path.join(root, url.pathname)

      if (!file.startsWith(root)) {
        response.writeHead(403)
        response.end()
        return
      }

      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = path.join(root, 'index.html')
      }

      response.writeHead(200, {
        'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream',
      })
      fs.createReadStream(file).pipe(response)
    })

    server.listen(new URL(DEFAULT_BASE_URL).port, '127.0.0.1', () => resolve(server))
  })
}
