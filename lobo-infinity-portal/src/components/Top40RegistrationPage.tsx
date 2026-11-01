import CompactArtwork from '../components/CompactArtwork'
import { Link } from 'react-router-dom'
import {
  buildCapabilityNavigation,
  getEventNavigationConfig,
} from '../config/eventNavigation'
import type { PublicEvent } from '../public/snapshotTypes'
import { top40RegistrationState } from '../public/top40PreparationModel'
import { useSnapshotData } from '../public/useSnapshotData'
import './Top40RegistrationPage.css'

const TOP_40_EVENT_ID = 'event-lobo-s-american-top-40'
const TOP_40_REGISTRATION_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfCyQ-oaLlZf8-utdWm0Y2iWrU8QZiHLVBhWzmxaCUZj2cMqg/viewform'

type PublicTop40Registration = {
  generatedAt: string
  players: Array<{ name: string; position: number }>
}

function isPublicTop40Registration(value: unknown): value is PublicTop40Registration {
  if (!value || typeof value !== 'object') return false
  const registration = value as Partial<PublicTop40Registration>
  return typeof registration.generatedAt === 'string'
    && !Number.isNaN(Date.parse(registration.generatedAt))
    && Array.isArray(registration.players)
    && registration.players.every((player, index) => (
      player
      && typeof player.name === 'string'
      && player.name.trim().length > 0
      && player.position === index + 1
      && Object.keys(player).sort().join(',') === 'name,position'
    ))
    && Object.keys(registration).sort().join(',') === 'generatedAt,players'
}

export default function Top40RegistrationPage() {
  const events = useSnapshotData<PublicEvent[]>('events')
  const state = top40RegistrationState(events.data?.find((event) => event.id === TOP_40_EVENT_ID))
  const snapshot = useSnapshotData<PublicTop40Registration>('top-40-registrations')
  const registration = isPublicTop40Registration(snapshot.data) ? snapshot.data : null
  const config = getEventNavigationConfig(TOP_40_EVENT_ID)
  const navigation = config ? buildCapabilityNavigation(config) : []
  const count = registration?.players.length

  return (
    <main className="portal-shell event-overview-shell top40-registration-page" data-event="top40-registration">
      <CompactArtwork title="Registration" eyebrow="Lobo’s Top 40" src="/assets/events/top-40-registration.png"/>

      <nav className="event-home-nav" aria-label="Event navigation">
        {navigation.map((item) => (
          <Link
            aria-current={item.capability === 'registration' ? 'page' : undefined}
            className={item.capability === 'registration' ? 'active' : undefined}
            key={item.capability}
            to={item.to}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="panel top40-registration-summary" aria-labelledby="top40-registration-title">
        <div>
          <p className="eyebrow">Lobo&apos;s Top 40</p>
          <h2 id="top40-registration-title">Tournament Registration</h2>
          <p>Register for the individual 300-point, double-elimination tournament open to players throughout the Americas.</p>
        </div>
        {state === 'open' ? <a
          className="top40-registration-cta"
          href={TOP_40_REGISTRATION_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          REGISTER NOW
        </a> : <strong>{state === 'closed' ? 'REGISTRATION CLOSED' : 'Checking registration status…'}</strong>}
      </section>

      <section className="top40-registration-grid">
        <article className={`panel top40-registration-status ${state === 'open' ? 'is-open' : 'is-closed'}`}>
          <p className="eyebrow">Registration Status</p>
          {registration ? <>
            <strong>{state === 'closed' ? 'CLOSED' : state === 'open' ? 'OPEN' : 'STATUS PENDING'}</strong>
            <h2>{count} PLAYERS REGISTERED</h2>
            <p>Registration is uncapped. After registration closes, the Commissioner will select the final field of up to 40 players.</p>
            <p>Registration does not guarantee selection.</p>
          </> : <h2>Registration list is temporarily unavailable.</h2>}
        </article>

        <article className="panel top40-registration-roster" aria-labelledby="top40-registration-roster-title">
          <div className="top40-registration-roster-heading">
            <p className="eyebrow">Public Roster</p>
            <h2 id="top40-registration-roster-title">Registered Players</h2>
            <p className="top40-registration-update-label">Updated after event changes and background refreshes</p>
            {registration
              ? <p className="top40-registration-updated-at">Last updated: {formatSnapshotTimestamp(registration.generatedAt)}</p>
              : null}
          </div>
          {!registration
            ? <p className="top40-registration-empty">Registration list is temporarily unavailable.</p>
            : null}
          {registration && registration.players.length === 0
            ? <p className="top40-registration-empty">No players registered yet.</p>
            : null}
          {registration && registration.players.length > 0
            ? <ol className="top40-registration-list">
                {registration.players.map((player) => (
                  <li key={`${player.position}-${player.name}`}>
                    <span>{player.position}</span>
                    <strong>{player.name}</strong>
                  </li>
                ))}
              </ol>
            : null}
        </article>
      </section>
    </main>
  )
}

function formatSnapshotTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
