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
import { resolveMissionGeistNavigation } from '../config/missionGeistNavigation'
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
const sections = [['', 'Overview'], ['register', 'Register'], ['submit', 'Submit Campaign Game'], ['games', 'My Games'], ['map', 'Campaign Map'], ['missions', 'Missions'], ['standings', 'Standings & Battles'], ['story', 'Current Story'], ['rules', 'Player Rules']]

export default function AuroraCampaign() {
  const { section: routeSection = '', territoryId } = useParams()
  const section = territoryId ? 'territories' : routeSection
  const { publication, error, reload } = useAuroraPublication()
  const state = publication?.state ?? emptyAuroraState() as AuroraPublicState
  const known = (!section || sections.some(([id]) => id === section) || section === 'territories') && (!territoryId || AURORA_TERRITORIES.some(item => item.id === territoryId))
  return <main className={`portal-shell aurora-campaign${section ? ' aurora-interior' : ''}`}>
    <Link className="aurora-back-portal" to="/">← Lobo Infinity Portal</Link>
    <header className="aurora-focused-header"><div><h1>AURORA <span>VII</span></h1><p>Race for the Gate</p></div><div className="aurora-header-actions"><Link aria-current={section === 'games' ? 'page' : undefined} to={`${AURORA_PATH}/games`}>My games</Link>{section !== 'register' && section !== 'submit' ? <Link className="aurora-primary" aria-label={state.turn ? 'Submit Campaign Game' : 'Register'} to={`${AURORA_PATH}/${state.turn ? 'submit' : 'register'}`}><span className="aurora-full-action">{state.turn ? 'Submit Campaign Game' : 'Register'}</span><span className="aurora-short-action">{state.turn ? 'Submit game' : 'Register'}</span></Link> : null}</div></header>
    {publication ? <p className="aurora-campaign-status">{state.turn ? `Turn ${state.turn} of 6 · ${AURORA_TURNS[state.turn - 1].title}${state.deadline ? ` · Ends ${formatDate(state.deadline)}` : ''}` : 'Registration open · Turn 1 awaiting announcement'}</p> : null}
    <nav className="aurora-focused-nav" aria-label="Aurora VII navigation"><div><NavLink end to={AURORA_PATH}>Campaign</NavLink><NavLink to={`${AURORA_PATH}/map`} className={section === 'territories' ? 'active' : undefined}>Map</NavLink><NavLink to={`${AURORA_PATH}/standings`}>Results</NavLink></div><details key={section} className="aurora-information-menu"><summary className={['rules','story','missions','register'].includes(section) ? 'is-current' : undefined}>Information</summary><div><Link to={`${AURORA_PATH}/missions`}>Mission briefing</Link><Link to={`${AURORA_PATH}/rules`}>Player Rules</Link><Link to={`${AURORA_PATH}/story`}>Campaign Story</Link><Link to={`${AURORA_PATH}/register`}>Registration</Link><Link to="/commissioner/aurora-vii">Commissioner tools</Link></div></details></nav>
    {error ? <div className="aurora-notice" role="status"><p>{error} Public reference material remains available; campaign status below is not confirmed.</p><button onClick={reload} type="button">Try again</button></div> : !publication ? <p role="status">Loading the latest public campaign briefing…</p> : null}
    {!known ? <Panel title="Campaign page not found"><Link to={AURORA_PATH}>Return to Aurora VII →</Link></Panel> : section === 'map' || section === 'territories' ? <CampaignMap key={territoryId || "map"} state={state} initialTerritory={territoryId}/> : section === 'register' ? <AuroraRegistration/> : section === 'submit' ? <>{!state.turn ? <Panel title="Game reporting opens with Turn 1"><p>Register now. Lobo will announce the active Turn, its deadline, four Vulnerable Territories and mission briefing before game submissions open.</p><Link to={`${AURORA_PATH}/register`}>Open campaign registration →</Link></Panel> : null}<AuroraGames submit/></> : section === 'games' ? <AuroraGames/> : section === 'missions' ? <CampaignMissions state={state}/> : section === 'standings' ? <CampaignStandings state={state}/> : section === 'story' ? <CampaignStory state={state}/> : section === 'rules' ? <CampaignRules/> : <><CampaignOverview state={state}/><CampaignPromos/></>}
    <footer className="aurora-focused-footer"><Link to="/">Lobo Infinity Portal</Link><Link to={`${AURORA_PATH}/rules`}>Player Rules</Link><a href={LOBO_DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">Discord ↗</a><a href={LOBO_YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer">YouTube ↗</a></footer>
  </main>
}

function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className="panel aurora-panel"><h2>{title}</h2>{children}</section> }
function Paragraphs({ text }: { text: string }) { return <div className="aurora-prose">{text.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div> }
function formatDate(value: string) { const date = new Date(value); return value && Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not announced' }

function CampaignOverview({ state }: { state: AuroraPublicState }) {
  const vulnerable = state.territories.filter(item => item.vulnerable)
  return <section className="aurora-overview-focus"><div>
    <p className="eyebrow">{state.turn ? 'This Turn' : 'A shared frontier. A growing conflict.'}</p>
    <h2>{state.turn ? 'Choose where your next battle matters.' : 'Your faction. Your foothold. Your campaign.'}</h2>
    <p>{state.turn ? 'Agree with your opponent on a Vulnerable Territory or the active Narrative Mission; if you cannot agree, use blind Command Token bidding. One player records both scores; the opponent confirms the result.' : `Join one of ${AURORA_REGISTRATION_FACTIONS.length} factions, including Nomads, and coordinate in your private Discord channel. Every confirmed battle contributes to the campaign.`}</p>
    <p>Choose a Faction Commander and deputy in your private faction channel. <Link to={`${AURORA_PATH}/rules#faction-commanders`}>How faction decisions work →</Link></p>
    {!state.turn ? <><p className="aurora-muted">Twelve weeks · Six Turns · Eleven factions</p><p>Game reporting opens with Lobo’s Turn 1 briefing.</p><Link to={`${AURORA_PATH}/rules`}>How the campaign works →</Link></> : <>
      <h3>Vulnerable Territories</h3><ul className="aurora-overview-targets">{vulnerable.map(item => { const territory = AURORA_TERRITORIES.find(t => t.id === item.id)!; return <li key={item.id}><Link to={`${AURORA_PATH}/territories/${item.id}`}>{territory.name}</Link><span>{territory.vp} VP · {item.controller || 'Controller not announced'}</span></li> })}</ul>
      {state.narrativeMission ? <p><strong>Narrative Mission:</strong> <Link to={`${AURORA_PATH}/missions`}>{state.narrativeMission.title} →</Link></p> : null}
      {state.campaignEvent ? <details className="aurora-info-section"><summary>Campaign Event · {state.campaignEvent.title}</summary><Paragraphs text={state.campaignEvent.rules}/></details> : null}
      <Link to={`${AURORA_PATH}/missions`}>Open this Turn’s complete briefing →</Link>
    </>}
  </div><Link className="aurora-overview-planet" to={`${AURORA_PATH}/map`}><img src="/assets/aurora-vii/v1/frontier-gate.webp" width="1536" height="1024" alt="An expedition approaches Aurora VII’s luminous gate above a frontier settlement"/><span>Explore the campaign map →</span></Link></section>
}

function PromoVideo({ videoId, title }: { videoId: string; title: string }) {
  return <a className="aurora-promo-card" href={youtubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer">
    <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} width="480" height="360" loading="lazy" alt=""/>
    <span><strong>{title}</strong><span>Watch on YouTube ↗</span></span>
  </a>
}

function CampaignPromos() {
  return <section className="panel aurora-panel" aria-labelledby="aurora-promos-title">
    <p className="eyebrow">Race for the Gate</p><h2 id="aurora-promos-title">Watch the campaign promos</h2>
    <p>Discover Aurora VII, then see why your faction is joining the fight.</p>
    <div className="aurora-promo-feature"><PromoVideo videoId={AURORA_TRAILER_ID} title="Aurora VII · Campaign trailer"/></div>
    <details className="aurora-info-section"><summary>Choose your faction · 11 promo videos</summary>
      <div className="aurora-promo-grid">{AURORA_FACTION_PROMOS.map(video => <PromoVideo key={video.faction} videoId={video.videoId} title={video.faction}/>)}</div>
    </details>
    <a href={LOBO_YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer">Visit the Lobo Infinity YouTube channel ↗</a>
  </section>
}

function CampaignMap({ state, initialTerritory }: { state: AuroraPublicState; initialTerritory?: string }) {
  const [selected, setSelected] = useState(() => AURORA_TERRITORIES.some(item => item.id === initialTerritory) ? initialTerritory! : AURORA_TERRITORIES[0].id)
  function selectTerritory(id: string) { setSelected(id) }
  const live = useCampaignActivity(state.turn)
  const [preview, setPreview] = useState(false)
  const activity = preview ? sampleActivity(state.turn) : live.data ?? {turn:state.turn,totals:state.totals,games:[]}
  const knownCount = preview || Boolean(live.data)
  const territory = AURORA_TERRITORIES.find(item => item.id === selected)!
  const published = state.territories.find(item => item.id === selected)
  return <>
    {initialTerritory ? <><Link to={`${AURORA_PATH}/map`}>← Back to the map</Link><Panel title={territory.name}><p className="eyebrow">{territory.settlement} · {territory.vp} VP</p><Paragraphs text={AURORA_LOCATION_DESCRIPTIONS[territory.id] || territory.description}/><LocationActivity activity={activity} location={selected} knownCount={knownCount}/></Panel><TerritoryGuide territory={territory}/></> : <>
    <div className="aurora-map-heading"><h2>Campaign Map</h2><label className="aurora-location-select"><span className="aurora-sr-only">Choose a territory</span><select aria-label="Choose a territory" value={selected} onChange={e => selectTerritory(e.target.value)}>{AURORA_TERRITORIES.map(item => <option key={item.id} value={item.id}>{item.number}. {item.name} · {item.vp} VP{knownCount ? ` · ${locationActivity(activity, item.id).count} battles` : ''}</option>)}</select></label></div>
    {!preview && live.error ? <p className="aurora-muted" role="status">{live.error}</p> : null}
    {preview ? <p className="aurora-sample-notice" role="status">Sample results · demonstration only.</p> : null}
    <section className="aurora-map-grid"><div className="aurora-map-surface"><div className="aurora-map-canvas"><img src="/assets/aurora-vii/v1/campaign-map.svg" width="1536" height="1024" alt="Aurora VII campaign map showing all twelve territories and their printed VP values"/>{AURORA_TERRITORIES.map((item: Territory) => { const count = locationActivity(activity,item.id).count; const vulnerable = state.territories.find(value => value.id === item.id)?.vulnerable; return <div className="aurora-map-marker" key={item.id}><span aria-hidden="true" className={`aurora-mobile-marker${vulnerable ? ' is-vulnerable' : ''}`} data-activity={count > 5 ? 'high' : count > 0 ? 'active' : 'quiet'} style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}>{item.number}{knownCount && (count > 0 || vulnerable) ? <span className="aurora-battle-badge">{count}</span> : null}</span><button type="button" style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }} aria-label={`Select ${item.name}, ${item.vp} VP${vulnerable ? ', Vulnerable this Turn' : ''}${knownCount ? `, ${count} confirmed battles` : ''}`} aria-pressed={selected === item.id} data-activity={count > 5 ? 'high' : count > 0 ? 'active' : 'quiet'} className={vulnerable ? 'is-vulnerable' : undefined} onClick={() => selectTerritory(item.id)}><span>{item.number}</span>{knownCount && (count > 0 || vulnerable) ? <span className="aurora-battle-badge">{count}<span className="aurora-sr-only"> battles</span></span> : null}</button></div> })}</div></div><Panel title={territory.name}><p className="eyebrow">{territory.settlement} · {territory.vp} VP</p><p>{territory.description}</p><dl className="aurora-facts"><div><dt>Current controller</dt><dd>{published?.controller || 'Not announced'}</dd></div><div><dt>This Turn</dt><dd>{published?.vulnerable ? 'Vulnerable — games can affect control' : state.turn ? 'Not Vulnerable' : 'Not announced'}</dd></div></dl>{published?.ruin ? <p className="aurora-tag">Publicly discovered Precursor Ruin</p> : null}{published?.infiltrated ? <p className="aurora-tag">Published Combined Army foothold</p> : null}<LocationActivity activity={activity} location={selected} knownCount={knownCount} sample={preview}/><Link to={`${AURORA_PATH}/territories/${territory.id}`}>View territory details & terrain →</Link></Panel></section>
    <div className="aurora-map-bottom"><p className="aurora-muted">Confirmed battles update activity. Lobo resolves ownership at Turn end.</p><details className="aurora-map-options"><summary>Map key & options</summary><div className="aurora-map-legend"><span>Red ring · Vulnerable</span><span>Badge · Confirmed games</span><span>Glow · More fighting</span></div>{live.updated ? <p className="aurora-muted">Checked at {live.updated} · Refreshes every five minutes. Public results may be cached for up to one minute.</p> : null}<button type="button" onClick={live.reload}>Refresh activity</button><button type="button" aria-pressed={preview} onClick={() => setPreview(value => !value)}>{preview ? 'Return to actual campaign' : 'Preview with sample battles'}</button></details></div>
    {state.narrativeMission || locationActivity(activity,'narrative').count ? <details className="aurora-info-section"><summary>Narrative activity{state.narrativeMission ? ` · ${state.narrativeMission.title}` : ''}</summary><LocationActivity activity={activity} location="narrative" knownCount={knownCount} sample={preview}/></details> : null}
    </>}
  </>
}

