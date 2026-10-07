import { weaponChartFromArmyMetadata } from './infinity-weapon-chart.mjs'

const number = value => Number.isFinite(value) ? String(Math.round(value * 100) / 100) : 'not available'
const verdicts = { S: 'Exceptional', A: 'Strong', B: 'Above average', C: 'Middle of the benchmark field', D: 'Below average', F: 'Low relative benchmark performance' }
function metrics(label, state) {
  if (!state) return null
  return `${label}: ${state.grade || 'ungraded'}${verdicts[state.grade] ? ` — ${verdicts[state.grade]}` : ''}. Benchmark score ${number(state.rating)}${Number.isFinite(state.percentile) ? `; percentile ${number(state.percentile)}` : ''}.`
}
function weapons(state) {
  const names = [...new Set((state?.weaponsUsed || []).map(w => w.weapon).filter(Boolean))]
  return names.length ? `  Main benchmark weapons/actions: ${names.slice(0, 3).join('; ')}.` : null
}
function uniqueFactors(values) {
  const seen = new Set()
  return (values || []).filter(value => {
    const key = String(value).toLowerCase().replace(/[()[\]]/g, '').replace(/\s+/g, '')
    if (seen.has(key)) return false
    seen.add(key); return true
  })
}
export function ratingExplanations(analysis, metadata) {
  if (!analysis) return ''
  const ratings = analysis.categories || {}
  const chart = weaponChartFromArmyMetadata(metadata || {})
  const lines = [
    'YOUR LIST: COMBAT RATINGS EXPLAINED', '',
    'HOW TO READ THIS REPORT',
    'Gunfighter = active-turn shooting. ARO = reactive-turn performance. CC = close combat.',
    'S: exceptional (95th percentile or higher). A: strong (80+). B: above average (60+). C: middle of the field (40+). D: below average (20+). F: below the 20th percentile.',
    'A percentile of 91 means the score is around the top 9% of its comparison pool. Grades and scores are not win probabilities. Compare scores only within the same combat role.',
    'These are global benchmark catalog ratings, not ranks within your faction. Gunfighter and ARO grades compare catalog profiles and their tested linked/unlinked states. Faction-specific grades are not available in this report.',
    'Unlinked means no external support. Linked adds the benchmark Fireteam BS Attack (+1 SD) bonus. Use it only if you can form a legal Fireteam that grants that bonus; this report does not verify your submitted team.',
    'Weapon names show which attacks contributed to the benchmark. Raw contribution totals are omitted because they use different scales from the final score.',
    'Ratings describe the tested combat situations. They do not measure mission usefulness, order efficiency or overall list quality.',
  ]
  let count = 0
  for (const [role, entries] of [['Gunfighter', ratings.gunfighters], ['ARO', [...(ratings.valuableAro || []), ...(ratings.disposableAro || [])]], ['CC', ratings.closeCombat]]) for (const entry of entries || []) {
    count++
    lines.push('', `${role.toUpperCase()}: ${entry.unitName}${entry.profileName && entry.profileName !== entry.unitName ? ` — ${entry.profileName}` : ''}`)
    if (role === 'CC') {
      lines.push(metrics('Normal active-turn CC (global profiles)', entry))
      lines.push('Conditional grades below compare all tested CC states, including supported states. They use a different pool from the normal profile grade above; the same score can therefore receive a different grade.')
      const states = entry.states || []
      for (const state of states) lines.push(metrics(state.label || state.id || 'CC state', state), weapons(state))
      if (!states.length) lines.push('No conditional CC breakdown is available.')
      if (states.some(s => /^ally-/.test(s.id))) lines.push('Allied-Trooper results require the stated number of allies engaged in that combat; they are not automatic bonuses.')
      if (states.some(s => s.id === 'surprise')) lines.push('The Surprise Attack result applies only when its requirements are met.')
    } else {
      for (const [label, state] of [['Unlinked', entry.nonLinked], ['Linked', entry.fireteamLinked]]) if (state) lines.push(metrics(label, state), weapons(state))
      if (!entry.nonLinked && !entry.fireteamLinked) lines.push('No matched benchmark score is available for this profile.')
      if (entry.nonLinked && entry.fireteamLinked && Number.isFinite(entry.nonLinked.rating) && Number.isFinite(entry.fireteamLinked.rating)) {
        lines.push(`Fireteam effect in this benchmark: score ${number(entry.nonLinked.rating)} → ${number(entry.fireteamLinked.rating)}; grade ${entry.nonLinked.grade || 'ungraded'} → ${entry.fireteamLinked.grade || 'ungraded'}.`)
      }
      const ranges = new Set()
      const used = [...(entry.nonLinked?.weaponsUsed || []), ...(entry.fireteamLinked?.weaponsUsed || [])].map(w => w.weapon)
      for (const weapon of entry.weapons || []) {
        if (!used.some(name => name === weapon.name || name.startsWith(`${weapon.name} (`) || name.startsWith(`${weapon.name}:`))) continue
        for (const row of chart.filter(row => row.id === weapon.sourceDatasetId || (row.name === weapon.name && (row.mode || '') === (weapon.mode || '')))) {
          if (!row.ranges?.length) continue
          const best = Math.max(...row.ranges.map(r => r.modifier))
          const bands = row.ranges.filter(r => r.modifier === best).map(r => `${r.min}–${r.max} inches (${best >= 0 ? '+' : ''}${best})`)
          ranges.add(`Range guide — ${row.name}${row.mode ? ` (${row.mode})` : ''}: ${bands.join(', ')}.`)
        }
      }
      if (ranges.size) lines.push(...ranges, 'These are the weapon’s best printed range modifiers, not a prediction of the best range against every opponent.')
    }
    const stats = [Number.isFinite(entry.bs) ? `BS ${entry.bs}` : null, Number.isFinite(entry.cc) ? `CC ${entry.cc}` : null].filter(Boolean)
    if (stats.length) lines.push(`Profile stats: ${stats.join('; ')}.`)
    const skills = uniqueFactors(entry.skills), equipment = uniqueFactors(entry.equipment)
    if (skills.length) lines.push(`Recorded skills: ${skills.join(', ')}.`)
    if (equipment.length) lines.push(`Recorded equipment: ${equipment.join(', ')}.`)
    if (skills.length || equipment.length) lines.push('These describe the profile; not every listed ability affects this combat benchmark.')
  }
  if (!count) lines.push('', 'No matched combat rating entries were available for this list. Consult the tactical brief and current Army profiles.')
  return lines.filter(line => line != null).join('\n')
}
export function unmetTargetExplanation(list, { points = 300, mustInclude = [] } = {}) {
  const q = list.quality
  if (!q) return ''
  const misses = [['S gunfighters', q.sGunfighters, 3], ['S ARO models', q.sAro, 3], ['S CC models', q.sCc, 3], ['mission specialists', q.specialists, q.specialistTarget || 0]].filter(([, actual, target]) => actual < target)
  if (!misses.length) return 'All requested combat and specialist targets met.'
  return ['**Unmet targets in this option**', ...misses.map(([role, actual, target]) => `• ${role}: ${actual}/${target} (${target - actual} short).`), `Budget used: ${list.points}/${points} points; ${list.swc}/${points / 50} SWC. Required models: ${[mustInclude].flat().filter(Boolean).join(', ') || 'none'}.`, 'The builder searched legal combinations under points, SWC, AVA, trooper limits, Lieutenant requirements and Fireteam eligibility. Guns/CC can overlap; ARO models are reserved separately. An A-grade fallback is used where the S target is missed. This is a search result, not proof that no better legal list exists. Try fewer required models or a different points limit.'].join('\n')
}
