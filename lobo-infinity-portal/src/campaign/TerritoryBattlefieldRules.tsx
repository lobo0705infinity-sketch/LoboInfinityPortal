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
    <div className="aurora-owner-advantage">
      <h3>Territory owner advantage</h3>
      <p><strong>{rule.ownerTitle}</strong></p>
      <p>{rule.owner}</p>
    </div>
  </section>
}
