import type { TeamTournamentData, TeamTournamentMutationResult } from '../../api'
import type { ApiOptions } from '../../apiCore'

export interface TeamRepository {
  getTeamTournament(
    eventId?: string,
    options?: ApiOptions,
  ): Promise<TeamTournamentData>
  saveTeam(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<TeamTournamentMutationResult>
  savePairing(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<TeamTournamentMutationResult>
  saveInvitation(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<TeamTournamentMutationResult>
  saveResult(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<TeamTournamentMutationResult>
  advanceRound(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<TeamTournamentMutationResult>
}
