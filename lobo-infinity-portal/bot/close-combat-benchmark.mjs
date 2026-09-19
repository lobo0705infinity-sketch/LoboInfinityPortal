const MARTIAL_ARTS = Object.freeze({
  1: { attack: 0, opponent: -3, burst: 0, specialDice: 0 },
  2: { attack: 3, opponent: -3, burst: 0, specialDice: 0 },
  3: { attack: 3, opponent: -3, burst: 0, specialDice: 1 },
  4: { attack: 3, opponent: -3, burst: 1, specialDice: 0 },
  5: { attack: 3, opponent: -3, burst: 1, specialDice: 1 },
})

const DEFAULT_STATES = Object.freeze([
  { id: 'normal', label: 'Normal active-turn CC', type: 'face-to-face' },
  { id: 'reactive', label: 'Reactive-turn CC', type: 'reactive' },
  { id: 'surprise', label: 'Surprise Attack', type: 'face-to-face', requires: 'surprise' },
  { id: 'berserk', label: 'Berserk', type: 'face-to-face', requires: 'berserk' },
  { id: 'ally-1', label: 'One allied Trooper engaged', type: 'face-to-face', alliedBurst: 1 },
  { id: 'ally-2', label: 'Two allied Troopers engaged', type: 'face-to-face', alliedBurst: 2 },
  { id: 'protheion-1', label: 'Protheion Power-Up 1', type: 'face-to-face', requires: 'protheion', powerUp: 1 },
  { id: 'protheion-2', label: 'Protheion Power-Up 2', type: 'face-to-face', requires: 'protheion', powerUp: 2 },
])

const poolCache = new Map()
const exchangeCache = new Map()
const opposedRollCache = new Map()
const unopposedRollCache = new Map()

export function evaluateCloseCombatProfile(profile, defenders, options = {}) {
  validateProfile(profile)
  if (!Array.isArray(defenders) || !defenders.length) throw new Error('Close-combat evaluation requires defenders.')
  const states = options.states || DEFAULT_STATES
  const evaluated = states.filter((state) => stateAvailable(profile, state)).map((state) => evaluateState(profile, defenders, state))
  const normal = evaluated.find((state) => state.id === 'normal')
  return {
    profileId: profile.id,
    name: profile.name,
    rating: normal?.rating ?? 0,
    states: evaluated,
  }
}

export function evaluateCloseCombatExchange({ attacker, defender, weapon, defenderWeapon, state = DEFAULT_STATES[0] }) {
  validateProfile(attacker)
  validateProfile(defender)
  validateWeapon(weapon)
  validateWeapon(defenderWeapon)
  const active = buildCloseCombatPool(attacker, defender, weapon, state, { active: true, opponentWeapon: defenderWeapon })
  const reactiveState = { id: 'reactive', type: state.type }
  const reactive = buildCloseCombatPool(defender, attacker, defenderWeapon, reactiveState, { active: false, opponentWeapon: weapon, opponentState: state })
  const cacheKey = exchangeKey({ active, reactive, attacker, defender, weapon, defenderWeapon, state })
  const cached = exchangeCache.get(cacheKey)
  if (cached) return cached
  const roll = state.type === 'normal-rolls' ? resolveUnopposedPools(active, reactive) : resolveOpposedPools(active, reactive)
  const effect = resolveWeaponEffect(roll.activeOutcomes, weapon, defender)
  const returnEffect = resolveWeaponEffect(roll.reactiveOutcomes, defenderWeapon, attacker)
  const safety = 1 - returnEffect.neutralizeProbability
  const score = round(100 * effect.utility * (0.85 + 0.15 * safety))
  const protheion = hasSkill(attacker, /protheion/) ? protheionResult(effect, defender) : null
  const result = { score, active, reactive, roll: roll.summary, effect, returnEffect, protheion }
  exchangeCache.set(cacheKey, result)
  return result
}

