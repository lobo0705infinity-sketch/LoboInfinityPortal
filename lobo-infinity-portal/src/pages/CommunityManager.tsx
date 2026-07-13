import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import Skeleton from '../components/Skeleton'
import {
  apiClient,
  type OperationsAlertItem,
  type OperationsDashboardData,
  type OperationsNewsItem,
  type OperationsTimelineItem,
  type RecentGame,
  type StreamedGame,
} from '../services/api'

type CommunityManagerState =
  | {
      status: 'loading'
    }
  | {
      data: OperationsDashboardData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

type ContentAction = (
  action: string,
  params?: Record<string, string | number | boolean>,
) => Promise<void>

const defaultNews: OperationsNewsItem = {
  id: 0,
  body: '',
  date: '',
  expiration: '',
  featured: false,
  link: '',
  relatedFaction: '',
  relatedMission: '',
  relatedPlayer: '',
  title: '',
  pinned: false,
  archived: false,
}

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

const defaultAlert: OperationsAlertItem = {
  id: 0,
  active: true,
  body: '',
  expiration: '',
  featured: false,
  portalWide: true,
  priority: 'normal',
  publishDate: '',
  title: '',
}

const defaultTimeline: OperationsTimelineItem = {
  id: 0,
  active: true,
  category: 'Portal Update',
  date: '',
  description: '',
  featured: false,
  link: '',
  title: '',
}

function CommunityManager() {
  const auth = useAuth()
  const [state, setState] = useState<CommunityManagerState>({
    status: 'loading',
  })
  const [workingAction, setWorkingAction] = useState('')
  const [message, setMessage] = useState('')
  const canManageContent =
    auth.hasPermission('manageNews') || auth.hasPermission('manageStreams')

  const loadContent = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await apiClient.getOperationsContent({ signal })
      setState({
        data,
        status: 'success',
      })
    } catch (error) {
      if (!signal?.aborted) {
        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Community content could not be loaded.',
          status: 'error',
        })
      }
    }
  }, [])

  useEffect(() => {
    if (
      auth.status !== 'ready' ||
      !auth.authenticated ||
      !canManageContent
    ) {
      return
    }

    const controller = new AbortController()
    void Promise.resolve().then(() => loadContent(controller.signal))

    return () => {
      controller.abort()
    }
  }, [auth.authenticated, auth.status, canManageContent, loadContent])

  async function runAction(
    action: string,
    params: Record<string, string | number | boolean> = {},
  ) {
    setWorkingAction(action)
    setMessage('')

    try {
      await apiClient.operationsAction(action, params)
      await loadContent()
      setMessage(getSuccessMessage(action))
    } finally {
      setWorkingAction('')
    }
  }

  if (auth.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Community manager loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (!auth.authenticated || !canManageContent) {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="panel operations-access-card">
          <p className="eyebrow">Commissioner Access</p>
          <h2>Community Manager is commissioner-only.</h2>
          <p>
            Sign in with an Assistant Commissioner or Commissioner account to
            create and publish community content.
          </p>
        </section>
      </main>
    )
  }

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="operations-grid two-column" aria-label="Community manager loading">
          <Skeleton label="News manager loading" rows={7} />
          <Skeleton label="Streams manager loading" rows={7} />
          <Skeleton label="Alerts manager loading" rows={7} />
          <Skeleton label="Timeline manager loading" rows={7} />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Community manager error">
          <p role="alert">{state.error}</p>
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
      <section className="operations-grid two-column" aria-label="Community manager modules">
        <NewsManager
          items={state.data.news}
          onAction={runAction}
          workingAction={workingAction}
        />
        <StreamsManager
          items={state.data.streams}
          onAction={runAction}
          recentGames={state.data.summary.recentMatchSubmissions}
          workingAction={workingAction}
        />
        <AlertsManager
          items={state.data.alerts}
          onAction={runAction}
          workingAction={workingAction}
        />
        <TimelineManager
          items={state.data.timeline}
          onAction={runAction}
          workingAction={workingAction}
        />
      </section>
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="community-manager-title">
      <p className="eyebrow">Commissioner</p>
      <h1 id="community-manager-title">Community Manager</h1>
      <p>Manage portal-wide News, Streams, Alerts, and Timeline entries.</p>
    </section>
  )
}

