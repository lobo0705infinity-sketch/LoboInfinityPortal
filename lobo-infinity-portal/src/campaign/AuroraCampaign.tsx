import AuroraRulebook, { RuleChapter, useRuleSearch } from './AuroraRulebook'
import AuroraArtwork from './AuroraArtwork'
import AuroraFactionDecisions from './AuroraFactionDecisions'
import { projectedStandings, ownerAdvantageStatus } from '../../shared/aurora-campaign-policy.mjs'
import CompactArtwork from '../components/CompactArtwork'
import TerritoryVideo from './TerritoryVideo'
import AuroraPlayerGuide, { AuroraGuideLink, AuroraGuidePreview } from './AuroraPlayerGuide'
import CampaignStatus from './CampaignStatus'
import TerritoryVideoThumbnail from './TerritoryVideoThumbnail'
import { AURORA_TERRITORY_VIDEOS, AURORA_SPECIAL_RULES_PDF_URL } from '../config/auroraTerritoryVideos'
import { auroraMapRegions } from '../../shared/aurora-map-catalog.mjs'
import TerritoryBattlefieldRules from './TerritoryBattlefieldRules'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import { AURORA_TERRITORIES, AURORA_TURNS, AURORA_DOCTRINES } from '../../shared/aurora-public.mjs'
import { AURORA_LOCATION_DESCRIPTIONS } from '../../shared/aurora-locations.mjs'
import { AURORA_TERRAIN_GUIDE_URL, AURORA_TERRAIN_REFERENCES } from '../config/auroraTerrainReferences'
import { AURORA_HISTORY, AURORA_MOTIVATIONS } from '../../shared/aurora-story.mjs'
import { emptyAuroraState } from '../../shared/aurora-public-state.mjs'
import { useAuroraPublication } from './useAuroraPublication'
import type { AuroraPublicState } from './auroraTypes'
import { useSnapshotData } from '../public/useSnapshotData'
import { resolveAuroraMissionReference } from '../config/missionGeistNavigation'
import type { MissionGeistCatalog } from '../services/publicSnapshot'
import AuroraRegistration from './AuroraRegistration'
import AuroraGames from './AuroraGames'
import CampaignLocationRules from './CampaignLocationRules'
import AuroraResults from './AuroraResults'
import { AURORA_REGISTRATION_FACTIONS } from '../../shared/aurora-registration.mjs'
import { campaignScore } from '../../shared/aurora-games.mjs'
import { useCampaignActivity, sampleActivity, LocationActivity } from './AuroraActivity'
import { locationActivity } from '../../shared/aurora-activity.mjs'
import { LOBO_DISCORD_INVITE_URL } from '../config/communityLinks'
import { AURORA_FACTION_PROMOS, AURORA_TRAILER_ID, LOBO_YOUTUBE_CHANNEL_URL, youtubeWatchUrl } from '../config/promoVideos'
import './AuroraCampaign.css'

export const AURORA_PATH = '/campaign/aurora-vii'
type Territory = typeof AURORA_TERRITORIES[number]
const sections = [['', 'Overview'], ['register', 'Register'], ['submit', 'Submit Campaign Game'], ['games', 'My Games'], ['map', 'Campaign Map'], ['missions', 'Missions'], ['standings', 'Standings & Battles'], ['story', 'Current Story'], ['rules', 'Player Rules'], ['guide', 'Player Guide'], ['decisions', 'Faction decisions']]

