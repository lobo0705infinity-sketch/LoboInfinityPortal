import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

const files = {
  authApi: read('backend/AuthApi.gs'),
  identityService: read('backend/IdentityService.gs'),
  myProfile: read('src/pages/MyProfile.tsx'),
  api: read('src/services/api.ts'),
  authContext: read('src/auth/AuthContext.tsx'),
  playersApi: read('backend/PlayersApi.gs'),
  dashboard: read('src/pages/Dashboard.tsx'),
  playerLeagueModel: read('src/services/playerLeagueModel.ts'),
}

const syncUserIdentityBody = extractFunction(files.authApi, 'syncUserIdentity')
const profileDashboardBody = extractFunction(files.myProfile, 'ProfileDashboard')
const eventParticipantsRecoveryBody = extractFunction(
  files.identityService,
  'resolveCanonicalPlayerIdentityFromEventParticipants',
)

const checks = [
  {
    label: 'Profile edits are available to every authenticated Portal user',
    pass:
      files.authApi.includes('updateProfile: USER_ROLES.GUEST') &&
      files.authApi.includes('return requireApiPermission(\n    e,\n    "updateProfile"'),
  },
  {
    label: 'Display names are validated server-side',
    pass:
      files.authApi.includes('validatePortalDisplayName') &&
      files.authApi.includes('PORTAL_DISPLAY_NAME_RESERVED') &&
      files.authApi.includes('That display name is already in use.'),
  },
  {
    label: 'Google login no longer overwrites existing portal display names',
    pass:
      syncUserIdentityBody !== '' &&
      !syncUserIdentityBody.includes('columns.displayName') &&
      !syncUserIdentityBody.includes('verified.displayName'),
  },
  {
    label: 'Existing league users migrate from Google name to league identity',
    pass:
      files.authApi.includes('function migratePortalDisplayName') &&
      files.authApi.includes('leagueDisplayName') &&
      files.authApi.includes('currentDisplayName.toLowerCase() !== googleDisplayName.toLowerCase()'),
  },
  {
    label: 'Display name changes sync public player references',
    pass:
      files.authApi.includes('setLeaguePlayerDisplayName') &&
      files.authApi.includes('syncEventParticipantDisplayName'),
  },
  {
    label: 'Profile saves invalidate only identity-facing cache groups',
    pass:
      files.authApi.includes('invalidatePortalIdentityCaches') &&
      files.authApi.includes('invalidatePortalCacheGroup("players")') &&
      files.authApi.includes('invalidatePortalCacheGroup("search")'),
  },
  {
    label: 'Community registry prefers Portal display names',
    pass:
      files.playersApi.includes('if (input.portalUser)') &&
      files.playersApi.includes('record.displayName ='),
  },
  {
    label: 'Frontend profile model includes identity fields',
    pass:
      files.api.includes('canonicalPlayer: string') &&
      files.api.includes('discordName: string') &&
      files.api.includes('profileVisibility: string') &&
      files.authContext.includes("canonicalPlayer: ''") &&
      files.authContext.includes("profileVisibility: 'Public'"),
  },
  {
    label: 'My Profile league resolution uses canonical player identity only',
    pass:
      files.identityService.includes('function getAuthCanonicalPlayerIdentityByEmail') &&
      files.identityService.includes('buildCommunityLeagueIdentityByEmailMap') &&
      files.authApi.includes('canonicalPlayer: leagueIdentity.player') &&
      files.myProfile.includes('[data.user.canonicalPlayer]') &&
      !files.myProfile.includes('data.user.leaguePlayer,\n      data.user.playerDisplayName') &&
      files.api.includes("canonicalPlayer: getString(record, 'canonicalPlayer')") &&
      files.myProfile.includes('resolveMyProfileLeagueModel(data, allStandings)') &&
      files.myProfile.includes('getMyProfileCompetitivePlayerName(data, leagueModel)') &&
      files.myProfile.includes('buildProfileDerivedData(data, leaguePlayer, seasonStats)') &&
      files.myProfile.includes('<ProfileHero') &&
      files.myProfile.includes('leaguePlayer={leaguePlayer}'),
  },
  {
    label: 'Authenticated profiles include sanitized event registrations',
    pass:
      files.authApi.includes('function getProfileEventRegistrations') &&
      files.authApi.includes('getEventParticipantKey(event, user)') &&
      files.authApi.includes('eventRegistrations:\n          getProfileEventRegistrations(user)') &&
      files.api.includes("eventRegistrations: getArray(record, 'eventRegistrations') as EventParticipant[]"),
  },
  {
    label: 'My Profile uses configured event names for league/tournament labels',
    pass:
      files.authApi.includes('CONFIG.SHEETS.EVENT_PARTICIPANTS') &&
      files.myProfile.includes('function getCurrentLeagueLabel') &&
      files.myProfile.includes('return getConfiguredEventDisplayName({') &&
      files.myProfile.includes('eventName: leagueModel?.currentLeague') &&
      files.myProfile.includes('tournament.eventName ||') &&
      files.playersApi.includes('function getRegisteredEventsForPlayer'),
  },
  {
    label: 'League, division, and rank resolve from current standings/Event Engine data',
    pass:
      files.authApi.includes('currentSeasonStatistics:\n      buildProfileStatisticsSnapshot(playerStats)') &&
      files.authApi.includes('const playerStats =\n    getUserLeagueStatistics(user)') &&
      files.authApi.includes('getCanonicalPlayerFromUser(user)') &&
      files.authApi.includes('function resolveIdentityDiagnosticsStanding(canonicalPlayer)') &&
      files.authApi.includes('division.event && division.event.name') &&
      files.playerLeagueModel.includes('currentLeague: getConfiguredEventDisplayName({') &&
      files.playerLeagueModel.includes('eventName: division.event?.name') &&
      files.playerLeagueModel.includes('division: standing.division || division.divisionLabel') &&
      files.playerLeagueModel.includes('rank: standing.rank'),
  },
  {
    label: 'Legacy identity fields are compatibility fields, not authoritative competitive keys',
    pass:
      files.identityService.includes('function getCanonicalPlayerFromUser(user)') &&
      files.identityService.includes('getIdentityServiceString(user.canonicalPlayer) ||') &&
      files.identityService.includes('getIdentityServiceString(user.leaguePlayer)') &&
      files.authApi.includes('canonicalPlayer: leagueIdentity.player') &&
      files.api.includes("canonicalPlayer: getString(record, 'canonicalPlayer')") &&
      files.dashboard.includes('const authenticatedCanonicalPlayer = auth.user.canonicalPlayer ||') &&
      !files.authApi.includes('resolveIdentityDiagnosticsStanding(user.leaguePlayer)') &&
      !files.authApi.includes('resolveIdentityDiagnosticsStanding(user.displayName)'),
  },
  {
    label: 'Event Participant recovery matches by email only, never display name',
    pass:
      eventParticipantsRecoveryBody.includes('const rowEmail =') &&
      eventParticipantsRecoveryBody.includes('if (rowEmail !== email)') &&
      !eventParticipantsRecoveryBody.includes('displayName.toLowerCase() === email') &&
      !eventParticipantsRecoveryBody.includes('row[displayNameCol]).toLowerCase() === email'),
  },
  {
    label: 'Event Participant recovery fails precisely for no match and duplicates',
    pass:
      eventParticipantsRecoveryBody.includes('"NO_RECOVERY_MATCH"') &&
      eventParticipantsRecoveryBody.includes('"DUPLICATE_MATCH"') &&
      eventParticipantsRecoveryBody.includes('"RECOVERED_EVENT_PARTICIPANT_MATCH"') &&
      files.authApi.includes('case "DUPLICATE_MATCH":') &&
      files.authApi.includes('case "NO_RECOVERY_MATCH":'),
  },
  {
    label: 'Favorite army profile display uses canonical army names',
    pass:
      files.playersApi.includes('canonicalizeArmyName(row[CONFIG.ENGINE.FACTION])') &&
      files.myProfile.includes('normalizeProfileArmyMetric') &&
      files.myProfile.includes('normalizeArmyForDisplay') &&
      files.myProfile.includes('list.sectorial || list.faction'),
  },
  {
    label: 'My Profile exposes an Edit Profile workflow',
    pass:
      files.myProfile.includes('function ProfileEditor') &&
      files.myProfile.includes('Save Profile') &&
      files.myProfile.includes('auth.refreshSession()'),
  },
]