function NewsManager({
  items,
  onAction,
  workingAction,
}: {
  items: OperationsNewsItem[]
  onAction: ContentAction
  workingAction: string
}) {
  const [draft, setDraft] = useState(defaultNews)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('saveNews', draft).then(() => setDraft(defaultNews))
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle count={items.length} eyebrow="News" title="News Manager" />
      <form className="operations-form" onSubmit={submit}>
        <Input label="Title" onChange={(value) => setDraft({ ...draft, title: value })} value={draft.title} />
        <Input label="Publish Date" onChange={(value) => setDraft({ ...draft, date: value })} type="date" value={draft.date} />
        <Input label="Expiration" onChange={(value) => setDraft({ ...draft, expiration: value })} type="date" value={draft.expiration} />
        <Input label="Link" onChange={(value) => setDraft({ ...draft, link: value })} value={draft.link} />
        <Textarea label="Body" onChange={(value) => setDraft({ ...draft, body: value })} value={draft.body} />
        <Checkbox label="Featured" onChange={(value) => setDraft({ ...draft, featured: value })} value={draft.featured} />
        <Checkbox label="Pin" onChange={(value) => setDraft({ ...draft, pinned: value })} value={draft.pinned} />
        <Checkbox label="Archive" onChange={(value) => setDraft({ ...draft, archived: value })} value={draft.archived} />
        <button disabled={workingAction !== ''} type="submit">
          {draft.id ? 'Save News' : 'Create News'}
        </button>
      </form>
      <RecordList
        empty="No manual news configured."
        items={items}
        onDelete={(id) => onAction('deleteNews', { id })}
        onEdit={setDraft}
        renderDetail={(item) => item.body}
        renderMeta={(item) =>
          getStatusLine([
            item.date,
            item.pinned ? 'Pinned' : '',
            item.featured ? 'Featured' : '',
            item.archived ? 'Archived' : 'Published',
          ])
        }
        renderTitle={(item) => item.title || 'Untitled news'}
      />
    </section>
  )
}

function StreamsManager({
  items,
  onAction,
  recentGames,
  workingAction,
}: {
  items: StreamedGame[]
  onAction: ContentAction
  recentGames: RecentGame[]
  workingAction: string
}) {
  const [draft, setDraft] = useState(defaultStream)
  const [gameQuery, setGameQuery] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('saveStream', draft).then(() => setDraft(defaultStream))
  }

  const gameOptions = filterGameOptions(recentGames, gameQuery)

  return (
    <section className="panel operations-panel">
      <PanelTitle count={items.length} eyebrow="Streams" title="Stream Manager" />
      <form className="operations-form" onSubmit={submit}>
        <SelectInput
          label="Stream Type"
          onChange={(value) =>
            setDraft({
              ...draft,
              gameId: value === 'Battle Report' ? draft.gameId : 0,
              streamType: value,
            })
          }
          options={['Battle Report', 'Standalone Stream']}
          value={draft.streamType || 'Standalone Stream'}
        />
        {draft.streamType === 'Battle Report' ? (
          <>
            <Input
              label="Search Battle Reports"
              onChange={setGameQuery}
              value={gameQuery}
            />
            <SelectInput
              label="Battle Report"
              onChange={(value) => {
                const game = recentGames.find((candidate) => String(candidate.id) === value)
                setDraft(game ? applyGameToStreamDraft(draft, game) : { ...draft, gameId: 0 })
              }}
              options={gameOptions.map((game) => ({
                label: getGameOptionLabel(game),
                value: String(game.id),
              }))}
              value={draft.gameId ? String(draft.gameId) : ''}
            />
          </>
        ) : null}
        <Input label="Stream Title" onChange={(value) => setDraft({ ...draft, title: value })} value={draft.title} />
        <Input label="Streamer" onChange={(value) => setDraft({ ...draft, streamer: value })} value={draft.streamer} />
        <SelectInput
          label="Platform"
          onChange={(value) => setDraft({ ...draft, platform: value })}
          options={['YouTube', 'Twitch', 'Kick', 'Other']}
          value={draft.platform}
        />
        <Input label="URL" onChange={(value) => setDraft({ ...draft, youtubeUrl: value })} value={draft.youtubeUrl} />
        <Input label="Thumbnail" onChange={(value) => setDraft({ ...draft, thumbnailUrl: value })} value={draft.thumbnailUrl} />
        <Input label="Date" onChange={(value) => setDraft({ ...draft, date: value })} type="date" value={draft.date} />
        {draft.streamType !== 'Battle Report' ? (
          <>
            <Input label="Player 1" onChange={(value) => setDraft({ ...draft, player1: value })} value={draft.player1} />
            <Input label="Player 1 Army" onChange={(value) => setDraft({ ...draft, player1Faction: value })} value={draft.player1Faction} />
            <Input label="Player 2" onChange={(value) => setDraft({ ...draft, player2: value })} value={draft.player2} />
            <Input label="Player 2 Army" onChange={(value) => setDraft({ ...draft, player2Faction: value })} value={draft.player2Faction} />
            <Input label="Mission" onChange={(value) => setDraft({ ...draft, mission: value })} value={draft.mission} />
            <Input label="Division" onChange={(value) => setDraft({ ...draft, division: value })} value={draft.division} />
          </>
        ) : (
          <div className="operations-form-wide operations-empty">
            {draft.gameId
              ? `${draft.player1} (${draft.player1Faction}) vs ${draft.player2} (${draft.player2Faction}) / ${draft.mission} / ${draft.division}`
              : 'Select a Battle Report to populate matchup fields.'}
          </div>
        )}
        <Textarea label="Description" onChange={(value) => setDraft({ ...draft, description: value })} value={draft.description} />
        <Checkbox label="Featured / Pin" onChange={(value) => setDraft({ ...draft, featured: value })} value={draft.featured} />
        <Checkbox label="Active" onChange={(value) => setDraft({ ...draft, active: value })} value={draft.active} />
        <button disabled={workingAction !== ''} type="submit">
          {draft.id ? 'Save Stream' : 'Add Stream'}
        </button>
      </form>
      <RecordList
        empty="No streams configured."
        items={items}
        onDelete={(id) => onAction('deleteStream', { id })}
        onEdit={setDraft}
        renderDetail={(item) =>
          item.description ||
          `${item.player1 || 'Player 1'} vs ${item.player2 || 'Player 2'}`
        }
        renderMeta={(item) =>
          getStatusLine([
            item.platform,
            item.featured ? 'Pinned' : '',
            item.active ? 'Active' : 'Hidden',
          ])
        }
        renderTitle={(item) => item.title || item.mission || 'Untitled stream'}
      />
    </section>
  )
}

