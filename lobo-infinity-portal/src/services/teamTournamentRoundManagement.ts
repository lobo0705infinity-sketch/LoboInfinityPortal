import type { TeamTournamentTeam } from './api'

export type PlayerMatch = { teamAPlayer: string; teamBPlayer: string }
export type TeamMatchDraft = { teamAId: string; teamBId: string; matches: PlayerMatch[] }

export function validateTeamTournamentRound(teams: TeamTournamentTeam[], drafts: TeamMatchDraft[]) {
  const errors: string[] = []
  const assigned = drafts.flatMap((draft) => [draft.teamAId, draft.teamBId]).filter(Boolean)
  if (new Set(assigned).size !== assigned.length) errors.push('Each team may be assigned only once.')
  if (assigned.length !== teams.length || teams.some((team) => !assigned.includes(team.teamId))) errors.push('Every registered team must be paired exactly once.')
  drafts.forEach((draft, index) => {
    const a = teams.find((team) => team.teamId === draft.teamAId)
    const b = teams.find((team) => team.teamId === draft.teamBId)
    if (!a || !b || a.teamId === b.teamId) { errors.push(`Team pairing ${index + 1} requires two different registered teams.`); return }
    const ra = teamRoster(a); const rb = teamRoster(b)
    const selectedA = draft.matches.map((row) => row.teamAPlayer).filter(Boolean)
    const selectedB = draft.matches.map((row) => row.teamBPlayer).filter(Boolean)
    if (new Set(selectedA.map(playerKey)).size !== selectedA.length || new Set(selectedB.map(playerKey)).size !== selectedB.length) errors.push(`Team pairing ${index + 1} contains a duplicate player.`)
    if (selectedA.some((player) => !ra.some((candidate) => samePlayer(candidate, player))) || selectedB.some((player) => !rb.some((candidate) => samePlayer(candidate, player)))) errors.push(`Team pairing ${index + 1} assigns a player outside their registered team.`)
    const complete = draft.matches.filter((row) => row.teamAPlayer && row.teamBPlayer)
    if (complete.some((row) => samePlayer(row.teamAPlayer, row.teamBPlayer))) errors.push(`Team pairing ${index + 1} contains a self-pairing.`)
    if (complete.length !== Math.min(ra.length, rb.length) || selectedA.length !== complete.length || selectedB.length !== complete.length) errors.push(`Team pairing ${index + 1} must assign every available opponent slot.`)
  })
  return { assignedTeams: new Set(assigned).size, errors, valid: errors.length === 0 }
}

export function teamRoster(team?: TeamTournamentTeam) {
  if (!team) return []
  const seen = new Set<string>()
  return team.players.split(/[,;\n]/).map((value) => value.trim()).filter((value) => value && !seen.has(playerKey(value)) && Boolean(seen.add(playerKey(value))))
}

export function samePlayer(a: string, b: string) { return playerKey(a) === playerKey(b) }
export function playerKey(value: string) { return value.trim().toLowerCase() }