const failures = checks.filter((check) => !check.pass)
const recoveryChecks = runRecoveryBehaviorChecks()
const recoveryFailures = recoveryChecks.filter((check) => !check.pass)

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`)
}

for (const check of recoveryChecks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`)
}

if (failures.length > 0 || recoveryFailures.length > 0) {
  process.exitCode = 1
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`)

  if (start === -1) {
    return ''
  }

  const braceStart = source.indexOf('{', start)
  let depth = 0

  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index]

    if (char === '{') {
      depth += 1
    }

    if (char === '}') {
      depth -= 1
    }

    if (depth === 0) {
      return source.slice(braceStart, index + 1)
    }
  }

  return ''
}

function runRecoveryBehaviorChecks() {
  const activeRows = [
    {
      email: 'player@example.com',
      player: 'Canonical Player',
      displayName: 'Display Alias',
      status: 'Approved',
    },
  ]
  const duplicateRows = [
    ...activeRows,
    {
      email: 'player@example.com',
      player: 'Second Canonical Player',
      displayName: 'Second Alias',
      status: 'Approved',
    },
  ]
  const displayNameOnlyRows = [
    {
      email: 'other@example.com',
      player: 'Display Name Target',
      displayName: 'player@example.com',
      status: 'Approved',
    },
  ]

  return [
    {
      label: 'Recovery accepts exactly one authoritative Event Participant email match',
      pass:
        resolveRecovery(activeRows, 'player@example.com').status ===
          'RECOVERED_EVENT_PARTICIPANT_MATCH' &&
        resolveRecovery(activeRows, 'player@example.com').player === 'Canonical Player',
    },
    {
      label: 'Recovery fails precisely when no Event Participant email matches',
      pass:
        resolveRecovery(activeRows, 'missing@example.com').status === 'NO_RECOVERY_MATCH' &&
        resolveRecovery(activeRows, 'missing@example.com').player === '',
    },
    {
      label: 'Recovery fails as duplicate when multiple Event Participant email rows match',
      pass:
        resolveRecovery(duplicateRows, 'player@example.com').status ===
          'DUPLICATE_MATCH' &&
        resolveRecovery(duplicateRows, 'player@example.com').player === '',
    },
    {
      label: 'Recovery never resolves competitive identity from display name alone',
      pass:
        resolveRecovery(displayNameOnlyRows, 'player@example.com').status === 'NO_RECOVERY_MATCH' &&
        resolveRecovery(displayNameOnlyRows, 'player@example.com').player === '',
    },
    {
      label: 'Recovery ignores inactive Event Participant rows',
      pass:
        resolveRecovery(
          [
            {
              email: 'player@example.com',
              player: 'Withdrawn Player',
              displayName: 'Withdrawn Player',
              status: 'Withdrawn',
            },
          ],
          'player@example.com',
        ).status === 'NO_RECOVERY_MATCH',
    },
  ]
}

function resolveRecovery(rows, email) {
  const normalized = String(email ?? '').trim().toLowerCase()
  const matches = rows.filter((row) => {
    if (String(row.email ?? '').trim().toLowerCase() !== normalized) {
      return false
    }

    if (isInactiveStatus(row.status)) {
      return false
    }

    return String(row.player ?? '').trim() !== ''
  })

  if (matches.length === 0) {
    return { player: '', status: 'NO_RECOVERY_MATCH' }
  }

  if (matches.length > 1) {
    return { player: '', status: 'DUPLICATE_MATCH' }
  }

  return {
    player: String(matches[0].player).trim(),
    status: 'RECOVERED_EVENT_PARTICIPANT_MATCH',
  }
}

function isInactiveStatus(status) {
  return new Set([
    'archived',
    'canceled',
    'cancelled',
    'complete',
    'completed',
    'deleted',
    'disabled',
    'removed',
    'retired',
    'withdrawn',
  ]).has(String(status ?? '').trim().toLowerCase())
}
