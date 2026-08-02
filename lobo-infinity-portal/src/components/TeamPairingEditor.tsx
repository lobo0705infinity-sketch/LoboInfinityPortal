import { useMemo, useState, type FormEvent } from 'react'
import type { TeamTournamentPairing, TeamTournamentTeam } from '../services/api'
import './TeamPairingEditor.css'

const TEAM_PAIRING_TABLE_COUNT = 5

type TeamPairingEditorProps = {
  currentRound?: Record<string, unknown> | null
  disabled: boolean
  onSubmit: (params: Record<string, string>) => void
  pairings?: TeamTournamentPairing[]
  rounds?: Array<Record<string, unknown>>
  teams: TeamTournamentTeam[]
}

type TeamPairingRow = {
  teamAPlayer: string
  teamBPlayer: string
}

type RoundOption = {
  key: string
  round: string
  roundId: string
}

type TeamPairingValidation = {
  completeRows: number
  errors: string[]
  teamARemaining: string[]
  teamBRemaining: string[]
  valid: boolean
}

function TeamPairingEditor({
  currentRound,
  disabled,
  onSubmit,
  pairings = [],
  rounds = [],
  teams,
}: TeamPairingEditorProps) {
  const roundOptions = useMemo(
    () => getRoundOptions(rounds, currentRound),
    [currentRound, rounds],
  )
  const [selectedRoundKey, setSelectedRoundKey] = useState('')
  const [teamAId, setTeamAId] = useState('')
  const [teamBId, setTeamBId] = useState('')
  const [rows, setRows] = useState<TeamPairingRow[]>(buildEmptyPairingRows())
  const validTeamAId = teams.some((team) => team.teamId === teamAId) ? teamAId : ''
  const validTeamBId = teams.some((team) => team.teamId === teamBId) ? teamBId : ''
  const selectedRound =
    roundOptions.find((option) => option.key === selectedRoundKey) ??
    roundOptions[0]
  const teamA = teams.find((team) => team.teamId === validTeamAId)
  const teamB = teams.find((team) => team.teamId === validTeamBId)
  const teamARoster = getTeamPairingRoster(teamA)
  const teamBRoster = getTeamPairingRoster(teamB)
  const validation = validateTeamPairings(teamA, teamB, rows)

  function updateTeamA(nextTeamId: string) {
    const nextTeamBId = validTeamBId === nextTeamId ? '' : validTeamBId
    setTeamAId(nextTeamId)
    setTeamBId(nextTeamBId)
    setRows(buildRowsForSelectedPairing(selectedRound, nextTeamId, nextTeamBId, teams, pairings))
  }

  function updateTeamB(nextTeamId: string) {
    const nextTeamAId = validTeamAId === nextTeamId ? '' : validTeamAId
    setTeamBId(nextTeamId)
    setTeamAId(nextTeamAId)
    setRows(buildRowsForSelectedPairing(selectedRound, nextTeamAId, nextTeamId, teams, pairings))
  }

  function updateRound(nextRoundKey: string) {
    const nextRound =
      roundOptions.find((option) => option.key === nextRoundKey) ??
      roundOptions[0]

    setSelectedRoundKey(nextRoundKey)
    setRows(buildRowsForSelectedPairing(nextRound, validTeamAId, validTeamBId, teams, pairings))
  }

  function updateRow(index: number, side: keyof TeamPairingRow, value: string) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [side]: value,
            }
          : row,
      ),
    )
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedRound || !teamA || !teamB || !validation.valid) {
      return
    }

    const params: Record<string, string> = {
      results: '',
      round: selectedRound.round,
      roundId: selectedRound.roundId,
      status: 'Scheduled',
      teamA: teamA.teamName,
      teamAId: teamA.teamId,
      teamB: teamB.teamName,
      teamBId: teamB.teamId,
    }

    rows.forEach((row, index) => {
      params[`teamAPlayer${index + 1}`] = row.teamAPlayer
      params[`teamBPlayer${index + 1}`] = row.teamBPlayer
    })

    onSubmit(params)
    setTeamAId('')
    setTeamBId('')
    setRows(buildEmptyPairingRows())
  }

  return (
    <form
      className="panel team-tournament-form team-pairing-editor"
      data-tournament-section="pairings"
      onSubmit={submit}
    >
      <p className="eyebrow">Commissioner</p>
      <h2>Post Pairing</h2>

      <div className="team-pairing-controls">
        <label>
          Round
          <select
            disabled={disabled || roundOptions.length === 0}
            onChange={(event) => updateRound(event.target.value)}
            value={selectedRound?.key ?? ''}
          >
            {roundOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.round}
              </option>
            ))}
          </select>
        </label>
        <label>
          Team A
          <select
            disabled={disabled}
            onChange={(event) => updateTeamA(event.target.value)}
            value={validTeamAId}
          >
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team.teamId} value={team.teamId}>
                {team.teamName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Team B
          <select
            disabled={disabled}
            onChange={(event) => updateTeamB(event.target.value)}
            value={validTeamBId}
          >
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team.teamId} value={team.teamId}>
                {team.teamName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="team-pairing-rosters" aria-label="Team rosters">
        <RosterSummary
          label={teamA?.teamName || 'Team A roster'}
          remaining={validation.teamARemaining}
          roster={teamARoster}
        />
        <RosterSummary
          label={teamB?.teamName || 'Team B roster'}
          remaining={validation.teamBRemaining}
          roster={teamBRoster}
        />
      </div>

      <div className="team-pairing-status" aria-live="polite">
        <strong>
          {validation.completeRows}/{TEAM_PAIRING_TABLE_COUNT} Pairings Complete
        </strong>
        <span>{validation.valid ? 'Ready to save' : 'Validation required'}</span>
      </div>

      <div className="team-pairing-board" role="table" aria-label="Individual pairings">
        {rows.map((row, index) => (
          <div className="team-pairing-row" role="row" key={index}>
            <strong role="rowheader">Table {index + 1}</strong>
            <PlayerSelect
              disabled={disabled || !teamA}
              label="Team A Player"
              onChange={(value) => updateRow(index, 'teamAPlayer', value)}
              roster={teamARoster}
              rows={rows}
              rowIndex={index}
              side="teamAPlayer"
              value={row.teamAPlayer}
            />
            <span className="team-pairing-vs">vs</span>
            <PlayerSelect
              disabled={disabled || !teamB}
              label="Team B Player"
              onChange={(value) => updateRow(index, 'teamBPlayer', value)}
              roster={teamBRoster}
              rows={rows}
              rowIndex={index}
              side="teamBPlayer"
              value={row.teamBPlayer}
            />
          </div>
        ))}
      </div>

      {validation.errors.length > 0 ? (
        <ul className="team-pairing-errors">
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : (
        <p className="team-pairing-valid">All players assigned exactly once.</p>
      )}

      <button disabled={disabled || !validation.valid} type="submit">
        Save Pairing
      </button>
    </form>
  )
}

