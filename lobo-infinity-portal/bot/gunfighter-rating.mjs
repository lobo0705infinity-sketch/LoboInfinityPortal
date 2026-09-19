export const STANDARD_RANGE_BANDS = Object.freeze([
  { id: '0-8', min: 0, max: 8 },
  { id: '8-16', min: 8, max: 16 },
  { id: '16-24', min: 16, max: 24 },
  { id: '24-32', min: 24, max: 32 },
  { id: '32-40', min: 32, max: 40 },
  { id: '40-48', min: 40, max: 48 },
  { id: '48-96', min: 48, max: 96 },
])

export const STATE_VALUES = Object.freeze({
  dead: 1,
  unconscious: 1,
  isolated: 0.9,
  immobilized: 0.5,
  stunned: 0.35,
  targeted: 0.25,
})

const DEFAULT_OPTIONS = Object.freeze({
  cover: true,
  ranges: STANDARD_RANGE_BANDS,
  stateValues: STATE_VALUES,
})

const faceToFaceCache = new Map()
const poolSummaryCache = new Map()

export function evaluateGunfighterProfile(profile, defenders, options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options }
  assertProfile(profile)
  if (!Array.isArray(defenders) || !defenders.length) throw new Error('Gunfighter evaluation requires at least one defender.')
  const states = [{ id: 'normal', specialDice: 0 }]
  if (profile.fireteamCapable) states.push({ id: 'fireteam', specialDice: 1 })
  return {
    profileId: profile.id,
    name: profile.name,
    states: states.map((state) => evaluateState(profile, defenders, settings, state)),
  }
}

export function evaluateState(profile, defenders, settings, state) {
  const matchups = []
  for (const defender of defenders) {
    assertProfile(defender)
    for (const range of settings.ranges) {
      const candidates = profile.weapons.flatMap((weapon) => weapon.modes.map((mode) => evaluateAttackCandidate({
        attacker: profile,
        defender,
        weapon,
        mode,
        range,
        fireteamSpecialDice: state.specialDice,
        settings,
      })))
      const available = candidates.filter((candidate) => candidate.status === 'evaluated')
      const selected = available.sort(compareAttackerResults)[0] || null
      matchups.push({
        defenderId: defender.id,
        defenderName: defender.name,
        range: range.id,
        selected,
        candidates,
      })
    }
  }
  return {
    id: state.id,
    fireteamSpecialDice: state.specialDice,
    rating: matchups.length ? round(matchups.reduce((sum, matchup) => sum + (matchup.selected?.score ?? 0), 0) / matchups.length) : null,
    matchups,
  }
}

export function evaluateAttackCandidate({ attacker, defender, weapon, mode, range, fireteamSpecialDice = 0, settings = DEFAULT_OPTIONS }) {
  validateWeaponMode(weapon, mode)
  if (mode.smoke || mode.eclipse) return unavailableCandidate(weapon, mode, range, 'non-offensive-smoke')
  const rangeModifier = rangeModifierFor(mode, range, attacker.equipment)
  if (rangeModifier === null) return unavailableCandidate(weapon, mode, range, 'out-of-range')
  if (mode.attackType === 'direct-template' && range.min >= Number(mode.templateRange || 8)) return unavailableCandidate(weapon, mode, range, 'out-of-range')
  const attack = buildAttackPool(attacker, defender, weapon, mode, rangeModifier, fireteamSpecialDice, settings)
  const legalAros = buildLegalAros(defender, attacker, range, settings, mode)
  if (!legalAros.length) legalAros.push({ id: 'no-aro', type: 'none' })
  const responses = legalAros.map((aro) => resolveExchange({ attack, aro, attacker, defender, weapon, mode, range, settings }))
  const optimalResponse = responses.sort(compareDefenderResults)[0]
  return {
    status: 'evaluated',
    weapon: weapon.name,
    mode: mode.name || mode.ammo || '',
    range: range.id,
    attack,
    optimalResponse,
    score: optimalResponse.attackerScore,
  }
}

