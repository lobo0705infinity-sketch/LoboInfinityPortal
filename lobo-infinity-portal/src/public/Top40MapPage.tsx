import { Link, useParams } from 'react-router-dom'
import EventSectionTabs from '../components/EventSectionTabs'
import { TOP40_EVENT_ID } from './top40PreparationModel'
import { TOP40_ROUND_MAPS, TOP40_APPROVED_MAPS_INSTALLER } from '../../shared/top40-round-maps.mjs'

export default function Top40MapPage() {
  const { mapKey } = useParams()
  const map = TOP40_ROUND_MAPS.find(item => item.key === (mapKey || 'winners-1'))
  return <main className="portal-shell snapshot-public-page">
    <EventSectionTabs eventId={TOP40_EVENT_ID} items={['overview', 'registration', 'bracket', 'results', 'rules']}/>
    <section className="panel">
      <p className="eyebrow">Lobo’s Top 40 · Approved tournament map</p>
      {map ? <>
        <h1>{map.workshopLabel}</h1>
        <h2>{map.name}</h2>
        <p>Mission: {map.mission} · 300 points</p>
        <p><a href={map.download} download>Download this round’s TTS map bag (JSON)</a> · <a href={TOP40_APPROVED_MAPS_INSTALLER} download>Download the four approved maps installer (ZIP)</a></p>
        <p>Extract the installer ZIP and run Install.cmd. All four tournament bags and their four general mission copies install in the main Objects → Saved Objects folder.</p>
        <p>In the normal Infinity mod, use Clear Table, load “{map.workshopLabel}”, and drop the bag on the map deployment spot.</p>
        <p>The approved bag includes its mission reference, thin deployment guides, Booty and Metachemistry tables, DZ / DZ +4″ / DZ +8″ controls, and day/night backgrounds.</p>
      </> : <><h1>Map TBD</h1><p>The map for this round has not been announced.</p></>}
      <Link to="/event/lobos-top-40">Back to event preparation →</Link>
    </section>
  </main>
}
