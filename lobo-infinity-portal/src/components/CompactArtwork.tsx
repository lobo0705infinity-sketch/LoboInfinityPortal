import { useId, useState } from 'react'
import { useLocation } from 'react-router-dom'
import './CompactArtwork.css'

type Props = { title: string; eyebrow?: string; src: string; alt?: string }

export default function CompactArtwork(props: Props) {
  const { pathname, search } = useLocation()
  const eventId = new URLSearchParams(search).get('eventId') || 'event-current-league'
  const page = pathname === '/standings'
    ? `/event/${eventId}/standings`
    : pathname === '/rules' ? `${pathname}?eventId=${encodeURIComponent(eventId)}` : pathname
  const preferenceKey = `lobo:artwork:v1:${page}`
  return <ArtworkWithPreference key={preferenceKey} {...props} preferenceKey={preferenceKey}/>
}

function ArtworkWithPreference({ title, eyebrow, src, alt = title, preferenceKey }: Props & { preferenceKey: string }) {
  const artworkId = useId()
  const [reduced, setReduced] = useState(() => {
    try { return window.localStorage.getItem(preferenceKey) === 'reduced' } catch { return false }
  })
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const failed = failedSource === src
  function toggleArtwork() {
    const next = !reduced
    setReduced(next)
    try { window.localStorage.setItem(preferenceKey, next ? 'reduced' : 'full') } catch { /* The control still works when storage is unavailable. */ }
  }
  return <section className="compact-artwork" data-artwork-unavailable={failed || undefined}>
    <div id={artworkId} hidden={reduced}>{failed ? <p className="compact-artwork-unavailable">Artwork is currently unavailable.</p> : <img className="artwork-full-image" src={src} alt={alt} onError={() => setFailedSource(src)}/>}</div>
    <header className={reduced ? 'compact-artwork-heading' : 'artwork-full-heading'} style={reduced && !failed ? { backgroundImage: `linear-gradient(90deg, #0c1720 20%, rgba(12,23,32,.7) 58%, rgba(12,23,32,.12)), url("${src}")` } : undefined}>
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1></div>
    </header>
    <button className="artwork-size-control" type="button" aria-expanded={!reduced} aria-controls={artworkId} onClick={toggleArtwork}>{reduced ? 'Show full artwork' : 'Reduce artwork'}<span aria-hidden="true"> ↕</span></button>
  </section>
}
