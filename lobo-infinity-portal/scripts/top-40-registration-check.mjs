import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { chromium } from 'playwright'

const registrationSource = readFileSync(
  new URL('../backend/EventRegistrationApi.gs', import.meta.url),
  'utf8',
)
const eventEngineSource = readFileSync(
  new URL('../backend/EventEngineApi.gs', import.meta.url),
  'utf8',
)
const eventHomeSource = readFileSync(
  new URL('../src/pages/EventHome.tsx', import.meta.url),
  'utf8',
)
const apiSource = readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8')
const publicAppSource = readFileSync(new URL('../src/public/SnapshotPublicApp.tsx', import.meta.url), 'utf8')
const publicSnapshotExporterSource = readFileSync(new URL('../backend/PublicSnapshotExporter.gs', import.meta.url), 'utf8')
const publicSnapshotClientSource = readFileSync(new URL('../src/services/publicSnapshot.ts', import.meta.url), 'utf8')
const publicSnapshotPublisherSource = readFileSync(new URL('../api/public-snapshot-publish.mjs', import.meta.url), 'utf8')
const dedicatedPageSource = readFileSync(new URL('../src/components/Top40RegistrationPage.tsx', import.meta.url), 'utf8')
const dedicatedPageStyles = readFileSync(new URL('../src/components/Top40RegistrationPage.css', import.meta.url), 'utf8')
const eventNavigationSource = readFileSync(new URL('../src/config/eventNavigation.ts', import.meta.url), 'utf8')
const registrationArtwork = readFileSync(new URL('../public/assets/events/top-40-registration.png', import.meta.url))

const registrationFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfCyQ-oaLlZf8-utdWm0Y2iWrU8QZiHLVBhWzmxaCUZj2cMqg/viewform'
assert.equal(createHash('sha256').update(registrationArtwork).digest('hex'), '1e58a945b0318d361d33bffcfa1f795285c0e9a94fae4acfa8cfe37d60e896bd')
assert.match(publicAppSource, /path="\/event\/event-lobo-s-american-top-40\/registration" element=\{<Top40RegistrationPage \/>\}/)
assert.match(dedicatedPageSource, /src="\/assets\/events\/top-40-registration\.png"/)
assert.ok(dedicatedPageSource.includes(registrationFormUrl))
assert.ok(eventNavigationSource.includes(`registrationUrl: '${registrationFormUrl}'`))
assert.match(dedicatedPageSource, /target="_blank"/)
assert.match(dedicatedPageSource, /rel="noopener noreferrer"/)
assert.match(dedicatedPageSource, /REGISTER NOW/)
assert.match(dedicatedPageSource, /\{full \? 'FULL' : 'OPEN'\}/)
assert.match(dedicatedPageSource, /\{count\} \/ 40 PLAYERS REGISTERED/)
assert.match(dedicatedPageSource, /No players registered yet\./)
assert.match(dedicatedPageSource, /reached its 40-player capacity/)
assert.match(dedicatedPageSource, /Updated twice daily/)
assert.match(dedicatedPageSource, /Last updated:/)
assert.match(dedicatedPageSource, /useSnapshotData<PublicTop40Registration>\('top-40-registrations'\)/)
assert.doesNotMatch(dedicatedPageSource, /useEffect|fetch\(|\/api\/public-event-projection|Loading registration snapshot|HTTP \$\{response\.status\}/)
assert.doesNotMatch(dedicatedPageSource, /Email Address|Discord Username|tournament rules/)
assert.match(dedicatedPageStyles, /\.top40-registration-hero img[\s\S]*width: 100%;[\s\S]*height: auto;[\s\S]*object-fit: contain;/)
assert.doesNotMatch(dedicatedPageStyles, /object-fit:\s*cover|filter:|\.top40-registration-hero::(?:before|after)/)
assert.match(dedicatedPageStyles, /@media \(max-width: 760px\)[\s\S]*grid-template-columns: 1fr;/)
assert.match(publicSnapshotClientSource, /'top-40-registrations'/)
assert.match(publicSnapshotExporterSource, /"top-40-registrations\.json"/)
assert.match(publicSnapshotPublisherSource, /'top-40-registrations\.json'/)

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `missing function ${name}`)
  const bodyStart = source.indexOf('{', start)
  let depth = 0
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    else if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  throw new Error(`unterminated function ${name}`)
}

