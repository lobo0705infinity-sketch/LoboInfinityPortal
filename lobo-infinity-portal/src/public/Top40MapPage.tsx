import { Link } from 'react-router-dom'
import EventSectionTabs from '../components/EventSectionTabs'
import { TOP40_EVENT_ID } from './top40PreparationModel'

export default function Top40MapPage() {
  return <main className="portal-shell snapshot-public-page">
    <EventSectionTabs eventId={TOP40_EVENT_ID} items={['overview', 'registration', 'bracket', 'results', 'rules']}/>
    <section className="panel">
      <p className="eyebrow">Lobo’s Top 40 · Opening mission</p><h1>Lobo Tourney Map 1</h1>
      <h2>Asterion Research Campus</h2><p>Mission: Corporate Appropriation</p>
      <img src="/assets/maps/top40-map01/positions-be5440a2.png" alt="Diagram of saved terrain and objective positions for the current 76-object Map 1 bag" style={{width:'100%',maxWidth:1000,height:'auto'}}/>
      <p><a href="/assets/maps/top40-map01/Lobo-Top-40-Map-1-be5440a2.json" download>Download TTS saved object (JSON)</a> · <a href="/assets/maps/top40-map01/Lobo-Top-40-Map-1-Installer-be5440a2.zip" download>Download Windows installer (ZIP)</a></p>
      <p>Extract the installer ZIP and run INSTALL.cmd, or save the JSON in your Tabletop Simulator Saves/Saved Objects folder. In TTS, open Objects → Saved Objects and load “SET_Lobo’s Top 40 Map #1”. Use the SET table loader, then select Corporate Appropriation (ITS 18) with the mat’s Deployment and Mission controls.</p>
      <p>The current bag contains 76 objects, deployment controls, six mission tabs, thin deployment lines, and dashed exclusion boundaries. Confirm terrain rules and objective placement with the Organizer before playing.</p>
      <Link to="/event/lobos-top-40">Back to event preparation →</Link>
    </section>
  </main>
}
