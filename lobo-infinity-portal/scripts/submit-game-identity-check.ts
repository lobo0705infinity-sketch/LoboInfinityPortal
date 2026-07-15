import assert from 'node:assert/strict'
import { resolveSubmitGamePlayer } from '../src/services/submitGameIdentity.ts'
import {
  buildSubmitGameOpponentEventHome,
  buildSubmitGameOpponentOptions,
  buildSubmitGameOpponentResolution,
  type SubmitGameOpponentOption,
} from '../src/services/submitGameOpponents.ts'
import type { EventHomeData, EventRegistrationEntry } from '../src/services/api.ts'

assert.equal(
  resolveSubmitGamePlayer(false, '', '', '', 'Guest'),
  'Guest',
  'Unauthenticated shell state may display Guest.',
)

assert.equal(
  resolveSubmitGamePlayer(true, '', '', '', 'Guest'),
  '',
  'Authenticated submission must not resolve Guest as a player.',
)

assert.equal(
  resolveSubmitGamePlayer(true, 'Lobo', 'Legacy Lobo', 'Lobo Display', 'Lobo Real Name'),
  'Lobo',
  'League submission should prefer the authenticated canonical player.',
)

assert.equal(
  resolveSubmitGamePlayer(true, '', '', 'Portal Handle', 'Portal Player'),
  'Portal Handle',
  'Casual submission should use the authenticated portal player display name when no league player exists.',
)

assert.equal(
  resolveSubmitGamePlayer(true, '', '', '', 'Casual Player'),
  'Casual Player',
  'Casual submission should fall back to the authenticated portal display name.',
)

const staleCasualPlayer = 'Guest'
const hydratedCasualPlayer =
  resolveSubmitGamePlayer(true, 'Lobo', '', 'Lobo Display', 'Lobo Real Name') ||
  staleCasualPlayer

assert.equal(
  hydratedCasualPlayer,
  'Lobo',
  'Authenticated Casual Game hydration must replace stale Guest with the authenticated player.',
)

const allPlayers: SubmitGameOpponentOption[] = [
  ...divisionPlayerOptions('Main', 'Main Man'),
  ...divisionPlayerOptions('PGA', 'Proving Grounds A'),
  ...divisionPlayerOptions('PGB', 'Proving Grounds B'),
]

const tournamentRegistrations = [
  ...divisionRegistrations('Main', 'Main Man'),
  ...divisionRegistrations('PGA', 'Proving Grounds A'),
  ...divisionRegistrations('PGB', 'Proving Grounds B'),
  registration('Withdrawn Player', 'Proving Grounds B', 'Withdrawn'),
  registration('Deleted Player', 'Main Man', 'Deleted'),
]

const productionShapedLeagueRegistrations = tournamentRegistrations.map((entry) => ({
  ...entry,
  notes: '',
}))

for (const [player, division] of [
  ['Main 1', 'Main Man'],
  ['PGA 1', 'Proving Grounds A'],
  ['PGB 1', 'Proving Grounds B'],
] as const) {
  const opponents = buildSubmitGameOpponentOptions({
    allPlayers,
    currentPlayer: player,
    currentPlayerDivision: division,
    eventHome: eventHome('Team Tournament', tournamentRegistrations, player),
    showAllPlayers: false,
    tournamentRegistrations,
  }).map((option) => option.value)

  assert.deepEqual(
    opponents.sort(),
    tournamentRegistrations
      .filter((entry) => entry.status === 'Approved')
      .map((entry) => entry.player)
      .filter((name) => name !== player)
      .sort(),
    `Tournament submission for ${division} must include all tournament participants except self.`,
  )
}

assert.deepEqual(
  buildSubmitGameOpponentOptions({
    allPlayers,
    currentPlayer: 'PGB 1',
    currentPlayerDivision: 'Proving Grounds B',
    eventHome: eventHome('League', tournamentRegistrations, 'PGB 1'),
    showAllPlayers: false,
  }).map((option) => option.value).sort(),
  ['PGB 2', 'PGB 3', 'PGB 4', 'PGB 5', 'PGB 6', 'PGB 7', 'PGB 8', 'PGB 9', 'PGB 10'].sort(),
  'League submission must remain restricted to the authenticated player division.',
)

