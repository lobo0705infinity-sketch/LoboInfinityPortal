import { Link } from 'react-router-dom'
import type { MainManStanding } from '../types/dashboard'

type StandingsTableProps = {
  standings: MainManStanding[]
  showMovementZones?: boolean
}

function StandingsTable({
  standings,
  showMovementZones = false,
}: StandingsTableProps) {
  return (
    <div className="standings-table" role="table" aria-label="Main Man Standings">
      <div className="table-row table-head" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader">Player</span>
        <span role="columnheader">Games</span>
        <span role="columnheader">Wins</span>
        <span role="columnheader">Losses</span>
        <span role="columnheader">TP</span>
        <span role="columnheader">OP</span>
        <span role="columnheader">VP</span>
      </div>

      {standings.map((standing) => (
        <div
          className={`table-row ${getRankClass(standing.rank, showMovementZones)}`}
          role="row"
          key={standing.rank}
        >
          <span role="cell">{standing.rank}</span>
          <strong role="cell">
            <Link
              className="table-player-link"
              to={`/players/${encodeURIComponent(standing.player)}`}
            >
              {standing.player}
            </Link>
          </strong>
          <span role="cell">{standing.games}</span>
          <span role="cell">{standing.wins}</span>
          <span role="cell">{standing.losses}</span>
          <span role="cell">{standing.tp}</span>
          <span role="cell">{standing.op}</span>
          <span role="cell">{standing.vp}</span>
        </div>
      ))}
    </div>
  )
}

function getRankClass(rank: number, showMovementZones: boolean) {
  if (!showMovementZones) {
    return ''
  }

  if (rank <= 8) {
    return 'zone-safe'
  }

  return 'zone-relegation'
}

export default StandingsTable
