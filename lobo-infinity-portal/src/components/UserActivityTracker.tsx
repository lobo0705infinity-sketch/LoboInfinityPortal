import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { updateProfile } from '../services/lightApi'
import { recordRouteTransition } from '../services/rumMetrics'

function UserActivityTracker() {
  const auth = useAuth()
  const location = useLocation()

  useEffect(() => {
    recordRouteTransition(`${location.pathname}${location.search}`)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!auth.authenticated) {
      return
    }

    const updateLastPage = () => {
      void updateProfile({
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
