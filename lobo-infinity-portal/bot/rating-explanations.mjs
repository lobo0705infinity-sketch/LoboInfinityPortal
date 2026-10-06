import { weaponChartFromArmyMetadata } from './infinity-weapon-chart.mjs'

const stateText = (label, state) => state && `${label}: ${state.grade || 'ungraded'} · score ${state.rating}${Number.isFinite(state.percentile) ? ` · percentile ${state.percentile}` : ''}. Main relative weapon contributions: ${(state.weaponsUsed || []).slice(0, 3).map(w => `${w.weapon} (${w.scoreContribution ?? '—'})`).join(', ') || 'no weapon breakdown available'}.`
export function ratingExplanations(analysis, metadata) {
  if (!analysis) return ''
  const ratings = analysis.categories || {}
  const chart = weaponChartFromArmyMetadata(metadata || {})
  const lines = ['Rating explanations', 'Grades compare benchmark scores with other profiles; they are not win probabilities. Gunfighter scores weight legal exchanges across benchmark opponents and ranges. ARO scores measure reactive-turn effects; CC uses its own benchmark. S starts at the 95th percentile, A at 80th, B at 60th, C at 40th, D at 20th; below that is F. Army/global grades use different comparison pools.', 'Linked ratings assume the benchmark Fireteam BS Attack (+1 SD) bonus. They do not confirm that this submitted list forms that team. Unlinked ratings assume no external support. Range notes below are weapon modifiers, not guaranteed best matchup outcomes.']
  for (const [role, entries] of [['Gunfighter', ratings.gunfighters], ['ARO', [...(ratings.valuableAro || []), ...(ratings.disposableAro || [])]], ['CC', ratings.closeCombat]]) for (const entry of entries || []) {
    lines.push(`\n${role}: ${entry.unitName} — ${entry.profileName}`)
    if (role === 'CC') lines.push(`Grade ${entry.grade || '—'}, score ${entry.rating}, percentile ${entry.percentile ?? '—'}. States: ${JSON.stringify(entry.states || [])}`)
    else {
      lines.push(...[stateText('Unlinked', entry.nonLinked), stateText('Linked', entry.fireteamLinked)].filter(Boolean))
      for (const weapon of entry.weapons || []) {
        const rows = chart.filter(row => row.id === weapon.sourceDatasetId || (row.name === weapon.name && (row.mode || '') === (weapon.mode || '')))
        for (const row of rows) {
          const best = Math.max(...row.ranges.map(r => r.modifier))
          const bands = row.ranges.filter(r => r.modifier === best).map(r => `${r.min}–${r.max} inches (${best >= 0 ? '+' : ''}${best})`)
          if (bands.length) lines.push(`${row.name}${row.mode ? ` (${row.mode})` : ''}: strongest printed range modifier at ${bands.join(', ')}.`)
        }
      }
    }
    lines.push(`Profile factors: BS ${entry.bs ?? '—'}, CC ${entry.cc ?? '—'}; ${(entry.skills || []).join(', ') || 'no recorded skills'}; ${(entry.equipment || []).join(', ') || 'no recorded equipment'}. These factors are evaluated together, not independent bonuses.`)
  }
  if (lines.length === 3) lines.push('No matched combat rating entries were available for this list. Consult the tactical brief and current Army profiles.')
  return lines.join('\n')
}
export function unmetTargetExplanation(list, { points = 300, mustInclude = [] } = {}) {
  const q = list.quality
  if (!q) return ''
  const misses = [['S gunfighters', q.sGunfighters, 3], ['S ARO models', q.sAro, 3], ['S CC models', q.sCc, 3], ['mission specialists', q.specialists, q.specialistTarget || 0]].filter(([, actual, target]) => actual < target)
  if (!misses.length) return 'All requested combat and specialist targets met.'
  return ['**Unmet targets in this option**', ...misses.map(([role, actual, target]) => `• ${role}: ${actual}/${target} (${target - actual} short).`), `Budget used: ${list.points}/${points} points; ${list.swc}/${points / 50} SWC. Required models: ${[mustInclude].flat().filter(Boolean).join(', ') || 'none'}.`, 'The builder searched legal combinations under points, SWC, AVA, trooper limits, Lieutenant requirements and Fireteam eligibility. Guns/CC can overlap; ARO models are reserved separately. An A-grade fallback is used where the S target is missed. This is a search result, not proof that no better legal list exists. Try fewer required models or a different points limit.'].join('\n')
}