function TerritoryGuide({ territory }: { territory: Territory }) {
  return <div id="aurora-terrain-references">
    <Panel title={`${territory.name} terrain references`}>
      <p><Link to={`${AURORA_PATH}/rules#campaign-location-selection`}>Choose the campaign location by agreement or blind Command Token bidding →</Link></p>
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
    </Panel>
  </div>
}

function CampaignMissions({ state }: { state: AuroraPublicState }) {
  const catalog = useSnapshotData<MissionGeistCatalog>('mission-catalog')
  const turn = AURORA_TURNS.find(item => item.turn === state.turn)
  return <>
    <CampaignLocationRules/>
    {!turn ? <Panel title="Mission briefing"><p>Lobo will release the Turn 1 missions and battlefield rules when the campaign begins.</p><Link to={`${AURORA_PATH}/rules`}>Read the Player Rules →</Link></Panel> : <>
      <Panel title="This Turn’s ordinary missions"><div className="aurora-mission-grid">{turn.missions.map((mission: { name: string; reference: string }) => <article key={mission.name}><h3>{mission.name}</h3>{mission.reference !== mission.name ? <p className="aurora-muted">{mission.reference}</p> : null}<MissionReference mission={mission.reference} catalog={catalog.data}/></article>)}</div><p>After choosing the campaign location by agreement or blind Command Token bidding, make a separate Face-to-Face die roll for a territory game. The winner chooses one of these two missions.</p></Panel>
      {state.narrativeMission ? <Panel title="Current Narrative Mission"><h3>{state.narrativeMission.title}</h3><Paragraphs text={state.narrativeMission.briefing}/>{state.narrativeMission.reward ? <p><strong>Announced reward:</strong> {state.narrativeMission.reward}</p> : null}{state.narrativeMission.sheetUrl ? <a href={state.narrativeMission.sheetUrl} target="_blank" rel="noopener noreferrer">Open the current mission sheet ↗</a> : <p>The mission sheet has not been published.</p>}</Panel> : null}
      <p className="aurora-muted">Narrative Mission TP and OP count only toward the Narrative Mission. They do not generate territorial Influence or count toward NA2 Contracts, Tohaa Hidden Hand TP, or CA Infiltration.</p>
    </>}
    <details className="aurora-info-section"><summary>Public ordinary mission rotation</summary><p>From the Player Guide. Narrative Missions, rewards and Campaign Events are released at Turn start.</p><div className="aurora-rotation">{AURORA_TURNS.map(item => <article key={item.turn}><h3>Turn {item.turn} · {item.title}</h3>{item.missions.map((mission: { name: string; reference: string }) => <p key={mission.name}>{mission.name} <span>({mission.reference})</span></p>)}</article>)}</div></details>
  </>
}

