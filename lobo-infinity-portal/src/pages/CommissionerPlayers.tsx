import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import { apiClient } from '../services/api'

type CommissionerPlayer = {
  canonical: boolean
  displayName: string
  player: string
}

const playerWorkflows = [
  {
    body: 'Browse public competitive records, divisions, rankings, and profile pages.',
    label: 'Player Profiles',
    to: '/players',
  },
  {
    body: 'Manage commissioner roles, portal accounts, identity records, and access state.',
    label: 'Commissioner Permissions',
    to: '/commissioner?section=users',
  },
  {
    body: 'Review canonical player identity, league assignment, and Players sheet matching.',
    label: 'League Assignment',
    to: '/commissioner?section=users',
  },
  {
    body: 'Resolve display names, Google email links, missing emails, and duplicate accounts.',
    label: 'Display Name Management',
    to: '/commissioner?section=users',
  },
  {
    body: 'Review submitted lists and list approval workflows.',
    label: 'Army Lists',
    to: '/army-lists',
  },
  {
    body: 'Review availability, scheduling requests, and match finder player state.',
    label: 'Availability',
    to: '/match-finder',
  },
  {
    body: 'Review player awards, unlock rules, and achievement state.',
    label: 'Achievements',
    to: '/hall-of-fame',
  },
  {
    body: 'Find players by name, profile, faction, division, or competitive identity.',
    label: 'Player Search',
    to: '/players',
  },
]

