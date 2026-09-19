import { createHash } from 'node:crypto'
import { evaluateCloseCombatProfile } from './close-combat-benchmark.mjs'

export const CLOSE_COMBAT_CATALOG_SCHEMA = 'infinity-close-combat-benchmark-v1'

export function buildCloseCombatCatalog({ profiles, defenders, officialDataVersion, benchmarkVersion, generatedAt = new Date().toISOString() }) {
  const sourceAliasCount = profiles.reduce((sum, profile) => sum + profile.aliases.length, 0)
  const evaluated = profiles.map((profile) => compactResult(profile, evaluateCloseCombatProfile(profile, defenders)))
  const unique = dedupeCanonical(evaluated)
  const ratings = unique.map((entry) => entry.rating).sort((a, b) => a - b)
  for (const entry of unique) {
    entry.percentile = percentile(entry.rating, ratings)
    entry.grade = grade(entry.percentile)
  }
  applyStateRelativeRatings(unique)
  unique.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))
  const fingerprint = createHash('sha256').update(JSON.stringify({ officialDataVersion, benchmarkVersion, defenders: defenders.map(compactDefender), entries: unique })).digest('hex')
  return {
    schemaVersion: CLOSE_COMBAT_CATALOG_SCHEMA,
    officialDataVersion,
    benchmarkVersion,
    generatedAt,
    fingerprint,
    methodology: {
      primaryRating: 'Normal active-turn CC Face-to-Face performance across the full defender suite.',
      conditionalStates: ['Surprise Attack', 'Berserk', 'one allied Trooper engaged', 'two allied Troopers engaged'],
      weaponPower: 'Exact fixed PS from the weapon/profile record; never inferred from PH.',
      protheion: 'Post-resolution Power-Up only, capped by wounds that can affect the target before Dead.',
      validation: 'Exact d20 enumeration with supported reference cases cross-checked against Infinity the Calculator.',
    },
    defenders: defenders.map(compactDefender),
    entryCount: unique.length,
    sourceAliasCount,
    entries: unique,
  }
}

export function lookupCloseCombatRatings(catalog, decodedArmy) {
  if (catalog?.schemaVersion !== CLOSE_COMBAT_CATALOG_SCHEMA) throw new Error('Unsupported close-combat benchmark catalog.')
  const byKey = new Map()
  for (const entry of catalog.entries || []) {
    byKey.set(String(entry.key), entry)
    for (const alias of entry.aliases || []) byKey.set(`${Number(alias.sectorialId)}:${entry.key}`, entry)
  }
  const members = decodedArmy.combatGroups.flatMap((group) => group.members || group.entries || [])
  return members.map((member, memberIndex) => {
    const key = closeCombatKey(member)
    const match = byKey.get(`${Number(decodedArmy.sectorialId)}:${key}`) || byKey.get(key)
    return { status: match ? 'matched' : 'missing', key, result: match || null, memberIndex }
  })
}

export function rankArmyCloseCombat(catalog, decodedArmy, { limit = 4 } = {}) {
  const members = decodedArmy.combatGroups.flatMap((group) => group.members || group.entries || [])
  return lookupCloseCombatRatings(catalog, decodedArmy).map((lookup) => {
    const member = members[lookup.memberIndex]
    const entry = lookup.result
    return {
      status: lookup.status,
      key: lookup.key,
      unitName: member?.unitName || member?.unit || entry?.name || null,
      profileName: member?.profileName || member?.profile || null,
      rating: entry?.rating ?? null,
      grade: entry?.grade ?? null,
      percentile: entry?.percentile ?? null,
      states: entry?.states || [],
      weapons: entry?.weapons || [],
      result: entry,
    }
  }).filter((entry) => entry.status === 'matched' && Number.isFinite(entry.rating))
    .sort((a, b) => b.rating - a.rating || String(a.unitName).localeCompare(String(b.unitName)))
    .slice(0, Math.max(0, Number(limit) || 0))
}

function closeCombatKey(member) {
  const parts = String(member?.combinedId || '').split('-').map(Number)
  if (parts.length >= 5 && parts.slice(-4).every(Number.isInteger)) return parts.slice(-4).join(':')
  const values = [member?.unitId, member?.groupId, member?.optionId, member?.profileId ?? 1].map(Number)
  return values.every(Number.isInteger) ? values.join(':') : ''
}

