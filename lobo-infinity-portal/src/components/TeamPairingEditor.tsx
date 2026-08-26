import { useMemo, useState, type FormEvent } from 'react'
import type { TeamTournamentPairing, TeamTournamentTeam } from '../services/api'
import './TeamPairingEditor.css'

type TeamPairingEditorProps = {
  currentRound?: Record<string, unknown> | null
  disabled: boolean
  onSubmit: (params: Record<string, string>) => void
  pairings?: TeamTournamentPairing[]
  rounds?: Array<Record<string, unknown>>
  teams: TeamTournamentTeam[]
}

type RoundOption = { key: string; round: string; roundId: string }

function TeamPairingEditor({
  currentRound,
  disabled,
  onSubmit,
  rounds = [],
  teams,
}: TeamPairingEditorProps) {
  const roundOptions = useMemo(() => getRoundOptions(rounds, currentRound), [currentRound, rounds])
  const [selectedRoundKey, setSelectedRoundKey] = useState('')
  const [teamAId, setTeamAId] = useState('')
  const [teamBId, setTeamBId] = useState('')
  const selectedRound = roundOptions.find((option) => option.key === selectedRoundKey) ?? roundOptions[0]
  const teamA = teams.find((team) => team.teamId === teamAId)
  const teamB = teams.find((team) => team.teamId === teamBId)
  const valid = Boolean(selectedRound && teamA && teamB && teamA.teamId !== teamB.teamId)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRound || !teamA || !teamB || !valid) return

    onSubmit({
      results: '',
      round: selectedRound.round,
      roundId: selectedRound.roundId,
      status: 'Scheduled',
      teamA: teamA.teamName,
      teamAId: teamA.teamId,
      teamB: teamB.teamName,
      teamBId: teamB.teamId,
    })
    setTeamAId('')
    setTeamBId('')
  }

  return (
    <form className="panel team-tournament-form team-pairing-editor" data-tournament-section="pairings" onSubmit={submit}>
      <p className="eyebrow">Commissioner</p>
      <h2>Post Team Matchup</h2>
      <div className="team-pairing-controls">
        <label>Round<select disabled={disabled || roundOptions.length === 0} onChange={(event) => setSelectedRoundKey(event.target.value)} value={selectedRound?.key ?? ''}>{roundOptions.map((option) => <option key={option.key} value={option.key}>{option.round}</option>)}</select></label>
        <label>Team A<select disabled={disabled} onChange={(event) => setTeamAId(event.target.value)} value={teamAId}><option value="">Select team</option>{teams.map((team) => <option key={team.teamId} value={team.teamId}>{team.teamName}</option>)}</select></label>
        <label>Team B<select disabled={disabled} onChange={(event) => setTeamBId(event.target.value)} value={teamBId}><option value="">Select team</option>{teams.map((team) => <option disabled={team.teamId === teamAId} key={team.teamId} value={team.teamId}>{team.teamName}</option>)}</select></label>
      </div>
      <button disabled={disabled || !valid} type="submit">Save Matchup</button>
    </form>
  )
}

function getRoundOptions(rounds: Array<Record<string, unknown>>, currentRound?: Record<string, unknown> | null): RoundOption[] {
  const candidates = currentRound ? [currentRound, ...rounds] : rounds
  const seen = new Set<string>()
  return candidates.map((round) => {
    const roundId = String(round.id ?? round.roundId ?? '')
    const name = String(round.name ?? round.round ?? '')
    return { key: roundId || name, round: name, roundId }
  }).filter((option) => option.key && option.roundId && !seen.has(option.key) && Boolean(seen.add(option.key)))
}

export default TeamPairingEditor
