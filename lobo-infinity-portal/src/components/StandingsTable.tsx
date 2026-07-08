import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { DivisionKey, MainManStanding } from '../types/dashboard'
import { formatPlayerName } from '../services/formatting'
import { publishStandingsDiagnostics } from '../services/standingsDiagnostics'

type StandingsTableProps = {
  division?: DivisionKey
  standings: MainManStanding[]
  showMovementZones?: boolean
}

function StandingsTable({
  division = 'main',
  standings,
  showMovementZones = false,
}: StandingsTableProps) {
  useEffect(() => {
    const handle = window.setTimeout(() => {
      publishStandingsDiagnostics({
        division,
        tablePropsStandings: standings,
      })
    }, 0)

    return () => {
      window.clearTimeout(handle)
    }
  }, [division, standings])

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

      {standings.map((standing, index) => (
        <StandingsRow
          division={division}
          index={index}
          key={`${standing.rank}-${standing.player}`}
          showMovementZones={showMovementZones}
          standing={standing}
          totalPlayers={standings.length}
        />
      ))}
    </div>
  )
}

function StandingsRow({
  division,
  index,
  showMovementZones,
  standing,
  totalPlayers,
}: {
  division: DivisionKey
  index: number
  showMovementZones: boolean
  standing: MainManStanding
  totalPlayers: number
}) {
  return (
    <div
      className={`table-row ${getRankClass(
        standing.rank,
        totalPlayers,
        division,
        showMovementZones,
      )}`}
      data-standings-component="StandingsRow"
      data-standings-player={standing.player}
      data-standings-rank={standing.rank}
      data-standings-row-index={index}
      role="row"
    >
      <span role="cell">{standing.rank}</span>
      <strong role="cell">
        <Link
          className="table-player-link"
          to={`/players/${encodeURIComponent(standing.player)}`}
        >
          {formatPlayerName(standing.player, standing.displayName)}
        </Link>
      </strong>
      <span role="cell">{standing.games}</span>
      <span role="cell">{standing.wins}</span>
      <span role="cell">{standing.losses}</span>
      <span role="cell">{standing.tp}</span>
      <span role="cell">{standing.op}</span>
      <span role="cell">{standing.vp}</span>
    </div>
  )
}

function getRankClass(
  rank: number,
  totalPlayers: number,
  division: DivisionKey,
  showMovementZones: boolean,
) {
  if (!showMovementZones) {
    return ''
  }

  if (division === 'main') {
    if (rank <= Math.max(0, totalPlayers - 2)) {
      return 'zone-safe'
    }

    return 'zone-relegation'
  }

  if (rank <= 2) {
    return 'zone-safe'
  }

  if (rank > Math.max(0, totalPlayers - 2)) {
    return 'zone-relegation'
  }

  return ''
}

export default StandingsTable
