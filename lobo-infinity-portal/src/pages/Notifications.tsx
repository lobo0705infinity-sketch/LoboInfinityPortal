import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Skeleton from '../components/Skeleton'
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

  async function loadNotifications(signal?: AbortSignal) {
    try {
      const notifications = await apiClient.getNotifications({ signal })
      setState({
        notifications,
        status: 'success',
      })
    } catch (error) {
      if (!signal?.aborted) {
        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Notifications could not be loaded.',
          status: 'error',
        })
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    void Promise.resolve().then(() => loadNotifications(controller.signal))

    return () => {
      controller.abort()
    }
  }, [])

  async function updateNotification(
    notificationId: string,
    status: 'dismissed' | 'read',
  ) {
    if (state.status !== 'success') {
      return
    }

    const previousNotifications = state.notifications

    setState({
      notifications: previousNotifications.filter(
        (notification) => notification.id !== notificationId,
      ),
      status: 'success',
    })

    try {
      await apiClient.updateNotificationState({
        notificationId,
        state: status,
      })
      await loadNotifications()
    } catch (error) {
      setState({
        error:
          error instanceof Error
            ? error.message
            : 'Notifications could not be updated.',
        status: 'error',
      })
    }
  }

  async function markAllRead(notifications: LeagueNotification[]) {
    setState({
      notifications: [],
      status: 'success',
    })

    try {
      await apiClient.updateNotificationState({
        notificationId: 'all',
        notificationIds: notifications.map((notification) => notification.id),
        state: 'read',
      })
      await loadNotifications()
    } catch (error) {
      setState({
        error:
          error instanceof Error
            ? error.message
            : 'Notifications could not be updated.',
        status: 'error',
      })
    }
  }

  if (state.status === 'idle') {
    return (
      <main className="portal-shell">
        <PageHeader />
        <div className="notification-page-actions">
          <button disabled type="button">
            Mark All Read
          </button>
        </div>
        <section className="experience-grid" aria-label="Notifications loading">
          <Skeleton label="Notifications loading" rows={5} />
          <Skeleton label="Notifications loading" rows={5} />
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
      <div className="notification-page-actions">
        <button
          onClick={() => void markAllRead(state.notifications)}
          type="button"
        >
          Mark All Read
        </button>
      </div>
      <section className="experience-grid" aria-label="Notifications">
        {state.notifications.map((notification) => (
          <article
            className={
              notification.priority === 'high'
                ? 'experience-card priority'
                : 'experience-card'
            }
            key={notification.id}
          >
            <Link to={notification.link || '/notifications'}>
              {notification.unread ? <span>Unread</span> : <span>Read</span>}
              <h2>{notification.title}</h2>
              <p>{notification.body}</p>
              <small>{notification.timestamp}</small>
            </Link>
            <div className="notification-actions">
              {notification.unread ? (
                <button
                  onClick={() => void updateNotification(notification.id, 'read')}
                  type="button"
                >
                  Mark Read
                </button>
              ) : null}
              <button
                onClick={() =>
                  void updateNotification(notification.id, 'dismissed')
                }
                type="button"
              >
                Dismiss
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}

function PageHeader() {
  return (
    <section className="page-header" aria-labelledby="notifications-title">
      <p className="eyebrow">Notification Center</p>
      <h1 id="notifications-title">Portal Alerts</h1>
      <p>Community alerts, records, streaks, movement, and newly reported games</p>
    </section>
  )
}

export default Notifications