function CommissionerPlayers() {
  const auth = useAuth()
  const [players, setPlayers] = useState<CommissionerPlayer[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [editingDisplayName, setEditingDisplayName] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [savingDisplayName, setSavingDisplayName] = useState(false)
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [deletingPlayer, setDeletingPlayer] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; status: 'error' | 'success' } | null>(null)
  const canDeletePlayers = auth.authenticated && auth.hasPermission('runSeasonControl')

  const sortedPlayers = useMemo(
    () => players.slice().sort((left, right) => left.player.localeCompare(right.player)),
    [players],
  )
  const selectedPlayerRecord = players.find((player) => player.player === selectedPlayer)

  useEffect(() => {
    if (!canDeletePlayers) {
      return
    }

    let active = true
    setLoadingPlayers(true)
    apiClient.getPlayers()
      .then((divisions) => {
        if (!active) return
        const records = new Map<string, CommissionerPlayer>()
        divisions.forEach((division) => {
          division.standings.forEach((player) => {
            if (player.player) {
              records.set(player.player, {
                canonical: player.canonical === true,
                displayName: player.displayName || player.player,
                player: player.player,
              })
            }
          })
        })
        setPlayers(Array.from(records.values()))
      })
      .catch((error: unknown) => {
        if (!active) return
        setFeedback({
          message: error instanceof Error ? error.message : 'Players could not be loaded.',
          status: 'error',
        })
      })
      .finally(() => {
        if (active) setLoadingPlayers(false)
      })

    return () => { active = false }
  }, [canDeletePlayers])

  async function deleteSelectedPlayer() {
    if (!selectedPlayerRecord?.canonical || deletingPlayer) return

    if (!window.confirm(
      `Delete ${selectedPlayer}? Deletion is only permitted when the Player has no historical dependencies.`,
    )) return

    setDeletingPlayer(true)
    setFeedback(null)

    try {
      const result = await apiClient.deleteCanonicalPlayer(selectedPlayer)
      setPlayers((current) => current.filter((player) => player.player !== result.player))
      setSelectedPlayer('')
      setEditingDisplayName(false)
      setFeedback({ message: `${result.player} was deleted.`, status: 'success' })
    } catch (error: unknown) {
      setFeedback({
        message: error instanceof Error ? error.message : 'Player could not be deleted.',
        status: 'error',
      })
    } finally {
      setDeletingPlayer(false)
    }
  }

  function editDisplayName() {
    if (!selectedPlayerRecord?.canonical) return
    setDisplayName(selectedPlayerRecord.displayName)
    setEditingDisplayName(true)
    setFeedback(null)
  }

  function cancelDisplayNameEdit() {
    setEditingDisplayName(false)
    setDisplayName('')
  }

  async function saveDisplayName() {
    if (!selectedPlayerRecord || savingDisplayName || !displayName.trim()) return

    setSavingDisplayName(true)
    setFeedback(null)

    try {
      const result = await apiClient.setCanonicalPlayerDisplayName(
        selectedPlayerRecord.player,
        displayName.trim(),
      )
      setPlayers((current) => current.map((player) => (
        player.player === result.player
          ? { ...player, displayName: result.displayName }
          : player
      )))
      setEditingDisplayName(false)
      setDisplayName('')
      setFeedback({
        message: `${result.player} now displays as ${result.displayName}.`,
        status: 'success',
      })
    } catch (error: unknown) {
      setFeedback({
        message: error instanceof Error ? error.message : 'Display Name could not be updated.',
        status: 'error',
      })
    } finally {
      setSavingDisplayName(false)
    }
  }

  if (auth.status === 'loading') {
    return (
      <main className="portal-shell">
        <section className="dashboard-state" aria-label="Players loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (!auth.authenticated || !auth.isAtLeastRole('Assistant Commissioner')) {
    return (
      <main className="portal-shell">
        <section className="panel operations-access-card">
          <p className="eyebrow">Commissioner Access</p>
          <h1>Players</h1>
          <p>
            Sign in with an enabled Assistant Commissioner or Commissioner
            account to manage player-facing league operations.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="commissioner-players-title">
        <p className="eyebrow">Commissioner</p>
        <h1 id="commissioner-players-title">Players</h1>
        <p>
          Player profiles, permissions, identity resolution, availability,
          army lists, and achievement operations.
        </p>
      </section>

      <section className="operations-grid" aria-label="Player workflows">
        {playerWorkflows.map((workflow) => (
          <Link className="panel operations-panel" key={workflow.label} to={workflow.to}>
            <p className="eyebrow">Players</p>
            <h2>{workflow.label}</h2>
            <p className="operations-empty">{workflow.body}</p>
          </Link>
        ))}
      </section>

      <section className="panel operations-panel">
        <div className="panel-heading">
          <p className="eyebrow">Identity Tools</p>
          <h2>Player Administration</h2>
          <p>
            Detailed identity records, account repair actions, role management,
            and audit history remain in Command Center under the player identity
            panel.
          </p>
        </div>
        <div className="operations-actions wrap">
          <Link to="/commissioner?section=users">Open Player Identity Tools</Link>
          <Link to="/players">Open Player Directory</Link>
          <Link to="/army-lists">Open Army Lists</Link>
          <Link to="/match-finder">Open Availability</Link>
        </div>
      </section>

      {canDeletePlayers ? (
        <section className="panel operations-panel" aria-labelledby="delete-player-title">
          <div className="panel-heading">
            <p className="eyebrow">Canonical Players</p>
            <h2 id="delete-player-title">Delete Player</h2>
            <p>
              Remove an accidental or test Player only when no historical dependencies exist.
            </p>
          </div>
          <div className="operations-form">
            <label>
              <span>Player</span>
              <select
                disabled={loadingPlayers || deletingPlayer || savingDisplayName}
                onChange={(event) => {
                  setSelectedPlayer(event.target.value)
                  setEditingDisplayName(false)
                  setDisplayName('')
                }}
                value={selectedPlayer}
              >
                <option value="">Select Player</option>
                {sortedPlayers.map((player) => (
                  <option key={player.player} value={player.player}>
                    {(player.displayName === player.player
                      ? player.player
                      : `${player.displayName} (${player.player})`) +
                      (player.canonical ? '' : ' — Historical')}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={!selectedPlayerRecord?.canonical || loadingPlayers || deletingPlayer || savingDisplayName}
              onClick={editDisplayName}
              type="button"
            >
              Edit Display Name
            </button>
            <button
              disabled={!selectedPlayerRecord?.canonical || loadingPlayers || deletingPlayer || savingDisplayName}
              onClick={() => void deleteSelectedPlayer()}
              type="button"
            >
              {deletingPlayer ? 'Deleting Player...' : 'Delete Player'}
            </button>
          </div>
          {editingDisplayName ? (
            <div className="operations-form">
              <label>
                <span>Display Name</span>
                <input
                  autoFocus
                  disabled={savingDisplayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  value={displayName}
                />
              </label>
              <button
                disabled={!displayName.trim() || savingDisplayName}
                onClick={() => void saveDisplayName()}
                type="button"
              >
                {savingDisplayName ? 'Saving...' : 'Save'}
              </button>
              <button
                disabled={savingDisplayName}
                onClick={cancelDisplayNameEdit}
                type="button"
              >
                Cancel
              </button>
            </div>
          ) : null}
          {feedback ? (
            <p className={`operations-feedback ${feedback.status}`} role="status">
              {feedback.message}
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  )
}

export default CommissionerPlayers
