import { traitTokens, criticalRank, successValue, coverBenefits, resolveSavingEffects } from './combat-rules.mjs'

export const STANDARD_RANGE_BANDS = Object.freeze([
  { id: '0-8', min: 0, max: 8, weight: 0.05 },
  { id: '8-16', min: 8, max: 16, weight: 0.20 },
  { id: '16-24', min: 16, max: 24, weight: 0.30 },
  { id: '24-32', min: 24, max: 32, weight: 0.25 },
  { id: '32-40', min: 32, max: 40, weight: 0.12 },
  { id: '40-48', min: 40, max: 48, weight: 0.06 },
  // Fire lanes beyond 48 inches are legal but uncommon on a standard table.
  // Keep testing every weapon in this band while reducing its contribution to
  // the aggregate rating to one quarter of a typical engagement band.
  { id: '48-96', min: 48, max: 96, weight: 0.02 },
])

export const STATE_VALUES = Object.freeze({
  dead: 1,
  unconscious: 1,
  isolated: 0.9,
  immobilized: 0.5,
  stunned: 0.35,
  targeted: 0.25,
})

// A successful Stun ARO ends the immediate attack run and forces the active
// trooper to deal with the State. Its reactive-turn value is therefore higher
// than its active-turn/CC utility, without changing those other benchmarks.
export const ARO_STATE_VALUES = Object.freeze({
  ...STATE_VALUES,
  stunned: 0.5,
})

