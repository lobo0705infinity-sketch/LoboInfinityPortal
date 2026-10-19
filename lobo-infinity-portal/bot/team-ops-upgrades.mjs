// Army stores selected Team-Ops attributes as JSON strings, one bundle per member.
export function teamOpsAttributes(modifiers = []) {
  return modifiers.flatMap(value => {
    const attrs = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(attrs)) throw Error('Unsupported Team-Ops upgrade bundle')
    return attrs
  })
}

export function applyTeamOpsToUnit(unit, member, metadata, payload) {
  const attrs = teamOpsAttributes(member.modifiers)
  if (!attrs.length) return unit
  if (!unit?.spectables) throw Error('Selected upgrades require an official Team-Ops profile')
  const result = structuredClone(unit)
  const group = result.profileGroups.find(g => Number(g.id) === Number(member.groupId))
  const profileId = Number(member.profileId ?? String(member.combinedId).split('-').at(-1))
  const profile = group?.profiles.find(p => Number(p.id) === profileId)
  if (!profile) throw Error('Team-Ops upgrade profile could not be resolved exactly')
  const extraIds = new Set([...(metadata.extras || []), ...(payload.filters?.extras || [])].map(x => Number(x.id)))
  const catalogs = {
    skill: [...(metadata.skills || []), ...(payload.filters?.skills || [])],
    equip: [...(metadata.equips || []), ...(payload.filters?.equip || [])],
    weapon: metadata.weapons || [],
  }
  for (const attr of attrs) {
    if (attr.type === 'stat') {
      if (!Number.isFinite(attr.q) || attr.q < 0) throw Error('Invalid Team-Ops stat upgrade')
      if (/^move[01]$/.test(attr.stat)) profile.move[Number(attr.stat.at(-1))] = attr.q
      else if (['bs', 'cc', 'ph', 'wip', 'arm', 'bts', 'w'].includes(attr.stat) && Number.isFinite(profile[attr.stat])) profile[attr.stat] += attr.q
      else throw Error(`Unsupported Team-Ops stat: ${attr.stat}`)
      continue
    }
    const catalog = catalogs[attr.type]
    if (!catalog?.some(x => Number(x.id) === Number(attr.id)) || (attr.extra || []).some(id => !extraIds.has(Number(id)))) throw Error(`Unresolved Team-Ops ${attr.type} upgrade: ${attr.id}`)
    const field = { skill: 'skills', equip: 'equip', weapon: 'weapons' }[attr.type]
    const reference = { id: Number(attr.id), ...(attr.extra ? { extra: attr.extra } : {}) }
    // Keep native traits, including a native Dodge distance, alongside the selected bonus.
    if (!(profile[field] || []).some(x => x.id === reference.id && JSON.stringify(x.extra || []) === JSON.stringify(reference.extra || []))) (profile[field] ||= []).push(reference)
  }
  return result
}

export function teamOpsUpgradeLabels(modifiers, metadata, payload) {
  const extras = new Map([...(metadata.extras || []), ...(payload?.filters?.extras || [])].map(x => [Number(x.id), x]))
  return teamOpsAttributes(modifiers).map(attr => {
    if (attr.type === 'stat') return /^move[01]$/.test(attr.stat) ? `${attr.stat === 'move0' ? 'First' : 'Second'} MOV ${attr.q / 2.5}″` : `${attr.stat.toUpperCase()} +${attr.q}`
    const records = attr.type === 'skill' ? [...(metadata.skills || []), ...(payload?.filters?.skills || [])] : attr.type === 'equip' ? [...(metadata.equips || []), ...(payload?.filters?.equip || [])] : metadata.weapons || []
    const name = records.find(x => Number(x.id) === Number(attr.id))?.name || `${attr.type} ${attr.id}`
    const mods = (attr.extra || []).map(id => {
      const extra = extras.get(Number(id))
      return extra?.type === 'DISTANCE' ? `${Number(String(extra.name).replace('+','')) / 2.5}″` : extra?.name
    }).filter(Boolean)
    return mods.length ? `${name} (${mods.join(', ')})` : name
  })
}