function CampaignStandings({ state }: { state: AuroraPublicState }) {
  const rows = [...state.standings].sort((a, b) => b.vp - a.vp || a.faction.localeCompare(b.faction))
  return <>{rows.length ? <Panel title="GM-resolved Campaign VP & control">{rows.length ? <div className="table-wrapper"><table><thead><tr><th scope="col">Faction</th><th scope="col">Campaign VP</th><th scope="col">Territories controlled</th></tr></thead><tbody>{rows.map(item => <tr key={item.faction}><td>{item.faction}</td><td>{item.vp}</td><td>{state.territories.filter(t => t.controller === item.faction).length}</td></tr>)}</tbody></table></div> : <p>Lobo has not published resolved standings yet. Unannounced Campaign VP and ownership are not assumed to be zero.</p>}<p>These are the GM-published standings. Live TP/OP progress below does not change ownership or award Campaign VP. Conquest factions score printed territory VP at the end of Turn 6.</p></Panel> : null}<AuroraResults state={state}/></>
}

function CampaignStory({ state }: { state: AuroraPublicState }) {
  const latest = state.story.at(-1)
  return <>
    <section className="aurora-story-intro"><p className="eyebrow">The public campaign chronicle</p><h2>A world everyone wants. A mystery no one understands.</h2><p>Aurora VII was supposed to be a shared frontier. Now its settlements, resources, and independence are becoming the stakes of a war. This is the world your force is stepping into.</p></section>
    {latest ? <Panel title={latest.title}><p className="eyebrow">Latest published dispatch · {latest.turn ? `Turn ${latest.turn}` : 'Campaign opening'}</p><Paragraphs text={latest.body}/></Panel> : null}
    <details className="aurora-info-section"><summary>The colony’s history</summary><section id="aurora-history" className="panel aurora-panel aurora-story-history"><p className="eyebrow">Before the first battle</p><h2>A Brief History of Aurora VII</h2>{AURORA_HISTORY.map((chapter, index) => <article key={chapter.title}><span className="aurora-story-number" aria-hidden="true">0{index + 1}</span><div><h3>{chapter.title}</h3><Paragraphs text={chapter.body}/></div></article>)}</section></details>
    <section id="aurora-factions" className="panel aurora-panel"><p className="eyebrow">Competing interests</p><h2>Why your faction is here</h2><p>Everyone has a public reason to be on Aurora VII. Some intentions are clearer than others.</p><div className="aurora-motivation-grid">{AURORA_MOTIVATIONS.map(item => <details className="aurora-faction-card" key={item.faction}><summary><h3>{item.faction}</h3><p>{item.body}</p><span className="aurora-faction-expand"><span className="aurora-faction-read">Read faction brief</span><span className="aurora-faction-close">Close faction brief</span><span className="aurora-faction-chevron" aria-hidden="true">⌄</span></span></summary><div className="aurora-faction-brief"><Paragraphs text={item.brief}/>{AURORA_FACTION_PROMOS.filter(video => video.faction === item.faction).map(video => <p key={video.faction}><a href={youtubeWatchUrl(video.videoId)} target="_blank" rel="noopener noreferrer">Watch the {video.faction} promo on YouTube ↗</a></p>)}</div></details>)}</div></section>
    <section id="aurora-releases" className="panel aurora-panel"><p className="eyebrow">As the campaign unfolds</p><h2>Campaign dispatches</h2>{state.story.length ? <>{state.story.slice().reverse().map(chapter => <details key={chapter.turn}><summary>{chapter.turn ? `Turn ${chapter.turn}` : 'Campaign opening'} · {chapter.title}</summary><Paragraphs text={chapter.body}/></details>)}<p>The next dispatch will appear when the GM releases it.</p></> : <p>The opening Turn’s dispatch has not yet been released. As play unfolds, this chronicle will carry the published story chapters alongside the changing map and campaign results.</p>}<Link to={`${AURORA_PATH}/map`}>Explore the places these factions are fighting over →</Link></section>
  </>
}

