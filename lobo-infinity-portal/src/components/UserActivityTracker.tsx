import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { heartbeat, recordPageView } from '../services/lightApi'
import { normalizePageAnalyticsPath } from '../services/pageAnalytics'
import { recordRouteTransition } from '../services/rumMetrics'

let lastHandledNavigation: { key: string; pathname: string } | null = null

function UserActivityTracker() {
  const auth = useAuth()
  const location = useLocation()

  useEffect(() => {
    recordRouteTransition(`${location.pathname}${location.search}`)
  }, [location.pathname, location.search])

  useEffect(() => {
    const navigation = { key: location.key, pathname: location.pathname }
    const repeatsCurrentNavigation =
      lastHandledNavigation?.key === navigation.key ||
      lastHandledNavigation?.pathname === navigation.pathname

    if (repeatsCurrentNavigation) return

    const pageKey = normalizePageAnalyticsPath(location.pathname)
    if (!pageKey) {
      lastHandledNavigation = navigation
      return
    }

    if (auth.status === 'loading') return

    lastHandledNavigation = navigation
    if (auth.authenticated && auth.user.role === 'Commissioner') return

    recordPageView(pageKey)
  }, [auth.authenticated, auth.status, auth.user.role, location.key, location.pathname])

  useEffect(() => {
    if (!auth.authenticated) {
      return
    }

    if (location.pathname === '/commissioner' && !location.search) {
      return
    }

    const updateLastPage = () => {
      void heartbeat({
        lastPage: `${location.pathname}${location.search}`,
      })
    }

    const timeout = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(updateLastPage, { timeout: 5000 })
        return
      }

      updateLastPage()
    }, 10000)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [auth.authenticated, location.pathname, location.search])

  return null
}

export default UserActivityTracker
