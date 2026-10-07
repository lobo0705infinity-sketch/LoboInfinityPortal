import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { portalGuideChapters } from './portalGuideChapters'
import './PortalGuide.css'

const videoUrl = '/assets/portal-guide/walkthrough-bradley-v1.mp4'

export default function PortalGuide() {
  const player = useRef<HTMLVideoElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [failed, setFailed] = useState(false)
  const chapterId = searchParams.get('chapter')
  const selected = portalGuideChapters.find(chapter => chapter.id === chapterId)
  const start = selected?.start ?? 0

  useEffect(() => {
    const video = player.current
    if (!video) return
    const seek = () => { video.currentTime = start }
    if (video.readyState >= 1) seek()
    else video.addEventListener('loadedmetadata', seek, { once: true })
    return () => video.removeEventListener('loadedmetadata', seek)
  }, [start])

  return <main className="portal-shell portal-guide-page">
    <header className="page-header">
      <p className="eyebrow">Get started · 4 minutes</p>
      <h1>Portal Guide</h1>
      <p>Find a game, prepare for it, submit your result, and explore the Lobo community.</p>
    </header>
    <section aria-label="Portal walkthrough video">
      <video ref={player} className="portal-guide-video" controls playsInline preload={selected ? 'metadata' : 'none'}
        poster="/assets/portal-guide/poster-v1.jpg" onError={() => setFailed(true)} aria-label="Lobo Infinity Portal walkthrough with Bradley narration">
        <source src={`${videoUrl}#t=${start}`} type="video/mp4" />
        <track kind="captions" src="/assets/portal-guide/captions-v1.vtt" srcLang="en" label="English"/>
        <track kind="chapters" src="/assets/portal-guide/chapters-v1.vtt" srcLang="en" label="Chapters" />
        Your browser does not support embedded video. <a href={videoUrl}>Open the walkthrough</a>.
      </video>
      {failed ? <p role="alert">The video could not load. <a href={videoUrl}>Open the video directly</a> or try again.</p> : null}
      <p className="portal-guide-player-note">{selected ? `Ready at ${selected.title}. Press play to watch.` : 'Press play to start, or choose a chapter below.'} <a href={videoUrl}>Open video</a></p>
    </section>
    <section className="portal-guide-chapters" aria-labelledby="portal-guide-chapters-title">
      <h2 id="portal-guide-chapters-title">Jump to a chapter</h2>
      <nav aria-label="Video chapters">{portalGuideChapters.map(chapter => <button type="button" key={chapter.id}
        aria-current={chapter.id === chapterId ? 'true' : undefined}
        onClick={() => {
          if (player.current) player.current.currentTime = chapter.start
          setSearchParams({ chapter: chapter.id }, { replace: true })
        }}>
        <time>{Math.floor(chapter.start / 60)}:{String(Math.floor(chapter.start % 60)).padStart(2, '0')}</time>
        <span>{chapter.title}</span><span aria-hidden="true">▶</span>
      </button>)}</nav>
    </section>
    <details className="portal-guide-transcript"><summary>Read the narration</summary>
<p>Welcome to the Lobo Infinity Portal. This walkthrough shows you how to find a game, prepare for it, submit your result, and explore the community.</p>
<p>On the dashboard, scroll to Choose Your First Move. These three cards take you to Army Intelligence, a battle report, or the events page. Public browsing is open to everyone.</p>
<p>Select All Events in the sidebar. Open the event you want to join and check its registration status. For casual games, use the Game Network or find players on Discord.</p>
<p>Use the event selector in the sidebar to choose your competition. The links below it lead to that event. In Standings, choose your division to see the players and recorded scores.</p>
<p>Before arranging a league game, open Mission and Map. Check the date range, the active missions, and the assigned maps. View Mission opens the scenario details from Mission Geist.</p>
<p>Open the T T S Map Library to preview tables. Scroll down to search by map name, filter by named mission setup, or sort by highest rated. Check the collection for your event.</p>
<p>Open a table card to inspect its terrain. The overhead view shows the layout, and the angled view shows heights and cover. Use the Workshop collection link, then match the bag name shown here.</p>
<p>After playing, select Submit Game. Choose the form that matches your game: League, Team Tournament, Casual, or Top Forty. Each button opens its own Google Form. Check your scores with your opponent before submitting.</p>
<p>Open Battle Reports to browse recorded games. Each row shows the players, mission, and scores. Click the game number to open the full report.</p>
<p>The report shows the objective points, tournament points, and victory points. Scroll for the mission summary, map, highlights, and review. Battle stories are fictionalized; use the recorded results and player notes for the factual account.</p>
<p>Open Army Intelligence. Choose a faction or sectorial, or try the Corregidor example. This page explores submitted lists, common profiles, specialist coverage, and battlefield roles.</p>
<p>Use Combat, Defense, Control, or All to browse tactical roles. Read the exact weapon and linked status next to each rating. The global percentile shows its standing in the wider benchmark, while usage describes submitted lists.</p>
<p>Open Factions to explore armies and sectorials through their recorded league results. Scroll to the army you want, then open its card for a closer look. Read the game count alongside its record and win rate: these describe games submitted to the portal.</p>
<p>Open Players to browse the community. Use the event filter for All Events or a specific competition. Each card shows a player’s division, game count, and record. Open a card to view their profile, then scroll to Game History to explore their recorded games.</p>
<p>Open Missions and choose an event, or leave All Events selected. View Mission opens the available scenario details. Click a mission name for its analysis, including recorded games, first-turn win rate, faction performance, and recent battle reports. Read the number of games alongside each percentage.</p>
<p>Open Lobo’s Little Helper for the updated guide and Discord link. In Discord, start with slash help. Use slash list analyse with an Army code for a readable roster, legality summary, and two D Tabletop Simulator export. Tactical Brief, Ratings, Classifieds, and T T S Notes open privately through buttons. Use slash combat matchup to compare two profiles, slash combat counters for reactive answers, and slash play for availability and game requests.</p>
<p>You are ready to use the portal. Find an event or an opponent, check your mission and map, play your game, and submit the result. Return for reports, rankings, and inspiration for your next list.</p>
    </details>
    <p><Link to="/explore">Explore the portal →</Link></p>
  </main>
}
