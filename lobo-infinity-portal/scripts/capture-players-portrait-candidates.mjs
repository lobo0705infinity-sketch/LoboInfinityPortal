import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'

process.env.VITE_API_URL ||= 'https://script.google.com/macros/s/AKfycbxYA3vMwp1M7As58B4rwKlRlcn3wOWdS2_iQ5jnfIvdZnLrQv3jJ8tM-m0ozUbAP_7Y0g/exec'

const providedBaseUrl = process.env.PLAYERS_PORTRAIT_BASE_URL
let server = null
let baseUrl = providedBaseUrl
const outputDir = resolve(process.cwd(), '..', '.codex-screenshots', 'players-portrait-candidates')

mkdirSync(outputDir, { recursive: true })

if (!baseUrl) {
  server = await createServer({
    server: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: false,
    },
  })
  await server.listen()
  const address = server.httpServer?.address()
  const port = typeof address === 'object' && address ? address.port : 4173
  baseUrl = `http://127.0.0.1:${port}`
}

const browser = await chromium.launch({ headless: true })

try {
  await capture('players-portrait-desktop.png', 1440, 1000)
  await capture('players-portrait-mobile.png', 390, 900)
} finally {
  await browser.close()
  await server?.close()
}

async function capture(name, width, height) {
  const page = await browser.newPage({ viewport: { width, height } })

  try {
    await page.route('https://script.google.com/**', async (route) => {
      const url = new URL(route.request().url())

      if (url.searchParams.get('action') === 'players') {
        await route.fulfill({
          contentType: 'application/json',
          json: buildPlayersPayload(),
        })
        return
      }

      await route.fulfill({
        contentType: 'application/json',
        json: { success: true },
      })
    })

    await page.goto(`${baseUrl}/players`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.player-card', { timeout: 15_000 })

    const validation = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.player-card'))
      const portraitCards = cards.filter((card) => card.classList.contains('has-faction-portrait'))
      const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      const missingIdentity = cards.some((card) => {
        const badge = card.querySelector('.player-card-division')
        const name = card.querySelector('h2')

        return !badge || !name || !name.textContent?.trim()
      })
      const portraitHidesIdentity = portraitCards.some((card) => {
        const portrait = card.querySelector('.player-card-portrait')
        const badge = card.querySelector('.player-card-division')
        const name = card.querySelector('h2')

        if (!(portrait instanceof HTMLElement) || !(badge instanceof HTMLElement) || !(name instanceof HTMLElement)) {
          return true
        }

        const portraitStyle = window.getComputedStyle(portrait)
        const badgeStyle = window.getComputedStyle(badge)
        const nameStyle = window.getComputedStyle(name)

        return (
          Number(portraitStyle.zIndex || 0) >= Number(badgeStyle.zIndex || 1) ||
          Number(portraitStyle.zIndex || 0) >= Number(nameStyle.zIndex || 1)
        )
      })
      const invalidGrid = portraitCards.some((card) => {
        const columns = window.getComputedStyle(card).gridTemplateColumns

        return columns.split(' ').filter(Boolean).length < 2
      })
      const statOverlapsPortrait = portraitCards.some((card) => {
        const portrait = card.querySelector('.player-card-portrait')
        const stats = Array.from(card.querySelectorAll('.player-card-stats > div'))

        if (!(portrait instanceof HTMLElement)) {
          return true
        }

        const portraitRect = portrait.getBoundingClientRect()

        return stats.some((stat) => {
          if (!(stat instanceof HTMLElement)) {
            return true
          }

          const statRect = stat.getBoundingClientRect()

          return rectanglesOverlap(statRect, portraitRect)
        })
      })
      const unreadableArmy = portraitCards.some((card) => {
        const army = Array.from(card.querySelectorAll('.player-card-stats > div')).find((stat) =>
          stat.textContent?.includes('Army'),
        )

        if (!(army instanceof HTMLElement)) {
          return true
        }

        return army.getBoundingClientRect().width < 150
      })

      return {
        cardCount: cards.length,
        hasHorizontalOverflow: overflow,
        invalidGrid,
        missingIdentity,
        portraitCardCount: portraitCards.length,
        portraitHidesIdentity,
        statOverlapsPortrait,
        unreadableArmy,
      }

      function rectanglesOverlap(left, right) {
        return !(
          left.right <= right.left ||
          left.left >= right.right ||
          left.bottom <= right.top ||
          left.top >= right.bottom
        )
      }
    })

    if (validation.cardCount === 0) {
      throw new Error('Players page rendered no player cards.')
    }

    if (validation.missingIdentity) {
      throw new Error('At least one player card is missing badge or name.')
    }

    if (validation.hasHorizontalOverflow) {
      throw new Error('Players page has horizontal overflow.')
    }

    if (validation.portraitHidesIdentity) {
      throw new Error('Portrait z-index can cover badge or player name.')
    }

    if (validation.invalidGrid) {
      throw new Error('Portrait player cards do not use separate content and portrait columns.')
    }

    if (validation.statOverlapsPortrait) {
      throw new Error('At least one stat tile overlaps the portrait column.')
    }

    if (validation.unreadableArmy) {
      throw new Error('At least one Army stat tile is too narrow to read normally.')
    }

    await page.screenshot({
      fullPage: true,
      path: resolve(outputDir, name),
    })

    console.log(`${name}: ${JSON.stringify(validation)}`)
  } finally {
    await page.close()
  }
}

function buildPlayersPayload() {
  const standings = [
    player('Lobo', 'Operations Subsection', 'Operations Subsection', 12, 9, 3, 0, ['League Player', 'Tournament Player']),
    player('Bakunin Pilot', 'Bakunin Jurisdictional Command', 'Nomads', 8, 5, 3, 1, ['League Player']),
    player('Kosmo Scout', 'PanOceania', 'Kosmoflot', 4, 2, 2, 0, ['Casual Player']),
    player('Unsupported Player', 'Yu Jing', 'Yu Jing', 0, 0, 0, 0, ['New Player']),
  ]

  return {
    success: true,
    divisions: [
      {
        division: 'main',
        divisionLabel: 'Player Registry',
        eventId: '',
        standings,
        summary: {
          activePlayers: standings.filter((entry) => entry.games > 0).length,
          gamesPlayed: standings.reduce((total, entry) => total + entry.games, 0),
          leader: standings[0],
          players: standings.length,
        },
      },
    ],
  }
}

function player(
  name,
  faction,
  favoriteArmy,
  games,
  wins,
  losses,
  currentWinStreak,
  statusBadges,
) {
  return {
    communityStatus: statusBadges.join(', '),
    currentWinStreak,
    displayName: name,
    division: 'Main Man',
    eventId: '',
    faction,
    favoriteArmy,
    gameTypes: statusBadges.map((status) => status.replace(' Player', '').toLowerCase()),
    games,
    lastActive: '2026-07-20T04:00:00.000Z',
    losses,
    op: wins * 4,
    player: name,
    rank: games + 1,
    statusBadges,
    tp: wins * 5,
    vp: wins * 180,
    wins,
  }
}
