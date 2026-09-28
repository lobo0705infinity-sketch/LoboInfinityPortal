import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LOBO_WORKSHOP_URL, loboWorkshopMapBySlug, loboWorkshopMaps } from '../../shared/lobo-workshop-maps.mjs'
import './MapLibrary.css'

type WorkshopMap = (typeof loboWorkshopMaps)[number]

const families = ['All maps', 'Standard layouts', 'Objective rooms', 'Corner layouts', 'League tables', 'Tournament tables']

export default function MapLibrary() {
  const { slug } = useParams()
  return slug ? <MapDetail map={loboWorkshopMapBySlug.get(slug)} /> : <MapIndex />
}

function MapIndex() {
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState('All maps')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleMaps = loboWorkshopMaps.filter((map) =>
    (family === 'All maps' || map.family === family) &&
    (!normalizedQuery || `${map.name} ${map.family}`.toLocaleLowerCase().includes(normalizedQuery)),
  )
  const featured = loboWorkshopMaps.find((map) => map.slug === '47-ll-map-16-the-dig-provisioning') ?? loboWorkshopMaps[0]

  return <main className="portal-shell lobo-maps-page" data-page="map-library">
    <header className="lobo-maps-hero">
      <div className="lobo-maps-hero-copy">
        <p className="eyebrow">Tabletop Simulator · Lobo Workshop</p>
        <h1>See the table before you deploy.</h1>
        <p>Explore {loboWorkshopMaps.length} Infinity tables from Lobo’s Workshop with real overhead and angled TTS captures. Find a layout, inspect its terrain, then open the Workshop item to play it.</p>
        <div className="lobo-maps-hero-actions">
          <a href="#browse-maps">Browse the maps <span aria-hidden="true">↓</span></a>
          <a href={LOBO_WORKSHOP_URL} rel="noopener noreferrer" target="_blank">Open Steam Workshop <span aria-hidden="true">↗</span></a>
        </div>
        <span className="lobo-maps-hero-count">47 maps <span aria-hidden="true">·</span> 94 real table views</span>
      </div>
      <Link aria-label={`Explore ${featured.name}`} className="lobo-maps-hero-image" to={`/maps/${featured.slug}`}>
        <img alt={`Angled Tabletop Simulator preview of ${featured.name}`} decoding="async" height="900" src={featured.angled} width="1600" />
        <span>Featured table <strong>{featured.name}</strong></span>
      </Link>
    </header>

    <section aria-labelledby="browse-maps-title" className="lobo-maps-browse" id="browse-maps">
      <div className="lobo-maps-section-heading">
        <div><p className="eyebrow">Choose your ground</p><h2 id="browse-maps-title">Map library</h2></div>
        <span aria-live="polite">{visibleMaps.length} of {loboWorkshopMaps.length} maps</span>
      </div>
      <div className="lobo-maps-controls">
        <label htmlFor="map-search">Search maps</label>
        <input autoComplete="off" id="map-search" onChange={(event) => setQuery(event.target.value)} placeholder="Name, mission, or layout…" type="search" value={query} />
        <div aria-label="Filter by layout" className="lobo-maps-filters" role="group">
          {families.map((option) => <button aria-pressed={family === option} key={option} onClick={() => setFamily(option)} type="button">{option}</button>)}
        </div>
      </div>
      {visibleMaps.length ? <div className="lobo-maps-grid">
        {visibleMaps.map((map) => <Link className="lobo-map-card" key={map.id} to={`/maps/${map.slug}`}>
          <img alt={`Overhead preview of ${map.name}`} decoding="async" height="900" loading="lazy" src={map.overhead} width="1600" />
          <span className="lobo-map-card-info"><small>{map.family} · Map {String(map.index).padStart(2, '0')}</small><strong>{map.name}</strong><span>Inspect table <span aria-hidden="true">→</span></span></span>
        </Link>)}
      </div> : <p className="lobo-maps-empty">No maps match that search. Try another name or layout.</p>}
    </section>
    <p className="lobo-maps-source-note">Captures show the Workshop tables as loaded in Tabletop Simulator on September 28, 2026. Check the current Workshop save and your mission rules before a game.</p>
  </main>
}

