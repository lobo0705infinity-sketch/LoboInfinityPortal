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
    if (!draft.id || !window.confirm('Delete this Stream record?')) {
      return
    }

    setWorkingAction('deleteStream')
    setMessage('')

    try {
      await apiClient.operationsAction('deleteStream', { id: draft.id })
      await loadStreams()
      setDraft(defaultStream)
      setEditorMode(null)
      setGameQuery('')
      setMessage('Stream deleted.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Stream could not be deleted.')
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
          <button onClick={openCreate} type="button">Add Stream</button>
        </div>
        {streamsState.status === 'loading' ? (
          <p className="operations-empty" aria-live="polite">Loading Streams…</p>
        ) : null}
        {streamsState.status === 'error' ? (
          <p className="operations-empty" role="alert">{streamsState.error}</p>
        ) : null}
        {streamsState.status === 'success' ? (
          <StreamList items={streamsState.streams} onEdit={openEdit} />
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
  onEdit,
}: {
  items: StreamedGame[]
  onEdit: (stream: StreamedGame) => void
}) {
  if (items.length === 0) {
    return <p className="operations-empty">No Streams configured.</p>
  }

  return (
    <div className="operations-stack">
      {items.map((stream) => (
        <article className="operations-record" key={stream.id}>
          <span>{getStatusLine([stream.platform, stream.active ? 'Visible' : 'Hidden'])}</span>
          <h3>{stream.title || stream.streamer || 'Untitled Stream'}</h3>
          <p>{stream.youtubeUrl || `${stream.player1 || 'Player 1'} vs ${stream.player2 || 'Player 2'}`}</p>
          <div className="operations-actions">
            <button onClick={() => onEdit(stream)} type="button">Edit</button>
          </div>
        </article>
      ))}
    </div>
  )
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
