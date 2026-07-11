import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  appendApplicationError,
  getBrowserSummary,
  getBuildVersion,
  getCurrentRoute,
  getInFlightApiRequests,
  type LoboApplicationError,
} from '../services/diagnostics'

type ApplicationErrorBoundaryProps = {
  children: ReactNode
  componentName: string
  resetKey?: string
}

type ApplicationErrorBoundaryState = {
  error: Error | null
  errorInfo: ErrorInfo | null
  errorRecord: LoboApplicationError | null
}

function ApplicationErrorBoundary(props: ApplicationErrorBoundaryProps) {
  const auth = useAuth()
  const location = useLocation()

  return (
    <ApplicationErrorBoundaryClass
      {...props}
      auth={{
        authenticated: auth.authenticated,
        code: auth.code,
        email: auth.user.email,
        player: auth.user.leaguePlayer,
        role: auth.user.role,
        stage: auth.stage,
        status: auth.status,
      }}
      pathname={`${location.pathname}${location.search}${location.hash}`}
      signOut={auth.signOut}
    />
  )
}

class ApplicationErrorBoundaryClass extends Component<
  ApplicationErrorBoundaryProps & {
    auth: LoboApplicationError['auth']
    pathname: string
    signOut: () => void
  },
  ApplicationErrorBoundaryState
> {
  state: ApplicationErrorBoundaryState = {
    error: null,
    errorInfo: null,
    errorRecord: null,
  }

  static getDerivedStateFromError(error: Error) {
    return {
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorRecord = this.buildErrorRecord(error, errorInfo)
    appendApplicationError(errorRecord)

    console.group('LOBO APPLICATION ERROR')
    console.error(error)
    console.info(errorRecord)
    console.groupEnd()

    this.setState({
      error,
      errorInfo,
      errorRecord,
    })
  }

  componentDidUpdate(previousProps: ApplicationErrorBoundaryClass['props']) {
    if (
      this.state.error &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.reset()
    }
  }

  reset = () => {
    this.setState({
      error: null,
      errorInfo: null,
      errorRecord: null,
    })
  }

  buildErrorRecord(error: Error, errorInfo: ErrorInfo): LoboApplicationError {
    const time = new Date().toISOString()
    const errorId = `lobo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

    return {
      auth: this.props.auth,
      browser: getBrowserSummary(),
      buildVersion: getBuildVersion(),
      component:
        getFailedComponentName(errorInfo.componentStack ?? '') ||
        this.props.componentName,
      componentStack: errorInfo.componentStack ?? '',
      errorId,
      inFlightRequests: getInFlightApiRequests(),
      jsStack: error.stack ?? '',
      lazyChunk: getLazyChunkName(error),
      message: error.message,
      name: error.name,
      pathname: this.props.pathname,
      route: getCurrentRoute(),
      time,
    }
  }

  render() {
    if (this.state.error) {
      const errorRecord =
        this.state.errorRecord ||
        this.buildErrorRecord(this.state.error, this.state.errorInfo ?? { componentStack: '' })

      return (
        <ApplicationErrorRecovery
          error={errorRecord}
          onRetry={this.reset}
          onSignOut={this.props.signOut}
        />
      )
    }

    return this.props.children
  }
}

function ApplicationErrorRecovery({
  error,
  onRetry,
  onSignOut,
}: {
  error: LoboApplicationError
  onRetry: () => void
  onSignOut: () => void
}) {
  const navigate = useNavigate()

  return (
    <main className="portal-shell">
      <section className="dashboard-state application-error-recovery" aria-live="polite">
        <p className="eyebrow">Application recovery</p>
        <h1>Something went wrong.</h1>
        <dl className="error-recovery-details">
          <div>
            <dt>Current route</dt>
            <dd>{error.route}</dd>
          </div>
          <div>
            <dt>Component</dt>
            <dd>{error.component}</dd>
          </div>
          <div>
            <dt>Error ID</dt>
            <dd>{error.errorId}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{error.time}</dd>
          </div>
        </dl>
        <div className="error-recovery-actions">
          <button type="button" onClick={onRetry}>
            Retry
          </button>
          <button type="button" onClick={() => navigate('/')}>
            Return to Dashboard
          </button>
          <button type="button" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </section>
    </main>
  )
}

function getFailedComponentName(componentStack: string) {
  const firstLine = componentStack
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) {
    return ''
  }

  return firstLine.replace(/^at\s+/, '')
}

function getLazyChunkName(error: Error) {
  const text = `${error.name} ${error.message} ${error.stack ?? ''}`
  const assetMatch = text.match(/assets\/([^)\s]+\.js)/)

  if (assetMatch) {
    return assetMatch[1]
  }

  if (/ChunkLoadError|Loading chunk|dynamically imported module/i.test(text)) {
    return 'unknown-lazy-chunk'
  }

  return ''
}

export default ApplicationErrorBoundary