export default function AuroraCampaign() {
  const { section: routeSection = '', territoryId } = useParams()
  const section = territoryId ? 'territories' : routeSection
  const { publication, error, reload } = useAuroraPublication()
  const state = publication?.state ?? emptyAuroraState() as AuroraPublicState
  const known = (!section || sections.some(([id]) => id === section) || section === 'territories') && (!territoryId || AURORA_TERRITORIES.some(item => item.id === territoryId))
  return <main className={`portal-shell aurora-campaign${section ? ' aurora-interior' : ''}`}>
    <Link className="aurora-back-portal" to="/">← Lobo Infinity Portal</Link>
    <header className="aurora-focused-header"><div><h1>AURORA <span>VII</span></h1><p>Race for the Gate</p></div><div className="aurora-header-actions"><Link aria-current={section === 'games' ? 'page' : undefined} to={`${AURORA_PATH}/games`}>My games</Link>{section !== 'register' && section !== 'submit' ? <Link className="aurora-primary" aria-label={state.turn ? 'Submit Campaign Game' : 'Register'} to={`${AURORA_PATH}/${state.turn ? 'submit' : 'register'}`}><span className="aurora-full-action">{state.turn ? 'Submit Campaign Game' : 'Register'}</span><span className="aurora-short-action">{state.turn ? 'Submit game' : 'Register'}</span></Link> : null}</div></header>
    {publication ? <CampaignStatus state={state}/> : null}
    <nav className="aurora-focused-nav" aria-label="Aurora VII navigation"><div><NavLink end to={AURORA_PATH}>Campaign</NavLink><NavLink to={`${AURORA_PATH}/map`} className={section === 'territories' ? 'active' : undefined}>Map</NavLink><NavLink to={`${AURORA_PATH}/standings`}>Results</NavLink><NavLink to={`${AURORA_PATH}/guide`}>Player Guide</NavLink><NavLink to={`${AURORA_PATH}/rules`}>Rules</NavLink></div><details key={section} className="aurora-information-menu"><summary className={['story','missions','register'].includes(section) ? 'is-current' : undefined}>Information</summary><div><Link to={`${AURORA_PATH}/missions`}>Mission briefing</Link><Link to={`${AURORA_PATH}/rules#battlefield-rules`}>Battlefield rules</Link><Link to={`${AURORA_PATH}#territory-videos`}>Territory videos</Link><Link to={`${AURORA_PATH}/story`}>Campaign Story</Link><Link to={`${AURORA_PATH}/register`}>Registration</Link><Link to={`${AURORA_PATH}/decisions`}>Private faction decisions</Link><Link to="/commissioner/aurora-vii">Commissioner tools</Link></div></details></nav>
    {error ? <div className="aurora-notice" role="status"><p>{error} Public reference material remains available; campaign status below is not confirmed.</p><button onClick={reload} type="button">Try again</button></div> : !publication ? <p role="status">Loading the latest public campaign briefing…</p> : null}
    {!known ? <Panel title="Campaign page not found"><Link to={AURORA_PATH}>Return to Aurora VII →</Link></Panel> : section === 'map' || section === 'territories' ? <CampaignMap key={territoryId || "map"} state={state} initialTerritory={territoryId}/> : section === 'register' ? <AuroraRegistration/> : section === 'submit' ? <>{!publication ? <p>Reporting availability will appear after the campaign status loads. <AuroraGuideLink/></p> : !state.turn ? <Panel title="Game reporting opens with Turn 1"><p>Register now. Lobo will announce the active Turn, its deadline, four Vulnerable Territories and mission briefing before game submissions open.</p><Link to={`${AURORA_PATH}/register`}>Open campaign registration →</Link><p><Link to="/commissioner/aurora-vii/reporting-test">Commissioner: test reporting & confirmation →</Link></p></Panel> : <AuroraGames submit/>}</> : section === 'decisions' ? <AuroraFactionDecisions/> : section === 'games' ? <AuroraGames/> : section === 'missions' ? <CampaignMissions state={state}/> : section === 'standings' ? <CampaignStandings state={state}/> : section === 'story' ? <CampaignStory state={state}/> : section === 'rules' ? <CampaignRules state={state}/> : section === 'guide' ? <AuroraPlayerGuide/> : <><CampaignOverview state={state}/><AuroraGuidePreview/><CampaignPromos/><TerritoryVideoGallery/></>}
    <footer className="aurora-focused-footer"><Link to="/">Lobo Infinity Portal</Link><Link to={`${AURORA_PATH}/rules`}>Player Rules</Link><a href={LOBO_DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">Discord ↗</a><a href={LOBO_YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer">YouTube ↗</a></footer>
  </main>
}

function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="panel aurora-panel"><h2>{title}</h2>{children}</section> }
function Paragraphs({ text }: { text: string }) { return <div className="aurora-prose">{text.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div> }

function CampaignOverview({ state }: { state: AuroraPublicState }) {
  const vulnerable = state.territories.filter(item => item.vulnerable)
  return <section className="aurora-overview-focus"><div>
    <p className="eyebrow">{state.turn ? 'This Turn' : 'Twelve weeks. One frontier.'}</p>
    <h2>{state.turn ? 'Choose where your next battle matters.' : 'Race for the Gate.'}</h2>
    <p>{state.turn ? 'Agree with your opponent on a Vulnerable Territory or the active Narrative Mission; if you cannot agree, use blind Command Token bidding. One player records both scores; the opponent confirms the result.' : `Join one of ${AURORA_REGISTRATION_FACTIONS.length} factions. Fight for Aurora VII’s territories, uncover its secrets, and shape the fate of the Gate.`}</p>
    {!state.turn ? <><p className="aurora-muted">6 Turns · 11 factions · 12 territories</p><p>Register now. Games begin with Lobo’s Turn 1 briefing.</p><div className="aurora-overview-actions"><Link className="aurora-primary" to={`${AURORA_PATH}/register`}>Join the campaign</Link><Link to={`${AURORA_PATH}/rules`}>Read the rules →</Link></div></> : <>
      <h3>Vulnerable Territories</h3><ul className="aurora-overview-targets">{vulnerable.map(item => { const territory = AURORA_TERRITORIES.find(t => t.id === item.id)!; return <li key={item.id}><Link to={`${AURORA_PATH}/territories/${item.id}`}>{territory.name}</Link><span>{territory.vp} VP · {item.controller || 'Uncontrolled'}</span></li> })}</ul>
      {state.narrativeMission ? <p><strong>Narrative Mission:</strong> <Link to={`${AURORA_PATH}/missions`}>{state.narrativeMission.title} →</Link></p> : null}
      {state.campaignEvent ? <details className="aurora-info-section"><summary>Campaign Event · {state.campaignEvent.title}</summary><Paragraphs text={state.campaignEvent.rules}/></details> : null}
      <Link to={`${AURORA_PATH}/missions`}>Open this Turn’s complete briefing →</Link>
    </>}
  </div><Link className="aurora-overview-planet" to={`${AURORA_PATH}/map`}><AuroraArtwork/><span>Explore the campaign map →</span></Link></section>
}

function PromoVideo({ videoId, title }: { videoId: string; title: string }) {
  return <a className="aurora-promo-card" href={youtubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer">
    <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} width="480" height="360" loading="lazy" alt=""/>
    <span><strong>{title}</strong><span>Watch on YouTube ↗</span></span>
  </a>
}

function CampaignPromos() {
  return <section className="panel aurora-panel" aria-labelledby="aurora-promos-title">
    <p className="eyebrow">Race for the Gate</p><h2 id="aurora-promos-title">Enter Aurora VII</h2>
    <p>Discover Aurora VII, then see why your faction is joining the fight.</p>
    <div className="aurora-promo-feature"><PromoVideo videoId={AURORA_TRAILER_ID} title="Aurora VII · Campaign trailer"/></div>
    <details className="aurora-info-section"><summary>Choose your faction · 11 promo videos</summary>
      <div className="aurora-promo-grid">{AURORA_FACTION_PROMOS.map(video => <PromoVideo key={video.faction} videoId={video.videoId} title={video.faction}/>)}</div>
    </details>
    <a href={LOBO_YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer">Visit the Lobo Infinity YouTube channel ↗</a>
  </section>
}

function TerritoryVideoGallery() {
  const published = AURORA_TERRITORIES.filter(territory => AURORA_TERRITORY_VIDEOS[territory.id])
  return <section id="territory-videos" className="panel aurora-panel" aria-labelledby="territory-videos-title">
    <p className="eyebrow">Explore Aurora VII</p><h2 id="territory-videos-title">Territory video guides</h2>
    <p>See the terrain and special rules before choosing your battlefield.</p>
    <details className="aurora-info-section"><summary>Browse all 12 territory guides</summary><div className="aurora-territory-video-grid">{published.map(territory => {
      const video = AURORA_TERRITORY_VIDEOS[territory.id]
      return <Link className="aurora-territory-video-card" key={territory.id} to={`${AURORA_PATH}/territories/${territory.id}`}>
        <TerritoryVideoThumbnail videoId={video.videoId} src={video.thumbnailUrl} />
        <span><strong>{territory.name}</strong><small>Watch guide &amp; read current rules →</small></span>
      </Link>
    })}</div></details>
    <p><Link to={`${AURORA_PATH}/map`}>Explore the campaign map →</Link></p>
  </section>
}

function CampaignMap({ state, initialTerritory }: { state: AuroraPublicState; initialTerritory?: string }) {
  const [selected, setSelected] = useState(() => AURORA_TERRITORIES.some(item => item.id === initialTerritory) ? initialTerritory! : AURORA_TERRITORIES[0].id)
  function selectTerritory(id: string) { setSelected(id) }
  const live = useCampaignActivity(state.turn)
  const [preview, setPreview] = useState(false)
  const activity = preview ? sampleActivity(state.turn) : live.data ?? {turn:state.turn,totals:state.totals,games:[]}
  const knownCount = preview || Boolean(state.turn && live.data)
  const territory = AURORA_TERRITORIES.find(item => item.id === selected)!
  const published = state.territories.find(item => item.id === selected)
  return <>
    {initialTerritory ? <><Link to={`${AURORA_PATH}/map`}>← Back to the map</Link><Panel title={territory.name}><p className="eyebrow">{territory.settlement} · {territory.vp} VP</p><p>{territory.description}</p><nav className="aurora-territory-jump" aria-label="Territory sections"><a href="#territory-rules">Battlefield rules</a><a href="#territory-video">Video guide</a><a href="#territory-terrain" onClick={() => { const target = document.getElementById('territory-terrain'); if (target instanceof HTMLDetailsElement) target.open = true }}>Terrain references</a></nav><details className="aurora-info-section"><summary>About {territory.name}</summary><Paragraphs text={AURORA_LOCATION_DESCRIPTIONS[territory.id] || territory.description}/></details>{state.turn ? <LocationActivity activity={activity} location={selected} knownCount={knownCount}/> : null}</Panel><TerritoryGuide territory={territory} state={state}/></> : <>
    <div className="aurora-map-heading"><h2>Campaign Map</h2><label className="aurora-location-select"><span className="aurora-sr-only">Choose a territory</span><select aria-label="Choose a territory" value={selected} onChange={e => selectTerritory(e.target.value)}>{AURORA_TERRITORIES.map(item => <option key={item.id} value={item.id}>{item.number}. {item.name} · {item.vp} VP{knownCount ? ` · ${locationActivity(activity, item.id).count} battles` : ''}</option>)}</select></label></div>
    {!preview && live.error ? <p className="aurora-muted" role="status">{live.error}</p> : null}
    {preview ? <p className="aurora-sample-notice" role="status">Sample results · demonstration only.</p> : null}
    <section className="aurora-map-grid"><div className="aurora-map-surface"><div className="aurora-map-canvas"><img src="/assets/aurora-vii/v1/campaign-map.svg" width="1536" height="1024" alt="Aurora VII campaign map showing all twelve territories and their printed VP values"/>{AURORA_TERRITORIES.map((item: Territory) => { const count = locationActivity(activity,item.id).count; const vulnerable = state.territories.find(value => value.id === item.id)?.vulnerable; return <div className="aurora-map-marker" key={item.id}><span aria-hidden="true" className={`aurora-mobile-marker${vulnerable ? ' is-vulnerable' : ''}`} data-activity={count > 5 ? 'high' : count > 0 ? 'active' : 'quiet'} style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}>{item.number}{knownCount && (count > 0 || vulnerable) ? <span className="aurora-battle-badge">{count}</span> : null}</span><button type="button" style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }} aria-label={`Select ${item.name}, ${item.vp} VP${vulnerable ? ', Vulnerable this Turn' : ''}${knownCount ? `, ${count} confirmed battles` : ''}`} aria-pressed={selected === item.id} data-activity={count > 5 ? 'high' : count > 0 ? 'active' : 'quiet'} className={vulnerable ? 'is-vulnerable' : undefined} onClick={() => selectTerritory(item.id)}><span>{item.number}</span>{knownCount && (count > 0 || vulnerable) ? <span className="aurora-battle-badge">{count}<span className="aurora-sr-only"> battles</span></span> : null}</button></div> })}</div></div><Panel title={territory.name}><p className="eyebrow">{territory.settlement} · {territory.vp} VP</p><p>{territory.description}</p><dl className="aurora-facts"><div><dt>Current controller</dt><dd>{published?.controller || 'Uncontrolled'}</dd></div><div><dt>This Turn</dt><dd>{published?.vulnerable ? 'Vulnerable — games can affect control' : state.turn ? 'Not Vulnerable' : 'Not announced'}</dd></div></dl>{published?.vulnerable ? <p className="aurora-owner-status"><strong>{ownerAdvantageStatus(state, territory.id) === 'pending' ? 'Owner advantage selection pending' : `Owner advantage ${ownerAdvantageStatus(state, territory.id)}`}</strong><br/>{state.ownerAdvantages?.owners[territory.id] ? `Turn-start owner: ${state.ownerAdvantages.owners[territory.id]}. ` : ''}{auroraMapRegions.find(t => t.id === territory.id)?.rule.owner}</p> : null}{published?.ruin ? <p className="aurora-tag">Publicly discovered Precursor Ruin</p> : null}{published?.infiltrated ? <p className="aurora-tag">Published Combined Army foothold</p> : null}{state.turn || preview ? <LocationActivity activity={activity} location={selected} knownCount={knownCount} sample={preview}/> : null}<Link to={`${AURORA_PATH}/territories/${territory.id}`}>View territory details & terrain →</Link><p><Link to={`/maps/aurora-vii?region=${territory.id}`}>Choose a Workshop location →</Link></p></Panel></section>
    <div className="aurora-map-bottom"><p className="aurora-muted">Confirmed battles update activity. Lobo resolves ownership at Turn end.</p><details className="aurora-map-options"><summary>Map key & options</summary><div className="aurora-map-legend"><span>Red ring · Vulnerable</span><span>Badge · Confirmed games</span><span>Glow · More fighting</span></div>{live.updated ? <p className="aurora-muted">Checked at {live.updated} · Refreshes every five minutes. Public results may be cached for up to one minute.</p> : null}<button type="button" onClick={live.reload}>Refresh activity</button><button type="button" aria-pressed={preview} onClick={() => setPreview(value => !value)}>{preview ? 'Return to actual campaign' : 'Preview with sample battles'}</button></details></div>
    {state.narrativeMission || locationActivity(activity,'narrative').count ? <details className="aurora-info-section"><summary>Narrative activity{state.narrativeMission ? ` · ${state.narrativeMission.title}` : ''}</summary><LocationActivity activity={activity} location="narrative" knownCount={knownCount} sample={preview}/></details> : null}
    </>}
  </>
}