for (const [player, profileDivision, expectedPrefix] of [
  ['Main 1', 'Main Man', 'Main'],
  ['PGA 1', 'Proving Grounds A', 'PGA'],
  ['PGB 1', 'Proving Grounds B', 'PGB'],
] as const) {
  const resolution = buildSubmitGameOpponentResolution({
    allPlayers,
    currentPlayer: player,
    currentPlayerDivision: profileDivision,
    eventHome: eventHome('League', tournamentRegistrations, player),
    showAllPlayers: false,
  })

  assert.equal(
    resolution.options.length,
    9,
    `${profileDivision} league submission must resolve nine division opponents.`,
  )

  assert.ok(
    resolution.options.every((option) => option.value.startsWith(`${expectedPrefix} `)),
    `${profileDivision} league submission must not include other divisions.`,
  )
}

for (const [player, expectedDivision, expectedPrefix] of [
  ['Main 1', 'main', 'Main'],
  ['PGA 1', 'pga', 'PGA'],
  ['PGB 1', 'pgb', 'PGB'],
] as const) {
  const resolution = buildSubmitGameOpponentResolution({
    allPlayers,
    currentPlayer: player,
    currentPlayerDivision: '',
    eventHome: eventHome('League', productionShapedLeagueRegistrations, player),
    showAllPlayers: false,
  })

  printLeagueResolutionReport(player, resolution)

  assert.equal(
    resolution.resolvedDivision,
    expectedDivision,
    `${player} must resolve division from Player Registry/Search metadata when Event Participant notes are blank.`,
  )

  assert.equal(
    resolution.options.length,
    9,
    `${player} must resolve nine division opponents from production-shaped current league participants.`,
  )

  assert.ok(
    resolution.options.every((option) => option.value.startsWith(`${expectedPrefix} `)),
    `${player} must not include players outside ${expectedPrefix}.`,
  )
}

const staleProfilePgbResolution = buildSubmitGameOpponentResolution({
  allPlayers,
  currentPlayer: 'PGB 1',
  currentPlayerDivision: 'Proving Grounds A',
  eventHome: eventHome('League', tournamentRegistrations, 'PGB 1'),
  showAllPlayers: false,
})

assert.equal(
  staleProfilePgbResolution.resolvedDivision,
  'pgb',
  'Current event participant row must override a stale profile division.',
)

assert.equal(
  staleProfilePgbResolution.options.length,
  9,
  'PGB league submission must still resolve nine opponents when profile division is stale.',
)

const normalLeagueMemberHome = eventHome(
  'League',
  [registration('PGB 1', '', 'Active')],
  'PGB 1',
  productionShapedLeagueRegistrations
    .filter((entry) => entry.player.startsWith('PGB ') && entry.player !== 'PGB 1')
    .map((entry) => ({
      active: true,
      division: 'Proving Grounds B',
      playerId: entry.player,
      playerName: entry.displayName,
    })),
)

assert.equal(
  normalLeagueMemberHome.registration.registrations.length,
  1,
  'Normal League Member payload must keep private registrations scoped to current player only.',
)

assert.equal(
  normalLeagueMemberHome.eligibleOpponents.length,
  9,
  'Normal League Member payload must include nine public eligible league opponents.',
)

const normalLeagueMemberResolution = buildSubmitGameOpponentResolution({
  allPlayers,
  currentPlayer: 'PGB 1',
  currentPlayerDivision: 'Proving Grounds B',
  eventHome: buildSubmitGameOpponentEventHome(normalLeagueMemberHome),
  showAllPlayers: false,
})

assert.deepEqual(
  normalLeagueMemberResolution.options.map((option) => option.value).sort(),
  ['PGB 2', 'PGB 3', 'PGB 4', 'PGB 5', 'PGB 6', 'PGB 7', 'PGB 8', 'PGB 9', 'PGB 10'].sort(),
  'Normal League Member opponent resolution must use eligibleOpponents instead of private registrations.',
)

assert.deepEqual(
  buildSubmitGameOpponentOptions({
    allPlayers,
    currentPlayer: 'PGB 1',
    currentPlayerDivision: 'Proving Grounds B',
    eventHome: eventHome('Team Tournament', tournamentRegistrations, 'PGB 1'),
    showAllPlayers: true,
  }).map((option) => option.value).sort(),
  allPlayers.map((option) => option.value).filter((name) => name !== 'PGB 1').sort(),
  'Commissioner override should use the global player registry except self.',
)

assert.deepEqual(
  buildSubmitGameOpponentOptions({
    allPlayers,
    currentPlayer: 'Unregistered Player',
    currentPlayerDivision: '',
    eventHome: eventHome('Team Tournament', tournamentRegistrations, 'Unregistered Player'),
    showAllPlayers: false,
    tournamentRegistrations,
  }).map((option) => option.value).sort(),
  allPlayers.map((option) => option.value).sort(),
  'Tournament opponent options should still come from tournament registrations when the user is not registered.',
)