function MapDetail({ map }: { map: WorkshopMap | undefined }) {
  if (!map) return <main className="portal-shell lobo-maps-page"><section className="lobo-maps-empty"><h1>Map not found</h1><p>This table is not in the current Lobo Workshop collection.</p><Link to="/maps">Browse all maps</Link></section></main>

  const next = loboWorkshopMaps[map.index % loboWorkshopMaps.length]
  const previous = loboWorkshopMaps[(map.index - 2 + loboWorkshopMaps.length) % loboWorkshopMaps.length]
  const familyNote = map.family === 'Objective rooms'
    ? 'Check approaches to the central room, then agree which elevated surfaces and interior features are playable.'
    : map.family === 'Corner layouts'
      ? 'Study the diagonal lanes from each corner before choosing long range pieces and deployment positions.'
      : 'Use both views to compare central lanes, edge cover, raised terrain, and routes between the two sides.'

  return <main className="portal-shell lobo-maps-page lobo-map-detail" data-page="map-detail">
    <nav aria-label="Map navigation" className="lobo-map-detail-nav"><Link to="/maps">← All maps</Link><span>Map {String(map.index).padStart(2, '0')} / {loboWorkshopMaps.length}</span></nav>
    <header className="lobo-map-detail-heading">
      <div><p className="eyebrow">{map.family} · Lobo Workshop</p><h1>{map.name}</h1><p>Preview the full table from above and at an angle before loading it for a game.</p></div>
      <a href={LOBO_WORKSHOP_URL} rel="noopener noreferrer" target="_blank">Get the Workshop collection <span aria-hidden="true">↗</span></a>
    </header>
    <a aria-label={`Open full-size angled preview of ${map.name}`} className="lobo-map-detail-hero" href={map.angled} rel="noopener noreferrer" target="_blank"><img alt={`Angled Tabletop Simulator view of ${map.name}`} decoding="async" height="900" src={map.angled} width="1600" /><span>Angled view <span aria-hidden="true">↗</span></span></a>
    <section aria-labelledby="map-views-title" className="lobo-map-detail-views">
      <div className="lobo-maps-section-heading"><div><p className="eyebrow">Two ways to read the table</p><h2 id="map-views-title">Terrain previews</h2></div></div>
      <div className="lobo-map-detail-view-grid">
        <a href={map.overhead} rel="noopener noreferrer" target="_blank"><img alt={`Overhead Tabletop Simulator view of ${map.name}`} decoding="async" height="900" loading="lazy" src={map.overhead} width="1600" /><span><strong>Overhead</strong><small>Read the full layout and approach lanes</small></span></a>
        <a href={map.angled} rel="noopener noreferrer" target="_blank"><img alt={`Angled Tabletop Simulator view of ${map.name}`} decoding="async" height="900" loading="lazy" src={map.angled} width="1600" /><span><strong>Angled</strong><small>Check height, rooflines, and cover</small></span></a>
      </div>
    </section>
    <div className="lobo-map-detail-info">
      <section aria-labelledby="map-notes-title"><p className="eyebrow">Before deployment</p><h2 id="map-notes-title">Table checks</h2><p>{familyNote}</p><p>Confirm deployment zones, objective placement, terrain access, and line of fire with your opponent in TTS. The images are a preview; the loaded table and mission rules govern play.</p></section>
      <section aria-labelledby="map-reports-title"><p className="eyebrow">Played on this table</p><h2 id="map-reports-title">Battle reports</h2><p>No battle reports have been verified for this table yet.</p><Link to="/games">Browse all battle reports <span aria-hidden="true">→</span></Link></section>
    </div>
    {map.sourceNote ? <p className="lobo-maps-source-note">Workshop source note: {map.sourceNote}</p> : null}
    <nav aria-label="Adjacent maps" className="lobo-map-detail-adjacent"><Link to={`/maps/${previous.slug}`}><small>← Previous table</small><strong>{previous.name}</strong></Link><Link to={`/maps/${next.slug}`}><small>Next table →</small><strong>{next.name}</strong></Link></nav>
  </main>
}