export function resolveFaceToFace(active, reactive) {
  const cacheKey = [active.burst, active.specialDice, active.target, active.criticalTarget, reactive.burst, reactive.specialDice, reactive.target, reactive.criticalTarget].join(':')
  const cached = faceToFaceCache.get(cacheKey)
  if (cached) return cached
  const activeSummary = summarizePool(active)
  const reactiveSummary = summarizePool(reactive)
  const activeWin = winProbability(activeSummary, reactiveSummary)
  const reactiveWin = winProbability(reactiveSummary, activeSummary)
  const noEffect = Math.max(0, 1 - activeWin - reactiveWin)
  const expectedActiveHits = expectedWinningHits(activeSummary, reactiveSummary)
  const expectedReactiveHits = expectedWinningHits(reactiveSummary, activeSummary)
  const result = {
    activeWin: round(activeWin * 100),
    reactiveWin: round(reactiveWin * 100),
    noEffect: round(noEffect * 100),
    expectedActiveHits,
    expectedReactiveHits,
  }
  faceToFaceCache.set(cacheKey, result)
  return result
}

function summarizePool(pool) {
  const burst = Math.max(1, Number(pool.burst || 1))
  const dice = burst + Math.max(0, Number(pool.specialDice || 0))
  const cacheKey = `${burst}:${dice}:${pool.target}:${pool.criticalTarget}`
  const cached = poolSummaryCache.get(cacheKey)
  if (cached) return cached
  const raw = new Map()
  for (let face = 1; face <= 20; face += 1) {
    const roll = describeRoll(face, pool)
    const rank = roll.success ? rollRank(roll) : 0
    raw.set(rank, (raw.get(rank) || 0) + 0.05)
  }
  const successRanks = [...raw.keys()].filter((rank) => rank > 0).sort((a, b) => a - b)
  const ranks = successRanks.map((rank) => {
    const equal = raw.get(rank) || 0
    const lower = [...raw].reduce((sum, [candidate, probability]) => candidate < rank ? sum + probability : sum, 0)
    const higher = Math.max(0, 1 - lower - equal)
    const bestProbability = Math.pow(lower + equal, dice) - Math.pow(lower, dice)
    const expectedRetained = expectedRetainedRankCount({ dice, burst, higher, equal, lower })
    return { rank, bestProbability, expectedHits: expectedRetained * (rank > 100 ? 2 : 1) }
  })
  const summary = {
    ranks,
    below: (rank) => {
      const probability = [...raw].reduce((sum, [candidate, value]) => candidate < rank ? sum + value : sum, 0)
      return Math.pow(probability, dice)
    },
  }
  poolSummaryCache.set(cacheKey, summary)
  return summary
}

function winProbability(own, opposing) {
  return own.ranks.reduce((sum, state) => sum + state.bestProbability * opposing.below(state.rank), 0)
}

function expectedWinningHits(own, opposing) {
  return own.ranks.reduce((sum, state) => sum + state.expectedHits * opposing.below(state.rank), 0)
}

export function resolveNormalRoll(pool) {
  const summary = summarizePool(pool)
  const success = summary.ranks.reduce((sum, state) => sum + state.bestProbability, 0)
  const expectedHits = summary.ranks.reduce((sum, state) => sum + state.expectedHits, 0)
  return { success: round(success * 100), expectedHits }
}

function expectedRetainedRankCount({ dice, burst, higher, equal, lower }) {
  let expected = 0
  for (let highCount = 0; highCount <= dice; highCount += 1) {
    for (let equalCount = 0; equalCount <= dice - highCount; equalCount += 1) {
      const lowerCount = dice - highCount - equalCount
      const retained = Math.min(equalCount, Math.max(0, burst - highCount))
      if (!retained) continue
      expected += retained * multinomial3(dice, highCount, equalCount, lowerCount)
        * Math.pow(higher, highCount) * Math.pow(equal, equalCount) * Math.pow(lower, lowerCount)
    }
  }
  return expected
}

