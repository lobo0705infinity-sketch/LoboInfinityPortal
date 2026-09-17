import { resolveExactProfileGroup } from '../scripts/infinity-army-profile-resolution.mjs'

export const LEGALITY_STATUS = Object.freeze({
  LEGAL: 'legal',
  ILLEGAL: 'illegal',
  UNAVAILABLE: 'unavailable',
})

export function validateInfListLegality({ decoded, payload } = {}) {
  const unavailable = []
  const violations = []
  const units = Array.isArray(payload?.units) ? payload.units : []
  if (!decoded || !Array.isArray(decoded.combatGroups)) unavailable.push('Army code could not be decoded.')
  if (!units.length) unavailable.push('Current official sectorial data is unavailable.')
  if (unavailable.length) return report(LEGALITY_STATUS.UNAVAILABLE, { unavailable })

  const unitById = new Map(units.map((unit) => [Number(unit.id), unit]))
  const selections = []

  for (const combatGroup of decoded.combatGroups) {
    for (const member of combatGroup.members || []) {
      const unit = unitById.get(Number(member.unitId))
      const group = resolveExactProfileGroup(unit, member, { allowAmbiguousLegacy: true })
      const option = group?.options?.find((candidate) => Number(candidate.id) === Number(member.optionId))
      const profileId = Number(String(member.combinedId || '').split('-').at(-1))
      const profiles = group?.profiles || []
      const profile = profiles.find((candidate) => Number(candidate.id) === profileId)
        || (profiles.length === 1 ? profiles[0] : undefined)
      const legalityOption = resolveLegalityOption(unit, group, option, member)
      const label = legalityOption?.name || option?.name || group?.isc || unit?.isc || member.combinedId || 'Unknown profile'

      if (!unit || !group || !option || !profile || !legalityOption) {
        unavailable.push(`${label}: current official profile data did not resolve exactly.`)
        continue
      }
      const swcValue = parseSwc(legalityOption.swc)
      if (!Number.isFinite(Number(legalityOption.points)) || !swcValue) {
        unavailable.push(`${label}: official points or SWC data is missing.`)
        continue
      }
      if (!Number.isFinite(Number(profile.ava)) && String(profile.ava).toUpperCase() !== 'T') {
        unavailable.push(`${label}: official AVA data is missing.`)
        continue
      }

      selections.push({
        ava: profile.ava,
        avaKey: Number(unit.id),
        combatGroup: Number(combatGroup.combatGroup),
        disabled: legalityOption.disabled === true,
        label,
        lieutenant: (legalityOption.orders || []).some((order) => String(order?.type).toUpperCase() === 'LIEUTENANT') ? 1 : 0,
        minis: positiveInteger(legalityOption.minis, 1),
        points: Number(legalityOption.points),
        swc: swcValue.cost,
        swcBonus: swcValue.bonus,
      })
    }
  }

  if (unavailable.length) return report(LEGALITY_STATUS.UNAVAILABLE, { unavailable })

  const maxPoints = Number(decoded.maxPoints)
  if (!Number.isFinite(maxPoints) || maxPoints <= 0) {
    return report(LEGALITY_STATUS.UNAVAILABLE, { unavailable: ['The Army code has no valid points limit.'] })
  }

  const points = sum(selections, 'points')
  const swc = sum(selections, 'swc')
  const troopers = sum(selections, 'minis')
  const lieutenantCount = sum(selections, 'lieutenant')
  const maxSwc = maxPoints / 50 + sum(selections, 'swcBonus')

  if (points > maxPoints) violations.push(`${formatNumber(points)} Points exceeds the ${formatNumber(maxPoints)} Point limit.`)
  if (swc > maxSwc) violations.push(`${formatNumber(swc)} SWC exceeds the ${formatNumber(maxSwc)} SWC limit.`)
  if (troopers > 15) violations.push(`${troopers} Troopers exceeds the 15-Trooper limit.`)
  if (lieutenantCount !== 1) violations.push(`The list must contain exactly one Lieutenant; found ${lieutenantCount}.`)

  const groupCounts = new Map()
  for (const selection of selections) {
    groupCounts.set(selection.combatGroup, (groupCounts.get(selection.combatGroup) || 0) + selection.minis)
    if (selection.disabled) violations.push(`${selection.label} is disabled in the current official Army data.`)
  }
  for (const [group, count] of groupCounts) {
    if (count > 10) violations.push(`Combat Group ${group} contains ${count} Troopers; the maximum is 10.`)
  }

  const avaCounts = new Map()
  for (const selection of selections) {
    const current = avaCounts.get(selection.avaKey) || { ava: selection.ava, count: 0, labels: new Set() }
    current.count += 1
    current.labels.add(selection.label)
    if (String(current.ava).toUpperCase() !== 'T') current.ava = Math.min(Number(current.ava), Number(selection.ava))
    avaCounts.set(selection.avaKey, current)
  }
  for (const { ava, count, labels } of avaCounts.values()) {
    if (String(ava).toUpperCase() !== 'T' && count > Number(ava)) {
      violations.push(`${[...labels].join(' / ')} exceeds AVA ${formatNumber(ava)} (${count} selected).`)
    }
  }

  return report(violations.length ? LEGALITY_STATUS.ILLEGAL : LEGALITY_STATUS.LEGAL, {
    limits: { points: maxPoints, swc: maxSwc, troopers: 15 },
    totals: { lieutenantCount, points, swc, troopers },
    violations,
    version: payload.version || null,
  })
}

function resolveLegalityOption(unit, group, option, member) {
  if (Number(member.groupId) !== 0) return option

  // Legacy group 0 encodes a unit-level combined selection. Validate and total
  // the enabled parent option, not only its first component profile. For
  // example, JAZZ Hacker & BILLIE is 25 points and two Troopers.
  return (unit?.options || []).find((parentOption) => (
    Number(parentOption.id) === Number(member.optionId)
    && (parentOption.includes || []).some((included) => (
      Number(included.group) === Number(group.id)
      && Number(included.option) === Number(option.id)
    ))
  )) || option
}

export function formatInfListLegality(result) {
  if (result?.status === LEGALITY_STATUS.LEGAL) {
    return `✅ **LEGAL ARMY LIST**\n${formatNumber(result.totals.points)}/${formatNumber(result.limits.points)} Points · ${formatNumber(result.totals.swc)}/${formatNumber(result.limits.swc)} SWC · ${result.totals.troopers}/15 Troopers`
  }
  if (result?.status === LEGALITY_STATUS.ILLEGAL) {
    return `❌ **ILLEGAL ARMY LIST**\n${result.violations.map((item) => `• ${item}`).join('\n')}`
  }
  return `⚠️ **ARMY LIST VALIDATION UNAVAILABLE**\n${(result?.unavailable || ['The list could not be checked against current official Army data.']).map((item) => `• ${item}`).join('\n')}`
}

function report(status, values) {
  return { limits: null, totals: null, unavailable: [], version: null, violations: [], ...values, status }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseSwc(value) {
  const text = String(value ?? '').trim()
  const amount = Number(text)
  if (!Number.isFinite(amount)) return null
  return text.startsWith('+') ? { bonus: amount, cost: 0 } : { bonus: 0, cost: amount }
}

function sum(values, key) {
  return values.reduce((total, value) => total + Number(value[key] || 0), 0)
}

function formatNumber(value) {
  return Number.isInteger(Number(value)) ? String(Number(value)) : String(Number(value).toFixed(2)).replace(/0+$/, '').replace(/\.$/, '')
}
