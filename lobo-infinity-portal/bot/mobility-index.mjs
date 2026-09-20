import { evaluateMobilityScenarios, terrainMovement } from './mobility-scenarios.mjs'

export const MOBILITY_INDEX_VERSION = 'mobility-index-v1'
export const MOBILITY_WEIGHTS = Object.freeze({ attackReach: 25, travel: 15, verticalAttack: 12, verticalTravel: 8, gapAttack: 12, gapTravel: 3, turningJump: 10, terrain: 10, dodge: 5 })
const fraction = (value, reference) => Math.max(0, Math.min(1, (value ?? 0) / reference))

// A transparent weighted scenario index, not a win probability or percentile.
export function mobilityIndex(profile, weights = MOBILITY_WEIGHTS) {
  const s = evaluateMobilityScenarios(profile)
  if (s.status !== 'ok') return { version: MOBILITY_INDEX_VERSION, status: 'no-movement', score: null }
  const traits = [...profile.skills, ...profile.equipment]
  const aerial = traits.includes('Aerial')
  const mounted = traits.some(x => /^(?:AI )?Motorcycle(?:\(|$)/.test(x))
  const terrainTypes = Object.keys(s.difficultTerrain)
  let terrainResults = Object.values(s.difficultTerrain)
  if (terrainResults.some(x => x.status === 'terrain-type-unspecified')) return { version: MOBILITY_INDEX_VERSION, status: 'terrain-unresolved', score: null }
  if (terrainResults.some(x => x.status === 'terrain-choice-required')) {
    // Equal frequencies of the five terrain types. One choice is fixed for the
    // entire suite; never choose a different specialty for every scenario.
    const choices = traits.flatMap(x => x.match(/^Terrain\(([^)]+\/[^)]+)\)$/)?.[1].split('/') || [])
    const choice = choices.slice().sort()[0]
    terrainResults = terrainTypes.map(type => {
      const r = terrainMovement(profile, type, choice)
      return { ...r, moveMove: r.first + r.second }
    })
  }
  if (s.normalDodge.status !== 'ok') return { version: MOBILITY_INDEX_VERSION, status: 'dodge-unresolved', score: null }
  const terrainMove = terrainResults.reduce((sum, r) => sum + r.moveMove, 0) / terrainTypes.length
  const components = {
    attackReach: fraction(Math.max(s.openMoveAndShoot, s.horizontalJumpAndShoot ?? 0), 11),
    travel: fraction(s.openBestTravel, 14),
    verticalAttack: fraction(Math.max(s.upwardJumpAndShoot ?? 0, s.climbAndShoot ?? 0), 11),
    verticalTravel: fraction(mounted ? 0 : Math.max(s.horizontalLongJump, aerial ? 0 : s.climbLongSkill ?? 0), 12),
    gapAttack: fraction(s.horizontalJumpAndShoot, 11),
    gapTravel: fraction(s.horizontalLongJump, 12),
    turningJump: s.bentAirPath10AndShoot ? 1 : 0,
    terrain: fraction(terrainMove, 15),
    dodge: fraction(s.normalDodge.expectedDistance, 5),
  }
  const total = Object.values(weights).reduce((sum, x) => sum + x, 0)
  if (!(total > 0) || Object.keys(MOBILITY_WEIGHTS).some(k => !Number.isFinite(weights[k]) || weights[k] < 0)) throw Error('Invalid mobility weights')
  const score = Object.entries(components).reduce((sum, [key, value]) => sum + value * weights[key], 0) * 100 / total
  return { version: MOBILITY_INDEX_VERSION, status: 'rated', score: Math.round(score * 10) / 10, components, scenarios: s }
}
