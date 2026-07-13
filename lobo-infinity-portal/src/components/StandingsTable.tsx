import { Link } from 'react-router-dom'
import { formatPlayerName } from '../services/formatting'
import type { Standing } from '../types/dashboard'

type StandingsTableProps = {
  ariaLabel: string
  getRowClassName?: (standing: Standing, totalRows: number) => string
  standings: Standing[]
}

function StandingsTable({
  ariaLabel,
  getRowClassName,
  standings,
}: StandingsTableProps) {
  return (
    <div className="standings-table-shell">
      <table className="standings-data-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Player</th>
            <th scope="col">Games</th>
            <th scope="col">Wins</th>
            <th scope="col">Losses</th>
            <th scope="col">Draws</th>
            <th scope="col">TP</th>
            <th scope="col">OP</th>
            <th scope="col">VP</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing) => (
            <StandingsRow
              className={getRowClassName?.(standing, standings.length)}
              key={`${standing.rank}-${standing.player}`}
              standing={standing}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StandingsRow({
  className = '',
  standing,
}: {
  className?: string
  standing: Standing
}) {
  const playerName = formatPlayerName(standing.player, standing.displayName)

  return (
    <tr className={className || undefined} data-player={standing.player}>
      <td data-label="Rank">{standing.rank}</td>
      <td data-label="Player">
        <Link to={`/players/${encodeURIComponent(standing.player)}`}>
          {playerName}
        </Link>
      </td>
      <td data-label="Games">{standing.games}</td>
      <td data-label="Wins">{standing.wins}</td>
      <td data-label="Losses">{standing.losses}</td>
      <td data-label="Draws">{standing.draws}</td>
      <td data-label="TP">{standing.tp}</td>
      <td data-label="OP">{standing.op}</td>
      <td data-label="VP">{standing.vp}</td>
    </tr>
  )
}

export default StandingsTable
