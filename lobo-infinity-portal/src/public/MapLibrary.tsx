import { mapDownloadUrl } from './mapDownloadUrl'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { LOBO_WORKSHOP_URL, LOBO_WORKSHOP_DOWNLOAD_URL, LOBO_WORKSHOP_INSTALLER_URL, archivedLoboWorkshopMaps, loboWorkshopMapBySlug, loboWorkshopMaps, loboWorkshopMapSections } from '../../shared/lobo-workshop-maps.mjs'
import { buildMapRatings, mapRatingLabel, type MapRating } from './mapRatings'
import type { PublicGame } from './snapshotTypes'
import { useSnapshotData } from './useSnapshotData'
import './MapLibrary.css'
import AuroraMapLibrary from './AuroraMapLibrary'
import MapCollectionNav from './MapCollectionNav'

type WorkshopMap = (typeof loboWorkshopMaps)[number]

const missionOptions = [...new Set(loboWorkshopMaps.flatMap((map) => map.missionSetups))].sort((a, b) => a.localeCompare(b))
const missionCount = missionOptions.length
const sectionForSave = (map: WorkshopMap) => loboWorkshopMapSections.find((section) =>
  section.layouts.some((layout) => layout.saves.some((save) => save.id === map.id)))

export default function MapLibrary() {
  const { slug } = useParams()
  if (slug === 'aurora-vii' || slug?.startsWith('aurora-vii-')) return <AuroraMapLibrary slug={slug} />
  return <ITSMapLibrary slug={slug} />
}

