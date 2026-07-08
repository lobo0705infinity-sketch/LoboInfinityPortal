import type { TeamTournamentData } from '../../api'
import type { ApiOptions } from '../../apiCore'

export interface TeamRepository {
  getTeamTournament(
    eventId?: string,
    options?: ApiOptions,
  ): Promise<TeamTournamentData>
  saveTeam(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<TeamTournamentData>
  savePairing(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<TeamTournamentData>
  saveInvitation(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<TeamTournamentData>
  saveResult(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<TeamTournamentData>
  advanceRound(
    params: Record<string, string>,
    options?: ApiOptions,
  ): Promise<TeamTournamentData>
}