function TerritoryGuide({ territory, state }: { territory: Territory; state: AuroraPublicState }) {
  const region = auroraMapRegions.find(item => item.id === territory.id)!
  return <div id="aurora-terrain-references">
    <div id="territory-rules" className="panel aurora-panel"><TerritoryBattlefieldRules region={region} state={state}/></div>
    <div id="territory-video"><TerritoryVideo key={territory.id} territoryId={territory.id} territoryName={territory.name}/></div>
    <details id="territory-terrain" className="aurora-info-section"><summary>Terrain references & table-building guide</summary><Panel title={`${territory.name} terrain references`}>
      <p><Link to={`${AURORA_PATH}/rules#campaign-location-selection`}>Choose the campaign location by agreement or blind Command Token bidding →</Link></p>
      <p><Link to={`/maps/aurora-vii?region=${territory.id}`}>Choose a Workshop location · Frontline / Supremacy →</Link></p>
      <p>These are construction guides, not mandatory terrain placements. Build a balanced 48″ × 48″ Infinity N5 battlefield and preserve this territory’s character.</p>
      <p><a href={AURORA_TERRAIN_GUIDE_URL} target="_blank" rel="noopener noreferrer">Download the Territory &amp; Terrain Guide (PDF) ↗</a></p>
      <div className="aurora-reference-grid">
        {territory.layouts.map((label: string, index: number) => {
          const reference = AURORA_TERRAIN_REFERENCES[territory.number][index]
          return <figure key={label}>
            <a href={reference.src} target="_blank" rel="noopener noreferrer" aria-label={`Open full-size reference: ${label}`}>
              <img src={reference.src} width={reference.width} height={reference.height} loading="lazy" alt={`${territory.name} reference ${index === 0 ? 'A' : 'B'}: ${label}`}/>
            </a>
            <figcaption>{territory.number}{index === 0 ? 'A' : 'B'} · {label}<span>Open the image for the full reference.</span></figcaption>
          </figure>
        })}
      </div>
      <ul>{territory.notes.map((note: string) => <li key={note}>{note}</li>)}</ul>
      <details><summary>Shared table-building principles</summary><ul>
        <li>Provide substantial total-cover positions and several protected exits from each Deployment Zone.</li>
        <li>Keep important routes broad enough for TAGs and other large Silhouettes.</li>
        <li>Use real Line of Fire blockers; scatter supplements them.</li>
        <li>Protect usable midfield objectives and avoid uninterrupted Deployment Zone fire corridors.</li>
        <li>Preserve the different densities, elevations, and water or wilderness character of each territory.</li>
        <li>For current Aurora VII TTS exports, use player edges X = ±24 and Supremacy console centres X = ±6, Z = ±12. Keep grid projection enabled.</li>
      </ul></details>
    </Panel></details>
  </div>
}

