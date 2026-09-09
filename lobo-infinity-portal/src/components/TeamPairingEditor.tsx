import { useMemo, useState, type FormEvent } from 'react'
import { getCanonicalMissionOptions } from '../config/missions'
import type { TeamTournamentPairing, TeamTournamentTeam } from '../services/api'
import { samePlayer as same, teamRoster as roster, validateTeamTournamentRound as validateRoundDraft, type PlayerMatch, type TeamMatchDraft } from '../services/teamTournamentRoundManagement'
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
    setDrafts((current) => current.map((draft, draftIndex) => draftIndex === index ? normalizeDraft({ ...draft, ...patch }, teams) : draft))
    setPreview(false)
  }

  function updatePlayer(draftIndex: number, rowIndex: number, side: keyof PlayerMatch, value: string) {
    setDrafts((current) => current.map((draft, index) => index !== draftIndex ? draft : {
      ...draft,
      matches: draft.matches.map((row, matchIndex) => matchIndex === rowIndex ? { ...row, [side]: value } : row),
    }))
    setPreview(false)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!validation.valid || !mission || !preview) return
    const payload = drafts.map((draft) => {
      const teamA = teams.find((team) => team.teamId === draft.teamAId)!
      const teamB = teams.find((team) => team.teamId === draft.teamBId)!
      const rosterA = roster(teamA)
      const rosterB = roster(teamB)
      const matches = draft.matches.filter((row) => row.teamAPlayer && row.teamBPlayer)
      return {
        teamAId: draft.teamAId,
        teamBId: draft.teamBId,
        matches,
        unpairedA: rosterA.filter((player) => !matches.some((row) => same(player, row.teamAPlayer))),
        unpairedB: rosterB.filter((player) => !matches.some((row) => same(player, row.teamBPlayer))),
      }
    })
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
      <p>Build the complete round here. The event advances only after every team and player assignment saves successfully.</p>
      <div className="team-pairing-controls">
        <label>Round<select disabled={disabled} onChange={(event) => selectRound(event.target.value)} value={selectedRound.key}>{options.map((round) => <option key={round.key} value={round.key}>{round.name}{round.next ? ' (new)' : ''}</option>)}</select></label>
        <label>Mission<select disabled={disabled} onChange={(event) => { setMission(event.target.value); setPreview(false) }} value={mission}><option value="">Select mission</option>{getCanonicalMissionOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <div className="team-pairing-status"><strong>{validation.assignedTeams}/{teams.length} teams</strong><span>{validation.valid && mission ? 'Ready to preview' : 'Assignments required'}</span></div>
      </div>

      {drafts.map((draft, draftIndex) => {
        const teamA = teams.find((team) => team.teamId === draft.teamAId)
        const teamB = teams.find((team) => team.teamId === draft.teamBId)
        const rosterA = roster(teamA)
        const rosterB = roster(teamB)
        return <section className="team-pairing-matchup" key={draftIndex}>
          <h3>Team Pairing {draftIndex + 1}</h3>
          <div className="team-pairing-controls">
            <label>Team A<select disabled={disabled} onChange={(event) => updateDraft(draftIndex, { teamAId: event.target.value })} value={draft.teamAId}><option value="">Select team</option>{teams.map((team) => <option disabled={usedByOther(drafts, draftIndex, team.teamId)} key={team.teamId} value={team.teamId}>{team.teamName}</option>)}</select></label>
            <label>Team B<select disabled={disabled} onChange={(event) => updateDraft(draftIndex, { teamBId: event.target.value })} value={draft.teamBId}><option value="">Select team</option>{teams.map((team) => <option disabled={team.teamId === draft.teamAId || usedByOther(drafts, draftIndex, team.teamId)} key={team.teamId} value={team.teamId}>{team.teamName}</option>)}</select></label>
          </div>
          {teamA && teamB ? <div className="team-pairing-board" role="table" aria-label={`${teamA.teamName} versus ${teamB.teamName}`}>
            {draft.matches.map((row, rowIndex) => <div className="team-pairing-row" role="row" key={rowIndex}>
              <strong>Table {rowIndex + 1}</strong>
              <PlayerSelect disabled={disabled} label="Team A Player" roster={rosterA} selected={draft.matches.map((item) => item.teamAPlayer)} value={row.teamAPlayer} onChange={(value) => updatePlayer(draftIndex, rowIndex, 'teamAPlayer', value)} />
              <span className="team-pairing-vs">vs</span>
              <PlayerSelect disabled={disabled} label="Team B Player" roster={rosterB} selected={draft.matches.map((item) => item.teamBPlayer)} value={row.teamBPlayer} onChange={(value) => updatePlayer(draftIndex, rowIndex, 'teamBPlayer', value)} />
            </div>)}
            {rosterA.length !== rosterB.length ? <p className="team-pairing-substitutes">Substitute/unpaired: {unassigned(rosterA, draft.matches.map((row) => row.teamAPlayer)).concat(unassigned(rosterB, draft.matches.map((row) => row.teamBPlayer))).join(', ') || 'select assignments'}</p> : null}
          </div> : null}
        </section>
      })}

      {validation.errors.length ? <ul className="team-pairing-errors">{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
      {!preview ? <button disabled={disabled || !validation.valid || !mission} onClick={() => setPreview(true)} type="button">Review Complete Round</button> : <section className="team-pairing-preview" aria-label="Complete round preview">
        <h3>Complete Preview — {selectedRound.name}: {mission}</h3>
        {drafts.map((draft, index) => {
          const a = teams.find((team) => team.teamId === draft.teamAId)!
          const b = teams.find((team) => team.teamId === draft.teamBId)!
          return <div key={index}><strong>{a.teamName} vs {b.teamName}</strong><ol>{draft.matches.filter((row) => row.teamAPlayer && row.teamBPlayer).map((row, rowIndex) => <li key={rowIndex}>{row.teamAPlayer} vs {row.teamBPlayer}</li>)}</ol>{roster(a).length !== roster(b).length ? <p>Substitute/unpaired: {unassigned(roster(a), draft.matches.map((row) => row.teamAPlayer)).concat(unassigned(roster(b), draft.matches.map((row) => row.teamBPlayer))).join(', ')}</p> : null}</div>
        })}
        <button disabled={disabled} type="submit">Publish Round and Pairings</button>
        <button disabled={disabled} onClick={() => setPreview(false)} type="button">Back to Editing</button>
      </section>}
    </form>
  )
}

function PlayerSelect({ disabled, label, roster: players, selected, value, onChange }: { disabled: boolean; label: string; roster: string[]; selected: string[]; value: string; onChange: (value: string) => void }) {
  return <label>{label}<select disabled={disabled} onChange={(event) => onChange(event.target.value)} value={value}><option value="">{players.length ? 'Select player' : 'No player / unpaired'}</option>{players.map((player) => <option disabled={!same(player, value) && selected.some((item) => same(item, player))} key={player} value={player}>{player}</option>)}</select></label>
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
  if (stored.length) return stored.map((pairing) => normalizeDraft({ teamAId: teamId(teams, pairing.teamA), teamBId: teamId(teams, pairing.teamB), matches: parseLines(pairing.playerPairings) }, teams))
  return Array.from({ length: Math.ceil(teams.length / 2) }, () => ({ teamAId: '', teamBId: '', matches: [] }))
}
function normalizeDraft(draft: TeamMatchDraft, teams: TeamTournamentTeam[]): TeamMatchDraft {
  const count = Math.min(roster(teams.find((team) => team.teamId === draft.teamAId)).length, roster(teams.find((team) => team.teamId === draft.teamBId)).length)
  return { ...draft, matches: Array.from({ length: count }, (_, index) => draft.matches[index] ?? { teamAPlayer: '', teamBPlayer: '' }) }
}
function parseLines(value: string): PlayerMatch[] { return value.split(/\r?\n/).map((line) => line.match(/^(?:Table\s+\d+:\s*)?(.+?)\s+vs\s+(.+)$/i)).filter(Boolean).map((match) => ({ teamAPlayer: match![1].trim(), teamBPlayer: match![2].trim() })) }
function teamId(teams: TeamTournamentTeam[], name: string) { return teams.find((team) => same(team.teamName, name))?.teamId ?? '' }
function unassigned(players: string[], selected: string[]) { return players.filter((player) => !selected.some((value) => same(value, player))) }
function usedByOther(drafts: TeamMatchDraft[], index: number, id: string) { return drafts.some((draft, draftIndex) => draftIndex !== index && (draft.teamAId === id || draft.teamBId === id)) }
