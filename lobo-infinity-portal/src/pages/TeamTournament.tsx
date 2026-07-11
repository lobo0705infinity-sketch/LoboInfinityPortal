import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Skeleton from '../components/Skeleton'
import {
  type EventRegistrationData,
  type TeamTournamentData,
  type TeamTournamentMutationResult,
  type TeamTournamentPairing,
  type TeamTournamentTeam,
} from '../services/api'
import { registrationRepository, teamRepository } from '../services/data'
import { formatPlayerName } from '../services/formatting'
import './TeamTournament.css'

type TournamentState =
  | { status: 'loading' }
  | { data: TeamTournamentData; status: 'success' }
  | { error: string; status: 'error' }

type TournamentSection =
  | 'overview'
  | 'pairings'
  | 'registration'
  | 'results'
  | 'standings'
  | 'teams'

const defaultEventId = 'event-august-2026-team-tournament'

function TeamTournament({ eventId: experienceEventId }: { eventId?: string }) {
  const { eventId: routeEventId, section } = useParams<{
    eventId: string
    section?: string
  }>()
  const [searchParams] = useSearchParams()
  const auth = useAuth()
  const [state, setState] = useState<TournamentState>({ status: 'loading' })
  const [working, setWorking] = useState('')
  const [toast, setToast] = useState('')
  const activeEventId =
    experienceEventId ||
    (routeEventId ? decodeURIComponent(routeEventId) : '') ||
    searchParams.get('eventId') ||
    defaultEventId

  useEffect(() => {
    const controller = new AbortController()

    teamRepository
      .getTeamTournament(activeEventId, { signal: controller.signal })
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
  }, [activeEventId])

  async function register(params: Record<string, string>) {
    setWorking('register')
    try {
      await registrationRepository.register({
        ...params,
        eventId: activeEventId,
      })
      const data = await teamRepository.getTeamTournament(activeEventId)
      setState({ data, status: 'success' })
    } finally {
      setWorking('')
    }
  }

  async function withdraw() {
    setWorking('withdraw')
    try {
      await registrationRepository.withdraw({
        eventId: activeEventId,
      })
      const data = await teamRepository.getTeamTournament(activeEventId)
      setState({ data, status: 'success' })
    } finally {
      setWorking('')
    }
  }

  async function saveTeam(params: Record<string, string>) {
    setWorking('team')
    try {
      const result = await teamRepository.saveTeam({
        ...params,
        eventId: activeEventId,
      })
      setState((current) => applyTeamTournamentMutationState(current, result))
      setToast(getTeamSaveToast(params))
    } finally {
      setWorking('')
    }
  }

  async function manageParticipant(
    entry: EventRegistrationData['registrations'][number],
    status: string,
  ) {
    const clickedAt = performance.now()
    recordApprovalTiming(
      'approvalButtonClick',
      activeEventId,
      entry,
      status,
      clickedAt,
      clickedAt,
      'button clicked',
    )
    setWorking(`participant:${entry.player}`)
    setToast('')

    if (state.status === 'success') {
      setState({
        data: updateParticipantStatus(state.data, entry.player, status),
        status: 'success',
      })
    }

    try {
      const requestStart = performance.now()
      recordApprovalTiming(
        'approvalRequestStart',
        activeEventId,
        entry,
        status,
        clickedAt,
        requestStart,
        'manageEventRegistration request started',
      )
      await registrationRepository.manage({
        captain: entry.captain ? 'true' : 'false',
        discord: entry.discord,
        displayName: entry.displayName,
        email: entry.email,
        eventId: activeEventId,
        faction: entry.faction,
        freeAgent: entry.freeAgent ? 'true' : 'false',
        notes: entry.notes,
        player: entry.player,
        preferredTeam: entry.preferredTeam,
        role: entry.role,
        seed: entry.seed,
        responseMode: 'mutation',
        status,
        team: entry.team,
        teamName: entry.team,
      })
      const requestComplete = performance.now()
      recordApprovalTiming(
        'approvalRequestComplete',
        activeEventId,
        entry,
        status,
        requestStart,
        requestComplete,
        'manageEventRegistration request completed',
      )
      setState((current) =>
        current.status === 'success'
          ? {
              data: updateParticipantStatus(current.data, entry.player, status),
              status: 'success',
            }
          : current,
      )
      recordApprovalTiming(
        'approvalStateUpdated',
        activeEventId,
        entry,
        status,
        clickedAt,
        performance.now(),
        'participant state updated after refresh',
      )
      setToast(`${entry.displayName || entry.player} set to ${status}.`)
      recordApprovalTiming(
        'approvalToastShown',
        activeEventId,
        entry,
        status,
        clickedAt,
        performance.now(),
        'success toast shown',
      )
    } catch (error) {
      recordApprovalTiming(
        'approvalFailed',
        activeEventId,
        entry,
        status,
        clickedAt,
        performance.now(),
        error instanceof Error ? error.message : 'participant update failed',
      )
      const data = await teamRepository.getTeamTournament(activeEventId)
      setState({ data, status: 'success' })
      setToast(error instanceof Error ? error.message : 'Participant update failed.')
    } finally {
      setWorking('')
    }
  }

  async function savePairing(params: Record<string, string>) {
    setWorking('pairing')
    try {
      const result = await teamRepository.savePairing({
        ...params,
        eventId: activeEventId,
      })
      setState((current) => applyTeamTournamentMutationState(current, result))
    } finally {
      setWorking('')
    }
  }

  async function saveInvitation(params: Record<string, string>) {
    setWorking('invitation')
    try {
      const result = await teamRepository.saveInvitation({
        ...params,
        eventId: activeEventId,
      })
      setState((current) => applyTeamTournamentMutationState(current, result))
    } finally {
      setWorking('')
    }
  }

  async function advanceRound(params: Record<string, string>) {
    setWorking('round')
    try {
      const result = await teamRepository.advanceRound({
        ...params,
        eventId: activeEventId,
      })
      setState((current) => applyTeamTournamentMutationState(current, result))
    } finally {
      setWorking('')
    }
  }

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="team-tournament-hero panel" aria-label="Team Tournament loading">
          <div>
            <p className="eyebrow">Team Tournament</p>
            <h2>Loading tournament status</h2>
            <p>Preparing registration, pairings, standings, and operations.</p>
          </div>
          <TournamentMetric label="Teams" value={0} />
          <TournamentMetric label="Matches" value={0} />
          <TournamentMetric label="Round" value={0} />
        </section>
        <section className="team-tournament-grid" aria-label="Team Tournament content loading">
          <Skeleton label="Team Tournament registration loading" rows={5} />
          <Skeleton label="Team Tournament standings loading" rows={6} />
        </section>
        <section className="team-tournament-grid" aria-label="Team Tournament operations loading">
          <Skeleton label="Team Tournament pairings loading" rows={5} />
          <Skeleton label="Team Tournament results loading" rows={5} />
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
  const activeTeams = data.teams.filter((team) => team.status !== 'Deleted')
  const activeSection = getTournamentSection(section)
  const showOverview = activeSection === 'overview'

  return (
    <main className="portal-shell">
      <PageHeader section={activeSection} title={data.event.name} />

      {toast ? (
        <section className="dashboard-state compact" role="status">
          <p>{toast}</p>
        </section>
      ) : null}

      {showOverview ? (
        <section className="team-tournament-hero panel" data-tournament-section="overview">
          <div>
            <p className="eyebrow">{data.event.type}</p>
            <h2>{data.status}</h2>
            <p>
              {data.currentRound
                ? String(data.currentRound['name'] ?? 'Current round')
              : 'Round setup pending'}
            </p>
            <Link to={`/event/${encodeURIComponent(data.event.id)}`}>
              Open Event Home
            </Link>
          </div>
          <TournamentMetric label="Teams" value={data.registeredTeams} />
          <TournamentMetric label="Completed" value={data.completedMatches} />
          <TournamentMetric label="Pairings" value={data.pairings.length} />
          <TournamentMetric label="Players" value={data.registration.registeredCount} />
        </section>
      ) : null}

      {showOverview && data.champion ? <ChampionPanel champion={data.champion} /> : null}

      {showOverview || activeSection === 'registration' ? (
      <section className="team-tournament-grid">
        <RegistrationPanel
          disabled={working !== ''}
          onRegister={(params) => void register(params)}
          onWithdraw={() => void withdraw()}
          registration={data.registration}
          userDisplayName={auth.user?.playerDisplayName ?? auth.user?.leaguePlayer ?? ''}
        />
        {showOverview ? <NewsPanel news={data.news} /> : null}
      </section>
      ) : null}

      {showOverview || activeSection === 'standings' || activeSection === 'pairings' ? (
      <section className="team-tournament-grid">
        {showOverview || activeSection === 'standings' ? (
        <TeamStandings standings={data.standings} />
        ) : null}
        {showOverview || activeSection === 'pairings' ? (
        <PairingsPanel pairings={data.pairings} />
        ) : null}
      </section>
      ) : null}

      {showOverview || activeSection === 'teams' ? (
      <section className="team-tournament-grid">
        <FreeAgentCenter
          disabled={working !== ''}
          freeAgents={data.freeAgents}
          onInvite={(params) => void saveInvitation(params)}
          teams={activeTeams}
        />
        <InvitationCenter invitations={data.invitations} />
      </section>
      ) : null}

      {showOverview || activeSection === 'results' ? (
      <section className="team-tournament-grid">
        {isCommissioner ? <ResultStatusPanel statuses={data.resultStatuses} /> : <SubmitResultCard eventId={data.event.id} />}
        {showOverview ? <TournamentTimeline timeline={data.timeline} /> : null}
      </section>
      ) : null}

      {showOverview || activeSection === 'teams' ? <RostersPanel teams={activeTeams} /> : null}

      {showOverview || activeSection === 'results' || activeSection === 'registration' ? (
      <section className="team-tournament-grid">
        {showOverview || activeSection === 'results' ? <LatestResults data={data} /> : null}
        {showOverview || activeSection === 'registration' ? (
        <RegistrationManagementPanel
          disabled={working.startsWith('participant:')}
          isCommissioner={isCommissioner}
          onStatus={(entry, status) => void manageParticipant(entry, status)}
          registration={data.registration}
          working={working}
        />
        ) : null}
      </section>
      ) : null}

      {showOverview ? <QuickActions actions={data.quickActions} /> : null}

      {isCommissioner && (showOverview || activeSection === 'teams' || activeSection === 'pairings') ? (
        activeSection === 'teams' ? (
          <section className="team-tournament-grid" id="team-tournament-commissioner">
            <TeamForm
              disabled={working !== ''}
              onSubmit={(params) => void saveTeam(params)}
              registration={data.registration}
              teams={activeTeams}
            />
          </section>
        ) : activeSection === 'pairings' ? (
          <section className="team-tournament-grid" id="team-tournament-commissioner">
            <PairingForm disabled={working !== ''} onSubmit={(params) => void savePairing(params)} />
            <RoundControlForm disabled={working !== ''} onSubmit={(params) => void advanceRound(params)} />
          </section>
        ) : (
          <CommissionerTournamentTools
            disabled={working !== ''}
            onRound={(params) => void advanceRound(params)}
            onPairing={(params) => void savePairing(params)}
            onTeam={(params) => void saveTeam(params)}
            registration={data.registration}
            teams={activeTeams}
          />
        )
      ) : null}
    </main>
  )
}

