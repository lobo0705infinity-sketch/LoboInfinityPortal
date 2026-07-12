import assert from 'node:assert/strict'
import { resolveSubmitGamePlayer } from '../src/services/submitGameIdentity.ts'
import {
  buildSubmitGameOpponentOptions,
  type SubmitGameOpponentOption,
} from '../src/services/submitGameOpponents.ts'
import type { EventHomeData, EventRegistrationEntry } from '../src/services/api.ts'

assert.equal(
  resolveSubmitGamePlayer(false, '', '', 'Guest'),
  'Guest',
  'Unauthenticated shell state may display Guest.',
)

assert.equal(
  resolveSubmitGamePlayer(true, '', '', 'Guest'),
  '',
  'Authenticated submission must not resolve Guest as a player.',
)

assert.equal(
  resolveSubmitGamePlayer(true, 'Lobo', 'Lobo Display', 'Lobo Real Name'),
  'Lobo',
  'League submission should prefer the authenticated league player.',
)

assert.equal(
  resolveSubmitGamePlayer(true, '', 'Portal Handle', 'Portal Player'),
  'Portal Handle',
  'Casual submission should use the authenticated portal player display name when no league player exists.',
)

assert.equal(
  resolveSubmitGamePlayer(true, '', '', 'Casual Player'),
  'Casual Player',
  'Casual submission should fall back to the authenticated portal display name.',
)

const staleCasualPlayer = 'Guest'
const hydratedCasualPlayer =
  resolveSubmitGamePlayer(true, 'Lobo', 'Lobo Display', 'Lobo Real Name') ||
  staleCasualPlayer

assert.equal(
  hydratedCasualPlayer,
  'Lobo',
  'Authenticated Casual Game hydration must replace stale Guest with the authenticated player.',
)

const allPlayers: SubmitGameOpponentOption[] = [
  { label: 'Main One', meta: 'Main Man', value: 'Main One' },
  { label: 'Main Two', meta: 'Main Man', value: 'Main Two' },
  { label: 'PGA One', meta: 'Proving Grounds A', value: 'PGA One' },
  { label: 'PGA Two', meta: 'Proving Grounds A', value: 'PGA Two' },
  { label: 'PGB One', meta: 'Proving Grounds B', value: 'PGB One' },
  { label: 'PGB Two', meta: 'Proving Grounds B', value: 'PGB Two' },
]

const tournamentRegistrations = [
  registration('Main One', 'Main Man', 'Approved'),
  registration('Main Two', 'Main Man', 'Approved'),
  registration('PGA One', 'Proving Grounds A', 'Approved'),
  registration('PGA Two', 'Proving Grounds A', 'Approved'),
  registration('PGB One', 'Proving Grounds B', 'Approved'),
  registration('PGB Two', 'Proving Grounds B', 'Approved'),
  registration('Withdrawn Player', 'Proving Grounds B', 'Withdrawn'),
  registration('Deleted Player', 'Main Man', 'Deleted'),
]

for (const [player, division] of [
  ['Main One', 'Main Man'],
  ['PGA One', 'Proving Grounds A'],
  ['PGB One', 'Proving Grounds B'],
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
    currentPlayer: 'PGB One',
    currentPlayerDivision: 'Proving Grounds B',
    eventHome: eventHome('League', tournamentRegistrations, 'PGB One'),
    showAllPlayers: false,
  }).map((option) => option.value).sort(),
  ['PGB Two'],
  'League submission must remain restricted to the authenticated player division.',
)

assert.deepEqual(
  buildSubmitGameOpponentOptions({
    allPlayers,
    currentPlayer: 'PGB One',
    currentPlayerDivision: 'Proving Grounds B',
    eventHome: eventHome('Team Tournament', tournamentRegistrations, 'PGB One'),
    showAllPlayers: true,
  }).map((option) => option.value).sort(),
  ['Main One', 'Main Two', 'PGA One', 'PGA Two', 'PGB Two'].sort(),
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
  ['Main One', 'Main Two', 'PGA One', 'PGA Two', 'PGB One', 'PGB Two'].sort(),
  'Tournament opponent options should still come from tournament registrations when the user is not registered.',
)

console.log('submit game identity and opponent checks passed')

function eventHome(
  eventType: string,
  registrations: EventRegistrationEntry[],
  currentPlayer: string,
): EventHomeData {
  return {
    currentRound: null,
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
