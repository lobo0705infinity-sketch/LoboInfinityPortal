import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import {
  apiClient,
  type TeamTournamentData,
  type TeamTournamentPairing,
  type TeamTournamentTeam,
} from '../services/api'
import { formatPlayerName } from '../services/formatting'

type TournamentState =
  | { status: 'loading' }
  | { data: TeamTournamentData; status: 'success' }
  | { error: string; status: 'error' }

const defaultEventId = 'event-august-2026-team-tournament'

function TeamTournament() {
  const auth = useAuth()
  const [state, setState] = useState<TournamentState>({ status: 'loading' })
  const [working, setWorking] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getTeamTournament(defaultEventId, { signal: controller.signal })
      .then((data) => setState({ data, status: 'success' }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Team Tournament could not be loaded.',
          status: 'error',
        })
      })

    return () => {
      controller.abort()
    }
  }, [])

  async function register(teamName: string) {
    setWorking('register')
    try {
      const data = await apiClient.registerTeamTournament({
        eventId: defaultEventId,
        teamName,
      })
      setState({ data, status: 'success' })
    } finally {
      setWorking('')
    }
  }

  async function saveTeam(params: Record<string, string>) {
    setWorking('team')
    try {
      const data = await apiClient.saveTeamTournamentTeam({
        ...params,
        eventId: defaultEventId,
      })
      setState({ data, status: 'success' })
    } finally {
      setWorking('')
    }
  }

  async function savePairing(params: Record<string, string>) {
    setWorking('pairing')
    try {
      const data = await apiClient.saveTeamTournamentPairing({
        ...params,
        eventId: defaultEventId,
      })
      setState({ data, status: 'success' })
    } finally {
      setWorking('')
    }
  }

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Team Tournament loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Team Tournament error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  const data = state.data
  const isCommissioner = auth.isAtLeastRole('Commissioner')

  return (
    <main className="portal-shell">
      <PageHeader title={data.event.name} />

      <section className="team-tournament-hero panel">
        <div>
          <p className="eyebrow">{data.event.type}</p>
          <h2>{data.status}</h2>
          <p>
            {data.currentRound
              ? String(data.currentRound['name'] ?? 'Current round')
              : 'Round setup pending'}
          </p>
        </div>
        <TournamentMetric label="Teams" value={data.registeredTeams} />
        <TournamentMetric label="Completed" value={data.completedMatches} />
        <TournamentMetric label="Pairings" value={data.pairings.length} />
      </section>

      <section className="team-tournament-grid">
        <RegistrationPanel
          disabled={working !== ''}
          onRegister={(teamName) => void register(teamName)}
          userTeam={findUserTeam(data.teams, auth.user?.leaguePlayer ?? '')}
        />
        <NewsPanel news={data.news} />
      </section>

      <section className="team-tournament-grid">
        <TeamStandings standings={data.standings} />
        <PairingsPanel pairings={data.pairings} />
      </section>

      <RostersPanel teams={data.teams} />

      <section className="team-tournament-grid">
        <LatestResults data={data} />
        <QuickActions actions={data.quickActions} />
      </section>

      {isCommissioner ? (
        <CommissionerTournamentTools
          disabled={working !== ''}
          onPairing={(params) => void savePairing(params)}
          onTeam={(params) => void saveTeam(params)}
        />
      ) : null}
    </main>
  )
}

function PageHeader({ title = 'Team Tournament' }: { title?: string }) {
  return (
    <section className="page-header" aria-labelledby="team-tournament-title">
      <p className="eyebrow">Event Headquarters</p>
      <h1 id="team-tournament-title">{title}</h1>
      <p>Rosters, pairings, standings, and tournament operations.</p>
    </section>
  )
}

function TournamentMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="team-tournament-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function RegistrationPanel({
  disabled,
  onRegister,
  userTeam,
}: {
  disabled: boolean
  onRegister: (teamName: string) => void
  userTeam: TeamTournamentTeam | null
}) {
  const [teamName, setTeamName] = useState(userTeam?.teamName ?? '')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onRegister(teamName)
  }

  return (
    <section className="panel team-tournament-panel" id="team-tournament-register">
      <div className="panel-heading">
        <p className="eyebrow">Registration</p>
        <h2>Your Tournament Entry</h2>
      </div>
      {userTeam ? (
        <p>
          You are registered with <strong>{userTeam.teamName}</strong>.
        </p>
      ) : (
        <form className="team-tournament-form" onSubmit={submit}>
          <label>
            <span>Team Name</span>
            <input
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Enter your team"
              required
              value={teamName}
            />
          </label>
          <button disabled={disabled || teamName.trim() === ''} type="submit">
            Register for Tournament
          </button>
        </form>
      )}
    </section>
  )
}

