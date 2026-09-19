export function buildFireteamBonusEligibility(payloads = []) {
  const fireteamUnitIds = new Set()
  const wildcardUnitIds = new Set()
  const fireteamProfiles = []

  for (const payload of payloads) {
    const unitBySlug = new Map((payload.units || []).map((unit) => [unit.slug, Number(unit.id)]))
    const teams = payload.fireteamChart?.teams || []
    const regularTeams = teams.filter((team) => Array.isArray(team.type) && team.type.length)
    const wildcardTeams = teams.filter((team) => !Array.isArray(team.type) || !team.type.length)

    for (const team of regularTeams) {
      for (const [index, member] of (team.units || []).entries()) {
        const unitId = memberUnitId(member, unitBySlug)
        if (!Number.isInteger(unitId)) continue
        const level2Capable = memberCanReceiveLevel2(team, index)
        if (level2Capable) fireteamUnitIds.add(unitId)
        fireteamProfiles.push(profileRecord(member, unitId, false, level2Capable, team.name))
      }
    }

    for (const wildcardTeam of wildcardTeams) {
      const compatibleTeams = regularTeams.filter((team) => wildcardScopeMatches(wildcardTeam.name, team.name))
      for (const member of wildcardTeam.units || []) {
        const unitId = memberUnitId(member, unitBySlug)
        if (!Number.isInteger(unitId)) continue
        const level2Capable = compatibleTeams.some((team) => externalMemberCanReceiveLevel2(team, member))
        if (level2Capable) wildcardUnitIds.add(unitId)
        fireteamProfiles.push(profileRecord(member, unitId, true, level2Capable, wildcardTeam.name))
      }
    }
  }

  return {
    fireteamUnitIds: [...fireteamUnitIds],
    wildcardUnitIds: [...wildcardUnitIds],
    fireteamProfiles,
  }
}

export function memberCanReceiveLevel2(team, targetIndex) {
  const members = team.units || []
  const target = members[targetIndex]
  if (!target) return false
  return canFormLevel2WithTarget(members, target, fireteamCapacity(team))
}

function externalMemberCanReceiveLevel2(team, target) {
  return canFormLevel2WithTarget([target, ...(team.units || [])], target, fireteamCapacity(team))
}

function canFormLevel2WithTarget(members, target, capacity) {
  if (capacity < 2) return false
  const targetModel = modelName(target)
  const targetTags = compositionTags(target)
  const groups = new Map()

  for (const member of members) {
    addGroup(groups, `model:${modelName(member)}`, member)
    for (const tag of compositionTags(member)) addGroup(groups, `tag:${tag}`, member)
  }

  for (const [key, group] of groups) {
    if (group.totalMaximum < 2) continue
    const targetCounts = key === `model:${targetModel}` || (key.startsWith('tag:') && targetTags.includes(key.slice(4)))
    if ((targetCounts ? 2 : 3) <= capacity) return true
  }
  return false
}

function addGroup(groups, key, member) {
  if (!key || key.endsWith(':')) return
  const current = groups.get(key) || { totalMaximum: 0 }
  current.totalMaximum += Math.max(0, Number(member.max || 0))
  groups.set(key, current)
}

function fireteamCapacity(team) {
  const sizes = { DUO: 2, HARIS: 3, CORE: 5 }
  return Math.max(0, ...(team.type || []).map((type) => sizes[String(type).toUpperCase()] || 0))
}

function compositionTags(member) {
  const matches = String(member.comment || '').matchAll(/\(([^)]+)\)/g)
  return [...matches].map((match) => normalize(match[1])).filter(Boolean)
}

function modelName(member) {
  return normalize(member.name)
}

function wildcardScopeMatches(wildcardName, teamName) {
  const scope = normalize(wildcardName).replace(/\bwildcards?\b/g, '').trim()
  return !scope || normalize(teamName).includes(scope)
}

function memberUnitId(member, unitBySlug) {
  const value = Number(member.unitId || unitBySlug.get(member.slug))
  return Number.isInteger(value) ? value : null
}

function profileRecord(member, unitId, wildcard, level2Capable, teamName) {
  return {
    unitId,
    memberName: [member.name, member.comment].filter(Boolean).join(' '),
    wildcard,
    level2Capable,
    teamName,
  }
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
