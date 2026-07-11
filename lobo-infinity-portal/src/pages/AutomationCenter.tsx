import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import Skeleton from '../components/Skeleton'
import {
  apiClient,
  type AutomationCenterData,
  type AutomationDestination,
  type AutomationEventType,
  type AutomationRule,
  type AutomationTemplate,
} from '../services/api'

type AutomationState =
  | {
      status: 'loading'
    }
  | {
      data: AutomationCenterData
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

type AutomationAction = (
  action: string,
  params?: Record<string, string | number | boolean>,
) => Promise<void>

const destinationLabels: Record<AutomationDestination, string> = {
  commissionerFeed: 'Commissioner Feed',
  discord: 'Discord',
  email: 'Email',
  news: 'News',
  portal: 'Portal',
  publicApi: 'Public API',
  push: 'Push',
  timeline: 'Timeline',
}

function AutomationCenter() {
  const auth = useAuth()
  const canView = auth.isAtLeastRole('Assistant Commissioner')
  const canManage = auth.hasPermission('manageSettings')
  const canRun = auth.hasPermission('manageNews')
  const [state, setState] = useState<AutomationState>({ status: 'loading' })
  const [workingAction, setWorkingAction] = useState('')

  async function loadAutomation(signal?: AbortSignal) {
    try {
      const data = await apiClient.getAutomation({ signal })
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
              : 'League Automation Center could not be loaded.',
          status: 'error',
        })
      }
    }
  }

  useEffect(() => {
    if (auth.status !== 'ready' || !auth.authenticated || !canView) {
      return
    }

    const controller = new AbortController()
    void Promise.resolve().then(() => loadAutomation(controller.signal))

    return () => {
      controller.abort()
    }
  }, [auth.authenticated, auth.status, canView])

  async function runAction(
    action: string,
    params: Record<string, string | number | boolean> = {},
  ) {
    setWorkingAction(action)
    try {
      await apiClient.automationAction(action, params)
      await loadAutomation()
    } finally {
      setWorkingAction('')
    }
  }

  if (auth.status === 'loading') {
    return <AutomationLoading />
  }

  if (!auth.authenticated || !canView) {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="panel operations-access-card">
          <p className="eyebrow">Commissioner Access</p>
          <h2>Authorized League Staff Only</h2>
          <p>
            Sign in with an enabled Assistant Commissioner or Commissioner
            account to use the League Automation Center.
          </p>
        </section>
      </main>
    )
  }

  if (state.status === 'loading') {
    return <AutomationLoading />
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Automation error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  const { data } = state

  return (
    <main className="portal-shell">
      <PageHeader />
      <AutomationSummary data={data} />
      <section className="operations-grid" aria-label="Automation status">
        <StatusPanel data={data} />
        <DiscordPanel data={data} onAction={runAction} canManage={canManage} workingAction={workingAction} />
        <QueuePanel data={data} onAction={runAction} canRun={canRun} canManage={canManage} workingAction={workingAction} />
      </section>
      <section className="operations-grid two-column" aria-label="Automation controls">
        <RunAutomationPanel onAction={runAction} canRun={canRun} canManage={canManage} workingAction={workingAction} />
        <ManualEventPanel data={data} onAction={runAction} canRun={canRun} workingAction={workingAction} />
      </section>
      <section className="operations-grid two-column" aria-label="Automation rules and templates">
        <EventRulesPanel data={data} onAction={runAction} canManage={canManage} workingAction={workingAction} />
        <TemplatesPanel templates={data.templates} onAction={runAction} canManage={canManage} />
      </section>
      <section className="operations-grid two-column" aria-label="Automation history">
        <EventsPanel data={data} />
        <DestinationsPanel data={data} />
      </section>
    </main>
  )
}

function AutomationLoading() {
  return (
    <main className="portal-shell">
      <PageHeader />
      <section className="operations-grid" aria-label="Automation loading">
        <Skeleton label="Automation status loading" rows={6} />
        <Skeleton label="Discord automation loading" rows={6} />
        <Skeleton label="Queue loading" rows={6} />
      </section>
      <section className="operations-grid two-column" aria-label="Automation controls loading">
        <Skeleton label="Automation controls loading" rows={6} />
        <Skeleton label="Automation history loading" rows={6} />
      </section>
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="automation-title">
      <p className="eyebrow">League Operating System</p>
      <h1 id="automation-title">League Automation Center</h1>
      <p>
        Event-driven league communication for portal notifications, Discord,
        timeline, news, commissioner alerts, and future destinations.
      </p>
    </section>
  )
}

