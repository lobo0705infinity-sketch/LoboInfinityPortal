// Shared N5.3 primitives: keep BS and CC critical/save semantics identical.
// Sources: infinitythewiki.com/{Rolls,Immunity,Combined_Saving_Roll}.
export const COMBAT_RULES_VERSION = 'n5.3-combat-audit-v2-continuous'
export const clamp = (x, low, high) => Math.max(low, Math.min(high, Number(x)))
export const normalizeTrait = value => String(value).toLowerCase().replace(/[−–]/g, '-').replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim()
export const traitTokens = (values = []) => values.map(normalizeTrait)
export const profileTraits = profile => traitTokens([...(profile.skills || []), ...(profile.equipment || [])])
export const successValue = (base, modifiers = 0) => Number(base) + clamp(modifiers, -12, 12)
export function criticalRank(face, target) {
  if (target < 1 || face > Math.min(20, target)) return 0
  return (target <= 20 ? face === target : face === 20 || face <= target - 20) ? 120 : face
}
export function coverBenefits(profile, enabled = true) {
  const traits = profileTraits(profile)
  if (!enabled || traits.includes('no cover') || profile.coverEligible === false) return { hit: 0, save: 0 }
  return { hit: traits.includes('limited cover') ? 0 : -3, save: 3 }
}
export function canonicalState(value) {
  const state = normalizeTrait(value)
  if (/^(imm-[ab]|immobilized(?:-[ab])?)$/.test(state)) return 'immobilized'
  if (state === 'iso') return 'isolated'
  if (state === 'stun') return 'stunned'
  return state
}
export function effectiveDurability(profile, weapon) {
  const base = Math.max(1, Number(profile.vitality || profile.structure || 1))
  const traits = profileTraits(profile)
  const shock = weapon.shock && Number(profile.vitality || 0) > 0 && base === 1 && !traits.includes('immunity shock')
  return base + (!shock && (traits.includes('no wound incapacitation') || traits.includes('dogged')) ? 1 : 0)
}

export function savingProfile(weapon, target, { cover = false } = {}) {
  const traits = profileTraits(target)
  const ammo = String(weapon.ammo || 'N').toUpperCase().replace(/\s+/g, '')
  const immunities = traits.filter(t => t.startsWith('immunity ')).map(t => t.slice(9))
  const vulnerableViral = traits.includes('vulnerability viral') && (/viral/i.test(weapon.name || '') || weapon.viralBioweapon)
  const immuneAttribute = attr => !vulnerableViral && (immunities.includes(attr.toLowerCase()) || immunities.includes('enhanced'))
  const ammoParts = ammo.split('+')
  const immuneAmmo = name => immunities.includes(name.toLowerCase())
  const components = weapon.saveComponents?.length ? weapon.saveComponents : [{ attribute: weapon.save || 'ARM', divisor: weapon.saveDivisor, fixed: weapon.saveFixed, modifier: weapon.saveModifier, saves: weapon.saves ?? weapon.savingRolls }]
  const broad = components.every(c => immuneAttribute(c.attribute))
  const hasAmmo = name => ammoParts.includes(name) && !immuneAmmo(name)
  const viral = weapon.viralBioweapon && Number(target.vitality || 0) > 0 && !broad && !immuneAmmo('Viral')
  const normalized = {
    ...weapon,
    shock: !broad && !immuneAmmo('Shock') && (weapon.shock || hasAmmo('SHOCK') || viral),
    nonLethal: Boolean(weapon.nonLethal) || ammo === 'E/M' || ammo === 'PARA' || ammo === 'STUN',
    continuousDamage: Boolean(weapon.continuousDamage) && !broad && !immunities.includes('continuous damage'),
    deadState: Boolean(weapon.deadState || (weapon.states || []).some(s => canonicalState(s) === 'dead')) && !broad && !immunities.includes('dead'),
    woundsPerFailure: broad || immuneAmmo('T2') ? 1 : Number(weapon.woundsPerFailure || (hasAmmo('T2') ? 2 : 1)),
    criticalWoundsPerFailure: 1,
  }
  const states = (weapon.states || []).map(canonicalState)
  if (hasAmmo('E/M') && !broad) {
    states.push('isolated')
    if (['HI', 'TAG', 'REM', 'VH'].includes(String(target.troopType).toUpperCase())) states.push('immobilized')
  }
  if (hasAmmo('PARA')) states.push('immobilized')
  if (hasAmmo('STUN')) states.push('stunned')
  normalized.states = [...new Set(states)].filter(state => {
    if (state === 'dead') return false
    if (state === 'isolated' && (traits.includes('warhorse') || broad || immuneAmmo('E/M'))) return false
    if (state === 'immobilized' && ammo.includes('E/M') && (broad || immuneAmmo('E/M'))) return false
    if (broad && state !== 'stunned') return false
    return !immunities.some(i => canonicalState(i) === state)
  })
  const template = weapon.attackType === 'direct-template' || weapon.ignoresSaveCover || (weapon.traits || []).some(t => /template/i.test(t))
  const saveCover = weapon.ignoresCover || template ? 0 : coverBenefits(target, cover).save
  normalized.components = components.map(c => {
    const attr = c.attribute
    const attrImmune = immuneAttribute(attr)
    const ap = hasAmmo('AP') || hasAmmo('BREAKER') || hasAmmo('E/M') || weapon.ap
    const divisorIgnored = attrImmune || (ammoParts.includes('AP') && immuneAmmo('AP')) || (ammoParts.includes('E/M') && immuneAmmo('E/M'))
    const divisor = divisorIgnored ? 1 : Math.max(1, Number(c.divisor || (ap ? 2 : 1)))
    const printed = Number(target[attr.toLowerCase()] || 0)
    const attribute = attrImmune || c.fixed == null ? printed : Number(c.fixed)
    const reduced = Math.ceil(attribute / divisor) + (attrImmune ? 0 : Number(c.modifier || 0))
    const sv = reduced + (attr === 'PH' ? 0 : Number(weapon.power) + saveCover) - Number(weapon.savingRollPenalty || 0)
    if (!Number.isFinite(sv)) throw Error(`Invalid ${attr} saving roll for ${weapon.name || weapon.ammo}`)
    let saves = Number(c.saves || (hasAmmo('EXP') ? 3 : hasAmmo('DA') || hasAmmo('E/M') ? 2 : 1))
    if (viral) saves = 2
    if (attrImmune || ammoParts.some(a => ['DA', 'EXP', 'E/M'].includes(a) && immuneAmmo(a))) saves = 1
    return { attribute: attr, failureProbability: 1 - clamp(sv / 20, 0, 1), saves }
  })
  normalized.criticalComponent = Math.max(0, normalized.components.findIndex(c => c.attribute === 'ARM'))
  normalized.criticalImmune = immunities.includes('critical')
  normalized.durability = effectiveDurability(target, normalized)
  return normalized
}

