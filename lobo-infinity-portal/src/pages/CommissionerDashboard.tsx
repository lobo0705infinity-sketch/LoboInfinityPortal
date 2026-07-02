import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Loading from '../components/Loading'
import {
  apiClient,
  type ArmyList,
  type OperationsDashboardData,
  type OperationsNewsItem,
  type PortalSettings,
  type StreamedGame,
} from '../services/api'

type OperationsState =
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

const defaultStream: StreamedGame = {
  id: 0,
  date: '',
  division: '',
  mission: '',
  player1: '',
  player1Faction: '',
  player2: '',
  player2Faction: '',
  youtubeUrl: '',
  featured: false,
}

const defaultNews: OperationsNewsItem = {
  id: 0,
  body: '',
  date: '',
  link: '',
  relatedFaction: '',
  relatedMission: '',
  relatedPlayer: '',
  title: '',
  pinned: false,
  archived: false,
}

function CommissionerDashboard() {
  const auth = useAuth()
  const [state, setState] = useState<OperationsState>({
    status: 'loading',
  })
  const [workingAction, setWorkingAction] = useState('')

  async function loadOperations() {
    try {
      const data = await apiClient.getOperations()
      setState({
        data,
        status: 'success',
      })
    } catch (error) {
      setState({
        error:
          error instanceof Error
            ? error.message
            : 'Commissioner operations could not be loaded.',
        status: 'error',
      })
    }
  }

  useEffect(() => {
    if (!auth.isAtLeastRole('Assistant Commissioner')) {
      return
    }

    const controller = new AbortController()

    apiClient
      .getOperations({
        signal: controller.signal,
      })
      .then((data) => {
        setState({
          data,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            error:
              error instanceof Error
                ? error.message
                : 'Commissioner operations could not be loaded.',
            status: 'error',
          })
        }
      })

    return () => {
      controller.abort()
    }
  }, [auth])

  async function runAction(
    action: string,
    params: Record<string, string | number | boolean> = {},
  ) {
    setWorkingAction(action)
    try {
      await apiClient.operationsAction(action, params)
      await loadOperations()
    } finally {
      setWorkingAction('')
    }
  }

  if (!auth.isAtLeastRole('Assistant Commissioner')) {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="panel operations-access-card">
          <p className="eyebrow">Commissioner Access</p>
          <h2>Authorized League Staff Only</h2>
          <p>
            Sign in with an enabled Assistant Commissioner or Commissioner
            account to use operations tools. Privileged Apps Script endpoints
            enforce the same role checks server-side.
          </p>
        </section>
      </main>
    )
  }

  if (state.status === 'loading') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Operations loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Operations error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  const { data } = state

  return (
    <main className="portal-shell">
      <PageHeader />
      <OperationsSummary data={data} />
      <section className="operations-grid" aria-label="Commissioner tools">
        <ArmyListApproval lists={data.pendingArmyLists} onAction={runAction} />
        <StreamManager streams={data.streams} onAction={runAction} />
        <NewsManager news={data.news} onAction={runAction} />
        <SettingsPanel settings={data.settings} onAction={runAction} />
        <CachePanel
          cache={data.summary.cacheStatus}
          onAction={runAction}
          workingAction={workingAction}
        />
        <SystemHealthPanel data={data} />
      </section>
      <section className="operations-grid two-column" aria-label="Audit and season">
        <AuditPanel audit={data.audit} />
        <SeasonPanel data={data} onAction={runAction} />
      </section>
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="commissioner-title">
      <p className="eyebrow">League Operations</p>
      <h1 id="commissioner-title">Commissioner Dashboard</h1>
      <p>Approvals, settings, health checks, cache tools, and season control.</p>
    </section>
  )
}

function OperationsSummary({ data }: { data: OperationsDashboardData }) {
  const cards = [
    ['Pending Army Lists', data.summary.pendingArmyLists],
    ['Pending Streams', data.summary.pendingStreams],
    ['Pending News', data.summary.pendingNews],
    ['Recent Matches', data.summary.recentMatchSubmissions.length],
    ['Active Players', data.summary.leagueStatistics.activePlayers],
    ['Audit Warnings', data.summary.leagueAuditSummary.warning],
    ['Critical Issues', data.summary.leagueAuditSummary.critical],
    ['Matches Played', data.summary.seasonStatus.matchesPlayed],
  ] as const

  return (
    <section className="operations-summary" aria-label="Operations summary">
      {cards.map(([label, value]) => (
        <article className="stat-card operations-stat" key={label}>
          <div className="stat-card-header">
            <span className="stat-card-icon">OPS</span>
            <span className="stat-card-label">{label}</span>
          </div>
          <strong>{value}</strong>
          <p>Live from Google Sheets</p>
        </article>
      ))}
    </section>
  )
}

