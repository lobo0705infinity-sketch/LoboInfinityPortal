import { weaponChartFromArmyMetadata } from './infinity-weapon-chart.mjs'

const number = value => Number.isFinite(value) ? String(Math.round(value * 100) / 100) : 'not available'
const grade = state => state?.grade || 'ungraded'
const roleName = { Gunfighter: 'shooting', ARO: 'reactive-turn', CC: 'close-combat' }
function standing(state) {
  if (!Number.isFinite(state?.percentile)) return 'Its relative standing is unavailable.'
  const top = Math.max(1, Math.round(100 - state.percentile))
  return `Its score places it around the top ${top}% of its global comparison pool.`
}
function mainWeapon(state) {
  return [...(state?.weaponsUsed || [])].sort((a, b) => (b.scoreContribution || 0) - (a.scoreContribution || 0))[0]?.weapon || null
}
function bestRange(entry, state, chart) {
  const name = mainWeapon(state)
  if (!name) return null
  const weapon = (entry.weapons || []).find(w => name === w.name || name.startsWith(`${w.name} (`) || name.startsWith(`${w.name}:`) || name.startsWith(`${w.name} —`))
  if (!weapon) return null
  const rows = chart.filter(row => (weapon.sourceDatasetId != null && row.id === weapon.sourceDatasetId) || (row.name === weapon.name && (row.mode || '') === (weapon.mode || '')))
  const row = rows.find(r => r.ranges?.length)
  if (!row) return null
  const best = Math.max(...row.ranges.map(r => r.modifier))
  const bands = row.ranges.filter(r => r.modifier === best).map(r => `${r.min}–${r.max} inches (${best >= 0 ? '+' : ''}${best})`)
  return { weapon: row.name, bands: bands.join(', ') }
}
function sameProfile(a, b) {
  return a.combinedId && b.combinedId ? a.combinedId === b.combinedId : a.unitName === b.unitName && a.profileName === b.profileName
}
function crossRoleLimit(role, entry, ratings) {
  const otherRole = role === 'Gunfighter' ? 'ARO' : 'Gunfighter'
  const candidates = otherRole === 'ARO' ? [...(ratings.valuableAro || []), ...(ratings.disposableAro || [])] : ratings.gunfighters || []
  const other = candidates.find(candidate => sameProfile(entry, candidate))
  if (!other?.nonLinked && !other?.fireteamLinked) return ''
  const states = [other.nonLinked && `${grade(other.nonLinked)} alone`, other.fireteamLinked && `${grade(other.fireteamLinked)} linked`].filter(Boolean)
  return ` Its ${otherRole} grade is ${states.join(' or ')}; assess that role separately.`
}
export function ratingExplanations(analysis, metadata) {
  if (!analysis) return ''
  const ratings = analysis.categories || {}
  const chart = weaponChartFromArmyMetadata(metadata || {})
  const lines = ['YOUR LIST: WHAT THE COMBAT RATINGS MEAN', 'Global benchmark grades; scores are not win probabilities. Linked means Fireteam +1 SD.', '']
  let count = 0
  for (const [role, entries] of [['Gunfighter', ratings.gunfighters], ['ARO', [...(ratings.valuableAro || []), ...(ratings.disposableAro || [])]], ['CC', ratings.closeCombat]]) for (const entry of entries || []) {
    count++
    const base = role === 'CC' ? entry : entry.nonLinked
    const linked = role === 'CC' ? null : entry.fireteamLinked
    const name = entry.profileName || entry.unitName || 'Profile unavailable'
    const active = base || linked
    const weapon = mainWeapon(role === 'CC' ? (entry.states || []).find(s => s.id === 'normal') : active)
    lines.push(`${name}${weapon ? ` · ${weapon}` : ''}`)
    lines.push(`${role}: ${role === 'CC' ? grade(base) : [base && `${grade(base)} alone`, linked && `${grade(linked)} with Fireteam +1 SD`].filter(Boolean).join(' → ') || 'ungraded'}`)
    if (!active || !Number.isFinite(active.rating)) {
      lines.push(`Best use: No matched ${roleName[role]} benchmark is available.`, 'What earns the rating: Insufficient benchmark data.', 'What limits it: Consult the tactical brief and current profile before assigning this combat role.', '')
      continue
    }
    if (role === 'CC') {
      const states = (entry.states || []).filter(s => !['normal', 'reactive'].includes(s.id) && Number.isFinite(s.rating) && s.rating > entry.rating)
      const independent = states.filter(s => !/^ally-/.test(s.id)).sort((a,b) => b.rating - a.rating)[0]
      const allies = states.filter(s => /^ally-/.test(s.id)).sort((a,b) => b.rating - a.rating)[0]
      lines.push(`Best use: Close combat${weapon ? ` using ${weapon}` : ''}${independent ? `; ${independent.label || independent.id} improves its tested result` : ''}.`)
      const effects = [independent, allies].filter(Boolean).map(s => `${s.label || s.id} raises the score to ${number(s.rating)}`)
      lines.push(`What earns the rating: ${standing(entry)} Normal active-turn score: ${number(entry.rating)}.${effects.length ? ` ${effects.join('; ')}.` : ''}`)
      lines.push(`What limits it: ${states.length ? 'The higher scores require the named combat conditions; they are not its performance when fighting alone normally.' : 'No stronger conditional result is recorded.'} The grade above compares normal CC profiles; conditional scores are shown without grades to keep the comparison clear.`)
    } else {
      const range = bestRange(entry, active, chart)
      const use = role === 'Gunfighter' ? 'An active-turn shooting piece' : 'A reactive-turn defense piece'
      lines.push(`Best use: ${use}${range ? ` for engagements at ${range.bands}, where its ${range.weapon} has its best printed range modifier` : weapon ? ` using ${weapon}` : ''}.`)
      let earns = `${standing(active)} ${base ? 'Unlinked' : 'Linked-only'} benchmark score: ${number(active.rating)}.`
      if (base && linked && Number.isFinite(linked.rating)) {
        const change = linked.rating - base.rating
        const percent = base.rating > 0 ? Math.round(100 * change / base.rating) : null
        earns += ` Fireteam +1 SD ${change >= 0 ? 'raises' : 'changes'} it from ${number(base.rating)} to ${number(linked.rating)}${percent != null ? ` (about ${Math.abs(percent)}% ${change >= 0 ? 'higher' : 'lower'})` : ''}${Number.isFinite(linked.percentile) ? `, around the top ${Math.max(1, Math.round(100 - linked.percentile))}%` : ''}.`
      }
      lines.push(`What earns the rating: ${earns}`)
      const limit = linked ? `The linked ${grade(linked)} rating requires a legal Fireteam that grants +1 SD.` : 'This rating assumes no external Fireteam support.'
      lines.push(`What limits it: ${limit}${crossRoleLimit(role, entry, ratings)}${range ? ' The range guide is a weapon modifier, not a guarantee against every opponent.' : ' No verified range guide is available in this report.'}`)
    }
    lines.push('')
  }
  if (!count) lines.push('No matched combat rating entries were available for this list. Consult the tactical brief and current Army profiles.')
  lines.push('Grade guide: S = top 5%; A = top 20%; B = top 40%; C = top 60%; D = top 80%; F = below that. Faction-specific grades are not available in this report. Mission usefulness and order efficiency are outside these combat ratings.')
  return lines.join('\n')
}
export function unmetTargetExplanation(list, { points = 300, mustInclude = [] } = {}) {
  const q = list.quality
  if (!q) return ''
  const misses = [['S gunfighters', q.sGunfighters, 3], ['S ARO models', q.sAro, 3], ['S CC models', q.sCc, 3], ['mission specialists', q.specialists, q.specialistTarget || 0]].filter(([, actual, target]) => actual < target)
  if (!misses.length) return 'All requested combat and specialist targets met.'
  return ['**Unmet targets in this option**', ...misses.map(([role, actual, target]) => `• ${role}: ${actual}/${target} (${target - actual} short).`), `Budget used: ${list.points}/${points} points; ${list.swc}/${points / 50} SWC. Required models: ${[mustInclude].flat().filter(Boolean).join(', ') || 'none'}.`, 'The builder searched legal combinations under points, SWC, AVA, trooper limits, Lieutenant requirements and Fireteam eligibility. Guns/CC can overlap; ARO models are reserved separately. An A-grade fallback is used where the S target is missed. This is a search result, not proof that no better legal list exists. Try fewer required models or a different points limit.'].join('\n')
}
