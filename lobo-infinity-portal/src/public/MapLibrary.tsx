import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LOBO_WORKSHOP_URL, LOBO_WORKSHOP_DOWNLOAD_URL, archivedLoboWorkshopMaps, loboWorkshopMapBySlug, loboWorkshopMaps, loboWorkshopMapSections } from '../../shared/lobo-workshop-maps.mjs'
import { buildMapRatings, mapRatingLabel, type MapRating } from './mapRatings'
import type { PublicGame } from './snapshotTypes'
import { useSnapshotData } from './useSnapshotData'
import './MapLibrary.css'

type WorkshopMap = (typeof loboWorkshopMaps)[number]

const missionOptions = [...new Set(loboWorkshopMaps.flatMap((map) => map.missionSetups))].sort((a, b) => a.localeCompare(b))
const layoutCount = new Set(loboWorkshopMaps.map((map) => map.layoutKey)).size
const missionCount = missionOptions.length
const cardCount = loboWorkshopMapSections.reduce((total, section) => total + section.layouts.length, 0)
const sectionForSave = (map: WorkshopMap) => loboWorkshopMapSections.find((section) =>
  section.layouts.some((layout) => layout.saves.some((save) => save.id === map.id)))

export default function MapLibrary() {
  const { slug } = useParams()
  const gameState = useSnapshotData<PublicGame[]>('games')
  const games = gameState.data ?? []
  const ratings = buildMapRatings(games)
  const ratingsStatus = gameState.data ? 'ready' : gameState.error ? 'unavailable' : 'loading'
  return slug
    ? <MapDetail games={games} map={loboWorkshopMapBySlug.get(slug)} ratings={ratings} ratingsStatus={ratingsStatus} />
    : <MapIndex ratings={ratings} ratingsStatus={ratingsStatus} />
}

type RatingsStatus = 'loading' | 'ready' | 'unavailable'
const ratingText = (status: RatingsStatus, rating?: MapRating) => status === 'ready'
  ? mapRatingLabel(rating) : status === 'loading' ? 'Ratings loading…' : 'Ratings unavailable'

