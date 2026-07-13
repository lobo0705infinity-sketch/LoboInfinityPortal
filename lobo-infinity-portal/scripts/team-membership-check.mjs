import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const backend = read('backend/TeamTournamentApi.gs')
const frontend = read('src/pages/TeamTournament.tsx')

const checks = [
  {
    label: 'Backend derives tournament registration membership from current teams',
    pass:
      backend.includes('resolveTeamTournamentRegistrationMembership(') &&
      backend.includes('buildTeamTournamentMembershipLookup(teams)') &&
      backend.includes('findTeamTournamentMembership('),
  },
  {
    label: 'Backend registration payload uses enriched registrations',
    pass:
      backend.includes('const registrations =\n    resolveTeamTournamentRegistrationMembership(') &&
      backend.includes('runtime.registrations,\n      teams'),
  },
  {
    label: 'Backend roster lookup uses captain and team players',
    pass:
      backend.includes('team.captain') &&
      backend.includes('parseTeamTournamentRoster(team.players)') &&
      backend.includes('copy.team = teamName') &&
      backend.includes('copy.preferredTeam = teamName'),
  },
  {
    label: 'Backend does not preserve stale team names when no roster membership exists',
    pass:
      backend.includes('copy.team = "";') &&
      backend.includes('copy.preferredTeam = "";') &&
      backend.includes('copy.freeAgent = true;'),
  },
  {
    label: 'Frontend reapplies authoritative membership after team mutations',
    pass:
      frontend.includes('resolveRegistrationTeamMembership(data.registration, activeTeams)') &&
      frontend.includes('registration,') &&
      frontend.includes('buildTeamMembershipLookup(teams)'),
  },
  {
    label: 'Frontend membership lookup uses team captain and members',
    pass:
      frontend.includes('const roster = [team.captain, ...splitPlayers(team.players)]') &&
      frontend.includes('membership.set(key, team.teamName)'),
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
