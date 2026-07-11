import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LeagueNotification } from '../services/api'
import { getNotifications, updateNotificationState } from '../services/lightApi'
import PortalIcon from './PortalIcon'

type NotificationState =
  | {
      status: 'idle'
    }
  | {
      notifications: LeagueNotification[]
      status: 'success'
    }
  | {
      status: 'error'
    }

let notificationCache: LeagueNotification[] | null = null
let notificationRequest: Promise<LeagueNotification[]> | null = null

function getSharedNotifications(forceRefresh = false) {
  if (!forceRefresh && notificationCache) {
    return Promise.resolve(notificationCache)
  }

  if (!forceRefresh && notificationRequest) {
    return notificationRequest
  }

  notificationRequest = getNotifications()
    .then((notifications) => {
      notificationCache = notifications
      return notifications
    })
    .finally(() => {
      notificationRequest = null
    })

  return notificationRequest
}

function invalidateNotificationCache() {
  notificationCache = null
  notificationRequest = null
}

function NotificationCenter({ compact = false }: { compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [state, setState] = useState<NotificationState>({
    status: 'idle',
  })

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let isActive = true

    void loadNotifications().then((nextState) => {
      if (isActive) {
        setState(nextState)
      }
    })

    return () => {
      isActive = false
    }
  }, [isOpen])

  async function loadNotifications(forceRefresh = false): Promise<NotificationState> {
    try {
      const notifications = await getSharedNotifications(forceRefresh)

      return {
          notifications,
          status: 'success',
      }
    } catch {
      return {
        status: 'error',
      }
    }
  }

  async function markAllRead() {
    if (state.status !== 'success') {
      return
    }

    const notifications = state.notifications

    setState({
      notifications: [],
      status: 'success',
    })

    try {
      invalidateNotificationCache()
      await updateNotificationState({
        notificationId: 'all',
        notificationIds: notifications.map((notification) => notification.id),
        state: 'read',
      })
      setState(await loadNotifications(true))
    } catch {
      setState({
        status: 'error',
      })
    }
  }

  const unreadCount = useMemo(() => {
    if (state.status !== 'success') {
      return 0
    }

    return state.notifications.filter((notification) => notification.unread)
      .length
  }, [state])
  const panelId = compact ? 'compact-notification-menu' : 'notification-menu'
  const triggerLabel =
    unreadCount > 0
      ? `Alerts, ${unreadCount} unread live notifications`
      : compact
        ? 'Open notifications'
        : 'Alerts, open notifications'

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div
      className={
        compact ? 'notification-center notification-center-compact' : 'notification-center'
      }
    >
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        className="notification-trigger"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {compact ? <PortalIcon name="bell" /> : <span>Alerts</span>}
        {unreadCount > 0 ? <b>{unreadCount}</b> : null}
      </button>

      {isOpen ? (
        <div
          aria-label="Notifications"
          className="notification-menu"
          id={panelId}
          role="dialog"
        >
          <div className="notification-menu-heading">
            <strong>Notification Center</strong>
            {unreadCount > 0 ? (
              <button onClick={() => void markAllRead()} type="button">
                Mark read
              </button>
            ) : null}
            <Link onClick={() => setIsOpen(false)} to="/notifications">
              View all
            </Link>
          </div>

          {state.status === 'idle' ? (
            <p>Loading live notifications...</p>
          ) : state.status === 'error' ? (
            <p>Notifications are unavailable.</p>
          ) : (
            <div className="notification-list">
              {state.notifications.slice(0, 6).map((notification) => (
                <Link
                  className={
                    notification.priority === 'high'
                      ? 'notification-item priority'
                      : 'notification-item'
                  }
                  key={notification.id}
                  onClick={() => setIsOpen(false)}
                  to={notification.link || '/notifications'}
                >
                  {notification.unread ? <span aria-hidden="true" /> : null}
                  <small>{notification.type}</small>
                  <strong>{notification.title}</strong>
                  <p>{notification.body}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default NotificationCenter
