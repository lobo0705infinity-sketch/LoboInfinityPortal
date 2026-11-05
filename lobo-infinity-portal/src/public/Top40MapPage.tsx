import { Link, useParams } from 'react-router-dom'
import EventSectionTabs from '../components/EventSectionTabs'
import { TOP40_EVENT_ID } from './top40PreparationModel'
import { TOP40_MAPS, TOP40_APPROVED_MAPS_INSTALLER } from '../../shared/top40-round-maps.mjs'
import { LOBO_WORKSHOP_URL } from '../../shared/lobo-workshop-maps.mjs'
import './MapLibrary.css'

export default function Top40MapPage() {
  const { mapKey } = useParams()
  const map = TOP40_MAPS.find(item => item.key === (mapKey || 'winners-1'))
  return <main className="portal-shell snapshot-public-page">
    <EventSectionTabs eventId={TOP40_EVENT_ID} items={['overview', 'registration', 'bracket', 'results', 'rules']}/>
    <section className="panel">
      <p className="eyebrow">Lobo’s Top 40 · Approved map collection</p>
      {map ? <>
        <h1>{map.workshopLabel}</h1>
        <h2>{map.name}</h2>
        <p>Mission: {map.mission} · 300 points</p>
        {map.download ? <>
          <p><a href={map.download} download>Download this TTS map bag (JSON)</a> · <a href={TOP40_APPROVED_MAPS_INSTALLER} download>Download the current map update installer (ZIP)</a></p>
          <p>Extract the installer ZIP and run Install.cmd. The Workshop update installs map bags in the main Objects → Saved Objects folder.</p>
          <p>To update the existing Workshop collection, load “Lobo’s Infinity Maps - Verdant and Neon FINAL”, then choose Update Workshop for item 3719263238.</p>
        </> : <p><a href={LOBO_WORKSHOP_URL} target="_blank" rel="noopener noreferrer">Open the Steam Workshop collection ↗</a></p>}
        {map.angled && <a className="lobo-map-detail-hero" href={map.angled} target="_blank" rel="noopener noreferrer"><img src={map.angled} alt={`Rendered terrain preview of ${map.name}`} width="1600" height="1400"/><span>Approved terrain preview ↗</span></a>}
        {(map.overhead || map.generalHref) && <p>{map.overhead && <a href={map.overhead} target="_blank" rel="noopener noreferrer">View overhead terrain preview ↗</a>}{map.overhead && map.generalHref && ' · '}{map.generalHref && <Link to={map.generalHref}>Matching general-pool map →</Link>}</p>}
        <p>In the normal Infinity mod, use Clear Table, load “{map.workshopLabel}”, and drop the bag on the map deployment spot.</p>
        {map.download && <p>The approved bag includes its mission reference, bold deployment guides, Booty and Metachemistry tables, DZ / DZ +4″ / DZ +8″ controls, and day/night backgrounds.</p>}
      </> : <><h1>Map TBD</h1><p>The map for this round has not been announced.</p></>}
      <Link to="/event/lobos-top-40">Back to event preparation →</Link>
    </section>
  </main>
}

