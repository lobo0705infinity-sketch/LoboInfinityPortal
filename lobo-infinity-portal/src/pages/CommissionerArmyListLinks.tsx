import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import {
  getArmyParentFaction,
  getCanonicalArmyName,
  normalizeArmyForDisplay,
} from '../services/armyIdentity'
import { apiClient, type ArmyList, type ArmyListLinkGame } from '../services/api'

type LinkState =
  | { status: 'loading' }
  | { status: 'success'; games: ArmyListLinkGame[]; armyLists: ArmyList[] }
  | { status: 'error'; message: string }

function CommissionerArmyListLinks() {
  const auth = useAuth()
  const [state, setState] = useState<LinkState>({ status: 'loading' })
  const [search, setSearch] = useState('')
  const [selectedGameId, setSelectedGameId] = useState('')
  const [winnerArmyListId, setWinnerArmyListId] = useState('')
  const [loserArmyListId, setLoserArmyListId] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (auth.status === 'loading') return
    if (!auth.authenticated || !auth.isAtLeastRole('Assistant Commissioner')) return

    const controller = new AbortController()

    setState({ status: 'loading' })
    apiClient
      .getArmyListLinkCandidates({ signal: controller.signal })
      .then((data) => {
        setState({
          status: 'success',
          games: data.games,
          armyLists: data.armyLists,
        })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setState({
          message:
            error instanceof Error
              ? error.message
              : 'Army list link data could not be loaded.',
          status: 'error',
        })
      })

    return () => controller.abort()
  }, [auth])

  const games = state.status === 'success' ? state.games : []
  const armyLists = state.status === 'success' ? state.armyLists : []
  const selectedGame = useMemo(
    () => games.find((game) => String(game.id) === selectedGameId) || null,
    [games, selectedGameId],
  )
  const visibleGames = useMemo(
    () => filterGames(games, search),
    [games, search],
  )
  const winnerOptions = useMemo(
    () =>
      selectedGame
        ? buildArmyListOptions(
            armyLists,
            selectedGame.winner,
            selectedGame.winnerFaction,
            selectedGame.winnerVerifiedArmyListId,
          )
        : buildArmyListOptions([], '', '', ''),
    [armyLists, selectedGame],
  )
  const loserOptions = useMemo(
    () =>
      selectedGame
        ? buildArmyListOptions(
            armyLists,
            selectedGame.loser,
            selectedGame.loserFaction,
            selectedGame.loserVerifiedArmyListId,
          )
        : buildArmyListOptions([], '', '', ''),
    [armyLists, selectedGame],
  )

  function chooseGame(gameId: string) {
    const game = games.find((candidate) => String(candidate.id) === gameId) || null
    setSelectedGameId(gameId)
    setWinnerArmyListId(
      game?.winnerArmyListId || game?.winnerVerifiedArmyListId || '',
    )
    setLoserArmyListId(
      game?.loserArmyListId || game?.loserVerifiedArmyListId || '',
    )
    setMessage('')
  }

  async function saveLinks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedGame) {
      setMessage('Choose a game before saving.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      await apiClient.linkHistoricalArmyLists({
        gameId: selectedGame.id,
        loserArmyListId,
        reason,
        winnerArmyListId,
      })
      setMessage('Army list links saved and audited.')
      setState((current) => {
        if (current.status !== 'success') return current

        return {
          ...current,
          games: current.games.map((game) => (
            game.id === selectedGame.id
              ? { ...game, loserArmyListId, winnerArmyListId }
              : game
          )),
        }
      })
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Army list links could not be saved.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (auth.status === 'loading') {
    return <LinkPageLoading />
  }

  if (!auth.authenticated || !auth.isAtLeastRole('Assistant Commissioner')) {
    return (
      <main className="portal-shell">
        <section className="panel operations-access-card">
          <p className="eyebrow">Commissioner Access</p>
          <h1>Link Historical Army Lists</h1>
          <p>
            Sign in with an enabled Assistant Commissioner or Commissioner
            account to link exact army lists to historical games.
          </p>
        </section>
      </main>
    )
  }

  if (state.status === 'loading') {
    return <LinkPageLoading />
  }

  return (
    <main className="portal-shell">
      <section className="page-header" aria-labelledby="army-list-links-title">
        <div>
          <p className="eyebrow">Commissioner</p>
          <h1 id="army-list-links-title">Link Historical Army Lists</h1>
          <p>
            Attach approved Army List IDs to canonical game records for future
            Competitive Intelligence measurement.
          </p>
        </div>
        <Link className="submit-match-button" to="/commissioner">
          Commissioner Dashboard
        </Link>
      </section>

      {state.status === 'error' ? (
        <section className="panel dashboard-state">
          <h2>Link data is unavailable.</h2>
          <p>{state.message}</p>
        </section>
      ) : (
        <form className="army-list-form panel" onSubmit={(event) => void saveLinks(event)}>
          <label className="army-list-form-wide">
            <span>Search Game</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Game ID, player, faction, mission, or event"
              type="search"
              value={search}
            />
          </label>

          <label className="army-list-form-wide">
            <span>Game</span>
            <select
              onChange={(event) => chooseGame(event.target.value)}
              required
              value={selectedGameId}
            >
              <option value="">Choose a game</option>
              {visibleGames.map((game) => (
                <option key={game.id} value={game.id}>
                  {formatGameOption(game)}
                </option>
              ))}
            </select>
          </label>

          {selectedGame ? (
            <>
              <ReadOnlyGameSummary game={selectedGame} />
              <label>
                <span>Winner Army List</span>
                <select
                  onChange={(event) => setWinnerArmyListId(event.target.value)}
                  value={winnerArmyListId}
                >
                  {winnerOptions.map((option) => (
                    <option key={option.value || 'none'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Loser Army List</span>
                <select
                  onChange={(event) => setLoserArmyListId(event.target.value)}
                  value={loserArmyListId}
                >
                  {loserOptions.map((option) => (
                    <option key={option.value || 'none'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="army-list-form-wide">
                <span>Audit Reason</span>
                <textarea
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  value={reason}
                />
              </label>
            </>
          ) : null}

          <div className="army-list-form-actions">
            <button disabled={!selectedGame || saving} type="submit">
              {saving ? 'Saving...' : 'Save Army List Links'}
            </button>
            {message ? <p role="status">{message}</p> : null}
          </div>
        </form>
      )}
    </main>
  )
}

function LinkPageLoading() {
  return (
    <main className="portal-shell">
      <section className="dashboard-state" aria-label="Army list links loading">
        <Loading />
      </section>
    </main>
  )
}

function ReadOnlyGameSummary({ game }: { game: ArmyListLinkGame }) {
  return (
    <div className="army-list-form-wide dashboard-state">
      <h2>Game #{game.id}</h2>
      <p>
        {game.winnerDisplayName} ({normalizeArmyForDisplay(game.winnerFaction)}) vs{' '}
        {game.loserDisplayName} ({normalizeArmyForDisplay(game.loserFaction)})
      </p>
      <p>
        {game.mission} | {game.date} | {game.gameType || 'league'}
      </p>
    </div>
  )
}

function filterGames(games: RecentGame[], search: string) {
  const query = normalizeKey(search)
  if (!query) return games

  return games.filter((game) =>
    normalizeKey([
      game.id,
      game.eventId,
      game.date,
      game.mission,
      game.winner,
      game.winnerDisplayName,
      game.winnerFaction,
      game.loser,
      game.loserDisplayName,
      game.loserFaction,
    ].join(' ')).includes(query),
  )
}

function buildArmyListOptions(
  armyLists: ArmyList[],
  player: string,
  faction: string,
  verifiedArmyListId: string,
) {
  return [
    { label: 'Army List not submitted', value: '' },
    ...armyLists
      .filter((list) => (
        list.approved &&
        (
          String(list.id) === verifiedArmyListId ||
          (
            sameValue(list.player, player) &&
            armyListMatchesSelectedFaction(list, faction)
          )
        )
      ))
      .sort((left, right) => {
        const nameComparison = left.armyName.localeCompare(right.armyName)
        if (nameComparison !== 0) return nameComparison
        return Number(left.id) - Number(right.id)
      })
      .map((list) => ({
        label: String(list.id) === verifiedArmyListId
          ? `Verified from stored game Army Code - #${list.id}`
          : `${list.armyName || `Army List #${list.id}`} - ${list.sectorial || list.faction} - #${list.id}`,
        value: String(list.id),
      })),
  ]
}

function armyListMatchesSelectedFaction(list: ArmyList, faction: string) {
  const selectedFaction = getCanonicalArmyName(faction)
  if (!selectedFaction) return false

  const listSectorial = getCanonicalArmyName(list.sectorial)
  const listFaction = getCanonicalArmyName(list.faction)

  if (sameValue(listSectorial, selectedFaction) || sameValue(listFaction, selectedFaction)) {
    return true
  }

  const selectedParent = getArmyParentFaction(selectedFaction)
  const listParent = getArmyParentFaction(listSectorial || listFaction)

  return Boolean(selectedParent && listParent && sameValue(selectedParent, listParent))
}

function formatGameOption(game: RecentGame) {
  return [
    `#${game.id}`,
    game.date,
    game.mission,
    `${game.winnerDisplayName} vs ${game.loserDisplayName}`,
  ].filter(Boolean).join(' | ')
}

function sameValue(left: string, right: string) {
  return normalizeKey(left) === normalizeKey(right)
}

function normalizeKey(value: string | number) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default CommissionerArmyListLinks
