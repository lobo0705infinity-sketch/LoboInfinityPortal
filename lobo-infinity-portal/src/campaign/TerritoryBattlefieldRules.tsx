import { ownerAdvantageStatus } from '../../shared/aurora-campaign-policy.mjs'
import type { AuroraPublicState } from './auroraTypes'
import { AURORA_SPECIAL_RULES_PDF_URL } from '../config/auroraTerritoryVideos'
import type { AuroraMapRegion } from '../../shared/aurora-map-catalog.mjs'
import './TerritoryBattlefieldRules.css'

export default function TerritoryBattlefieldRules({ region, state }: { region: AuroraMapRegion; state?: AuroraPublicState }) {
  const { rule } = region
  return <section className="aurora-battlefield-rules" aria-labelledby={`battlefield-${region.id}`}>
    <p className="eyebrow">{region.name} · All territorial missions</p>
    <h2 id={`battlefield-${region.id}`}>{rule.title}</h2>
    <p className="aurora-muted"><a href={AURORA_SPECIAL_RULES_PDF_URL} target="_blank" rel="noopener noreferrer">All territory rules (PDF) ↗</a></p>
    <p className="aurora-battlefield-description">{rule.description}</p>
    <h3>Battlefield rules · Both players</h3>
    <ul>{rule.effect.split(/\n\s*\n/).filter(Boolean).map(effect => <li key={effect}>{effect}</li>)}</ul>
    {region.id === 'frostreach-wastes' ? <figure className="aurora-blizzard-template">
      <img src="/assets/aurora-vii/blizzard-template-r24.png" width="1024" height="1024" alt="Five-inch blizzard template with ten arrows labelled 1/11 through 10/20" loading="lazy"/>
      <figcaption>Roll separately for each storm. Follow the arrow bearing the result for 6 inches; keep the template’s orientation fixed.</figcaption>
      <p><a href="/guides/lobo-frostreach-r24-maps-installer.zip">Download Frosthold and Polar TTS maps with three blizzard templates each</a></p>
    </figure> : null}
    <div className="aurora-owner-advantage">
      <h3>Territory owner advantage</h3>{state?.turn ? <p className="aurora-owner-status"><strong>{ownerAdvantageStatus(state, region.id) === 'pending' ? 'Owner advantage selection pending' : `Owner advantage ${ownerAdvantageStatus(state, region.id)}`}</strong> · Turn {state.turn}</p> : <p>Only the Turn-start controller receives this benefit. From Turn 3, check the published owner-advantage selection.</p>}
      {state?.ownerAdvantages?.owners[region.id] ? <p>Turn-start owner: {state.ownerAdvantages.owners[region.id]}. Only that faction’s registered players receive an active benefit.</p> : null}
      <p><strong>{rule.ownerTitle}</strong></p>
      <p>{rule.owner}</p>
    </div>
  </section>
}
