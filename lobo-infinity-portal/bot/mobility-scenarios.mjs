export const MOBILITY_SCENARIO_VERSION = 'mobility-scenarios-v1'

const normalizedTraits = profile => [...new Set([...(profile.skills || []), ...(profile.equipment || [])].map(s => s.replace(/\s+/g, ' ').trim()))]
const distance = (traits, skill, fallback) => {
  const matches = traits.flatMap(s => {
    const m = s.match(new RegExp(`^${skill}\\(\\+(\\d+(?:\\.\\d+)?)["″]\\)$`))
    return m ? [Number(m[1])] : []
  })
  return matches.length ? Math.max(...matches) : fallback
}
const orders = (path, capacity) => capacity > 0 ? Math.ceil(path / capacity) : null

export function normalDodge(profile) {
  const traits = normalizedTraits(profile)
  let ph = profile.ph
  let bonus = 0
  let extraDice = 0
  for (const trait of traits) {
    const fixed = trait.match(/^Dodge\(PH=(\d+)\)$/)
    const mod = trait.match(/^Dodge\(\+(\d+)\)$/)
    const sd = trait.match(/^Dodge\(\+(\d+)SD\)$/)
    if (fixed) ph = Number(fixed[1])
    if (mod) bonus += Number(mod[1])
    if (sd) extraDice += Number(sd[1])
  }
  if (!(typeof ph === 'number' && ph > 0)) return { status: 'missing-ph' }
  const target = ph + bonus
  const singleSuccess = Math.max(0, Math.min(20, target)) / 20
  const probability = 1 - (1 - singleSuccess) ** (1 + extraDice)
  const movement = 2 + traits.reduce((total, s) => total + Number(s.match(/^Dodge\(\+(\d+(?:\.\d+)?)["″]\)$/)?.[1] || 0), 0)
  // Dodge(-3/-6) affects the opponent in face-to-face rolls, not this Normal Roll.
  return { status: 'ok', target, extraDice, distance: movement, successProbability: probability, expectedDistance: Number((movement * probability).toFixed(4)) }
}

export function terrainMovement(profile, terrain, chosenTerrain = null) {
  const traits = normalizedTraits(profile)
  const specifications = traits.flatMap(s => s.match(/^Terrain\(([^)]+)\)$/)?.[1] || [])
  const choices = specifications.flatMap(x => x.split('/').map(t => t.trim()))
  const total = choices.includes('Total')
  if (!total && specifications.some(x => x.includes('/')) && !chosenTerrain) return { status: 'terrain-choice-required' }
  if (chosenTerrain && !choices.includes(chosenTerrain)) throw Error('Terrain choice not present on profile')
  if (traits.includes('Terrain') && !specifications.length) return { status: 'terrain-type-unspecified' }
  const match = total || (chosenTerrain ? chosenTerrain === terrain : choices.includes(terrain))
  const [a, b] = profile.mov
  // Starts inside and remains in Difficult Terrain; no entry-boundary movement.
  return { status: 'ok', matches: match, first: Math.max(0, a + (match ? 1 : -1)), second: Math.max(0, b - (match ? 0 : 1)) }
}

export function evaluateMobilityScenarios(profile) {
  if (!Array.isArray(profile.mov) || profile.mov.length !== 2 || profile.mov.some(x => typeof x !== 'number' || !Number.isFinite(x) || x < 0)) return { status: 'unranked-no-movement' }
  const traits = normalizedTraits(profile)
  const has = pattern => traits.some(x => pattern.test(x))
  const [a, b] = profile.mov
  const superJump = has(/^Super-Jump(?:\(|$)/)
  const jet = has(/^Super-Jump\(Jet Propulsion\)$/)
  const climbingPlus = has(/^Climbing Plus(?:\(|$)/)
  const motorcycle = has(/^(?:AI )?Motorcycle(?:\(|$)/)
  const aerial = has(/^Aerial$/)
  const jumpAllowance = distance(traits, 'Jump', 2)
  const superAllowance = distance(traits, 'Super-Jump', jumpAllowance)
  const shortJump = superJump ? a + superAllowance : null
  const longJump = a + (superJump ? 4 : jumpAllowance)
  // Aerial cannot enter scenery contact, which Climb requires.
  const climb = motorcycle || aerial ? null : a + distance(traits, 'Climb', 2)
  const bestTravel = (first, second) => Math.max(first + second, first + (superJump ? 4 : jumpAllowance), superJump ? first + superAllowance + second : 0)
  const terrain = Object.fromEntries(['Aquatic', 'Desert', 'Mountain', 'Jungle', 'Zero-G'].map(type => {
    const result = terrainMovement(profile, type)
    return [type, result.status === 'ok' ? { ...result, moveMove: result.first + result.second, bestTravel: bestTravel(result.first, result.second), ordersFor12: orders(12, bestTravel(result.first, result.second)) } : result]
  }))
  return {
    status: 'ok',
    openMoveAndShoot: a,
    openMoveMove: a + b,
    openBestTravel: bestTravel(a, b),
    open12Orders: orders(12, bestTravel(a, b)),
    horizontalJumpAndShoot: shortJump,
    horizontalLongJump: longJump,
    climbLongSkill: climb,
    climbAndShoot: climbingPlus ? climb : null,
    upwardJumpAndShoot: motorcycle ? null : shortJump,
    // All paths are already measured, clear and have legal landings for this base.
    // These are specified action tests, not automatic geometry/pathfinding.
    gap11AndShoot: shortJump !== null && shortJump >= 11,
    gap11OneOrder: longJump >= 11 || (shortJump !== null && shortJump >= 11),
    ascent9AndShoot: (!motorcycle && shortJump !== null && shortJump >= 9) || (climbingPlus && climb !== null && climb >= 9),
    bentAirPath10AndShoot: jet && !motorcycle && shortJump >= 10,
    normalDodge: normalDodge(profile),
    difficultTerrain: terrain,
  }
}
