import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AuthProvider, { useAuth } from './auth/AuthContext'
import Breadcrumbs from './components/Breadcrumbs'
import DeepLinkRedirect from './components/DeepLinkRedirect'
import Header from './components/Header'
import Loading from './components/Loading'
import RouteMeta from './components/RouteMeta'
import Sidebar from './components/Sidebar'
import UserActivityTracker from './components/UserActivityTracker'
import { recordComponentMount } from './services/rumMetrics'
import './App.css'

const Analytics = lazy(() => import('./pages/Analytics'))
const ArmyLists = lazy(() => import('./pages/ArmyLists'))
const AutomationCenter = lazy(() => import('./pages/AutomationCenter'))
const CommissionerDashboard = lazy(() => import('./pages/CommissionerDashboard'))
const CommissionerNews = lazy(() => import('./pages/CommissionerNews'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Diagnostics = lazy(() => import('./pages/Diagnostics'))
const FactionProfile = lazy(() => import('./pages/FactionProfile'))
const Factions = lazy(() => import('./pages/Factions'))
const GameDetails = lazy(() => import('./pages/GameDetails'))
const HallOfFame = lazy(() => import('./pages/HallOfFame'))
const LeagueIntegrity = lazy(() => import('./pages/LeagueIntegrity'))
const MatchFinder = lazy(() => import('./pages/MatchFinder'))
const MissionProfile = lazy(() => import('./pages/MissionProfile'))
const Missions = lazy(() => import('./pages/Missions'))
const Notifications = lazy(() => import('./pages/Notifications'))
const MyProfile = lazy(() => import('./pages/MyProfile'))
const PlayerComparison = lazy(() => import('./pages/PlayerComparison'))
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'))
const Players = lazy(() => import('./pages/Players'))
const Rivalries = lazy(() => import('./pages/Rivalries'))
const Rules = lazy(() => import('./pages/Rules'))
const Standings = lazy(() => import('./pages/Standings'))
const StreamedGames = lazy(() => import('./pages/StreamedGames'))
const SubmitArmyList = lazy(() => import('./pages/SubmitArmyList'))
const Timeline = lazy(() => import('./pages/Timeline'))
const TeamTournament = lazy(() => import('./pages/TeamTournament'))

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthShell />
      </BrowserRouter>
    </AuthProvider>
  )
}

function AuthShell() {
  const auth = useAuth()

  if (auth.authState === 'initializing') {
    return <AuthInitializationScreen />
  }

  return (
    <div className="app-shell auth-ready">
      <RouteMeta />
      <UserActivityTracker />
      <Sidebar />
      <div className="app-main">
        <Header />
        <Breadcrumbs />
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
            <Route path="/hall-of-fame" element={<MeasuredRoute name="HallOfFame"><HallOfFame /></MeasuredRoute>} />
            <Route path="/news" element={<MeasuredRoute name="CommissionerNews"><CommissionerNews /></MeasuredRoute>} />
            <Route path="/news/:id" element={<DeepLinkRedirect target="news" />} />
            <Route path="/commissioner" element={<MeasuredRoute name="CommissionerDashboard"><CommissionerDashboard /></MeasuredRoute>} />
            <Route path="/diagnostics" element={<MeasuredRoute name="Diagnostics"><Diagnostics /></MeasuredRoute>} />
            <Route path="/automation" element={<MeasuredRoute name="AutomationCenter"><AutomationCenter /></MeasuredRoute>} />
            <Route path="/integrity" element={<MeasuredRoute name="LeagueIntegrity"><LeagueIntegrity /></MeasuredRoute>} />
            <Route path="/notifications" element={<MeasuredRoute name="Notifications"><Notifications /></MeasuredRoute>} />
            <Route path="/profile" element={<MeasuredRoute name="MyProfile"><MyProfile /></MeasuredRoute>} />
            <Route path="/achievement/:achievementId" element={<DeepLinkRedirect target="achievement" />} />
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
      </div>
    </div>
  )
}

function MeasuredRoute({ children, name }: { children: ReactNode; name: string }) {
  useEffect(() => {
    recordComponentMount(name)
  }, [name])

  return children
}

function AuthInitializationScreen() {
  const auth = useAuth()
  const [isDelayed, setIsDelayed] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsDelayed(true)
    }, 4500)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [])

  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="auth-initialization-screen"
    >
      <section className="auth-initialization-card">
        <p className="eyebrow">Lobo Command Network</p>
        <h1>
          <span>Authenticating</span>
          <span>Operative...</span>
        </h1>
        <div className="auth-initialization-meter" aria-hidden="true">
          <span />
        </div>
        <p>
          {isDelayed
            ? 'Still connecting. This is taking longer than expected.'
            : 'Checking League Credentials...'}
        </p>
        {isDelayed ? (
          <div className="auth-initialization-actions">
            <button onClick={() => void auth.refreshSession()} type="button">
              Retry
            </button>
            <button onClick={auth.signOut} type="button">
              Sign Out
            </button>
          </div>
        ) : null}
      </section>
    </main>
  )
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

export default App
