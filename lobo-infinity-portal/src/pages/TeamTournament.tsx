import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import {
  apiClient,
  type EventRegistrationData,
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

  async function register(params: Record<string, string>) {
    setWorking('register')
    try {
      await apiClient.registerForEvent({
        ...params,
        eventId: defaultEventId,
      })
      const data = await apiClient.getTeamTournament(defaultEventId)
      setState({ data, status: 'success' })
    } finally {
      setWorking('')
    }
  }

  async function withdraw() {
    setWorking('withdraw')
    try {
      await apiClient.withdrawEventRegistration({
        eventId: defaultEventId,
      })
      const data = await apiClient.getTeamTournament(defaultEventId)
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
          onRegister={(params) => void register(params)}
          onWithdraw={() => void withdraw()}
          registration={data.registration}
          userDisplayName={auth.user?.playerDisplayName ?? auth.user?.leaguePlayer ?? ''}
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
        <RegistrationManagementPanel registration={data.registration} />
      </section>

      <QuickActions actions={data.quickActions} />

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
  onWithdraw,
  registration,
  userDisplayName,
}: {
  disabled: boolean
  onRegister: (params: Record<string, string>) => void
  onWithdraw: () => void
  registration: EventRegistrationData
  userDisplayName: string
}) {
  const [editing, setEditing] = useState(false)
  const current = registration.currentPlayer
  const [preferredTeam, setPreferredTeam] = useState(
    current?.preferredTeam || current?.team || '',
  )
  const [discord, setDiscord] = useState(current?.discord ?? '')
  const [captain, setCaptain] = useState(current?.captain ?? false)
  const [freeAgent, setFreeAgent] = useState(current?.freeAgent ?? true)
  const [faction, setFaction] = useState(current?.faction ?? '')
  const [notes, setNotes] = useState(current?.notes ?? '')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onRegister({
      captain: captain ? 'true' : 'false',
      discord,
      faction,
      freeAgent: freeAgent ? 'true' : 'false',
      notes,
      preferredTeam: freeAgent ? 'Looking for Team' : preferredTeam,
      teamName: freeAgent ? 'Looking for Team' : preferredTeam,
    })
    setEditing(false)
  }

  const canRegister = registration.registrationOpen
  const status = current?.status ?? registration.status
  const showForm = editing || !current

  return (
    <section className="panel team-tournament-panel" id="team-tournament-register">
      <div className="panel-heading">
        <p className="eyebrow">Registration</p>
        <h2>{registration.eventName}</h2>
      </div>
      <div className="event-registration-status">
        <span>{current ? 'Registered Player' : 'Registration Status'}</span>
        <strong>{current ? `✓ ${status}` : status}</strong>
        <small>
          {registration.registeredCount} players registered
          {registration.waitlistCount > 0
            ? `, ${registration.waitlistCount} waitlisted`
            : ''}
        </small>
      </div>

      {current && !showForm ? (
        <div className="event-registration-summary">
          <p>
            You are registered as <strong>{current.displayName}</strong>.
          </p>
          <p>
            Team preference:{' '}
            <strong>{current.preferredTeam || current.team || 'Looking for Team'}</strong>
          </p>
          {current.discord ? <p>Discord: {current.discord}</p> : null}
          {current.faction ? <p>Primary faction: {current.faction}</p> : null}
          <div className="event-registration-actions">
            <button disabled={disabled || !canRegister} onClick={() => setEditing(true)} type="button">
              Edit Registration
            </button>
            <button disabled={disabled || !canRegister} onClick={onWithdraw} type="button">
              Withdraw
            </button>
          </div>
        </div>
      ) : (
        <form className="team-tournament-form" onSubmit={submit}>
          <p>
            Player: <strong>{current?.displayName || userDisplayName || 'Your profile'}</strong>
          </p>
          <label>
            <span>Discord</span>
            <input
              onChange={(event) => setDiscord(event.target.value)}
              placeholder="Discord handle"
              value={discord}
            />
          </label>
          <label>
            <span>Preferred Team</span>
            <input
              disabled={freeAgent}
              onChange={(event) => setPreferredTeam(event.target.value)}
              placeholder="Team name"
              value={preferredTeam}
            />
          </label>
          <label className="event-registration-check">
            <input
              checked={freeAgent}
              onChange={(event) => setFreeAgent(event.target.checked)}
              type="checkbox"
            />
            <span>Looking for Team</span>
          </label>
          <label className="event-registration-check">
            <input
              checked={captain}
              onChange={(event) => setCaptain(event.target.checked)}
              type="checkbox"
            />
            <span>Captain?</span>
          </label>
          <label>
            <span>Primary Faction</span>
            <input
              onChange={(event) => setFaction(event.target.value)}
              placeholder="Optional"
              value={faction}
            />
          </label>
          <label>
            <span>Notes</span>
            <textarea
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything the Commissioner should know"
              rows={3}
              value={notes}
            />
          </label>
          <div className="event-registration-actions">
            <button
              disabled={
                disabled ||
                !canRegister ||
                (!freeAgent && preferredTeam.trim() === '')
              }
              type="submit"
            >
              {current ? 'Update Registration' : 'Register for Event'}
            </button>
            {current ? (
              <button disabled={disabled} onClick={() => setEditing(false)} type="button">
                Cancel
              </button>
            ) : null}
          </div>
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

function RegistrationManagementPanel({
  registration,
}: {
  registration: EventRegistrationData
}) {
  return (
    <section className="panel team-tournament-panel">
      <div className="panel-heading">
        <p className="eyebrow">Registration Desk</p>
        <h2>Event Entries</h2>
      </div>
      <div className="team-tournament-grid compact">
        <TournamentMetric label="Players" value={registration.registeredCount} />
        <TournamentMetric label="Teams" value={registration.teamCount} />
        <TournamentMetric label="Free Agents" value={registration.freeAgents.length} />
        <TournamentMetric label="Captains" value={registration.captains.length} />
      </div>
      {registration.registrations.length === 0 ? (
        <p>No players have registered yet.</p>
      ) : (
        <ul>
          {registration.registrations.slice(0, 8).map((entry) => (
            <li key={entry.player}>
              <strong>{entry.displayName}</strong>
              <span>
                {entry.status} ·{' '}
                {entry.preferredTeam || entry.team || 'Looking for Team'}
              </span>
            </li>
          ))}
        </ul>
      )}
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

function splitPlayers(players: string) {
  return players
    .split(/[,;\n]/)
    .map((player) => player.trim())
    .filter(Boolean)
}

export default TeamTournament
