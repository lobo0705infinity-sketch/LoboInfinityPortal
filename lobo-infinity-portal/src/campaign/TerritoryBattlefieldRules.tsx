import { AURORA_RULES_REVISION, AURORA_SPECIAL_RULES_PDF_URL } from '../config/auroraTerritoryVideos'
import type { AuroraMapRegion } from '../../shared/aurora-map-catalog.mjs'
import './TerritoryBattlefieldRules.css'

export default function TerritoryBattlefieldRules({ region }: { region: AuroraMapRegion }) {
  const { rule } = region
  return <section className="aurora-battlefield-rules" aria-labelledby={`battlefield-${region.id}`}>
    <p className="eyebrow">{region.name} · Both missions</p>
    <h2 id={`battlefield-${region.id}`}>{rule.title}</h2>
    <p className="aurora-muted">Rules updated {AURORA_RULES_REVISION} · <a href={AURORA_SPECIAL_RULES_PDF_URL} target="_blank" rel="noopener noreferrer">All territory rules (PDF) ↗</a></p>
    <p className="aurora-battlefield-description">{rule.description}</p>
    <h3>Battlefield rules · Both players</h3>
    <ul>{rule.effect.split(/\n\s*\n/).filter(Boolean).map(effect => <li key={effect}>{effect}</li>)}</ul>
    {region.id === 'frostreach-wastes' ? <figure className="aurora-blizzard-template">
      <img src="/assets/aurora-vii/blizzard-template-r24.png" width="1024" height="1024" alt="Five-inch blizzard template with ten arrows labelled 1/11 through 10/20" loading="lazy"/>
      <figcaption>Roll separately for each storm. Follow the arrow bearing the result for 6 inches; keep the template’s orientation fixed.</figcaption>
      <p><a href="/guides/lobo-frostreach-r24-maps-installer.zip">Download Frosthold and Polar TTS maps with three blizzard templates each (R24)</a></p>
    </figure> : null}
    <div className="aurora-owner-advantage">
      <h3>Territory owner advantage</h3>
      <p><strong>{rule.ownerTitle}</strong></p>
      <p>{rule.owner}</p>
    </div>
  </section>
}
