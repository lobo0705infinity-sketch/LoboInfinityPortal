import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

const files = {
  playersApi: read('backend/PlayersApi.gs'),
  searchApi: read('backend/SearchApi.gs'),
  submitOpponents: read('src/services/submitGameOpponents.ts'),
}

const checks = [
  {
    label: 'Community Players uses Player Registry when no event scope exists',
    pass:
      files.playersApi.includes('isCommunityPlayerRegistryRequest') &&
      files.playersApi.includes('getCommunityPlayerRegistryStandings()') &&
      files.playersApi.includes('buildCommunityPlayerRegistryRows'),
  },
  {
    label: 'Community registry merges enabled Portal Users',
    pass:
      files.playersApi.includes('ensureUsersSheet()') &&
      files.playersApi.includes('getCommunityPortalUsers'),
  },
  {
    label: 'Search/Casual options use Community Player Registry for global requests',
    pass:
      files.searchApi.includes('getCommunityPlayerRegistryStandings()') &&
      files.searchApi.includes('getCommunityPlayerRegistryString(params.eventId) === ""'),
  },
  {
    label: 'League opponents continue using event participant division filtering',
    pass:
      files.submitOpponents.includes('buildLeagueOpponentResolution') &&
      files.submitOpponents.includes('current-division-unresolved') &&
      files.submitOpponents.includes('different-division'),
  },
  {
    label: 'Tournament opponents continue using tournament registrations',
    pass:
      files.submitOpponents.includes('buildTournamentOpponentOptions') &&
      files.submitOpponents.includes('tournamentRegistrations ?? registrations'),
  },
  {
    label: 'Casual opponents consume global player options, not Event Participants',
    pass:
      files.submitOpponents.includes('if (showAllPlayers)') &&
      !files.submitOpponents.includes('casualRegistrations'),
  },
]

const failures = checks.filter((check) => !check.pass)

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`)
}

if (failures.length > 0) {
  process.exitCode = 1
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8')
}