function CampaignMissions({ state }: { state: AuroraPublicState }) {
  const catalog = useSnapshotData<MissionGeistCatalog>('mission-catalog')
  const turn = AURORA_TURNS.find(item => item.turn === state.turn)
  return <>
    {!turn ? <Panel title="Mission briefing"><p>Lobo will release the Turn 1 missions and battlefield rules when the campaign begins.</p><Link to={`${AURORA_PATH}/rules`}>Read the Player Rules →</Link></Panel> : <>
      <Panel title="This Turn’s briefing"><h3>Four Vulnerable Territories</h3><ul>{state.territories.filter(item => item.vulnerable).map(item => <li key={item.id}><Link to={`${AURORA_PATH}/territories/${item.id}`}>{AURORA_TERRITORIES.find(t => t.id === item.id)?.name}</Link> · {item.controller || 'Uncontrolled'}</li>)}</ul><h3>Territorial missions</h3><div className="aurora-mission-grid">{turn.missions.map((mission: { name: string; reference: string }) => <article key={mission.name}><h3>{mission.reference}</h3><MissionReference mission={mission.reference} catalog={catalog.data}/></article>)}</div><p>After choosing the campaign location by agreement or blind Command Token bidding, make a separate d20 roll-off for a territory game, rerolling ties. The higher result chooses one of these two missions. No Attribute or Critical result applies.</p></Panel>
      {state.campaignEvent ? <Panel title="Current Campaign Event"><h3>{state.campaignEvent.title}</h3><Paragraphs text={state.campaignEvent.rules}/></Panel> : <p>Campaign Event awaiting announcement.</p>}
      {state.narrativeMission ? <Panel title="Current Narrative Mission"><h3>{state.narrativeMission.title}</h3><p>The winning faction earns the Campaign VP award and special reward announced for this mission.</p><Paragraphs text={state.narrativeMission.briefing}/>{state.narrativeMission.reward ? <p><strong>Announced reward:</strong> {state.narrativeMission.reward}</p> : null}{state.narrativeMission.sheetUrl ? <a href={state.narrativeMission.sheetUrl} target="_blank" rel="noopener noreferrer">Open the current mission sheet ↗</a> : <p>The mission sheet has not been published.</p>}</Panel> : null}
      <p className="aurora-muted">Narrative Mission TP and OP count only toward the Narrative Mission. They do not generate territorial Influence or count toward NA2 Contracts, Tohaa Hidden Hand TP, or CA Infiltration.</p>
    </>}
    <div className="aurora-mission-rule-links"><h2>Before your game</h2><p><AuroraGuideLink>First campaign game? Watch the guide</AuroraGuideLink></p><p><Link to={`${AURORA_PATH}/rules#choose-location`}>Choose a battlefield →</Link> · <Link to={`${AURORA_PATH}/rules#game-scoring`}>Scoring &amp; reporting →</Link> · <Link to={`${AURORA_PATH}/rules#battlefield-rules`}>Territory rules →</Link></p></div>
    <details className="aurora-info-section"><summary>Public ordinary mission rotation</summary><p>From the Player Guide. Narrative Missions, rewards and Campaign Events are released at Turn start.</p><div className="aurora-rotation">{AURORA_TURNS.map(item => <article key={item.turn}><h3>Turn {item.turn} · {item.title}</h3>{item.missions.map((mission: { name: string; reference: string }) => <p key={mission.name}>{mission.reference}</p>)}</article>)}</div></details>
  </>
}