function TeamStandings({
  standings,
}: {
  standings: TeamTournamentData['standings']
}) {
  return (
    <section className="panel team-tournament-panel" id="team-tournament-standings">
      <div className="panel-heading">
        <p className="eyebrow">Team Standings</p>
        <h2>Rankings</h2>
      </div>
      {standings.length === 0 ? (
        <p>No team standings yet.</p>
      ) : (
        <div className="team-tournament-table-shell">
          <table className="team-tournament-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>W</th>
                <th>L</th>
                <th>TP</th>
                <th>OP</th>
                <th>VP</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team) => (
                <tr key={team.teamId}>
                  <td>{team.rank}</td>
                  <td>{team.teamName}</td>
                  <td>{team.wins}</td>
                  <td>{team.losses}</td>
                  <td>{team.tournamentPoints}</td>
                  <td>{team.objectivePoints}</td>
                  <td>{team.victoryPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function PairingsPanel({ pairings }: { pairings: TeamTournamentPairing[] }) {
  return (
    <section className="panel team-tournament-panel" id="team-tournament-pairings">
      <div className="panel-heading">
        <p className="eyebrow">Pairings</p>
        <h2>Current Matches</h2>
      </div>
      {pairings.length === 0 ? (
        <p>No pairings posted yet.</p>
      ) : (
        <div className="team-pairing-list">
          {pairings.map((pairing) => (
            <article
              className="team-pairing-card"
              key={`${pairing.roundId}-${pairing.teamA}-${pairing.teamB}`}
            >
              <p className="eyebrow">{pairing.round}</p>
              <h3>
                {pairing.teamA} <span>vs</span> {pairing.teamB}
              </h3>
              <p>{pairing.status}</p>
              {pairing.playerPairings ? <pre>{pairing.playerPairings}</pre> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function RostersPanel({ teams }: { teams: TeamTournamentTeam[] }) {
  return (
    <section className="panel team-tournament-panel">
      <div className="panel-heading">
        <p className="eyebrow">Rosters</p>
        <h2>Registered Teams</h2>
      </div>
      {teams.length === 0 ? (
        <p>No teams registered yet.</p>
      ) : (
        <div className="team-roster-grid">
          {teams.map((team) => (
            <article className="team-roster-card" key={team.teamId}>
              <h3>{team.teamName}</h3>
              <p>Captain: {team.captain || 'Not assigned'}</p>
              <ul>
                {splitPlayers(team.players).map((player) => (
                  <li key={player}>
                    <Link to={`/player/${encodeURIComponent(player)}`}>
                      {formatPlayerName(player)}
                    </Link>
                  </li>
                ))}
              </ul>
              <p>{team.discordContact || 'Discord contact not provided.'}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function LatestResults({ data }: { data: TeamTournamentData }) {
  return (
    <section className="panel team-tournament-panel">
      <div className="panel-heading">
        <p className="eyebrow">Latest Results</p>
        <h2>Event Games</h2>
      </div>
      {data.latestResults.length === 0 ? (
        <p>No tournament games reported yet.</p>
      ) : (
        data.latestResults.map((game) => (
          <p key={game.id}>
            {game.winnerDisplayName} defeated {game.loserDisplayName} in{' '}
            {game.mission}.
          </p>
        ))
      )}
    </section>
  )
}

function NewsPanel({ news }: { news: string[] }) {
  return (
    <section className="panel team-tournament-panel">
      <div className="panel-heading">
        <p className="eyebrow">Tournament News</p>
        <h2>Headlines</h2>
      </div>
      {news.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </section>
  )
}

function QuickActions({
  actions,
}: {
  actions: TeamTournamentData['quickActions']
}) {
  function activate(action: string) {
    document
      .getElementById(`team-tournament-${action}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="panel team-tournament-panel">
      <div className="panel-heading">
        <p className="eyebrow">Quick Actions</p>
        <h2>Tournament Tools</h2>
      </div>
      <div className="team-tournament-actions">
        {actions.map((action) => (
          <button
            disabled={!action.enabled}
            key={action.action}
            onClick={() => activate(action.action)}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function CommissionerTournamentTools({
  disabled,
  onPairing,
  onTeam,
}: {
  disabled: boolean
  onPairing: (params: Record<string, string>) => void
  onTeam: (params: Record<string, string>) => void
}) {
  return (
    <section className="team-tournament-grid">
      <TeamForm disabled={disabled} onSubmit={onTeam} />
      <PairingForm disabled={disabled} onSubmit={onPairing} />
    </section>
  )
}

function TeamForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean
  onSubmit: (params: Record<string, string>) => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onSubmit(Object.fromEntries(form.entries()) as Record<string, string>)
    event.currentTarget.reset()
  }

  return (
    <form className="panel team-tournament-form" onSubmit={submit}>
      <p className="eyebrow">Commissioner</p>
      <h2>Create or Update Team</h2>
      <input name="teamName" placeholder="Team name" required />
      <input name="captain" placeholder="Captain" />
      <textarea name="players" placeholder="Players, separated by commas" />
      <input name="discordContact" placeholder="Discord contact" />
      <button disabled={disabled} type="submit">
        Save Team
      </button>
    </form>
  )
}

function PairingForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean
  onSubmit: (params: Record<string, string>) => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onSubmit(Object.fromEntries(form.entries()) as Record<string, string>)
    event.currentTarget.reset()
  }

  return (
    <form className="panel team-tournament-form" onSubmit={submit}>
      <p className="eyebrow">Commissioner</p>
      <h2>Post Pairing</h2>
      <input name="round" placeholder="Round" />
      <input name="teamA" placeholder="Team A" required />
      <input name="teamB" placeholder="Team B" required />
      <textarea name="playerPairings" placeholder="Individual pairings" />
      <button disabled={disabled} type="submit">
        Save Pairing
      </button>
    </form>
  )
}

function findUserTeam(teams: TeamTournamentTeam[], player: string) {
  const key = player.trim().toLowerCase()

  if (!key) {
    return null
  }

  return (
    teams.find((team) =>
      splitPlayers(team.players).some((member) => member.toLowerCase() === key),
    ) ?? null
  )
}

function splitPlayers(players: string) {
  return players
    .split(/[,;\n]/)
    .map((player) => player.trim())
    .filter(Boolean)
}

export default TeamTournament
