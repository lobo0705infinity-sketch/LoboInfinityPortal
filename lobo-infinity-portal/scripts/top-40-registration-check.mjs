import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

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
assert.doesNotMatch(eventHomeSource, /ITS ID|\bELO\b/)
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

console.log('Top 40 anonymous registration checks passed')