function CampaignStandings({ state }: { state: AuroraPublicState }) {
  const rows = [...state.standings].sort((a, b) => b.vp - a.vp || a.faction.localeCompare(b.faction))
  if (!state.turn) return <AuroraResults state={state}/>
  return <><Panel title="Projected Conquest standings"><p>Projected VP combines earned Campaign VP and the printed value of current holdings. It is a planning figure, not an extra award. From Turn 3, the lowest projected standing determines nomination priority.</p><div className="table-wrapper"><table><thead><tr><th>Faction</th><th>Earned VP</th><th>Holdings value</th><th>Projected VP</th></tr></thead><tbody>{projectedStandings(state).map(r => <tr key={r.faction}><td>{r.faction}</td><td>{r.earnedVP}</td><td>{r.territoryVP}</td><td>{r.projectedVP}</td></tr>)}</tbody></table></div></Panel>{state.finalStandings ? <Panel title="Final campaign ranking"><p>Winner: <strong>{state.finalStandings[0]?.faction}</strong>. Ranked by VP, counted TP, counted OP, then published priority.</p><div className="table-wrapper"><table><thead><tr><th>Rank</th><th>Faction</th><th>VP</th><th>Counted TP</th><th>Counted OP</th></tr></thead><tbody>{state.finalStandings.map(r => <tr key={r.faction}><td>{r.rank}</td><td>{r.faction}</td><td>{r.vp}</td><td>{r.tp}</td><td>{r.op}</td></tr>)}</tbody></table></div></Panel> : null}{state.nominationHistory?.length ? <Panel title="Published nominations">{state.nominationHistory.map(n => <p key={n.turn}>Turn {n.turn} · {n.faction} nominated {AURORA_TERRITORIES.find(t => t.id === n.territory)?.name}</p>)}</Panel> : null}{rows.length ? <Panel title="GM-resolved Campaign VP & control">{rows.length ? <div className="table-wrapper"><table><thead><tr><th scope="col">Faction</th><th scope="col">Campaign VP</th><th scope="col">Territories controlled</th></tr></thead><tbody>{rows.map(item => <tr key={item.faction}><td>{item.faction}</td><td>{item.vp}</td><td>{state.territories.filter(t => t.controller === item.faction).length}</td></tr>)}</tbody></table></div> : <p>Lobo has not published resolved standings yet. Unannounced Campaign VP and ownership are not assumed to be zero.</p>}<p>These are the GM-published standings. Live TP/OP progress below does not change ownership or award Campaign VP. Conquest factions score printed territory VP at the end of Turn 6.</p></Panel> : null}<AuroraResults state={state}/></>
}

function CampaignStory({ state }: { state: AuroraPublicState }) {
  const latest = state.story.at(-1)
  return <>
    <CompactArtwork title="Campaign Story" headingLevel="h2" eyebrow="Aurora VII · Race for the Gate" src="/assets/portal-artwork/aurora-story-unknown-ranger-v1.webp" alt="The Unknown Ranger scans Aurora VII’s luminous gate above a frontier settlement"/>
    <section className="aurora-story-intro"><p className="eyebrow">The public campaign chronicle</p><h2>A world everyone wants. A mystery no one understands.</h2><p>Aurora VII was supposed to be a shared frontier. Now its settlements, resources, and independence are becoming the stakes of a war. This is the world your force is stepping into.</p></section>
    {latest ? <Panel title={latest.title}><p className="eyebrow">Latest published dispatch · {latest.turn ? `Turn ${latest.turn}` : 'Campaign opening'}</p><Paragraphs text={latest.body}/></Panel> : null}
    <details className="aurora-info-section"><summary>The colony’s history</summary><section id="aurora-history" className="panel aurora-panel aurora-story-history"><p className="eyebrow">Before the first battle</p><h2>A Brief History of Aurora VII</h2>{AURORA_HISTORY.map((chapter, index) => <article key={chapter.title}><span className="aurora-story-number" aria-hidden="true">0{index + 1}</span><div><h3>{chapter.title}</h3><Paragraphs text={chapter.body}/></div></article>)}</section></details>
    <section id="aurora-factions" className="panel aurora-panel"><p className="eyebrow">Competing interests</p><h2>Why your faction is here</h2><p>Everyone has a public reason to be on Aurora VII. Some intentions are clearer than others.</p><div className="aurora-motivation-grid">{AURORA_MOTIVATIONS.map(item => <details className="aurora-faction-card" key={item.faction}><summary><h3>{item.faction}</h3><p>{item.body}</p><span className="aurora-faction-expand"><span className="aurora-faction-read">Read faction brief</span><span className="aurora-faction-close">Close faction brief</span><span className="aurora-faction-chevron" aria-hidden="true">⌄</span></span></summary><div className="aurora-faction-brief"><Paragraphs text={item.brief}/>{AURORA_FACTION_PROMOS.filter(video => video.faction === item.faction).map(video => <p key={video.faction}><a href={youtubeWatchUrl(video.videoId)} target="_blank" rel="noopener noreferrer">Watch the {video.faction} promo on YouTube ↗</a></p>)}</div></details>)}</div></section>
    <section id="aurora-releases" className="panel aurora-panel"><p className="eyebrow">As the campaign unfolds</p><h2>Campaign dispatches</h2>{state.story.length ? <>{state.story.slice().reverse().map(chapter => <details key={chapter.turn}><summary>{chapter.turn ? `Turn ${chapter.turn}` : 'Campaign opening'} · {chapter.title}</summary><Paragraphs text={chapter.body}/></details>)}<p>The next dispatch will appear when the GM releases it.</p></> : <p>The opening Turn’s dispatch has not yet been released. As play unfolds, this chronicle will carry the published story chapters alongside the changing map and campaign results.</p>}<Link to={`${AURORA_PATH}/map`}>Explore the places these factions are fighting over →</Link></section>
  </>
}