function MapIndex({ ratings, ratingsStatus }: { ratings: Map<number, MapRating>; ratingsStatus: RatingsStatus }) {
  const [query, setQuery] = useState('')
  const [mission, setMission] = useState('All missions')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleSections = loboWorkshopMapSections.map((section) => ({
    ...section,
    layouts: section.layouts.flatMap((layout) => {
      const matchingSaves = layout.saves.filter((map) =>
        (mission === 'All missions' || map.missionSetups.includes(mission)) &&
        (!normalizedQuery || `${map.name} ${map.workshopBagName} ${map.workshopName} ${map.family} ${map.missionSetups.join(' ')} ${section.title}`.toLocaleLowerCase().includes(normalizedQuery)))
      return matchingSaves.length ? [{ ...layout, primary: matchingSaves[0] }] : []
    }),
  }))
  const visibleLayoutCount = visibleSections.reduce((total, section) => total + section.layouts.length, 0)
  const featured = loboWorkshopMaps.find((map) => map.slug === 'critical-intervention-2') ?? loboWorkshopMaps[0]

  return <main className="portal-shell lobo-maps-page" data-page="map-library">
    <header className="lobo-maps-hero">
      <div className="lobo-maps-hero-copy">
        <p className="eyebrow">Tabletop Simulator · Lobo Workshop</p>
        <h1>See the table before you deploy.</h1>
        <p>Explore {loboWorkshopMaps.length} setups for {missionCount} ITS Season 18 missions across {layoutCount} terrain layouts. Filter by mission, inspect the setup, and load its matching Workshop bag.</p>
        <div className="lobo-maps-hero-actions">
          <a download href={LOBO_WORKSHOP_DOWNLOAD_URL}>Download all map bags</a>
          <a href="#browse-maps">Browse the maps <span aria-hidden="true">↓</span></a>
          <a href={LOBO_WORKSHOP_URL} rel="noopener noreferrer" target="_blank">Open Steam Workshop <span aria-hidden="true">↗</span></a>
        </div>
        <p>Download a bag to TTS Saved Objects, then drop it onto the normal Infinity mod’s map deployment spot. Start with a fresh table if an older map is stuck busy.</p>
        <span className="lobo-maps-hero-count">{layoutCount} layouts <span aria-hidden="true">·</span> {loboWorkshopMaps.length} setups <span aria-hidden="true">·</span> {missionCount} missions</span>
      </div>
      <Link aria-label={`Explore ${featured.name}`} className="lobo-maps-hero-image" to={`/maps/${featured.slug}`}>
        <img alt={`${featured.previewKind === 'diagram' ? 'Setup diagram' : 'Tabletop Simulator preview'} of ${featured.name}`} decoding="async" height="900" src={featured.angled} width="1600" />
        <span>Featured setup <strong>{featured.name}</strong></span>
      </Link>
    </header>

    <section aria-labelledby="browse-maps-title" className="lobo-maps-browse" id="browse-maps">
      <div className="lobo-maps-section-heading">
        <div><p className="eyebrow">Choose your ground</p><h2 id="browse-maps-title">Map library</h2></div>
        <span aria-live="polite">{visibleLayoutCount} of {cardCount} setups</span>
      </div>
      <div className="lobo-maps-controls">
        <label htmlFor="map-search">Search maps</label>
        <input autoComplete="off" id="map-search" onChange={(event) => setQuery(event.target.value)} placeholder="Terrain, Workshop name, or mission…" type="search" value={query} />
        <p className="lobo-maps-control-label">Named mission setup</p>
        <div aria-label="Filter by named mission setup" className="lobo-maps-filters" role="group">
          {['All missions', ...missionOptions].map((option) => <button aria-pressed={mission === option} key={option} onClick={() => setMission(option)} type="button">{option}</button>)}
        </div>
        <p className="lobo-maps-filter-note">Each mission has two different terrain layouts. Terrain is reused across missions: 40 setups use 16 layouts. Screenshots were captured on October 15, 2026.</p>
        <p className="lobo-maps-filter-note">Ratings average 1–5 scores from submitted games. Setups using the same terrain share one rating.</p>
      </div>
      <nav aria-label="Missions" className="lobo-map-section-nav">
        {visibleSections.filter((section) => section.layouts.length).map((section) => <a href={`#maps-${section.id}`} key={section.id}>{section.title} <span>{section.layouts.length}</span></a>)}
      </nav>
      {visibleLayoutCount ? visibleSections.map((section) => section.layouts.length ? <section aria-labelledby={`maps-${section.id}-title`} className="lobo-map-collection" id={`maps-${section.id}`} key={section.id}>
        <div className="lobo-map-collection-heading">
          <div><p className="eyebrow">ITS Season 18 mission</p><h3 id={`maps-${section.id}-title`}>{section.title}</h3><p>{section.description}</p></div>
          <div className="lobo-map-collection-meta"><span>{section.layouts.length} {section.layouts.length === 1 ? 'setup' : 'setups'}</span>{section.eventUrl ? <Link to={section.eventUrl}>View event <span aria-hidden="true">↗</span></Link> : null}</div>
        </div>
        <div className="lobo-maps-grid">{section.layouts.map((layout) => {
          const map = layout.primary
          const namedMissions = [...new Set(layout.saves.flatMap((save) => save.missionSetups))]
          return <Link data-preview={map.previewKind} className="lobo-map-card" key={layout.layoutKey} to={`/maps/${map.slug}`}>
            <img alt={`${map.previewKind === 'diagram' ? 'Setup diagram' : 'Overhead preview'} of ${map.name}`} decoding="async" height="900" loading="lazy" src={map.overhead} width="1600" />
            <span className="lobo-map-card-info"><small>{map.family}</small><strong>{layout.name}</strong><span className="lobo-map-card-rating">{ratingText(ratingsStatus, ratings.get(layout.layoutKey))}</span><small className="lobo-map-card-source">Workshop: {layout.saves.map((save) => save.workshopBagName).join(' · ')}</small><span className="lobo-map-mission-summary">{namedMissions.length ? namedMissions.join(' · ') : 'Open layout'}</span><span>Inspect save {String(map.index).padStart(2, '0')} <span aria-hidden="true">→</span></span></span>
          </Link>
        })}</div>
      </section> : null) : <p className="lobo-maps-empty">No maps match that search. Try another name or mission.</p>}
    </section>
    <p className="lobo-maps-source-note">Browse 20 missions alphabetically, with two setups per mission. These are fresh Tabletop Simulator screenshots of the revised Workshop collection. Historical map pages remain available through existing game links.</p>
  </main>
}