// Exact bounded damage distribution. Overflow is merged only after it cannot
// change capped damage, neutralization or state probability.
export function resolveSavingEffects(outcomes, weapon, target, settings = {}) {
  const w = savingProfile(weapon, target, settings)
  const cap = Math.max(1, Math.ceil(w.durability))
  let expectedWounds = 0, expectedCappedWounds = 0, neutralizeProbability = 0, stateProbability = 0, failureProbability = 0
  for (const [key, probability] of outcomes) {
    const [hits, criticals] = String(key).split(':').map(Number)
    if (!hits || !probability) continue
    let distribution = [1], rawWounds = 0
    for (const [i, component] of w.components.entries()) {
      const p = component.failureProbability
      const batches = [[hits * component.saves, w.woundsPerFailure], [!w.criticalImmune && i === w.criticalComponent ? criticals : 0, w.criticalWoundsPerFailure]]
      for (const [count, wounds] of batches) {
        rawWounds += count * wounds * (w.continuousDamage ? (p === 1 ? cap : p / (1 - p)) : p)
        const perSave = Array(cap + 1).fill(0)
        if (w.continuousDamage) {
          const maxFailures = Math.ceil(cap / wounds)
          for (let k = 0; k <= maxFailures; k++) perSave[Math.min(cap, k * wounds)] += k === maxFailures ? p ** k : p ** k * (1 - p)
        } else { perSave[0] = 1 - p; perSave[Math.min(cap, wounds)] = p }
        for (let n = 0; n < count; n++) {
          const next = Array(cap + 1).fill(0)
          for (let a = 0; a < distribution.length; a++) for (let b = 0; b < perSave.length; b++) next[Math.min(cap, a + b)] += distribution[a] * perSave[b]
          distribution = next
        }
      }
    }
    const failed = 1 - distribution[0]
    failureProbability += probability * failed
    if (w.states.length) stateProbability += probability * failed
    if (!w.nonLethal) {
      expectedWounds += probability * rawWounds
      distribution.forEach((p, wounds) => {
        const damage = wounds && w.deadState ? w.durability : wounds
        expectedCappedWounds += probability * p * Math.min(damage, w.durability)
        if (damage >= w.durability) neutralizeProbability += probability * p
      })
    }
  }
  return { expectedWounds, expectedCappedWounds, neutralizeProbability, stateProbability, failureProbability, nonLethal: w.nonLethal, durability: w.durability, states: w.states }
}