function CampaignScoringRules({ state }: { state: AuroraPublicState }) {
  return (
    <section id="balance-amendment" className="panel aurora-panel">
      {state.rulesRevision === '2026-11-balance' ? <>
        <h4>The scoring pool</h4>
        <p><strong>Best five results per faction, per location. Maximum two per player.</strong> This includes the Narrative Mission. Each side of a confirmed battle is selected independently.</p>
        <p>Rank results by TP, then OP, then earlier submission, then report ID. A stronger result can replace an earlier counted result. Extra games remain in history and personal statistics.</p>
        <p>Only counted TP and OP generate Influence, support, and specialist comparisons. Add bonuses afterwards. Any valid game can supply Secret Objective evidence under its written conditions.</p>
        <h4>Participation requirements</h4><ul>
          <li><strong>Tohaa:</strong> at least five own counted TP at its chosen target, plus its declared outcome.</li>
          <li><strong>Combined Army:</strong> at least one counted game at its target.</li>
          <li><strong>Narrative winner:</strong> at least one counted Narrative game.</li>
          <li><strong>Successful defence:</strong> the controller must earn its own counted territorial TP.</li>
        </ul>
        <h4>Territorial ties</h4>
        <p>On a complete tie, the incumbent retains control only if among the tied leaders. Otherwise the first tied faction in the published priority gains control. No Influence means no control change. Narrative and Infiltration use their own tie rules.</p>
        <p><strong>Published tie priority:</strong> {state.tiePriority?.join(' → ')}</p>
        <p>The priority is drawn before play and stays fixed throughout the campaign.</p>
        <h4>Secret Objective limits</h4>
        <p>One active objective per faction, assigned before games; at most one completion per Turn and six objective VP for the campaign. Follow the objective’s written conditions, with no additional participation requirement.</p>
      </> : <p>Scoring details will appear when the campaign briefing loads. The mission briefing confirms which results count for the Turn.</p>}
    </section>
  )
}