export function buildCloseCombatPool(fighter, opponent, weapon, state = DEFAULT_STATES[0], { active = true, opponentWeapon = null, opponentState = null } = {}) {
  const martialArts = martialArtsLevel(fighter)
  const martial = MARTIAL_ARTS[martialArts] || MARTIAL_ARTS[0] || { attack: 0, opponent: 0, burst: 0, specialDice: 0 }
  const opponentNegative = imposedNegativeModifier(opponent, fighter, { surprise: opponentState?.id === 'surprise', weapon: opponentWeapon })
  const ignoresNegative = hasSkill(fighter, /natural born warrior/) && state.type === 'face-to-face'
  const surprise = active && state.id === 'surprise' ? surpriseModifier(fighter) : 0
  const berserk = active && state.id === 'berserk' ? berserkModifier(fighter) : 0
  let successValue = Number(fighter.cc) + martial.attack + berserk + ccAttackPositiveModifier(fighter) + Number(weapon.attackMod || 0)
  if (!ignoresNegative) successValue += opponentNegative
  const modifierTotal = clamp(successValue - Number(fighter.cc), -12, 12)
  successValue = Number(fighter.cc) + modifierTotal
  const burst = Math.max(1, Number(weapon.burst || 1) + martial.burst + ccBurstBonus(fighter) + Number(state.alliedBurst || 0))
  const specialDice = Math.max(0, martial.specialDice + ccSpecialDiceBonus(fighter))
  return {
    burst,
    specialDice,
    successValue,
    imposedOpponentMod: martial.opponent + ccOpponentModifier(fighter) + Number(weapon.opponentMod || 0) + surprise,
    source: `${fighter.name} — ${weapon.name}`,
    naturalBornWarrior: ignoresNegative,
  }
}

export function resolveOpposedPools(active, reactive) {
  const cacheKey = `${poolKey(active)}|${poolKey(reactive)}`
  const cached = opposedRollCache.get(cacheKey)
  if (cached) return cached
  const activeDistribution = poolDistribution(active)
  const reactiveDistribution = poolDistribution(reactive)
  const activeOutcomes = new Map()
  const reactiveOutcomes = new Map()
  let activeWin = 0
  let reactiveWin = 0
  let tie = 0
  for (const activeResult of activeDistribution) for (const reactiveResult of reactiveDistribution) {
    const probability = activeResult.probability * reactiveResult.probability
    const activeHits = winningHits(activeResult.ranks, reactiveResult.ranks)
    const reactiveHits = winningHits(reactiveResult.ranks, activeResult.ranks)
    addOutcome(activeOutcomes, activeHits, probability)
    addOutcome(reactiveOutcomes, reactiveHits, probability)
    if (activeHits.hits) activeWin += probability
    else if (reactiveHits.hits) reactiveWin += probability
    else tie += probability
  }
  const result = {
    activeOutcomes,
    reactiveOutcomes,
    summary: { activeWin: percent(activeWin), reactiveWin: percent(reactiveWin), noEffect: percent(tie) },
  }
  opposedRollCache.set(cacheKey, result)
  return result
}

export function resolveUnopposedPools(active, reactive) {
  const cacheKey = `${poolKey(active)}|${poolKey(reactive)}`
  const cached = unopposedRollCache.get(cacheKey)
  if (cached) return cached
  const activeOutcomes = unopposedOutcomes(active)
  const reactiveOutcomes = unopposedOutcomes(reactive)
  const activeHit = probabilityOfHits(activeOutcomes)
  const reactiveHit = probabilityOfHits(reactiveOutcomes)
  const result = {
    activeOutcomes,
    reactiveOutcomes,
    summary: { activeWin: percent(activeHit), reactiveWin: percent(reactiveHit), noEffect: percent((1 - activeHit) * (1 - reactiveHit)), simultaneous: true },
  }
  unopposedRollCache.set(cacheKey, result)
  return result
}

