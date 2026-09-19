#!/usr/bin/env node

import { gzipSync } from 'node:zlib'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildAroBenchmarkCatalog, selectBenchmarkAttackers } from '../bot/aro-benchmark-catalog.mjs'
import { loadGunfighterBenchmarkCatalog } from '../bot/gunfighter-catalog-store.mjs'
import { normalizeWeaponChartRows, weaponChartRecordToGunfighterWeapon } from '../bot/infinity-weapon-chart.mjs'

const args = parseArgs(process.argv.slice(2))
const sourceDir = resolve(args['source-dir'] || 'data/infinity-army')
const output = resolve(args.output || 'data/infinity-army/aro-benchmark-catalog.json.gz.b64')
const tts = JSON.parse(await readFile(resolve(sourceDir, 'tts-profile-catalog.json'), 'utf8'))
const weaponInput = JSON.parse(await readFile(resolve(sourceDir, 'benchmark-weapon-chart-v8.json'), 'utf8'))
const weaponChart = normalizeWeaponChartRows(weaponInput.rows)

const gunfighterCatalog = await loadGunfighterBenchmarkCatalog()
if (!gunfighterCatalog) throw new Error('The completed gunfighter catalog is required to select the top 30 attackers.')
const gunfighterByKey = new Map(gunfighterCatalog.entries.map((entry) => [entry.key, entry]))
const ttsById = new Map(tts.profiles.map((profile) => [profile.id, profile]))
const ttsByUnit = new Map()
for (const profile of tts.profiles) ttsByUnit.set(Number(profile.unitId), [...(ttsByUnit.get(Number(profile.unitId)) || []), profile])
const chartByName = new Map()
for (const row of weaponChart) {
  const key = normalize(row.name)
  chartByName.set(key, [...(chartByName.get(key) || []), row])
}
let unresolvedAliases = 0
const profiles = gunfighterCatalog.entries.flatMap((entry) => {
  const source = resolveTtsProfile(entry, ttsById, ttsByUnit, tts.profiles)
  if (!source) { unresolvedAliases += 1; return [] }
  return [canonicalProfile(entry, source, chartByName)]
})
console.log(`Resolved ${profiles.length}/${gunfighterCatalog.entries.length} official aliases (${unresolvedAliases} unavailable in the TTS source)`)
const attackerProfiles = gunfighterCatalog.entries.flatMap((entry) => {
  const source = resolveTtsProfile(entry, ttsById, ttsByUnit, tts.profiles)
  return source ? [canonicalProfile(entry, source, chartByName)] : []
})
const attackers = selectBenchmarkAttackers(attackerProfiles, gunfighterCatalog, { limit: 30 })
console.log('ARO attacker suite:')
for (const [index, attacker] of attackers.entries()) console.log(`${index + 1}. ${attacker.profile.name} — ${attacker.state} — ${attacker.rating}`)

const catalog = buildAroBenchmarkCatalog({
  profiles,
  attackers,
  officialDataVersion: gunfighterCatalog.officialDataVersion,
  options: { sourceProfiles: 'completed-gunfighter-catalog-plus-tts-combat-data', attackerCount: 30 },
})
catalog.source = {
  ttsFingerprint: tts.fingerprint,
  gunfighterCatalogFingerprint: gunfighterCatalog.fingerprint,
}
await writeFile(output, gzipSync(`${JSON.stringify(catalog)}\n`, { level: 9 }).toString('base64'), 'utf8')
console.log(JSON.stringify({ benchmarkVersion: catalog.benchmarkVersion, entries: catalog.entryCount, fingerprint: catalog.fingerprint, output }))

function canonicalProfile(entry, source, chartByName) {
  const weapons = []
  for (const reference of source.weapons || []) for (const record of chartByName.get(normalize(reference.name)) || []) {
    const weapon = weaponChartRecordToGunfighterWeapon(record)
    applyModifiers(weapon.modes[0], reference.modifiers || [])
    weapon.modes = weapon.modes.filter((mode) => Array.isArray(mode.ranges) && mode.ranges.length && ['burst', 'power', 'ammo', 'save', 'attackType'].every((field) => mode[field] != null))
    if (weapon.modes.length) weapons.push(weapon)
  }
  return {
    ...source,
    id: entry.key,
    sectorialId: entry.sectorialId,
    unitId: entry.unitId,
    groupId: entry.groupId,
    optionId: entry.optionId,
    profileId: entry.profileId,
    name: entry.result.name || source.name,
    weapons: mergeWeapons(weapons),
    fireteamCapable: entry.result.states.some((state) => state.id === 'fireteam'),
  }
}

function resolveTtsProfile(entry, ttsById, ttsByUnit, allProfiles) {
  const exact = ttsById.get(entry.key)
  if (exact) return exact
  const unitId = Number(entry.unitId)
  const candidates = [
    ...(ttsByUnit.get(unitId) || []),
    ...(unitId >= 10_000 ? (ttsByUnit.get(unitId % 10_000) || []) : []),
  ]
  const usedWeapons = (entry.result.states || []).flatMap((state) => state.weaponsUsed || []).map((weapon) => normalize(weapon.weapon))
  const pool = candidates.length ? candidates : allProfiles.filter((profile) => (
    (profile.weapons || []).some((weapon) => usedWeapons.some((used) => used.startsWith(normalize(weapon.name))))
  ))
  if (!pool.length) return null
  const ranked = [...pool].map((profile) => ({ profile, score: profileMatchScore(profile, entry, usedWeapons) })).sort((left, right) => right.score - left.score)
  const minimum = candidates.length ? 0 : 21
  return ranked[0].score >= minimum ? ranked[0].profile : null
}

function profileMatchScore(profile, entry, usedWeapons) {
  let score = 0
  if (Number(profile.groupId) === Number(entry.groupId)) score += 5
  if (Number(profile.optionId) === Number(entry.optionId)) score += 5
  if (Number(profile.profileId || 1) === Number(entry.profileId)) score += 2
  for (const weapon of profile.weapons || []) if (usedWeapons.some((used) => used.startsWith(normalize(weapon.name)))) score += 20
  const profileTokens = new Set(normalize(profile.name).split(' '))
  for (const token of normalize(entry.result.name).split(' ')) if (token.length > 3 && profileTokens.has(token)) score += 1
  return score
}

function applyModifiers(mode, modifiers) {
  for (const modifier of modifiers) {
    const burst = String(modifier).match(/\+\s*(\d+)\s*B/i)
    const specialDice = String(modifier).match(/\+\s*(\d+)\s*SD/i)
    const power = String(modifier).match(/PS\s*=\s*(\d+)/i)
    if (burst) mode.burstBonus = Number(burst[1])
    if (specialDice) mode.specialDice = Number(specialDice[1])
    if (power) mode.power = Number(power[1])
  }
}

function mergeWeapons(weapons) {
  const merged = new Map()
  for (const weapon of weapons) {
    const key = `${weapon.id ?? ''}:${normalize(weapon.name)}`
    if (!merged.has(key)) merged.set(key, { ...weapon, modes: [] })
    for (const mode of weapon.modes) if (!merged.get(key).modes.some((candidate) => JSON.stringify(candidate) === JSON.stringify(mode))) merged.get(key).modes.push(mode)
  }
  return [...merged.values()]
}

function profileKey(profile) { return [profile.unitId, profile.groupId, profile.optionId, profile.profileId ?? 1].map(Number).join(':') }
function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 2) result[values[index].replace(/^--/, '')] = values[index + 1]; return result }
