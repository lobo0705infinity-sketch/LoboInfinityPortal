import { weaponChartRecordToGunfighterWeapon } from './infinity-weapon-chart.mjs'
import { includedMobilityOptions } from './mobility-rating.mjs'

export function buildCanonicalGunfighterProfiles({ dataset, weaponChart, sectorialId, fireteamUnitIds = [], wildcardUnitIds = [], fireteamProfiles = [], ttsProfiles = [] } = {}) {
  if (!Array.isArray(dataset?.units)) throw new Error('Canonical Army dataset has no units.')
  if (!Array.isArray(weaponChart)) throw new Error('Official weapon chart is required.')
  const weaponRecords = indexWeaponChart(weaponChart)
  const armyWeapons = indexArmyWeapons(dataset.metadata?.weapons)
  const skills = indexById(dataset.metadata?.skills)
  const equips = indexById(dataset.metadata?.equips)
  const extras = indexById(dataset.metadata?.extras)
  const eligible = new Set([...fireteamUnitIds, ...wildcardUnitIds].map(Number))
  const profiles = []
  for (const unit of dataset.units) for (const group of unit.profileGroups || []) for (const option of group.options || []) {
    if (option.disabled && !includedMobilityOptions(unit).has(`${group.id}:${option.id}`)) continue
    const physicalProfiles = group.profiles?.length ? group.profiles : [{}]
    for (const profile of physicalProfiles) {
      const id = `${sectorialId}:${unit.id}:${group.id}:${option.id}:${profile.id ?? 1}`
      // Unit/group weapon arrays describe alternatives, not this loadout.
      // Older TTS data must never override or add to an official selection.
      const references = [...(profile.weapons || []), ...(option.weapons || [])]
      const weapons = resolveWeapons(references, weaponRecords, extras, armyWeapons)
      const skillNames = resolveTraits([...(unit.skills || []), ...(group.skills || []), ...(profile.skills || []), ...(option.skills || [])], skills, extras)
      const structure = (profile.str ?? unit.str) === true
      const wounds = stat(profile, unit, 'w') ?? stat(profile, unit, 'vitality') ?? 1
      profiles.push({
        id,
        sectorialId: Number(sectorialId),
        unitId: Number(unit.id),
        groupId: Number(group.id),
        optionId: Number(option.id),
        profileId: Number(profile.id ?? 1),
        name: [unit.name, option.name || profile.name].filter(Boolean).join(' — '),
        bs: stat(profile, unit, 'bs'),
        cc: stat(profile, unit, 'cc'),
        wip: stat(profile, unit, 'wip'),
        ph: stat(profile, unit, 'ph'),
        arm: stat(profile, unit, 'arm'),
        bts: stat(profile, unit, 'bts'),
        vitality: structure ? null : wounds,
        structure: structure ? wounds : (typeof profile.str === 'number' ? profile.str : stat(profile, unit, 'structure')),
        troopType: dataset.metadata?.types?.find(t => Number(t.id) === Number(profile.type))?.name || null,
        skills: [...new Set(skillNames)].sort(),
        equipment: [...new Set(resolveTraits([...(unit.equipment || unit.equip || []), ...(group.equipment || group.equip || []), ...(profile.equipment || profile.equip || []), ...(option.equipment || option.equip || [])], equips, extras))].sort(),
        weapons,
        fireteamCapable: !skillNames.some(s => /^Peripheral(?:\s|\(|$)/i.test(s)) && exactFireteamEligibility({ unit, group, option, profile, eligible, fireteamProfiles }),
      })
    }
  }
  return profiles
}

function resolveTtsWeapons(references = [], chart) {
  const resolved = []
  for (const reference of references) {
    const candidates = chart.byName.get(normalize(reference.name)) || []
    for (const record of candidates) {
      const weapon = weaponChartRecordToGunfighterWeapon(record)
      applyWeaponModifiers(weapon.modes[0], reference.modifiers || [])
      weapon.modes = weapon.modes.filter(isBenchmarkAttackMode)
      if (weapon.modes.length) resolved.push(weapon)
    }
  }
  return resolved
}

export function gunfighterWeaponsFromTtsProfile(profile, weaponChart = []) {
  return mergeWeapons(resolveTtsWeapons(profile?.weapons || [], indexWeaponChart(weaponChart)))
}

function exactFireteamEligibility({ unit, group, option, profile, eligible, fireteamProfiles }) {
  const allRecords = fireteamProfiles.filter((entry) => Number(entry.unitId) === Number(unit.id))
  if (!allRecords.length) return eligible.has(Number(unit.id))
  const records = allRecords.filter(entry => entry.level2Capable !== false)
  const selectedNames = [group.isc, option.name, profile.name].map(normalize).filter(Boolean)
  return records.some((entry) => {
    const chartName = normalize(entry.memberName)
    if (/(?:^|\s)fto(?:\s|$)/.test(chartName)) return selectedNames.some((name) => /(?:^|\s)fto(?:\s|$)/.test(name))
    return true
  })
}

function resolveWeapons(references, chart, extras, armyWeapons) {
  const resolved = []
  for (const reference of references) {
    const officialNames = (armyWeapons.get(Number(reference.id)) || []).map((record) => normalize(record.name)).filter(Boolean)
    const namedCandidates = officialNames.flatMap((name) => chart.byName.get(name) || [])
    const unresolvedCandidates = namedCandidates.length ? namedCandidates : chart.byId.get(Number(reference.id)) || chart.byName.get(normalize(reference.name)) || []
    const candidates = [...new Map(unresolvedCandidates.map((candidate) => [
      [candidate.id, candidate.name, candidate.mode, candidate.damage, candidate.burst, candidate.ammo, candidate.saving, candidate.savingRolls].join(':'),
      candidate,
    ])).values()]
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

function indexArmyWeapons(records = []) {
  const byId = new Map()
  for (const record of records) append(byId, Number(record.id), record)
  return byId
}

function isBenchmarkAttackMode(mode) {
  return Array.isArray(mode?.ranges) && mode.ranges.length > 0
    && ['burst', 'power', 'ammo', 'attackType'].every((field) => mode[field] != null)
    && (mode.smoke || mode.eclipse || mode.save != null)
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
    for (const mode of weapon.modes) {
      const signature = JSON.stringify(mode)
      if (!merged.get(key).modes.some((candidate) => JSON.stringify(candidate) === signature)) merged.get(key).modes.push(mode)
    }
  }
  return [...merged.values()]
}

function indexById(values = []) { return new Map(values.map((value) => [Number(value.id), value])) }
function append(map, key, value) { if (key == null || key === '' || Number.isNaN(key)) return; map.set(key, [...(map.get(key) || []), value]) }
function stat(profile, unit, key) { const value = profile?.[key] ?? unit?.[key]; return value == null || value === '' ? null : Number(value) }
function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
