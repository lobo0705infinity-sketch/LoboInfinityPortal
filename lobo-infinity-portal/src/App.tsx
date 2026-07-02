import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Breadcrumbs from './components/Breadcrumbs'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Analytics from './pages/Analytics'
import ArmyLists from './pages/ArmyLists'
import CommissionerDashboard from './pages/CommissionerDashboard'
import CommissionerNews from './pages/CommissionerNews'
import Dashboard from './pages/Dashboard'
import FactionProfile from './pages/FactionProfile'
import Factions from './pages/Factions'
import GameDetails from './pages/GameDetails'
import HallOfFame from './pages/HallOfFame'
import MissionProfile from './pages/MissionProfile'
import Missions from './pages/Missions'
import Notifications from './pages/Notifications'
import PlayerComparison from './pages/PlayerComparison'
import PlayerProfile from './pages/PlayerProfile'
import Players from './pages/Players'
import Rules from './pages/Rules'
import Standings from './pages/Standings'
import StreamedGames from './pages/StreamedGames'
import SubmitArmyList from './pages/SubmitArmyList'
import Timeline from './pages/Timeline'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <div className="app-main">
          <Header />
          <Breadcrumbs />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/standings" element={<Standings />} />
            <Route path="/players" element={<Players />} />
            <Route path="/compare" element={<PlayerComparison />} />
            <Route path="/players/:playerName" element={<PlayerProfile />} />
            <Route path="/games/:id" element={<GameDetails />} />
            <Route path="/factions" element={<Factions />} />
            <Route path="/factions/:name" element={<FactionProfile />} />
            <Route path="/missions" element={<Missions />} />
            <Route path="/missions/:missionName" element={<MissionProfile />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/hall-of-fame" element={<HallOfFame />} />
            <Route path="/news" element={<CommissionerNews />} />
            <Route path="/commissioner" element={<CommissionerDashboard />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/streams" element={<StreamedGames />} />
            <Route path="/army-lists" element={<ArmyLists />} />
            <Route path="/army-lists/submit" element={<SubmitArmyList />} />
            <Route path="/rules" element={<Rules />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
