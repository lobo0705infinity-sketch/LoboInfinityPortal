import { weaponChartRecordToGunfighterWeapon } from './infinity-weapon-chart.mjs'

export function buildCanonicalGunfighterProfiles({ dataset, weaponChart, sectorialId, fireteamUnitIds = [], wildcardUnitIds = [], fireteamProfiles = [] } = {}) {
  if (!Array.isArray(dataset?.units)) throw new Error('Canonical Army dataset has no units.')
  if (!Array.isArray(weaponChart)) throw new Error('Official weapon chart is required.')
  const weaponRecords = indexWeaponChart(weaponChart)
  const skills = indexById(dataset.metadata?.skills)
  const equips = indexById(dataset.metadata?.equips)
  const extras = indexById(dataset.metadata?.extras)
  const eligible = new Set([...fireteamUnitIds, ...wildcardUnitIds].map(Number))
  const profiles = []
  for (const unit of dataset.units) for (const group of unit.profileGroups || []) for (const option of group.options || []) {
    const physicalProfiles = group.profiles?.length ? group.profiles : [{}]
    for (const profile of physicalProfiles) {
      const references = [...(unit.weapons || []), ...(group.weapons || []), ...(profile.weapons || []), ...(option.weapons || [])]
      const weapons = resolveWeapons(references, weaponRecords, extras)
      if (!weapons.length) continue
      profiles.push({
        id: `${sectorialId}:${unit.id}:${group.id}:${option.id}:${profile.id ?? 1}`,
        sectorialId: Number(sectorialId),
        unitId: Number(unit.id),
        groupId: Number(group.id),
        optionId: Number(option.id),
        profileId: Number(profile.id ?? 1),
        name: [unit.name, option.name || profile.name].filter(Boolean).join(' — '),
        bs: stat(profile, unit, 'bs'),
        wip: stat(profile, unit, 'wip'),
        ph: stat(profile, unit, 'ph'),
        arm: stat(profile, unit, 'arm'),
        bts: stat(profile, unit, 'bts'),
        vitality: stat(profile, unit, 'w') ?? stat(profile, unit, 'vitality'),
        structure: stat(profile, unit, 'str') ?? stat(profile, unit, 'structure'),
        skills: resolveTraits([...(unit.skills || []), ...(group.skills || []), ...(profile.skills || []), ...(option.skills || [])], skills, extras),
        equipment: resolveTraits([...(unit.equipment || unit.equip || []), ...(group.equipment || group.equip || []), ...(profile.equipment || profile.equip || []), ...(option.equipment || option.equip || [])], equips, extras),
        weapons,
        fireteamCapable: exactFireteamEligibility({ unit, group, option, profile, eligible, fireteamProfiles }),
      })
    }
  }
  return profiles
}

function exactFireteamEligibility({ unit, group, option, profile, eligible, fireteamProfiles }) {
  const records = fireteamProfiles.filter((entry) => Number(entry.unitId) === Number(unit.id))
  if (!records.length) return eligible.has(Number(unit.id))
  const selectedNames = [unit.name, unit.isc, group.isc, option.name, profile.name].map(normalize).filter(Boolean)
  return records.some((entry) => {
    const chartName = normalize(entry.memberName)
    if (/(?:^|\s)fto(?:\s|$)/.test(chartName)) return selectedNames.some((name) => /(?:^|\s)fto(?:\s|$)/.test(name))
    return true
  })
}

function resolveWeapons(references, chart, extras) {
  const resolved = []
  for (const reference of references) {
    const candidates = chart.byId.get(Number(reference.id)) || chart.byName.get(normalize(reference.name)) || []
    const requestedMode = normalize(reference.mode || reference.variant)
    const selected = requestedMode ? candidates.filter((candidate) => normalize(candidate.mode).includes(requestedMode)) : candidates
    const modifierNames = (reference.extra || reference.extras || []).map((id) => extras.get(Number(id))?.name).filter(Boolean)
    for (const record of selected.length ? selected : candidates) {
      const weapon = weaponChartRecordToGunfighterWeapon(record)
      applyWeaponModifiers(weapon.modes[0], modifierNames)
      weapon.modes = weapon.modes.filter(isBenchmarkAttackMode)
      if (weapon.modes.length) resolved.push(weapon)
    }
  }
  return mergeWeapons(resolved)
}

function isBenchmarkAttackMode(mode) {
  return Array.isArray(mode?.ranges) && mode.ranges.length > 0
    && ['burst', 'power', 'ammo', 'save', 'attackType'].every((field) => mode[field] != null)
}

function applyWeaponModifiers(mode, modifiers) {
  for (const modifier of modifiers) {
    const value = String(modifier)
    const burst = value.match(/\+\s*(\d+)\s*B/i)
    const specialDice = value.match(/\+\s*(\d+)\s*SD/i)
    const power = value.match(/PS\s*=\s*(\d+)/i)
    if (burst) mode.burstBonus = Number(burst[1])
    if (specialDice) mode.specialDice = Number(specialDice[1])
    if (power) mode.power = Number(power[1])
  }
}

function resolveTraits(references, catalog, extras) {
  return references.map((reference) => {
    if (typeof reference === 'string') return reference
    const name = catalog.get(Number(reference.id))?.name || reference.name
    const modifiers = (reference.extra || reference.extras || []).map((id) => extras.get(Number(id))?.name).filter(Boolean)
    return [name, ...modifiers].filter(Boolean).join(' ')
  }).filter(Boolean)
}

function indexWeaponChart(records) {
  const byId = new Map()
  const byName = new Map()
  for (const record of records) {
    append(byId, Number(record.id), record)
    append(byName, normalize(record.name), record)
  }
  return { byId, byName }
}

function mergeWeapons(weapons) {
  const merged = new Map()
  for (const weapon of weapons) {
    const key = `${weapon.id ?? ''}:${normalize(weapon.name)}`
    if (!merged.has(key)) merged.set(key, { ...weapon, modes: [] })
    merged.get(key).modes.push(...weapon.modes)
  }
  return [...merged.values()]
}

function indexById(values = []) { return new Map(values.map((value) => [Number(value.id), value])) }
function append(map, key, value) { if (key == null || key === '' || Number.isNaN(key)) return; map.set(key, [...(map.get(key) || []), value]) }
function stat(profile, unit, key) { const value = profile?.[key] ?? unit?.[key]; return value == null || value === '' ? null : Number(value) }
function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
