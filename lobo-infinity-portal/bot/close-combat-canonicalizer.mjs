export function buildCanonicalCloseCombatProfiles({ official }) {
  if (!Array.isArray(official?.payloads) || !official?.metadata) throw new Error('Official Infinity Army payload capture is required.')
  const skills = new Map((official.metadata.skills || []).map((skill) => [Number(skill.id), skill.name]))
  const weapons = groupById(official.metadata.weapons || [])
  const ammunitions = new Map((official.metadata.ammunitions || []).map((ammunition) => [Number(ammunition.id), ammunition.name || ammunition.code]))
  const extras = new Map(official.payloads.flatMap((payload) => payload.filters?.extras || []).map((extra) => [Number(extra.id), extra.name]))
  const canonical = new Map()

  for (const payload of official.payloads) for (const unit of payload.units || []) for (const group of unit.profileGroups || []) for (const option of group.options || []) {
    const physicalProfiles = group.profiles?.length ? group.profiles : [{}]
    for (const profile of physicalProfiles) {
      const id = [unit.canonical || unit.id, group.id, option.id, profile.id ?? 1].map(Number).join(':')
      const references = [...(unit.weapons || []), ...(group.weapons || []), ...(profile.weapons || []), ...(option.weapons || [])]
      const ccWeapons = resolveCloseCombatWeapons(references, weapons, extras, ammunitions)
      if (!ccWeapons.length) continue
      const skillNames = resolveTraits([...(unit.skills || []), ...(group.skills || []), ...(profile.skills || []), ...(option.skills || [])], skills, extras)
      applyCcAttackEnhancements(ccWeapons, skillNames)
      const entry = {
        id,
        unitId: Number(unit.canonical || unit.id),
        groupId: Number(group.id),
        optionId: Number(option.id),
        profileId: Number(profile.id ?? 1),
        name: [unit.name || unit.isc, option.name || profile.name].filter(Boolean).join(' — '),
        points: numberOrNull(option.points),
        cc: stat(profile, unit, 'cc'),
        ph: stat(profile, unit, 'ph'),
        arm: stat(profile, unit, 'arm'),
        bts: stat(profile, unit, 'bts'),
        vitality: booleanWounds(profile, unit, 'w', 'vitality'),
        structure: booleanWounds(profile, unit, 'str', 'structure'),
        skills: skillNames,
        weapons: ccWeapons,
        aliases: [{ sectorialId: endpointId(payload.url), name: unit.name || unit.isc }],
      }
      const existing = canonical.get(id)
      if (!existing) canonical.set(id, entry)
      else if (sameCombatLoadout(existing, entry)) existing.aliases.push(...entry.aliases)
      else canonical.set(`${id}:${fingerprint(entry)}`, entry)
    }
  }
  return [...canonical.values()].filter((profile) => Number.isFinite(profile.cc))
}

