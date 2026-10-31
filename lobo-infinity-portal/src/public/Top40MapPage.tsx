import { Link } from 'react-router-dom'
import EventSectionTabs from '../components/EventSectionTabs'
import { TOP40_EVENT_ID } from './top40PreparationModel'

export default function Top40MapPage() {
  return <main className="portal-shell snapshot-public-page">
    <EventSectionTabs eventId={TOP40_EVENT_ID} items={['overview', 'registration', 'bracket', 'results', 'rules']}/>
    <section className="panel">
      <p className="eyebrow">Lobo’s Top 40 · Opening mission</p><h1>Lobo Tourney Map 1</h1>
      <h2>Asterion Research Campus</h2><p>Mission: Corporate Appropriation</p>
      <img src="/assets/maps/top40-map01/preview.png" alt="Overhead view of Lobo Tourney Map 1, Asterion Research Campus" style={{width:'100%',maxWidth:1000,height:'auto'}}/>
      <p><a href="/assets/maps/top40-map01/Lobo-Top-40-Map-01.json" download>Download TTS saved object (JSON)</a> · <a href="/assets/maps/top40-map01/Lobo-Top-40-Map-01.png" download>Download saved-object thumbnail (PNG)</a></p>
      <p>Save both files to your Tabletop Simulator Saves/Saved Objects folder. In TTS, open Objects → Saved Objects and load “SET_Lobo’s Top 40 Map#1”.</p>
      <p>This is the saved Map 1 layout: 58 objects and 15 buildings. Confirm terrain rules and objective placement with the Organizer before playing.</p>
      <Link to="/event/lobos-top-40">Back to event preparation →</Link>
    </section>
  </main>
}
