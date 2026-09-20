import { useEffect, useMemo, useState } from 'react'
import { lookupMobility, mobilityKey, type MobilityCatalog, type MobilityRecord } from '../../bot/mobility-lookup.mjs'
import type { ArmyIntelligenceList } from '../services/api'

export default function ArmyMobility({ lists }: { lists: ArmyIntelligenceList[] }) {
  const [catalog, setCatalog] = useState<MobilityCatalog | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    import('../data/mobility-index.json').then(module => { if (active) setCatalog(module.default) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [])
  const result = useMemo(() => {
    const rows = new Map<string, { id: string; unit: string; profile: string; mobility: MobilityRecord; count: number }>()
    let unavailable = 0
    let stationary = 0
    for (const list of lists) for (const group of list.decoded?.combatGroups ?? []) for (const entry of group.entries) {
      const mobility = lookupMobility(catalog, entry.combinedId)
      if (mobility?.status === 'no-movement') { stationary++; continue }
      if (mobility?.status !== 'rated') { unavailable++; continue }
      const id = mobilityKey(entry.combinedId)!
      const row = rows.get(id)
      if (row) row.count++
      else rows.set(id, { id, unit: entry.unit, profile: entry.profile, mobility, count: 1 })
    }
    return { rows: [...rows.values()].sort((a, b) => b.mobility.score! - a.mobility.score! || a.unit.localeCompare(b.unit)).slice(0, 12), unavailable, stationary }
  }, [catalog, lists])
  return <section className="panel" aria-labelledby="army-mobility-title">
    <h2 id="army-mobility-title">Mobility</h2>
    <p>Top movement profiles in the selected lists. This 0–100 index is separate from combat ratings.</p>
    {!catalog ? <p>{failed ? 'Mobility ratings are currently unavailable.' : 'Loading mobility ratings…'}</p> : <>
      <div className="army-intelligence-tactical-grid">{result.rows.map(row => <article className="army-intelligence-tactical-panel" key={row.id}>
        <header><h3>{row.unit} · {row.mobility.score!.toFixed(1)}/100</h3><p>{row.profile}{row.mobility.form ? ` · ${row.mobility.form}` : ''}</p></header>
        <div className="army-intelligence-tactical-badges">
          <span>MOV {row.mobility.mov?.join('–')}″</span><span>Travel {row.mobility.travel}″</span>
          {row.mobility.jump !== null ? <span>Jump + action {row.mobility.jump}″</span> : null}
          {row.mobility.climb !== null ? <span>Climb + action {row.mobility.climb}″</span> : null}
        </div>
        <p>{row.count} {row.count === 1 ? 'model' : 'models'} across selected lists</p>
      </article>)}</div>
      {!result.rows.length ? <p>No rated movement profiles in these lists.</p> : null}
      {result.unavailable > 0 ? <p>{result.unavailable} model entries have no resolved mobility rating.</p> : null}
      {result.stationary > 0 ? <p>{result.stationary} model entries have no MOV and are excluded.</p> : null}
    </>}
    <details><summary>How Mobility is scored</summary>
      <p>Move or jump before an action: 25%. Open travel: 15%. Vertical movement with an action: 12%; whole-order vertical movement: 8%. Gaps with an action: 12%; whole-order gaps: 3%. A turning 10″ jump with an action: 10%. Difficult Terrain: 10%. Expected Normal Dodge movement: 5%.</p>
      <p>Distances are inches. Travel is the best legal open-ground distance in one order. Scenarios assume clear paths and legal landings, with equal frequency of the five Difficult Terrain types. Deployment skills, enemy reactions, cover and mission objectives are outside this index. Weights are design choices, not measured win probabilities.</p>
    </details>
  </section>
}