function multinomial3(total, first, second, third) {
  return factorial(total) / (factorial(first) * factorial(second) * factorial(third))
}

function factorial(value) {
  let result = 1
  for (let index = 2; index <= value; index += 1) result *= index
  return result
}

export function expectedEffectFromHits({ expectedHits, mode, defender }) {
  if (!expectedHits) return { expectedDamage: 0, damageValue: 0, stateValue: 0, total: 0 }
  const printedAttribute = mode.save === 'BTS' ? Number(defender.bts || 0) : mode.save === 'PH' ? Number(defender.ph || 0) : Number(defender.arm || 0)
  const fixedAttribute = mode.saveFixed == null ? null : Number(mode.saveFixed)
  const baseAttribute = Number.isFinite(fixedAttribute) ? fixedAttribute : printedAttribute
  const apAmmunition = /(?:^|\+)AP(?:$|\+)/i.test(String(mode.ammo))
  const apImmunity = [...(defender.skills || []), ...(defender.equipment || [])].some((value) => /immunity\s*\(?\s*ap\s*\)?/i.test(String(value)))
  const inferredDivisor = apAmmunition || mode.ammo === 'BREAKER' ? 2 : 1
  const divisor = apAmmunition && apImmunity ? 1 : Math.max(1, Number(mode.saveDivisor || inferredDivisor))
  const reduced = Math.ceil(baseAttribute / divisor) + Number(mode.saveModifier || 0)
  const cover = mode.ignoresCover || mode.attackType === 'direct-template' ? 0 : 3
  // BS Attack (SR-1) subtracts one from each target Saving Roll.  Increasing
  // the failure threshold by one is the equivalent probability operation.
  const savingRollPenalty = Math.max(0, Number(mode.savingRollPenalty || 0))
  // N5 PS is added to the target's ARM/BTS (and Cover) to establish the
  // Saving Roll Success Value. A roll above that value fails, so lower PS is
  // more lethal. SR-X subtracts from the Success Value.
  const successValue = mode.save === 'PH'
    ? reduced - savingRollPenalty
    : reduced + cover + Number(mode.power) - savingRollPenalty
  const failureProbability = 1 - Math.min(1, Math.max(0, successValue / 20))
  const savesPerHit = Number(mode.saves || (/EXP/i.test(String(mode.ammo)) ? 3 : /DA/i.test(String(mode.ammo)) ? 2 : 1))
  const woundsPerFailure = Number(mode.woundsPerFailure || (/T2/i.test(String(mode.ammo)) ? 2 : 1))
  const failuresPerSave = mode.continuousDamage ? failureProbability / Math.max(0.05, 1 - failureProbability) : failureProbability
  const expectedDamage = expectedHits * savesPerHit * failuresPerSave * woundsPerFailure
  const durability = effectiveDurability(defender, mode)
  const damageValue = mode.nonLethal ? 0 : Math.min(expectedDamage / durability, 1)
  const stateValue = expectedStateValue(mode, defender, expectedHits, failureProbability)
  return { expectedDamage, damageValue, stateValue, total: Math.min(1, damageValue + stateValue * (1 - damageValue)) }
}