function PlayerSelect({
  disabled,
  label,
  onChange,
  roster,
  rows,
  rowIndex,
  side,
  value,
}: {
  disabled: boolean
  label: string
  onChange: (value: string) => void
  roster: string[]
  rows: TeamPairingRow[]
  rowIndex: number
  side: keyof TeamPairingRow
  value: string
}) {
  return (
    <label>
      {label}
      <select
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Select player</option>
        {roster.map((player) => (
          <option
            disabled={isSelectedElsewhere(rows, side, player, rowIndex)}
            key={player}
            value={player}
          >
            {player}
          </option>
        ))}
      </select>
    </label>
  )
}

function RosterSummary({
  label,
  remaining,
  roster,
}: {
  label: string
  remaining: string[]
  roster: string[]
}) {
  return (
    <section className="team-pairing-roster">
      <div>
        <h3>{label}</h3>
        <span>{remaining.length} Remaining</span>
      </div>
      {roster.length > 0 ? (
        <ul>
          {roster.map((player) => (
            <li key={player}>{player}</li>
          ))}
        </ul>
      ) : (
        <p>No roster selected.</p>
      )}
    </section>
  )
}

function buildEmptyPairingRows(): TeamPairingRow[] {
  return Array.from({ length: TEAM_PAIRING_TABLE_COUNT }, () => ({
    teamAPlayer: '',
    teamBPlayer: '',
  }))
}