function ArmyListApproval({
  lists,
  onAction,
}: {
  lists: ArmyList[]
  onAction: (action: string, params?: Record<string, string | number | boolean>) => Promise<void>
}) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Approval Queue" title="Army List Approval" />
      {lists.length === 0 ? (
        <EmptyState text="No pending army lists." />
      ) : (
        <div className="operations-stack">
          {lists.map((list) => (
            <article className="operations-record" key={list.id}>
              <span>{list.faction}</span>
              <h3>{list.armyName}</h3>
              <p>{list.player} · {list.mission || 'Mission not recorded'}</p>
              <small>{list.description || 'No description submitted.'}</small>
              <div className="operations-actions">
                <button onClick={() => void onAction('approveArmyList', { id: list.id })} type="button">
                  Approve
                </button>
                <button onClick={() => void onAction('rejectArmyList', { id: list.id })} type="button">
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function StreamManager({
  onAction,
  streams,
}: {
  onAction: (action: string, params?: Record<string, string | number | boolean>) => Promise<void>
  streams: StreamedGame[]
}) {
  const [draft, setDraft] = useState(defaultStream)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('saveStream', draft).then(() => setDraft(defaultStream))
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Streams" title="Stream Manager" />
      <form className="operations-form" onSubmit={submit}>
        <Input label="Mission" onChange={(value) => setDraft({ ...draft, mission: value })} value={draft.mission} />
        <Input label="Division" onChange={(value) => setDraft({ ...draft, division: value })} value={draft.division} />
        <Input label="Player 1" onChange={(value) => setDraft({ ...draft, player1: value })} value={draft.player1} />
        <Input label="Player 1 Faction" onChange={(value) => setDraft({ ...draft, player1Faction: value })} value={draft.player1Faction} />
        <Input label="Player 2" onChange={(value) => setDraft({ ...draft, player2: value })} value={draft.player2} />
        <Input label="Player 2 Faction" onChange={(value) => setDraft({ ...draft, player2Faction: value })} value={draft.player2Faction} />
        <Input label="YouTube URL" onChange={(value) => setDraft({ ...draft, youtubeUrl: value })} value={draft.youtubeUrl} />
        <Input label="Date" onChange={(value) => setDraft({ ...draft, date: value })} type="date" value={draft.date} />
        <label className="operations-check">
          <input
            checked={draft.featured}
            onChange={(event) => setDraft({ ...draft, featured: event.target.checked })}
            type="checkbox"
          />
          Featured
        </label>
        <button type="submit">Save Stream</button>
      </form>
      <RecordList
        empty="No streams configured."
        items={streams.map((stream) => ({
          id: stream.id,
          title: stream.mission || 'Untitled stream',
          meta: `${stream.player1} vs ${stream.player2}`,
          detail: stream.youtubeUrl,
          onDelete: () => void onAction('deleteStream', { id: stream.id }),
          onEdit: () => setDraft(stream),
        }))}
      />
    </section>
  )
}

function NewsManager({
  news,
  onAction,
}: {
  news: OperationsNewsItem[]
  onAction: (action: string, params?: Record<string, string | number | boolean>) => Promise<void>
}) {
  const [draft, setDraft] = useState(defaultNews)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('saveNews', draft).then(() => setDraft(defaultNews))
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Newsroom" title="Commissioner News Manager" />
      <form className="operations-form" onSubmit={submit}>
        <Input label="Title" onChange={(value) => setDraft({ ...draft, title: value })} value={draft.title} />
        <Input label="Date" onChange={(value) => setDraft({ ...draft, date: value })} type="date" value={draft.date} />
        <Input label="Link" onChange={(value) => setDraft({ ...draft, link: value })} value={draft.link} />
        <label className="operations-form-wide">
          <span>Body</span>
          <textarea
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            rows={4}
            value={draft.body}
          />
        </label>
        <label className="operations-check">
          <input checked={draft.pinned} onChange={(event) => setDraft({ ...draft, pinned: event.target.checked })} type="checkbox" />
          Pin
        </label>
        <label className="operations-check">
          <input checked={draft.archived} onChange={(event) => setDraft({ ...draft, archived: event.target.checked })} type="checkbox" />
          Archive
        </label>
        <button type="submit">Save News</button>
      </form>
      <RecordList
        empty="No manual news configured."
        items={news.map((item) => ({
          id: item.id,
          title: item.title || 'Untitled news',
          meta: item.date,
          detail: item.body,
          onDelete: () => void onAction('deleteNews', { id: item.id }),
          onEdit: () => setDraft(item),
        }))}
      />
    </section>
  )
}

function SettingsPanel({
  onAction,
  settings,
}: {
  onAction: (action: string, params?: Record<string, string | number | boolean>) => Promise<void>
  settings: PortalSettings
}) {
  const [draft, setDraft] = useState(settings)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('updateSettings', draft)
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Configuration" title="League Settings" />
      <form className="operations-form" onSubmit={submit}>
        <Input label="League Name" onChange={(value) => setDraft({ ...draft, leagueName: value })} value={draft.leagueName} />
        <Input label="Current Season" onChange={(value) => setDraft({ ...draft, currentSeason: value })} value={draft.currentSeason} />
        <Input label="Google Form URL" onChange={(value) => setDraft({ ...draft, googleFormUrl: value })} value={draft.googleFormUrl} />
        <Input label="Button Text" onChange={(value) => setDraft({ ...draft, submissionButtonText: value })} value={draft.submissionButtonText} />
        <Input label="Discord Invite" onChange={(value) => setDraft({ ...draft, discordInvite: value })} value={draft.discordInvite} />
        <Input label="League Website" onChange={(value) => setDraft({ ...draft, leagueWebsite: value })} value={draft.leagueWebsite} />
        <Input label="Commissioner Contact" onChange={(value) => setDraft({ ...draft, commissionerContact: value })} value={draft.commissionerContact} />
        <Input label="Theme Accent" onChange={(value) => setDraft({ ...draft, themeAccentColor: value })} type="color" value={draft.themeAccentColor || '#C1121F'} />
        <Input label="Season Start" onChange={(value) => setDraft({ ...draft, seasonStartDate: value })} type="date" value={draft.seasonStartDate} />
        <Input label="Season End" onChange={(value) => setDraft({ ...draft, seasonEndDate: value })} type="date" value={draft.seasonEndDate} />
        <Input label="Google OAuth Client ID" onChange={(value) => setDraft({ ...draft, googleOAuthClientId: value })} value={draft.googleOAuthClientId} />
        <Input label="Portal Version" onChange={(value) => setDraft({ ...draft, portalVersion: value })} value={draft.portalVersion} />
        <Input label="Git Commit" onChange={(value) => setDraft({ ...draft, gitCommit: value })} value={draft.gitCommit} />
        <Input label="Deployment URL" onChange={(value) => setDraft({ ...draft, deploymentUrl: value })} value={draft.deploymentUrl} />
        <label className="operations-check">
          <input checked={draft.submissionEnabled !== 'false'} onChange={(event) => setDraft({ ...draft, submissionEnabled: String(event.target.checked) })} type="checkbox" />
          Enable submissions
        </label>
        <label className="operations-check">
          <input checked={draft.submissionButtonVisible !== 'false'} onChange={(event) => setDraft({ ...draft, submissionButtonVisible: String(event.target.checked) })} type="checkbox" />
          Show submit button
        </label>
        <label className="operations-check">
          <input checked={draft.registrationOpen === 'true'} onChange={(event) => setDraft({ ...draft, registrationOpen: String(event.target.checked) })} type="checkbox" />
          Registration open
        </label>
        <button type="submit">Save Settings</button>
      </form>
    </section>
  )
}

function CachePanel({
  cache,
  onAction,
  workingAction,
}: {
  cache: OperationsDashboardData['summary']['cacheStatus']
  onAction: (action: string, params?: Record<string, string | number | boolean>) => Promise<void>
  workingAction: string
}) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="System" title="Cache Management" />
      <dl className="operations-metrics">
        <Metric label="Status" value={cache.status} />
        <Metric label="Version" value={cache.version} />
        <Metric label="Last Refresh" value={cache.lastRefresh || 'Not recorded'} />
        <Metric label="Cache Age" value={cache.cacheAge} />
      </dl>
      <div className="operations-actions">
        <button disabled={workingAction !== ''} onClick={() => void onAction('clearCache')} type="button">
          Clear Cache
        </button>
        <button disabled={workingAction !== ''} onClick={() => void onAction('rebuildStatistics')} type="button">
          Rebuild Statistics
        </button>
      </div>
    </section>
  )
}

