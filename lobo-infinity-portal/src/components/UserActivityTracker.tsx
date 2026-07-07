import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiClient } from '../services/api'

function UserActivityTracker() {
  const auth = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!auth.authenticated) {
      return
    }

    const timeout = window.setTimeout(() => {
      void apiClient.updateProfile({
        lastPage: `${location.pathname}${location.search}`,
      })
    }, 10000)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [auth.authenticated, location.pathname, location.search])

  return null
}

export default UserActivityTracker