function AlertsManager({
  items,
  onAction,
  workingAction,
}: {
  items: OperationsAlertItem[]
  onAction: ContentAction
  workingAction: string
}) {
  const [draft, setDraft] = useState(defaultAlert)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('saveAlert', draft).then(() => setDraft(defaultAlert))
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle count={items.length} eyebrow="Alerts" title="Alert Manager" />
      <form className="operations-form" onSubmit={submit}>
        <Input label="Title" onChange={(value) => setDraft({ ...draft, title: value })} value={draft.title} />
        <SelectInput
          label="Priority"
          onChange={(value) => setDraft({ ...draft, priority: value })}
          options={['normal', 'high', 'critical']}
          value={draft.priority}
        />
        <Input label="Publish Date" onChange={(value) => setDraft({ ...draft, publishDate: value })} type="date" value={draft.publishDate} />
        <Input label="Expiration" onChange={(value) => setDraft({ ...draft, expiration: value })} type="date" value={draft.expiration} />
        <Textarea label="Body" onChange={(value) => setDraft({ ...draft, body: value })} value={draft.body} />
        <Checkbox label="Portal-wide" onChange={(value) => setDraft({ ...draft, portalWide: value })} value={draft.portalWide} />
        <Checkbox label="Featured" onChange={(value) => setDraft({ ...draft, featured: value })} value={draft.featured} />
        <Checkbox label="Active" onChange={(value) => setDraft({ ...draft, active: value })} value={draft.active} />
        <button disabled={workingAction !== ''} type="submit">
          {draft.id ? 'Save Alert' : 'Create Alert'}
        </button>
      </form>
      <RecordList
        empty="No portal-wide alerts configured."
        items={items}
        onDelete={(id) => onAction('deleteAlert', { id })}
        onEdit={setDraft}
        renderDetail={(item) => item.body}
        renderMeta={(item) =>
          getStatusLine([
            item.priority,
            item.portalWide ? 'Portal-wide' : '',
            item.active ? 'Active' : 'Expired',
          ])
        }
        renderTitle={(item) => item.title || 'Untitled alert'}
      />
    </section>
  )
}