function SystemHealthPanel({ data }: { data: OperationsDashboardData }) {
  const auth = useAuth()

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Status" title="System Health" />
      <dl className="operations-metrics">
        <Metric label="Current User" value={auth.user.displayName} />
        <Metric
          label="Authentication"
          value={auth.authenticated ? 'Authenticated' : 'Guest'}
        />
        <Metric label="Role" value={auth.user.role} />
        {Object.entries(data.summary.systemHealth).map(([key, value]) => (
          <Metric key={key} label={key} value={value} />
        ))}
        <Metric label="Portal Version" value={data.settings.portalVersion || '1.2.1'} />
        <Metric label="Apps Script" value="Version 1.2.1" />
        <Metric label="Git Commit" value={data.settings.gitCommit || 'Not recorded'} />
        <Metric label="Deployment" value={data.settings.deploymentUrl || 'Not recorded'} />
      </dl>
    </section>
  )
}

function AuditPanel({ audit }: { audit: OperationsDashboardData['audit'] }) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="League Audit" title="Data Quality Audit" />
      <dl className="operations-metrics compact">
        <Metric label="Critical" value={audit.summary.critical} />
        <Metric label="Warnings" value={audit.summary.warning} />
        <Metric label="Info" value={audit.summary.informational} />
      </dl>
      <div className="operations-stack">
        {audit.issues.slice(0, 10).map((issue) => (
          <Link className={`operations-record ${issue.severity}`} key={`${issue.severity}-${issue.description}`} to={issue.link || '/commissioner'}>
            <span>{issue.severity}</span>
            <h3>{issue.description}</h3>
            <p>{issue.suggestedFix}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function SeasonPanel({
  data,
  onAction,
}: {
  data: OperationsDashboardData
  onAction: (action: string, params?: Record<string, string | number | boolean>) => Promise<void>
}) {
  const season = data.summary.seasonStatus
  const operations = [
    'Start New Season',
    'Finalize Current Season',
    'Archive Current Season',
    'Clone Current Season Configuration',
    'Open Registration for Next Season',
    'Close Registration',
    'Execute Promotion/Relegation',
    'Reset Season Statistics',
  ]

  function confirmOperation(operation: string) {
    const accepted = window.confirm(
      `${operation}\n\nThis will write an operation record to the Season Archive. Destructive season actions should be reviewed before execution.`,
    )

    if (accepted) {
      void onAction('seasonOperation', { operation })
    }
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Season Control" title="Season Administration" />
      <dl className="operations-metrics">
        <Metric label="Season" value={season.currentSeasonName} />
        <Metric label="Weeks Completed" value={season.weeksCompleted} />
        <Metric label="Matches Played" value={season.matchesPlayed} />
        <Metric label="Remaining Matches" value={season.remainingMatches} />
        <Metric label="Registration" value={season.registrationOpen ? 'Open' : 'Closed'} />
      </dl>
      <div className="operations-actions wrap">
        {operations.map((operation) => (
          <button key={operation} onClick={() => confirmOperation(operation)} type="button">
            {operation}
          </button>
        ))}
      </div>
    </section>
  )
}

function PanelTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="panel-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="operations-empty">{text}</p>
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

function RecordList({
  empty,
  items,
}: {
  empty: string
  items: Array<{
    detail: string
    id: number
    meta: string
    onDelete: () => void
    onEdit: () => void
    title: string
  }>
}) {
  if (items.length === 0) {
    return <EmptyState text={empty} />
  }

  return (
    <div className="operations-stack">
      {items.slice(0, 8).map((item) => (
        <article className="operations-record" key={item.id}>
          <span>{item.meta || 'Live record'}</span>
          <h3>{item.title}</h3>
          <p>{item.detail}</p>
          <div className="operations-actions">
            <button onClick={item.onEdit} type="button">Edit</button>
            <button onClick={item.onDelete} type="button">Delete</button>
          </div>
        </article>
      ))}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export default CommissionerDashboard