function CampaignRules({ state }: { state: AuroraPublicState }) {
  const balanced = state.rulesRevision === '2026-11-balance'
  const example = campaignScore(8, 6)
  return <AuroraRulebook>
    <RuleChapter id="start-here" title="Start here" description="Your first campaign game, in four steps.">
      <ol className="aurora-rulebook-steps">
        <li><div><strong>Join a faction.</strong><Link to={`${AURORA_PATH}/register`}>Register for Aurora VII</Link>, then coordinate with your Commander in your private faction channel.</div></li>
        <li><div><strong>Find an opponent from another faction.</strong>Agree on a Vulnerable Territory or the active Narrative Mission. If you disagree, use blind Command Token bidding.</div></li>
        <li><div><strong>Read the briefing and play.</strong>Check the location’s battlefield rules and owner advantage before choosing lists. Use the Turn’s mission briefing.</div></li>
        <li><div><strong>Report once. Confirm together.</strong>One player submits both scores and shares the verification link. The opponent confirms or requests a correction before the deadline.</div></li>
      </ol>
      <p className="aurora-rulebook-callout"><strong>The goal:</strong> finish Turn 6 with the most Campaign VP. Your faction’s path, territory control, Narrative Missions, Doctrines, and Secret Objectives determine how you earn it.</p>
    <h4>Campaign structure</h4><ul>
      <li>12 weeks, divided into six Campaign Turns of two weeks each. All twelve territories start uncontrolled; all factions start at zero earned Campaign VP.</li>
      <li>The GM announces four Vulnerable Territories, two ordinary missions, one Narrative Mission, and the current Campaign Event at Turn start.</li>
      <li>Only Vulnerable Territories can change ownership that Turn.</li>
    </ul>
    </RuleChapter>
    <RuleChapter id="choose-location" title="Choose a battlefield" description="Agreement, blind Command Token bids, and mission selection."><CampaignLocationRules/></RuleChapter>
    <RuleChapter id="game-scoring" title="Scores &amp; reporting" description="Turn Objective Points into TP and get your result confirmed.">
      <p>Enter each player’s Objective Points (OP), from 0 to 10. The form determines the result and calculates Tournament Points (TP) automatically.</p>
      <div className="table-wrapper"><table><thead><tr><th scope="col">Condition</th><th scope="col">TP earned</th></tr></thead><tbody>
        <tr><td>Win (higher OP)</td><td>4 TP</td></tr><tr><td>Draw (equal OP)</td><td>2 TP each</td></tr><tr><td>Loss (lower OP)</td><td>0 TP</td></tr>
        <tr><td>Score at least 5 OP</td><td>+1 TP, for either player</td></tr><tr><td>Lose by no more than 2 OP</td><td>+1 TP for the losing player</td></tr>
      </tbody></table></div>
      <p><strong>Example: 8–6 OP gives {example.tpA}–{example.tpB} TP.</strong> The winner earns 4 + 1 for reaching 5 OP. The loser earns 1 for reaching 5 OP and 1 for losing by two.</p>
      <h4>Reporting a game</h4><ul><li><strong>Different factions only.</strong> Same-faction games are prohibited for Territory Battles and Narrative Missions.</li><li><strong>One report for both players.</strong> Check both scores, submit, and share the verification link. Your opponent confirms or requests a correction.</li><li><strong>Meet the deadline.</strong> Only timely, confirmed or commissioner-approved results enter the scoring pool. Late reports do not count and cannot be approved; possible duplicates require review.</li></ul>
    </RuleChapter>
    <RuleChapter id="counted-results" title="Which results count" description="Scoring caps, Influence, participation requirements, and tie priority."><CampaignScoringRules state={state}/></RuleChapter>
    <RuleChapter id="battlefield-rules" title="Territory rules" description="Battlefield conditions and owner advantages for all twelve territories.">
      <p className="eyebrow">12 territories · Battlefield reference</p>

      <p>Each territory changes how its battles are fought. Both players use its battlefield rules. Only the Turn-start controller receives an active owner advantage; from Turn 3, check the published selection. Check the territory before choosing army lists. Normal points, SWC and availability apply.</p>
      <p>These rules apply to all territorial missions at every Workshop location in that territory. Narrative games use their mission sheet and current Event; territory rules apply only when the sheet expressly says so.</p>
      <p><a href={AURORA_SPECIAL_RULES_PDF_URL} target="_blank" rel="noopener noreferrer">Download all territory special rules (PDF) ↗</a></p>
      <RuleTerritories state={state}/>
    </RuleChapter>
    <RuleChapter id="faction-paths" title="Four ways to fight" description="Conquest, NA2 contracts, Tohaa support, and Combined Army Infiltration."><div className="aurora-rules-grid">
      <article><h3>Conquest · Human Sphere powers</h3><p>PanOceania, Yu Jing, Ariadna, Haqqislam, Nomads, JSA, ALEPH, and O-12 generate territorial Influence: <strong>1 TP = 1 Influence</strong>. Add applicable Tohaa and NA2 support before resolving control. Most Influence controls the territory at Turn end; tied Influence uses the faction’s own OP. {balanced ? 'A complete tie retains the controller only if it is among the leaders; otherwise published faction priority decides.' : 'A complete tie retains the current controller.'} At the end of Turn 6, score the printed VP of controlled territories.</p></article>
      <article><h3>NA2 · Contract Warfare</h3><p>NA2 works through private mercenary contracts rather than claiming territory. Conquest factions, Tohaa, and Combined Army can hire NA2 to support their operations. A Tohaa contract requires a successful Hidden Hand operation, including Tohaa’s five own counted target TP, as well as NA2’s contract threshold. Discuss hiring with your Faction Commander and use your individual faction guide for the full rules.</p></article>
      <article><h3>Tohaa · The Hidden Hand</h3><p>Tohaa privately selects a Vulnerable Territory, INSTALL or PRESERVE, and a supported Conquest faction. INSTALL means that faction gains a territory it did not control at Turn start, including an uncontrolled territory; PRESERVE means the existing controller retains it. Every complete 5 Tohaa TP there grants +1 Influence to the beneficiary before control resolves. Remainders do not carry forward. {balanced ? 'If the declared outcome occurs and Tohaa earns at least five counted TP at that target, Tohaa gains +2 VP.' : 'If the declared outcome occurs, Tohaa gains +2 VP.'}</p></article>
      <article><h3>Combined Army · Infiltration</h3><p>CA privately selects a Vulnerable Territory not already Infiltrated. It generates no territorial Influence and must outperform every opposing faction by comparison TP, then its own OP. A complete tie fails. Success grants +2 VP and a permanent operational foothold; normal territorial control remains unchanged. Consult your individual faction guide when hiring NA2 to support an Infiltration operation.</p></article>
    </div></RuleChapter>
    <RuleChapter id="faction-doctrines" title="Faction Doctrines" description="Earn Campaign VP by fulfilling your faction’s distinctive goal."><p>A capture means gaining control of a territory your faction did not control at Turn start, including an uncontrolled territory. Requirements expressly naming a previous controller still require that controller. ALEPH uses its own control-and-highest-combined-counted-TP condition, without an added active-defense requirement.</p><p>A successful Doctrine gives +1 Campaign VP, at most once per Turn and at most three times during the campaign.</p>{AURORA_DOCTRINES.map(item => <article key={item.faction}><h4>{item.faction} · {item.name}</h4><p>{item.requirement}</p></article>)}<p>For Nomads, every faction tied for most territories at Turn start counts as a territorial leader. For ALEPH, any territory tied for highest combined earned territorial TP can qualify. Narrative TP is excluded.</p></RuleChapter>
    <RuleChapter id="narrative-objectives" title="Narrative & secret objectives" description="Story missions, private objectives, rewards, and Precursor Ruins."><p>All factions can play the Narrative Mission. Its TP and OP are counted separately and do not contribute to territorial Influence, NA2 contract thresholds, Tohaa support, or CA Infiltration. Highest Narrative TP wins; OP breaks ties. If both remain tied, the Narrative Mission is unresolved.</p><p>The winning faction earns +1 Campaign VP and the announced special reward in Turns 1–5. Turn 6 awards +2 VP and no additional special reward. Check the current mission sheet for the exact award and how the reward works.</p><p>Secret Objectives begin in Turn 2, are assigned before the global opening of games, and apply only to their assigned Turn. Incomplete objectives expire and require explicit pre-play reissue. Completed objectives cannot be awarded again. Completed Secret Objectives give +2 Campaign VP, capped at 6 objective VP per faction. Your own objective is private; the GM-only objective table is not published. An employer cannot count NA2’s victories as its own victories.</p><p>A discovered Precursor Ruin is a permanent territory tag with no inherent VP, TP, OP, Influence, or battlefield bonus. It matters only when another rule specifically refers to it.</p></RuleChapter>
    <RuleChapter id="faction-briefings" title="Faction briefings" description="Planning advice, mid-turn dispatches, and the aftermath of each Turn."><p>Use your private faction briefing for this Turn’s one-game recommendation, actual scoring requirements, hiring advice and progress tracker. Narrative flavour is labelled separately from strategic recommendations and rules.</p><p>A mid-turn faction dispatch reviews confirmed progress and recommends where the next games will help. It does not change locked contracts or specialist selections. After resolution, a private faction debrief explains results and a separate public report can recognize verified player contributions and territorial changes. Recognition adds no points.</p></RuleChapter>
    <RuleChapter id="public-private" title="What stays private" description="Know what you can share and what belongs in your faction channel."><p>Public: announced map state, printed VP values, controllers, Vulnerable Territories, the current Campaign Event, current Narrative Mission, reported battles, and publicly released discoveries and story.</p><p>Private: faction objectives and strategy, treasuries, bids, accepted contract terms, purchases, Tohaa choices, CA targets, and faction-specific GM briefings. Hidden operations remain private unless the GM releases them. Future Events, Narrative Missions, rewards, and story chapters are not published in advance. Share only your own faction’s files; the combined GM tracking workbook and master pack contain other factions’ private material.</p></RuleChapter>
    <RuleChapter id="faction-commanders" title="Faction command" description="Commanders, deputies, private decisions, and deadlines.">

      <p>Each faction selects one Commander and one deputy before the campaign and tells the GM who holds each role. Discuss decisions together first. <strong>If consensus is not reached by the GM’s decision deadline, the Commander makes the final call.</strong> The deputy acts when the Commander is unavailable.</p>
      <ul>
        <li>The Commander coordinates recommended targets and submits one official set of faction decisions to the GM.</li>
        <li>This includes NA2 offers and acceptance, Credit spending, Tohaa Hidden Hand choices, CA Infiltration targets, and any faction choices required by an assigned Secret Objective.</li>
        <li>NA2’s Commander chooses which contract to accept and which service to buy.</li>
        <li>Players remain free to arrange games. Opponents choose the campaign location by agreement or blind Command Token bidding. Recommended targets guide coordination.</li>
        <li>The GM interprets rules and confirms scoring. If both Commander and deputy are unavailable, contact the GM before the decision deadline.</li>
      </ul>
      <p>Discuss plans in your private faction channel. The Commander or deputy sends the official decision directly to Lobo by Discord DM, including the Turn, faction, decision and any target, beneficiary or Credit amount. Send anything secret this way: contract offers and acceptance, spending, Hidden Hand choices, Infiltration targets and Secret Objective claims. Lobo records and reviews these privately; only approved public outcomes appear here.</p>
    </RuleChapter>
    <RuleChapter id="turn-preparation" title="Turn preparation & victory" description="Choices for Turns 3–6, owner advantages, and the final campaign tie-break."><CampaignPreparationRules/></RuleChapter>
  </AuroraRulebook>
}