function buildRowsForSelectedPairing(
  round: RoundOption | undefined,
  teamAId: string,
  teamBId: string,
  teams: TeamTournamentTeam[],
  pairings: TeamTournamentPairing[],
) {
  const pairing = findStoredTeamPairing(round, teamAId, teamBId, pairings)
  const teamA = teams.find((team) => team.teamId === teamAId)
  const teamB = teams.find((team) => team.teamId === teamBId)

  return pairing && teamA && teamB
    ? parseStoredPairingRows(
        pairing.playerPairings,
        getTeamPairingRoster(teamA),
        getTeamPairingRoster(teamB),
      )
    : buildEmptyPairingRows()
}

function validateTeamPairings(
  teamA: TeamTournamentTeam | undefined,
  teamB: TeamTournamentTeam | undefined,
  rows: TeamPairingRow[],
): TeamPairingValidation {
  const errors: string[] = []
  const teamARoster = getTeamPairingRoster(teamA)
  const teamBRoster = getTeamPairingRoster(teamB)
  const teamASelections = rows.map((row) => row.teamAPlayer).filter(Boolean)
  const teamBSelections = rows.map((row) => row.teamBPlayer).filter(Boolean)
  const teamARemaining = getRemainingPlayers(teamARoster, teamASelections)
  const teamBRemaining = getRemainingPlayers(teamBRoster, teamBSelections)
  const completeRows = rows.filter(
    (row) => row.teamAPlayer !== '' && row.teamBPlayer !== '',
  ).length

  if (!teamA) {
    errors.push('Select Team A.')
  }

  if (!teamB) {
    errors.push('Select Team B.')
  }

  if (teamA && teamB && teamA.teamId === teamB.teamId) {
    errors.push('Select two different teams.')
  }

  if (teamA && teamARoster.length !== TEAM_PAIRING_TABLE_COUNT) {
    errors.push(`${teamA.teamName} must have five rostered players.`)
  }

  if (teamB && teamBRoster.length !== TEAM_PAIRING_TABLE_COUNT) {
    errors.push(`${teamB.teamName} must have five rostered players.`)
  }

  rows.forEach((row, index) => {
    if (row.teamAPlayer === '' || row.teamBPlayer === '') {
      errors.push(`Table ${index + 1} is incomplete.`)
      return
    }

    if (!hasPlayer(teamARoster, row.teamAPlayer)) {
      errors.push(`${row.teamAPlayer} is not on ${teamA?.teamName || 'Team A'}.`)
    }

    if (!hasPlayer(teamBRoster, row.teamBPlayer)) {
      errors.push(`${row.teamBPlayer} is not on ${teamB?.teamName || 'Team B'}.`)
    }

    if (normalizeTeamPairingPlayer(row.teamAPlayer) === normalizeTeamPairingPlayer(row.teamBPlayer)) {
      errors.push(`Table ${index + 1} pairs ${row.teamAPlayer} against themselves.`)
    }
  })

  errors.push(...getDuplicateMessages(teamASelections, teamA?.teamName || 'Team A'))
  errors.push(...getDuplicateMessages(teamBSelections, teamB?.teamName || 'Team B'))

  if (teamA && teamARemaining.length > 0) {
    errors.push(`${teamA.teamName} missing: ${teamARemaining.join(', ')}.`)
  }

  if (teamB && teamBRemaining.length > 0) {
    errors.push(`${teamB.teamName} missing: ${teamBRemaining.join(', ')}.`)
  }

  return {
    completeRows,
    errors,
    teamARemaining,
    teamBRemaining,
    valid: errors.length === 0,
  }
}

function findStoredTeamPairing(
  round: RoundOption | undefined,
  teamAId: string,
  teamBId: string,
  pairings: TeamTournamentPairing[],
) {
  if (!round || !teamAId || !teamBId) {
    return null
  }

  return pairings.find((pairing) => {
    const roundMatches = pairing.roundId
      ? pairing.roundId === round.roundId
      : pairing.round === round.round

    return (
      roundMatches &&
      pairing.teamAId === teamAId &&
      pairing.teamBId === teamBId
    )
  }) ?? null
}

