import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const port = 4179
const origin = `http://127.0.0.1:${port}`
const apiUrl = 'https://event-manager-test.invalid/exec'

const leagueEvent = event({
  id: 'event-current-league',
  name: 'July 2026 League',
  type: 'League',
})

let selectedEvent = leagueEvent
let mutationCount = 0
const mutations = []

const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)],
  {
    env: {
      ...process.env,
      VITE_API_URL: apiUrl,
      VITE_DATA_PROVIDER: 'google',
    },
    stdio: 'ignore',
  },
)

let browser

try {
  await waitForServer()
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.addInitScript(() => {
    window.localStorage.setItem('lobo-session-token', 'test-session')
  })
  await page.route(`${apiUrl}*`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const action = url.searchParams.get('action') || ''
    const body = new URLSearchParams(request.postData() || '')

    if (action === 'session') {
      await respond(route, {
        authenticated: true,
        permissions: { runSeasonControl: true, viewOperations: true },
        success: true,
        user: { enabled: true, role: 'Commissioner' },
      })
      return
    }

    if (action === 'eventManager') {
      await respond(route, managerPayload(selectedEvent))
      return
    }

    if (action === 'eventManagerEvent') {
      mutationCount += 1
      const params = Object.fromEntries(body)
      mutations.push(params)

      if (params.name === 'Reject Me') {
        await respond(route, {
          error: 'Safe backend rejection.',
          success: false,
        })
        return
      }

      selectedEvent = event({
        ...params,
        id: params.eventId || top40Id,
      })
      await respond(route, managerPayload(selectedEvent))
      return
    }

    await respond(route, { success: true })
  })

  await page.goto(`${origin}/commissioner/events`)
  await page.getByRole('heading', { name: 'Event Manager' }).waitFor()

  assert.equal(await page.getByRole('button', { name: /Create New Event/ }).count(), 0,
    'Commissioner must not expose canonical event creation.')
  let form = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Event Details' }) })
  await field(form, 'Name').fill('July 2026 League Updated')
  await form.getByRole('button', { name: 'Save Event' }).click()
  await assertText(page, 'Event saved.')
  assert.equal(mutationCount, 1, 'Existing-event save must invoke one mutation.')
  assert.equal(mutations[0].eventId, leagueEvent.id, 'Existing-event save must retain its canonical ID.')

  await field(form, 'Name').fill('Reject Me')
  await form.getByRole('button', { name: 'Save Event' }).click()
  await assertText(page, 'Safe backend rejection.')
  assert.equal(mutationCount, 2, 'Rejected existing-event save must not retry the mutation.')

  console.log('PASS: Commissioner event operations hide provisioning, update existing events, and render success or safe backend failure.')
} finally {
  await browser?.close()
  server.kill()
}

function event(overrides = {}) {
  return {
    achievements: '',
    archive: 'Not archived',
    automation: '',
    commissioners: '',
    communityId: 'community-lobo-infinity',
    createdAt: '2026-08-01T00:00:00.000Z',
    description: '',
    discord: '',
    endDate: '',
    history: '',
    id: 'event-current-league',
    lifecycleStage: 'Planning',
    name: 'July 2026 League',
    owner: 'Commissioner',
    participants: 'Event Participants',
    registration: 'Registration Closed',
    rules: '',
    scoringModel: '',
    seriesId: 'series-lobo-league',
    standingsModel: '',
    startDate: '',
    status: 'Planning',
    templateId: 'template-league',
    type: 'League',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function managerPayload(current) {
  return {
    manager: {
      currentEvent: leagueEvent,
      diagnostics: {
        eventHealth: 'Healthy',
        eventId: current.id,
        lifecycleStage: current.lifecycleStage,
        registrationStatus: current.registration,
      },
      events: [leagueEvent, current]
        .filter((item, index, all) => all.findIndex(({ id }) => id === item.id) === index)
        .map((item) => ({ event: item, registrationStatus: item.registration })),
      generatedAt: '2026-08-28T00:00:00.000Z',
      leagueOperations: { missionOptions: [], missions: [], weekNumber: '' },
      pairings: [],
      participants: [],
      quickActions: [],
      registration: {
        capacity: { maximumPlayers: 40 },
        eventId: current.id,
        eventName: current.name,
        eventType: current.type,
        registrations: [],
        status: current.registration,
      },
      rounds: [],
      selectedEvent: current,
      teams: [],
    },
    success: true,
  }
}

async function respond(route, body) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status: 200,
  })
}

async function assertText(page, text) {
  await page.getByText(text, { exact: true }).waitFor()
}

function field(form, label, element = 'input') {
  return form.locator('label').filter({ hasText: new RegExp(`^${label}`) }).locator(element)
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(origin)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Event Manager test server did not start.')
}
