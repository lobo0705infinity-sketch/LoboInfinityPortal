import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { buildMobilityProfiles } from '../bot/mobility-rating.mjs'
import { canonicalMemberships } from '../bot/fireteam-list-eligibility.mjs'
import { filterCanonicalFireteamMembershipsForProfile } from './army-intelligence-canonical-enrichment.mjs'
import { buildCanonicalDataset, resolveCanonicalWeaponRecords } from './infinity-army-canonical-dataset.mjs'
const capture = JSON.parse(await readFile(process.argv[2], 'utf8'))
const keys = {}, profiles = [], signatures = new Map()
const weapons = [], membershipsTable = []
const weaponSignatures = new Map(), membershipSignatures = new Map()
const intern = (value, values, map) => {
  const key = JSON.stringify(value)
  if (!map.has(key)) { map.set(key, values.length); values.push(value) }
  return map.get(key)
}
for (const payload of capture.payloads) {
  const dataset = buildCanonicalDataset({ metadata: capture.metadata, payloads: [payload] })
  const memberships = canonicalMemberships(payload)
  for (const entry of buildMobilityProfiles({ metadata: capture.metadata, payloads: [payload] })) {
    const unit = payload.units.find(u => u.id === entry.unitId)
    const group = unit.profileGroups.find(g => g.id === entry.groupId)
    const option = group.options.find(o => o.id === entry.optionId)
    const profile = group.profiles.find(p => p.id === entry.profileId)
    const weaponProfiles = resolveCanonicalWeaponRecords(dataset, [...(profile.weapons || []), ...(option.weapons || [])], { expandAmbiguousModes: true }).map(w => ({ id: w.id, name: w.name, modifiers: w.modifiers || [], mode: w.mode || null, modeResolution: w.modeResolution || null, type: w.type || '', burst: w.burst ?? null, burstStatus: w.burstStatus, source: 'official-profile-audit-v1' }))
    const record = { weapons: [...new Set(weaponProfiles.map(w => w.name + (w.modifiers.length ? ` (${w.modifiers.join(', ')})` : '')))], weaponProfiles, memberships: entry.skills.some(s => /^Peripheral(?:\(|$)/.test(s)) ? [] : filterCanonicalFireteamMembershipsForProfile(memberships.get(entry.unitId) || [], [option.name, profile.name, group.isc]) }
    const compact = { w: record.weaponProfiles.map(w => intern(w, weapons, weaponSignatures)), m: intern(record.memberships, membershipsTable, membershipSignatures) }
    const signature = JSON.stringify(compact)
    if (!signatures.has(signature)) { signatures.set(signature, profiles.length); profiles.push(compact) }
    keys[entry.id] = signatures.get(signature)
  }
}
const catalog = { version: 'official-profile-audit-v1', keys, profiles, weapons, memberships: membershipsTable }
catalog.fingerprint = createHash('sha256').update(JSON.stringify(catalog)).digest('hex')
await writeFile('src/data/profile-audit.json', JSON.stringify(catalog) + '\n')
console.log({ entries: Object.keys(keys).length, records: profiles.length, fingerprint: catalog.fingerprint })
