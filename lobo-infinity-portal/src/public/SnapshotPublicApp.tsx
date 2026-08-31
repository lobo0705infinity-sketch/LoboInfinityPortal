import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { buildCapabilityNavigationItem } from '../config/eventNavigation'
import { useSnapshotData } from './useSnapshotData'
import SnapshotArmyIntelligence from './SnapshotArmyIntelligence'
import type { PublicArmyList, PublicCommunity, PublicEvent, PublicFaction, PublicGame, PublicMission, PublicPlayer, PublicSchedule, PublicStanding, PublicStandingsDivision, PublicStatistics } from './snapshotTypes'
import './SnapshotPublicApp.css'

const SubmitResult = lazy(() => import('../pages/SubmitResult'))
const SubmitArmyList = lazy(() => import('../pages/SubmitArmyList'))
const Rules = lazy(() => import('../pages/Rules'))

export default function SnapshotPublicApp() {
  return <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/players" element={<Players />} />
    <Route path="/community" element={<Community />} />
    <Route path="/players/:playerName" element={<PlayerProfile />} />
    <Route path="/player/:playerName" element={<PlayerProfile />} />
    <Route path="/games" element={<Games />} />
    <Route path="/games/:id" element={<GameDetail />} />
    <Route path="/game/:id" element={<GameDetail />} />
    <Route path="/standings" element={<Standings />} />
    <Route path="/factions" element={<Factions />} />
    <Route path="/factions/:name" element={<FactionProfile />} />
    <Route path="/faction/:name" element={<FactionProfile />} />
    <Route path="/missions" element={<Missions />} />
    <Route path="/missions/:missionName" element={<MissionProfile />} />
    <Route path="/mission/:missionName" element={<MissionProfile />} />
    <Route path="/compare" element={<Compare />} />
    <Route path="/rivalries" element={<Rivalries />} />
    <Route path="/analytics" element={<Analytics />} />
    <Route path="/hall-of-fame" element={<HallOfFame />} />
    <Route path="/army-lists" element={<ArmyLists />} />
    <Route path="/army-intelligence" element={<SnapshotArmyIntelligence />} />
    <Route path="/intelligence" element={<Navigate replace to="/army-intelligence" />} />
    <Route path="/schedule" element={<Schedule />} />
    <Route path="/league-operations" element={<Schedule />} />
    <Route path="/streams" element={<Community />} />
    <Route path="/events" element={<Events />} />
    <Route path="/event/:eventId" element={<EventPage />} />
    <Route path="/event/:eventId/:section" element={<EventPage />} />
    <Route path="/event/:eventId/tournament/:section" element={<EventPage />} />
    <Route path="/team-tournament" element={<Navigate replace to="/event/event-august-2026-team-tournament" />} />
    <Route path="/submit-game" element={<Suspense fallback={<Loading />}><SubmitResult /></Suspense>} />
    <Route path="/event/:eventId/submit-result" element={<Navigate replace to="/submit-game" />} />
    <Route path="/casual-result" element={<Navigate replace to="/submit-game?gameType=casual" />} />
    <Route path="/army-lists/submit" element={<Suspense fallback={<Loading />}><SubmitArmyList /></Suspense>} />
    <Route path="/rules" element={<Suspense fallback={<Loading />}><Rules /></Suspense>} />
    <Route path="/match-finder" element={<Navigate replace to="/event/event-current-league" />} />
    <Route path="/news" element={<Navigate replace to="/community" />} />
    <Route path="/notifications" element={<Navigate replace to="/community" />} />
    <Route path="/timeline" element={<Navigate replace to="/community" />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
}

function Dashboard() {
  const games = useSnapshotData<PublicGame[]>('games')
  const events = useSnapshotData<PublicEvent[]>('events')
  return <DataGate states={[games, events]}>{() => {
    const programs = [
      { tone: 'league', event: events.data!.find(event => event.id === 'event-current-league'), to: '/event/event-current-league', action: 'View League' },
      { tone: 'top-40', event: events.data!.find(event => event.id === 'event-lobo-s-american-top-40'), to: '/event/event-lobo-s-american-top-40', action: 'View Top 40' },
      { tone: 'team-tournament', event: events.data!.find(event => event.id === 'event-august-2026-team-tournament'), to: '/event/event-august-2026-team-tournament', action: 'View Tournament' }
    ].filter((program): program is { tone: string; event: PublicEvent; to: string; action: string } => Boolean(program.event))
    const quickAccess = [
      ['Players', '/players'], ['Standings', '/standings'], ['Games', '/games'], ['Factions', '/factions'], ['Missions', '/missions'],
      ['Schedule', '/schedule'], ['Community', '/community'], ['Streams', '/streams'], ['Events', '/events'], ['Submit Game', '/submit-game']
    ] as const
    return <Page title="Lobo Infinity Portal" eyebrow="Current public snapshot" intro="Lobo Infinity Portal community command network.">
      <section className="snapshot-dashboard-section snapshot-dashboard-programs" aria-labelledby="dashboard-programs-title">
        <div className="snapshot-dashboard-section-heading">
          <p className="eyebrow">Portal programs</p>
          <h2 id="dashboard-programs-title">What&apos;s Happening</h2>
        </div>
        <div className="snapshot-dashboard-program-grid">
          {programs.map(program => <DashboardProgramCard key={program.tone} {...program} />)}
        </div>
      </section>
      <section className="snapshot-dashboard-section snapshot-dashboard-activity" aria-labelledby="dashboard-activity-title">
        <div className="snapshot-dashboard-section-heading">
          <p className="eyebrow">Across the portal</p>
          <h2 id="dashboard-activity-title">Recent Activity</h2>
        </div>
        <Panel title="Recent Games Across the Portal"><DashboardGameTable games={[...games.data!].slice(-8).reverse()} /></Panel>
      </section>
      <section className="snapshot-dashboard-section snapshot-dashboard-quick-access" aria-labelledby="dashboard-quick-access-title">
        <div className="snapshot-dashboard-section-heading">
          <p className="eyebrow">Navigate the portal</p>
          <h2 id="dashboard-quick-access-title">Quick Access</h2>
        </div>
        <nav className="snapshot-dashboard-link-grid" aria-label="Portal quick access">
          {quickAccess.map(([label, to]) => <Link key={to} to={to}>{label}</Link>)}
        </nav>
      </section>
    </Page>
  }}</DataGate>
}

function DashboardProgramCard({event,to,action,tone}:{event:PublicEvent;to:string;action:string;tone:string}) {
  const metrics: Array<[string,string|number]> = []
  if (event.lifecycleStage && event.lifecycleStage !== event.status) metrics.push(['Stage', event.lifecycleStage])
  metrics.push(['Registered', event.registeredCount], ['Completed Games', event.completedGames])
  return <article className={`snapshot-dashboard-program snapshot-dashboard-program--${tone}`}>
    <div className="snapshot-dashboard-program-heading">
      <p>{event.type}</p><span>{event.status || event.lifecycleStage}</span>
    </div>
    <h3>{event.name}</h3>
    <dl className="snapshot-dashboard-program-metrics">
      {metrics.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}
    </dl>
    <Link className="snapshot-dashboard-program-link" to={to}>{action}</Link>
  </article>
}

function DashboardGameTable({games}:{games:PublicGame[]}) {
  return games.length ? <div className="table-wrapper snapshot-table-shell snapshot-dashboard-games"><table className="snapshot-data-table"><thead><tr><th>Game</th><th>Date</th><th>Players</th><th>Event / Type</th><th>Mission</th><th>TP</th><th>OP</th><th>VP</th></tr></thead><tbody>{games.map(game=><tr key={game.id}><td><Link className="snapshot-game-link" to={`/games/${game.id}`}>#{game.id}</Link></td><td>{formatDate(game.date)}</td><td><strong>{game.winnerDisplayName}</strong><span className="snapshot-versus">vs</span>{game.loserDisplayName}</td><td><span className="snapshot-dashboard-game-event">{game.eventName || game.gameType || '—'}</span>{game.eventName && game.gameType && game.gameType !== game.eventName ? <small>{game.gameType}</small> : null}</td><td><span className="snapshot-table-badge">{game.mission}</span></td><td>{game.tp}</td><td>{game.op}</td><td>{game.vp}</td></tr>)}</tbody></table></div> : <PublicEmptyState message="No public games are available in this snapshot." />
}

function Players() { const state=useSnapshotData<PublicPlayer[]>('players'); return <DataGate states={[state]}>{()=><Page title="Players" eyebrow="Current public directory"><CardGrid>{state.data!.map(p=><LinkCard key={p.player} to={`/players/${encodeURIComponent(p.player)}`} title={p.displayName} meta={`${p.divisionLabel || p.division} · ${p.games} games · ${p.wins}-${p.losses}-${p.draws}`} />)}</CardGrid></Page>}</DataGate> }
function PlayerProfile(){const {playerName=''}=useParams();const players=useSnapshotData<PublicPlayer[]>('players');const games=useSnapshotData<PublicGame[]>('games');return <DataGate states={[players,games]}>{()=>{const p=players.data!.find(x=>x.player===decodeURIComponent(playerName));if(!p)return <Missing label="Player"/>;const history=games.data!.filter(g=>g.winner===p.player||g.loser===p.player);return <Page title={p.displayName} eyebrow={p.divisionLabel||p.division}><MetricGrid items={[['Games',p.games],['Record',`${p.wins}-${p.losses}-${p.draws}`],['TP',p.tp],['OP',p.op],['VP',p.vp],['Faction',p.favoriteArmy||p.favoriteFaction||p.faction||'—']]} /><Panel title="Game History"><GameTable games={history}/></Panel></Page>}}</DataGate>}
function Games(){const state=useSnapshotData<PublicGame[]>('games');return <DataGate states={[state]}>{()=><Page title="Games & Results" eyebrow="Immutable public results"><GameTable games={[...state.data!].reverse()}/></Page>}</DataGate>}
function GameDetail(){const {id=''}=useParams();const state=useSnapshotData<PublicGame[]>('games');return <DataGate states={[state]}>{()=>{const g=state.data!.find(x=>String(x.id)===id);if(!g)return <Missing label="Game"/>;return <Page title={`Game ${g.id}`} eyebrow={`${g.eventName} · ${g.division}`} intro={`${g.winnerDisplayName} vs ${g.loserDisplayName}`}><MetricGrid items={[['Winner',g.winnerDisplayName],['Mission',g.mission],['TP',g.tp],['OP',g.op],['VP',g.vp],['Date',formatDate(g.date)]]}/><Panel title="Factions"><p>{g.winnerFaction} vs {g.loserFaction}</p></Panel>{g.bestMoment?<Panel title="Best Moment"><p>{g.bestMoment}</p></Panel>:null}</Page>}}</DataGate>}
function Standings(){const state=useSnapshotData<PublicStandingsDivision[]>('standings');const [params]=useSearchParams();return <DataGate states={[state]}>{()=>params.get('eventId')==='event-current-league'?<CurrentLeagueStandings divisions={state.data!}/>:<Page title="Current League Standings" eyebrow="Snapshot standings">{state.data!.map(d=><Panel key={d.division} title={d.divisionLabel}><StandingsTable rows={d.standings}/></Panel>)}</Page>}</DataGate>}
function CurrentLeagueStandings({divisions}:{divisions:PublicStandingsDivision[]}){const mainMan=divisions.find(division=>division.divisionLabel==='Main Man')??divisions[0];const [selectedDivision,setSelectedDivision]=useState(mainMan?.division??'');const selected=divisions.find(division=>division.division===selectedDivision)??mainMan;if(!selected)return <Missing label="Standings"/>;return <main className="portal-shell snapshot-public-page snapshot-current-league-standings" data-page="current-league-standings"><header className="snapshot-standings-hero"><p className="eyebrow">July 2026 League</p><h1>Current League Standings</h1></header><nav className="snapshot-standings-division-switcher" aria-label="Current League standings divisions">{divisions.map(division=><button type="button" key={division.division} aria-pressed={selected.division===division.division} onClick={()=>setSelectedDivision(division.division)}>{division.divisionLabel}</button>)}</nav><section className="snapshot-standings-division-heading"><h2>{selected.divisionLabel}</h2><span>{selected.standings.length} Players</span></section><section className="panel snapshot-standings-table-panel"><StandingsTable rows={selected.standings} expandedHeaders/></section></main>}
function Factions(){const state=useSnapshotData<PublicFaction[]>('factions');return <DataGate states={[state]}>{()=><Page title="Factions" eyebrow="Faction performance"><CardGrid>{state.data!.map(f=><LinkCard key={f.name} to={`/factions/${encodeURIComponent(f.name)}`} title={f.name} meta={`${f.games} games · ${f.wins}-${f.losses}-${f.draws} · ${formatPercent(f.winRate)}`} />)}</CardGrid></Page>}</DataGate>}
function FactionProfile(){const {name=''}=useParams();const factions=useSnapshotData<PublicFaction[]>('factions');return <DataGate states={[factions]}>{()=>{const f=factions.data!.find(x=>x.name===decodeURIComponent(name));if(!f)return <Missing label="Faction"/>;return <Page title={f.name} eyebrow="Faction Profile"><MetricGrid items={[['Games',f.games],['Record',`${f.wins}-${f.losses}-${f.draws}`],['Win Rate',formatPercent(f.winRate)],['Average TP',f.averageTP],['Average OP',f.averageOP],['Average VP',f.averageVP],['Top Player',f.topPlayerDisplayName||f.topPlayer],['Most Played Mission',f.mostPlayedMission]]}/></Page>}}</DataGate>}
function Missions(){const state=useSnapshotData<PublicMission[]>('missions');return <DataGate states={[state]}>{()=><Page title="Missions" eyebrow="Mission performance"><CardGrid>{state.data!.map(m=><LinkCard key={m.mission} to={`/missions/${encodeURIComponent(m.mission)}`} title={m.mission} meta={`${m.games} games · ${formatPercent(m.firstTurnWinRate)} first-turn win rate`} />)}</CardGrid></Page>}</DataGate>}
function MissionProfile(){const {missionName=''}=useParams();const state=useSnapshotData<PublicMission[]>('missions');return <DataGate states={[state]}>{()=>{const m=state.data!.find(x=>x.mission===decodeURIComponent(missionName));if(!m)return <Missing label="Mission"/>;return <Page title={m.mission} eyebrow="Mission Profile"><MetricGrid items={[['Games',m.games],['Average TP',m.averageTP],['Average OP',m.averageOP],['Average VP',m.averageVP],['First-turn Win Rate',formatPercent(m.firstTurnWinRate)],['Most Successful Faction',m.mostSuccessfulFaction],['Most Played Faction',m.mostPlayedFaction],['Last Played',formatDate(m.lastPlayed)]]}/></Page>}}</DataGate>}

function Compare(){const players=useSnapshotData<PublicPlayer[]>('players');const [params,setParams]=useSearchParams();return <DataGate states={[players]}>{()=>{const left=params.get('left')||players.data![0]?.player||'';const right=params.get('right')||players.data![1]?.player||'';const selected=[players.data!.find(p=>p.player===left),players.data!.find(p=>p.player===right)];return <Page title="Compare Players" eyebrow="Snapshot comparison"><div className="snapshot-filter-row">{[left,right].map((value,index)=><select key={index} value={value} onChange={e=>{const next=new URLSearchParams(params);next.set(index?'right':'left',e.target.value);setParams(next)}}>{players.data!.map(p=><option key={p.player} value={p.player}>{p.displayName}</option>)}</select>)}</div><div className="snapshot-compare-grid">{selected.map(p=>p?<Panel key={p.player} title={p.displayName}><MetricGrid items={[['Games',p.games],['Wins',p.wins],['TP',p.tp],['OP',p.op],['VP',p.vp]]}/></Panel>:null)}</div></Page>}}</DataGate>}
function Rivalries(){const games=useSnapshotData<PublicGame[]>('games');return <DataGate states={[games]}>{()=>{const pairs=new Map<string,{players:string;games:number}>();for(const g of games.data!){const names=[g.winnerDisplayName,g.loserDisplayName].sort();const key=names.join('|');const row=pairs.get(key)??{players:names.join(' vs '),games:0};row.games++;pairs.set(key,row)}return <Page title="Rivalries" eyebrow="Head-to-head history"><CardGrid>{[...pairs.values()].sort((a,b)=>b.games-a.games).slice(0,30).map(r=><article className="panel snapshot-card" key={r.players}><h2>{r.players}</h2><p>{r.games} games</p></article>)}</CardGrid></Page>}}</DataGate>}
function Analytics(){const factions=useSnapshotData<PublicFaction[]>('factions');const missions=useSnapshotData<PublicMission[]>('missions');const games=useSnapshotData<PublicGame[]>('games');return <DataGate states={[factions,missions,games]}>{()=><Page title="League Statistics" eyebrow="Snapshot analytics"><MetricGrid items={[['Games',games.data!.length],['Factions',factions.data!.length],['Missions',missions.data!.length],['Most Active Faction',[...factions.data!].sort((a,b)=>b.games-a.games)[0]?.name||'—'],['Most Played Mission',[...missions.data!].sort((a,b)=>b.games-a.games)[0]?.mission||'—']]}/></Page>}</DataGate>}
function HallOfFame(){const stats=useSnapshotData<PublicStatistics[]>('statistics');return <DataGate states={[stats]}>{()=>{const s=stats.data![0]??{};return <Page title="Hall of Fame" eyebrow="League records"><ObjectPanels value={s.records??s.leaders??s}/></Page>}}</DataGate>}

function ArmyLists(){const state=useSnapshotData<PublicArmyList[]>('army-lists');return <DataGate states={[state]}>{()=><Page title="Army Lists" eyebrow="Public submitted lists"><div className="table-wrapper"><table><thead><tr><th>Player</th><th>Faction</th><th>Mission</th><th>Opponent</th><th>Result</th><th>List</th></tr></thead><tbody>{state.data!.map(l=><tr key={l.id}><td>{l.playerDisplayName||l.player}</td><td>{l.sectorial||l.faction}</td><td>{l.mission}</td><td>{l.opponentDisplayName||l.opponent}</td><td>{l.result}</td><td>{l.armyLink?<a href={l.armyLink} rel="noreferrer" target="_blank">Open</a>:'—'}</td></tr>)}</tbody></table></div></Page>}</DataGate>}
function Schedule(){const state=useSnapshotData<PublicSchedule[]>('schedule');return <DataGate states={[state]}>{()=>{const s=state.data![0];return <Page title="Schedule / Mission & Map" eyebrow={s?.currentSeason||'League Operations'}><MetricGrid items={[['Event',s?.eventName||'—'],['League Week',s?.weekNumber||'—'],['Updated',formatDate(s?.updatedAt||'')]]}/><Panel title="Missions"><CardGrid>{(s?.missions??[]).map(m=><article className="snapshot-card" key={m.mission}><h3>{m.mission}</h3><p>{m.maps?.join(' · ')||'Map assignment pending'}</p></article>)}</CardGrid></Panel></Page>}}</DataGate>}
function Community(){const state=useSnapshotData<PublicCommunity[]>('community');return <DataGate states={[state]}>{()=>{const c=state.data![0]??({} as PublicCommunity);return <Page title="Community" eyebrow={c.settings?.discordServerName||'Lobo Infinity League'}><MetricGrid items={[['Streams',c.streams?.length??0],['News',c.news?.length??0],['Timeline Updates',c.timeline?.length??0]]}/><RecordList title="News" records={c.news}/><RecordList title="Streams" records={c.streams}/><RecordList title="Timeline" records={c.timeline}/></Page>}}</DataGate>}
function Events(){const state=useSnapshotData<PublicEvent[]>('events');return <DataGate states={[state]}>{()=><Page title="Events" eyebrow="Public event network"><CardGrid>{state.data!.map(e=><LinkCard key={e.id} to={`/event/${e.id}`} title={e.name} meta={`${e.type} · ${e.status}`} />)}</CardGrid></Page>}</DataGate>}

function EventPage(){const {eventId='',section='overview'}=useParams();const events=useSnapshotData<PublicEvent[]>('events');const games=useSnapshotData<PublicGame[]>('games');const standings=useSnapshotData<PublicStandingsDivision[]>('standings');const schedule=useSnapshotData<PublicSchedule[]>('schedule');return <DataGate states={[events,games,standings,schedule]}>{()=>{const event=events.data!.find(e=>e.id===eventId);if(!event)return <Missing label="Event"/>;const eventGames=games.data!.filter(g=>g.eventId===event.id);const isLeague=event.id==='event-current-league';const isTeam=/team tournament/i.test(event.type);const nav=isLeague?['overview','standings','schedule','registration']:isTeam?['overview','teams','pairings','results','registration']:['overview','players','bracket','rounds','missions','results','registration'];return <main className="portal-shell snapshot-public-page snapshot-event-page" data-event={isLeague&&section==='overview'?'current-league-overview':undefined}><EventHero event={event}/><PublicTabs eventId={event.id} items={nav}/><MetricGrid items={[['Status',event.status||event.lifecycleStage],['Registered',event.registeredCount??event.participants?.length??0],['Completed Games',event.completedGames??eventGames.length],['Start',formatDate(event.startDate)],['End',formatDate(event.endDate)]]}/><EventSection section={section} event={event} games={eventGames} standings={standings.data!} schedule={schedule.data!}/></main>}}</DataGate>}
function EventSection({section,event,games,standings,schedule}:{section:string;event:PublicEvent;games:PublicGame[];standings:PublicStandingsDivision[];schedule:PublicSchedule[]}){if(section==='standings')return <>{standings.map(d=><Panel key={d.division} title={d.divisionLabel}><StandingsTable rows={d.standings}/></Panel>)}</>;if(section==='statistics')return <MetricGrid items={[['Games',games.length],['Players',event.registeredCount||event.participants?.length||0],['Rounds',event.rounds?.length||0]]}/>;if(section==='schedule')return <Panel title="Mission & Map"><RecordList records={schedule[0]?.missions??[]}/></Panel>;if(section==='teams')return <RecordList title="Teams" records={event.teams}/>;if(section==='pairings')return <RecordList title="Pairings" records={event.pairings}/>;if(section==='bracket')return <RecordList title="Bracket" records={event.bracket}/>;if(section==='rounds')return <RecordList title="Rounds" records={event.rounds}/>;if(section==='missions')return <RecordList title="Missions" records={event.bracketMissions}/>;if(section==='players'||section==='registration')return <RecordList title={section==='players'?'Participants':'Registration'} records={event.participants}/>;if(section==='results')return <Panel title="Results"><GameTable games={games}/></Panel>;if(event.id==='event-current-league')return <CurrentLeagueOverview event={event} games={games}/>;return <section className="snapshot-event-overview"><Panel title="Event Overview"><p className="snapshot-overview-copy">{event.rules||event.description||'Public event information will be updated in the next snapshot.'}</p></Panel><Panel title="Recent Results"><GameTable games={[...games].slice(-8).reverse()}/></Panel></section>}
function CurrentLeagueOverview({event,games}:{event:PublicEvent;games:PublicGame[]}){const rulesDestination=buildCapabilityNavigationItem({id:event.id},'rules').to;return <section className="snapshot-event-overview snapshot-current-league-overview"><Panel title="League Rules"><p className="snapshot-overview-copy">{event.rules||event.description||'Public event information will be updated in the next snapshot.'}</p><Link className="snapshot-league-rules-cta" to={rulesDestination}>View League Rules</Link></Panel><Panel title="Recent Results"><GameTable games={[...games].slice(-8).reverse()}/></Panel></section>}

function EventHero({event}:{event:PublicEvent}){return <header className={`snapshot-event-hero ${/tournament/i.test(event.type)?'tournament':'league'}`}><div><p className="eyebrow">{event.type}</p><h1>{event.name}</h1>{event.description?<p className="snapshot-event-tagline">{event.description}</p>:null}</div><span className="snapshot-event-status">{event.status||event.lifecycleStage}</span></header>}
function PublicTabs({eventId,items}:{eventId:string;items:string[]}){const {pathname}=useLocation();return <nav aria-label="Event sections" className="snapshot-tabs">{items.map(item=>{const to=`/event/${eventId}${item==='overview'?'':`/${item}`}`;const active=pathname===to||(item==='overview'&&pathname===`/event/${eventId}/overview`);return <Link aria-current={active?'page':undefined} className={active?'active':undefined} key={item} to={to}>{titleCase(item)}</Link>})}</nav>}

function DataGate({states,children}:{states:Array<{data?:unknown;error?:string}>;children:()=>ReactNode}){const error=states.find(s=>s.error)?.error;if(error)return <main className="portal-shell"><section className="dashboard-state"><p role="alert">{error}</p></section></main>;if(states.some(s=>s.data===undefined))return <Loading/>;return <>{children()}</>}
function Loading(){return <main className="portal-shell"><section className="dashboard-state"><p>Loading public snapshot…</p></section></main>}
function Missing({label}:{label:string}){return <Page title={`${label} not found`} eyebrow="Snapshot data"><p>The requested {label.toLowerCase()} is not present in this snapshot.</p></Page>}
function NotFound(){return <Missing label="Page"/>}
function Page({title,eyebrow,intro,children}:{title:string;eyebrow:string;intro?:string;children:ReactNode}){return <main className="portal-shell snapshot-public-page" data-page={title==='Lobo Infinity Portal'?'dashboard':undefined}><section className="page-header"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{intro?<p>{intro}</p>:null}</section>{children}</main>}
function Panel({title,children}:{title:string;children:ReactNode}){return <section className="panel snapshot-panel"><div className="panel-heading"><p className="eyebrow">Public Snapshot</p><h2>{title}</h2></div><div className="snapshot-panel-body">{children}</div></section>}
function MetricGrid({items}:{items:Array<[string,string|number]>}){return <section className="snapshot-metric-grid">{items.map(([label,value],index)=><article className={`snapshot-metric-card tone-${index%4}`} key={label}><span>{label}</span><strong>{value||'—'}</strong></article>)}</section>}
function CardGrid({children}:{children:ReactNode}){return <section className="snapshot-card-grid">{children}</section>}
function LinkCard({to,title,meta}:{to:string;title:string;meta:string}){return <Link className="panel snapshot-card snapshot-link-card" to={to}><h2>{title}</h2><p>{meta}</p></Link>}
function StandingsTable({rows,expandedHeaders=false}:{rows:PublicStanding[];expandedHeaders?:boolean}){return <div className="table-wrapper"><table><thead><tr><th>Rank</th><th>Player</th><th>{expandedHeaders?'Games':'G'}</th><th>{expandedHeaders?'Wins':'W'}</th><th>{expandedHeaders?'Losses':'L'}</th><th>{expandedHeaders?'Draws':'D'}</th><th>TP</th><th>OP</th><th>VP</th></tr></thead><tbody>{rows.map(r=><tr key={r.player}><td>{r.rank}</td><td><Link to={`/players/${encodeURIComponent(r.player)}`}>{r.displayName||r.player}</Link></td><td>{r.games}</td><td>{r.wins}</td><td>{r.losses}</td><td>{r.draws}</td><td>{r.tp}</td><td>{r.op}</td><td>{r.vp}</td></tr>)}</tbody></table></div>}
function GameTable({games}:{games:PublicGame[]}){return games.length?<div className="table-wrapper snapshot-table-shell"><table className="snapshot-data-table"><thead><tr><th>Game</th><th>Date</th><th>Players</th><th>Mission</th><th>TP</th><th>OP</th><th>VP</th></tr></thead><tbody>{games.map(g=><tr key={g.id}><td><Link className="snapshot-game-link" to={`/games/${g.id}`}>#{g.id}</Link></td><td>{formatDate(g.date)}</td><td><strong>{g.winnerDisplayName}</strong><span className="snapshot-versus">vs</span>{g.loserDisplayName}</td><td><span className="snapshot-table-badge">{g.mission}</span></td><td>{g.tp}</td><td>{g.op}</td><td>{g.vp}</td></tr>)}</tbody></table></div>:<PublicEmptyState message="No public games are available in this snapshot."/>}
function PublicEmptyState({message}:{message:string}){return <div className="snapshot-empty-state"><strong>No data yet</strong><p>{message}</p></div>}
function RecordList({title,records=[]}:{title?:string;records?:Array<Record<string,unknown>>}){return <Panel title={title||'Details'}>{records.length?<div className="snapshot-record-list">{records.map((record,index)=><article className="snapshot-record" key={index}>{Object.entries(record).filter(([,v])=>['string','number','boolean'].includes(typeof v)).slice(0,8).map(([k,v])=><p key={k}><strong>{titleCase(k)}:</strong> {String(v)}</p>)}</article>)}</div>:<PublicEmptyState message="No public entries are available in this snapshot."/>}</Panel>}
function ObjectPanels({value}:{value:unknown}){if(!value||typeof value!=='object')return <Panel title="Records"><p>No public records are available.</p></Panel>;return <div className="snapshot-record-list">{Object.entries(value as Record<string,unknown>).slice(0,30).map(([key,val])=><article className="panel snapshot-record" key={key}><h3>{titleCase(key)}</h3><p>{typeof val==='object'?JSON.stringify(val):String(val)}</p></article>)}</div>}
function formatDate(value:string){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleDateString()}
function formatPercent(value:number){return `${value>1?value:(value*100)}%`}
function titleCase(value:string){return value.replace(/([A-Z])/g,' $1').replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).trim()}