function ITSMapLibrary({ slug }: { slug?: string }) {
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
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const mission = missionOptions.includes(params.get('mission') ?? '') ? params.get('mission')! : ''
  const sort = params.get('sort') === 'name' ? 'name' : 'mission'
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleMaps = loboWorkshopMaps.filter(map =>
    (!mission || map.missionSetups.includes(mission)) &&
    (!normalizedQuery || `${map.name} ${map.workshopBagName} ${map.family} ${map.missionSetups.join(' ')} ${map.searchAliases?.join(' ') ?? ''}`.toLocaleLowerCase().includes(normalizedQuery)))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : a.missionSetups[0].localeCompare(b.missionSetups[0])) || a.name.localeCompare(b.name))
  const featured = loboWorkshopMaps.find(map => map.installer === LOBO_WORKSHOP_INSTALLER_URL && map.angled)
    ?? loboWorkshopMaps.find(map => map.guid === 'af0667' && map.angled) ?? loboWorkshopMaps.find(map => map.angled) ?? loboWorkshopMaps[0]
  const installerMap = loboWorkshopMaps.find(map => map.installer === LOBO_WORKSHOP_INSTALLER_URL)
  const returnTo = `/maps${params.size ? `?${params}` : ''}#browse-maps`
  function filter(key: string, value: string) {
    setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); return next }, { replace: true })
  }

  return <main className="portal-shell lobo-maps-page lobo-maps-index" data-page="map-library">
    <MapCollectionNav />
    <header className="lobo-maps-hero">
      <div className="lobo-maps-hero-copy">
        <p className="eyebrow">Tabletop Simulator · Lobo Workshop</p>
        <h1>TTS map library</h1>
        <p>{loboWorkshopMaps.length} tables for {missionCount} ITS18 missions. Find your mission, inspect the current terrain, and download its map bag.</p>
        <div className="lobo-maps-hero-actions">
          <a href="#browse-maps">Browse maps <span aria-hidden="true">↓</span></a>
          <a href={LOBO_WORKSHOP_URL} rel="noopener noreferrer" target="_blank">Steam Workshop <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <Link aria-label={`Explore ${featured.name}`} className="lobo-maps-hero-image" to={`/maps/${featured.slug}`}>
        <img alt={`Current terrain render of ${featured.name}`} decoding="async" height="1200" src={featured.angledThumb ?? featured.angled} width="1600" />
        <span>Featured map <strong>{featured.name}</strong></span>
      </Link>
    </header>

    <section aria-labelledby="browse-maps-title" className="lobo-maps-browse" id="browse-maps">
      <div className="lobo-maps-section-heading">
        <h2 id="browse-maps-title">ITS18 maps</h2>
        <span aria-live="polite">{visibleMaps.length} of {loboWorkshopMaps.length} maps</span>
      </div>
      <div className="lobo-maps-controls lobo-maps-toolbar">
        <div><label htmlFor="map-search">Search maps</label><input autoComplete="off" id="map-search" onChange={event => filter('q', event.target.value)} placeholder="Map name or terrain…" type="search" value={query} /></div>
        <div><label htmlFor="map-mission">Mission</label><select id="map-mission" value={mission} onChange={event => filter('mission', event.target.value)}><option value="">All missions</option>{missionOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></div>
        <div><label htmlFor="map-sort">Sort by</label><select id="map-sort" value={sort} onChange={event => filter('sort', event.target.value === 'mission' ? '' : event.target.value)}><option value="mission">Mission A–Z</option><option value="name">Map name A–Z</option></select></div>
        {(query || mission || sort !== 'mission') && <button className="lobo-maps-reset" type="button" onClick={() => setParams({}, { replace: true })}>Reset</button>}
      </div>
      {visibleMaps.length ? <div className="lobo-maps-grid lobo-maps-catalogue">{visibleMaps.map(map => {
        const rating = ratings.get(map.layoutKey)
        return <Link data-preview={map.previewKind} className="lobo-map-card" id={`maps-${sectionForSave(map)?.id}`} key={map.id} to={`/maps/${map.slug}`} state={{ libraryReturnTo: returnTo }}>
          <div className="lobo-map-card-preview">
            {map.overhead ? <img alt={`Current overhead terrain render of ${map.name}`} decoding="async" height="1600" loading="lazy" src={map.overheadThumb ?? map.overhead} width="1600" /> : <span className="lobo-map-preview-pending">Preview pending</span>}
            {map.reviewStatus === 'pending' && <span className="lobo-map-review-badge">Awaiting review</span>}
          </div>
          <span className="lobo-map-card-info">
            <span className="lobo-map-mission-summary">{map.missionSetups.join(' · ')}</span>
            <strong>{map.name}</strong>
            <small className="lobo-map-card-family">{map.family}</small>
            {ratingsStatus === 'ready' && rating && <span className="lobo-map-card-rating">{ratingText(ratingsStatus, rating)}</span>}
            <span className="lobo-map-card-open">View map & downloads <span aria-hidden="true">→</span></span>
          </span>
        </Link>
      })}</div> : <div className="lobo-maps-empty"><p>No maps match your search and mission filter.</p><button className="lobo-maps-reset" type="button" onClick={() => setParams({}, { replace: true })}>Show all maps</button></div>}
    </section>
    <details className="lobo-maps-downloads">
      <summary>Collection downloads & installation</summary>
      <p>Download an individual map bag from its map page, or get the full set below. The full download also includes campaign, event and archived setups.</p>
      <div className="lobo-maps-hero-actions">
        <a download href={mapDownloadUrl(LOBO_WORKSHOP_DOWNLOAD_URL)} rel="noopener noreferrer" target="_blank">Download all map bags</a>
        <a download href={LOBO_WORKSHOP_INSTALLER_URL} rel="noopener noreferrer" target="_blank">{installerMap ? `${installerMap.name} installer` : 'Latest Workshop installer'}</a>
      </div>
      <p>Put a map bag’s JSON in TTS Saved Objects, then drop the bag onto the Infinity mod’s map deployment spot.</p>
    </details>
    <p className="lobo-maps-source-note">Previews use each published bag’s terrain, textures and saved building states. Mission markers, animated effects and interactive overlays are shown in Tabletop Simulator. Ratings appear after games are submitted.</p>
  </main>
}