function PageHeader({
  section = 'overview',
  title = 'Team Tournament',
}: {
  section?: TournamentSection
  title?: string
}) {
  const sectionLabel = getTournamentSectionLabel(section)

  return (
    <section className="page-header" aria-labelledby="team-tournament-title">
      <p className="eyebrow">Event Headquarters</p>
      <h1 id="team-tournament-title">
        {section === 'overview' ? title : `${title} ${sectionLabel}`}
      </h1>
      <p>Rosters, pairings, standings, and tournament operations.</p>
    </section>
  )
}

function getTournamentSection(section?: string): TournamentSection {
  if (section === 'pairings') return 'pairings'
  if (section === 'registration' || section === 'register') return 'registration'
  if (section === 'results') return 'results'
  if (section === 'standings') return 'standings'
  if (section === 'teams') return 'teams'

  return 'overview'
}

function getTournamentSectionLabel(section: TournamentSection) {
  if (section === 'pairings') return 'Pairings'
  if (section === 'registration') return 'Registration'
  if (section === 'results') return 'Results'
  if (section === 'standings') return 'Standings'
  if (section === 'teams') return 'Teams'

  return ''
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
    <section
      className="panel team-tournament-panel"
      data-tournament-section="registration"
      id="team-tournament-register"
    >
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
    <section
      className="panel team-tournament-panel"
      data-tournament-section="standings"
      id="team-tournament-standings"
    >
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
    <section
      className="panel team-tournament-panel"
      data-tournament-section="pairings"
      id="team-tournament-pairings"
    >
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

function FreeAgentCenter({
  disabled,
  freeAgents,
  onInvite,
  teams,
}: {
  disabled: boolean
  freeAgents: EventRegistrationData['freeAgents']
  onInvite: (params: Record<string, string>) => void
  teams: TeamTournamentTeam[]
}) {
  const defaultTeam = teams[0]?.teamName ?? ''

  function invite(player: string, teamName: string) {
    onInvite({
      player,
      teamName,
      status: 'Pending',
    })
  }

  return (
    <section
      className="panel team-tournament-panel"
      data-tournament-section="teams"
      id="team-tournament-free-agents"
    >
      <div className="panel-heading">
        <p className="eyebrow">Free Agent Center</p>
        <h2>Looking for Team</h2>
      </div>
      {freeAgents.length === 0 ? (
        <p>No free agents are currently waiting for a team.</p>
      ) : (
        <div className="team-pairing-list">
          {freeAgents.map((agent) => {
            const preferredTeam = agent.preferredTeam || defaultTeam

            return (
              <article className="team-pairing-card" key={agent.player}>
                <strong>{agent.displayName || agent.player}</strong>
                <p>{agent.faction || 'Faction not provided'}</p>
                <p>{agent.discord || 'Discord not provided'}</p>
                <p>{agent.registeredAt || 'Registration date unavailable'}</p>
                <select
                  aria-label={`Team for ${agent.displayName || agent.player}`}
                  defaultValue={preferredTeam}
                  disabled={disabled || teams.length === 0}
                  onChange={(event) =>
                    invite(agent.player, event.target.value)
                  }
                >
                  <option value="">Select team</option>
                  {teams.map((team) => (
                    <option key={team.teamId} value={team.teamName}>
                      {team.teamName}
                    </option>
                  ))}
                </select>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function InvitationCenter({
  invitations,
}: {
  invitations: TeamTournamentData['invitations']
}) {
  return (
    <section
      className="panel team-tournament-panel"
      data-tournament-section="teams"
      id="team-tournament-invitations"
    >
      <div className="panel-heading">
        <p className="eyebrow">Team Invitations</p>
        <h2>Invite Queue</h2>
      </div>
      {invitations.length === 0 ? (
        <p>No active invitations.</p>
      ) : (
        <div className="team-pairing-list">
          {invitations.map((invitation) => (
            <article className="team-pairing-card" key={invitation.invitationId}>
              <strong>{invitation.teamName}</strong>
              <p>Player: {invitation.player}</p>
              <p>Captain: {invitation.captain || 'Commissioner'}</p>
              <p>Status: {invitation.status}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function RostersPanel({ teams }: { teams: TeamTournamentTeam[] }) {
  return (
    <section className="panel team-tournament-panel" data-tournament-section="teams">
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
    <section className="panel team-tournament-panel" data-tournament-section="results">
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

function SubmitResultCard({ eventId }: { eventId: string }) {
  return (
    <section
      className="panel team-tournament-panel"
      data-tournament-section="results"
      id="team-tournament-results"
    >
      <div className="panel-heading">
        <p className="eyebrow">Match Reporting</p>
        <h2>Submit Tournament Result</h2>
      </div>
      <p>Use the event result page to report your assigned table.</p>
      <Link className="submit-match-button" to={`/event/${encodeURIComponent(eventId)}/submit-result`}>
        Submit Result
      </Link>
    </section>
  )
}

function ResultStatusPanel({
  statuses,
}: {
  statuses: TeamTournamentData['resultStatuses']
}) {
  const counts = statuses.reduce(
    (summary, item) => {
      const key = normalizeResultStatus(item.status)
      summary[key] += 1
      return summary
    },
    { confirmed: 0, outstanding: 0, pending: 0, submitted: 0 },
  )

  return (
    <section
      className="panel team-tournament-panel"
      data-tournament-section="results"
      id="team-tournament-results"
    >
      <div className="panel-heading">
        <p className="eyebrow">Commissioner</p>
        <h2>Result Queue</h2>
      </div>
      <div className="team-tournament-actions">
        <span>Submitted {counts.submitted}</span>
        <span>Pending {counts.pending}</span>
        <span>Confirmed {counts.confirmed}</span>
        <span>Outstanding {counts.outstanding}</span>
      </div>
      {statuses.length === 0 ? (
        <p>No table pairings are published yet.</p>
      ) : (
        <div className="team-tournament-table-shell">
          <table className="team-tournament-table">
            <thead>
              <tr>
                <th>Table</th>
                <th>Round</th>
                <th>Match</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((item) => (
                <tr key={`${item.roundId}-${item.table}-${item.player}-${item.opponent}`}>
                  <td>{item.table || '-'}</td>
                  <td>{item.round}</td>
                  <td>
                    {item.player && item.opponent
                      ? `${item.player} vs ${item.opponent}`
                      : `${item.teamA} vs ${item.teamB}`}
                  </td>
                  <td>{formatResultStatus(item.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function TournamentTimeline({
  timeline,
}: {
  timeline: TeamTournamentData['timeline']
}) {
  return (
    <section
      className="panel team-tournament-panel"
      data-tournament-section="overview"
      id="team-tournament-timeline"
    >
      <div className="panel-heading">
        <p className="eyebrow">Tournament Timeline</p>
        <h2>Live Event Story</h2>
      </div>
      {timeline.length === 0 ? (
        <p>No tournament activity yet.</p>
      ) : (
        <div className="event-home-timeline">
          {timeline.slice(0, 10).map((item) => (
            <article key={`${item.type}-${item.title}-${item.timestamp}`}>
              <span>{item.type}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function ChampionPanel({
  champion,
}: {
  champion: NonNullable<TeamTournamentData['champion']>
}) {
  return (
    <section className="panel team-tournament-hero" data-tournament-section="overview">
      <div>
        <p className="eyebrow">Tournament Champion</p>
        <h2>{champion.teamName}</h2>
        <p>Captain: {champion.captain || 'Not assigned'}</p>
        <p>{champion.players.join(', ') || 'Roster pending'}</p>
      </div>
      <TournamentMetric label="Wins" value={champion.wins} />
      <TournamentMetric label="TP" value={champion.tournamentPoints} />
      <TournamentMetric label="OP" value={champion.objectivePoints} />
      <TournamentMetric label="VP" value={champion.victoryPoints} />
    </section>
  )
}

function NewsPanel({ news }: { news: string[] }) {
  return (
    <section className="panel team-tournament-panel" data-tournament-section="overview">
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
    <section className="panel team-tournament-panel" data-tournament-section="overview">
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
  disabled,
  isCommissioner,
  onStatus,
  registration,
  working,
}: {
  disabled: boolean
  isCommissioner: boolean
  onStatus: (entry: EventRegistrationData['registrations'][number], status: string) => void
  registration: EventRegistrationData
  working: string
}) {
  return (
    <section className="panel team-tournament-panel" data-tournament-section="registration">
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
          {registration.registrations.slice(0, 12).map((entry) => {
            const rowWorking = working === `participant:${entry.player}`
            const approved = entry.status === 'Approved'

            return (
            <li key={entry.player}>
              <strong>{entry.displayName}</strong>
              <span>
                {entry.status} ·{' '}
                {entry.preferredTeam || entry.team || 'Looking for Team'}
              </span>
              {isCommissioner ? (
                <div className="team-tournament-actions compact">
                  {approved ? (
                    <span>Approved</span>
                  ) : (
                    <button
                      disabled={disabled || rowWorking}
                      onClick={() => onStatus(entry, 'Approved')}
                      type="button"
                    >
                      {rowWorking ? 'Updating...' : 'Approve'}
                    </button>
                  )}
                  <button
                    disabled={disabled || rowWorking || entry.status === 'Waitlisted'}
                    onClick={() => onStatus(entry, 'Waitlisted')}
                    type="button"
                  >
                    Waitlist
                  </button>
                  <button
                    disabled={disabled || rowWorking || entry.status === 'Withdrawn'}
                    onClick={() => {
                      if (window.confirm(`Remove ${entry.displayName || entry.player} from this event?`)) {
                        onStatus(entry, 'Withdrawn')
                      }
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function CommissionerTournamentTools({
  disabled,
  onRound,
  onPairing,
  onTeam,
  registration,
  teams,
}: {
  disabled: boolean
  onRound: (params: Record<string, string>) => void
  onPairing: (params: Record<string, string>) => void
  onTeam: (params: Record<string, string>) => void
  registration: EventRegistrationData
  teams: TeamTournamentTeam[]
}) {
  return (
    <section
      className="team-tournament-grid"
      data-tournament-section="overview"
      id="team-tournament-commissioner"
    >
      <TeamForm
        disabled={disabled}
        onSubmit={onTeam}
        registration={registration}
        teams={teams}
      />
      <PairingForm disabled={disabled} onSubmit={onPairing} />
      <RoundControlForm disabled={disabled} onSubmit={onRound} />
    </section>
  )
}

function TeamForm({
  disabled,
  onSubmit,
  registration,
  teams,
}: {
  disabled: boolean
  onSubmit: (params: Record<string, string>) => void
  registration: EventRegistrationData
  teams: TeamTournamentTeam[]
}) {
  const [captain, setCaptain] = useState('')
  const [availableSearch, setAvailableSearch] = useState('')
  const [discordContact, setDiscordContact] = useState('')
  const [editingTeamId, setEditingTeamId] = useState('')
  const [editingSnapshot, setEditingSnapshot] = useState('')
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [memberSlots, setMemberSlots] = useState<string[]>(['', '', '', ''])
  const [touchedFields, setTouchedFields] = useState({
    captain: false,
    members: false,
    teamName: false,
  })
  const [teamName, setTeamName] = useState('')
  const editingTeam = teams.find((team) => team.teamId === editingTeamId)
  const approvedPlayers = getApprovedTournamentPlayers(registration)
  const assignedByTeam = getAssignedTournamentPlayers(teams)
  const currentRoster = [captain, ...memberSlots].filter(Boolean)
  const rosterProgress = getTournamentRosterProgress(currentRoster)
  const rosterStatus = getTournamentRosterStatus(currentRoster, editingTeam?.status)
  const validationMessages = validateTournamentRoster(teamName, captain, memberSlots, touchedFields)
  const visibleValidationMessages = formErrors.length > 0 ? formErrors : validationMessages
  const invalidFields = getTournamentInvalidFields(teamName, captain, visibleValidationMessages)
  const availablePlayers = approvedPlayers.filter((player) => {
    const owner = assignedByTeam.get(normalizeTournamentPlayer(player.name))
    return !owner || owner.teamId === editingTeamId || currentRoster.includes(player.name)
  })
  const visibleAvailablePlayers = availablePlayers.filter((player) =>
    player.searchText.includes(availableSearch.trim().toLowerCase()),
  )
  const assignedGroups = teams
    .filter((team) => team.status !== 'Deleted')
    .map((team) => ({
      captain: team.captain,
      teamId: team.teamId,
      teamName: team.teamName,
      players: splitPlayers(team.players),
    }))
  const sortedTeams = [...teams]
    .filter((team) => team.status !== 'Deleted')
    .sort((left, right) => {
      const leftStatus = getTournamentRosterStatus(splitPlayers(left.players), left.status)
      const rightStatus = getTournamentRosterStatus(splitPlayers(right.players), right.status)

      if (leftStatus !== rightStatus) {
        return leftStatus === 'Ready' ? -1 : 1
      }

      return left.teamName.localeCompare(right.teamName)
    })
  const missingPlayers = Math.max(0, 5 - currentRoster.length)
  const canAutoFill = missingPlayers > 0 && availablePlayers.length > 0 && availablePlayers.length < 5

  function loadTeam(teamId: string) {
    const team = teams.find((candidate) => candidate.teamId === teamId)
    const roster = team ? splitPlayers(team.players) : []
    const nextCaptain = team?.captain || roster[0] || ''
    const members = roster
      .filter((player) => normalizeTournamentPlayer(player) !== normalizeTournamentPlayer(nextCaptain))
      .slice(0, 4)

    setEditingTeamId(teamId)
    setTeamName(team?.teamName ?? '')
    setCaptain(nextCaptain)
    setDiscordContact(team?.discordContact ?? '')
    setMemberSlots(padTournamentMembers(members))
    setEditingSnapshot(team ? getTournamentTeamSignature(team) : '')
  }

  function clearEditor() {
    setEditingTeamId('')
    setEditingSnapshot('')
    setAvailableSearch('')
    setFormErrors([])
    setTouchedFields({
      captain: false,
      members: false,
      teamName: false,
    })
    setTeamName('')
    setCaptain('')
    setDiscordContact('')
    setMemberSlots(['', '', '', ''])
  }

  function updateMemberSlot(index: number, player: string) {
    setFormErrors([])
    setMemberSlots((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? player : slot)),
    )
  }

  function touchField(field: keyof typeof touchedFields) {
    const nextTouched = {
      ...touchedFields,
      [field]: true,
    }

    setTouchedFields(nextTouched)
    setFormErrors([])
  }

  function autoFillRemainingPlayers() {
    const additions = availablePlayers
      .map((player) => player.name)
      .filter((player) => !currentRoster.some((selected) => normalizeTournamentPlayer(selected) === normalizeTournamentPlayer(player)))
      .slice(0, missingPlayers)

    if (additions.length === 0) {
      return
    }

    setMemberSlots((current) => {
      const next = [...current]
      let additionIndex = 0

      for (let index = 0; index < next.length && additionIndex < additions.length; index += 1) {
        if (!next[index]) {
          next[index] = additions[additionIndex]
          additionIndex += 1
        }
      }

      return next
    })
  }

  async function copyTeam(team: TeamTournamentTeam) {
    const roster = splitPlayers(team.players)
    const text = [
      team.teamName,
      `Captain: ${team.captain || 'Not assigned'}`,
      `Members: ${roster.join(', ') || 'No members assigned'}`,
      `Status: ${getTournamentRosterStatus(roster, team.status)} ${getTournamentRosterProgress(roster)}`,
    ].join('\n')

    try {
      await window.navigator.clipboard.writeText(text)
    } catch {
      window.prompt('Copy team', text)
    }
  }

  function duplicateTeam(team: TeamTournamentTeam) {
    const roster = splitPlayers(team.players)
    const nextCaptain = team.captain || roster[0] || ''
    const members = roster
      .filter((player) => normalizeTournamentPlayer(player) !== normalizeTournamentPlayer(nextCaptain))
      .slice(0, 4)

    setEditingTeamId('')
    setEditingSnapshot('')
    setTeamName(`${team.teamName} (Copy)`)
    setCaptain(nextCaptain)
    setDiscordContact(team.discordContact)
    setMemberSlots(padTournamentMembers(members))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const allTouched = {
      captain: true,
      members: true,
      teamName: true,
    }
    const nextValidationMessages = validateTournamentRoster(teamName, captain, memberSlots, allTouched)

    setTouchedFields(allTouched)

    const duplicate = teams.some(
      (team) =>
        team.teamName.toLowerCase() === teamName.trim().toLowerCase() &&
        team.teamId !== editingTeamId,
    )

    if (duplicate) {
      setFormErrors(['A team with that name already exists. Select it before editing to prevent accidental overwrite.'])
      return
    }

    if (nextValidationMessages.length > 0) {
      setFormErrors(nextValidationMessages)
      return
    }

    if (editingTeam && editingSnapshot && editingSnapshot !== getTournamentTeamSignature(editingTeam)) {
      const proceed = window.confirm(
        `${editingTeam.teamName} changed while you were editing. Save anyway and overwrite the latest team values?`,
      )

      if (!proceed) {
        return
      }
    }

    onSubmit({
      captain,
      discordContact,
      players: [captain, ...memberSlots].filter(Boolean).join(', '),
      status: rosterStatus,
      teamId: editingTeamId,
      teamName,
    })
  }

  return (
    <form className="panel team-tournament-form" data-tournament-section="teams" onSubmit={submit}>
      <p className="eyebrow">Commissioner</p>
      <h2>{editingTeam ? 'Edit Team' : 'Create Team'}</h2>
      <p>
        Editing: <strong>{editingTeam?.teamName ?? 'New team'}</strong>
      </p>
      <p>
        Roster: <strong>{rosterProgress}</strong> · Status:{' '}
        <strong>{rosterStatus}</strong>
      </p>
      <RosterProgress roster={currentRoster} status={rosterStatus} />
      <section className="team-builder-layout" aria-label="Team builder workspace">
        <div className="team-builder-editor">
          <label>
            <span>Team Name</span>
            <input
              aria-invalid={invalidFields.teamName}
              className={invalidFields.teamName ? 'team-builder-invalid-field' : undefined}
              onBlur={() => touchField('teamName')}
              onChange={(event) => {
                setTeamName(event.target.value)
                setFormErrors([])
              }}
              placeholder="Team name"
              required
              value={teamName}
            />
          </label>
          <RosterSelect
            assignedByTeam={assignedByTeam}
            disabled={disabled}
            editingTeamId={editingTeamId}
            invalid={invalidFields.captain}
            label="Captain"
            onChange={(player) => {
              setCaptain(player)
              setFormErrors([])
            }}
            onTouched={() => touchField('captain')}
            options={approvedPlayers}
            selectedInEditor={memberSlots}
            value={captain}
          />
          {memberSlots.map((member, index) => (
            <RosterSelect
              assignedByTeam={assignedByTeam}
              disabled={disabled}
              editingTeamId={editingTeamId}
              invalid={invalidFields.members}
              key={`member-${index}`}
              label={`Member ${index + 1}`}
              onChange={(player) => updateMemberSlot(index, player)}
              onTouched={() => touchField('members')}
              options={approvedPlayers}
              selectedInEditor={[captain, ...memberSlots.filter((_, memberIndex) => memberIndex !== index)]}
              value={member}
            />
          ))}
          <label>
            <span>Discord Contact</span>
            <input
              onChange={(event) => setDiscordContact(event.target.value)}
              placeholder="Optional"
              value={discordContact}
            />
          </label>
          {visibleValidationMessages.length > 0 ? (
            <ul className="team-builder-validation" role="alert">
              {visibleValidationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
          {canAutoFill ? (
            <button disabled={disabled} onClick={autoFillRemainingPlayers} type="button">
              Auto Fill Remaining Players
            </button>
          ) : null}
        </div>
        <aside className="team-builder-availability" aria-label="Roster availability">
          <div>
            <h3>Available Players</h3>
            <label>
              <span>Search</span>
              <input
                onChange={(event) => setAvailableSearch(event.target.value)}
                placeholder="Player, faction, Discord"
                value={availableSearch}
              />
            </label>
            {visibleAvailablePlayers.length === 0 ? (
              <p>No approved unassigned players are available.</p>
            ) : (
              <ul>
                {visibleAvailablePlayers.map((player) => (
                  <li key={player.name}>
                    <strong>{player.label}</strong>
                    <span>{player.faction || 'Faction not provided'}</span>
                    <span>{player.status}</span>
                    {player.discord ? <span>{player.discord}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3>Already Assigned</h3>
            {assignedGroups.length === 0 ? (
              <p>No teams have assigned players yet.</p>
            ) : (
              <ul>
                {assignedGroups.map((team) => (
                  <li key={team.teamId}>
                    <strong>{team.teamName}</strong>
                    {team.players.length === 0 ? (
                      <span>No players assigned</span>
                    ) : (
                      team.players.map((player) => (
                        <span key={`${team.teamId}-${player}`}>
                          {player}
                          {normalizeTournamentPlayer(player) === normalizeTournamentPlayer(team.captain)
                            ? ' · Captain'
                            : ''}
                        </span>
                      ))
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </section>
      <div className="team-list-panel" aria-label="Existing Teams">
        <h3>Existing Teams</h3>
        {teams.length === 0 ? (
          <div className="team-builder-empty">
            <strong>No Teams Created</strong>
            <p>Start by creating your first team.</p>
          </div>
        ) : (
          <div className="team-list-table">
            {sortedTeams.map((team) => {
              const roster = splitPlayers(team.players)
              const teamProgress = getTournamentRosterProgress(roster)
              const teamStatus = getTournamentRosterStatus(roster, team.status)
              const needs = getTournamentDraftNeeds(team.captain, roster)
              return (
                <article className={`team-card ${teamStatus.toLowerCase()}`} key={team.teamId}>
                  <div className="team-card-header">
                    <strong>{team.teamName}</strong>
                    <span className={`team-status-chip ${teamStatus.toLowerCase()}`}>{teamStatus}</span>
                  </div>
                  <dl className="team-card-details">
                    <div>
                      <dt>Captain</dt>
                      <dd>{team.captain || 'Not assigned'}</dd>
                    </div>
                    <div>
                      <dt>Members</dt>
                      <dd>{roster.join(', ') || 'No members assigned'}</dd>
                    </div>
                    <div>
                      <dt>Roster</dt>
                      <dd>
                        <RosterProgress roster={roster} status={teamStatus} />
                      </dd>
                    </div>
                  </dl>
                  <p>Players: {teamProgress}</p>
                  {teamStatus === 'Draft' ? <p>{needs}</p> : null}
                  <div className="team-tournament-actions compact">
                    <button
                      disabled={disabled}
                      onClick={() => loadTeam(team.teamId)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button disabled={disabled} onClick={() => duplicateTeam(team)} type="button">
                      Duplicate Team
                    </button>
                    <button disabled={disabled} onClick={() => void copyTeam(team)} type="button">
                      Copy Team
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() => {
                        if (window.confirm(`Delete ${team.teamName}? This will hide it from active tournament views.`)) {
                          onSubmit({
                            captain: team.captain,
                            discordContact: team.discordContact,
                            players: team.players,
                            status: 'Deleted',
                            teamId: team.teamId,
                            teamName: team.teamName,
                          })
                          if (editingTeamId === team.teamId) {
                            clearEditor()
                          }
                        }
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
      <button disabled={disabled} type="submit">
        {editingTeam ? 'Save Changes' : 'Create Team'}
      </button>
      <button disabled={disabled} onClick={clearEditor} type="button">
        Clear Editor
      </button>
    </form>
  )
}

function RosterProgress({ roster, status }: { roster: string[]; status: string }) {
  const count = roster.filter(Boolean).length
  const percent = Math.min(100, Math.max(0, (count / 5) * 100))
  const normalized = status === 'Ready' ? 'ready' : count === 0 ? 'empty' : 'draft'

  return (
    <span className="roster-progress">
      <span className={`roster-progress-bar ${normalized}`}>
        <span style={{ width: `${percent}%` }} />
      </span>
      <span>{count} / 5</span>
    </span>
  )
}

function RosterSelect({
  assignedByTeam,
  disabled,
  editingTeamId,
  invalid,
  label,
  onChange,
  onTouched,
  options,
  selectedInEditor,
  value,
}: {
  assignedByTeam: Map<string, { teamId: string; teamName: string }>
  disabled: boolean
  editingTeamId: string
  invalid: boolean
  label: string
  onChange: (player: string) => void
  onTouched: () => void
  options: TournamentPlayerOption[]
  selectedInEditor: string[]
  value: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const normalizedValue = normalizeTournamentPlayer(value)
  const selected = new Set(
    selectedInEditor
      .filter(Boolean)
      .map(normalizeTournamentPlayer),
  )
  const availableOptions = options.filter((option) => {
    const normalized = normalizeTournamentPlayer(option.name)
    const assigned = assignedByTeam.get(normalized)
    const assignedElsewhere = assigned && assigned.teamId !== editingTeamId
    const selectedElsewhere = selected.has(normalized)

    return normalized === normalizedValue || (!assignedElsewhere && !selectedElsewhere)
  })
  const hasCurrentValue =
    value === '' ||
    availableOptions.some((option) => normalizeTournamentPlayer(option.name) === normalizedValue)
  const visibleOptions = availableOptions.filter((option) =>
    option.searchText.includes(search.trim().toLowerCase()),
  )

  return (
    <label>
      <span>{label}</span>
      <div className="team-player-combobox">
        <input
          aria-autocomplete="list"
          aria-expanded={open}
          aria-invalid={invalid}
          className={invalid ? 'team-builder-invalid-field' : undefined}
          disabled={disabled}
          onBlur={() => {
            onTouched()
            window.setTimeout(() => setOpen(false), 120)
          }}
          onChange={(event) => {
            setSearch(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search approved players"
          role="combobox"
          value={open ? search : value}
        />
        {open ? (
          <div className="team-player-options" role="listbox">
            {value ? (
              <button
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange('')
                  setSearch('')
                  setOpen(false)
                }}
                type="button"
              >
                Clear selection
              </button>
            ) : null}
            {!hasCurrentValue && value ? (
              <button
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(value)
                  setSearch('')
                  setOpen(false)
                }}
                role="option"
                type="button"
              >
                {value}
              </button>
            ) : null}
            {visibleOptions.length === 0 ? (
              <span>No approved players available.</span>
            ) : (
              visibleOptions.map((option) => (
                <button
                  key={option.name}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(option.name)
                    setSearch('')
                    setOpen(false)
                  }}
                  role="option"
                  type="button"
                >
                  <strong>{option.label}</strong>
                  <span>{option.faction || 'Faction not provided'}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </label>
  )
}

type TournamentPlayerOption = {
  discord: string
  faction: string
  label: string
  name: string
  searchText: string
  status: string
}

function getApprovedTournamentPlayers(registration: EventRegistrationData) {
  const unique = new Map<string, TournamentPlayerOption>()

  registration.registrations
    .filter((entry) => entry.status.toLowerCase() === 'approved')
    .forEach((entry) => {
      const name = entry.displayName || entry.player
      const key = normalizeTournamentPlayer(name)

      if (key && !unique.has(key)) {
        unique.set(key, {
          discord: entry.discord,
          faction: entry.faction,
          label: name,
          name,
          searchText: [
            name,
            entry.displayName,
            entry.player,
            entry.faction,
            entry.discord,
            entry.status,
          ].join(' ').toLowerCase(),
          status: entry.status,
        })
      }
    })

  return Array.from(unique.values()).sort((left, right) =>
    left.label.localeCompare(right.label),
  )
}

function getAssignedTournamentPlayers(teams: TeamTournamentTeam[]) {
  const assigned = new Map<string, { teamId: string; teamName: string }>()

  teams
    .filter((team) => team.status !== 'Deleted')
    .forEach((team) => {
      splitPlayers(team.players).forEach((player) => {
        assigned.set(normalizeTournamentPlayer(player), {
          teamId: team.teamId,
          teamName: team.teamName,
        })
      })
    })

  return assigned
}

function validateTournamentRoster(
  teamName: string,
  captain: string,
  members: string[],
  touched: {
    captain: boolean
    members: boolean
    teamName: boolean
  },
) {
  const messages: string[] = []
  const roster = [captain, ...members].filter(Boolean)
  const unique = new Set(roster.map(normalizeTournamentPlayer))
  const normalizedCaptain = normalizeTournamentPlayer(captain)

  if (touched.teamName && teamName.trim() === '') {
    messages.push('Team name is required.')
  }

  if (touched.captain && captain.trim() === '') {
    messages.push('Captain is required.')
  }

  if (
    (touched.captain || touched.members) &&
    normalizedCaptain &&
    members.some((member) => {
      const normalizedMember = normalizeTournamentPlayer(member)
      return normalizedMember !== '' && normalizedMember === normalizedCaptain
    })
  ) {
    messages.push('Captain cannot also be selected as a member.')
  }

  if ((touched.captain || touched.members) && unique.size !== roster.length) {
    messages.push('Each player can only appear once.')
  }

  if (touched.members && roster.length > 5) {
    messages.push('A team cannot contain more than five players.')
  }

  return messages
}

function getTournamentInvalidFields(
  teamName: string,
  captain: string,
  errors: string[],
) {
  const hasDuplicate =
    errors.includes('Each player can only appear once.') ||
    errors.includes('Captain cannot also be selected as a member.')

  return {
    captain:
      captain.trim() === '' ||
      errors.includes('Captain is required.') ||
      errors.includes('Captain cannot also be selected as a member.'),
    members: hasDuplicate,
    teamName:
      teamName.trim() === '' ||
      errors.includes('Team name is required.') ||
      errors.some((error) => error.startsWith('A team with that name already exists.')),
  }
}

function getTournamentRosterProgress(roster: string[]) {
  return `${roster.filter(Boolean).length}/5`
}

function getTournamentRosterStatus(roster: string[], savedStatus = '') {
  if (savedStatus === 'Deleted') {
    return 'Deleted'
  }

  return roster.filter(Boolean).length === 5 ? 'Ready' : 'Draft'
}

function getTournamentDraftNeeds(captain: string, roster: string[]) {
  if (!captain) {
    return 'Needs Captain'
  }

  const missing = Math.max(0, 5 - roster.filter(Boolean).length)

  if (missing === 0) {
    return 'Roster Complete'
  }

  return `Needs ${missing} ${missing === 1 ? 'Player' : 'Players'}`
}

function getTournamentTeamSignature(team: TeamTournamentTeam) {
  return [
    team.teamName,
    team.captain,
    team.discordContact,
    team.players,
    team.status,
  ].join('|')
}

function getTeamSaveToast(params: Record<string, string>) {
  if (params.status === 'Deleted') {
    return 'Team deleted.'
  }

  if (params.teamId) {
    return params.status === 'Ready' ? 'Ready Team Updated' : 'Draft Team Updated'
  }

  return params.status === 'Ready' ? 'Ready Team Saved' : 'Draft Team Saved'
}

function padTournamentMembers(players: string[]) {
  return [...players, '', '', '', ''].slice(0, 4)
}

function normalizeTournamentPlayer(player: string) {
  return player.trim().toLowerCase()
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
    <form className="panel team-tournament-form" data-tournament-section="pairings" onSubmit={submit}>
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

function RoundControlForm({
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
  }

  return (
    <form className="panel team-tournament-form" data-tournament-section="pairings" onSubmit={submit}>
      <p className="eyebrow">Commissioner</p>
      <h2>Round Lifecycle</h2>
      <select name="lifecycleStage" defaultValue="Round 1">
        <option>Registration Open</option>
        <option>Registration Closed</option>
        <option>Roster Locked</option>
        <option>Round 1</option>
        <option>Round 2</option>
        <option>Round 3</option>
        <option>Final Round</option>
        <option>Awards</option>
        <option>Archived</option>
      </select>
      <select name="status" defaultValue="Round 1">
        <option>Registration Open</option>
        <option>Registration Closed</option>
        <option>Roster Locked</option>
        <option>Pairings Published</option>
        <option>Accepting Results</option>
        <option>Round Complete</option>
        <option>Champion</option>
        <option>Archived</option>
      </select>
      <button disabled={disabled} type="submit">
        Update Round State
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

function normalizeResultStatus(status: string): 'confirmed' | 'outstanding' | 'pending' | 'submitted' {
  const normalized = status.trim().toLowerCase()

  if (normalized === 'confirmed' || normalized === 'approved') {
    return 'confirmed'
  }

  if (normalized === 'pending') {
    return 'pending'
  }

  if (normalized === 'submitted') {
    return 'submitted'
  }

  return 'outstanding'
}

function recordApprovalTiming(
  event:
    | 'approvalButtonClick'
    | 'approvalFailed'
    | 'approvalRefreshComplete'
    | 'approvalRefreshStart'
    | 'approvalRequestComplete'
    | 'approvalRequestStart'
    | 'approvalStateUpdated'
    | 'approvalToastShown',
  eventId: string,
  entry: EventRegistrationData['registrations'][number],
  status: string,
  startedAt: number,
  endedAt: number,
  detail: string,
) {
  const diagnosticsWindow = window as unknown as {
    __loboDiagnostics?: {
      teamTournamentApprovals?: Array<Record<string, unknown>>
    }
  }

  diagnosticsWindow.__loboDiagnostics ??= {}
  diagnosticsWindow.__loboDiagnostics.teamTournamentApprovals ??= []
  diagnosticsWindow.__loboDiagnostics.teamTournamentApprovals.push({
    detail,
    durationMs: Math.round(endedAt - startedAt),
    event,
    eventId,
    player: entry.player,
    status,
    timestamp: new Date().toISOString(),
  })

  if (diagnosticsWindow.__loboDiagnostics.teamTournamentApprovals.length > 100) {
    diagnosticsWindow.__loboDiagnostics.teamTournamentApprovals.splice(
      0,
      diagnosticsWindow.__loboDiagnostics.teamTournamentApprovals.length - 100,
    )
  }
}

function formatResultStatus(status: string) {
  const normalized = normalizeResultStatus(status)
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function updateParticipantStatus(
  data: TeamTournamentData,
  player: string,
  status: string,
): TeamTournamentData {
  const updateEntry = (entry: EventRegistrationData['registrations'][number]) =>
    entry.player === player ? { ...entry, status } : entry

  return {
    ...data,
    registration: {
      ...data.registration,
      captains: data.registration.captains.map(updateEntry),
      currentPlayer:
        data.registration.currentPlayer?.player === player
          ? { ...data.registration.currentPlayer, status }
          : data.registration.currentPlayer,
      freeAgents: data.registration.freeAgents.map(updateEntry),
      registrations: data.registration.registrations.map(updateEntry),
      teams: data.registration.teams.map((team) => ({
        ...team,
        players: team.players.map(updateEntry),
      })),
    },
  }
}

function applyTeamTournamentMutationState(
  current: TournamentState,
  result: TeamTournamentMutationResult,
): TournamentState {
  if (isFullTeamTournamentData(result)) {
    return {
      data: result,
      status: 'success',
    }
  }

  if (result.kind === 'full') {
    return {
      data: result.data,
      status: 'success',
    }
  }

  if (current.status !== 'success') {
    return current
  }

  return {
    data: applyTeamTournamentMutation(current.data, result),
    status: 'success',
  }
}

function applyTeamTournamentMutation(
  data: TeamTournamentData,
  result: TeamTournamentMutationResult,
): TeamTournamentData {
  if (isFullTeamTournamentData(result)) {
    return result
  }

  if (result.kind === 'full') {
    return result.data
  }

  if (result.kind === 'team') {
    const teams = upsertBy(data.teams, result.team, (team) => team.teamId)
    const activeTeams = teams.filter((team) => team.status !== 'Deleted')

    return {
      ...data,
      registeredTeams: activeTeams.length,
      standings: data.standings.map((standing) =>
        standing.teamId === result.team.teamId
          ? {
              ...standing,
              captain: result.team.captain,
              players: splitPlayers(result.team.players),
              teamName: result.team.teamName,
            }
          : standing,
      ),
      teams,
    }
  }

  if (result.kind === 'pairing') {
    const pairings = upsertBy(
      data.pairings,
      result.pairing,
      (pairing) =>
        `${pairing.roundId}:${pairing.teamA.toLowerCase()}:${pairing.teamB.toLowerCase()}`,
    )

    return {
      ...data,
      pairings,
      upcomingPairings: pairings.filter((pairing) => pairing.status !== 'Completed'),
    }
  }

  if (result.kind === 'invitation') {
    return {
      ...data,
      invitations: upsertBy(
        data.invitations,
        result.invitation,
        (invitation) => invitation.invitationId,
      ),
    }
  }

  if (result.kind === 'result') {
    const tournamentResults = upsertBy(
      data.tournamentResults,
      result.result,
      (tournamentResult) => tournamentResult.resultId,
    )
    const resultStatuses = data.resultStatuses.map((status) => {
      const sameTable =
        status.roundId === result.result.roundId &&
        status.table === result.result.table
      const samePlayers =
        normalizeTournamentPlayer(status.player) ===
          normalizeTournamentPlayer(result.result.player) &&
        normalizeTournamentPlayer(status.opponent) ===
          normalizeTournamentPlayer(result.result.opponent)

      return sameTable || samePlayers
        ? {
            ...status,
            resultId: result.result.resultId,
            status: result.result.status,
          }
        : status
    })

    return {
      ...data,
      completedMatches: tournamentResults.filter(
        (tournamentResult) => tournamentResult.status !== 'Rejected',
      ).length,
      resultStatuses,
      tournamentResults,
    }
  }

  if (result.kind === 'round') {
    return {
      ...data,
      currentRound: data.currentRound
        ? {
            ...data.currentRound,
            lifecycleStage: result.lifecycleStage,
            status: result.status,
          }
        : data.currentRound,
      status: result.status || data.status,
    }
  }

  return data
}

function upsertBy<T>(items: T[], item: T, getKey: (item: T) => string): T[] {
  const key = getKey(item)
  let found = false
  const next = items.map((candidate) => {
    if (getKey(candidate) !== key) {
      return candidate
    }

    found = true
    return item
  })

  return found ? next : [...next, item]
}

function isFullTeamTournamentData(
  result: TeamTournamentMutationResult,
): result is TeamTournamentData {
  return 'teams' in result && 'registration' in result && 'standings' in result
}

export default TeamTournament