export function resolveWeaponEffect(outcomes, weapon, target) {
  const durability = effectiveDurability(target, weapon)
  const failureProbability = savingRollFailureProbability(weapon, target)
  let expectedWounds = 0
  let expectedCappedWounds = 0
  let neutralizeProbability = 0
  let stateProbability = 0
  for (const [key, probability] of outcomes) {
    const { hits, criticals } = parseOutcomeKey(key)
    if (!hits) continue
    const viralAffectsVitality = Boolean(weapon.viralBioweapon) && Number(target.vitality || 0) > 0
    const savingRollsPerHit = viralAffectsVitality ? 2 : Number(weapon.savingRolls || 1)
    const savingRolls = hits * savingRollsPerHit + criticals
    const distribution = savingFailureDistribution(savingRolls, failureProbability, weapon.continuousDamage, durability)
    for (let failures = 0; failures < distribution.length; failures += 1) {
      const branch = probability * distribution[failures]
      const wounds = failures * Number(weapon.woundsPerFailure || (/T2/i.test(weapon.ammo) ? 2 : 1))
      expectedWounds += branch * wounds
      expectedCappedWounds += branch * Math.min(wounds, durability)
      if (weapon.deadState && failures > 0) neutralizeProbability += branch
      else if (weapon.nonLethal) {
        if (failures > 0) stateProbability += branch
      } else if (wounds >= durability) neutralizeProbability += branch
      if (weapon.states?.length && failures > 0) stateProbability += branch
    }
  }
  neutralizeProbability = clamp(neutralizeProbability, 0, 1)
  stateProbability = clamp(stateProbability, 0, 1)
  const damageFraction = clamp(expectedCappedWounds / durability, 0, 1)
  const stateWeight = weapon.nonLethal ? 0.65 : /E\/M/i.test(weapon.ammo) ? 0.8 : 0.5
  const utility = clamp(neutralizeProbability * 0.75 + damageFraction * 0.25 + stateProbability * stateWeight * (1 - neutralizeProbability) * 0.5, 0, 1)
  return {
    expectedWounds: round(expectedWounds, 4),
    expectedCappedWounds: round(expectedCappedWounds, 4),
    neutralizeProbability: round(neutralizeProbability, 6),
    stateProbability: round(stateProbability, 6),
    failureProbability: round(failureProbability, 6),
    durability,
    utility: round(utility, 6),
  }
}

function evaluateState(profile, defenders, state) {
  const evaluatedProfile = state.powerUp ? { ...profile, vitality: Math.max(1, Number(profile.vitality || 1)) + state.powerUp } : profile
  const matchups = defenders.map((defender) => {
    const candidates = evaluatedProfile.weapons.map((weapon) => {
      const responses = defender.weapons.map((defenderWeapon) => state.type === 'reactive'
        ? reverseExchange(evaluateCloseCombatExchange({ attacker: defender, defender: evaluatedProfile, weapon: defenderWeapon, defenderWeapon: weapon, state: { ...state, type: 'face-to-face' } }))
        : evaluateCloseCombatExchange({ attacker: evaluatedProfile, defender, weapon, defenderWeapon, state }))
      const response = responses.sort((a, b) => a.score - b.score)[0]
      return { weapon: weapon.name, weaponData: weapon, response }
    })
    const selected = candidates.sort((a, b) => b.response.score - a.response.score)[0]
    return { defenderId: defender.id, defenderName: defender.name, selected, candidates }
  })
  const rating = round(matchups.reduce((sum, matchup) => sum + matchup.selected.response.score, 0) / matchups.length)
  const protheionPowerUp = round(matchups.reduce((sum, matchup) => sum + Number(matchup.selected.response.protheion?.expectedPowerUp || 0), 0) / matchups.length, 3)
  return { id: state.id, label: state.label, rating, protheionPowerUp, matchups }
}

function reverseExchange(exchange) {
  const safety = 1 - exchange.effect.neutralizeProbability
  return {
    ...exchange,
    score: round(100 * exchange.returnEffect.utility * (0.85 + 0.15 * safety)),
    effect: exchange.returnEffect,
    returnEffect: exchange.effect,
    roll: { activeWin: exchange.roll.reactiveWin, reactiveWin: exchange.roll.activeWin, noEffect: exchange.roll.noEffect },
  }
}

function poolDistribution(pool) {
  const key = poolKey(pool)
  if (poolCache.has(key)) return poolCache.get(key)
  const dice = pool.burst + pool.specialDice
  const grouped = new Map()
  enumerateFaces(dice, 1, [], (faces, probability) => {
    const ranks = faces.map((face) => rollRank(face, pool.successValue)).sort((a, b) => b - a).slice(0, pool.burst)
    const signature = ranks.join(',')
    grouped.set(signature, (grouped.get(signature) || 0) + probability)
  })
  const distribution = [...grouped].map(([signature, probability]) => ({ ranks: signature ? signature.split(',').map(Number) : [], probability }))
  poolCache.set(key, distribution)
  return distribution
}

function poolKey(pool) { return `${pool.burst}:${pool.specialDice}:${pool.successValue}` }

function enumerateFaces(remaining, minimum, faces, callback) {
  if (!remaining) {
    const probability = multinomialProbability(faces)
    callback(faces, probability)
    return
  }
  for (let face = minimum; face <= 20; face += 1) enumerateFaces(remaining - 1, face, [...faces, face], callback)
}

