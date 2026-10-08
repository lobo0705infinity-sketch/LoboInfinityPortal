import { useEffect, useId, useState } from 'react'
import './CompactArtwork.css'
import { responsiveArtwork } from '../config/responsiveArtwork'
import { getArtworkDimensions } from '../config/artworkDimensions'

type Props = { title: string; eyebrow?: string; src: string; alt?: string; cropAspectRatio?: string }

export default function CompactArtwork(props: Props) {
  const preferenceKey = 'lobo:artwork:v2:global'
  return <ArtworkWithPreference key={preferenceKey} {...props} preferenceKey={preferenceKey}/>
}

function ArtworkWithPreference({ title, eyebrow, src, alt = title, cropAspectRatio, preferenceKey }: Props & { preferenceKey: string }) {
  const artworkId = useId()
  const dimensions = getArtworkDimensions(src)
  const responsive = responsiveArtwork(src)
  const [reduced, setReduced] = useState(() => {
    try { const saved = window.localStorage.getItem(preferenceKey); return saved ? saved === 'reduced' : window.matchMedia('(min-width: 921px)').matches } catch { return false }
  })
  useEffect(()=>{
    const sync=()=>{try{const saved=window.localStorage.getItem(preferenceKey);if(saved)setReduced(saved==='reduced')}catch{/* Storage is optional. */}}
    window.addEventListener('lobo:artwork-preference',sync)
    window.addEventListener('storage',sync)
    return ()=>{window.removeEventListener('lobo:artwork-preference',sync);window.removeEventListener('storage',sync)}
  },[preferenceKey])
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const failed = failedSource === src
  function toggleArtwork() {
    const next = !reduced
    setReduced(next)
    try { window.localStorage.setItem(preferenceKey, next ? 'reduced' : 'full'); window.dispatchEvent(new Event('lobo:artwork-preference')) } catch { /* The control still works when storage is unavailable. */ }
  }
  return <section className="compact-artwork" data-artwork-unavailable={failed || undefined}>
    <div id={artworkId} hidden={reduced} className={cropAspectRatio ? "artwork-cropped" : undefined} style={cropAspectRatio ? { aspectRatio: cropAspectRatio, overflow: "hidden" } : undefined}>{!reduced && (failed ? <p className="compact-artwork-unavailable">Artwork is currently unavailable.</p> : <img className="artwork-full-image" src={responsive.src} srcSet={responsive.srcSet} sizes="(min-width: 921px) calc(100vw - 318px), 100vw" decoding="async" fetchPriority="high" alt={alt} width={dimensions?.[0]} height={dimensions?.[1]} onError={() => setFailedSource(src)}/>)}</div>
    <header className={reduced ? 'compact-artwork-heading' : 'artwork-full-heading'} style={reduced && !failed ? { backgroundImage: `linear-gradient(90deg, #0c1720 20%, rgba(12,23,32,.7) 58%, rgba(12,23,32,.12)), url("${responsive.compact}")` } : undefined}>
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1></div>
    </header>
    <button className="artwork-size-control" type="button" title="Your artwork size preference applies across portal pages." aria-expanded={!reduced} aria-controls={artworkId} onClick={toggleArtwork}>{reduced ? 'Show full artwork' : 'Use compact artwork'}<span aria-hidden="true"> ↕</span></button>
  </section>
}