const snapshotGeneratedAt = '2026-09-07T22:00:00.000Z'

function buildSanitizedRegistration(names) {
  const context = { PUBLIC_SNAPSHOT_TOP40_REGISTRATION_LIMIT: 40 }
  vm.createContext(context)
  vm.runInContext(
    extractFunction(publicSnapshotExporterSource, 'buildPublicSnapshotTop40Registrations_'),
    context,
  )
  return context.buildPublicSnapshotTop40Registrations_({ names }, snapshotGeneratedAt)
}

assert.deepEqual(JSON.parse(JSON.stringify(buildSanitizedRegistration([]))), {
  generatedAt: snapshotGeneratedAt,
  players: [],
})
assert.deepEqual(JSON.parse(JSON.stringify(buildSanitizedRegistration(['  Solo  Player  ']))), {
  generatedAt: snapshotGeneratedAt,
  players: [{ name: 'Solo Player', position: 1 }],
})
assert.deepEqual(JSON.parse(JSON.stringify(buildSanitizedRegistration([
  '  Alpha  Wolf  ',
  'alpha wolf',
  '   ',
  'Bad\u0007Name',
  'Bravo',
]))), {
  generatedAt: snapshotGeneratedAt,
  players: [{ name: 'Alpha Wolf', position: 1 }, { name: 'Bravo', position: 2 }],
})

for (const count of [40, 45]) {
  const registration = buildSanitizedRegistration(
    Array.from({ length: count }, (_, index) => `Player ${index + 1}`),
  )
  assert.equal(registration.players.length, 40)
  assert.equal(registration.players[39].position, 40)
}

const privacyFixture = buildSanitizedRegistration(['Public Player'])
const serializedRegistration = JSON.stringify(privacyFixture)
assert.deepEqual(Object.keys(privacyFixture).sort(), ['generatedAt', 'players'])
assert.deepEqual(Object.keys(privacyFixture.players[0]).sort(), ['name', 'position'])
for (const forbidden of [
  'email', 'discord', 'agreement', 'timestamp', 'spreadsheet', 'formId', 'rowNumber',
  'private@example.com', 'private-discord', 'I agree',
]) {
  assert.equal(serializedRegistration.toLowerCase().includes(forbidden.toLowerCase()), false)
}

assert.match(publicSnapshotExporterSource, /function readPublicSnapshotTop40RegistrationNames_\(\)[\s\S]*lifGetTargetSpreadsheet_\(\)/)
for (const header of [
  'Timestamp', 'Email address', 'Lobo Portal User Name', 'Discord Name', 'Tournament Rules agreement',
]) assert.ok(publicSnapshotExporterSource.includes(`"${header}"`))
assert.match(publicSnapshotExporterSource, /PUBLIC_SNAPSHOT_TOP40_REGISTRATION_SHEET = "Form Responses 2"/)
assert.match(publicSnapshotExporterSource, /getSheetByName\(PUBLIC_SNAPSHOT_TOP40_REGISTRATION_SHEET\)/)
assert.match(publicSnapshotExporterSource, /normalizedHeaders\.indexOf\("lobo portal user name"\)/)
assert.doesNotMatch(publicSnapshotExporterSource, /"Discord Username"|"Email Address"|"Lobo Portal Name"|"I have read and agree to the tournament rules"/)
assert.match(publicSnapshotExporterSource, /portalNameColumn[\s\S]*getRange\(2, source\.portalNameColumn, lastRow - 1, 1\)/)
assert.match(publicSnapshotExporterSource, /portalNameHeader:[\s\S]*responseWorksheet:/)