function AutomationSummary({ data }: { data: AutomationCenterData }) {
  const cards = [
    ['Automation', data.status.enabled ? 'Running' : 'Paused'],
    ['Health', data.status.health.toUpperCase()],
    ['Discord', data.status.discordConnected ? 'Connected' : 'Missing'],
    ['Queue', data.status.queueSize],
    ['Retry Queue', data.status.retryQueue],
    ['Event Types', data.eventTypes.length],
  ] as const

  return (
    <section className="operations-summary" aria-label="Automation summary">
      {cards.map(([label, value]) => (
        <article className="stat-card operations-stat" key={label}>
          <div className="stat-card-header">
            <span className="stat-card-icon">AUTO</span>
            <span className="stat-card-label">{label}</span>
          </div>
          <strong>{value}</strong>
          <p>Automation signal</p>
        </article>
      ))}
    </section>
  )
}

function StatusPanel({ data }: { data: AutomationCenterData }) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Automation Status" title="Event Pipeline" />
      <dl className="operations-metrics">
        <Metric label="State" value={data.status.enabled ? 'Running' : 'Paused'} />
        <Metric label="Webhook Healthy" value={data.status.webhookHealthy ? 'Yes' : 'No'} />
        <Metric label="Last Message" value={data.status.lastMessage || 'Never'} />
        <Metric label="Last Failure" value={data.status.lastFailure || 'None'} />
        <Metric label="Last Run" value={data.status.lastAutomationRun || 'Never'} />
      </dl>
    </section>
  )
}

function DiscordPanel({
  canManage,
  data,
  onAction,
  workingAction,
}: {
  canManage: boolean
  data: AutomationCenterData
  onAction: AutomationAction
  workingAction: string
}) {
  const [draft, setDraft] = useState({
    adminChannel: data.discord.adminChannel,
    announcementChannel: data.discord.announcementChannel,
    enabled: data.discord.enabled,
    rateLimitPerHour: String(data.discord.rateLimitPerHour || 12),
    retryLimit: String(data.discord.retryLimit || 3),
    webhookUrl: '',
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('updateDiscordSettings', draft)
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Discord Destination" title="Webhook Configuration" />
      <dl className="operations-metrics compact">
        <Metric label="Connected" value={data.discord.configured ? 'Yes' : 'No'} />
        <Metric label="Webhook" value={data.discord.webhookMasked || 'Not configured'} />
        <Metric label="Channel" value={data.discord.announcementChannel || 'Not set'} />
        <Metric label="Failures" value={data.discord.failures} />
      </dl>
      <form className="operations-form" onSubmit={submit}>
        <Input disabled={!canManage} label="Webhook URL" onChange={(value) => setDraft({ ...draft, webhookUrl: value })} value={draft.webhookUrl} />
        <Input disabled={!canManage} label="Channel Name" onChange={(value) => setDraft({ ...draft, announcementChannel: value })} value={draft.announcementChannel} />
        <Input disabled={!canManage} label="Admin Channel" onChange={(value) => setDraft({ ...draft, adminChannel: value })} value={draft.adminChannel} />
        <Input disabled={!canManage} label="Rate Limit" onChange={(value) => setDraft({ ...draft, rateLimitPerHour: value })} type="number" value={draft.rateLimitPerHour} />
        <Input disabled={!canManage} label="Retry Limit" onChange={(value) => setDraft({ ...draft, retryLimit: value })} type="number" value={draft.retryLimit} />
        <label className="operations-check">
          <input checked={draft.enabled} disabled={!canManage} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} type="checkbox" />
          Enabled
        </label>
        <button disabled={!canManage || workingAction !== ''} type="submit">Save Discord</button>
      </form>
      <div className="operations-actions wrap">
        <button disabled={!canManage || workingAction !== ''} onClick={() => void onAction('testDiscordWebhook', { message: 'League Automation Center test.' })} type="button">
          Test Connection
        </button>
      </div>
    </section>
  )
}