function multinomialProbability(faces) {
  const counts = new Map()
  for (const face of faces) counts.set(face, (counts.get(face) || 0) + 1)
  let arrangements = factorial(faces.length)
  for (const count of counts.values()) arrangements /= factorial(count)
  return arrangements / Math.pow(20, faces.length)
}

function rollRank(face, successValue) {
  if (successValue < 1 || face > Math.min(20, successValue)) return 0
  const overflow = Math.max(0, successValue - 20)
  const critical = successValue <= 20 ? face === successValue : face === 20 || face <= overflow
  return critical ? 100 + face : face
}

function winningHits(ownRanks, opposingRanks) {
  const opposingBest = Math.max(0, ...opposingRanks)
  const winners = ownRanks.filter((rank) => rank > opposingBest && rank > 0)
  return { hits: winners.length, criticals: winners.filter((rank) => rank > 100).length }
}

function unopposedOutcomes(pool) {
  const outcomes = new Map()
  for (const result of poolDistribution(pool)) {
    const winners = result.ranks.filter((rank) => rank > 0)
    addOutcome(outcomes, { hits: winners.length, criticals: winners.filter((rank) => rank > 100).length }, result.probability)
  }
  return outcomes
}

function imposedNegativeModifier(fighter, opponent, { surprise, weapon }) {
  const martial = MARTIAL_ARTS[martialArtsLevel(fighter)] || { opponent: 0 }
  return martial.opponent + ccOpponentModifier(fighter) + Number(weapon?.opponentMod || 0) + (surprise ? surpriseModifier(fighter) : 0)
}

function savingRollFailureProbability(weapon, target) {
  if (weapon.save === 'PH') {
    const modifier = Number(weapon.saveModifier || 0)
    return clamp((20 - clamp(Number(target.ph || 0) + modifier, 0, 20)) / 20, 0, 1)
  }
  let attribute = weapon.save === 'BTS' ? Number(target.bts || 0) : Number(target.arm || 0)
  if (weapon.saveFixed != null) attribute = Number(weapon.saveFixed)
  if (weapon.ap && !hasSkill(target, /immunity\s*\(?ap\)?/)) attribute = Math.ceil(attribute / 2)
  const successValue = clamp(attribute + Number(weapon.power), 0, 20)
  return clamp((20 - successValue) / 20, 0, 1)
}

function effectiveDurability(profile, weapon) {
  let durability = Math.max(1, Number(profile.vitality || profile.structure || 1))
  const hasVitality = Number(profile.vitality || 0) > 0
  const shockApplies = Boolean(weapon.shock) || (Boolean(weapon.viralBioweapon) && hasVitality)
  if (hasSkill(profile, /no wound incapacitation|dogged/) && !(shockApplies && !hasSkill(profile, /immunity\s*\(?shock\)?/))) durability += 1
  return durability
}

function protheionResult(effect, target) {
  const cap = Math.min(2, effectiveDurability(target, { shock: false }))
  return {
    expectedPowerUp: round(Math.min(cap, effect.expectedCappedWounds), 4),
    maximumPowerUp: cap,
    note: 'Applied after resolution; excess failed saves beyond the target reaching Dead grant no benefit.',
  }
}

function exchangeKey({ active, reactive, attacker, defender, weapon, defenderWeapon, state }) {
  return JSON.stringify([
    state.type,
    [active.burst, active.specialDice, active.successValue],
    [reactive.burst, reactive.specialDice, reactive.successValue],
    effectKey(weapon, defender),
    effectKey(defenderWeapon, attacker),
    hasSkill(attacker, /protheion/),
  ])
}

function effectKey(weapon, target) {
  return [weapon.power, weapon.ammo, weapon.save, weapon.saveFixed, weapon.saveModifier, weapon.savingRolls, weapon.ap, weapon.shock, weapon.viralBioweapon, weapon.continuousDamage, weapon.nonLethal, weapon.deadState, weapon.woundsPerFailure, weapon.states, target.ph, target.arm, target.bts, target.vitality, target.structure, (target.skills || []).slice().sort()]
}

function binomialDistribution(trials, failureProbability) {
  const result = Array(trials + 1).fill(0)
  for (let failures = 0; failures <= trials; failures += 1) result[failures] = choose(trials, failures) * Math.pow(failureProbability, failures) * Math.pow(1 - failureProbability, trials - failures)
  return result
}

