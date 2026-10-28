import { Link } from 'react-router-dom'
import AuroraGames from './AuroraGames'
import './AuroraCampaign.css'
export default function AuroraReportingTest() {
  return <main className="portal-shell aurora-campaign">
    <header className="page-header"><p className="eyebrow">Commissioner · Practice</p><h1>Test campaign reporting</h1><p>Try the real reporting form and opponent confirmation before opening Turn 1.</p><Link to="/commissioner/aurora-vii">Back to campaign administration →</Link></header>
    <AuroraGames submit practice/>
  </main>
}