function CampaignRules() {
  const example = campaignScore(8, 6)
  return <>
    <CampaignLocationRules/>
    <Panel title="Game scores & Tournament Points">
      <p>Enter each player’s Objective Points (OP), from 0 to 10. The form determines the result and calculates Tournament Points (TP) automatically.</p>
      <div className="table-wrapper"><table><thead><tr><th scope="col">Condition</th><th scope="col">TP earned</th></tr></thead><tbody>
        <tr><td>Win (higher OP)</td><td>4 TP</td></tr><tr><td>Draw (equal OP)</td><td>2 TP each</td></tr><tr><td>Loss (lower OP)</td><td>0 TP</td></tr>
        <tr><td>Score at least 5 OP</td><td>+1 TP, for either player</td></tr><tr><td>Lose by no more than 2 OP</td><td>+1 TP for the losing player</td></tr>
      </tbody></table></div>
      <p><strong>Example: 8–6 OP gives {example.tpA}–{example.tpB} TP.</strong> The winner earns 4 + 1 for reaching 5 OP. The loser earns 1 for reaching 5 OP and 1 for losing by two.</p>
      <p>Campaign opponents must belong to different factions. Same-faction games are prohibited for both Territory Battles and Narrative Missions. One submission covers both players. Review the scores, submit, then share the verification link. The opponent confirms or requests a correction. Only confirmed or commissioner-approved results count; late and possible duplicate games also require Lobo’s approval.</p>
    </Panel>
    <section id="faction-commanders" className="panel aurora-panel">
      <h2>Faction Commanders & deputies</h2>
      <p>Each faction selects one Commander and one deputy before the campaign and tells the GM who holds each role. Discuss decisions together first. <strong>If consensus is not reached by the GM’s decision deadline, the Commander makes the final call.</strong> The deputy acts when the Commander is unavailable.</p>
      <ul>
        <li>The Commander coordinates recommended targets and submits one official set of faction decisions to the GM.</li>
        <li>This includes NA2 offers and acceptance, Credit spending, Tohaa Hidden Hand choices, CA Infiltration targets, and any faction choices required by an assigned Secret Objective.</li>
        <li>NA2’s Commander chooses which contract to accept and which service to buy.</li>
        <li>Players remain free to arrange games. Opponents choose the campaign location by agreement or blind Command Token bidding. Recommended targets guide coordination.</li>
        <li>The GM interprets rules and confirms scoring. If both Commander and deputy are unavailable, contact the GM before the decision deadline.</li>
      </ul>
      <p>Keep contract terms, spending, objectives and specialist selections in the private faction channel and submit them privately to the GM.</p>
    </section>
    <details className="aurora-info-section"><summary>Campaign structure</summary><ul>
      <li>12 weeks, divided into six Campaign Turns of two weeks each.</li>
      <li>The GM announces four Vulnerable Territories, two ordinary missions, one Narrative Mission, and the current Campaign Event at Turn start.</li>
      <li>Only Vulnerable Territories can change ownership that Turn.</li>
      <li>Play Infinity normally and report the result with either the chosen Vulnerable Territory or the Narrative Mission as Campaign Location.</li>
      <li>The faction with the most Campaign VP after Turn 6 wins.</li>
    </ul></details>
    <details className="aurora-info-section"><summary>Four ways to fight</summary><div className="aurora-rules-grid">
      <article><h3>Conquest · Human Sphere powers</h3><p>PanOceania, Yu Jing, Ariadna, Haqqislam, Nomads, JSA, ALEPH, and O-12 generate territorial Influence: <strong>1 TP = 1 Influence</strong>. Add applicable Tohaa and NA2 support before resolving control. Most Influence controls the territory at Turn end; tied Influence uses the faction’s own OP. A complete tie retains the current controller. At the end of Turn 6, score the printed VP of controlled territories.</p></article>
      <article><h3>NA2 · Contract Warfare</h3><p>NA2 works through private mercenary contracts rather than claiming territory. Conquest factions, Tohaa, and Combined Army can hire NA2 to support their operations. Discuss hiring with your Faction Commander and use your individual faction guide for the full rules.</p></article>
      <article><h3>Tohaa · The Hidden Hand</h3><p>Tohaa privately selects a Vulnerable Territory, INSTALL or PRESERVE, and a supported Conquest faction. INSTALL means that faction takes control from another controller; PRESERVE means the existing controller retains it. Every complete 5 Tohaa TP there grants +1 Influence to the beneficiary before control resolves. Remainders do not carry forward. If the declared outcome occurs, Tohaa gains +2 VP.</p></article>
      <article><h3>Combined Army · Infiltration</h3><p>CA privately selects a Vulnerable Territory not already Infiltrated. It generates no territorial Influence and must outperform every opposing faction by comparison TP, then its own OP. A complete tie fails. Success grants +2 VP and a permanent operational foothold; normal territorial control remains unchanged. Consult your individual faction guide when hiring NA2 to support an Infiltration operation.</p></article>
    </div></details>
    <details className="aurora-info-section"><summary>Faction Doctrines</summary><p>A successful Doctrine gives +1 Campaign VP, at most once per Turn and at most three times during the campaign.</p>{AURORA_DOCTRINES.map(item => <details key={item.faction}><summary>{item.faction} · {item.name}</summary><p>{item.requirement}</p></details>)}<p>For Nomads, every faction tied for most territories at Turn start counts as a territorial leader. For ALEPH, any territory tied for highest combined earned territorial TP can qualify. Narrative TP is excluded.</p></details>
    <details className="aurora-info-section"><summary>Narrative scoring, objectives, and Ruins</summary><p>All factions can play the Narrative Mission. Its TP and OP are counted separately and do not contribute to territorial Influence, NA2 contract thresholds, Tohaa support, or CA Infiltration. Highest Narrative TP wins; OP breaks ties. If both remain tied, the Narrative Mission is unresolved.</p><p>Completed Secret Objectives give +2 Campaign VP, capped at 6 objective VP per faction. Your own objective is private; the GM-only objective table is not published. An employer cannot count NA2’s victories as its own victories.</p><p>A discovered Precursor Ruin is a permanent territory tag with no inherent VP, TP, OP, Influence, or battlefield bonus. It matters only when another rule specifically refers to it.</p></details>
    <details className="aurora-info-section"><summary>Faction briefings and campaign updates</summary><p>Use your private faction briefing for this Turn’s one-game recommendation, actual scoring requirements, hiring advice and progress tracker. Narrative flavour is labelled separately from strategic recommendations and rules.</p><p>A mid-turn faction dispatch reviews confirmed progress and recommends where the next games will help. It does not change locked contracts or specialist selections. After resolution, a private faction debrief explains results and a separate public report can recognize verified player contributions and territorial changes. Recognition adds no points.</p></details>
    <details className="aurora-info-section"><summary>Public and private information</summary><p>Public: announced map state, printed VP values, controllers, Vulnerable Territories, the current Campaign Event, current Narrative Mission, reported battles, and publicly released discoveries and story.</p><p>Private: faction objectives and strategy, treasuries, bids, accepted contract terms, purchases, Tohaa choices, CA targets, and faction-specific GM briefings. Hidden operations remain private unless the GM releases them. Future Events, Narrative Missions, rewards, and story chapters are not published in advance. Share only your own faction’s files; the combined GM tracking workbook and master pack contain other factions’ private material.</p></details>
  </>
}


function MissionReference({ mission, catalog }: { mission: string; catalog?: MissionGeistCatalog }) {
  const records = catalog ? resolveMissionGeistNavigation({ mission }, catalog.missions).records.filter(record => { try { const url = new URL(record.canonicalUrl); return url.protocol === "https:" && url.hostname === "infinitygeist.com" } catch { return false } }) : []
  return records.length ? <div>{records.map(record => <p key={record.id}><a href={record.canonicalUrl} target="_blank" rel="noopener noreferrer">View {record.name} on Mission Geist ↗</a></p>)}</div> : <p className="aurora-muted">{catalog ? "Mission reference not yet available in the public catalog." : "Loading mission references…"}</p>
}
