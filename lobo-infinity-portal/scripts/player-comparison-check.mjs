import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const port = 5187
const baseUrl = `http://127.0.0.1:${port}`
const serverCommand = {
  args: ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  command: process.execPath,
}
const server = spawn(serverCommand.command, serverCommand.args, {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
})

let output = ''
server.stdout.on('data', (chunk) => {
  output += chunk.toString('utf8')
})
server.stderr.on('data', (chunk) => {
  output += chunk.toString('utf8')
})

try {
  await waitForServer()
  await runChecks()
} finally {
  server.kill()
}

async function waitForServer() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) {
        return
      }
    } catch {
      // Keep polling until Vite accepts connections.
    }

    if (output.includes('Port') && output.includes('is already in use')) {
      throw new Error(`Vite port ${port} is already in use:\n${output}`)
    }

    if (output.includes('ready in')) {
      return
    }

    if (server.exitCode !== null) {
      throw new Error(`Vite exited before serving:\n${output}`)
    }

    await delay(250)
  }

  throw new Error(`Timed out waiting for Vite:\n${output}`)
}

async function runChecks() {
  const browser = await chromium.launch({ headless: true })
  const checks = []

  try {
    checks.push(await checkScenario('/compare', {
      comparisonRequests: 0,
      left: '',
      right: '',
      text: 'Select two players to compare head-to-head performance.',
    }, browser))
    checks.push(await checkScenario('/compare?left=Sam', {
      comparisonRequests: 0,
      left: 'Sam',
      right: '',
      text: 'Select another player to compare head-to-head performance.',
    }, browser))
    checks.push(await checkScenario('/compare?right=Alex', {
      comparisonRequests: 0,
      left: '',
      right: 'Alex',
      text: 'Select another player to compare head-to-head performance.',
    }, browser))
    checks.push(await checkScenario('/compare?left=Sam&right=Alex', {
      comparisonRequests: 1,
      left: 'Sam',
      right: 'Alex',
      text: 'HEAD TO HEAD',
    }, browser))
    checks.push(await checkScenario('/compare?left=LegacyName&right=Alex', {
      comparisonRequests: 1,
      left: 'LegacyName',
      right: 'Alex',
      text: 'One or both players could not be found.',
      unresolved: 'LegacyName (unresolved)',
    }, browser))
    checks.push(await checkRecovery(browser))
  } finally {
    await browser.close()
  }

  for (const check of checks) {
    console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`)
    if (!check.pass) {
      console.error(check.details)
    }
  }

  if (checks.some((check) => !check.pass)) {
    process.exitCode = 1
  }
}

async function checkScenario(path, expected, browser) {
  const page = await newMockedPage(browser)
  const comparisonRequests = []

  page.on('request', (request) => {
    if (new URL(request.url()).searchParams.get('action') === 'comparison') {
      comparisonRequests.push(request.url())
    }
  })

  try {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.comparison-controls select')
    await waitForText(page, expected.text)
    const values = await getComparisonValues(page)
    const body = await page.locator('body').innerText()
    const unresolvedVisible = expected.unresolved
      ? body.includes(expected.unresolved)
      : true
    const pass =
      comparisonRequests.length === expected.comparisonRequests &&
      values.left === expected.left &&
      values.right === expected.right &&
      body.includes(expected.text) &&
      unresolvedVisible

    return {
      details: JSON.stringify({ path, expected, comparisonRequests, values, body: body.slice(0, 2_000) }, null, 2),
      label: `Player comparison ${path}`,
      pass,
    }
  } finally {
    await page.close()
  }
}

async function checkRecovery(browser) {
  const page = await newMockedPage(browser)

  try {
    await page.goto(`${baseUrl}/compare?left=LegacyName&right=Alex`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.comparison-controls select')
    await page.locator('.comparison-controls select').first().selectOption('Sam')
    await page.waitForURL('**/compare?left=Sam&right=Alex')
    await waitForText(page, 'HEAD TO HEAD')
    await page.waitForSelector('.comparison-hero')

    const body = await page.locator('body').innerText()
    const values = await getComparisonValues(page)

    return {
      details: JSON.stringify({ values, body: body.slice(0, 2_000) }, null, 2),
      label: 'Player comparison API error recovery',
      pass:
        values.left === 'Sam' &&
        values.right === 'Alex' &&
        body.includes('HEAD TO HEAD') &&
        !body.includes('One or both players could not be found.'),
    }
  } finally {
    await page.close()
  }
}

async function newMockedPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  await page.route('https://script.google.com/**', async (route) => {
    await route.fulfill({
      body: JSON.stringify(mockApiResponse(route.request().url())),
      contentType: 'application/json',
      status: 200,
    })
  })

  await page.route('https://script.googleusercontent.com/**', async (route) => {
    await route.fulfill({
      body: JSON.stringify(mockApiResponse(route.request().url())),
      contentType: 'application/json',
      status: 200,
    })
  })

  return page
}

function mockApiResponse(url) {
  const parsed = new URL(url)
  const action = parsed.searchParams.get('action')

  if (action === 'players') {
    return playersResponse()
  }

  if (action === 'comparison') {
    const left = parsed.searchParams.get('left') || ''
    const right = parsed.searchParams.get('right') || ''

    if (left === 'LegacyName' || right === 'LegacyName') {
      return {
        error: 'One or both players could not be found.',
        success: false,
      }
    }

    return comparisonResponse(left, right)
  }

  if (action === 'settings') {
    return {
      settings: {
        googleOAuthClientId: '',
        leagueName: 'Lobo Infinity League',
      },
      success: true,
    }
  }

  if (action === 'session') {
    return {
      authenticated: false,
      success: true,
    }
  }

  return {
    success: true,
  }
}

function playersResponse() {
  const standings = ['Sam', 'Alex', 'xtapro'].map((player, index) => ({
    displayName: player,
    division: 'Proving Grounds A',
    draws: 0,
    games: 3,
    losses: index,
    op: 10 - index,
    player,
    rank: index + 1,
    tp: 6 - index,
    vp: 120 - index,
    wins: 3 - index,
  }))

  return {
    divisions: [
      {
        division: 'main',
        divisionLabel: 'Player Registry',
        event: null,
        eventId: '',
        standings,
        summary: {
          activePlayers: standings.length,
          gamesPlayed: 5,
          leader: standings[0],
          players: standings.length,
        },
        success: true,
      },
    ],
    event: null,
    eventId: '',
    success: true,
  }
}

function comparisonResponse(left, right) {
  return {
    headToHead: {
      draws: 0,
      games: 1,
      leftWins: 1,
      rightWins: 0,
    },
    players: [comparisonPlayer(left, 1), comparisonPlayer(right, 2)],
    success: true,
  }
}

function comparisonPlayer(name, rank) {
  return {
    bestFaction: '',
    bestMission: 'Supplies',
    displayName: name,
    division: 'Proving Grounds A',
    draws: 0,
    favoriteFaction: 'PanOceania',
    favoriteMission: 'Supplies',
    games: 3,
    losses: rank - 1,
    name,
    op: 10,
    rank,
    tp: 6,
    vp: 120,
    wins: 3 - rank,
  }
}

async function getComparisonValues(page) {
  const values = await page.locator('.comparison-controls select').evaluateAll((selects) =>
    selects.map((select) => select.value),
  )

  return {
    left: values[0] || '',
    right: values[1] || '',
  }
}

async function waitForText(page, text) {
  await page
    .locator('body')
    .filter({ hasText: text })
    .waitFor({ timeout: 5_000 })
    .catch(() => undefined)
}