function savingFailureDistribution(trials, failureProbability, continuousDamage, durability) {
  if (!continuousDamage) return binomialDistribution(trials, failureProbability)
  const maximum = Math.max(4, Number(durability) + 2)
  const perSave = Array(maximum + 1).fill(0)
  for (let failures = 0; failures < maximum; failures += 1) perSave[failures] = Math.pow(failureProbability, failures) * (1 - failureProbability)
  perSave[maximum] = Math.pow(failureProbability, maximum)
  let combined = [1]
  for (let trial = 0; trial < trials; trial += 1) {
    const next = Array(combined.length + maximum).fill(0)
    for (let left = 0; left < combined.length; left += 1) for (let right = 0; right < perSave.length; right += 1) next[left + right] += combined[left] * perSave[right]
    combined = next
  }
  return combined
}

function stateAvailable(profile, state) {
  if (state.requires === 'surprise') return surpriseModifier(profile) < 0
  if (state.requires === 'berserk') return hasSkill(profile, /berserk/)
  if (state.requires === 'protheion') return hasSkill(profile, /protheion/)
  return true
}

function martialArtsLevel(profile) { return Number(skillMatch(profile, /martial arts\s*(?:l|level)?\s*([1-5])/i)?.[1] || 0) }
function surpriseModifier(profile) { return negativeSkillModifier(profile, /surprise attack/) }
function berserkModifier(profile) { return positiveSkillModifier(profile, /berserk/) }
function ccOpponentModifier(profile) { return negativeSkillModifier(profile, /cc attack/) }
function ccAttackPositiveModifier(profile) { return positiveSkillModifier(profile, /cc attack/) }
function ccBurstBonus(profile) { return modifierSum(profile, /cc attack/, /\+(\d+)\s*b/i) }
function ccSpecialDiceBonus(profile) { return modifierSum(profile, /cc attack/, /\+(\d+)\s*sd/i) }

function negativeSkillModifier(profile, namePattern) {
  const values = skillValues(profile, namePattern, /-(\d+)/)
  return values.length ? -Math.max(...values) : 0
}

function positiveSkillModifier(profile, namePattern) {
  const values = skillValues(profile, namePattern, /\+(\d+)(?!\s*(?:b|sd|dam))/i)
  return values.length ? Math.max(...values) : 0
}

function modifierSum(profile, namePattern, modifierPattern) {
  return skillValues(profile, namePattern, modifierPattern).reduce((sum, value) => sum + value, 0)
}

function skillValues(profile, namePattern, modifierPattern) {
  return (profile.skills || []).filter((skill) => namePattern.test(String(skill).toLowerCase())).map((skill) => String(skill).match(modifierPattern)).filter(Boolean).map((match) => Number(match[1]))
}

function skillMatch(profile, pattern) {
  for (const skill of profile.skills || []) {
    const match = String(skill).match(pattern)
    if (match) return match
  }
  return null
}

function hasSkill(profile, pattern) { return (profile.skills || []).some((skill) => pattern.test(String(skill).toLowerCase())) }
function probabilityOfHits(outcomes) { return [...outcomes].reduce((sum, [key, probability]) => sum + (parseOutcomeKey(key).hits ? probability : 0), 0) }
function addOutcome(map, outcome, probability) { const key = `${outcome.hits}:${outcome.criticals}`; map.set(key, (map.get(key) || 0) + probability) }
function parseOutcomeKey(key) { const [hits, criticals] = String(key).split(':').map(Number); return { hits, criticals } }
function choose(n, k) { return factorial(n) / (factorial(k) * factorial(n - k)) }
function factorial(value) { let result = 1; for (let n = 2; n <= value; n += 1) result *= n; return result }
function percent(value) { return round(value * 100, 4) }
function round(value, digits = 2) { const factor = 10 ** digits; return Math.round((Number(value) + Number.EPSILON) * factor) / factor }
function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value))) }

function validateProfile(profile) {
  if (!profile || !Number.isFinite(Number(profile.cc))) throw new Error('Close-combat profile requires a CC Attribute.')
  if (!Array.isArray(profile.weapons) || !profile.weapons.length) throw new Error(`Close-combat profile has no CC weapon: ${profile?.name || 'unknown'}`)
}

function validateWeapon(weapon) {
  if (!weapon?.name || !Number.isFinite(Number(weapon.power))) throw new Error('CC weapon requires a name and fixed PS value.')
  if (!['ARM', 'BTS', 'PH'].includes(weapon.save)) throw new Error(`Unsupported CC weapon Saving Roll: ${weapon.save}`)
}

export { DEFAULT_STATES, MARTIAL_ARTS }
