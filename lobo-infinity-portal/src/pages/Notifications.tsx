import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'
import { apiClient, type LeagueNotification } from '../services/api'

type NotificationsState =
  | {
      status: 'idle'
    }
  | {
      notifications: LeagueNotification[]
      status: 'success'
    }
  | {
      error: string
      status: 'error'
    }

function Notifications() {
  const [state, setState] = useState<NotificationsState>({
    status: 'idle',
  })

  useEffect(() => {
    const controller = new AbortController()

    apiClient
      .getNotifications({
        signal: controller.signal,
      })
      .then((notifications) => {
        setState({
          notifications,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            error:
              error instanceof Error
                ? error.message
                : 'Notifications could not be loaded.',
            status: 'error',
          })
        }
      })

    return () => {
      controller.abort()
    }
  }, [])

  if (state.status === 'idle') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Notifications loading">
          <Loading />
        </section>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <section className="dashboard-state" aria-label="Notifications error">
          <p role="alert">{state.error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-shell">
      <PageHeader />
      <section className="experience-grid" aria-label="Notifications">
        {state.notifications.map((notification) => (
          <Link
            className={
              notification.priority === 'high'
                ? 'experience-card priority'
                : 'experience-card'
            }
            key={notification.id}
            to={notification.link || '/notifications'}
          >
            <span>{notification.type}</span>
            <h2>{notification.title}</h2>
            <p>{notification.body}</p>
            <small>{notification.timestamp}</small>
          </Link>
        ))}
      </section>
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="notifications-title">
      <p className="eyebrow">Notification Center</p>
      <h1 id="notifications-title">Live League Alerts</h1>
      <p>Records, streaks, movement, and newly reported games</p>
    </section>
  )
}

export default Notifications
