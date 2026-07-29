import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const backend = read('backend/TeamTournamentApi.gs')
const eventManagerBackend = read('backend/EventManagerApi.gs')
const gameEngine = read('backend/rebuildGameEngine().gs')
const gameEngineBackend = read('backend/GameEngine.gs')
const automationBackend = read('backend/AutomationApi.gs')
const factionBackend = read('backend/FactionApi.gs')
const frontend = read('src/pages/TeamTournament.tsx')
const submitResult = read('src/pages/SubmitResult.tsx')
const eventHomeBackend = read('backend/EventHomeApi.gs')
const eventManagerPanel = read('src/components/EventManagerPanel.tsx')
const api = read('src/services/api.ts')
const resultSubmissionBackend = read('backend/ResultSubmissionApi.gs')

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
      backend.includes('copy.teamId = teamIdentity.teamId') &&
      backend.includes('copy.team = teamIdentity.teamName') &&
      backend.includes('copy.preferredTeam = teamIdentity.teamName'),
  },
  {
    label: 'Backend does not preserve stale team names when no roster membership exists',
    pass:
      backend.includes('copy.teamId = "";') &&
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
      frontend.includes('teamId: team.teamId') &&
      frontend.includes('teamName: team.teamName'),
  },
  {
    label: 'Team Tournament sheets persist Team IDs for pairings, invitations, and results',
    pass:
      backend.includes('"Team A ID"') &&
      backend.includes('"Team B ID"') &&
      backend.includes('"Team ID"') &&
      backend.includes('pairing.teamAId') &&
      backend.includes('result.teamAId') &&
      backend.includes('invitation.teamId'),
  },
  {
    label: 'Pairing and result resolution use Team IDs with legacy inference fallback',
    pass:
      backend.includes('resolveTeamTournamentPairings(runtime.pairings, teams)') &&
      backend.includes('resolveTeamTournamentResults(runtime.results, teams)') &&
      backend.includes('inferTeamTournamentPairingIdentities(pairing, teams)') &&
      backend.includes('inferTeamTournamentResultIdentities(result, teams)'),
  },
  {
    label: 'Team standings derive from Team Tournament Results, not recent games',
    pass:
      backend.includes('function buildTeamTournamentStandings(eventId, teams, tournamentResults, recentGames)') &&
      backend.includes('resolveTeamTournamentResults(tournamentResults || [], teams)') &&
      backend.includes('(result.teamAId === team.teamId || result.teamBId === team.teamId)') &&
      !backend.includes('players.indexOf(game.winner)') &&
      !backend.includes('players.indexOf(game.loser)'),
  },
  {
    label: 'Tournament submission assignment validates Team IDs',
    pass:
      backend.includes('const teamId =\n    getTeamTournamentString(registration.teamId);') &&
      backend.includes('getTeamTournamentString(pairing.teamAId) !== teamId') &&
      backend.includes('["teamAId", "teamAId", "Team ID"]'),
  },
  {
    label: 'Frontend Team Tournament pairing form stores selected Team IDs',
    pass:
      frontend.includes('<select name="teamAId" required>') &&
      frontend.includes('<select name="teamBId" required>') &&
      frontend.includes('teamA: teamA?.teamName ??') &&
      !frontend.includes('<input name="teamA" placeholder="Team A" required />'),
  },
  {
    label: 'Event Manager pairing form stores selected Team IDs',
    pass:
      eventManagerPanel.includes('teamAId: event.target.value') &&
      eventManagerPanel.includes('teamBId: event.target.value') &&
      eventManagerBackend.includes('getEventManagerString(params.teamAId)') &&
      eventManagerBackend.includes('getEventManagerString(params.teamBId)'),
  },
  {
    label: 'Submit Result sends Team IDs with tournament result payload',
    pass:
      submitResult.includes('<HiddenField name="teamAId" value={assignment.teamAId} />') &&
      submitResult.includes('<HiddenField name="teamBId" value={assignment.teamBId} />') &&
      submitResult.includes('selectedRegistration?.teamId'),
  },
  {
    label: 'Submit Result displays Team Tournament names resolved from Team IDs',
    pass:
      submitResult.includes('function resolveTournamentTeamName(') &&
      submitResult.includes('resolveTournamentTeamName(data, table.teamAId, table.teamA)') &&
      submitResult.includes('resolveTournamentTeamName(data, table.teamBId, table.teamB)') &&
      submitResult.includes('team: resolvedTeam || (teamId ? \'\' : team)') &&
      submitResult.includes("return data?.teams.find((team) => team.teamId === teamId)?.teamName || ''") &&
      submitResult.includes('<ReadOnlyField label="Team" value={assignment?.team || \'\'} />') &&
      !submitResult.includes('value={assignment?.team || eventHome.registration.currentPlayer?.team || \'\'}'),
  },
  {
    label: 'Event Home Team Tournament registrations resolve through the Team Registry',
    pass:
      eventHomeBackend.includes('resolveEventHomeTeamTournamentRegistrationPayload(') &&
      eventHomeBackend.includes('event.type !== "Team Tournament"') &&
      eventHomeBackend.includes('getTeamTournamentTeams(event.id)') &&
      eventHomeBackend.includes('resolveTeamTournamentRegistrationMembership(') &&
      eventHomeBackend.includes('registration.currentPlayer || currentPlayer'),
  },
  {
    label: 'API contract exposes Team IDs across team tournament payloads',
    pass:
      api.includes('teamAId: string') &&
      api.includes('teamBId: string') &&
      api.includes('teamId: string') &&
      api.includes("teamAId: getString(record, 'teamAId')") &&
      api.includes("teamBId: getString(record, 'teamBId')"),
  },
  {
    label: 'Team Tournament result mutations invalidate tournament statistics caches',
    pass:
      backend.includes('function invalidateTeamTournamentResultCaches()') &&
      backend.includes('invalidatePortalCacheGroup("standings")') &&
      backend.includes('invalidatePortalCacheGroup("analytics")') &&
      backend.includes('invalidatePortalCacheGroup("dashboard")') &&
      backend.includes('invalidatePortalCacheGroup("players")'),
  },
  {
    label: 'Team Tournament submissions write the canonical Game Engine source record',
    pass:
      resultSubmissionBackend.includes('function appendCanonicalGameSubmissionRecord(record)') &&
      resultSubmissionBackend.includes('RESULT_SUBMISSION_CANONICAL_HEADERS') &&
      resultSubmissionBackend.includes('SOURCE_RESULT_ID: "Source Result ID"') &&
      backend.includes('persistTeamTournamentCanonicalGame(result, event)') &&
      backend.includes('appendCanonicalGameSubmissionRecord(canonicalRecord)') &&
      backend.includes('sourceType: "teamTournamentResult"') &&
      backend.includes('sourceResultId: result.resultId') &&
      backend.includes('gameType: "tournament"'),
  },
  {
    label: 'Team Tournament submissions rebuild the shared Game Engine after acceptance',
    pass:
      backend.includes('function persistTeamTournamentCanonicalGame(result, event)') &&
      backend.includes('typeof rebuildGameEngine === "function"') &&
      backend.includes('rebuildGameEngine();') &&
      gameEngineBackend.includes('function buildGameEngineRows(formRows)') &&
      gameEngineBackend.includes('function buildGameAnalyticsRows(formRows)'),
  },
  {
    label: 'Team Tournament player statistics use Game Engine, not a duplicate stats path',
    pass:
      resultSubmissionBackend.includes('appendCanonicalGameSubmissionRecord') &&
      backend.includes('buildTeamTournamentCanonicalGameRecord(result, event)') &&
      !backend.includes('buildTeamTournamentPlayerStandings') &&
      !backend.includes('updateTeamTournamentPlayerStatistics') &&
      !backend.includes('Team Tournament Player Statistics'),
  },
  {
    label: 'Team Tournament canonical records derive factions from Army Codes through the shared decoder',
    pass:
      backend.includes('function getTeamTournamentArmyCodeFaction(armyCode)') &&
      backend.includes('decodeArmyCode(armyCode)') &&
      backend.includes('decoded.sectorial') &&
      backend.includes('decoded.faction'),
  },
  {
    label: 'Team Tournament submissions publish the standard game-submitted automation event',
    pass:
      backend.includes('publishGameSubmittedAutomationEvent(') &&
      backend.includes('buildTeamTournamentSubmittedGamePayload(event, result)') &&
      gameEngine.includes('function publishGameSubmittedAutomationEvent(game)') &&
      gameEngine.includes('publishLeagueAutomationEvent({') &&
      gameEngine.includes('eventType: "gameSubmitted"'),
  },
  {
    label: 'League and Casual submissions keep using the shared automation publisher',
    pass:
      resultSubmissionBackend.match(/publishLatestGameSubmittedAutomationEvent\(\);/g)?.length === 2 &&
      gameEngine.includes('function publishLatestGameSubmittedAutomationEvent(game)') &&
      gameEngine.includes('return publishGameSubmittedAutomationEvent(submittedGame);'),
  },
  {
    label: 'Team Tournament automation payload carries Team IDs and current resolved names',
    pass:
      backend.includes('teamAId: result.teamAId') &&
      backend.includes('teamBId: result.teamBId') &&
      backend.includes('teamAName: teamA') &&
      backend.includes('teamBName: teamB') &&
      automationBackend.includes('payload.teamAName && payload.teamBName') &&
      automationBackend.includes('getAutomationString(payload.teamAName)') &&
      automationBackend.includes('getAutomationString(payload.teamBName)'),
  },
  {
    label: 'Team Tournament games enter the shared recent-game feed',
    pass:
      backend.includes('function getAllTeamTournamentRecentGameObjects()') &&
      backend.includes('buildTeamTournamentLatestResults(results)') &&
      factionBackend.includes('getAllTeamTournamentRecentGameObjects()') &&
      factionBackend.includes('leagueGames') &&
      factionBackend.includes('tournamentGames'),
  },
  {
    label: 'Team Tournament recent-game projection excludes canonical Game Analytics duplicates',
    pass:
      resultSubmissionBackend.includes('function getCanonicalGameSubmissionSourceIds(sourceType)') &&
      backend.includes('getCanonicalGameSubmissionSourceIds("teamTournamentResult")') &&
      backend.includes('return !canonicalSourceIds[getTeamTournamentString(game.id)];'),
  },
  {
    label: 'No Team Tournament-specific Discord sender was introduced',
    pass:
      !backend.includes('sendDiscordAnnouncementPayload(') &&
      !backend.includes('buildDiscord') &&
      automationBackend.includes('sendDiscordAnnouncementPayload('),
  },
  {
    label: 'RecentGame API contract preserves optional Team Tournament IDs and names',
    pass:
      api.includes('teamAId?: string') &&
      api.includes('teamBId?: string') &&
      api.includes('teamAName?: string') &&
      api.includes('teamBName?: string') &&
      api.includes("teamAId: getString(record, 'teamAId') || undefined"),
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
  return readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')
}