function MapDetail({ map, games, ratings, ratingsStatus }: { map: WorkshopMap | undefined; games: PublicGame[]; ratings: Map<number, MapRating>; ratingsStatus: RatingsStatus }) {
  if (!map) return <main className="portal-shell lobo-maps-page"><section className="lobo-maps-empty"><h1>Map not found</h1><p>This table is not in the current Lobo Workshop collection.</p><Link to="/maps">Browse all maps</Link></section></main>

  const next = loboWorkshopMaps[map.index % loboWorkshopMaps.length]
  const previous = loboWorkshopMaps[(map.index - 2 + loboWorkshopMaps.length) % loboWorkshopMaps.length]
  const relatedMaps = map.isCurrent === false ? archivedLoboWorkshopMaps : loboWorkshopMaps
  const variants = relatedMaps.filter((item) => item.layoutKey === map.layoutKey && item.id !== map.id)
  const exactMatch = map.exactDuplicateOf
    ? relatedMaps.find((item) => item.index === map.exactDuplicateOf)
    : variants.find((item) => item.exactDuplicateOf === map.index)
  const reports = games.filter((game) => loboWorkshopMapBySlug.get(game.mapSlug ?? '')?.layoutKey === map.layoutKey)
    .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id)
  return <main className="portal-shell lobo-maps-page lobo-map-detail" data-page="map-detail" data-preview={map.previewKind}>
    <nav aria-label="Map navigation" className="lobo-map-detail-nav"><a href={`/maps#maps-${sectionForSave(map)?.id ?? 'standard'}`}>← {sectionForSave(map)?.title ?? 'All maps'}</a><span>{map.isCurrent === false ? `Historical Workshop save ${map.index}` : `Workshop setup ${String(map.index).padStart(2, '0')} / ${loboWorkshopMaps.length}`}</span></nav>
    <header className="lobo-map-detail-heading">
      <div><p className="eyebrow">{map.family} · Lobo Workshop</p><h1>{map.name}</h1><p>Workshop bag: {map.workshopBagName}</p>{map.isCurrent === false ? <p>This is a historical Workshop save. <Link to="/maps">Browse the revised ITS18 collection.</Link></p> : null}<p className="lobo-map-detail-rating">{ratingText(ratingsStatus, ratings.get(map.layoutKey))}</p><p>Inspect this mission setup before loading its matching bag in Tabletop Simulator.</p></div>
      <div>{map.download ? <a download href={map.download}>Download map bag</a> : null} <a href={LOBO_WORKSHOP_URL} rel="noopener noreferrer" target="_blank">Get the Workshop collection <span aria-hidden="true">↗</span></a></div>
    </header>
    {map.isCurrent === false ? null : <p className="lobo-maps-source-note">This download is a map bag. Put its JSON in Documents/My Games/Tabletop Simulator/Saves/Saved Objects, spawn it through Objects → Saved Objects in the normal Infinity mod, then drop it onto the map deployment spot.</p>}
    <a aria-label={`Open full-size ${map.previewKind === 'diagram' ? 'setup diagram' : 'angled preview'} of ${map.name}`} className="lobo-map-detail-hero" href={map.angled} rel="noopener noreferrer" target="_blank"><img alt={`${map.previewKind === 'diagram' ? 'Setup diagram' : 'Angled Tabletop Simulator view'} of ${map.name}`} decoding="async" height="900" src={map.angled} width="1600" /><span>{map.previewKind === 'diagram' ? 'Setup diagram' : 'Angled view'} <span aria-hidden="true">↗</span></span></a>
    {map.previewKind === 'diagram' ? <p className="lobo-maps-source-note">This is a footprint diagram of the revised setup. Fresh overhead and angled TTS screenshots are pending.</p> : <section aria-labelledby="map-views-title" className="lobo-map-detail-views">
      <div className="lobo-maps-section-heading"><div><p className="eyebrow">Two ways to read the table</p><h2 id="map-views-title">Terrain previews</h2></div></div>
      <div className="lobo-map-detail-view-grid">
        <a href={map.overhead} rel="noopener noreferrer" target="_blank"><img alt={`Overhead Tabletop Simulator view of ${map.name}`} decoding="async" height="900" loading="lazy" src={map.overhead} width="1600" /><span><strong>Overhead</strong><small>Read the full layout and approach lanes</small></span></a>
        <a href={map.angled} rel="noopener noreferrer" target="_blank"><img alt={`${map.previewKind === 'diagram' ? 'Setup diagram' : 'Angled Tabletop Simulator view'} of ${map.name}`} decoding="async" height="900" loading="lazy" src={map.angled} width="1600" /><span><strong>Angled</strong><small>Check height, rooflines, and cover</small></span></a>
      </div>
    </section>
    }
    <section aria-labelledby="map-missions-title" className="lobo-map-missions">
      <p className="eyebrow">Choose your scenario</p>
      <h2 id="map-missions-title">Missions for this save</h2>
      {map.missionSetups.length
        ? <><p>This save is set up for:</p><ul className="lobo-map-mission-list">{map.missionSetups.map((mission) => <li key={mission}>{mission}</li>)}</ul></>
        : <p>This bag has no named mission setup. Use it as a terrain layout and place mission objectives according to the scenario you choose.</p>}
      <p>Check the current mission rules and the loaded TTS table before play. Player-placed zones, Data-Harvesters and Infected are intentionally omitted.</p>
      {exactMatch ? <p className="lobo-map-duplicate-note">Exact copy: <Link to={`/maps/${exactMatch.slug}`}>{exactMatch.workshopBagName}</Link> contains the same TTS objects under a different bag name.</p> : null}
      {variants.length ? <div className="lobo-map-variants"><h3>Other saves using this terrain</h3><div>{variants.map((item) => <Link key={item.id} to={`/maps/${item.slug}`}><strong>{item.workshopBagName}</strong><span>{item.missionSetups.length ? item.missionSetups.join(' · ') : 'Open layout'}</span></Link>)}</div></div> : null}
    </section>
    <div className="lobo-map-detail-info">
      <section aria-labelledby="map-reports-title"><p className="eyebrow">Played on this table</p><h2 id="map-reports-title">Battle reports</h2>{reports.length ? <ul className="lobo-map-reports">{reports.slice(0, 8).map((game) => <li key={game.id}><Link to={`/games/${game.id}`}>#{game.id} · {game.mission} · {game.date}</Link></li>)}</ul> : <p>{ratingsStatus === 'ready' ? 'No battle reports have been linked to this table yet.' : ratingsStatus === 'loading' ? 'Battle reports loading…' : 'Battle reports unavailable.'}</p>}<Link to="/submit-game">Submit a game and rate this table <span aria-hidden="true">→</span></Link></section>
    </div>
    {map.sourceNote ? <p className="lobo-maps-source-note">Workshop source note: {map.sourceNote}</p> : null}
    {map.isCurrent === false ? null : <nav aria-label="Adjacent maps" className="lobo-map-detail-adjacent"><Link to={`/maps/${previous.slug}`}><small>← Previous table</small><strong>{previous.name}</strong></Link><Link to={`/maps/${next.slug}`}><small>Next table →</small><strong>{next.name}</strong></Link></nav>}
  </main>
}