function resolveExchange({ attack, aro, attacker, defender, mode }) {
  if (mode.attackType === 'direct-template') {
    const dodge = aro.type === 'dodge' ? resolveNormalRoll(aro.pool) : { success: 0 }
    const hitProbability = 1 - dodge.success / 100
    const effect = expectedEffectFromHits({ expectedHits: attack.burst * hitProbability, mode: withAttackSaveModifiers(mode, attack), defender })
    return exchangeResult(attack, aro, { activeWin: 100 - dodge.success, reactiveWin: 0, noEffect: dodge.success, expectedActiveHits: attack.burst * hitProbability, expectedReactiveHits: 0 }, effect, null)
  }
  if (aro.type === 'none') {
    const roll = resolveNormalRoll(attack)
    const effect = expectedEffectFromHits({ expectedHits: roll.expectedHits, mode: withAttackSaveModifiers(mode, attack), defender })
    return exchangeResult(attack, aro, { activeWin: roll.success, reactiveWin: 0, noEffect: 100 - roll.success, expectedActiveHits: roll.expectedHits, expectedReactiveHits: 0 }, effect, null)
  }
  if (aro.type === 'template') {
    const roll = resolveNormalRoll(attack)
    const effect = expectedEffectFromHits({ expectedHits: roll.expectedHits, mode: withAttackSaveModifiers(mode, attack), defender })
    const returnEffect = expectedEffectFromHits({ expectedHits: Math.max(1, Number(aro.pool?.burst || 1)), mode: aro.mode, defender: attacker })
    return exchangeResult(attack, aro, { activeWin: roll.success, reactiveWin: 100, noEffect: 0, expectedActiveHits: roll.expectedHits, expectedReactiveHits: 1 }, effect, returnEffect)
  }
  const activePool = applyOpponentFtfModifier(attack, defender, aro.type, attacker, { allowSurprise: false })
  const reactivePool = applyOpponentFtfModifier(aro.pool, attacker, 'shoot', defender, { allowSurprise: true })
  const f2f = resolveFaceToFace(activePool, reactivePool)
  const effect = expectedEffectFromHits({ expectedHits: f2f.expectedActiveHits, mode: withAttackSaveModifiers(mode, attack), defender })
  const returnEffect = aro.mode ? expectedEffectFromHits({ expectedHits: f2f.expectedReactiveHits, mode: aro.mode, defender: attacker }) : { total: 0 }
  return exchangeResult(attack, aro, f2f, effect, returnEffect)
}

function exchangeResult(attack, aro, roll, effect, returnEffect) {
  const safety = 1 - Number(returnEffect?.total || 0)
  const availability = attackAvailability(attack)
  // Expected effect already includes hit/Face-to-Face/Dodge probabilities.
  // Gate the safety contribution behind meaningful enemy effect so a harmless
  // exchange can never earn a large gunfighter score merely by surviving it.
  const attackerScore = round(100 * availability * effect.total * (0.8 + 0.2 * safety))
  return { aro: aro.id, aroType: aro.type, attack, roll, effect, returnEffect, attackerScore }
}

export function buildAttackPool(attacker, defender, weapon, mode, rangeModifier, fireteamSpecialDice, settings, { aro = false } = {}) {
  const skills = tokens(attacker.skills)
  const equipment = tokens(attacker.equipment)
  const defenderSkills = tokens(defender.skills)
  const attackAttribute = String(mode.attackAttribute || 'bs').toLowerCase()
  let target = Number(attacker[attackAttribute] ?? attacker.bs)
  target += rangeModifier
  if (settings.cover && !has(skills, 'marksmanship') && !mode.ignoresCover) target -= 3
  target += mimetismModifier(defenderSkills, equipment)
  target += numericModifier(skills, /bs attack\s*\[?\+?(\d+)\s*bs\]?/)
  const fullBurstAro = has(skills, 'total reaction') || has(skills, 'neurocinetics')
  const nativeBurst = aro && !fullBurstAro ? 1 : Number(mode.burst)
  const burst = nativeBurst + numericModifier(skills, /bs attack\s*\[?\+?(\d+)b\]?/) + Number(mode.burstBonus || 0)
  const specialDice = Number(mode.specialDice || 0) + numericModifier(skills, /bs attack\s*\[?\+?(\d+)sd\]?/) + fireteamSpecialDice
  const savingRollPenalty = Number(mode.savingRollPenalty || 0) + numericModifier(skills, /bs attack\s*sr-(\d+)/)
  return { burst, specialDice, savingRollPenalty, disposableUses: mode.disposableUses, target: clampTarget(target), criticalTarget: clampTarget(target), source: `${weapon.name}${mode.name ? ` (${mode.name})` : ''}` }
}