function RuleTerritories({ state }: { state: AuroraPublicState }) {
  const query = useRuleSearch()
  const matching = auroraMapRegions.filter(region => !query || JSON.stringify(region).toLocaleLowerCase().includes(query))
  // A category search such as “territory rules” should still expose the full reference.
  const regions = matching.length ? matching : auroraMapRegions
  return <>{regions.map(region => <details className="aurora-battlefield-entry" key={`${region.id}:${query}`} open={Boolean(query)}>
    <summary>{region.name} · {region.rule.title}</summary>
    <TerritoryBattlefieldRules region={region} state={state}/>
    <p><Link to={`${AURORA_PATH}/territories/${region.id}`}>Explore {region.name} and its terrain →</Link></p>
  </details>)}</>
}


function MissionReference({ mission, catalog }: { mission: string; catalog?: MissionGeistCatalog }) {
  const reference = catalog ? resolveAuroraMissionReference(mission, catalog.missions) : undefined
  return reference ? <div><p><a href={reference.canonicalUrl} target="_blank" rel="noopener noreferrer">View {reference.name} · {reference.sourceCollectionName} on Mission Geist ↗</a></p>{!reference.current ? <p className="aurora-muted">Archived mission reference. Use the campaign briefing for current campaign rules.</p> : null}</div> : <p className="aurora-muted">{catalog ? "Mission reference not yet available in the public catalog." : "Loading mission references…"}</p>
}

function CampaignPreparationRules() { return <>
    <section className="panel aurora-panel" id="turn-three-rules"><h2>Preparing for Turns 3–6</h2>
      <h4>Trailing-faction nomination</h4><ul>
        <li>The lowest-ranked of the eight Conquest factions nominates one territory for an available slot. Rank by projected VP: earned VP plus current territory value.</li>
        <li>Break ties by fewer previous nominations, then a recorded random draw. Allow 24 hours to respond, then offer the choice to the next faction.</li>
        <li>Mandatory selections and exclusion rewards take priority. Four mandatory selections mean no nomination and no usage recorded. Publish all four territories together.</li>
      </ul>
      <h4>Choice after a failed objective</h4><ul>
        <li>Any of the eleven factions that failed an assigned objective in the preceding Turn receives two eligible options of comparable difficulty. Choose one privately before games open globally.</li>
        <li>Only the selected objective is active. Completed objectives cannot return; failed objectives may be reissued. A missed deadline selects the GM’s default. If only one eligible option remains, assign it normally.</li>
        <li>The reward stays at 2 VP, capped at 6 objective VP for the campaign. Valid games outside the scoring caps can still satisfy the written conditions.</li>
      </ul>
      <h4>Owner advantages</h4><ul>
        <li>A Conquest faction owning one or two Vulnerable Territories receives those advantages automatically. With three or four, choose up to two.</li>
        <li>A missed deadline selects the two highest-value eligible territories, then alphabetical name. Publish selections before games.</li>
        <li>Use ownership at Turn start. Support and employment do not transfer advantages. General battlefield rules always apply.</li>
      </ul>
      <p><Link to={`${AURORA_PATH}/decisions`}>Open private faction decisions →</Link></p>
      <p>Resolve the previous Turn → nomination → publish four vulnerable territories → lock owner advantages, objectives and operations → begin games. These mechanics do not change the TP formula.</p>
    </section>
    <section className="panel aurora-panel"><h2>Final campaign ties</h2><p>After every Turn 6 award, compare Campaign VP, then cumulative official counted TP, then the OP from those counted results, then the published faction priority. Include official counted territorial and Narrative results; exclude support conversions and bonus Narrative TP. The final campaign winner receives the Gate decision.</p><p><a href="/guides/aurora-vii-player-guide-current.pdf" target="_blank" rel="noopener noreferrer">Download the Player Guide (PDF) ↗</a></p></section>
  </>
}
