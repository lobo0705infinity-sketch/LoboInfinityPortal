import { useState } from 'react'
import TerritoryVideoThumbnail from './TerritoryVideoThumbnail'
import { AURORA_TERRITORY_VIDEOS } from '../config/auroraTerritoryVideos'
import { youtubeWatchUrl } from '../config/promoVideos'
import './TerritoryVideo.css'

export default function TerritoryVideo({ territoryId, territoryName }: { territoryId: string; territoryName: string }) {
  const video = AURORA_TERRITORY_VIDEOS[territoryId]
  const [playing, setPlaying] = useState(false)
  if (!video) return null

  return <section className="aurora-territory-video panel" aria-labelledby={`video-${territoryId}`}>
    <p className="eyebrow">Territory briefing</p>
    <h2 id={`video-${territoryId}`}>Watch the {territoryName} guide</h2>
    {video.rulesUpdate ? <p className="aurora-muted">{video.rulesUpdate}</p> : null}
    <div className="aurora-video-frame">
      {playing ? video.fileUrl ? <video
        src={video.fileUrl}
        aria-label={video.title}
        controls
        autoPlay
        playsInline
        preload="metadata"
      /> : <iframe
        src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0`}
        title={video.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      /> : <button className="aurora-video-poster" type="button" aria-label={`Play ${territoryName} video guide`} onClick={() => setPlaying(true)}>
        <TerritoryVideoThumbnail videoId={video.videoId} src={video.thumbnailUrl} />
        <span><span aria-hidden="true">▶</span> Play territory guide</span>
      </button>}
    </div>
    <p className="aurora-video-links"><a href={video.fileUrl || youtubeWatchUrl(video.videoId)} target="_blank" rel="noopener noreferrer">{video.fileUrl ? 'Open video ↗' : 'Watch on YouTube ↗'}</a>{playing ? <button type="button" onClick={() => setPlaying(false)}>Close player</button> : null}</p>
    <p className="aurora-muted">Use the written battlefield rules below for the current rules and owner advantage.</p>
  </section>
}

