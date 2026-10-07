import { useId, useState } from 'react'
import './CompactArtwork.css'

type Props = { title: string; eyebrow?: string; src: string; alt?: string }

export default function CompactArtwork({ title, eyebrow, src, alt = title }: Props) {
  const artworkId = useId()
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const failed = failedSource === src
  return <section className="compact-artwork" data-artwork-unavailable={failed || undefined}>
    <header className="compact-artwork-heading" style={{ backgroundImage: failed ? undefined : `linear-gradient(90deg, #0c1720 20%, rgba(12,23,32,.7) 58%, rgba(12,23,32,.12)), url("${src}")` }}>
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1></div>
    </header>
    <details key={src} className="compact-artwork-disclosure">
      <summary aria-controls={artworkId}><span className="artwork-expand">Expand artwork</span><span className="artwork-collapse">Collapse artwork</span><span aria-hidden="true"> ↕</span></summary>
      {failed ? <p className="compact-artwork-unavailable">Artwork is currently unavailable.</p> : <img id={artworkId} src={src} alt={alt} loading="lazy" onError={() => setFailedSource(src)} />}
    </details>
  </section>
}
