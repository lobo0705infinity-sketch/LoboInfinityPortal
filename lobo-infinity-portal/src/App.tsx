import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  type ComponentType,
  type ReactNode,
} from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigationType, useParams } from 'react-router-dom'
import AuthProvider, { useAuth } from './auth/AuthContext'
import ApplicationErrorBoundary from './components/ApplicationErrorBoundary'
import Breadcrumbs from './components/Breadcrumbs'
import DeepLinkRedirect from './components/DeepLinkRedirect'
import Header from './components/Header'
import CommissionerLogin from './components/CommissionerLogin'
import CommissionerLauncher from './components/CommissionerLauncher'
import GlobalFooter from './components/GlobalFooter'
import Loading from './components/Loading'
import MobileBottomNavigation from './components/MobileBottomNavigation'
import RouteMeta from './components/RouteMeta'
import Sidebar from './components/Sidebar'
import UserActivityTracker from './components/UserActivityTracker'
import { SettingsProvider } from './contexts/SettingsContext'
import { recordRouteDiagnostic } from './services/diagnostics'
import { recordComponentMount } from './services/rumMetrics'
import './App.css'

const Analytics = lazyRoute('Analytics', () => import('./pages/Analytics'))
const ArmyIntelligence = lazyRoute('ArmyIntelligence', () => import('./pages/ArmyIntelligence'))
const ArmyLists = lazyRoute('ArmyLists', () => import('./pages/ArmyLists'))
const ArmyCodeValidation = lazyRoute('ArmyCodeValidation', () => import('./pages/ArmyCodeValidation'))
const AutomationCenter = lazyRoute('AutomationCenter', () => import('./pages/AutomationCenter'))
const CommunityManager = lazyRoute('CommunityManager', () => import('./pages/CommunityManager'))
const CommissionerArmyListLinks = lazyRoute('CommissionerArmyListLinks', () => import('./pages/CommissionerArmyListLinks'))
const CommissionerDashboard = lazyRoute('CommissionerDashboard', () => import('./pages/CommissionerDashboard'))
const CommissionerEvents = lazyRoute('CommissionerEvents', () => import('./pages/CommissionerEvents'))
const CommissionerGameCenter = lazyRoute('CommissionerGameCenter', () => import('./pages/CommissionerGameCenter'))
const CommissionerGameScoreCorrection = lazyRoute('CommissionerGameScoreCorrection', () => import('./pages/CommissionerGameScoreCorrection'))
const CommissionerPlayers = lazyRoute('CommissionerPlayers', () => import('./pages/CommissionerPlayers'))
const CommissionerSystem = lazyRoute('CommissionerSystem', () => import('./pages/CommissionerSystem'))
const Dashboard = lazyRoute('Dashboard', () => import('./pages/Dashboard'))
const Diagnostics = lazyRoute('Diagnostics', () => import('./pages/Diagnostics'))
const EventHome = lazyRoute('EventHome', () => import('./pages/EventHome'))
const FactionProfile = lazyRoute('FactionProfile', () => import('./pages/FactionProfile'))
const Factions = lazyRoute('Factions', () => import('./pages/Factions'))
const GameDetails = lazyRoute('GameDetails', () => import('./pages/GameDetails'))
const HallOfFame = lazyRoute('HallOfFame', () => import('./pages/HallOfFame'))
const LeagueIntegrity = lazyRoute('LeagueIntegrity', () => import('./pages/LeagueIntegrity'))
const LeagueOperations = lazyRoute('LeagueOperations', () => import('./pages/LeagueOperations'))
const MissionProfile = lazyRoute('MissionProfile', () => import('./pages/MissionProfile'))
const Missions = lazyRoute('Missions', () => import('./pages/Missions'))
const MobileMenu = lazyRoute('MobileMenu', () => import('./pages/MobileMenu'))
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
const TeamTournament = lazyRoute('TeamTournament', () => import('./pages/TeamTournament'))
const SnapshotPublicApp = lazyRoute('SnapshotPublicApp', () => import('./public/SnapshotPublicApp'))

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
  const auth = useAuth()
  const location = useLocation()
  const routeKey = `${location.pathname}${location.search}${location.hash}`
  const commissionerRoute =
    location.pathname.startsWith('/commissioner') ||
    location.pathname === '/diagnostics' ||
    location.pathname === '/integrity' ||
    location.pathname === '/automation'

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
    <SettingsProvider enabled={!commissionerRoute}>
      <div className="app-shell auth-ready">
        <RouteMeta />
        <UserActivityTracker />
        <RouteScrollReset />
        <Sidebar />
        <div className="app-main">
          <Header />
          <Breadcrumbs />
          <ApplicationErrorBoundary componentName="RouteContent" resetKey={routeKey}>
            <Suspense fallback={<RouteLoading />}>
              {!commissionerRoute ? <SnapshotPublicApp /> : !auth.authenticated ? <CommissionerLogin /> : <Routes>
                <Route path="/" element={<MeasuredRoute name="Dashboard"><Dashboard /></MeasuredRoute>} />
                <Route path="/standings" element={<MeasuredRoute name="Standings"><Standings /></MeasuredRoute>} />
                <Route path="/league-operations" element={<MeasuredRoute name="LeagueOperations"><LeagueOperations /></MeasuredRoute>} />
                <Route path="/community" element={<MeasuredRoute name="Players"><Players /></MeasuredRoute>} />
                <Route path="/players" element={<MeasuredRoute name="Players"><Players /></MeasuredRoute>} />
                <Route path="/rivalries" element={<MeasuredRoute name="Rivalries"><Rivalries /></MeasuredRoute>} />
                <Route path="/match-finder" element={<Navigate replace to="/event/event-current-league" />} />
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
                <Route path="/menu" element={<MeasuredRoute name="MobileMenu"><MobileMenu /></MeasuredRoute>} />
                <Route path="/missions/:missionName" element={<MeasuredRoute name="MissionProfile"><MissionProfile /></MeasuredRoute>} />
                <Route path="/mission/:missionName" element={<MeasuredRoute name="MissionProfile"><MissionProfile /></MeasuredRoute>} />
                <Route path="/season/:seasonName" element={<DeepLinkRedirect target="season" />} />
                <Route path="/weekly-report" element={<DeepLinkRedirect target="weeklyReport" />} />
                <Route path="/analytics" element={<MeasuredRoute name="Analytics"><Analytics /></MeasuredRoute>} />
                <Route path="/dashboard" element={<MeasuredRoute name="Dashboard"><Dashboard /></MeasuredRoute>} />
                <Route path="/intelligence" element={<Navigate replace to="/army-intelligence" />} />
                <Route path="/army-intelligence" element={<MeasuredRoute name="ArmyIntelligence"><ArmyIntelligence /></MeasuredRoute>} />
                <Route path="/hall-of-fame" element={<MeasuredRoute name="HallOfFame"><HallOfFame /></MeasuredRoute>} />
                <Route path="/news" element={<Navigate replace to="/dashboard" />} />
                <Route path="/news/:id" element={<Navigate replace to="/dashboard" />} />
                <Route path="/events" element={<MeasuredRoute name="PastEvents"><PastEvents /></MeasuredRoute>} />
                <Route path="/event/:eventId" element={<MeasuredRoute name="EventHome"><EventHome /></MeasuredRoute>} />
                <Route path="/submit-game" element={<MeasuredRoute name="SubmitResult"><SubmitResult /></MeasuredRoute>} />
                <Route path="/event/:eventId/submit-result" element={<LegacySubmitResultRedirect />} />
                <Route path="/casual-result" element={<Navigate replace to="/submit-game?gameType=casual" />} />
                <Route path="/event/:eventId/tournament/:section" element={<MeasuredRoute name="TeamTournament"><TeamTournament /></MeasuredRoute>} />
                <Route path="/event/:eventId/tournament" element={<MeasuredRoute name="TeamTournament"><TeamTournament /></MeasuredRoute>} />
                <Route path="/event/:eventId/:section" element={<MeasuredRoute name="EventHome"><EventHome /></MeasuredRoute>} />
                <Route path="/commissioner" element={<MeasuredRoute name="CommissionerDashboard"><CommissionerDashboard /></MeasuredRoute>} />
                <Route path="/commissioner/army-list-links" element={<MeasuredRoute name="CommissionerArmyListLinks"><CommissionerArmyListLinks /></MeasuredRoute>} />
                <Route path="/commissioner/game-center" element={<CommissionerLauncher
                  cards={[
                    { title: 'Game Center', description: 'Search and inspect canonical games.', to: '/commissioner/game-center/browse' },
                    { title: 'Score Corrections', description: 'Open Game Center and choose a game for the canonical score-correction workflow.', to: '/commissioner/game-center/browse' },
                    { title: 'Historical Army List Links', description: 'Correct historical game and Army List links.', to: '/commissioner/army-list-links' },
                    { title: 'Army Code Validation', description: 'Review Army List code exceptions.', to: '/commissioner/army-code-validation' },
                  ]}
                  description="Canonical game and Army List administration."
                  title="Games & Army Lists"
                />} />
                <Route path="/commissioner/game-center/browse" element={<MeasuredRoute name="CommissionerGameCenter"><CommissionerGameCenter /></MeasuredRoute>} />
                <Route path="/commissioner/game-center/:gameId/score-correction" element={<MeasuredRoute name="CommissionerGameScoreCorrection"><CommissionerGameScoreCorrection /></MeasuredRoute>} />
                <Route path="/commissioner/events" element={<CommissionerLauncher
                  cards={[
                    { title: 'Event Manager', description: 'Event setup, registration, participants, lifecycle, and archive.', to: '/commissioner/events/manage' },
                    { title: 'Scheduling Monitor', description: 'Outstanding League scheduling and Commissioner oversight.', to: '/commissioner?section=scheduling' },
                    { title: 'Portal Settings', description: 'Retained operational portal settings.', to: '/commissioner?section=settings' },
                    { title: 'League Mission & Map', description: 'Weekly and current League mission and map administration.', to: '/commissioner/events/manage' },
                    { title: 'Top 40 Operations', description: 'Seeding, bracket generation, missions, deadlines, and forfeits.', to: '/commissioner/events/manage' },
                    { title: 'Team Tournament Operations', description: 'Teams, pairings, and required tournament administration.', to: '/commissioner/events/manage' },
                  ]}
                  description="Event administration and tournament operations."
                  title="Events"
                />} />
                <Route path="/commissioner/events/manage" element={<MeasuredRoute name="CommissionerEvents"><CommissionerEvents /></MeasuredRoute>} />
                <Route path="/commissioner/event-manager" element={<Navigate replace to="/commissioner/events/manage" />} />
                <Route path="/commissioner/players" element={<CommissionerLauncher
                  cards={[
                    { title: 'Identity & Access', description: 'Account enable/disable, identity mapping, and repair.', to: '/commissioner?section=users' },
                    { title: 'Player Corrections', description: 'Display-name correction and safe deletion of accidental or test players.', to: '/commissioner/players/corrections' },
                  ]}
                  description="Player identity, access, and canonical corrections."
                  title="Players & Access"
                />} />
                <Route path="/commissioner/players/corrections" element={<MeasuredRoute name="CommissionerPlayers"><CommissionerPlayers /></MeasuredRoute>} />
                <Route path="/commissioner/community-manager" element={<CommissionerLauncher
                  cards={[
                    { title: 'Streams Manager', description: 'Create, edit, and delete canonical Stream records.', to: '/commissioner/community-manager/streams' },
                    { title: 'Discord & Automation', description: 'Discord settings, announcements, automation rules and templates, and queue recovery.', to: '/commissioner/automation' },
                  ]}
                  description="Community communications and automation administration."
                  title="Community"
                />} />
                <Route path="/commissioner/community-manager/streams" element={<MeasuredRoute name="CommunityManager"><CommunityManager /></MeasuredRoute>} />
                <Route path="/commissioner/system" element={<CommissionerLauncher
                  cards={[
                    { title: 'Integrity', description: 'League health, audit findings, report export, and approved emergency repairs.', to: '/commissioner/system/audit' },
                    { title: 'Operations Engine', description: 'Scheduled work, failures, queue state, and recent operational history.', to: '/commissioner?section=operations' },
                    { title: 'Automation Queue', description: 'Failed and retry automation recovery.', to: '/commissioner/automation' },
                    { title: 'Army Intelligence Recovery', description: 'Break-glass manual Army Intelligence refresh.', to: '/commissioner/system/recovery' },
                  ]}
                  description="System status and exceptional recovery tools."
                  title="System & Recovery"
                />} />
                <Route path="/commissioner/system/recovery" element={<MeasuredRoute name="CommissionerSystem"><CommissionerSystem /></MeasuredRoute>} />
                <Route path="/commissioner/army-code-validation" element={<MeasuredRoute name="ArmyCodeValidation"><ArmyCodeValidation /></MeasuredRoute>} />
                <Route path="/commissioner/system/diagnostics" element={<MeasuredRoute name="Diagnostics"><Diagnostics /></MeasuredRoute>} />
                <Route path="/commissioner/system/audit" element={<MeasuredRoute name="LeagueIntegrity"><LeagueIntegrity /></MeasuredRoute>} />
                <Route path="/commissioner/automation" element={<MeasuredRoute name="AutomationCenter"><AutomationCenter /></MeasuredRoute>} />
                <Route path="/diagnostics" element={<MeasuredRoute name="Diagnostics"><Diagnostics /></MeasuredRoute>} />
                <Route path="/automation" element={<Navigate replace to="/commissioner/automation" />} />
                <Route path="/integrity" element={<MeasuredRoute name="LeagueIntegrity"><LeagueIntegrity /></MeasuredRoute>} />
                <Route path="/alerts" element={<Navigate replace to="/dashboard" />} />
                <Route path="/notifications" element={<Navigate replace to="/dashboard" />} />
                <Route path="/profile" element={<Navigate replace to="/players" />} />
                <Route path="/achievement/:achievementId" element={<DeepLinkRedirect target="achievement" />} />
                <Route path="/schedule" element={<MeasuredRoute name="Schedule"><Schedule /></MeasuredRoute>} />
                <Route path="/timeline" element={<Navigate replace to="/dashboard" />} />
                <Route path="/team-tournament" element={<MeasuredRoute name="TeamTournament"><TeamTournament /></MeasuredRoute>} />
                <Route path="/streams" element={<MeasuredRoute name="StreamedGames"><StreamedGames /></MeasuredRoute>} />
                <Route path="/stream/:id" element={<DeepLinkRedirect target="stream" />} />
                <Route path="/army-lists" element={<MeasuredRoute name="ArmyLists"><ArmyLists /></MeasuredRoute>} />
                <Route path="/army-list/:id" element={<DeepLinkRedirect target="armyLists" />} />
                <Route path="/army-lists/submit" element={<MeasuredRoute name="SubmitArmyList"><SubmitArmyList /></MeasuredRoute>} />
                <Route path="/rules" element={<MeasuredRoute name="Rules"><Rules /></MeasuredRoute>} />
              </Routes>}
            </Suspense>
          </ApplicationErrorBoundary>
          <GlobalFooter />
        </div>
        <MobileBottomNavigation />
      </div>
    </SettingsProvider>
  )
}

function RouteScrollReset() {
  const location = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType === 'POP') {
      return
    }

    window.scrollTo({
      left: 0,
      top: 0,
    })
  }, [location.pathname, location.search, navigationType])

  return null
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