function attackAvailability(attack) {
  if (attack.disposableUses == null) return 1
  return Math.min(1, Math.max(0, Number(attack.disposableUses)) / 3)
}

function buildLegalAros(defender, attacker, range, settings, attackingMode) {
  if (attackingMode.attackType === 'direct-template') return [{ id: 'dodge', type: 'dodge', pool: dodgePool(defender) }]
  const results = [{ id: 'dodge', type: 'dodge', pool: dodgePool(defender) }]
  const attackerHasMsv = tokens(attacker.equipment).some((value) => /^multispectral visor l[123]$/.test(value))
  for (const weapon of defender.weapons) for (const mode of weapon.modes) {
    const modifier = rangeModifierFor(mode, range, defender.equipment)
    if (modifier === null) continue
    if (mode.smoke && attackerHasMsv && !mode.eclipse) continue
    const pool = buildAttackPool(defender, attacker, weapon, mode, modifier, 0, settings, { aro: true })
    results.push({ id: `${weapon.name}:${mode.name || mode.ammo || 'default'}`, type: mode.smoke ? (mode.eclipse ? 'eclipse' : 'smoke') : mode.attackType === 'direct-template' ? 'template' : 'shoot', pool, mode })
  }
  return results
}

function describeRoll(face, pool) {
  const success = face <= pool.target
  return { face, success, critical: success && face === pool.criticalTarget }
}

function compareRolls(active, reactive) {
  const a = active.filter((roll) => roll.success)
  const r = reactive.filter((roll) => roll.success)
  const bestA = Math.max(0, ...a.map(rollRank))
  const bestR = Math.max(0, ...r.map(rollRank))
  const activeWinners = a.filter((roll) => rollRank(roll) > bestR)
  const reactiveWinners = r.filter((roll) => rollRank(roll) > bestA)
  return {
    activeHits: activeWinners.reduce((sum, roll) => sum + 1 + (roll.critical ? 1 : 0), 0),
    reactiveHits: reactiveWinners.reduce((sum, roll) => sum + 1 + (roll.critical ? 1 : 0), 0),
  }
}

function rollRank(roll) { return roll.critical ? 100 + roll.face : roll.face }

function rangeModifierFor(mode, range, equipment = []) {
  const entry = mode.ranges.find((candidate) => candidate.min <= range.min && candidate.max >= range.max)
  if (!entry || entry.modifier == null) return null
  const modifier = Number(entry.modifier)
  if (!tokens(equipment).includes('x visor') || modifier >= 0) return modifier
  return Math.min(0, modifier + 3)
}

function expectedStateValue(mode, defender, expectedHits, failureProbability) {
  const states = Array.isArray(mode.states) ? mode.states : []
  if (!states.length) return 0
  const immunity = tokens(defender.skills).concat(tokens(defender.equipment))
  const applicableStates = states.map((state) => state.toLowerCase()).filter((state) => {
    if (state === 'isolated' && immunity.includes('warhorse')) return false
    return !immunity.includes(`immunity ${state}`)
  })
  if (applicableStates.includes('isolated') && applicableStates.includes('immobilized')) {
    return 0.9 * Math.min(1, expectedHits * failureProbability)
  }
  let combined = 0
  for (const state of applicableStates) {
    const value = STATE_VALUES[state] || 0
    combined = 1 - (1 - combined) * (1 - value)
  }
  return Math.min(1, combined) * Math.min(1, expectedHits * failureProbability)
}

function effectiveDurability(profile, mode) {
  const base = Math.max(1, Number(profile.vitality || profile.structure || 1))
  const skills = tokens(profile.skills).concat(tokens(profile.equipment))
  const shockVulnerable = /(?:^|\+)SHOCK(?:$|\+)/i.test(String(mode.ammo)) && base === 1 && !skills.includes('immunity shock')
  if (shockVulnerable) return 1
  return base + (skills.includes('no wound incapacitation') || skills.includes('dogged') ? 1 : 0)
}