function QueuePanel({
  canManage,
  canRun,
  data,
  onAction,
  workingAction,
}: {
  canManage: boolean
  canRun: boolean
  data: AutomationCenterData
  onAction: AutomationAction
  workingAction: string
}) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Queue" title="Outgoing Messages" />
      <dl className="operations-metrics compact">
        <Metric label="Pending" value={data.queue.filter((item) => item.status === 'Pending').length} />
        <Metric label="Sent" value={data.queue.filter((item) => item.status === 'Sent').length} />
        <Metric label="Retry" value={data.queue.filter((item) => item.status === 'Retry').length} />
        <Metric label="Failed" value={data.queue.filter((item) => item.status === 'Failed').length} />
      </dl>
      <div className="operations-actions wrap">
        <button disabled={!canRun || workingAction !== ''} onClick={() => void onAction('retryAutomationFailed')} type="button">
          Retry Failed
        </button>
        <button disabled={!canManage || workingAction !== ''} onClick={() => void onAction('clearAutomationQueue')} type="button">
          Clear Queue
        </button>
      </div>
      <div className="operations-stack">
        {data.queue.length === 0 ? (
          <EmptyState text="No queued automation messages." />
        ) : (
          data.queue.slice(0, 8).map((item) => (
            <article className={`operations-record ${item.status === 'Retry' || item.status === 'Failed' ? 'warning' : ''}`} key={item.queueId}>
              <span>{item.destination}</span>
              <h3>{item.eventType}</h3>
              <p>{item.status} - attempts {item.attempts}</p>
              <small>{item.reason || item.timestamp}</small>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function RunAutomationPanel({
  canManage,
  canRun,
  onAction,
  workingAction,
}: {
  canManage: boolean
  canRun: boolean
  onAction: AutomationAction
  workingAction: string
}) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Commissioner Controls" title="Run and Replay" />
      <p className="operations-empty">
        Automation controls publish events and process configured destinations without blocking league operations.
      </p>
      <div className="operations-actions wrap">
        <button disabled={!canRun || workingAction !== ''} onClick={() => void onAction('runAutomation', { cadence: 'weekly' })} type="button">
          Run Automation
        </button>
        <button disabled={!canManage || workingAction !== ''} onClick={() => void onAction('pauseAutomation')} type="button">
          Pause Automation
        </button>
        <button disabled={!canManage || workingAction !== ''} onClick={() => void onAction('resumeAutomation')} type="button">
          Resume Automation
        </button>
        <button disabled={!canRun || workingAction !== ''} onClick={() => void onAction('replayLastAutomationEvent')} type="button">
          Replay Last Event
        </button>
        <button disabled={!canRun || workingAction !== ''} onClick={() => void onAction('replayAutomationWeek')} type="button">
          Replay Week
        </button>
        <button disabled={!canRun || workingAction !== ''} onClick={() => void onAction('replayAutomationSeason')} type="button">
          Replay Season
        </button>
      </div>
    </section>
  )
}

function ManualEventPanel({
  canRun,
  data,
  onAction,
  workingAction,
}: {
  canRun: boolean
  data: AutomationCenterData
  onAction: AutomationAction
  workingAction: string
}) {
  const [draft, setDraft] = useState({
    division: '',
    eventType: data.eventTypes[0]?.eventType ?? 'commissionerNews',
    message: '',
    player: '',
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('publishAutomationEvent', draft)
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Preview and Send" title="Manual Event" />
      <form className="operations-form" onSubmit={submit}>
        <label>
          <span>Event Type</span>
          <select disabled={!canRun} onChange={(event) => setDraft({ ...draft, eventType: event.target.value })} value={draft.eventType}>
            {data.eventTypes.map((eventType) => (
              <option key={eventType.eventType} value={eventType.eventType}>
                {eventType.label}
              </option>
            ))}
          </select>
        </label>
        <Input disabled={!canRun} label="Player" onChange={(value) => setDraft({ ...draft, player: value })} value={draft.player} />
        <Input disabled={!canRun} label="Division" onChange={(value) => setDraft({ ...draft, division: value })} value={draft.division} />
        <label className="operations-form-wide">
          <span>Message</span>
          <textarea disabled={!canRun} onChange={(event) => setDraft({ ...draft, message: event.target.value })} rows={4} value={draft.message} />
        </label>
        <button disabled={!canRun || workingAction !== ''} type="submit">Send Now</button>
      </form>
    </section>
  )
}

function EventRulesPanel({
  canManage,
  data,
  onAction,
  workingAction,
}: {
  canManage: boolean
  data: AutomationCenterData
  onAction: AutomationAction
  workingAction: string
}) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Automation Rules" title="Event Destinations" />
      <div className="operations-stack">
        {data.eventTypes.map((eventType) => (
          <EventRuleCard
            canManage={canManage}
            destinations={data.destinations}
            eventType={eventType}
            key={eventType.eventType}
            onAction={onAction}
            workingAction={workingAction}
          />
        ))}
      </div>
    </section>
  )
}

function EventRuleCard({
  canManage,
  destinations,
  eventType,
  onAction,
  workingAction,
}: {
  canManage: boolean
  destinations: AutomationDestination[]
  eventType: AutomationEventType
  onAction: AutomationAction
  workingAction: string
}) {
  const [draft, setDraft] = useState<AutomationRule>(eventType.rule)

  function toggle(destination: AutomationDestination, enabled: boolean) {
    setDraft({
      ...draft,
      [destination]: enabled,
    })
  }

  return (
    <article className="operations-record">
      <span>{eventType.category}</span>
      <h3>{eventType.label}</h3>
      <p>{draft.enabled ? 'Enabled' : 'Disabled'} - {eventType.priority} priority</p>
      <div className="operations-actions wrap">
        <label className="operations-check">
          <input checked={draft.enabled} disabled={!canManage} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} type="checkbox" />
          Enabled
        </label>
        {destinations.map((destination) => (
          <label className="operations-check" key={destination}>
            <input checked={draft[destination]} disabled={!canManage} onChange={(event) => toggle(destination, event.target.checked)} type="checkbox" />
            {destinationLabels[destination]}
          </label>
        ))}
        <button
          disabled={!canManage || workingAction !== ''}
          onClick={() =>
            void onAction('updateAutomationRule', {
              ...draft,
              eventType: eventType.eventType,
            })
          }
          type="button"
        >
          Save Rule
        </button>
      </div>
    </article>
  )
}

