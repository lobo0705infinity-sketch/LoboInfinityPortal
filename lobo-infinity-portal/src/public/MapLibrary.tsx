import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LOBO_WORKSHOP_URL, loboWorkshopMapBySlug, loboWorkshopMaps, loboWorkshopMapSections } from '../../shared/lobo-workshop-maps.mjs'
import { buildMapRatings, mapRatingLabel, type MapRating } from './mapRatings'
import type { PublicGame } from './snapshotTypes'
import { useSnapshotData } from './useSnapshotData'
import './MapLibrary.css'

type WorkshopMap = (typeof loboWorkshopMaps)[number]

const missionOptions = [...new Set(loboWorkshopMaps.flatMap((map) => map.missionSetups))].sort((a, b) => a.localeCompare(b))
const layoutCount = new Set(loboWorkshopMaps.map((map) => map.layoutKey)).size
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
  const [sort, setSort] = useState('collection')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleSections = loboWorkshopMapSections.map((section) => ({
    ...section,
    layouts: section.layouts.flatMap((layout) => {
      const matchingSaves = layout.saves.filter((map) =>
        (mission === 'All missions' || map.missionSetups.includes(mission)) &&
        (!normalizedQuery || `${map.name} ${map.workshopName} ${map.family} ${map.missionSetups.join(' ')} ${section.title}`.toLocaleLowerCase().includes(normalizedQuery)))
      return matchingSaves.length ? [{ ...layout, primary: matchingSaves[0] }] : []
    }).sort((left, right) => sort === 'top-rated'
      ? (ratings.get(right.layoutKey)?.average ?? -1) - (ratings.get(left.layoutKey)?.average ?? -1) ||
        (ratings.get(right.layoutKey)?.count ?? 0) - (ratings.get(left.layoutKey)?.count ?? 0) ||
        left.name.localeCompare(right.name)
      : 0),
  }))
  const visibleLayoutCount = visibleSections.reduce((total, section) => total + section.layouts.length, 0)
  const featured = loboWorkshopMaps.find((map) => map.slug === '47-ll-map-16-the-dig-provisioning') ?? loboWorkshopMaps[0]

  return <main className="portal-shell lobo-maps-page" data-page="map-library">
    <header className="lobo-maps-hero">
      <div className="lobo-maps-hero-copy">
        <p className="eyebrow">Tabletop Simulator · Lobo Workshop</p>
        <h1>See the table before you deploy.</h1>
        <p>Explore {layoutCount} Infinity table layouts across casual and event collections, with overhead and angled TTS captures. Find your event, inspect the terrain, then choose a save for your mission.</p>
        <div className="lobo-maps-hero-actions">
          <a href="#browse-maps">Browse the maps <span aria-hidden="true">↓</span></a>
          <a href={LOBO_WORKSHOP_URL} rel="noopener noreferrer" target="_blank">Open Steam Workshop <span aria-hidden="true">↗</span></a>
        </div>
        <span className="lobo-maps-hero-count">{layoutCount} layouts <span aria-hidden="true">·</span> 47 saves <span aria-hidden="true">·</span> 94 table views</span>
      </div>
      <Link aria-label={`Explore ${featured.name}`} className="lobo-maps-hero-image" to={`/maps/${featured.slug}`}>
        <img alt={`Angled Tabletop Simulator preview of ${featured.name}`} decoding="async" height="900" src={featured.angled} width="1600" />
        <span>Featured table <strong>{featured.name}</strong></span>
      </Link>
    </header>

    <section aria-labelledby="browse-maps-title" className="lobo-maps-browse" id="browse-maps">
      <div className="lobo-maps-section-heading">
        <div><p className="eyebrow">Choose your ground</p><h2 id="browse-maps-title">Map library</h2></div>
        <span aria-live="polite">{visibleLayoutCount} of {cardCount} table cards</span>
      </div>
      <div className="lobo-maps-controls">
        <label htmlFor="map-search">Search maps</label>
        <input autoComplete="off" id="map-search" onChange={(event) => setQuery(event.target.value)} placeholder="Terrain, Workshop name, or mission…" type="search" value={query} />
        <p className="lobo-maps-control-label">Named mission setup</p>
        <div aria-label="Filter by named mission setup" className="lobo-maps-filters" role="group">
          {['All missions', ...missionOptions].map((option) => <button aria-pressed={mission === option} key={option} onClick={() => setMission(option)} type="button">{option}</button>)}
        </div>
        <p className="lobo-maps-filter-note">Mission filters use the Workshop bag names and notes. Other terrain saves can be adapted by placing objectives according to the mission rules.</p>
        <label htmlFor="map-sort">Sort tables</label>
        <select id="map-sort" onChange={(event) => setSort(event.target.value)} value={sort}>
          <option value="collection">Collection order</option>
          <option disabled={ratingsStatus !== 'ready'} value="top-rated">Highest rated</option>
        </select>
        <p className="lobo-maps-filter-note">Ratings average 1–5 scores from submitted games. Different saves of the same terrain share one ranking; unrated layouts appear last.</p>
      </div>
      <nav aria-label="Map collections" className="lobo-map-section-nav">
        {visibleSections.filter((section) => section.layouts.length).map((section) => <a href={`#maps-${section.id}`} key={section.id}>{section.title} <span>{section.layouts.length}</span></a>)}
      </nav>
      {visibleLayoutCount ? visibleSections.map((section) => section.layouts.length ? <section aria-labelledby={`maps-${section.id}-title`} className="lobo-map-collection" id={`maps-${section.id}`} key={section.id}>
        <div className="lobo-map-collection-heading">
          <div><p className="eyebrow">{section.id === 'casual' ? 'Pick a table' : 'Event tables'}</p><h3 id={`maps-${section.id}-title`}>{section.title}</h3><p>{section.description}</p></div>
          <div className="lobo-map-collection-meta"><span>{section.layouts.length} {section.layouts.length === 1 ? 'layout' : 'layouts'} · {section.layouts.reduce((total, layout) => total + layout.saves.length, 0)} saves</span>{section.eventUrl ? <Link to={section.eventUrl}>View event <span aria-hidden="true">↗</span></Link> : null}</div>
        </div>
        <div className="lobo-maps-grid">{section.layouts.map((layout) => {
          const map = layout.primary
          const namedMissions = [...new Set(layout.saves.flatMap((save) => save.missionSetups))]
          const otherCollections = loboWorkshopMapSections.filter((other) => other.id !== section.id && other.layouts.some((item) => item.layoutKey === layout.layoutKey))
          return <Link className="lobo-map-card" key={layout.layoutKey} to={`/maps/${map.slug}`}>
            <img alt={`Overhead preview of ${map.name}`} decoding="async" height="900" loading="lazy" src={map.overhead} width="1600" />
            <span className="lobo-map-card-info"><small>{map.family} · {layout.saves.length} {layout.saves.length === 1 ? 'save' : 'saves'}</small><strong>{layout.name}</strong><span className="lobo-map-card-rating">{ratingText(ratingsStatus, ratings.get(layout.layoutKey))}</span><small className="lobo-map-card-source">Workshop: {layout.saves.map((save) => save.workshopName).join(' · ')}</small><span className="lobo-map-mission-summary">{namedMissions.length ? namedMissions.join(' · ') : 'Open layout'}</span>{otherCollections.length ? <small className="lobo-map-card-other">Also in {otherCollections.map((other) => other.title).join(' · ')}</small> : null}<span>Inspect save {String(map.index).padStart(2, '0')} <span aria-hidden="true">→</span></span></span>
          </Link>
        })}</div>
      </section> : null) : <p className="lobo-maps-empty">No maps match that search. Try another name or mission.</p>}
    </section>
    <p className="lobo-maps-source-note">Layouts can appear in more than one collection, but appear only once within each. All 47 original Workshop saves remain available. Captures show the saves as loaded in Tabletop Simulator on September 28, 2026.</p>
  </main>
}

