import { TOP40_ROUND_MAPS } from '../../shared/top40-round-maps.mjs'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import CompactArtwork from '../components/CompactArtwork'
import EventSectionTabs from '../components/EventSectionTabs'
import InfinityArmyLink from '../components/InfinityArmyLink'
import { getEventNavigationConfig } from '../config/eventNavigation'
import { resolveMissionGeistNavigation } from '../config/missionGeistNavigation'
import { loboWorkshopMaps, LOBO_WORKSHOP_URL } from '../../shared/lobo-workshop-maps.mjs'
import type { MissionGeistCatalog } from '../services/publicSnapshot'
import type { PublicArmyList, PublicEvent, PublicSchedule } from './snapshotTypes'
import { useSnapshotData } from './useSnapshotData'
import { activePreparationMatches, buildPreparationAssignments, groupPublicEventLists, isTop40Registration, preparationDate, top40RegistrationState, TOP40_PLANNED_OPENING_LABEL, TOP40_EVENT_ID, type PreparationAssignment } from './top40PreparationModel'
import './Top40PreparationPage.css'

const checklistKey = 'lobo:event-preparation:v1:top40'
const checklistItems = ['Read the tournament rules', 'Check the assigned mission and map', 'Arrange a time with your opponent']

export default function Top40PreparationPage() {
  const events = useSnapshotData<PublicEvent[]>('events')
  const registrations = useSnapshotData<unknown>('top-40-registrations')
  const schedules = useSnapshotData<PublicSchedule[]>('schedule')
  const armyLists = useSnapshotData<PublicArmyList[]>('army-lists')
  const catalog = useSnapshotData<MissionGeistCatalog>('mission-catalog')
  const event = events.data?.find(item => item.id === TOP40_EVENT_ID)
  const registration = isTop40Registration(registrations.data) ? registrations.data : null
  const state = top40RegistrationState(event)
  const assignments = event ? buildPreparationAssignments(event, schedules.data ?? []) : []
  const matches = event ? activePreparationMatches(event) : []
  const listGroups = groupPublicEventLists(armyLists.data ?? [], TOP40_EVENT_ID)
  const config = getEventNavigationConfig(TOP40_EVENT_ID)
  const [checked, setChecked] = useState<boolean[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(checklistKey) || 'null'); if (Array.isArray(saved) && saved.length === 3 && saved.every(item => typeof item === 'boolean')) return saved } catch { /* Device storage is optional. */ }
    return checklistItems.map(() => false)
  })
  function toggle(index: number) {
    const next = checked.map((value, position) => position === index ? !value : value)
    setChecked(next)
    try { localStorage.setItem(checklistKey, JSON.stringify(next)) } catch { /* The checklist still works without storage. */ }
  }

  return <main className="portal-shell snapshot-public-page top40-preparation-page" data-event="top40-preparation">
    <CompactArtwork title="Lobo’s Top 40" eyebrow="Event preparation" src="/assets/events/top-40-overview-v2.png"/>
    <EventSectionTabs eventId={TOP40_EVENT_ID} items={['overview', 'registration', 'bracket', 'results', 'rules']}/>
    <header className="top40-preparation-heading"><div><p className="eyebrow">300 points · Double elimination</p><h1>Get ready for the tournament</h1><p>Registration, deadlines, missions, maps, and public army lists in one place.</p></div><span>Planned opening: {TOP40_PLANNED_OPENING_LABEL}</span></header>
    <section className="panel top40-preparation-panel top40-player-briefing" aria-labelledby="top40-briefing-title">
      <div>
        <p className="eyebrow">Player briefing</p>
        <h2 id="top40-briefing-title">Watch the briefing and keep the handout</h2>
        <p>How the bracket works, choosing armies and lists, scheduling your match, missions and maps, reporting results, and the Grand Final reset.</p>
        <p>4 minutes 14 seconds · Captions included</p>
        <div className="top40-preparation-actions"><a className="button top40-preparation-primary" href="/guides/Lobos-Top-40-Player-Handout-20261101.pdf" target="_blank" rel="noopener noreferrer">Open player handout (PDF) ↗</a><a href="/guides/Lobos-Top-40-Player-Briefing-20261101.mp4" download>Download video (MP4)</a></div>
      </div>
      <video controls playsInline preload="none" poster="/assets/events/top-40-bracket.png" aria-label="Lobo’s Top 40 player briefing">
        <source src="/guides/Lobos-Top-40-Player-Briefing-20261101.mp4" type="video/mp4"/>
        <track kind="captions" src="/guides/Lobos-Top-40-Player-Briefing-20261101.vtt" srcLang="en" label="English"/>
        <p><a href="/guides/Lobos-Top-40-Player-Briefing-20261101.mp4">Download the player briefing video</a>.</p>
      </video>
    </section>
    {events.error ? <DataNotice message="Event details are temporarily unavailable." retry={events.retry}/> : null}
    <div className="top40-preparation-grid">
      <div className="top40-preparation-stack">
        <PreparationPanel title="Registration">
          <div className="top40-preparation-status">{state === 'open' ? 'Registration open' : state === 'closed' ? 'Registration closed' : events.error ? 'Status unavailable' : !events.data ? 'Loading registration status…' : 'Check registration status'}</div>
          {registration ? <p><strong>{registration.players.length} players registered</strong></p> : registrations.error || registrations.data !== undefined ? <DataNotice message="The registration roster is temporarily unavailable." retry={registrations.retry}/> : <p>Loading the registration roster…</p>}
          <p>Signup can exceed 40 players. After registration closes, the Commissioner selects the final field of up to 40. Registration does not guarantee selection.</p>
          <div className="top40-preparation-actions">{state === 'open' && config?.registrationUrl ? <a className="button top40-preparation-primary" href={config.registrationUrl} target="_blank" rel="noopener noreferrer">Register now ↗</a> : null}<Link to={`/event/${TOP40_EVENT_ID}/registration`}>See registered players →</Link></div>
          {registration ? <small>Roster updated {preparationDate(registration.generatedAt)}</small> : null}
        </PreparationPanel>
        <PreparationPanel title="Dates & deadlines">
          <dl className="top40-preparation-facts"><Fact label="Planned opening" value={TOP40_PLANNED_OPENING_LABEL}/><Fact label="Release" value="Manual release by the Organizer; clocks remain paused until release"/><Fact label="Registration closes" value={state === 'closed' ? 'Closed' : 'To be announced'}/><Fact label="Complete your match" value="At least 7 full days once it becomes active"/></dl>
          {matches.length ? <ul className="top40-preparation-matches">{matches.map((match, index) => <li key={match.id || index}><strong>{match.playerA || 'Player pending'} vs {match.playerB || 'Player pending'}</strong><span>{match.id} · Deadline: {match.deadline ? preparationDate(match.deadline) : 'Awaiting assignment'}</span></li>)}</ul> : <p className="top40-preparation-divider">Specific match deadlines will appear here when matches become active.</p>}
          <Link to={`/event/${TOP40_EVENT_ID}/bracket`}>View tournament bracket →</Link>
        </PreparationPanel>
        <PreparationPanel title="Before your first game">
          {checklistItems.map((label, index) => <label className="top40-preparation-check" key={label}><input type="checkbox" checked={checked[index]} onChange={() => toggle(index)}/><span>{label}</span></label>)}
          <p role="status">{checked.filter(Boolean).length} of 3 checked</p><small>Saved on this device. These are personal reminders.</small>
        </PreparationPanel>
      </div>
      <div className="top40-preparation-stack">
        <PreparationPanel title="Missions & maps">
          {events.error ? <p>Assignments are temporarily unavailable.</p> : !events.data ? <p>Loading mission assignments…</p> : assignments.length ? assignments.map(assignment => <MissionAssignment key={assignment.id} assignment={assignment} catalog={catalog.data}/>) : <div className="top40-preparation-empty"><h3>Mission pool pending</h3><p>The complete mission pool will be published before the tournament begins. Use the assigned mission for each match or bracket round.</p></div>}
          {assignments.length && assignments.every(item => !item.mission) ? <p>The complete mission pool will be published before the tournament begins.</p> : null}
          {schedules.error ? <DataNotice message="The mission and map schedule is temporarily unavailable." retry={schedules.retry}/> : null}
          <div className="top40-preparation-actions"><Link to="/maps">Browse the map library →</Link><a href={LOBO_WORKSHOP_URL} target="_blank" rel="noopener noreferrer">Open TTS Workshop ↗</a></div>
        </PreparationPanel>
        <PreparationPanel title="Army lists">
          <p>You can change your army and your army list between rounds. You are not required to use the same army or list throughout the tournament. Keep every list within the 300-point limit.</p>
          {armyLists.error ? <DataNotice message="Published event lists are temporarily unavailable." retry={armyLists.retry}/> : !armyLists.data ? <p>Loading published lists…</p> : listGroups.length ? <div className="top40-preparation-lists">{listGroups.map(group => <details key={group.player}><summary>{group.displayName} <span>{group.lists.length} {group.lists.length === 1 ? 'list' : 'lists'}</span></summary>{group.lists.map(list => <article key={list.id}><h3>{list.armyName || list.sectorial || list.faction || 'Army list'}</h3><p>{list.mission || 'Mission not specified'} · {preparationDate(list.date)}</p>{list.opponentDisplayName || list.opponent ? <p>vs {list.opponentDisplayName || list.opponent}</p> : null}<div className="top40-preparation-actions">{list.armyLink ? <InfinityArmyLink mobileCopyOnly href={list.armyLink}>View List</InfinityArmyLink> : <span>Army code unavailable</span>}{list.gameId ? <Link to={`/games/${list.gameId}`}>View game →</Link> : null}</div></article>)}</details>)}</div> : <div className="top40-preparation-empty"><h3>No public event lists yet</h3><p>Published Top 40 lists will appear here, grouped by player and game.</p></div>}
          <Link to="/army-lists">Browse community lists →</Link>
        </PreparationPanel>
        <PreparationPanel title="Rules at a glance"><dl className="top40-preparation-facts"><Fact label="Army size" value="300 points"/><Fact label="Elimination" value="After your second loss"/><Fact label="Draw tiebreak" value="Victory Points, then Organizer ruling"/></dl><Link to={`/event/${TOP40_EVENT_ID}/rules`}>Read full tournament rules →</Link></PreparationPanel>
      </div>
    </div>
  </main>
}