function TemplatesPanel({
  canManage,
  onAction,
  templates,
}: {
  canManage: boolean
  onAction: AutomationAction
  templates: AutomationTemplate[]
}) {
  const [draft, setDraft] = useState(
    templates[0] ?? {
      body: '',
      discordFormat: 'embed',
      enabled: true,
      eventType: 'commissionerNews',
      name: '',
      templateId: '',
      title: '',
    },
  )

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onAction('updateAutomationTemplate', draft)
  }

  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Templates" title="Message Templates" />
      <form className="operations-form" onSubmit={submit}>
        <label>
          <span>Template</span>
          <select disabled={!canManage} onChange={(event) => {
            const selected = templates.find((template) => template.templateId === event.target.value)
            if (selected) setDraft(selected)
          }} value={draft.templateId}>
            {templates.map((template) => (
              <option key={template.templateId} value={template.templateId}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        <Input disabled={!canManage} label="Name" onChange={(value) => setDraft({ ...draft, name: value })} value={draft.name} />
        <Input disabled={!canManage} label="Title" onChange={(value) => setDraft({ ...draft, title: value })} value={draft.title} />
        <label className="operations-form-wide">
          <span>Body</span>
          <textarea disabled={!canManage} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows={4} value={draft.body} />
        </label>
        <label className="operations-check">
          <input checked={draft.enabled} disabled={!canManage} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} type="checkbox" />
          Enabled
        </label>
        <button disabled={!canManage} type="submit">Save Template</button>
      </form>
    </section>
  )
}

function EventsPanel({ data }: { data: AutomationCenterData }) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Events" title="Recent League Events" />
      <div className="operations-stack">
        {data.events.length === 0 ? (
          <EmptyState text="No automation events have been published yet." />
        ) : (
          data.events.slice(0, 12).map((event) => (
            <article className="operations-record" key={event.eventId}>
              <span>{event.category}</span>
              <h3>{event.message || event.eventId}</h3>
              <p>{event.player || 'League'} - {event.division || 'All divisions'}</p>
              <small>{event.timestamp} - {event.destinations}</small>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function DestinationsPanel({ data }: { data: AutomationCenterData }) {
  return (
    <section className="panel operations-panel">
      <PanelTitle eyebrow="Destinations" title="Automation Outputs" />
      <div className="operations-stack">
        {data.destinations.map((destination) => (
          <article className="operations-record" key={destination}>
            <span>{destination}</span>
            <h3>{destinationLabels[destination]}</h3>
            <p>
              {destination === 'discord'
                ? 'Live webhook destination.'
                : 'Configured as an event destination for current or future delivery.'}
            </p>
          </article>
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

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="operations-empty">{text}</p>
}

function Input({
  disabled = false,
  label,
  onChange,
  type = 'text',
  value,
}: {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  type?: string
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <input disabled={disabled} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  )
}

export default AutomationCenter