function MapDetail({ map, games, ratings, ratingsStatus }: { map: WorkshopMap | undefined; games: PublicGame[]; ratings: Map<number, MapRating>; ratingsStatus: RatingsStatus }) {
  const location = useLocation()
  const returnTo = typeof location.state?.libraryReturnTo === 'string' && location.state.libraryReturnTo.startsWith('/maps?') ? location.state.libraryReturnTo : '/maps#browse-maps'
  if (!map || map.portalHidden) return <main className="portal-shell lobo-maps-page"><section className="lobo-maps-empty"><h1>Map not found</h1><p>This table is not in the active portal catalogue.</p><Link to="/maps">Browse all maps</Link></section></main>

  const installer = map.usesCollectionInstaller ? LOBO_WORKSHOP_INSTALLER_URL : map.installer
  const position = loboWorkshopMaps.findIndex(item => item.id === map.id)
  const next = loboWorkshopMaps[(position + 1) % loboWorkshopMaps.length]
  const previous = loboWorkshopMaps[(position - 1 + loboWorkshopMaps.length) % loboWorkshopMaps.length]
  const relatedMaps = (map.isCurrent === false ? archivedLoboWorkshopMaps : loboWorkshopMaps).filter(item => !item.portalHidden)
  const variants = relatedMaps.filter((item) => item.layoutKey === map.layoutKey && item.id !== map.id)
  const exactMatch = map.exactDuplicateOf
    ? relatedMaps.find((item) => item.index === map.exactDuplicateOf)
    : variants.find((item) => item.exactDuplicateOf === map.index)
  const reports = games.filter((game) => loboWorkshopMapBySlug.get(game.mapSlug ?? '')?.layoutKey === map.layoutKey)
    .sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id)
  return <main className="portal-shell lobo-maps-page lobo-map-detail" data-page="map-detail" data-preview={map.previewKind}>
    <nav aria-label="Map navigation" className="lobo-map-detail-nav"><Link to={returnTo}>← Map library</Link><span>{map.isCurrent === false ? `Historical Workshop save ${map.index}` : `Workshop setup ${String(position + 1).padStart(2, '0')} / ${loboWorkshopMaps.length}`}</span></nav>
    <header className="lobo-map-detail-heading">
      <div><p className="eyebrow">{map.family} · Lobo Workshop</p><h1>{map.name}</h1><p>Workshop bag: {map.workshopBagName}</p>{map.isCurrent === false ? <p>This is a historical Workshop save. <Link to="/maps">Browse the revised ITS18 collection.</Link></p> : null}<p className="lobo-map-detail-rating">{ratingText(ratingsStatus, ratings.get(map.layoutKey))}</p><p>Inspect this mission setup before loading its matching bag in Tabletop Simulator.</p></div>
      <div className="lobo-map-download-actions">{map.download ? <a download href={mapDownloadUrl(map.download)}>Download map bag</a> : null} {installer ? <a download href={mapDownloadUrl(installer)} rel="noopener noreferrer" target="_blank">{map.usesCollectionInstaller ? 'Download collection installer' : 'Download Workshop installer'}</a> : null} <a href={LOBO_WORKSHOP_URL} rel="noopener noreferrer" target="_blank">Get the Workshop collection <span aria-hidden="true">↗</span></a></div>
    </header>
    {map.reviewStatus === 'pending' && <p className="lobo-map-review-note">Awaiting review: this is the current published version. Its replacement has not yet been approved.</p>}
    {map.isCurrent !== false && map.download && <p className="lobo-maps-source-note">This download is a map bag. Put its JSON in Documents/My Games/Tabletop Simulator/Saves/Saved Objects, spawn it through Objects → Saved Objects in the normal Infinity mod, then drop it onto the map deployment spot.</p>}
    {map.angled && <a aria-label={`Open full-size ${map.previewKind === 'diagram' ? 'setup diagram' : 'angled preview'} of ${map.name}`} className="lobo-map-detail-hero" href={map.angled} rel="noopener noreferrer" target="_blank"><img alt={`${map.previewKind === 'diagram' ? 'Setup diagram' : map.previewKind === 'geometry' ? 'Rendered terrain geometry' : 'Angled Tabletop Simulator view'} of ${map.name}`} decoding="async" height="900" src={map.angled} width="1600" /><span>{map.previewKind === 'diagram' ? 'Setup diagram' : 'Angled view'} <span aria-hidden="true">↗</span></span></a>}
    {map.previewKind === 'geometry' ? <p className="lobo-maps-source-note">These previews render this download’s terrain, textures and saved building states. Mission markers, animated effects and interactive overlays are visible in Tabletop Simulator.</p> : null}
    {map.previewKind === 'diagram' ? <p className="lobo-maps-source-note">This is a footprint diagram of the revised setup. Fresh overhead and angled TTS screenshots, live physics checks, and playtesting are pending.</p> : map.overhead && map.angled ? <section aria-labelledby="map-views-title" className="lobo-map-detail-views">
      <div className="lobo-maps-section-heading"><div><p className="eyebrow">Two ways to read the table</p><h2 id="map-views-title">Terrain previews</h2></div></div>
      <div className="lobo-map-detail-view-grid">
        <a href={map.overhead} rel="noopener noreferrer" target="_blank"><img alt={`Overhead ${map.previewKind === 'geometry' ? 'terrain geometry' : 'Tabletop Simulator'} view of ${map.name}`} decoding="async" height="900" loading="lazy" src={map.overhead} width="1600" /><span><strong>Overhead</strong><small>Read the full layout and approach lanes</small></span></a>
        <a href={map.angled} rel="noopener noreferrer" target="_blank"><img alt={`${map.previewKind === 'diagram' ? 'Setup diagram' : map.previewKind === 'geometry' ? 'Rendered terrain geometry' : 'Angled Tabletop Simulator view'} of ${map.name}`} decoding="async" height="900" loading="lazy" src={map.angled} width="1600" /><span><strong>Angled</strong><small>Check height, rooflines, and cover</small></span></a>
      </div>
    </section> : null
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