function MapDetail({ map, games, ratings, ratingsStatus }: { map: WorkshopMap | undefined; games: PublicGame[]; ratings: Map<number, MapRating>; ratingsStatus: RatingsStatus }) {
  if (!map) return <main className="portal-shell lobo-maps-page"><section className="lobo-maps-empty"><h1>Map not found</h1><p>This table is not in the current Lobo Workshop collection.</p><Link to="/maps">Browse all maps</Link></section></main>

  const next = loboWorkshopMaps[map.index % loboWorkshopMaps.length]
  const previous = loboWorkshopMaps[(map.index - 2 + loboWorkshopMaps.length) % loboWorkshopMaps.length]
  const variants = loboWorkshopMaps.filter((item) => item.layoutKey === map.layoutKey && item.id !== map.id)
  const exactMatch = map.exactDuplicateOf
    ? loboWorkshopMaps.find((item) => item.index === map.exactDuplicateOf)
    : variants.find((item) => item.exactDuplicateOf === map.index)
  const reports = games.filter((game) => loboWorkshopMapBySlug.get(game.mapSlug ?? '')?.layoutKey === map.layoutKey)
    .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id)
  return <main className="portal-shell lobo-maps-page lobo-map-detail" data-page="map-detail">
    <nav aria-label="Map navigation" className="lobo-map-detail-nav"><a href={`/maps#maps-${sectionForSave(map)?.id ?? 'casual'}`}>← {sectionForSave(map)?.title ?? 'All maps'}</a><span>Workshop save {String(map.index).padStart(2, '0')} / {loboWorkshopMaps.length}</span></nav>
    <header className="lobo-map-detail-heading">
      <div><p className="eyebrow">{map.family} · Lobo Workshop</p><h1>{map.name}</h1><p>Workshop bag: {map.workshopName}</p><p className="lobo-map-detail-rating">{ratingText(ratingsStatus, ratings.get(map.layoutKey))}</p><p>Preview the full table from above and at an angle before loading it for a game.</p></div>
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
    <section aria-labelledby="map-missions-title" className="lobo-map-missions">
      <p className="eyebrow">Choose your scenario</p>
      <h2 id="map-missions-title">Missions for this save</h2>
      {map.missionSetups.length
        ? <><p>The Workshop bag names this layout for:</p><ul className="lobo-map-mission-list">{map.missionSetups.map((mission) => <li key={mission}>{mission}</li>)}</ul></>
        : <p>This bag has no named mission setup. Use it as a terrain layout and place mission objectives according to the scenario you choose.</p>}
      <p>Check the current mission rules and the loaded TTS table before play. These labels describe Workshop saves, not an exhaustive list of playable missions.</p>
      {exactMatch ? <p className="lobo-map-duplicate-note">Exact copy: <Link to={`/maps/${exactMatch.slug}`}>Save {String(exactMatch.index).padStart(2, '0')} · {exactMatch.workshopName}</Link> contains the same TTS objects under a different bag name.</p> : null}
      {variants.length ? <div className="lobo-map-variants"><h3>Other saves using this terrain</h3><div>{variants.map((item) => <Link key={item.id} to={`/maps/${item.slug}`}><strong>Save {String(item.index).padStart(2, '0')} · {sectionForSave(item)?.title ?? 'Workshop'}</strong><span>{item.missionSetups.length ? item.missionSetups.join(' · ') : 'Open layout'}</span><small>{item.workshopName}</small></Link>)}</div></div> : null}
    </section>
    <div className="lobo-map-detail-info">
      <section aria-labelledby="map-reports-title"><p className="eyebrow">Played on this table</p><h2 id="map-reports-title">Battle reports</h2>{reports.length ? <ul className="lobo-map-reports">{reports.slice(0, 8).map((game) => <li key={game.id}><Link to={`/games/${game.id}`}>#{game.id} · {game.mission} · {game.date}</Link></li>)}</ul> : <p>{ratingsStatus === 'ready' ? 'No battle reports have been linked to this table yet.' : ratingsStatus === 'loading' ? 'Battle reports loading…' : 'Battle reports unavailable.'}</p>}<Link to="/submit-game">Submit a game and rate this table <span aria-hidden="true">→</span></Link></section>
    </div>
    {map.sourceNote ? <p className="lobo-maps-source-note">Workshop source note: {map.sourceNote}</p> : null}
    <nav aria-label="Adjacent maps" className="lobo-map-detail-adjacent"><Link to={`/maps/${previous.slug}`}><small>← Previous table</small><strong>{previous.name}</strong></Link><Link to={`/maps/${next.slug}`}><small>Next table →</small><strong>{next.name}</strong></Link></nav>
  </main>
}
