import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createServer } from 'vite'

process.env.VITE_API_URL ||= 'https://script.google.com/macros/s/AKfycbxYA3vMwp1M7As58B4rwKlRlcn3wOWdS2_iQ5jnfIvdZnLrQv3jJ8tM-m0ozUbAP_7Y0g/exec'

const currentLeagueEventId = 'event-current-league'
const teamTournamentEventId = 'event-august-2026-team-tournament'

assertSourceContract()
await assertMissionsScopeUi()

console.log('mission scope checks passed')

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function assertSourceContract() {
  const missions = read('src/pages/Missions.tsx')
  const missionApi = read('backend/MissionApi.gs')
  const leagueData = read('backend/LeagueData.gs')
  const contract = read('release/production.json')
  const standings = read('src/pages/Standings.tsx')

  assert.match(
    missions,
    /const missionScopes = \[[\s\S]*Current League[\s\S]*Tournament[\s\S]*Casual[\s\S]*All Games/,
    'Mission Headquarters must expose Current League, Tournament, Casual, and All Games scopes.',
  )
  assert.match(
    missions,
    /apiClient\s*\.\s*getMissions\(\{[\s\S]*eventId,[\s\S]*gameType,/,
    'Mission Headquarters must send eventId and gameType to the missions endpoint.',
  )
  assert.match(
    missions,
    /eventId:\s*currentLeagueEventId,[\s\S]*gameType:\s*'league'/,
    'Current League scope must request the active league event and league game type.',
  )
  assert.match(
    missions,
    /eventId:\s*teamTournamentEventId,[\s\S]*gameType:\s*'tournament'/,
    'Tournament scope must request the Team Tournament event.',
  )
  assert.match(
    missions,
    /eventId:\s*'',[\s\S]*gameType:\s*'casual'/,
    'Casual scope must request casual Game Engine rows without requiring EVENT_ID.',
  )
  assert.match(
    missions,
    /eventId:\s*'',[\s\S]*gameType:\s*'all'/,
    'All Games scope must request all supported Game Engine rows.',
  )
  assert.match(
    missionApi,
    /getLeagueDataForEvent\(\s*eventId \|\| "all",\s*gameType \|\| "league"\s*\)/,
    'Mission API default must remain league scoped unless the frontend explicitly requests another scope.',
  )
  assert.match(
    leagueData,
    /typeScope !== "all" &&\s*rowGameType !== typeScope[\s\S]*return false;/,
    'Game Engine filtering must continue isolating rows by GAME_TYPE.',
  )
  assert.match(
    leagueData,
    /rowGameType === "casual"\s*\?\s*""/,
    'Casual Game Engine rows must be allowed to have blank EVENT_ID.',
  )
  assert.match(
    contract,
    /"missionHeadquartersScope"/,
    'Production contract must include Mission Headquarters scope markers.',
  )
  assert.match(
    standings,
    /standingsRepository\s*\.\s*getStandings/,
    'Mission Headquarters scope must not become the source for standings analytics.',
  )
  assert.doesNotMatch(
    standings,
    /getMissions|missionScopes/,
    'Standings must not depend on Mission Headquarters scope selection.',
  )
}

async function assertMissionsScopeUi() {
  const server = await createServer({
    server: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: false,
    },
  })
  await server.listen()
  const address = server.httpServer?.address()
  const port = typeof address === 'object' && address ? address.port : 4173
  const baseUrl = `http://127.0.0.1:${port}`
  const browser = await chromium.launch({ headless: true })
  const requests = []

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.route('https://script.google.com/**', async (route) => {
      const url = new URL(route.request().url())
      const action = url.searchParams.get('action')

      if (action === 'missions') {
        const eventId = url.searchParams.get('eventId') || ''
        const gameType = url.searchParams.get('gameType') || ''
        requests.push({ eventId, gameType })
        await route.fulfill({
          contentType: 'application/json',
          json: buildMissionsPayload(eventId, gameType),
        })
        return
      }

      await route.fulfill({
        contentType: 'application/json',
        json: { success: true },
      })
    })

    await page.goto(`${baseUrl}/missions`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.mission-card')

    assert.deepEqual(requests.at(-1), {
      eventId: currentLeagueEventId,
      gameType: 'league',
    })
    assert.equal(await countMissionCards(page, 'Neutralization'), 0)
    assert.equal(await countMissionCards(page, 'Superiority'), 1)

    await clickMissionScope(page, 'Casual')
    await page.waitForURL('**/missions?scope=casual')
    await page.waitForSelector('.mission-card:has-text("Neutralization")')

    assert.deepEqual(requests.at(-1), {
      eventId: '',
      gameType: 'casual',
    })
    assert.equal(await countMissionCards(page, 'Neutralization'), 1)
    assert.equal(await countMissionCards(page, 'Superiority'), 0)
    await assertMissionCardMetrics(page, 'Neutralization')

    await clickMissionScope(page, 'Tournament')
    await page.waitForURL('**/missions?scope=tournament')
    await page.waitForSelector('.mission-card:has-text("Cutthroat")')

    assert.deepEqual(requests.at(-1), {
      eventId: teamTournamentEventId,
      gameType: 'tournament',
    })
    assert.equal(await countMissionCards(page, 'Neutralization'), 0)
    assert.equal(await countMissionCards(page, 'Cutthroat'), 1)

    await clickMissionScope(page, 'All Games')
    await page.waitForURL('**/missions?scope=all')
    await page.waitForSelector('.mission-card:has-text("Neutralization")')

    assert.deepEqual(requests.at(-1), {
      eventId: '',
      gameType: 'all',
    })
    assert.equal(await countMissionCards(page, 'Neutralization'), 1)
    assert.equal(await countMissionCards(page, 'Superiority'), 1)
    assert.equal(await countMissionCards(page, 'Cutthroat'), 1)
    assert.ok(
      await page.getByText(/All Games combines league, tournament, and casual results/).isVisible(),
      'All Games scope must be clearly labeled as mixed analytics.',
    )

    await assertResponsiveScopeControl(browser, baseUrl)
  } finally {
    await browser.close()
    await server.close()
  }
}

async function assertResponsiveScopeControl(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })

  try {
    await page.route('https://script.google.com/**', async (route) => {
      const url = new URL(route.request().url())

      if (url.searchParams.get('action') === 'missions') {
        await route.fulfill({
          contentType: 'application/json',
          json: buildMissionsPayload('', 'casual'),
        })
        return
      }

      await route.fulfill({
        contentType: 'application/json',
        json: { success: true },
      })
    })

    await page.goto(`${baseUrl}/missions?scope=casual`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.mission-card')
    const metrics = await page.evaluate(() => {
      const control = document.querySelector('.mission-scope-control')

      return {
        buttonCount: document.querySelectorAll('.mission-scope-control button').length,
        hasHorizontalOverflow:
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        width: control instanceof HTMLElement ? control.getBoundingClientRect().width : 0,
      }
    })

    assert.equal(metrics.buttonCount, 4)
    assert.equal(metrics.hasHorizontalOverflow, false, 'Mobile scope control must not overflow horizontally.')
    assert.ok(metrics.width <= 390, 'Mobile scope control must fit inside the viewport.')
  } finally {
    await page.close()
  }
}

function buildMissionsPayload(eventId, gameType) {
  const all = [
    mission('Superiority', 3, 50, 'PanOceania', '2026-07-10'),
    mission('Neutralization', 1, 100, 'Kosmoflot', '2026-07-20'),
    mission('Cutthroat', 2, 0, 'Nomads', '2026-08-01'),
  ]

  if (eventId === currentLeagueEventId && gameType === 'league') {
    return { success: true, missions: [all[0]] }
  }

  if (eventId === teamTournamentEventId) {
    return { success: true, missions: [all[2]] }
  }

  if (gameType === 'casual') {
    return { success: true, missions: [all[1]] }
  }

  if (gameType === 'all') {
    return { success: true, missions: all }
  }

  return { success: true, missions: [] }
}

function mission(missionName, games, firstTurnWinRate, mostSuccessfulFaction, lastPlayed) {
  return {
    averageOP: games + 3,
    averageTP: games,
    averageVP: games * 100,
    firstTurnWinRate,
    games,
    lastPlayed,
    mission: missionName,
    mostSuccessfulFaction,
  }
}

async function countMissionCards(page, missionName) {
  return page.locator('.mission-card', { hasText: missionName }).count()
}

async function clickMissionScope(page, scopeName) {
  await page
    .locator('.mission-scope-control')
    .getByRole('button', { name: new RegExp(scopeName) })
    .click()
}

async function assertMissionCardMetrics(page, missionName) {
  const card = page.locator('.mission-card', { hasText: missionName }).first()
  await expectCardText(card, 'Games')
  await expectCardText(card, 'First Turn Win %')
  await expectCardText(card, 'Top Faction')
  await expectCardText(card, 'Avg OP')
  await expectCardText(card, 'Avg VP')
  await expectCardText(card, 'Last Played')
}

async function expectCardText(locator, text) {
  assert.ok(await locator.getByText(text).isVisible(), `Expected mission card to show ${text}.`)
}
