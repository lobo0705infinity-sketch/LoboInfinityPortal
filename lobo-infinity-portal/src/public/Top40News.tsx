import { Link } from 'react-router-dom'
import type { PublicEvent, PublicGame } from './snapshotTypes'
import { buildTop40Bulletins } from './top40ResultsModel'

export default function Top40News({ event, games }: { event: PublicEvent; games: PublicGame[] }) {
  const bulletins = buildTop40Bulletins(event, games)
  const latestUpset = bulletins.find((item) => item.gap >= 8)
  const spotlight = latestUpset && bulletins.reduce((best, item) =>
    item.bracket === best.bracket && item.round === best.round && item.gap > best.gap ? item : best,
  latestUpset)
  const recent = bulletins.filter((item) => item !== spotlight).slice(0, spotlight ? 3 : 4)

  return (
    <section className="panel event-home-panel" aria-labelledby="top40-news-heading">
      <div className="panel-heading">
        <p className="eyebrow">Tournament bulletins</p>
        <h2 id="top40-news-heading">Top 40 News</h2>
      </div>
      {!bulletins.length && <p>Upsets and eliminations will appear here as match results are published.</p>}
      <div className="event-home-timeline">
        {(spotlight ? [spotlight, ...recent] : recent).map((item) => (
          <article key={item.gameId}>
            <span>{item === spotlight ? 'Upset of the Round' : item.label} · {item.bracket}{item.round !== item.bracket ? ` · ${item.round}` : ''}</span>
            <strong><Link to={`/games/${item.gameId}`}>{item.headline}</Link></strong>
            {item.detail && <p>{item.detail}</p>}
          </article>
        ))}
      </div>
    </section>
  )
}