const DEFAULT_OPTIONS = Object.freeze({
  cover: true,
  excludeDirectTemplates: false,
  ranges: STANDARD_RANGE_BANDS,
  stateValues: STATE_VALUES,
  surpriseAttack: false,
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

export function evaluateAroProfile(profile, attackers, options = {}) {
  const settings = { ...DEFAULT_OPTIONS, stateValues: ARO_STATE_VALUES, ...options }
  assertProfile(profile)
  if (!Array.isArray(attackers) || !attackers.length) throw new Error('ARO evaluation requires at least one attacker.')
  const states = [{ id: 'normal', specialDice: 0 }]
  if (profile.fireteamCapable) states.push({ id: 'fireteam', specialDice: 1 })
  return {
    profileId: profile.id,
    name: profile.name,
    states: states.map((state) => evaluateAroState(profile, attackers, settings, state)),
  }
}

function evaluateAroState(profile, attackers, settings, state) {
  const matchups = []
  for (const benchmark of attackers) {
    const attacker = benchmark.profile || benchmark
    const attackerSpecialDice = Number(benchmark.specialDice || 0)
    assertProfile(attacker)
    for (const range of settings.ranges) {
      const candidates = attacker.weapons.flatMap((weapon) => weapon.modes.map((mode) => evaluateAttackCandidate({
        attacker,
        defender: profile,
        weapon,
        mode,
        range,
        fireteamSpecialDice: attackerSpecialDice,
        defenderFireteamSpecialDice: state.specialDice,
        responseObjective: 'aro',
        settings,
      })))
      const available = candidates.filter((candidate) => candidate.status === 'evaluated')
      const selected = available.sort(compareAttackerResults)[0] || null
      matchups.push({
        attackerId: attacker.id,
        attackerName: attacker.name,
        range: range.id,
        selected,
        candidates,
      })
    }
  }
  return {
    id: state.id,
    fireteamSpecialDice: state.specialDice,
    rating: weightedAroMatchupRating(matchups, settings.ranges),
    matchups,
  }
}

export function evaluateState(profile, defenders, settings, state) {
  const matchups = []
  const defenderWeights = benchmarkDefenderWeights(defenders)
  for (const defender of defenders) {
    assertProfile(defender)
    const byWeapon = new Map()
    for (const range of settings.ranges) {
      const candidates = profile.weapons.flatMap((weapon) => weapon.modes.map((mode) => evaluateAttackCandidate({
        attacker: profile,
        defender,
        weapon,
        mode,
        range,
        fireteamSpecialDice: state.specialDice,
        defenderFireteamSpecialDice: Number(defender.fireteamSpecialDice || 0),
        settings,
      })))
      matchups.push({
        defenderId: defender.id,
        defenderName: defender.name,
        defenderWeight: defenderWeights.get(defender.id),
        rangeWeight: Number(range.weight ?? 1),
        range: range.id,
        selected: null,
        candidates,
      })
      for (const candidate of candidates) {
        if (candidate.status !== 'evaluated') continue
        const key = `${candidate.weapon}\u0000${candidate.mode}`
        const record = byWeapon.get(key) || { key, weapon: candidate.weapon, mode: candidate.mode, score: 0 }
        record.score += Number(candidate.score || 0) * Number(range.weight ?? 1)
        byWeapon.set(key, record)
      }
    }
    const primary = [...byWeapon.values()].sort((a, b) => b.score - a.score || a.weapon.localeCompare(b.weapon) || a.mode.localeCompare(b.mode))[0] || null
    for (const matchup of matchups.filter((entry) => entry.defenderId === defender.id)) {
      matchup.primaryWeapon = primary ? (primary.mode && !['normal', 'default'].includes(primary.mode.toLowerCase()) ? `${primary.weapon} (${primary.mode})` : primary.weapon) : null
      matchup.selected = primary
        ? matchup.candidates.find(candidate => candidate.status === 'evaluated' && candidate.weapon === primary.weapon && candidate.mode === primary.mode) || null
        : null
    }
  }
  return {
    id: state.id,
    fireteamSpecialDice: state.specialDice,
    rating: weightedMatchupRating(matchups, settings.ranges),
    matchups,
  }
}

function weightedAroMatchupRating(matchups, ranges) {
  if (!matchups.length) return null
  const weights = new Map(ranges.map((range) => [range.id, Math.max(0, Number(range.weight ?? 1))]))
  const totalWeight = matchups.reduce((sum, matchup) => sum + (weights.get(matchup.range) ?? 1), 0)
  if (!totalWeight) return 0
  const weightedScore = matchups.reduce((sum, matchup) => {
    const weight = weights.get(matchup.range) ?? 1
    return sum + Number(matchup.selected?.optimalResponse?.defenderScore || 0) * weight
  }, 0)
  return round(weightedScore / totalWeight)
}

function weightedMatchupRating(matchups, ranges) {
  if (!matchups.length) return null
  const weights = new Map(ranges.map((range) => [range.id, Math.max(0, Number(range.weight ?? 1))]))
  const totalWeight = matchups.reduce((sum, matchup) => sum + (weights.get(matchup.range) ?? 1) * (matchup.defenderWeight ?? 1), 0)
  if (!totalWeight) return 0
  const weightedScore = matchups.reduce((sum, matchup) => {
    const weight = (weights.get(matchup.range) ?? 1) * (matchup.defenderWeight ?? 1)
    return sum + (matchup.selected?.score ?? 0) * weight
  }, 0)
  return round(weightedScore / totalWeight)
}

export function benchmarkDefenderWeights(defenders) {
  const categories = new Map()
  for (const defender of defenders) {
    const key = defender.archetype || defender.id
    if (!categories.has(key)) categories.set(key, { weight: Number(defender.archetypeWeight ?? 1), variants: new Map() })
    const category = categories.get(key)
    if (!Number.isFinite(category.weight) || category.weight < 0) throw Error('Invalid defender weight')
    const group = defender.variantGroup || defender.id
    category.variants.set(group, [...(category.variants.get(group) || []), defender.id])
  }
  const total = [...categories.values()].reduce((sum, c) => sum + c.weight, 0)
  if (!(total > 0)) throw Error('Benchmark requires positive defender weight')
  const weights = new Map()
  for (const c of categories.values()) for (const ids of c.variants.values()) for (const id of ids) weights.set(id, c.weight / total / c.variants.size / ids.length)
  return weights
}

export function evaluateAttackCandidate({ attacker, defender, weapon, mode, range, fireteamSpecialDice = 0, defenderFireteamSpecialDice = 0, responseObjective = 'gunfighter', settings = DEFAULT_OPTIONS }) {
  validateWeaponMode(weapon, mode)
  if (mode.deployable) return unavailableCandidate(weapon, mode, range, 'deployable-not-direct-attack')
  if (mode.smoke || mode.eclipse) return unavailableCandidate(weapon, mode, range, 'non-offensive-smoke')
  const rangeModifier = rangeModifierFor(mode, range, attacker.equipment)
  if (rangeModifier === null) return unavailableCandidate(weapon, mode, range, 'out-of-range')
  if (mode.attackType === 'direct-template' && range.min >= Number(mode.templateRange || 8)) return unavailableCandidate(weapon, mode, range, 'out-of-range')
  const attack = buildAttackPool(attacker, defender, weapon, mode, rangeModifier, fireteamSpecialDice, settings)
  const legalAros = buildLegalAros(defender, attacker, range, settings, mode, defenderFireteamSpecialDice)
  if (!legalAros.length) legalAros.push({ id: 'no-aro', type: 'none' })
  const responses = legalAros.map((aro) => resolveExchange({ attack, aro, attacker, defender, weapon, mode, range, settings }))
  const optimalResponse = responses.sort(responseObjective === 'aro' ? compareAroResults : compareDefenderResults)[0]
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
  const activeOutcomes = winningOutcomeDistribution(active, reactiveSummary)
  const reactiveOutcomes = winningOutcomeDistribution(reactive, activeSummary)
  const expectedActiveHits = expectedOutcomeValue(activeOutcomes, 'hits')
  const expectedReactiveHits = expectedOutcomeValue(reactiveOutcomes, 'hits')
  const expectedActiveCriticals = expectedOutcomeValue(activeOutcomes, 'criticals')
  const expectedReactiveCriticals = expectedOutcomeValue(reactiveOutcomes, 'criticals')
  const result = {
    activeWin: round(activeWin * 100),
    reactiveWin: round(reactiveWin * 100),
    noEffect: round(noEffect * 100),
    expectedActiveHits,
    expectedReactiveHits,
    expectedActiveCriticals,
    expectedReactiveCriticals,
    activeOutcomes,
    reactiveOutcomes,
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

export function resolveNormalRoll(pool) {
  const summary = summarizePool(pool)
  const success = summary.ranks.reduce((sum, state) => sum + state.bestProbability, 0)
  const outcomes = winningOutcomeDistribution(pool, null)
  const expectedHits = expectedOutcomeValue(outcomes, 'hits')
  const expectedCriticals = expectedOutcomeValue(outcomes, 'criticals')
  return { success: round(success * 100), successProbability: success, expectedHits, expectedCriticals, outcomes }
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

export function expectedEffectFromHits({ expectedHits, expectedCriticals = 0, outcomes = null, mode, defender, cover = true, stateValues = STATE_VALUES }) {
  const resolvedOutcomes = outcomes || fractionalOutcomeDistribution(expectedHits, expectedCriticals)
  const effect = resolveSavingEffects(resolvedOutcomes, mode, defender, { cover })
  const damageValue = Math.min(effect.expectedCappedWounds / effect.durability, 1)
  const states = effect.states
  const combined = states.includes('isolated') && states.includes('immobilized')
    ? Math.max(stateValues.isolated || 0, stateValues.immobilized || 0)
    : 1 - states.reduce((p, state) => p * (1 - (stateValues[state] || 0)), 1)
  const stateValue = combined * effect.stateProbability
  return {
    expectedDamage: effect.expectedWounds,
    damageProbability: effect.nonLethal ? 0 : effect.failureProbability,
    woundDistribution: effect.woundDistribution,
    nonLethal: effect.nonLethal,
    stateProbability: effect.stateProbability,
    meaningfulEffectProbability: effect.nonLethal ? effect.stateProbability : Math.max(effect.failureProbability, effect.stateProbability),
    neutralizeProbability: effect.neutralizeProbability,
    damageValue,
    stateValue,
    total: Math.min(1, damageValue + stateValue * (1 - damageValue)),
  }
}

function resolveExchange({ attack, aro, attacker, defender, mode, settings }) {
  const effectFor = (outcomes, m, pool, target) => expectedEffectFromHits({ outcomes, mode: withAttackSaveModifiers(m, pool), defender: target, cover: settings.cover, stateValues: settings.stateValues || STATE_VALUES })
  if (mode.attackType === 'direct-template') {
    const dodge = aro.type === 'dodge' ? resolveNormalRoll(aro.pool) : { success: 0 }
    const hitProbability = 1 - (dodge.successProbability ?? 0)
    const outcomes = new Map([['0:0', 1 - hitProbability], [`${attack.burst}:0`, hitProbability]])
    const effect = effectFor(outcomes, mode, attack, defender)
    const retaliation = aro.type === 'template' ? { success: 100, expectedHits: aro.pool.burst, outcomes: new Map([[`${aro.pool.burst}:0`, 1]]) } : aro.type === 'shoot' ? resolveNormalRoll(aro.pool) : null
    const returnEffect = retaliation ? effectFor(retaliation.outcomes, aro.mode, aro.pool, attacker) : null
    return exchangeResult(attack, aro, { activeWin: 100 - dodge.success, reactiveWin: retaliation?.success || 0, noEffect: dodge.success, expectedActiveHits: attack.burst * hitProbability, expectedReactiveHits: retaliation?.expectedHits || 0, simultaneous: !!retaliation }, effect, returnEffect)
  }
  if (aro.type === 'none') {
    const roll = resolveNormalRoll(attack)
    const effect = effectFor(roll.outcomes, mode, attack, defender)
    return exchangeResult(attack, aro, { activeWin: roll.success, reactiveWin: 0, noEffect: 100 - roll.success, expectedActiveHits: roll.expectedHits, expectedReactiveHits: 0 }, effect, null)
  }
  if (aro.type === 'template') {
    const roll = resolveNormalRoll(attack)
    const effect = effectFor(roll.outcomes, mode, attack, defender)
    const returnEffect = effectFor(new Map([[`${aro.pool.burst}:0`, 1]]), aro.mode, aro.pool, attacker)
    return exchangeResult(attack, aro, { activeWin: roll.success, reactiveWin: 100, noEffect: 0, expectedActiveHits: roll.expectedHits, expectedReactiveHits: aro.pool.burst, simultaneous: true }, effect, returnEffect)
  }
  const activePool = applyOpponentFtfModifier(attack, defender, aro.type, attacker, { allowSurprise: false })
  const reactivePool = applyOpponentFtfModifier(aro.pool, attacker, 'shoot', defender, { allowSurprise: settings.surpriseAttack === true && Boolean(attacker.markerState || attacker.hiddenDeploymentState) })
  const f2f = resolveFaceToFace(activePool, reactivePool)
  const effect = effectFor(f2f.activeOutcomes, mode, attack, defender)
  const returnEffect = aro.mode && !aro.mode.smoke && !aro.mode.eclipse ? effectFor(f2f.reactiveOutcomes, aro.mode, aro.pool, attacker) : { total: 0 }
  return exchangeResult(activePool, { ...aro, pool: reactivePool }, f2f, effect, returnEffect)
}

function exchangeResult(attack, aro, roll, effect, returnEffect) {
  const safety = 1 - Number(returnEffect?.total || 0)
  const availability = attackAvailability(attack)
  // Expected effect already includes hit/Face-to-Face/Dodge probabilities.
  // Gate the safety contribution behind meaningful enemy effect so a harmless
  // exchange can never earn a large gunfighter score merely by surviving it.
  const attackerScore = round(100 * availability * effect.total * (0.8 + 0.2 * safety))
  const defenderSafety = 1 - Number(effect?.total || 0)
  const defenderAvailability = attackAvailability(aro.pool || {})
  const defenderScore = ['smoke', 'eclipse', 'dodge', 'none'].includes(aro.type)
    ? 0
    : round(100 * defenderAvailability * Number(returnEffect?.total || 0) * (0.8 + 0.2 * defenderSafety))
  return { aro: aro.id, aroType: aro.type, attack, roll: { ...roll, attack, reactive: aro.pool || null }, effect, returnEffect, attackerScore, defenderScore }
}

export function buildAttackPool(attacker, defender, weapon, mode, rangeModifier, fireteamSpecialDice, settings, { aro = false } = {}) {
  const skills = tokens(attacker.skills)
  const equipment = tokens(attacker.equipment)
  const defenderSkills = tokens(defender.skills)
  const attackAttribute = String(mode.attackAttribute || 'bs').toLowerCase()
  const baseTarget = Number(attacker[attackAttribute] ?? attacker.bs)
  let modifiers = rangeModifier
  const modifierSources = [formatModifier('Range', rangeModifier)]
  // Smoke targets a table point, not the enemy Trooper.
  if (!mode.smoke && !mode.eclipse) {
    const cover = !has(skills, 'marksmanship') && !mode.ignoresCover ? coverBenefits(defender, settings.cover).hit : 0
    const mimetism = mimetismModifier(defenderSkills, equipment)
    modifiers += cover + mimetism
    if (cover) modifierSources.push(formatModifier('Cover', cover))
    if (mimetism) modifierSources.push(formatModifier('Mimetism / MSV', mimetism))
  }
  const nativeBs = numericModifier(skills, /^bs attack\s*\+(\d+)(?:\s*bs)?$/)
  modifiers += nativeBs
  if (nativeBs) modifierSources.push(formatModifier('BS Attack', nativeBs))
  const fullBurstAro = has(skills, 'total reaction') || has(skills, 'neurocinetics')
  const neuroActive = !aro && has(skills, 'neurocinetics')
  const nativeBurst = (aro && !fullBurstAro) || neuroActive ? 1 : Number(mode.burst)
  const burstBonus = (!aro || fullBurstAro) && !neuroActive ? numericModifier(skills, /bs attack\s*\+?(\d+)\s*b$/) + Number(mode.burstBonus || 0) : 0
  const burst = Math.max(1, Math.min(6, nativeBurst + burstBonus))
  const specialDice = mode.attackType === 'direct-template' || mode.longSkill ? 0 : Number(mode.specialDice || 0) + numericModifier(skills, /bs attack\s*\+?(\d+)\s*sd$/) + fireteamSpecialDice
  if (fireteamSpecialDice) modifierSources.push('Fireteam +1SD')
  const savingRollPenalty = Number(mode.savingRollPenalty || 0) + numericModifier(skills, /bs attack\s*sr-(\d+)/)
  const target = successValue(baseTarget, modifiers)
  return { burst, specialDice, savingRollPenalty, shock: has(skills, 'bs attack shock'), continuousDamage: has(skills, 'bs attack continuous damage'), baseTarget, modifiers, modifierSources: modifierSources.filter(Boolean), disposableUses: mode.disposableUses, target, criticalTarget: target, source: [weapon.name, mode.name && '(' + mode.name + ')'].filter(Boolean).join(' ') }
}

function formatModifier(label, value) { return Number(value) ? label + ' ' + (Number(value) > 0 ? '+' : '') + Number(value) : '' }

function attackAvailability(attack) {
  if (attack.disposableUses == null) return 1
  return Math.min(1, Math.max(0, Number(attack.disposableUses)) / 3)
}

function buildLegalAros(defender, attacker, range, settings, attackingMode, fireteamSpecialDice = 0) {
  const results = [{ id: 'dodge', type: 'dodge', pool: dodgePool(defender) }]
  const attackerHasMsv = tokens(attacker.equipment).some((value) => /^multispectral visor l[123]$/.test(value))
  for (const weapon of defender.weapons) for (const mode of weapon.modes) {
    if (mode.deployable) continue
    if (settings.excludeDirectTemplates && mode.attackType === 'direct-template') continue
    if (mode.attackType === 'direct-template' && range.min >= Number(mode.templateRange || 8)) continue
    // Benchmark assumption: legal close placement around the user blocks LoF.
    // Enemy distance is not the distance to that targetless placement point.
    const responseRange = mode.smoke || mode.eclipse ? { min: 0, max: 1 } : range
    const modifier = rangeModifierFor(mode, responseRange, defender.equipment)
    if (modifier === null) continue
    if (mode.smoke && attackerHasMsv && !mode.eclipse) continue
    const pool = buildAttackPool(defender, attacker, weapon, mode, modifier, fireteamSpecialDice, settings, { aro: true })
    results.push({ id: `${weapon.name}:${mode.name || mode.ammo || 'default'}`, type: mode.smoke ? (mode.eclipse ? 'eclipse' : 'smoke') : mode.attackType === 'direct-template' ? 'template' : 'shoot', pool, mode })
  }
  return results
}

function describeRoll(face, pool) {
  const rank = criticalRank(face, pool.target)
  return { face, success: rank > 0, critical: rank === 120 }
}

// All Criticals tie, regardless of their Success Values or opposing counts.
function rollRank(roll) { return roll.critical ? 120 : roll.face }

function rangeModifierFor(mode, range, equipment = []) {
  const entry = mode.ranges.find((candidate) => candidate.min <= range.min && candidate.max >= range.max)
  if (!entry || entry.modifier == null) return null
  const modifier = Number(entry.modifier)
  if (!tokens(equipment).includes('x visor') || modifier >= 0) return modifier
  return Math.min(0, modifier + 3)
}

function winningOutcomeDistribution(pool, opposingSummary) {
  const thresholds = opposingSummary
    ? [{ rank: 0, probability: opposingSummary.below(1) }, ...opposingSummary.ranks.map((state) => ({ rank: state.rank, probability: state.bestProbability }))]
    : [{ rank: 0, probability: 1 }]
  const outcomes = new Map()
  const dice = Math.max(1, Number(pool.burst || 1)) + Math.max(0, Number(pool.specialDice || 0))
  const retained = Math.max(1, Number(pool.burst || 1))
  for (const threshold of thresholds) {
    if (!threshold.probability) continue
    let criticalProbability = 0
    let ordinaryProbability = 0
    for (let face = 1; face <= 20; face += 1) {
      const roll = describeRoll(face, pool)
      if (!roll.success || rollRank(roll) <= threshold.rank) continue
      if (roll.critical) criticalProbability += 0.05
      else ordinaryProbability += 0.05
    }
    const otherProbability = Math.max(0, 1 - criticalProbability - ordinaryProbability)
    for (let criticals = 0; criticals <= dice; criticals += 1) for (let ordinary = 0; ordinary <= dice - criticals; ordinary += 1) {
      const other = dice - criticals - ordinary
      const probability = threshold.probability * multinomial3(dice, criticals, ordinary, other)
        * Math.pow(criticalProbability, criticals) * Math.pow(ordinaryProbability, ordinary) * Math.pow(otherProbability, other)
      if (!probability) continue
      const keptCriticals = Math.min(criticals, retained)
      const keptOrdinary = Math.min(ordinary, retained - keptCriticals)
      addOutcome(outcomes, keptCriticals + keptOrdinary, keptCriticals, probability)
    }
  }
  return outcomes
}

function fractionalOutcomeDistribution(expectedHits, expectedCriticals) {
  const hits = Math.max(0, Number(expectedHits || 0))
  if (!hits) return new Map()
  const whole = Math.floor(hits)
  const fraction = hits - whole
  const criticals = Math.min(whole, Math.max(0, Math.round(Number(expectedCriticals || 0))))
  const outcomes = new Map()
  addOutcome(outcomes, whole, criticals, 1 - fraction)
  if (fraction) addOutcome(outcomes, whole + 1, criticals, fraction)
  return outcomes
}

function addOutcome(map, hits, criticals, probability) { const key = `${hits}:${criticals}`; map.set(key, (map.get(key) || 0) + probability) }
function parseOutcomeKey(key) { const [hits, criticals] = String(key).split(':').map(Number); return { hits, criticals } }
function expectedOutcomeValue(outcomes, field) { return [...outcomes].reduce((sum, [key, probability]) => sum + parseOutcomeKey(key)[field] * probability, 0) }

function mimetismModifier(defenderSkills, attackerEquipment) {
  const mimetism = defenderSkills.includes('mimetism -6') ? -6 : defenderSkills.includes('mimetism -3') ? -3 : 0
  const msv = attackerEquipment.find((value) => /^multispectral visor l([123])$/.test(value))
  if (!msv) return mimetism
  const level = Number(msv.match(/l([123])$/)?.[1])
  return level === 1 ? Math.min(0, mimetism + 3) : 0
}

function applyOpponentFtfModifier(pool, opponent, opponentAction, protectedProfile, { allowSurprise = false } = {}) {
  if (!pool) return pool
  const skills = tokens(opponent.skills)
  const equipment = tokens(opponent.equipment)
  const protectedSkills = tokens(protectedProfile?.skills)
  // Sixth Sense protects Dodge, not BS/CC Surprise responses (Combat Instinct does that).
  if (pool.source === 'Dodge' && protectedSkills.includes('sixth sense')) return pool
  let modifier = 0
  for (const skill of skills) {
    const bsAttack = skill.match(/^bs attack\s+-([0-9]+)$/)
    const surprise = skill.match(/^surprise attack\s+-([0-9]+)$/)
    if (bsAttack && opponentAction !== 'dodge' && !protectedSkills.includes('warhorse')) modifier -= Number(bsAttack[1])
    const dodge = skill.match(/^dodge\s+-([0-9]+)$/)
    if (dodge && opponentAction === 'dodge') modifier -= Number(dodge[1])
    if (surprise && allowSurprise && !protectedSkills.includes('combat instinct') && !tokens(protectedProfile?.equipment).includes('multispectral visor l3')) modifier -= Number(surprise[1])
  }
  // Albedo is printed as equipment by Army data, but imposes a BS Attack MOD
  // on an opposing shooting roll just like the corresponding skill notation.
  for (const item of equipment) {
    const albedo = item.match(/^albedo\s*-([0-9]+)$/)
    if (albedo && opponentAction !== 'dodge') modifier -= Number(albedo[1])
  }
  if (!modifier) return pool
  const modifiers = Number(pool.modifiers || 0) + modifier
  const target = successValue(pool.baseTarget ?? pool.target, modifiers)
  const modifierSources = [...(pool.modifierSources || []), formatModifier('Opponent MOD', modifier)]
  return { ...pool, modifiers, modifierSources, target, criticalTarget: target }
}

function dodgePool(profile) {
  const skills = tokens(profile.skills)
  const fixed = skills.find((value) => /^dodge ph=\d+$/.test(value))
  const dodgeBonus = skills.map((value) => Number(value.match(/^dodge\s*\+(\d+)$/)?.[1] || 0)).reduce((best, value) => Math.max(best, value), 0)
  const target = successValue(fixed ? Number(fixed.split('=')[1]) : Number(profile.ph), dodgeBonus)
  const specialDice = numericModifier(skills, /^dodge\s*\+(\d+)\s*sd$/)
  return { burst: 1, specialDice, baseTarget: fixed ? Number(fixed.split('=')[1]) : Number(profile.ph), modifiers: dodgeBonus, target, criticalTarget: target, source: 'Dodge' }
}

function compareAttackerResults(a, b) { return b.score - a.score || a.weapon.localeCompare(b.weapon) }
function compareDefenderResults(a, b) { return a.attackerScore - b.attackerScore || a.aro.localeCompare(b.aro) }
function compareAroResults(a, b) { return b.defenderScore - a.defenderScore || a.attackerScore - b.attackerScore || a.aro.localeCompare(b.aro) }
function withAttackSaveModifiers(mode, attack) { return { ...mode, savingRollPenalty: Number(attack.savingRollPenalty || 0), shock: mode.shock || attack.shock, continuousDamage: mode.continuousDamage || attack.continuousDamage } }
function unavailableCandidate(weapon, mode, range, reason) { return { status: 'unavailable', reason, weapon: weapon.name, mode: mode.name || mode.ammo || '', range: range.id } }
function numericModifier(values, pattern) { return values.reduce((sum, value) => sum + Number(String(value).match(pattern)?.[1] || 0), 0) }
const tokens = traitTokens
function has(values, token) { return values.includes(token) }
function round(value) { return Math.round(Number(value) * 100) / 100 }

function assertProfile(profile) {
  for (const field of ['id', 'name', 'bs', 'ph', 'weapons']) if (profile?.[field] == null) throw new Error(`Gunfighter profile is missing ${field}.`)
  if (!Array.isArray(profile.weapons)) throw new Error('Gunfighter profile weapons must be an array.')
}

function validateWeaponMode(weapon, mode) {
  if (!weapon?.name || !mode || !Array.isArray(mode.ranges)) throw new Error(`Incomplete canonical weapon data for ${weapon?.name || 'unknown weapon'}.`)
  for (const field of ['burst', 'power', 'ammo', 'attackType']) if (mode[field] == null) throw new Error(`Incomplete ${field} for ${weapon.name}.`)
  if (!mode.smoke && !mode.eclipse && mode.save == null) throw new Error(`Incomplete save for ${weapon.name}.`)
}