function mimetismModifier(defenderSkills, attackerEquipment) {
  const mimetism = defenderSkills.includes('mimetism -6') ? -6 : defenderSkills.includes('mimetism -3') ? -3 : 0
  const msv = attackerEquipment.find((value) => /^multispectral visor l([123])$/.test(value))
  if (!msv) return mimetism
  const level = Number(msv.match(/l([123])$/)?.[1])
  return level === 1 ? Math.min(0, mimetism + 3) : 0
}

function applyOpponentFtfModifier(pool, opponent, opponentAction, protectedProfile, { allowSurprise = false } = {}) {
  if (!pool || !['shoot', 'smoke', 'eclipse', 'template'].includes(opponentAction)) return pool
  const skills = tokens(opponent.skills)
  const protectedSkills = tokens(protectedProfile?.skills)
  let modifier = 0
  for (const skill of skills) {
    const bsAttack = skill.match(/^bs attack\s+-([0-9]+)$/)
    const surprise = skill.match(/^surprise attack\s+-([0-9]+)$/)
    if (bsAttack && !protectedSkills.includes('warhorse')) modifier -= Number(bsAttack[1])
    if (surprise && allowSurprise) modifier -= Number(surprise[1])
  }
  if (!modifier) return pool
  const target = clampTarget(Number(pool.target) + Math.max(-12, modifier))
  return { ...pool, target, criticalTarget: target }
}

function dodgePool(profile) {
  const skills = tokens(profile.skills)
  const fixed = skills.find((value) => /^dodge ph=\d+$/.test(value))
  const dodgeBonus = skills.map((value) => Number(value.match(/^dodge\s*\+(\d+)$/)?.[1] || 0)).reduce((best, value) => Math.max(best, value), 0)
  const target = (fixed ? Number(fixed.split('=')[1]) : Number(profile.ph)) + dodgeBonus
  return { burst: 1, specialDice: 0, target: clampTarget(target), criticalTarget: clampTarget(target), source: 'Dodge' }
}

function compareAttackerResults(a, b) { return b.score - a.score || a.weapon.localeCompare(b.weapon) }
function compareDefenderResults(a, b) { return a.attackerScore - b.attackerScore || a.aro.localeCompare(b.aro) }
function withAttackSaveModifiers(mode, attack) { return { ...mode, savingRollPenalty: Number(mode.savingRollPenalty || 0) + Number(attack.savingRollPenalty || 0) } }
function unavailableCandidate(weapon, mode, range, reason) { return { status: 'unavailable', reason, weapon: weapon.name, mode: mode.name || mode.ammo || '', range: range.id } }
function clampTarget(value) { return Math.max(1, Math.min(20, Number(value))) }
function numericModifier(values, pattern) { const match = values.map(String).join(' ').toLowerCase().match(pattern); return match ? Number(match[1]) : 0 }
function tokens(values = []) { return values.map((value) => String(value).toLowerCase().replace(/[()[\]]/g, '').replace(/\s+/g, ' ').trim()) }
function has(values, token) { return values.includes(token) }
function round(value) { return Math.round(Number(value) * 100) / 100 }

function assertProfile(profile) {
  for (const field of ['id', 'name', 'bs', 'ph', 'weapons']) if (profile?.[field] == null) throw new Error(`Gunfighter profile is missing ${field}.`)
  if (!Array.isArray(profile.weapons)) throw new Error('Gunfighter profile weapons must be an array.')
}

function validateWeaponMode(weapon, mode) {
  if (!weapon?.name || !mode || !Array.isArray(mode.ranges)) throw new Error(`Incomplete canonical weapon data for ${weapon?.name || 'unknown weapon'}.`)
  for (const field of ['burst', 'power', 'ammo', 'save', 'attackType']) if (mode[field] == null) throw new Error(`Incomplete ${field} for ${weapon.name}.`)
}
