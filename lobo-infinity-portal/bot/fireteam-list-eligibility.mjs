const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const tags = comment => [...String(comment || '').matchAll(/\(([^)]+)\)/g)].flatMap(m => m[1].split(',').map(norm)).filter(Boolean)

export function canonicalMemberships(payload) {
  const result = new Map()
  const ids = new Map((payload.units || []).map(u => [u.slug, Number(u.id)]))
  const chart = payload.fireteamChart?.teams || []
  const teams = chart.filter(t => t.type?.length)
  const add = (team, member, index) => {
    const id = Number(member.unitId || ids.get(member.slug))
    if (!Number.isInteger(id)) return
    const sizes = (team.type || []).map(t => ({ DUO: 2, HARIS: 3, CORE: 5 })[t]).filter(Boolean)
    const rows = result.get(id) || []
    rows.push({ team: team.name, minSize: team.type.includes('DUO') ? 2 : 3, maxSize: Math.max(...sizes), required: Boolean(member.required), requiredNames: (team.units || []).filter(m => m.required).map(m => m.name), memberName: [member.name, /(?:^|\s)FTO(?:\s|$)/i.test(member.comment || '') ? 'FTO' : ''].filter(Boolean).join(' '), countsAs: tags(member.comment).join('|'), compositionTags: tags(member.comment), memberKey: `${team.name}:${index}`, max: Number.isFinite(Number(member.max)) ? Number(member.max) : Math.max(...sizes) })
    result.set(id, rows)
  }
  for (const team of teams) for (const [i, member] of (team.units || []).entries()) add(team, member, i)
  for (const wildcard of chart.filter(t => !t.type?.length)) {
    const scope = norm(wildcard.name).replace(/\bwildcards?\b/g, '').trim()
    for (const team of teams.filter(t => !scope || norm(t.name).includes(scope)))
      for (const [i, member] of (wildcard.units || []).entries()) add(team, member, `wild:${wildcard.name}:${i}`)
  }
  return result
}

// Return potential Level 2 teams for EACH profile, requiring a legal subset
// containing that profile. Team membership alone never proves the +1SD bonus.
export function eligibleLevel2Teams(profiles) {
  const byTeam = new Map(), result = new Map()
  for (const [profileIndex, profile] of profiles.entries()) {
    if (!result.has(profile.combinedId)) result.set(profile.combinedId, new Set())
    for (let instance = 0; instance < (profile.quantity ?? 1); instance++) {
      for (const membership of profile.fireteamMemberships || (profile.fireteamTeams || []).map(team => ({ team, minSize: 2, maxSize: 5, memberName: profile.unitName, requiredNames: [] }))) {
        const bucket = `${profile.combatGroup ?? 1}:${membership.team}`
        const rows = byTeam.get(bucket) || []
        rows.push({ ...membership, id: profile.combinedId, instance: `${profileIndex}:${instance}`, unit: norm(profile.unitName), tags: [norm(membership.memberName), ...(membership.compositionTags || String(membership.countsAs || '').split('|').map(norm))].filter(Boolean) })
        byTeam.set(bucket, rows)
      }
    }
  }
  for (const rows of byTeam.values()) {
    const team = rows[0].team
    const capacity = rows[0].maxSize || 5, minimum = rows[0].minSize || 2
    const required = (rows[0].requiredNames || []).map(norm)
    const legal = selected => {
      if (new Set(selected.map(r => r.instance)).size !== selected.length) return false
      const counts = new Map()
      for (const row of selected) {
        const key = row.memberKey || row.memberName
        counts.set(key, (counts.get(key) || 0) + 1)
        if (counts.get(key) > (row.max ?? capacity)) return false
      }
      return !required.length || selected.some(r => r.required || required.includes(norm(r.memberName)) || r.tags.some(tag => required.includes(tag)))
    }
    const pair = selected => selected.some((a, i) => selected.slice(i + 1).some(b => (a.unit && a.unit === b.unit) || a.tags.some(tag => b.tags.includes(tag))))
    // Army lists are small; depth is bounded by Fireteam capacity (at most 5).
    for (const target of rows) {
      if (result.get(target.id).has(team)) continue
      const search = (selected, start) => {
        if (selected.length >= minimum && legal(selected) && pair(selected)) return true
        if (selected.length >= capacity) return false
        for (let i = start; i < rows.length; i++) {
          if (rows[i].instance === target.instance) continue
          const next = [...selected, rows[i]]
          if (new Set(next.map(r => r.instance)).size !== next.length) continue
          if (search(next, i + 1)) return true
        }
        return false
      }
      if (search([target], 0)) result.get(target.id).add(team)
    }
  }
  return result
}