function TimelineManager({
  items,
  onAction,
  workingAction,
}: {
  items: OperationsTimelineItem[]
  onAction: ContentAction
  workingAction: string
}) {
  const [draft, setDraft] = useState(defaultTimeline)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('saveTimelineEntry', draft).then(() => setDraft(defaultTimeline))
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle count={items.length} eyebrow="Timeline" title="Timeline Manager" />
      <form className="operations-form" onSubmit={submit}>
        <Input label="Title" onChange={(value) => setDraft({ ...draft, title: value })} value={draft.title} />
        <Input label="Date" onChange={(value) => setDraft({ ...draft, date: value })} type="date" value={draft.date} />
        <SelectInput
          label="Category"
          onChange={(value) => setDraft({ ...draft, category: value })}
          options={['Portal Update', 'Community Milestone', 'Tournament Completed', 'New Season Begins', 'Achievement Added']}
          value={draft.category}
        />
        <Input label="Link" onChange={(value) => setDraft({ ...draft, link: value })} value={draft.link} />
        <Textarea label="Description" onChange={(value) => setDraft({ ...draft, description: value })} value={draft.description} />
        <Checkbox label="Featured" onChange={(value) => setDraft({ ...draft, featured: value })} value={draft.featured} />
        <Checkbox label="Active" onChange={(value) => setDraft({ ...draft, active: value })} value={draft.active} />
        <button disabled={workingAction !== ''} type="submit">
          {draft.id ? 'Save Timeline Entry' : 'Create Timeline Entry'}
        </button>
      </form>
      <RecordList
        empty="No manual timeline entries configured."
        items={items}
        onDelete={(id) => onAction('deleteTimelineEntry', { id })}
        onEdit={setDraft}
        renderDetail={(item) => item.description}
        renderMeta={(item) =>
          getStatusLine([
            item.date,
            item.category,
            item.featured ? 'Featured' : '',
            item.active ? 'Published' : 'Hidden',
          ])
        }
        renderTitle={(item) => item.title || 'Untitled timeline entry'}
      />
    </section>
  )
}

function PanelTitle({
  count,
  eyebrow,
  title,
}: {
  count: number
  eyebrow: string
  title: string
}) {
  return (
    <div className="panel-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <span>{count} items</span>
    </div>
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
          const value = typeof option === 'string' ? option : option.value
          const label = typeof option === 'string' ? option : option.label

          return (
            <option key={value} value={value}>
              {label}
            </option>
          )
        })}
      </select>
    </label>
  )
}

function filterGameOptions(games: RecentGame[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return games
  }

  return games.filter((game) =>
    [
      String(game.id),
      game.winner,
      game.winnerDisplayName,
      game.loser,
      game.loserDisplayName,
      game.winnerFaction,
      game.loserFaction,
      game.mission,
      game.division,
      game.date,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery),
  )
}

function getGameOptionLabel(game: RecentGame) {
  return `#${game.id} ${game.winnerDisplayName || game.winner} vs ${
    game.loserDisplayName || game.loser
  } / ${game.mission} / ${game.division || 'No division'}`
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
    title:
      draft.title ||
      `${game.winnerDisplayName || game.winner} vs ${game.loserDisplayName || game.loser}`,
  }
}

function Textarea({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="operations-form-wide">
      <span>{label}</span>
      <textarea onChange={(event) => onChange(event.target.value)} rows={4} value={value} />
    </label>
  )
}

function Checkbox({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: boolean) => void
  value: boolean
}) {
  return (
    <label className="operations-check">
      <input checked={value} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  )
}

function RecordList<T extends { id: number }>({
  empty,
  items,
  onDelete,
  onEdit,
  renderDetail,
  renderMeta,
  renderTitle,
}: {
  empty: string
  items: T[]
  onDelete: (id: number) => Promise<void>
  onEdit: (item: T) => void
  renderDetail: (item: T) => string
  renderMeta: (item: T) => string
  renderTitle: (item: T) => string
}) {
  if (items.length === 0) {
    return <p className="operations-empty">{empty}</p>
  }

  return (
    <div className="operations-stack">
      {items.map((item) => (
        <article className="operations-record" key={item.id}>
          <span>{renderMeta(item)}</span>
          <h3>{renderTitle(item)}</h3>
          <p>{renderDetail(item)}</p>
          <div className="operations-actions">
            <button onClick={() => onEdit(item)} type="button">
              Edit
            </button>
            <button
              onClick={() => {
                if (window.confirm('Delete this community content item?')) {
                  void onDelete(item.id)
                }
              }}
              type="button"
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

function getStatusLine(parts: string[]) {
  return parts.filter(Boolean).join(' / ') || 'Draft'
}

function getSuccessMessage(action: string) {
  switch (action) {
    case 'saveNews':
      return 'News saved.'
    case 'deleteNews':
      return 'News deleted.'
    case 'saveStream':
      return 'Stream saved.'
    case 'deleteStream':
      return 'Stream deleted.'
    case 'saveAlert':
      return 'Alert saved.'
    case 'deleteAlert':
      return 'Alert deleted.'
    case 'saveTimelineEntry':
      return 'Timeline entry saved.'
    case 'deleteTimelineEntry':
      return 'Timeline entry deleted.'
    default:
      return 'Community content updated.'
  }
}

export default CommunityManager
