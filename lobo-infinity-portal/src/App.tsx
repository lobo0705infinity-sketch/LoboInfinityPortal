import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AuthProvider from './auth/AuthContext'
import Breadcrumbs from './components/Breadcrumbs'
import DeepLinkRedirect from './components/DeepLinkRedirect'
import Header from './components/Header'
import Loading from './components/Loading'
import RouteMeta from './components/RouteMeta'
import Sidebar from './components/Sidebar'
import UserActivityTracker from './components/UserActivityTracker'
import './App.css'

const Analytics = lazy(() => import('./pages/Analytics'))
const ArmyLists = lazy(() => import('./pages/ArmyLists'))
const AutomationCenter = lazy(() => import('./pages/AutomationCenter'))
const CommissionerDashboard = lazy(() => import('./pages/CommissionerDashboard'))
const CommissionerNews = lazy(() => import('./pages/CommissionerNews'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const FactionProfile = lazy(() => import('./pages/FactionProfile'))
const Factions = lazy(() => import('./pages/Factions'))
const GameDetails = lazy(() => import('./pages/GameDetails'))
const HallOfFame = lazy(() => import('./pages/HallOfFame'))
const LeagueIntegrity = lazy(() => import('./pages/LeagueIntegrity'))
const MissionProfile = lazy(() => import('./pages/MissionProfile'))
const Missions = lazy(() => import('./pages/Missions'))
const Notifications = lazy(() => import('./pages/Notifications'))
const MyProfile = lazy(() => import('./pages/MyProfile'))
const PlayerComparison = lazy(() => import('./pages/PlayerComparison'))
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'))
const Players = lazy(() => import('./pages/Players'))
const Rules = lazy(() => import('./pages/Rules'))
const Standings = lazy(() => import('./pages/Standings'))
const StreamedGames = lazy(() => import('./pages/StreamedGames'))
const SubmitArmyList = lazy(() => import('./pages/SubmitArmyList'))
const Timeline = lazy(() => import('./pages/Timeline'))

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-shell">
          <RouteMeta />
          <UserActivityTracker />
          <Sidebar />
          <div className="app-main">
            <Header />
            <Breadcrumbs />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/standings" element={<Standings />} />
                <Route path="/players" element={<Players />} />
                <Route path="/compare" element={<PlayerComparison />} />
                <Route path="/players/:playerName" element={<PlayerProfile />} />
                <Route path="/player/:playerName" element={<PlayerProfile />} />
                <Route path="/career/:playerName" element={<DeepLinkRedirect target="career" />} />
                <Route path="/games/:id" element={<GameDetails />} />
                <Route path="/game/:id" element={<GameDetails />} />
                <Route path="/factions" element={<Factions />} />
                <Route path="/factions/:name" element={<FactionProfile />} />
                <Route path="/faction/:name" element={<FactionProfile />} />
                <Route path="/missions" element={<Missions />} />
                <Route path="/missions/:missionName" element={<MissionProfile />} />
                <Route path="/mission/:missionName" element={<MissionProfile />} />
                <Route path="/season/:seasonName" element={<DeepLinkRedirect target="season" />} />
                <Route path="/weekly-report" element={<DeepLinkRedirect target="weeklyReport" />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/hall-of-fame" element={<HallOfFame />} />
                <Route path="/news" element={<CommissionerNews />} />
                <Route path="/news/:id" element={<DeepLinkRedirect target="news" />} />
                <Route path="/commissioner" element={<CommissionerDashboard />} />
                <Route path="/automation" element={<AutomationCenter />} />
                <Route path="/integrity" element={<LeagueIntegrity />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile" element={<MyProfile />} />
                <Route path="/achievement/:achievementId" element={<DeepLinkRedirect target="achievement" />} />
                <Route path="/timeline" element={<Timeline />} />
                <Route path="/streams" element={<StreamedGames />} />
                <Route path="/stream/:id" element={<DeepLinkRedirect target="stream" />} />
                <Route path="/army-lists" element={<ArmyLists />} />
                <Route path="/army-list/:id" element={<DeepLinkRedirect target="armyLists" />} />
                <Route path="/army-lists/submit" element={<SubmitArmyList />} />
                <Route path="/rules" element={<Rules />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </BrowserRouter>
    </AuthProvider>
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
