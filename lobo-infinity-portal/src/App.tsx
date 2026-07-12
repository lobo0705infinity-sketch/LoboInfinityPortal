import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  type ComponentType,
  type ReactNode,
} from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import AuthProvider from './auth/AuthContext'
import ApplicationErrorBoundary from './components/ApplicationErrorBoundary'
import Breadcrumbs from './components/Breadcrumbs'
import DeepLinkRedirect from './components/DeepLinkRedirect'
import Header from './components/Header'
import Loading from './components/Loading'
import RouteMeta from './components/RouteMeta'
import Sidebar from './components/Sidebar'
import UserActivityTracker from './components/UserActivityTracker'
import { SettingsProvider } from './contexts/SettingsContext'
import { recordRouteDiagnostic } from './services/diagnostics'
import { recordComponentMount } from './services/rumMetrics'
import './App.css'

const Analytics = lazyRoute('Analytics', () => import('./pages/Analytics'))
const ArmyLists = lazyRoute('ArmyLists', () => import('./pages/ArmyLists'))
const AutomationCenter = lazyRoute('AutomationCenter', () => import('./pages/AutomationCenter'))
const CommissionerDashboard = lazyRoute('CommissionerDashboard', () => import('./pages/CommissionerDashboard'))
const CommissionerEventManager = lazyRoute('CommissionerEventManager', () => import('./pages/CommissionerEventManager'))
const CommissionerNews = lazyRoute('CommissionerNews', () => import('./pages/CommissionerNews'))
const Dashboard = lazyRoute('Dashboard', () => import('./pages/Dashboard'))
const Diagnostics = lazyRoute('Diagnostics', () => import('./pages/Diagnostics'))
const EventHome = lazyRoute('EventHome', () => import('./pages/EventHome'))
const FactionProfile = lazyRoute('FactionProfile', () => import('./pages/FactionProfile'))
const Factions = lazyRoute('Factions', () => import('./pages/Factions'))
const GameDetails = lazyRoute('GameDetails', () => import('./pages/GameDetails'))
const HallOfFame = lazyRoute('HallOfFame', () => import('./pages/HallOfFame'))
const LeagueIntegrity = lazyRoute('LeagueIntegrity', () => import('./pages/LeagueIntegrity'))
const MatchFinder = lazyRoute('MatchFinder', () => import('./pages/MatchFinder'))
const MissionProfile = lazyRoute('MissionProfile', () => import('./pages/MissionProfile'))
const Missions = lazyRoute('Missions', () => import('./pages/Missions'))
const Notifications = lazyRoute('Notifications', () => import('./pages/Notifications'))
const MyProfile = lazyRoute('MyProfile', () => import('./pages/MyProfile'))
const PastEvents = lazyRoute('PastEvents', () => import('./pages/PastEvents'))
const PlayerComparison = lazyRoute('PlayerComparison', () => import('./pages/PlayerComparison'))
const PlayerProfile = lazyRoute('PlayerProfile', () => import('./pages/PlayerProfile'))
const Players = lazyRoute('Players', () => import('./pages/Players'))
const Rivalries = lazyRoute('Rivalries', () => import('./pages/Rivalries'))
const Rules = lazyRoute('Rules', () => import('./pages/Rules'))
const Schedule = lazyRoute('Schedule', () => import('./pages/Schedule'))
const Standings = lazyRoute('Standings', () => import('./pages/Standings'))
const StreamedGames = lazyRoute('StreamedGames', () => import('./pages/StreamedGames'))
const SubmitArmyList = lazyRoute('SubmitArmyList', () => import('./pages/SubmitArmyList'))
const SubmitResult = lazyRoute('SubmitResult', () => import('./pages/SubmitResult'))
const Timeline = lazyRoute('Timeline', () => import('./pages/Timeline'))
const TeamTournament = lazyRoute('TeamTournament', () => import('./pages/TeamTournament'))

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ApplicationErrorBoundary componentName="ApplicationShell">
          <AuthShell />
        </ApplicationErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  )
}

