import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import {
  apiClient,
  getCommissionerStreams,
  type RecentGame,
  type StreamedGame,
} from '../services/api'

type StreamsState =
  | { status: 'loading' }
  | { streams: StreamedGame[]; status: 'success' }
  | { error: string; status: 'error' }

type EditorMode = 'create' | 'edit' | null

const defaultStream: StreamedGame = {
  id: 0,
  active: true,
  gameId: 0,
  streamType: 'Standalone Stream',
  date: '',
  description: '',
  division: '',
  featured: false,
  mission: '',
  platform: '',
  player1: '',
  player1Faction: '',
  player2: '',
  player2Faction: '',
  streamer: '',
  thumbnailUrl: '',
  title: '',
  youtubeUrl: '',
}

function CommunityManager() {
  const auth = useAuth()
  const [streamsState, setStreamsState] = useState<StreamsState>({
    status: 'loading',
  })
  const [editorMode, setEditorMode] = useState<EditorMode>(null)
  const [draft, setDraft] = useState(defaultStream)
  const [gameQuery, setGameQuery] = useState('')
  const [gamesState, setGamesState] = useState<{
    games: RecentGame[]
    status: 'idle' | 'loading' | 'success' | 'error'
  }>({ games: [], status: 'idle' })
  const [workingAction, setWorkingAction] = useState('')
  const [message, setMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const canManageStreams = auth.hasPermission('manageStreams')

  const loadStreams = useCallback(async (signal?: AbortSignal) => {
    try {
      const streams = await getCommissionerStreams({ signal })
      setStreamsState({ status: 'success', streams })
    } catch (error) {
      if (!signal?.aborted) {
        setStreamsState({
          error:
            error instanceof Error
              ? error.message
              : 'Streams could not be loaded.',
          status: 'error',
        })
      }
    }
  }, [])

  useEffect(() => {
    if (auth.status !== 'ready' || !auth.authenticated || !canManageStreams) {
      return
    }

    const controller = new AbortController()
    void loadStreams(controller.signal)
    return () => controller.abort()
  }, [auth.authenticated, auth.status, canManageStreams, loadStreams])

  useEffect(() => {
    if (
      !editorMode ||
      draft.streamType !== 'Battle Report' ||
      gamesState.status !== 'idle'
    ) {
      return
    }

    const controller = new AbortController()
    setGamesState((current) => ({ ...current, status: 'loading' }))
    void apiClient
      .getRecentGames({ signal: controller.signal })
      .then((games) => setGamesState({ games, status: 'success' }))
      .catch(() => {
        if (!controller.signal.aborted) {
          setGamesState((current) => ({ ...current, status: 'error' }))
        }
      })

    return () => controller.abort()
  }, [draft.streamType, editorMode, gamesState.status])

  async function saveStream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorkingAction('saveStream')
    setMessage('')

    try {
      await apiClient.operationsAction('saveStream', draft)
      await loadStreams()
      setDraft(defaultStream)
      setEditorMode(null)
      setGameQuery('')
      setMessage('Stream saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Stream could not be saved.')
    } finally {
      setWorkingAction('')
    }
  }

  async function deleteStream() {
    if (!draft.id) {
      return
    }

    await deleteStreamRecord(draft)
  }

  async function deleteStreamRecord(stream: StreamedGame) {
    if (!window.confirm(`Delete “${getStreamTitle(stream)}”? This cannot be undone.`)) return

    setWorkingAction(`delete-${stream.id}`)
    setMessage('')

    try {
      await apiClient.operationsAction('deleteStream', { id: stream.id })
      await loadStreams()
      if (draft.id === stream.id) {
        setDraft(defaultStream)
        setEditorMode(null)
        setGameQuery('')
      }
      setMessage('Stream deleted.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Stream could not be deleted.')
    } finally {
      setWorkingAction('')
    }
  }

  async function setStreamVisibility(stream: StreamedGame) {
    setWorkingAction(`visibility-${stream.id}`)
    setMessage('')

    try {
      await apiClient.operationsAction('saveStream', { ...stream, active: !stream.active })
      await loadStreams()
      setMessage(`Stream ${stream.active ? 'hidden' : 'shown'}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Stream visibility could not be changed.')
    } finally {
      setWorkingAction('')
    }
  }

  function openCreate() {
    setDraft(defaultStream)
    setGameQuery('')
    setEditorMode('create')
  }

  function openEdit(stream: StreamedGame) {
    setDraft(stream)
    setGameQuery('')
    setEditorMode('edit')
  }

  if (auth.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Streams Manager loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (!auth.authenticated || !canManageStreams) {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="panel operations-access-card">
          <p className="eyebrow">Commissioner Access</p>
          <h2>Streams Manager is commissioner-only.</h2>
          <p>Sign in with a Commissioner account that can manage Streams.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader />
      {message ? (
        <section className="panel operations-panel" aria-live="polite">
          <p className="operations-empty">{message}</p>
        </section>
      ) : null}
      <section className="panel operations-panel" aria-labelledby="streams-list-title">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Canonical Streams</p>
            <h2 id="streams-list-title">Existing Streams</h2>
          </div>
          <button className="streams-manager-primary" onClick={openCreate} type="button">Add Stream</button>
        </div>
        {streamsState.status === 'loading' ? (
          <p className="operations-empty" aria-live="polite">Loading Streams…</p>
        ) : null}
        {streamsState.status === 'error' ? (
          <p className="operations-empty" role="alert">{streamsState.error}</p>
        ) : null}
        {streamsState.status === 'success' ? (
          <StreamList
            items={streamsState.streams}
            onDelete={deleteStreamRecord}
            onEdit={openEdit}
            onVisibilityChange={setStreamVisibility}
            platformFilter={platformFilter}
            searchQuery={searchQuery}
            setPlatformFilter={setPlatformFilter}
            setSearchQuery={setSearchQuery}
            setVisibilityFilter={setVisibilityFilter}
            visibilityFilter={visibilityFilter}
            workingAction={workingAction}
          />
        ) : null}
      </section>
      {editorMode ? (
        <StreamEditor
          draft={draft}
          games={gamesState.games}
          gamesStatus={gamesState.status}
          gameQuery={gameQuery}
          mode={editorMode}
          onCancel={() => setEditorMode(null)}
          onChange={setDraft}
          onDelete={editorMode === 'edit' ? deleteStream : undefined}
          onGameQueryChange={setGameQuery}
          onSubmit={saveStream}
          workingAction={workingAction}
        />
      ) : null}
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="community-manager-title">
      <p className="eyebrow">Commissioner / Community</p>
      <h1 id="community-manager-title">Streams Manager</h1>
      <p>Manage canonical Stream records.</p>
    </section>
  )
}

function StreamList({
  items,
  onDelete,
  onEdit,
  onVisibilityChange,
  platformFilter,
  searchQuery,
  setPlatformFilter,
  setSearchQuery,
  setVisibilityFilter,
  visibilityFilter,
  workingAction,
}: {
  items: StreamedGame[]
  onDelete: (stream: StreamedGame) => void
  onEdit: (stream: StreamedGame) => void
  onVisibilityChange: (stream: StreamedGame) => void
  platformFilter: string
  searchQuery: string
  setPlatformFilter: (value: string) => void
  setSearchQuery: (value: string) => void
  setVisibilityFilter: (value: string) => void
  visibilityFilter: string
  workingAction: string
}) {
  if (items.length === 0) {
    return <p className="operations-empty">No Streams configured.</p>
  }

  const platforms = Array.from(new Set(items.map((stream) => stream.platform).filter(Boolean)))
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredItems = items.filter((stream) => {
    const title = getStreamTitle(stream).toLowerCase()
    return (!normalizedQuery || title.includes(normalizedQuery))
      && (platformFilter === 'all' || stream.platform === platformFilter)
      && (visibilityFilter === 'all' || (stream.active ? 'visible' : 'hidden') === visibilityFilter)
  })

  return <>
    <div className="streams-manager-toolbar" aria-label="Stream filters">
      <label>
        <span>Search streams</span>
        <input onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by title" type="search" value={searchQuery} />
      </label>
      <label>
        <span>Platform</span>
        <select onChange={(event) => setPlatformFilter(event.target.value)} value={platformFilter}>
          <option value="all">All platforms</option>
          {platforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
        </select>
      </label>
      <label>
        <span>Visibility</span>
        <select onChange={(event) => setVisibilityFilter(event.target.value)} value={visibilityFilter}>
          <option value="all">All visibility</option>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
      </label>
      <strong>{filteredItems.length} of {items.length}</strong>
    </div>
    {filteredItems.length ? (
      <div className="streams-manager-table-wrap">
        <table className="streams-manager-table">
          <thead><tr><th>Stream</th><th>Platform</th><th>Visibility</th><th>Category</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>{filteredItems.map((stream) => {
            const safeUrl = getSafeStreamUrl(stream.youtubeUrl)
            return <tr key={stream.id}>
              <td data-label="Stream"><strong>{getStreamTitle(stream)}</strong>{safeUrl ? <a href={safeUrl} target="_blank" rel="noopener noreferrer">Open video</a> : <small>No valid video URL</small>}</td>
              <td data-label="Platform"><span className="streams-manager-badge platform">{stream.platform || 'Unspecified'}</span></td>
              <td data-label="Visibility"><span className={`streams-manager-badge ${stream.active ? 'visible' : 'hidden'}`}>{stream.active ? 'Visible' : 'Hidden'}</span></td>
              <td data-label="Category"><strong>{stream.streamType || 'Standalone Stream'}</strong><small>{getStatusLine([stream.division, stream.mission])}</small></td>
              <td data-label="Date">{formatManagerDate(stream.date)}</td>
              <td data-label="Actions"><div className="streams-manager-actions">
                <button onClick={() => onEdit(stream)} type="button">Edit</button>
                <button disabled={workingAction !== ''} onClick={() => onVisibilityChange(stream)} type="button">{stream.active ? 'Hide' : 'Show'}</button>
                <button className="danger" disabled={workingAction !== ''} onClick={() => onDelete(stream)} type="button">Delete</button>
              </div></td>
            </tr>
          })}</tbody>
        </table>
      </div>
    ) : <p className="operations-empty">No streams match the active search and filters.</p>}
  </>
}

function getStreamTitle(stream: StreamedGame) {
  return stream.title || stream.streamer || `${stream.player1 || 'Player 1'} vs ${stream.player2 || 'Player 2'}`
}

function getSafeStreamUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

function formatManagerDate(value: string) {
  if (!value) return 'Not set'
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
}

function StreamEditor({
  draft,
  games,
  gamesStatus,
  gameQuery,
  mode,
  onCancel,
  onChange,
  onDelete,
  onGameQueryChange,
  onSubmit,
  workingAction,
}: {
  draft: StreamedGame
  games: RecentGame[]
  gamesStatus: 'idle' | 'loading' | 'success' | 'error'
  gameQuery: string
  mode: Exclude<EditorMode, null>
  onCancel: () => void
  onChange: (stream: StreamedGame) => void
  onDelete?: () => void
  onGameQueryChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  workingAction: string
}) {
  const gameOptions = useMemo(() => filterGameOptions(games, gameQuery), [games, gameQuery])

  return (
    <section className="panel operations-panel" aria-labelledby="stream-editor-title">
      <div className="panel-title">
        <div>
          <p className="eyebrow">{mode === 'edit' ? 'Selected Stream' : 'New Stream'}</p>
          <h2 id="stream-editor-title">{mode === 'edit' ? 'Edit Stream' : 'Add Stream'}</h2>
        </div>
        <button onClick={onCancel} type="button">Cancel</button>
      </div>
      <form className="operations-form" onSubmit={onSubmit}>
        <SelectInput
          label="Stream Type"
          onChange={(value) => onChange({
            ...draft,
            gameId: value === 'Battle Report' ? draft.gameId : 0,
            streamType: value,
          })}
          options={['Battle Report', 'Standalone Stream']}
          value={draft.streamType || 'Standalone Stream'}
        />
        {draft.streamType === 'Battle Report' ? (
          <>
            <Input label="Search Battle Reports" onChange={onGameQueryChange} value={gameQuery} />
            {gamesStatus === 'loading' ? <p className="operations-empty">Loading Battle Reports…</p> : null}
            {gamesStatus === 'error' ? <p className="operations-empty" role="alert">Battle Reports could not be loaded.</p> : null}
            <SelectInput
              label="Battle Report"
              onChange={(value) => {
                const game = games.find((candidate) => String(candidate.id) === value)
                onChange(game ? applyGameToStreamDraft(draft, game) : { ...draft, gameId: 0 })
              }}
              options={gameOptions.map((game) => ({ label: getGameOptionLabel(game), value: String(game.id) }))}
              value={draft.gameId ? String(draft.gameId) : ''}
            />
          </>
        ) : null}
        <Input label="Stream Title" onChange={(value) => onChange({ ...draft, title: value })} value={draft.title} />
        <Input label="Streamer" onChange={(value) => onChange({ ...draft, streamer: value })} value={draft.streamer} />
        <SelectInput label="Platform" onChange={(value) => onChange({ ...draft, platform: value })} options={['YouTube', 'Twitch', 'Kick', 'Other']} value={draft.platform} />
        <Input label="URL" onChange={(value) => onChange({ ...draft, youtubeUrl: value })} value={draft.youtubeUrl} />
        <Input label="Thumbnail" onChange={(value) => onChange({ ...draft, thumbnailUrl: value })} value={draft.thumbnailUrl} />
        <Input label="Date" onChange={(value) => onChange({ ...draft, date: value })} type="date" value={draft.date} />
        {draft.streamType !== 'Battle Report' ? (
          <>
            <Input label="Player 1" onChange={(value) => onChange({ ...draft, player1: value })} value={draft.player1} />
            <Input label="Player 1 Army" onChange={(value) => onChange({ ...draft, player1Faction: value })} value={draft.player1Faction} />
            <Input label="Player 2" onChange={(value) => onChange({ ...draft, player2: value })} value={draft.player2} />
            <Input label="Player 2 Army" onChange={(value) => onChange({ ...draft, player2Faction: value })} value={draft.player2Faction} />
            <Input label="Mission" onChange={(value) => onChange({ ...draft, mission: value })} value={draft.mission} />
            <Input label="Division" onChange={(value) => onChange({ ...draft, division: value })} value={draft.division} />
          </>
        ) : (
          <div className="operations-form-wide operations-empty">
            {draft.gameId
              ? `${draft.player1} (${draft.player1Faction}) vs ${draft.player2} (${draft.player2Faction}) / ${draft.mission} / ${draft.division}`
              : 'Select a Battle Report to populate matchup fields.'}
          </div>
        )}
        <Textarea label="Description" onChange={(value) => onChange({ ...draft, description: value })} value={draft.description} />
        <Checkbox label="Featured / Pin" onChange={(value) => onChange({ ...draft, featured: value })} value={draft.featured} />
        <Checkbox label="Active" onChange={(value) => onChange({ ...draft, active: value })} value={draft.active} />
        <div className="operations-actions operations-form-wide">
          <button disabled={workingAction !== ''} type="submit">
            {mode === 'edit' ? 'Save Stream' : 'Add Stream'}
          </button>
          {onDelete ? (
            <button disabled={workingAction !== ''} onClick={onDelete} type="button">Delete Stream</button>
          ) : null}
        </div>
      </form>
    </section>
  )
}

function Input({
  label,
  onChange,
  type = 'text',
  value,
}: {
  label: string
  onChange: (value: string) => void
  type?: string
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <input onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  )
}

function SelectInput({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: Array<string | { label: string; value: string }>
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Select</option>
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value
          const optionLabel = typeof option === 'string' ? option : option.label
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>
        })}
      </select>
    </label>
  )
}

function Textarea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="operations-form-wide">
      <span>{label}</span>
      <textarea onChange={(event) => onChange(event.target.value)} rows={4} value={value} />
    </label>
  )
}

function Checkbox({ label, onChange, value }: { label: string; onChange: (value: boolean) => void; value: boolean }) {
  return (
    <label className="operations-check">
      <input checked={value} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  )
}

function filterGameOptions(games: RecentGame[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return games

  return games.filter((game) => [
    String(game.id), game.winner, game.winnerDisplayName, game.loser,
    game.loserDisplayName, game.winnerFaction, game.loserFaction,
    game.mission, game.division, game.date,
  ].join(' ').toLowerCase().includes(normalizedQuery))
}

function getGameOptionLabel(game: RecentGame) {
  return `#${game.id} ${game.winnerDisplayName || game.winner} vs ${game.loserDisplayName || game.loser} / ${game.mission} / ${game.division || 'No division'}`
}

function applyGameToStreamDraft(draft: StreamedGame, game: RecentGame): StreamedGame {
  return {
    ...draft,
    date: game.date,
    division: game.division,
    gameId: game.id,
    mission: game.mission,
    player1: game.winnerDisplayName || game.winner,
    player1Faction: game.winnerFaction,
    player2: game.loserDisplayName || game.loser,
    player2Faction: game.loserFaction,
    streamType: 'Battle Report',
    title: draft.title || `${game.winnerDisplayName || game.winner} vs ${game.loserDisplayName || game.loser}`,
  }
}

function getStatusLine(parts: string[]) {
  return parts.filter(Boolean).join(' / ') || 'Draft'
}

export default CommunityManager
