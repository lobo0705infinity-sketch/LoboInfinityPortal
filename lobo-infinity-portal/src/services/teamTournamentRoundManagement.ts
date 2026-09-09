import type { TeamTournamentTeam } from './api'

export type TeamMatchDraft = { teamAId: string; teamBId: string }

export function validateTeamTournamentRound(teams: TeamTournamentTeam[], drafts: TeamMatchDraft[]) {
  const errors: string[] = []
  const assigned = drafts.flatMap((draft) => [draft.teamAId, draft.teamBId]).filter(Boolean)
  if (new Set(assigned).size !== assigned.length) errors.push('Each team may be assigned only once.')
  if (assigned.length !== teams.length || teams.some((team) => !assigned.includes(team.teamId))) errors.push('Every registered team must be paired exactly once.')
  drafts.forEach((draft, index) => {
    const a = teams.find((team) => team.teamId === draft.teamAId)
    const b = teams.find((team) => team.teamId === draft.teamBId)
    if (!a || !b || a.teamId === b.teamId) { errors.push(`Team pairing ${index + 1} requires two different registered teams.`); return }
  })
  return { assignedTeams: new Set(assigned).size, errors, valid: errors.length === 0 }
}
