// Provisional, separate from combat ratings. Not a terrain/pathfinding simulation.
export const MOBILITY_VERSION = 'mobility-provisional-v1'

export function scoreMobility({ mov, skills = [] } = {}) {
  if (!Array.isArray(mov) || mov.length !== 2 || mov.some(x => typeof x !== 'number' || !Number.isFinite(x) || x < 0)) {
    return { version: MOBILITY_VERSION, status: 'missing-movement', score: null }
  }
  const [first, second] = mov
  const has = pattern => skills.some(s => pattern.test(s))
  const superJump = has(/^Super-Jump(?:\(|$)/i)
  const jetPropulsion = has(/^Super-Jump\(Jet Propulsion\)$/i)
  const climbingPlus = has(/^Climbing Plus(?:\(|$)/i)
  const distances = skills.flatMap(s => {
    const match = s.match(/^(?:Super-Jump|Jump)\(\+(\d+(?:\.\d+)?)["″]\)$/i)
    return match ? [Number(match[1])] : []
  })
  const allowance = Math.max(2, ...distances)
  const jumpBonus = superJump ? 2 * first : 0
  const climbBonus = climbingPlus ? 1.5 * first : 0
  const components = {
    movement: 4 * first + second,
    terrainAccess: Math.max(jumpBonus, climbBonus) + 0.5 * Math.min(jumpBonus, climbBonus),
    trajectoryControl: jetPropulsion ? first : 0,
    extraJumpReach: 2 * (allowance - 2),
  }
  return {
    version: MOBILITY_VERSION,
    status: 'provisional',
    score: Object.values(components).reduce((sum, value) => sum + value, 0),
    components,
    capabilities: {
      superJump, jetPropulsion, climbingPlus,
      aerial: has(/^Aerial$/i),
      terrainTotal: has(/^Terrain\(Total\)$/i),
      // Retain separate restrictions for future route tests, not arbitrary penalties.
      motorcycle: has(/^Motorcycle(?:\(|$)/i),
    },
  }
}

// Infinity Army's API uses game centimeters (10 cm = 4 inches).
export function officialMovementInches(move) {
  return Array.isArray(move) && move.length === 2 && move.every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0)
    ? move.map(x => x / 2.5) : null
}

export function buildMobilityProfiles({ metadata, payloads }) {
  const skillNames = new Map((metadata.skills || []).map(x => [x.id, x.name]))
  const equipmentNames = new Map((metadata.equips || []).map(x => [x.id, x.name]))
  const result = []
  for (const payload of payloads) {
    // Some official traits (e.g. Exrah and Commlink) exist only in faction filters.
    const factionSkills = new Map([...skillNames, ...(payload.filters?.skills || []).map(x => [x.id, x.name])])
    const factionEquipment = new Map([...equipmentNames, ...(payload.filters?.equip || []).map(x => [x.id, x.name])])
    const sectorialId = payload.sectorialId ?? Number(payload.url?.split('/').pop())
    const extras = new Map((payload.filters?.extras || []).map(x => [x.id, x]))
    const resolve = (references, names) => references.map(ref => {
      const name = names.get(ref.id) || `Unknown ${ref.id}`
      const mods = (ref.extra || []).map(id => {
        const extra = extras.get(id)
        if (!extra) return `Unknown ${id}`
        return extra.type === 'DISTANCE' && Number.isFinite(Number(extra.name))
          ? `+${Number(extra.name) / 2.5}"` : extra.name
      })
      return name + (mods.length ? `(${mods.join(', ')})` : '')
    })
    for (const unit of payload.units || []) {
      const included = includedMobilityOptions(unit)
      for (const group of unit.profileGroups || []) {
        for (const option of group.options || []) {
          if (option.disabled && !included.has(`${group.id}:${option.id}`)) continue
          for (const profile of group.profiles || []) {
            const layers = [unit, group, profile, option]
            const skills = [...new Set(resolve(layers.flatMap(x => x.skills || []), factionSkills))]
            const equipment = [...new Set(resolve(layers.flatMap(x => x.equip || x.equipment || []), factionEquipment))]
            const mov = officialMovementInches(profile.move)
            const noMovement = Array.isArray(profile.move) && profile.move.length === 2 && profile.move.every(x => x === -1)
            const mobility = noMovement
              ? { version: MOBILITY_VERSION, status: 'no-movement-attribute', score: null }
              : scoreMobility({ mov, skills: [...skills, ...equipment] })
            result.push({
              id: `${sectorialId}:${unit.id}:${group.id}:${option.id}:${profile.id}`,
              sectorialId, unitId: unit.id, groupId: group.id, optionId: option.id, profileId: profile.id,
              name: [unit.name, option.name, group.profiles.length > 1 ? profile.name : null].filter(Boolean).join(' — '),
              mov, officialMove: profile.move ?? null, silhouette: profile.s ?? null,
              ph: Number.isFinite(profile.ph) && profile.ph > 0 ? profile.ph : null,
              skills, equipment,
              mobility,
            })
          }
        }
      }
    }
  }
  return result
}

// Disabled options can be compulsory companions or operators, not standalone
// purchases. Traverse includes from selectable options, including nested links.
export function includedMobilityOptions(unit) {
  const options = new Map((unit.profileGroups || []).flatMap(group =>
    (group.options || []).map(option => [`${group.id}:${option.id}`, option])))
  const reachable = new Set()
  const visit = key => {
    if (reachable.has(key)) return
    const option = options.get(key)
    if (!option) throw Error(`Missing included option: ${unit.id}:${key}`)
    reachable.add(key)
    for (const ref of option.includes || []) visit(`${ref.group}:${ref.option}`)
  }
  for (const [key, option] of options) if (!option.disabled) visit(key)
  return reachable
}
