import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { youtubeWatchUrl } from '../config/promoVideos'
import { LOBO_DISCORD_INVITE_URL } from '../config/communityLinks'
import TerritoryVideoThumbnail from './TerritoryVideoThumbnail'
import './TerritoryVideo.css'

export const AURORA_GUIDE_ID = 'o5ppi9ezv_o'
export const AURORA_GUIDE_PATH = '/campaign/aurora-vii/guide'

export function AuroraGuideLink({ children = 'Watch the player guide' }: { children?: ReactNode }) {
  return <Link to={AURORA_GUIDE_PATH}>{children} →</Link>
}

export function AuroraGuidePreview() {
  return <section className="aurora-guide-preview" aria-labelledby="guide-preview-title">
    <Link className="aurora-guide-preview-image" to={AURORA_GUIDE_PATH} aria-label="Open the 3-minute player guide"><TerritoryVideoThumbnail videoId={AURORA_GUIDE_ID}/><span aria-hidden="true">▶ 3:12</span></Link>
    <div><p className="eyebrow">Your first game</p><h2 id="guide-preview-title">Plan. Play. Report.</h2><p>From your faction briefing to a confirmed result, the player guide walks you through one campaign game.</p><AuroraGuideLink/><p className="aurora-muted"><Link to="/campaign/aurora-vii/rules#faction-commanders">Choose your Commander and deputy →</Link></p></div>
  </section>
}

export default function AuroraPlayerGuide() {
  const [playing, setPlaying] = useState(false)
  return <section id="player-guide" className="panel aurora-panel aurora-player-guide" aria-labelledby="player-guide-title">
    <p className="eyebrow">Start here · 3:12 player guide</p>
    <h2 id="player-guide-title">Plan, Play &amp; Report</h2>
    <p>Follow one campaign game from your faction briefing to a confirmed result.</p>
    <div className="aurora-guide-layout"><div>
      <div className="aurora-video-frame">{playing ? <iframe src={`https://www.youtube-nocookie.com/embed/${AURORA_GUIDE_ID}?autoplay=1&rel=0`} title="Aurora VII Player Guide: Plan, Play & Report" allow="autoplay; encrypted-media; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/> : <button className="aurora-video-poster" type="button" aria-label="Play Aurora VII player guide" onClick={() => setPlaying(true)}><TerritoryVideoThumbnail videoId={AURORA_GUIDE_ID}/><span><span aria-hidden="true">▶</span> Play player guide</span></button>}</div>
      <p className="aurora-video-links"><a href={youtubeWatchUrl(AURORA_GUIDE_ID)} target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a>{playing ? <button type="button" onClick={() => setPlaying(false)}>Close player</button> : null}</p>
    </div><div>
      <h3>Your next game</h3>
      <ol className="aurora-player-checklist">
        <li><a href={LOBO_DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">Read your private faction briefing in Discord</a> and coordinate targets and opponents. Confirm any mercenary contract with NA2 and the GM before games begin.</li>
        <li><Link to="/campaign/aurora-vii/missions">Check the current Turn briefing</Link>, then agree on a Vulnerable Territory or the Narrative Mission. <Link to="/campaign/aurora-vii/rules#campaign-location-selection">Use blind bidding if needed.</Link></li>
        <li><Link to="/campaign/aurora-vii/map">Check ownership on the map</Link> and read the chosen territory’s current rules before finalizing your army.</li>
        <li>Confirm the mission and Campaign Event with your opponent, then play.</li>
        <li><Link to="/campaign/aurora-vii/submit">Submit one result for both players</Link>, share the verification link, and submit before the announced deadline. Opponent confirmation verifies the report; the scoring caps select which verified results count.</li>
      </ol>
    </div></div>
    <p className="aurora-muted">The video follows a Conquest faction. NA2, Tohaa, and Combined Army use their own scoring paths; check your private faction briefing.</p>
    <p className="aurora-muted">Use the Turn briefing and <Link to="/campaign/aurora-vii/rules">Player Rules</Link> for available battlefields, missions, events, and rewards. Keep objectives and plans in your private faction channel.</p>
  </section>
}
