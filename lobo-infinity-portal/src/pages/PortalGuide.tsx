import { Link, useSearchParams } from 'react-router-dom'
import { portalGuideChapters } from './portalGuideChapters'
import './PortalGuide.css'

const videoUrl = 'https://www.youtube.com/watch?v=9doT_9mcISQ'
const chapterUrl = (start: number) => `${videoUrl}&t=${Math.floor(start)}s`

export default function PortalGuide() {
  const [searchParams] = useSearchParams()
  const chapterId = searchParams.get('chapter')
  const selected = portalGuideChapters.find(chapter => chapter.id === chapterId)

  return <main className="portal-shell portal-guide-page">
    <header className="page-header">
      <p className="eyebrow">Get started · 7 minutes 36 seconds</p>
      <h1>Portal Guide</h1>
      <p>Find a game, prepare for it, submit your result, and explore the Lobo community.</p>
    </header>
    <section aria-label="Portal walkthrough video">
      <a className="portal-guide-youtube" href={selected ? chapterUrl(selected.start) : videoUrl} target="_blank" rel="noopener noreferrer">
        <img className="portal-guide-video" src="/assets/portal-guide/poster-v2.jpg" alt="Lobo Infinity Portal walkthrough" width="1920" height="1080" />
        <span className="portal-guide-watch"><span aria-hidden="true">▶</span> Watch on YouTube</span>
      </a>
      <p className="portal-guide-player-note">{selected ? `Watch from ${selected.title} on YouTube.` : 'Watch the updated walkthrough on YouTube, or choose a chapter below.'} Opens in a new tab.</p>
      <p className="portal-guide-player-note">Bradley narrates the tour, including Aurora VII registration, campaign reporting, and the Discord tools.</p>
    </section>
    <section className="portal-guide-chapters" aria-labelledby="portal-guide-chapters-title">
      <h2 id="portal-guide-chapters-title">Jump to a chapter on YouTube</h2>
      <nav aria-label="Video chapters">{portalGuideChapters.map(chapter => <a key={chapter.id}
        href={chapterUrl(chapter.start)} target="_blank" rel="noopener noreferrer"
        aria-current={chapter.id === chapterId ? 'true' : undefined}>
        <time>{Math.floor(chapter.start / 60)}:{String(Math.floor(chapter.start % 60)).padStart(2, '0')}</time>
        <span>{chapter.title}</span><span aria-hidden="true">▶</span>
      </a>)}</nav>
    </section>
    <details className="portal-guide-transcript"><summary>Read narration and on-screen instructions</summary>
<p><strong>Welcome:</strong> Welcome to the Lobo Infinity Portal. This tour will help you find a game, prepare your army, record your result, and take part in the community, including the Aurora Seven campaign.</p>
<p><strong>Start on the dashboard:</strong> Start with Choose Your First Move on the dashboard. You can explore Army Intelligence, read a battle report, or find an event. Below, the featured report and recent games show what people have been playing. Public browsing is open to everyone.</p>
<p><strong>Navigation and artwork:</strong> Use the sidebar for the main sections, or Explore for the wider directory. Search helps you find portal content, and the links above a page take you back to its parent section. On illustrated pages, Show Full Artwork and Use Compact Artwork let you choose how much space the banner takes.</p>
<p><strong>Find your next game:</strong> All Events brings together the league, team tournament, American Top Forty, and Aurora Seven. Open an event to check its rules and registration status. For a casual game, join the Game Network or connect with players on Discord.</p>
<p><strong>Follow your event:</strong> The event selector changes the competition shown in the sidebar. Its links take you to the overview, registration, standings, schedule, and rules. In league standings, find your division to see recorded games, tournament points, objective points, and victory points.</p>
<p><strong>Prepare for a league game:</strong> Before a league game, open Mission and Map. Check the current date range, active missions, and assigned tables. View Mission opens the available scenario reference through Mission Geist. Read the actual mission rules before you set up.</p>
<p><strong>Choose a TTS table:</strong> The Tabletop Simulator Map Library lets you search by table name, filter named mission setups, and sort by player ratings. Choose the collection for your event. A mission label describes that particular Workshop save; other terrain layouts can be adapted by placing objectives according to your scenario.</p>
<p><strong>Inspect the terrain:</strong> Open a table card for overhead and angled views. Use them to check approach lanes, heights, and cover. Follow the Workshop collection link and match the bag name shown on the page. The detail page also links to recorded games played on that table.</p>
<p><strong>Report an ordinary game:</strong> After playing, select Submit Game and choose the form for League, Team Tournament, Casual, or Top Forty. Check both players&#x27; scores and army codes before submitting. Aurora Seven has its own campaign reporting flow, which we will cover shortly.</p>
<p><strong>Find a battle report:</strong> Battle Reports lists recorded games across the portal. Search for a player or report, filter by mission or event, and choose the date order. Select a game number to open its result, submitted highlight, and review.</p>
<p><strong>Read the full report:</strong> The report brings together the scores, mission, table, player highlight, and submitted armies. Scroll for the game review and battle story. Stories are fictionalized scenes inspired by the game; the recorded scores and player notes are the factual account. Use the linked army lists and mission results to explore further.</p>
<p><strong>Explore Army Intelligence:</strong> In Army Intelligence, choose a faction or sectorial, or start with the Corregidor example. You can explore submitted-list composition, order counts, specialist coverage, and tactical roles. Filters for skills, weapons, equipment, and troop type help you narrow the profiles to the job you need.</p>
<p><strong>Browse and open army lists:</strong> Select Known Army Lists to open the list directory with your faction already selected. Search, filter by faction or mission, and select a column heading to sort. On desktop, View List opens the roster in Corvus Belli Infinity Army.</p>
<p><strong>Use lists on your phone:</strong> On your phone, tap Copy Army Code, then paste it into Infinity Army&#x27;s import tool. The faction filter still follows you from Known Army Lists, so you can browse the same army on either device.</p>
<p><strong>Understand profile rankings:</strong> Use Combat, Defense, Control, or All to explore tactical roles. Global rank compares a profile across armies; in-faction rank compares it within the selected army. Match the exact weapon and linked state when comparing ratings. Submitted-list popularity shows how often a profile appears, rather than how strong it is in the benchmark.</p>
<p><strong>Explore faction results:</strong> Factions is the army directory. Open an army or sectorial to explore its recorded performance and related games. Read the game count alongside its record and win rate: a small number of submissions can produce a very large percentage.</p>
<p><strong>Meet the players:</strong> The Players directory shows the community, with an event filter for a specific competition or all events. Open a player card for their profile and recorded history. Follow a game link to see the result and the armies they brought.</p>
<p><strong>Explore missions and streams:</strong> In Missions, select an event and open a mission&#x27;s analysis to explore recorded results. Use Choose Mission Version where several references are available, or View Mission for a direct reference. Always read percentages with their game counts. Streams is where you can find linked videos of community games.</p>
<p><strong>Aurora VII campaign:</strong> Aurora Seven is a twelve-week narrative campaign across six turns. Open it from the sidebar, All Events, or Explore. Its own navigation leads to the campaign map and results, while Information holds the mission briefing, player rules, and public campaign story.</p>
<p><strong>Join a campaign faction:</strong> To join, choose an available faction, enter your player name, and select Register. Complete the Discord account confirmation. Lobo&#x27;s Little Helper records your signup and assigns your faction role and private channel access. Your faction choice is locked after registration; contact Lobo if it needs correcting.</p>
<p><strong>Read the current briefing:</strong> Read the current mission briefing and player rules before arranging a campaign game. They explain the active turn, vulnerable territories, narrative mission, and battlefield conditions. While the campaign is awaiting its first turn, reporting opens when Lobo announces that turn.</p>
<p><strong>Follow fighting on the map:</strong> Select a territory on the map or use the territory selector. Its panel shows the current controller, this turn&#x27;s activity, and a link to terrain details. Confirmed battles update activity and influence. Ownership is resolved by Lobo at turn end, so the current controller and this turn&#x27;s leader can differ.</p>
<p><strong>Report and confirm a campaign game:</strong> Use My Games with the Discord account registered for the campaign. When reporting opens, Submit Campaign Game records one result for both players. Choose an opponent from a different faction, the game type and location, then enter both objective scores. Tournament points are calculated for you. Review the result and share its verification link; your opponent confirms it or requests a correction.</p>
<p><strong>Campaign results and private claims:</strong> Campaign Results shows confirmed games and standings once play begins. Pending or disputed games do not count, and narrative totals stay separate from territory battles. Submit any private objective claim separately through your game review; it is visible only to you and Lobo.</p>
<p><strong>Discord list and combat tools:</strong> Open Lobo&#x27;s Little Helper for the Discord command guide. Start with slash help. Slash list analyse turns an Army code into a readable roster, legality summary, and two-dimensional Tabletop Simulator export, with private detail buttons. Slash list build offers guided lists; slash list random offers a random legal list. Use slash combat matchup for two profiles, or slash combat counters for reactive options.</p>
<p><strong>Rules, missions and finding a game:</strong> Slash rules answers rules questions with cited sources, slash mission looks up scenarios, and slash list identify makes a printable model reference. Use slash play availability to share recurring times, or slash play find now for a one-off request. Include your local time and time zone so other players know when you can play.</p>
<p><strong>Your next move:</strong> Choose an event or campaign faction, find an opponent, and check your mission and table. Play, report the result, and return for the reports and ideas that will help you prepare for your next game.</p>
    </details>
    <p><Link to="/explore">Explore the portal →</Link></p>
  </main>
}
