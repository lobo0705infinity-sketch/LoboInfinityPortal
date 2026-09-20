import { repairArmyProfile } from '../../bot/profile-audit.mjs'
import { useEffect, useMemo, useState } from 'react'
import { lookupMobileGunfighter, type MobileGunfighterCatalog, type MobileGunfighterRating } from '../../bot/mobile-gunfighter.mjs'
import { mobilityKey } from '../../bot/mobility-lookup.mjs'
import type { ArmyIntelligenceList } from '../services/api'

export default function ArmyMobileGunfighter({ lists }: { lists: ArmyIntelligenceList[] }) {
  const [catalog, setCatalog] = useState<MobileGunfighterCatalog | null>(null)
  const [failed, setFailed] = useState(false)
  const [state, setState] = useState<'normal' | 'fireteam'>('normal')
  useEffect(() => {
    let active = true
    import('../data/mobile-gunfighter.json').then(module => { if (active) setCatalog(module.default) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [])
  const result = useMemo(() => {
    const rows = new Map<string, { id: string; unit: string; profile: string; weapons: string; rating: MobileGunfighterRating; count: number }>()
    let unavailable = 0
    for (const list of lists) for (const group of list.decoded?.combatGroups ?? []) for (const entry of group.entries) {
      const rating = lookupMobileGunfighter(catalog, entry.combinedId, state)
      if (!rating) { unavailable++; continue }
      const id = mobilityKey(entry.combinedId)!
      const row = rows.get(id)
      if (row) row.count++
      else rows.set(id, { id, unit: entry.unit, profile: entry.profile, weapons: repairArmyProfile(entry).weapons.join(' · '), rating, count: 1 })
    }
    return { rows: [...rows.values()].sort((a, b) => b.rating.score - a.rating.score || a.id.localeCompare(b.id)).slice(0, 12), unavailable }
  }, [catalog, lists, state])
  return <section aria-labelledby="mobile-gunfighter-title">
    <h3 id="mobile-gunfighter-title">Mobile Gunfighter · 85/15</h3>
    <p>85% anchored Gunfighter rating + 15% raw Mobility. A Gunfighter rating of 50 maps to 100; higher ratings stay capped at 100. Percentiles are informational only, and the combined score is not a win probability.</p>
    <label>Combat state <select value={state} onChange={event => setState(event.target.value as 'normal' | 'fireteam')}>
      <option value="normal">Non-linked</option><option value="fireteam">Linked +1SD potential</option>
    </select></label>
    {state === 'fireteam' ? <p>Potential linked performance from the benchmark catalog. This does not confirm that these models form a legal or active Fireteam in the selected lists.</p> : null}
    {!catalog ? <p>{failed ? 'Mobile Gunfighter ratings are unavailable.' : 'Loading Mobile Gunfighter ratings…'}</p> : <>
      <div className="army-intelligence-tactical-grid">{result.rows.map((row, index) => <article className="army-intelligence-tactical-panel" key={row.id}>
        <header><h3>#{index + 1} {row.unit} · {row.rating.score.toFixed(1)}/100</h3><p>{row.profile}</p><p>{row.weapons}</p></header>
        <div className="army-intelligence-tactical-badges"><span>Gunfighter {row.rating.gunfighter.toFixed(2)} ({row.rating.gunfighterNormalized.toFixed(1)}/100 anchored)</span><span>Mobility {row.rating.mobility.toFixed(1)}/100</span></div>
        <p>Gunfighter percentile {row.rating.gunfighterPercentile.toFixed(1)} · Mobility percentile {row.rating.mobilityPercentile.toFixed(1)}</p>
        <p>{row.count} {row.count === 1 ? 'model' : 'models'} across selected lists</p>
      </article>)}</div>
      {!result.rows.length ? <p>No matched profiles for this combat state.</p> : null}
      {result.unavailable > 0 ? <p>{result.unavailable} model entries have no combined rating for this state and are excluded.</p> : null}
    </>}
  </section>
}