function compactResult(profile, result) {
  return {
    key: profile.id,
    name: profile.name,
    points: profile.points,
    cc: profile.cc,
    skills: profile.skills,
    weapons: profile.weapons.map((weapon) => ({ name: weapon.name, power: weapon.power, ammo: weapon.ammo, save: weapon.save, savingRolls: weapon.savingRolls, attackMod: weapon.attackMod, opponentMod: weapon.opponentMod })),
    aliases: profile.aliases.map((alias) => ({ ...alias })),
    rating: result.rating,
    states: result.states.map((state) => ({
      id: state.id,
      label: state.label,
      rating: state.rating,
      protheionPowerUp: state.protheionPowerUp,
      weaponsUsed: summarizeWeapons(state.matchups),
    })),
  }
}

function summarizeWeapons(matchups) {
  const values = new Map()
  for (const matchup of matchups) {
    const selected = matchup.selected
    const current = values.get(selected.weapon) || { weapon: selected.weapon, selections: 0, scoreContribution: 0 }
    current.selections += 1
    current.scoreContribution += selected.response.score
    values.set(selected.weapon, current)
  }
  return [...values.values()].map((value) => ({ ...value, scoreContribution: Math.round(value.scoreContribution * 100) / 100 })).sort((a, b) => b.selections - a.selections || b.scoreContribution - a.scoreContribution)
}

function dedupeCanonical(entries) {
  const result = new Map()
  for (const entry of entries) {
    const identity = JSON.stringify([rankingName(entry.name), entry.rating])
    if (!result.has(identity)) result.set(identity, entry)
    else {
      const kept = result.get(identity)
      kept.aliases.push(...entry.aliases)
      kept.skills = [...new Set([...kept.skills, ...entry.skills])].sort()
      kept.weapons = [...new Map([...kept.weapons, ...entry.weapons].map((weapon) => [JSON.stringify(weapon), weapon])).values()]
      kept.states = mergeStates(kept.states, entry.states)
      if (entry.points !== kept.points) kept.pointVariants = [...new Set([...(kept.pointVariants || [kept.points]), entry.points])].sort((a, b) => a - b)
    }
  }
  return [...result.values()]
}

function mergeStates(first, second) {
  const states = new Map(first.map((state) => [state.id, state]))
  for (const state of second) {
    const current = states.get(state.id)
    if (!current || state.rating > current.rating) states.set(state.id, state)
    else if (state.rating === current.rating) current.weaponsUsed = [...new Map([...current.weaponsUsed, ...state.weaponsUsed].map((weapon) => [weapon.weapon, weapon])).values()]
  }
  return [...states.values()]
}

function applyStateRelativeRatings(entries) {
  const valuesByState = new Map()
  for (const entry of entries) for (const state of entry.states || []) {
    const values = valuesByState.get(state.id) || []
    values.push(state.rating)
    valuesByState.set(state.id, values)
  }
  for (const values of valuesByState.values()) values.sort((a, b) => a - b)
  for (const entry of entries) for (const state of entry.states || []) {
    state.percentile = percentile(state.rating, valuesByState.get(state.id) || [])
    state.grade = grade(state.percentile)
  }
}

function rankingName(value) { return String(value).toLowerCase().replace(/^reinf(?:orcements?)?[:.]?\s*/i, '').replace(/\s+(?:reinf\.?|fto)\s*$/i, '').replace(/\s+/g, ' ').trim() }

function compactDefender(defender) { return { id: defender.id, name: defender.name, cc: defender.cc, ph: defender.ph, arm: defender.arm, bts: defender.bts, vitality: defender.vitality || null, structure: defender.structure || null, skills: defender.skills, weapons: defender.weapons.map((weapon) => ({ name: weapon.name, power: weapon.power, ammo: weapon.ammo, save: weapon.save, savingRolls: weapon.savingRolls, opponentMod: weapon.opponentMod })) } }
function percentile(value, sorted) { if (sorted.length < 2) return 100; const below = sorted.filter((candidate) => candidate < value).length; const equal = sorted.filter((candidate) => candidate === value).length; return Math.round(10000 * (below + (equal - 1) / 2) / (sorted.length - 1)) / 100 }
function grade(value) { return value >= 95 ? 'S' : value >= 80 ? 'A' : value >= 60 ? 'B' : value >= 40 ? 'C' : value >= 20 ? 'D' : 'F' }