function resolveCloseCombatWeapons(references, catalog, extras, ammunitions) {
  const resolved = []
  for (const reference of references) {
    const modifiers = (reference.extra || reference.extras || []).map((id) => extras.get(Number(id))).filter(Boolean)
    const candidates = catalog.get(Number(reference.id)) || []
    for (const record of candidates) {
      if (!isCloseCombatRecord(record)) continue
      const powerOverride = modifiers.map((modifier) => String(modifier).match(/PS\s*=\s*(\d+)/i)).find(Boolean)
      const basePower = Number(record.damage)
      const power = powerOverride ? Number(powerOverride[1]) : basePower
      if (!Number.isFinite(power)) continue
      const saving = String(record.saving || 'ARM').toUpperCase()
      const save = saving.startsWith('BTS') ? 'BTS' : saving.startsWith('PH') ? 'PH' : 'ARM'
      const saveFixed = saving.match(/(?:ARM|BTS)\s*=\s*(\d+)/i)?.[1]
      const saveModifier = saving.match(/PH\s*([+-]\s*\d+)/i)?.[1]?.replace(/\s/g, '')
      const opponentMod = modifiers.map((modifier) => String(modifier).match(/^-(3|6|9)$/)?.[1]).filter(Boolean).map(Number)
      const properties = (record.properties || []).map(String)
      const ammo = ammunitionName(record, ammunitions)
      resolved.push({
        name: [record.name, record.mode].filter(Boolean).join(' — '),
        power,
        burst: Math.max(1, Number(record.burst || 1)),
        ammo,
        save,
        saveFixed: saveFixed == null ? null : Number(saveFixed),
        saveModifier: saveModifier == null ? 0 : Number(saveModifier),
        savingRolls: Math.max(1, Number(record.savingNum || 1)),
        opponentMod: opponentMod.length ? -Math.max(...opponentMod) : 0,
        attackMod: properties.some((property) => /improvised/i.test(property)) ? -6 : 0,
        ap: /(?:^|\+)AP(?:$|\+)/i.test(ammo) || /\/2/.test(saving),
        shock: /shock/i.test(ammo) || properties.some((property) => /shock/i.test(property)),
        nonLethal: properties.some((property) => /non-lethal/i.test(property)) || /PARA/i.test(ammo),
        deadState: properties.some((property) => /state:\s*dead/i.test(property)),
        states: properties.filter((property) => /state:/i.test(property)).map((property) => property.replace(/^.*state:\s*/i, '')),
        woundsPerFailure: /T2/i.test(ammo) ? 2 : 1,
        modifiers,
      })
    }
  }
  return dedupe(resolved)
}

function applyCcAttackEnhancements(weapons, skills) {
  const text = skills.filter((skill) => /cc attack/i.test(skill)).join(' ')
  for (const weapon of weapons) {
    if (/cc attack\s+ap/i.test(text)) { weapon.ap = true; if (!/(?:^|\+)AP(?:$|\+)/i.test(weapon.ammo)) weapon.ammo = `AP+${weapon.ammo}` }
    if (/cc attack\s+shock/i.test(text)) { weapon.shock = true; if (!/shock/i.test(weapon.ammo)) weapon.ammo = `${weapon.ammo}+Shock` }
    if (/cc attack\s+contin(?:u|o)ous damage/i.test(text)) weapon.continuousDamage = true
    if (/cc attack\s+\+1\s*dam/i.test(text)) weapon.power = Math.max(0, weapon.power - 1)
  }
}

function ammunitionName(record, ammunitions) {
  if (typeof record.ammunition === 'string') return record.ammunition
  return String(record.ammo || ammunitions.get(Number(record.ammunition)) || record.ammunition || 'N')
}

function isCloseCombatRecord(record) {
  return (record.properties || []).some((property) => /^CC$/i.test(String(property))) || /CC Mode/i.test(String(record.mode || ''))
}

function resolveTraits(references, catalog, extras) {
  return references.map((reference) => {
    if (typeof reference === 'string') return reference
    const name = catalog.get(Number(reference.id)) || reference.name
    const modifiers = (reference.extra || reference.extras || []).map((id) => extras.get(Number(id))).filter(Boolean)
    return [name, ...modifiers].filter(Boolean).join(' ')
  }).filter(Boolean)
}

function booleanWounds(profile, unit, first, second) {
  const value = profile?.[first] ?? profile?.[second] ?? unit?.[first] ?? unit?.[second]
  if (value === true) return Number(profile?.wounds || unit?.wounds || 1)
  return numberOrNull(value)
}

function sameCombatLoadout(a, b) { return fingerprint(a) === fingerprint(b) }
function fingerprint(profile) { return JSON.stringify([profile.cc, profile.ph, profile.arm, profile.bts, profile.vitality, profile.structure, profile.skills.slice().sort(), profile.weapons]) }
function dedupe(values) { return [...new Map(values.map((value) => [JSON.stringify(value), value])).values()] }
function groupById(values) { const result = new Map(); for (const value of values) result.set(Number(value.id), [...(result.get(Number(value.id)) || []), value]); return result }
function endpointId(url) { return Number(String(url || '').match(/\/(\d+)$/)?.[1] || 0) }
function stat(profile, unit, key) { return numberOrNull(profile?.[key] ?? unit?.[key]) }
function numberOrNull(value) { const number = Number(value); return value == null || value === '' || !Number.isFinite(number) ? null : number }
