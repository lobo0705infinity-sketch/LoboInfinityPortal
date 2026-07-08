import { useEffect, useState } from 'react'
import { dataProvider } from '../services/data'
import type { DashboardData } from '../types/dashboard'

type DashboardState = {
  data: DashboardData | null
  error: string | null
  isLoading: boolean
}

function useDashboard(): DashboardState {
  const [state, setState] = useState<DashboardState>({
    data: null,
    error: null,
    isLoading: true,
  })

  useEffect(() => {
    const controller = new AbortController()

    async function loadDashboard() {
      try {
        const data = await dataProvider.dashboard.getDashboard({
          signal: controller.signal,
        })

        setState({
          data,
          error: null,
          isLoading: false,
        })
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            data: null,
            error:
              error instanceof Error
                ? error.message
                : 'Dashboard data could not be loaded.',
            isLoading: false,
          })
        }
      }
    }

    void loadDashboard()

    return () => {
      controller.abort()
    }
  }, [])

  return state
}

export default useDashboard