console.log('submit game identity and opponent checks passed')

function eventHome(
  eventType: string,
  registrations: EventRegistrationEntry[],
  currentPlayer: string,
  eligibleOpponents = registrations.map((entry) => ({
    active: !['Deleted', 'Removed', 'Withdrawn'].includes(entry.status),
    division: entry.notes,
    playerId: entry.player,
    playerName: entry.displayName,
  })),
): EventHomeData {
  return {
    currentRound: null,
    eligibleOpponents,
    event: {
      achievements: '',
      archive: '',
      automation: '',
      capabilities: [],
      commissioners: '',
      communityId: '',
      createdAt: '',
      description: '',
      discord: '',
      endDate: '',
      history: '',
      id: eventType === 'League' ? 'event-current-league' : 'event-team-tournament',
      lifecycleStage: 'active',
      name: eventType,
      owner: '',
      participants: '',
      registration: '',
      rules: '',
      scoringModel: '',
      seriesId: '',
      standingsModel: '',
      startDate: '',
      status: 'active',
      templateId: '',
      type: eventType,
      updatedAt: '',
    },
    navigation: [],
    news: [],
    playerStatus: {
      captain: false,
      currentTeam: '',
      notifications: [],
      outstandingAction: '',
      registrationStatus: '',
      upcomingMatch: 'PGB Two',
    },
    quickActions: [],
    registration: {
      capacity: {
        maximumPlayers: 0,
        maximumTeams: 0,
        unlimited: true,
        waitlistEnabled: false,
      },
      captains: [],
      currentPlayer: registrations.find((entry) => entry.player === currentPlayer) ?? null,
      eventId: eventType === 'League' ? 'event-current-league' : 'event-team-tournament',
      eventName: eventType,
      eventType,
      freeAgents: [],
      registeredCount: registrations.length,
      registrationOpen: false,
      registrationWindow: {
        endDate: '',
        startDate: '',
      },
      registrations,
      status: 'closed',
      teamCount: 0,
      teams: [],
      waitlistCount: 0,
    },
    rounds: [],
    statistics: {
      completedGames: 0,
      completionPercentage: 0,
      currentRound: '',
      gamesRemaining: 0,
      lifecycleStage: '',
      registeredPlayers: registrations.length,
      registrationStatus: '',
      teams: 0,
    },
    timeline: [],
  }
}

function registration(
  player: string,
  division: string,
  status: string,
): EventRegistrationEntry {
  return {
    captain: false,
    discord: '',
    displayName: player,
    email: '',
    eventId: '',
    faction: '',
    freeAgent: false,
    notes: division,
    player,
    preferredTeam: '',
    registeredAt: '',
    role: '',
    seed: '',
    status,
    team: '',
    updatedAt: '',
  }
}

function divisionPlayerOptions(
  prefix: 'Main' | 'PGA' | 'PGB',
  division: string,
) {
  return Array.from({ length: 10 }, (_, index) => {
    const player = `${prefix} ${index + 1}`
    return {
      label: player,
      meta: division,
      value: player,
    }
  })
}

function divisionRegistrations(
  prefix: 'Main' | 'PGA' | 'PGB',
  division: string,
) {
  return divisionPlayerOptions(prefix, division).map((player) =>
    registration(player.value, division, 'Approved'),
  )
}

function printLeagueResolutionReport(
  authenticatedPlayer: string,
  resolution: ReturnType<typeof buildSubmitGameOpponentResolution>,
) {
  const currentDivisionExclusions = resolution.exclusions.filter(
    (entry) => entry.division === resolution.resolvedDivision,
  )
  const divisionParticipantCount =
    resolution.options.length + currentDivisionExclusions.length

  console.log(
    'SUBMIT_GAME_LEAGUE_OPPONENT_RESOLUTION',
    JSON.stringify(
      {
        authenticatedPlayer,
        resolvedDivision: resolution.resolvedDivision || '(unresolved)',
        eventParticipantRow: resolution.currentRegistration,
        totalEventParticipantCount: resolution.participantCount,
        divisionParticipantCount,
        eligibleOpponentCount: resolution.options.length,
        eligibleOpponents: resolution.options.map((option) => option.value),
        excludedPlayers: resolution.exclusions.map((entry) => ({
          player: entry.player,
          division: entry.division || '(unresolved)',
          status: entry.status,
          reason: entry.reason,
        })),
      },
      null,
      2,
    ),
  )
}
