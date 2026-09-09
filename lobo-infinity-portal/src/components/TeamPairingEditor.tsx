import { useMemo, useState, type FormEvent } from 'react'
import { getCanonicalMissionOptions } from '../config/missions'
import type { TeamTournamentPairing, TeamTournamentTeam } from '../services/api'
import { validateTeamTournamentRound as validateRoundDraft, type TeamMatchDraft } from '../services/teamTournamentRoundManagement'
import { getNextTeamTournamentRoundNumber, getTeamTournamentRoundNumber } from '../services/teamTournamentRounds'
import './TeamPairingEditor.css'

type Props = {
  currentRound?: Record<string, unknown> | null
  disabled: boolean
  onSubmit: (params: Record<string, string>) => void
  pairings?: TeamTournamentPairing[]
  rounds?: Array<Record<string, unknown>>
  teams: TeamTournamentTeam[]
}


export default function TeamPairingEditor({ currentRound, disabled, onSubmit, pairings = [], rounds = [], teams }: Props) {
  const options = useMemo(() => roundOptions(rounds, currentRound, pairings), [rounds, currentRound, pairings])
  const [roundKey, setRoundKey] = useState(options.at(-1)?.key ?? '')
  const selectedRound = options.find((round) => round.key === roundKey) ?? options.at(-1)!
  const [mission, setMission] = useState(selectedRound.mission)
  const [drafts, setDrafts] = useState<TeamMatchDraft[]>(() => loadDrafts(selectedRound, teams, pairings))
  const [preview, setPreview] = useState(false)
  const validation = validateRoundDraft(teams, drafts)

  function selectRound(key: string) {
    const round = options.find((item) => item.key === key) ?? options.at(-1)!
    setRoundKey(key)
    setMission(round.mission)
    setDrafts(loadDrafts(round, teams, pairings))
    setPreview(false)
  }

  function updateDraft(index: number, patch: Partial<TeamMatchDraft>) {
    setDrafts((current) => current.map((draft, draftIndex) => draftIndex === index ? { ...draft, ...patch } : draft))
    setPreview(false)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!validation.valid || !mission || !preview) return
    const payload = drafts.map((draft) => ({ teamAId: draft.teamAId, teamBId: draft.teamBId }))
    onSubmit({
      mission,
      missionGeistId: '',
      pairingsJson: JSON.stringify(payload),
      roundId: selectedRound.roundId,
      roundNumber: String(selectedRound.number),
    })
  }

  return (
    <form className="panel team-tournament-form team-pairing-editor" data-tournament-section="round-management" onSubmit={submit}>
      <p className="eyebrow">Commissioner</p>
      <h2>Round Management</h2>
      <p>Assign which teams play each other. Individual games and opponents are recorded later under the published team matchup.</p>
      <div className="team-pairing-controls">
        <label>Round<select disabled={disabled} onChange={(event) => selectRound(event.target.value)} value={selectedRound.key}>{options.map((round) => <option key={round.key} value={round.key}>{round.name}{round.next ? ' (new)' : ''}</option>)}</select></label>
        <label>Mission<select disabled={disabled} onChange={(event) => { setMission(event.target.value); setPreview(false) }} value={mission}><option value="">Select mission</option>{getCanonicalMissionOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <div className="team-pairing-status"><strong>{validation.assignedTeams}/{teams.length} teams</strong><span>{validation.valid && mission ? 'Ready to preview' : 'Assignments required'}</span></div>
      </div>

      {drafts.map((draft, draftIndex) => {
        return <section className="team-pairing-matchup" key={draftIndex}>
          <h3>Team Pairing {draftIndex + 1}</h3>
          <div className="team-pairing-controls">
            <label>Team A<select disabled={disabled} onChange={(event) => updateDraft(draftIndex, { teamAId: event.target.value })} value={draft.teamAId}><option value="">Select team</option>{teams.map((team) => <option disabled={usedByOther(drafts, draftIndex, team.teamId)} key={team.teamId} value={team.teamId}>{team.teamName}</option>)}</select></label>
            <label>Team B<select disabled={disabled} onChange={(event) => updateDraft(draftIndex, { teamBId: event.target.value })} value={draft.teamBId}><option value="">Select team</option>{teams.map((team) => <option disabled={team.teamId === draft.teamAId || usedByOther(drafts, draftIndex, team.teamId)} key={team.teamId} value={team.teamId}>{team.teamName}</option>)}</select></label>
          </div>
        </section>
      })}

      {validation.errors.length ? <ul className="team-pairing-errors">{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
      {!preview ? <button disabled={disabled || !validation.valid || !mission} onClick={() => setPreview(true)} type="button">Review Complete Round</button> : <section className="team-pairing-preview" aria-label="Complete round preview">
        <h3>Complete Preview — {selectedRound.name}: {mission}</h3>
        {drafts.map((draft, index) => {
          const a = teams.find((team) => team.teamId === draft.teamAId)!
          const b = teams.find((team) => team.teamId === draft.teamBId)!
          return <div key={index}><strong>{a.teamName} vs {b.teamName}</strong></div>
        })}
        <button disabled={disabled} type="submit">Publish Round and Pairings</button>
        <button disabled={disabled} onClick={() => setPreview(false)} type="button">Back to Editing</button>
      </section>}
    </form>
  )
}

type RoundOption = { key: string; roundId: string; name: string; number: number; mission: string; next: boolean }
function roundOptions(rounds: Array<Record<string, unknown>>, current: Record<string, unknown> | null | undefined, pairings: TeamTournamentPairing[]): RoundOption[] {
  const existing = rounds.map((round) => {
    const number = getTeamTournamentRoundNumber(round)
    return { key: String(round.id), roundId: String(round.id), name: number === null ? '' : `Round ${number}`, number: number ?? 0, mission: String(round.mission ?? ''), next: false }
  }).filter((round) => round.roundId && round.number)
  const pairingHistory = pairings.map((pairing) => ({ round: pairing.round }))
  const number = getNextTeamTournamentRoundNumber([...rounds, ...pairingHistory], current)
  return [...existing, { key: `new-${number}`, roundId: '', name: `Round ${number}`, number, mission: '', next: true }]
}
function loadDrafts(round: RoundOption, teams: TeamTournamentTeam[], pairings: TeamTournamentPairing[]): TeamMatchDraft[] {
  const stored = pairings.filter((pairing) => pairing.roundId === round.roundId)
  if (stored.length) return stored.map((pairing) => ({ teamAId: teamId(teams, pairing.teamA), teamBId: teamId(teams, pairing.teamB) }))
  return Array.from({ length: Math.ceil(teams.length / 2) }, () => ({ teamAId: '', teamBId: '' }))
}
function teamId(teams: TeamTournamentTeam[], name: string) { return teams.find((team) => team.teamName.trim().toLowerCase() === name.trim().toLowerCase())?.teamId ?? '' }
function usedByOther(drafts: TeamMatchDraft[], index: number, id: string) { return drafts.some((draft, draftIndex) => draftIndex !== index && (draft.teamAId === id || draft.teamBId === id)) }