function AuthShell() {
  const location = useLocation()
  const routeKey = `${location.pathname}${location.search}${location.hash}`

  useEffect(() => {
    recordRouteDiagnostic({
      durationMs: 0,
      error: '',
      event: 'routeRequested',
      name: getRouteDiagnosticName(location.pathname),
      pathname: routeKey,
      timestamp: new Date().toISOString(),
    })
  }, [location.pathname, routeKey])

  return (
    <SettingsProvider>
      <div className="app-shell auth-ready">
        <RouteMeta />
        <UserActivityTracker />
        <Sidebar />
        <div className="app-main">
          <Header />
          <Breadcrumbs />
          <ApplicationErrorBoundary componentName="RouteContent" resetKey={routeKey}>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<MeasuredRoute name="Dashboard"><Dashboard /></MeasuredRoute>} />
                <Route path="/standings" element={<MeasuredRoute name="Standings"><Standings /></MeasuredRoute>} />
                <Route path="/players" element={<MeasuredRoute name="Players"><Players /></MeasuredRoute>} />
                <Route path="/rivalries" element={<MeasuredRoute name="Rivalries"><Rivalries /></MeasuredRoute>} />
                <Route path="/match-finder" element={<MeasuredRoute name="MatchFinder"><MatchFinder /></MeasuredRoute>} />
                <Route path="/compare" element={<MeasuredRoute name="PlayerComparison"><PlayerComparison /></MeasuredRoute>} />
                <Route path="/players/:playerName" element={<MeasuredRoute name="PlayerProfile"><PlayerProfile /></MeasuredRoute>} />
                <Route path="/player/:playerName" element={<MeasuredRoute name="PlayerProfile"><PlayerProfile /></MeasuredRoute>} />
                <Route path="/career/:playerName" element={<DeepLinkRedirect target="career" />} />
                <Route path="/games/:id" element={<MeasuredRoute name="GameDetails"><GameDetails /></MeasuredRoute>} />
                <Route path="/game/:id" element={<MeasuredRoute name="GameDetails"><GameDetails /></MeasuredRoute>} />
                <Route path="/factions" element={<MeasuredRoute name="Factions"><Factions /></MeasuredRoute>} />
                <Route path="/factions/:name" element={<MeasuredRoute name="FactionProfile"><FactionProfile /></MeasuredRoute>} />
                <Route path="/faction/:name" element={<MeasuredRoute name="FactionProfile"><FactionProfile /></MeasuredRoute>} />
                <Route path="/missions" element={<MeasuredRoute name="Missions"><Missions /></MeasuredRoute>} />
                <Route path="/missions/:missionName" element={<MeasuredRoute name="MissionProfile"><MissionProfile /></MeasuredRoute>} />
                <Route path="/mission/:missionName" element={<MeasuredRoute name="MissionProfile"><MissionProfile /></MeasuredRoute>} />
                <Route path="/season/:seasonName" element={<DeepLinkRedirect target="season" />} />
                <Route path="/weekly-report" element={<DeepLinkRedirect target="weeklyReport" />} />
                <Route path="/analytics" element={<MeasuredRoute name="Analytics"><Analytics /></MeasuredRoute>} />
                <Route path="/intelligence" element={<MeasuredRoute name="Intelligence"><Analytics /></MeasuredRoute>} />
                <Route path="/hall-of-fame" element={<MeasuredRoute name="HallOfFame"><HallOfFame /></MeasuredRoute>} />
                <Route path="/news" element={<MeasuredRoute name="CommissionerNews"><CommissionerNews /></MeasuredRoute>} />
                <Route path="/news/:id" element={<DeepLinkRedirect target="news" />} />
                <Route path="/events" element={<MeasuredRoute name="PastEvents"><PastEvents /></MeasuredRoute>} />
                <Route path="/event/:eventId" element={<MeasuredRoute name="EventHome"><EventHome /></MeasuredRoute>} />
                <Route path="/submit-game" element={<MeasuredRoute name="SubmitResult"><SubmitResult /></MeasuredRoute>} />
                <Route path="/event/:eventId/submit-result" element={<LegacySubmitResultRedirect />} />
                <Route path="/casual-result" element={<Navigate replace to="/submit-game?gameType=casual" />} />
                <Route path="/event/:eventId/tournament/:section" element={<MeasuredRoute name="TeamTournament"><TeamTournament /></MeasuredRoute>} />
                <Route path="/event/:eventId/tournament" element={<MeasuredRoute name="TeamTournament"><TeamTournament /></MeasuredRoute>} />
                <Route path="/event/:eventId/:section" element={<MeasuredRoute name="EventHome"><EventHome /></MeasuredRoute>} />
                <Route path="/commissioner" element={<MeasuredRoute name="CommissionerDashboard"><CommissionerDashboard /></MeasuredRoute>} />
                <Route path="/commissioner/event-manager" element={<MeasuredRoute name="CommissionerEventManager"><CommissionerEventManager /></MeasuredRoute>} />
                <Route path="/diagnostics" element={<MeasuredRoute name="Diagnostics"><Diagnostics /></MeasuredRoute>} />
                <Route path="/automation" element={<MeasuredRoute name="AutomationCenter"><AutomationCenter /></MeasuredRoute>} />
                <Route path="/integrity" element={<MeasuredRoute name="LeagueIntegrity"><LeagueIntegrity /></MeasuredRoute>} />
                <Route path="/notifications" element={<MeasuredRoute name="Notifications"><Notifications /></MeasuredRoute>} />
                <Route path="/profile" element={<MeasuredRoute name="MyProfile"><MyProfile /></MeasuredRoute>} />
                <Route path="/achievement/:achievementId" element={<DeepLinkRedirect target="achievement" />} />
                <Route path="/schedule" element={<MeasuredRoute name="Schedule"><Schedule /></MeasuredRoute>} />
                <Route path="/timeline" element={<MeasuredRoute name="Timeline"><Timeline /></MeasuredRoute>} />
                <Route path="/team-tournament" element={<MeasuredRoute name="TeamTournament"><TeamTournament /></MeasuredRoute>} />
                <Route path="/streams" element={<MeasuredRoute name="StreamedGames"><StreamedGames /></MeasuredRoute>} />
                <Route path="/stream/:id" element={<DeepLinkRedirect target="stream" />} />
                <Route path="/army-lists" element={<MeasuredRoute name="ArmyLists"><ArmyLists /></MeasuredRoute>} />
                <Route path="/army-list/:id" element={<DeepLinkRedirect target="armyLists" />} />
                <Route path="/army-lists/submit" element={<MeasuredRoute name="SubmitArmyList"><SubmitArmyList /></MeasuredRoute>} />
                <Route path="/rules" element={<MeasuredRoute name="Rules"><Rules /></MeasuredRoute>} />
              </Routes>
            </Suspense>
          </ApplicationErrorBoundary>
        </div>
      </div>
    </SettingsProvider>
  )
}

