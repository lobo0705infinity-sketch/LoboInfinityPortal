import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createServer } from 'vite'

process.env.VITE_API_URL ||= 'https://script.google.com/macros/s/AKfycbxYA3vMwp1M7As58B4rwKlRlcn3wOWdS2_iQ5jnfIvdZnLrQv3jJ8tM-m0ozUbAP_7Y0g/exec'

assertSourceContract()
await assertPublicProfilePortraitUi()

console.log('public player profile portrait checks passed')

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function assertSourceContract() {
  const playerProfile = read('src/pages/PlayerProfile.tsx')
  const portraits = read('src/config/factionPortraits.ts')
  const playerCard = read('src/components/PlayerCard.tsx')
  const myProfile = read('src/pages/MyProfile.tsx')

  const registryDeclarations = [
    playerProfile,
    portraits,
    playerCard,
    myProfile,
  ].join('\n').match(/\bFACTION_PORTRAIT_REGISTRY\b/g) ?? []

  assert.equal(
    registryDeclarations.length,
    2,
    'Only the centralized faction portrait registry module should declare/export the registry.',
  )
  assert.match(
    playerProfile,
    /import\s*\{[\s\S]*resolveFactionPortraitFromArmyPriority[\s\S]*\}\s*from '..\/config\/factionPortraits'/,
    'Public Player Profile must reuse the centralized faction portrait resolver.',
  )
  assert.match(
    playerProfile,
    /resolveFactionPortraitFromArmyPriority\(\s*leagueModel\?\.preferredArmy,[\s\S]*player\.favoriteFaction,[\s\S]*player\.armyListSummary\.favoriteFaction,[\s\S]*career\.quickStats\.mostPlayedArmy,[\s\S]*career\.quickStats\.mostPlayedArmyParentFaction,/,
    'Public Player Profile must resolve from current/preferred army fields before parent faction fields.',
  )
  assert.doesNotMatch(
    playerProfile,
    /resolveFactionPortrait(?:FromArmyPriority)?\([^)]*(player\.name|displayName|playerName|decodedPlayerName)/,
    'Public Player Profile must not assign portraits by player name.',
  )
  assert.match(
    playerProfile,
    /<div className=\{`profile-v21-operator-column[\s\S]*<OperatorBadge[\s\S]*<PublicPlayerFactionPortrait/,
    'Public Player Profile must place the portrait below the Operator Badge in the left column.',
  )
  assert.match(
    playerProfile,
    /\.profile-v21-faction-portrait img \{[\s\S]*object-fit: contain/,
    'Public Player Profile portraits must use object-fit: contain.',
  )
}

async function assertPublicProfilePortraitUi() {
  const server = await createServer({
    server: {
      host: '127.0.0.1',
      port: 4175,
      strictPort: false,
    },
  })
  await server.listen()
  const address = server.httpServer?.address()
  const port = typeof address === 'object' && address ? address.port : 4175
  const baseUrl = `http://127.0.0.1:${port}`
  const browser = await chromium.launch({ headless: true })

  try {
    await assertSupportedProfile(browser, baseUrl)
    await assertUnsupportedProfile(browser, baseUrl)
  } finally {
    await browser.close()
    await server.close()
  }
}

async function assertSupportedProfile(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await routeApi(context, 'Test Pilot', 'Bakunin Jurisdictional Command')
  const page = await context.newPage()

  try {
    await page.goto(`${baseUrl}/player/Test%20Pilot`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.profile-v21-faction-portrait img')

    const desktop = await readLayout(page)
    assert.equal(desktop.hasPortrait, true)
    assert.equal(desktop.objectFit, 'contain')
    assert.equal(desktop.imageLoaded, true)
    assert.equal(desktop.portraitBelowBadge, true)
    assert.equal(desktop.overlapsBadge, false)
    assert.equal(desktop.overlapsIdentity, false)
    assert.equal(desktop.hasHorizontalOverflow, false)

    const mobile = await browser.newPage({ viewport: { width: 390, height: 900 } })
    await routeApi(mobile, 'Test Pilot', 'Bakunin Jurisdictional Command')
    await mobile.goto(`${baseUrl}/player/Test%20Pilot`, { waitUntil: 'networkidle' })
    await mobile.waitForSelector('.profile-v21-faction-portrait img')
    const mobileLayout = await readLayout(mobile)
    assert.equal(mobileLayout.portraitBelowBadge, true)
    assert.equal(mobileLayout.hasHorizontalOverflow, false)
    await mobile.close()
  } finally {
    await context.close()
  }
}

async function assertUnsupportedProfile(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await routeApi(context, 'Unsupported Pilot', 'Unknown Sectorial')
  const page = await context.newPage()

  try {
    await page.goto(`${baseUrl}/player/Unsupported%20Pilot`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.profile-v21-hero .operator-badge')
    assert.equal(await page.locator('.profile-v21-faction-portrait').count(), 0)
    assert.equal(await page.locator('.profile-v21-operator-column.has-faction-portrait').count(), 0)
    assert.ok(await page.getByRole('heading', { name: 'Unsupported Pilot' }).isVisible())
  } finally {
    await context.close()
  }
}

async function routeApi(contextOrPage, playerName, faction) {
  await contextOrPage.route('https://script.google.com/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const action = url.searchParams.get('action')

    if (action === 'player') {
      await route.fulfill({
        contentType: 'application/json',
        json: playerPayload(playerName, faction),
      })
      return
    }

    if (action === 'standings') {
      await route.fulfill({
        contentType: 'application/json',
        json: standingsPayload(url.searchParams.get('division') || 'main', playerName, faction),
      })
      return
    }

    if (action === 'recentGames') {
      await route.fulfill({
        contentType: 'application/json',
        json: { success: true, games: [] },
      })
      return
    }

    await route.fulfill({
      contentType: 'application/json',
      json: { success: true },
    })
  })
}

async function readLayout(page) {
  return page.evaluate(() => {
    const badge = document.querySelector('.profile-v21-hero .operator-badge')
    const portrait = document.querySelector('.profile-v21-faction-portrait')
    const image = document.querySelector('.profile-v21-faction-portrait img')
    const identity = document.querySelector('.profile-v21-identity')

    if (
      !(badge instanceof HTMLElement) ||
      !(portrait instanceof HTMLElement) ||
      !(image instanceof HTMLImageElement) ||
      !(identity instanceof HTMLElement)
    ) {
      return {
        hasPortrait: false,
      }
    }

    const badgeRect = badge.getBoundingClientRect()
    const portraitRect = portrait.getBoundingClientRect()
    const identityRect = identity.getBoundingClientRect()
    const imageStyle = window.getComputedStyle(image)

    return {
      hasPortrait: true,
      hasHorizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      imageLoaded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
      objectFit: imageStyle.objectFit,
      overlapsBadge: rectanglesOverlap(badgeRect, portraitRect),
      overlapsIdentity: rectanglesOverlap(identityRect, portraitRect),
      portraitBelowBadge: portraitRect.top >= badgeRect.bottom - 2,
    }

    function rectanglesOverlap(first, second) {
      const left = Math.max(first.left, second.left)
      const right = Math.min(first.right, second.right)
      const top = Math.max(first.top, second.top)
      const bottom = Math.min(first.bottom, second.bottom)

      return Math.max(0, right - left) * Math.max(0, bottom - top) > 16
    }
  })
}

function playerPayload(playerName, faction) {
  return {
    success: true,
    player: {
      armyListSummary: {
        averageRating: 0,
        favoriteFaction: faction,
        highestRated: null,
        newest: null,
        submitted: 0,
      },
      armyLists: [],
      availability: {},
      bestFaction: faction,
      bestMission: 'Neutralization',
      city: 'Praxis',
      discordHandle: '',
      displayName: playerName,
      division: 'Main Man',
      draws: 0,
      favoriteFaction: faction,
      favoriteMission: 'Neutralization',
      firstTurnGames: 3,
      firstTurnWinRate: 66.67,
      games: 6,
      homeStore: 'Lobo HQ',
      losses: 2,
      name: playerName,
      nemesis: '',
      op: 30,
      preferredLocations: '',
      profilePicture: '',
      rank: 2,
      registeredEvents: [],
      rival: '',
      scheduleLink: '',
      secondTurnGames: 3,
      secondTurnWinRate: 66.67,
      tp: 20,
      vp: 812,
      wins: 4,
    },
  }
}

function standingsPayload(division, playerName, faction) {
  const standing = {
    currentWinStreak: 2,
    displayName: playerName,
    division: 'Main Man',
    draws: 0,
    eventId: 'event-current-league',
    faction,
    favoriteArmy: faction,
    games: 6,
    gameTypes: ['league'],
    lastActive: '2026-07-20',
    losses: 2,
    op: 30,
    player: playerName,
    rank: 2,
    statusBadges: ['League Player'],
    tp: 20,
    vp: 812,
    wins: 4,
  }
  const isMain = division === 'main'

  return {
    division,
    divisionLabel: isMain ? 'Main Man' : division.toUpperCase(),
    eventId: 'event-current-league',
    standings: isMain ? [standing] : [],
    summary: {
      activePlayers: isMain ? 1 : 0,
      gamesPlayed: isMain ? 6 : 0,
      leader: isMain ? standing : null,
      players: isMain ? 1 : 0,
    },
  }
}