function PreparationPanel({ title, children }: { title: string; children: ReactNode }) { return <section className="panel top40-preparation-panel" aria-label={title}><h2>{title}</h2>{children}</section> }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }
function DataNotice({ message, retry }: { message: string; retry: () => void }) { return <div className="top40-preparation-notice"><p>{message}</p><button type="button" onClick={retry}>Try again</button></div> }
function MissionAssignment({ assignment, catalog }: { assignment: PreparationAssignment; catalog?: MissionGeistCatalog }) {
  const references = catalog && assignment.mission ? resolveMissionGeistNavigation(assignment, catalog.missions).records.filter(record => {
    try { const url = new URL(record.canonicalUrl); return url.protocol === 'https:' && url.hostname === 'infinitygeist.com' } catch { return false }
  }) : []
  return <article className="top40-preparation-assignment"><p className="eyebrow">{assignment.label}</p><h3>{assignment.mission || 'Mission awaiting announcement'}</h3><p>Assigned maps: {assignment.maps.length ? assignment.maps.map((name, index) => { const tournamentMap = TOP40_ROUND_MAPS.find(item => item.workshopLabel === name); const map = loboWorkshopMaps.find(item => item.slug === name || item.name === name || item.workshopName === name || item.workshopBagName === name); return <span key={name}>{index ? ' · ' : ''}{tournamentMap ? <Link to={tournamentMap.href}>{tournamentMap.workshopLabel} — {tournamentMap.name}</Link> : /Lobo.*(?:Map 1|Map#1)/i.test(name) ? <Link to="/event/lobos-top-40/map-1">Lobo Tourney Map 1 — Asterion Research Campus</Link> : map ? <Link to={`/maps/${map.slug}`}>{map.name}</Link> : name}</span> }) : 'TBD'}</p>{references.map(record => <a key={record.id} href={record.canonicalUrl} target="_blank" rel="noopener noreferrer">View {record.name} on Mission Geist ↗</a>)}{assignment.mission && !references.length ? <Link to={`/missions/${encodeURIComponent(assignment.mission)}?eventId=${TOP40_EVENT_ID}`}>View mission details →</Link> : null}</article>
}