function LegacySubmitResultRedirect() {
  const { eventId = 'event-current-league' } = useParams()

  return (
    <Navigate
      replace
      to={`/submit-game?eventId=${encodeURIComponent(eventId)}&gameType=event`}
    />
  )
}

function MeasuredRoute({ children, name }: { children: ReactNode; name: string }) {
  const location = useLocation()
  const startedAtRef = useRef(0)
  const pathname = `${location.pathname}${location.search}${location.hash}`

  useEffect(() => {
    const startedAt = performance.now()
    startedAtRef.current = startedAt
    recordRouteDiagnostic({
      durationMs: Math.round(performance.now() - startedAt),
      error: '',
      event: 'firstRender',
      name,
      pathname,
      timestamp: new Date().toISOString(),
    })
    recordComponentMount(name)

    const frame = window.requestAnimationFrame(() => {
      recordRouteDiagnostic({
        durationMs: Math.round(performance.now() - startedAt),
        error: '',
        event: 'finishedRender',
        name,
        pathname,
        timestamp: new Date().toISOString(),
      })
    })

    return () => {
      window.cancelAnimationFrame(frame)
      recordRouteDiagnostic({
        durationMs: Math.round(performance.now() - startedAt),
        error: '',
        event: 'routeUnmount',
        name,
        pathname,
        timestamp: new Date().toISOString(),
      })
    }
  }, [name, pathname])

  return (
    <>
      <DiagnosticRenderFailure name={name} />
      {children}
    </>
  )
}

function DiagnosticRenderFailure({ name }: { name: string }) {
  const location = useLocation()
  if (new URLSearchParams(location.search).get('loboThrowRenderError') === name) {
    throw new Error(`Simulated render failure for ${name}`)
  }
  return null
}

function RouteLoading() {
  return (
    <main className="portal-shell">
      <section className="dashboard-state" aria-label="Page loading">
        <Loading />
      </section>
    </main>
  )
}

function lazyRoute<TProps>(
  name: string,
  loader: () => Promise<{ default: ComponentType<TProps> }>,
) {
  return lazy(async () => {
    const startedAt = performance.now()
    const pathname = typeof window === 'undefined'
      ? 'unknown'
      : `${window.location.pathname}${window.location.search}${window.location.hash}`

    recordRouteDiagnostic({
      durationMs: 0,
      error: '',
      event: 'chunkDownload',
      name,
      pathname,
      timestamp: new Date().toISOString(),
    })

    try {
      if (shouldSimulateChunkFailure(name)) {
        throw new Error(`Simulated chunk failure for ${name}`)
      }

      const module = await loader()
      recordRouteDiagnostic({
        durationMs: Math.round(performance.now() - startedAt),
        error: '',
        event: 'moduleEvaluated',
        name,
        pathname,
        timestamp: new Date().toISOString(),
      })

      return module
    } catch (error) {
      recordRouteDiagnostic({
        durationMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : String(error),
        event: 'chunkFailure',
        name,
        pathname,
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  })
}

function shouldSimulateChunkFailure(name: string) {
  if (typeof window === 'undefined') {
    return false
  }

  return new URLSearchParams(window.location.search)
    .get('loboSimulateChunkFailure') === name
}

function getRouteDiagnosticName(pathname: string) {
  if (pathname === '/') {
    return 'Dashboard'
  }

  return pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('/') || 'UnknownRoute'
}

export default App
