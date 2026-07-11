import { Link } from 'react-router-dom'
import { eventNavigationOptions } from '../config/eventNavigation'

function PastEvents() {
  const [currentEvent, ...otherEvents] = eventNavigationOptions

  return (
    <main className="portal-shell" data-page="past-events">
      <section className="page-header" aria-labelledby="past-events-title">
        <p className="eyebrow">Event Archive</p>
        <h1 id="past-events-title">Past Events</h1>
        <p>Browse current, upcoming, and archived event workspaces.</p>
      </section>

      <section className="dashboard-grid">
        <EventArchiveCard event={currentEvent} status="Current Event" />
        {otherEvents.map((event) => (
          <EventArchiveCard event={event} key={event.id} status="Event Workspace" />
        ))}
      </section>
    </main>
  )
}

function EventArchiveCard({
  event,
  status,
}: {
  event: typeof eventNavigationOptions[number]
  status: string
}) {
  return (
    <article className="panel event-home-panel">
      <div className="panel-heading">
        <p className="eyebrow">{status}</p>
        <h2>{event.label}</h2>
      </div>
      <div className="event-home-metric">
        <span>Type</span>
        <strong>{event.type}</strong>
      </div>
      <div className="event-home-metric">
        <span>Pages</span>
        <strong>{event.capabilities.length}</strong>
      </div>
      <Link className="event-home-primary-action" to={`/event/${encodeURIComponent(event.id)}`}>
        Open Event
      </Link>
    </article>
  )
}

export default PastEvents
