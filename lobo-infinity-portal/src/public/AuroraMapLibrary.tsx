import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { auroraMapRegions, auroraMapLocationBySlug, AURORA_MISSIONS, type AuroraMission } from '../config/auroraMapCatalog'
import { LOBO_WORKSHOP_URL } from '../../shared/lobo-workshop-maps.mjs'
import { AURORA_TERRAIN_GUIDE_URL } from '../config/auroraTerrainReferences'
import { resolveMissionGeistNavigation } from '../config/missionGeistNavigation'
import type { MissionGeistCatalog } from '../services/publicSnapshot'
import { useSnapshotData } from './useSnapshotData'
import MapCollectionNav from './MapCollectionNav'
import './MapLibrary.css'

export default function AuroraMapLibrary({ slug }: { slug: string }) {
  return <main className="portal-shell lobo-maps-page aurora-map-library" data-page="aurora-map-library">
    <MapCollectionNav aurora />
    {slug === 'aurora-vii' ? <RegionIndex /> : <LocationDetail key={slug} slug={slug} />}
  </main>
}

function RegionIndex() {
  const [params, setParams] = useSearchParams()
  const regionId = params.get('region') ?? ''
  const query = params.get('q') ?? ''
  const search = query.trim().toLocaleLowerCase()
  const regions = auroraMapRegions.filter(region => (!regionId || region.id === regionId) &&
    `${region.name} ${region.settlement} ${region.locations.map(location => location.name).join(' ')}`.toLocaleLowerCase().includes(search))
  function filter(key: string, value: string) {
    setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); return next }, { replace: true })
  }
  return <>
    <header className="lobo-map-detail-heading"><div><p className="eyebrow">Aurora VII · Race for the Gate</p><h1>Choose your battlefield.</h1><p>12 regions. 24 locations. Frontline and Supremacy share one terrain reference per location.</p></div></header>
    <div className="lobo-maps-controls"><label htmlFor="aurora-map-search">Search regions and locations</label><input id="aurora-map-search" type="search" value={query} placeholder="Azure Coast, Coastal Access…" onChange={event => filter('q', event.target.value)} /><label htmlFor="aurora-region">Region</label><select id="aurora-region" value={regionId} onChange={event => filter('region', event.target.value)}><option value="">All regions</option>{auroraMapRegions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}</select></div>
    <p className="lobo-maps-source-note">Concept references show each location’s character. They are construction guides for balanced 48″ × 48″ tables; the loaded Workshop bag contains the playable setup.</p>
    <div className="lobo-maps-grid">{regions.map(region => <article className="lobo-map-card aurora-region-card" key={region.id}>
      <Link to={`/maps/aurora-vii?region=${region.id}`} aria-label={`Browse ${region.name}`}><img src={region.locations[0].image.src} width={region.locations[0].image.width} height={region.locations[0].image.height} loading="lazy" decoding="async" alt={`${region.name} concept reference`} /></Link>
      <div className="lobo-map-card-info"><small>{region.settlement} · {region.vp} campaign VP</small><h2>{region.name}</h2><p>{region.description}</p><div className="aurora-location-links">{region.locations.map(location => <Link key={location.slug} to={`/maps/${location.slug}`}><strong>{location.name}</strong><span>Frontline · Supremacy →</span></Link>)}</div><small>Territory rule: {region.rule.title}</small></div>
    </article>)}</div>
    {!regions.length ? <p className="lobo-maps-empty">No regions or locations match. <Link to="/maps/aurora-vii">Reset filters</Link></p> : null}
    <p className="lobo-maps-source-note"><a href={AURORA_TERRAIN_GUIDE_URL} target="_blank" rel="noopener noreferrer">Territory &amp; Terrain Guide ↗</a> · <Link to="/campaign/aurora-vii/map">Campaign territory map →</Link></p>
  </>
}