function parseStoredPairingRows(
  playerPairings: string,
  teamARoster: string[],
  teamBRoster: string[],
) {
  const rows = buildEmptyPairingRows()
  let nextOpenIndex = 0

  playerPairings
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parsed = parseStoredPairingLine(line)

      if (!parsed) {
        return
      }

      const rowIndex =
        parsed.table > 0 && parsed.table <= TEAM_PAIRING_TABLE_COUNT
          ? parsed.table - 1
          : nextOpenIndex

      if (rowIndex >= TEAM_PAIRING_TABLE_COUNT) {
        return
      }

      rows[rowIndex] = {
        teamAPlayer: resolveRosterPlayer(teamARoster, parsed.teamAPlayer),
        teamBPlayer: resolveRosterPlayer(teamBRoster, parsed.teamBPlayer),
      }
      nextOpenIndex = Math.max(nextOpenIndex, rowIndex + 1)
    })

  return rows
}

function parseStoredPairingLine(line: string) {
  const match = line.match(/^(?:table\s*(\d+)\s*[:.-]\s*)?(.+?)\s+(?:vs\.?|v\.?|versus)\s+(.+)$/i)

  if (!match) {
    return null
  }

  return {
    table: Number(match[1] ?? 0) || 0,
    teamAPlayer: match[2].trim(),
    teamBPlayer: match[3].trim(),
  }
}

function resolveRosterPlayer(roster: string[], player: string) {
  const key = normalizeTeamPairingPlayer(player)

  return roster.find((candidate) => normalizeTeamPairingPlayer(candidate) === key) ?? ''
}

function getRoundOptions(
  rounds: Array<Record<string, unknown>>,
  currentRound?: Record<string, unknown> | null,
): RoundOption[] {
  const options: RoundOption[] = []
  const seen = new Set<string>()
  const addRound = (round: Record<string, unknown> | null | undefined) => {
    if (!round) {
      return
    }

    const roundId = getRecordString(round, ['id', 'roundId', 'ID', 'Round ID'])
    const roundName =
      getRecordString(round, ['name', 'round', 'Name', 'Round']) ||
      (getRecordString(round, ['number', 'Number'])
        ? `Round ${getRecordString(round, ['number', 'Number'])}`
        : '')

    if (!roundName) {
      return
    }

    const key = roundId || roundName
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    options.push({
      key,
      round: roundName,
      roundId,
    })
  }

  addRound(currentRound)
  rounds.forEach(addRound)

  if (options.length === 0) {
    options.push({
      key: 'Round 1',
      round: 'Round 1',
      roundId: '',
    })
  }

  return options
}

function getRecordString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]

    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim()
    }
  }

  return ''
}

function getTeamPairingRoster(team: TeamTournamentTeam | undefined) {
  if (!team) {
    return []
  }

  const seen = new Set<string>()

  return [team.captain, ...splitTeamPlayers(team.players)].filter((player) => {
    const key = normalizeTeamPairingPlayer(player)

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function splitTeamPlayers(players: string) {
  return players
    .split(/[,;\n]/)
    .map((player) => player.trim())
    .filter(Boolean)
}

function getRemainingPlayers(roster: string[], selections: string[]) {
  const selected = new Set(selections.map(normalizeTeamPairingPlayer))

  return roster.filter((player) => !selected.has(normalizeTeamPairingPlayer(player)))
}

function getDuplicateMessages(players: string[], teamName: string) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  players.forEach((player) => {
    const key = normalizeTeamPairingPlayer(player)

    if (seen.has(key)) {
      duplicates.add(player)
      return
    }

    seen.add(key)
  })

  return Array.from(duplicates).map(
    (player) => `${teamName} lists ${player} more than once.`,
  )
}

function hasPlayer(roster: string[], player: string) {
  const key = normalizeTeamPairingPlayer(player)

  return roster.some((candidate) => normalizeTeamPairingPlayer(candidate) === key)
}

function isSelectedElsewhere(
  rows: TeamPairingRow[],
  side: keyof TeamPairingRow,
  player: string,
  rowIndex: number,
) {
  const key = normalizeTeamPairingPlayer(player)

  return rows.some(
    (row, index) =>
      index !== rowIndex && normalizeTeamPairingPlayer(row[side]) === key,
  )
}

function normalizeTeamPairingPlayer(player: string) {
  return player.trim().toLowerCase()
}

export default TeamPairingEditor
