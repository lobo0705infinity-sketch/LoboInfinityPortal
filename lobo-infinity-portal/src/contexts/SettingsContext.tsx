/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { PortalSettings } from '../services/api'
import { getSettings } from '../services/lightApi'

type SettingsContextValue = {
  error: string | null
  settings: PortalSettings | null
  status: 'loading' | 'success' | 'error'
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsContextValue>({
    error: null,
    settings: null,
    status: 'loading',
  })

  useEffect(() => {
    let isActive = true

    getSettings()
      .then((settings) => {
        if (!isActive) {
          return
        }

        setState({
          error: null,
          settings,
          status: 'success',
        })
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : 'Settings could not be loaded.',
          settings: null,
          status: 'error',
        })
      })

    return () => {
      isActive = false
    }
  }, [])

  const value = useMemo(
    () => state,
    [state],
  )

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)

  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider.')
  }

  return context
}