function LocationDetail({ slug }: { slug: string }) {
  const [params, setParams] = useSearchParams()
  const [copyStatus, setCopyStatus] = useState('')
  const location = auroraMapLocationBySlug.get(slug)
  const catalog = useSnapshotData<MissionGeistCatalog>('mission-catalog')
  if (!location) return <section className="lobo-maps-empty"><h1>Map not found</h1><Link to="/maps/aurora-vii">Browse Aurora VII maps</Link></section>
  const mission: AuroraMission = params.get('mission') === 'Supremacy' ? 'Supremacy' : 'Frontline'
  const setup = location.setups.find(item => item.mission === mission)!
  const { region, image } = location
  const references = catalog.data ? resolveMissionGeistNavigation({ mission }, catalog.data.missions).records.filter(record => {
    try { const url = new URL(record.canonicalUrl); return url.protocol === 'https:' && url.hostname === 'infinitygeist.com' } catch { return false }
  }) : []
  async function copyBag() {
    try { await navigator.clipboard.writeText(setup.bagName); setCopyStatus('Bag name copied.') }
    catch { setCopyStatus('Select the bag name below and copy it manually.') }
  }
  return <>
    <nav className="lobo-map-detail-nav" aria-label="Aurora map navigation"><Link to={`/maps/aurora-vii?region=${region.id}`}>← {region.name}</Link><Link to={`/campaign/aurora-vii/territories/${region.id}`}>Campaign territory →</Link></nav>
    <header className="lobo-map-detail-heading"><div><p className="eyebrow">Aurora VII · {region.name}</p><h1>{location.name}</h1><p>{region.settlement} · 48″ × 48″ table</p></div></header>
    <figure className="aurora-location-reference"><a href={image.src} target="_blank" rel="noopener noreferrer" aria-label={`Enlarge ${location.name} concept reference`}><img src={image.src} width={image.width} height={image.height} decoding="async" alt={`${location.name} concept reference, shared by Frontline and Supremacy`} /></a><figcaption>Concept reference · shared by both missions · click to enlarge</figcaption></figure>
    <section className="lobo-maps-controls" aria-labelledby="aurora-mission-title"><h2 id="aurora-mission-title">Choose the mission</h2><div className="lobo-maps-filters" role="group" aria-label="Mission">{AURORA_MISSIONS.map(option => <button key={option} type="button" aria-pressed={mission === option} onClick={() => { setParams({ mission: option }); setCopyStatus('') }}>{option}</button>)}</div>
      <h3>{mission === 'Frontline' ? 'Claim the Frontier' : 'Colonial Supremacy'} · {mission}</h3>
      <p>{mission === 'Frontline' ? 'Fight for control of the three scoring bands across the battlefield.' : 'Fight for control of the battlefield quadrants and their consoles.'} Use the mission’s current deployment, objectives, and scoring rules.</p>
      {references.map(record => <a key={record.id} href={record.canonicalUrl} target="_blank" rel="noopener noreferrer">Open {record.name} mission rules &amp; deployment diagram ↗</a>)}
      {!references.length ? <p className="lobo-maps-source-note">{catalog.error ? 'Mission references are currently unavailable.' : catalog.data ? 'Mission reference is not yet available in the public catalogue.' : 'Loading mission references…'} Check the mission sheet before deployment.</p> : null}
      <label htmlFor="aurora-bag-name">Exact Workshop bag name</label><input id="aurora-bag-name" readOnly value={setup.bagName} onFocus={event => event.target.select()} />
      <div className="lobo-maps-hero-actions"><button type="button" onClick={copyBag}>Copy bag name</button><a href={LOBO_WORKSHOP_URL} target="_blank" rel="noopener noreferrer">Open Steam Workshop ↗</a></div><p role="status">{copyStatus}</p>
      <p className="lobo-maps-source-note">Find this bag in the Lobo Workshop and drop it onto “Place bags here” to deploy. Use “Clear table” to remove the deployed map.</p>
    </section>
    <section className="lobo-maps-controls" aria-labelledby="aurora-territory-rule"><p className="eyebrow">Applies to both missions in {region.name}</p><h2 id="aurora-territory-rule">{region.rule.title}</h2><p>{region.rule.effect}</p><p>{region.rule.details}</p><h3>Territory owner advantage</h3><p>{region.rule.owner}</p></section>
    <section><h2>Also in {region.name}</h2><div className="aurora-location-links">{region.locations.filter(item => item.slug !== slug).map(item => <Link key={item.slug} to={`/maps/${item.slug}?mission=${mission}`}>{item.name} →</Link>)}</div></section>
    <p className="lobo-maps-source-note">Terrain references guide construction; they are not mandatory placements or screenshots of the loaded TTS table. <Link to="/campaign/aurora-vii/games">Browse campaign battle reports →</Link></p>
  </>
}