const participantHeadersMatch = eventEngineSource.match(
  /const EVENT_ENGINE_PARTICIPANT_HEADERS = \[([\s\S]*?)\];/,
)
assert.ok(participantHeadersMatch, 'Event Participants headers must exist.')
const participantHeaders = Array.from(
  participantHeadersMatch[1].matchAll(/"([^"]+)"/g),
  (match) => match[1],
)
assert.equal(participantHeaders.at(-1), 'ITS Name', 'ITS Name must be appended.')
assert.equal(participantHeaders.filter((header) => header === 'ITS Name').length, 1)
assert.ok(!participantHeaders.includes('ITS ID'))
assert.ok(!participantHeaders.includes('ELO'))

assert.match(eventHomeSource, /data\.event\.type === 'Individual Double Elimination'/)
assert.match(eventHomeSource, />\s*Player\s*</)
assert.match(eventHomeSource, /Corvus Belli ITS Name/)
assert.match(eventHomeSource, />\s*Faction\s*</)
assert.match(eventHomeSource, /registrationRepository\.register\(/)
assert.match(eventHomeSource, /playerRepository\s*\.getAllPlayers/)
assert.match(eventHomeSource, /getCanonicalArmyOptions\(\)\.map/)
const registrationPageSource = eventHomeSource.match(
  /function EventRegistrationPage\([\s\S]*?\nfunction IndividualDoubleEliminationRegistrationForm/,
)?.[0] ?? ''
assert.doesNotMatch(registrationPageSource, /ITS ID|\bELO\b/)
assert.match(registrationPageSource, /individualTournament/)
assert.match(registrationPageSource, /registeredCount\} \/ \$\{data\.registration\.capacity\.maximumPlayers/)
assert.match(registrationPageSource, /!individualTournament \|\| data\.registration\.capacity\.waitlistEnabled/)
assert.match(apiSource, /itsName\?: string/)
assert.match(apiSource, /itsName: getString\(record, 'itsName'\)/)

function createHarness({ eventType = 'Individual Double Elimination', rows = [] } = {}) {
  const state = {
    event: {
      id: 'event-top-40',
      registration: 'Registration Open',
      rules: 'Maximum Players: 40',
      type: eventType,
    },
    invalidations: 0,
    lockHeld: false,
    lockObservedDuringRead: false,
    rows: rows.map((row) => ({ ...row })),
    writes: 0,
  }
  const context = {
    EVENT_ENGINE_DEFAULT_EVENT_ID: 'event-current-league',
    LockService: {
      getScriptLock: () => ({
        releaseLock: () => { state.lockHeld = false },
        waitLock: () => { state.lockHeld = true },
      }),
    },
    buildPlayerRegistry: () => ({
      lobo: { active: true, displayName: 'Lobo', player: 'Lobo' },
      retired: { active: false, displayName: 'Retired', player: 'Retired' },
    }),
    canonicalizeArmyName: (value) => String(value || '').trim(),
    getApiParameters: (event) => event.parameter || {},
    getCanonicalArmyOptions: () => ['ALEPH', 'Corregidor Jurisdictional Command'],
    getCanonicalPlayerFromUser: (user) => user.leaguePlayer || '',
    getCurrentLeagueEventSnapshot: () => ({ id: 'event-current-league', type: 'League' }),
    getEventByIdSnapshot: () => state.event,
    getRequestUser: (event) => event.auth || { authenticated: false, user: null },
    invalidateEventRegistrationCaches: () => { state.invalidations++ },
    jsonOutput: (value) => value,
    resolveEventId: (value) => value,
  }
  vm.createContext(context)
  vm.runInContext(registrationSource, context)
  Object.assign(context, {
    getEventRegistration: () => ({ success: true, registration: { registeredCount: state.rows.length } }),
    getEventRegistrationForPlayer: (_eventId, player) => {
      state.lockObservedDuringRead ||= state.lockHeld
      return state.rows.find((row) => row.player.toLowerCase() === String(player).toLowerCase()) || null
    },
    getEventRegistrationRows: () => {
      state.lockObservedDuringRead ||= state.lockHeld
      return state.rows
    },
    invalidateEventRegistrationCaches: () => { state.invalidations++ },
    upsertEventRegistrationRow: (_eventId, user, params, status) => {
      state.writes++
      const existing = state.rows.find((row) => row.player === user.leaguePlayer)
      const value = {
        faction: params.faction || '',
        itsName: params.itsName || existing?.itsName || '',
        player: user.leaguePlayer,
        status,
      }
      if (existing) Object.assign(existing, value)
      else state.rows.push(value)
    },
  })
  return { context, state }
}

function request(overrides = {}) {
  return {
    parameter: {
      eventId: 'event-top-40',
      faction: 'ALEPH',
      itsName: '  Lobo ITS  ',
      player: 'Lobo',
      ...overrides,
    },
  }
}

for (const eventType of ['League', 'Team Tournament', 'Custom']) {
  const { context, state } = createHarness({ eventType })
  const response = context.registerForEvent(request())
  assert.equal(response.error, 'Authentication is required.')
  assert.equal(state.writes, 0)
}

{
  const { context, state } = createHarness()
  const response = context.registerForEvent(request())
  assert.equal(response.success, true)
  assert.equal(state.writes, 1)
  assert.equal(state.rows[0].player, 'Lobo')
  assert.equal(state.rows[0].itsName, 'Lobo ITS')
  assert.equal(state.rows[0].faction, 'ALEPH')
  assert.equal(state.lockObservedDuringRead, true, 'Duplicate and capacity reads must occur under lock.')
}

for (const [field, value] of [['player', ''], ['itsName', '   '], ['faction', 'Unknown Army']]) {
  const { context, state } = createHarness()
  const response = context.registerForEvent(request({ [field]: value }))
  assert.equal(response.success, false)
  assert.equal(state.writes, 0)
}

{
  const { context, state } = createHarness()
  const response = context.registerForEvent(request({ player: 'Retired' }))
  assert.equal(response.success, false)
  assert.equal(state.writes, 0)
}

{
  const { context, state } = createHarness({
    rows: [{ player: 'Lobo', status: 'Registered', itsName: 'Original' }],
  })
  const response = context.registerForEvent(request({ itsName: 'Overwrite' }))
  assert.equal(response.code, 'ALREADY_REGISTERED')
  assert.equal(state.writes, 0)
  assert.equal(state.rows[0].itsName, 'Original')
}

{
  const rows = Array.from({ length: 39 }, (_, index) => ({
    player: `Player ${index + 1}`,
    status: 'Registered',
  }))
  const { context, state } = createHarness({ rows })
  assert.equal(context.registerForEvent(request()).success, true)
  assert.equal(state.rows.filter((row) => row.status === 'Registered').length, 40)
}

{
  const rows = Array.from({ length: 40 }, (_, index) => ({
    player: `Player ${index + 1}`,
    status: 'Registered',
  }))
  const { context, state } = createHarness({ rows })
  const response = context.registerForEvent(request())
  assert.equal(response.code, 'CAPACITY_FULL')
  assert.equal(state.writes, 0)

  assert.throws(
    () => context.upsertManagedEventRegistrationRow(
      'event-top-40',
      { leaguePlayer: 'Commissioner Add' },
      {},
      'Registered',
    ),
    /Registration is full/,
  )
  assert.equal(state.writes, 0)

  context.upsertManagedEventRegistrationRow(
    'event-top-40',
    { leaguePlayer: 'Player 1' },
    { faction: 'ALEPH' },
    'Registered',
  )
  assert.equal(state.rows.filter((row) => row.status === 'Registered').length, 40)

  context.upsertManagedEventRegistrationRow(
    'event-top-40',
    { leaguePlayer: 'Player 1' },
    {},
    'Removed',
  )
  assert.equal(state.rows.find((row) => row.player === 'Player 1').status, 'Removed')
}

assert.match(registrationSource, /function withdrawEventRegistration[\s\S]*?if \(!auth\.authenticated\)/)
assert.match(registrationSource, /itsName: row\["ITS Name"\] \|\| ""/)
assert.doesNotMatch(registrationSource, /ITS ID|\bELO\b/)
assert.doesNotMatch(registrationSource, /Game Engine|Army Intelligence|Bracket|Seed input/)

const browserBaseUrl = process.env.TOP40_REGISTRATION_BASE_URL?.replace(/\/$/, '')
if (browserBaseUrl) {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const scenario of [
      {
        count: 2,
        players: [{ position: 1, name: 'Alpha Wolf' }, { position: 2, name: 'Bravo' }],
        status: 'OPEN',
        width: 1280,
      },
      {
        count: 40,
        players: Array.from({ length: 40 }, (_, index) => ({ position: index + 1, name: `Player ${index + 1}` })),
        status: 'FULL',
        width: 390,
      },
    ]) {
      const page = await browser.newPage({ viewport: { height: 900, width: scenario.width } })
      const requests = []
      page.on('request', (request) => requests.push(request.url()))
      await page.route('**/public-snapshots/current.json', (route) => route.fulfill({
        body: JSON.stringify({
          schemaVersion: 1,
          snapshotId: '20260907T220000Z',
          sourceCutoff: snapshotGeneratedAt,
          basePath: 'public-snapshots/20260907T220000Z/',
        }),
        contentType: 'application/json',
        status: 200,
      }))
      await page.route('**/public-snapshots/20260907T220000Z/top-40-registrations.json', (route) => route.fulfill({
        body: JSON.stringify({
          schemaVersion: 1,
          snapshotId: '20260907T220000Z',
          sourceCutoff: snapshotGeneratedAt,
          data: { generatedAt: snapshotGeneratedAt, players: scenario.players },
        }),
        contentType: 'application/json',
        status: 200,
      }))
      await page.goto(`${browserBaseUrl}/event/event-lobo-s-american-top-40/registration`, { waitUntil: 'domcontentloaded' })
      await page.locator('#top40-registration-title').waitFor()
      await page.getByText(`${scenario.count} / 40 PLAYERS REGISTERED`).waitFor()
      await page.getByText(scenario.status, { exact: true }).waitFor()
      assert.equal(await page.locator('.top40-registration-list li').count(), scenario.count)
      assert.equal(await page.getByRole('link', { name: 'REGISTER NOW' }).getAttribute('href'), registrationFormUrl)
      assert.equal(await page.getByRole('link', { name: 'REGISTER NOW' }).getAttribute('target'), '_blank')
      assert.equal(
        await page.getByRole('navigation', { name: 'Event navigation' }).getByRole('link', { name: 'Registration' }).getAttribute('aria-current'),
        'page',
      )
      const image = page.locator('.top40-registration-hero img')
      await image.waitFor()
      assert.equal(await image.evaluate((node) => node.complete && node.naturalWidth === 1672 && node.naturalHeight === 941), true)
      assert.equal(await image.evaluate((node) => getComputedStyle(node).objectFit), 'contain')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true)
      const html = await page.locator('body').innerText()
      for (const privateValue of ['private@example.com', 'private-discord', 'I agree', 'Loading registration snapshot', 'HTTP 500']) {
        assert.equal(html.includes(privateValue), false)
      }
      assert.ok(html.includes('Updated twice daily'))
      assert.ok(html.includes('Last updated:'))
      assert.equal(requests.filter((url) => /public-snapshots\/current\.json/.test(url)).length, 1)
      assert.equal(requests.filter((url) => /top-40-registrations\.json/.test(url)).length, 1)
      assert.equal(requests.some((url) => /public-event-projection|script\.google|docs\.google\.com\/forms|spreadsheets|registration(?:-data)?\/api/i.test(url)), false)
      if (scenario.status === 'FULL') await page.getByText('reached its 40-player capacity', { exact: false }).waitFor()
      await page.close()
    }
  } finally {
    await browser.close()
  }
}

console.log('Top 40 anonymous registration checks passed')
