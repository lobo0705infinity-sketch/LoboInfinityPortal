import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  buildCapabilityNavigation,
  getEventNavigationConfig,
} from '../config/eventNavigation'
import './Top40RegistrationPage.css'

const TOP_40_EVENT_ID = 'event-lobo-s-american-top-40'
const TOP_40_REGISTRATION_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfCyQ-oaLlZf8-utdWm0Y2iWrU8QZiHLVBhWzmxaCUZj2cMqg/viewform'

type PublicTop40Registration = {
  capacity: number
  count: number
  players: Array<{ name: string; order: number }>
  status: 'FULL' | 'OPEN'
}

function isPublicTop40Registration(value: unknown): value is PublicTop40Registration {
  if (!value || typeof value !== 'object') return false
  const registration = value as Partial<PublicTop40Registration>
  return registration.capacity === 40
    && typeof registration.count === 'number'
    && (registration.status === 'OPEN' || registration.status === 'FULL')
    && Array.isArray(registration.players)
    && registration.count === registration.players.length
    && registration.players.every((player, index) => (
      player
      && typeof player.name === 'string'
      && player.name.trim().length > 0
      && player.order === index + 1
      && Object.keys(player).sort().join(',') === 'name,order'
    ))
}

export default function Top40RegistrationPage() {
  const [registration, setRegistration] = useState<PublicTop40Registration | null>(null)
  const [error, setError] = useState('')
  const config = getEventNavigationConfig(TOP_40_EVENT_ID)
  const navigation = config ? buildCapabilityNavigation(config) : []

  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/public-event-projection?eventId=${TOP_40_EVENT_ID}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Registration snapshot returned HTTP ${response.status}.`)
        const payload = await response.json() as { projection?: { registration?: unknown } }
        if (!isPublicTop40Registration(payload.projection?.registration)) {
          throw new Error('Registration snapshot is unavailable.')
        }
        setRegistration(payload.projection.registration)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : 'Registration snapshot is unavailable.')
      })
    return () => controller.abort()
  }, [])

  const count = registration?.count ?? 0
  const full = registration?.status === 'FULL'

  return (
    <main className="portal-shell event-overview-shell top40-registration-page" data-event="top40-registration">
      <figure className="panel top40-registration-hero" aria-label="Lobo's American Top 40 Registration artwork">
        <img
          alt="Lobo's American Top 40 Registration"
          height="941"
          src="/assets/events/top-40-registration.png"
          width="1672"
        />
      </figure>

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
          <p className="eyebrow">Lobo&apos;s American Top 40</p>
          <h1 id="top40-registration-title">Tournament Registration</h1>
          <p>Register for the individual 300-point, double-elimination tournament open to players throughout the Americas.</p>
        </div>
        <a
          className="top40-registration-cta"
          href={TOP_40_REGISTRATION_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          REGISTER NOW
        </a>
      </section>

      <section className="top40-registration-grid" aria-live="polite">
        <article className={`panel top40-registration-status ${full ? 'is-full' : 'is-open'}`}>
          <p className="eyebrow">Registration Status</p>
          <strong>{full ? 'FULL' : 'OPEN'}</strong>
          <h2>{count} / 40 PLAYERS REGISTERED</h2>
          {full
            ? <p>The tournament field has reached its 40-player capacity.</p>
            : <p>Registration remains open while places are available.</p>}
        </article>

        <article className="panel top40-registration-roster" aria-labelledby="top40-registration-roster-title">
          <div className="top40-registration-roster-heading">
            <p className="eyebrow">Public Roster</p>
            <h2 id="top40-registration-roster-title">Registered Players</h2>
          </div>
          {error ? <p className="top40-registration-empty">{error}</p> : null}
          {!error && !registration ? <p className="top40-registration-empty">Loading registration snapshot…</p> : null}
          {registration && registration.players.length === 0
            ? <p className="top40-registration-empty">No players have registered yet. Be the first to enter the field.</p>
            : null}
          {registration && registration.players.length > 0
            ? <ol className="top40-registration-list">
                {registration.players.map((player) => (
                  <li key={`${player.order}-${player.name}`}>
                    <span>{player.order}</span>
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
