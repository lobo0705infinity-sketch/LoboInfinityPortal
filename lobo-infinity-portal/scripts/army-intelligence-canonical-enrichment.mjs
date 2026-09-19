import { getFireteamReference } from '../bot/inf-id-fireteams.mjs'
import { buildCanonicalDataset, resolveCanonicalWeaponRecords } from './infinity-army-canonical-dataset.mjs'
import { ARMY_INTELLIGENCE_PIPELINE_VERSION, ARMY_INTELLIGENCE_TACTICAL_SCHEMA_VERSION } from './army-intelligence-snapshot-schema.mjs'

export async function createCanonicalEnricher({ browser, cacheDir } = {}) {
  const references = new Map()
  return async function enrich(list) {
    const entries = list.combatGroups.flatMap((group) => group.entries)
    const sectorialId = Number(String(entries[0]?.combinedId || '').split('-')[0])
    if (!Number.isInteger(sectorialId) || !browser) return applyUnknownEnrichment(list)
    let pending = references.get(sectorialId)
    if (!pending) {
      pending = getFireteamReference({ sectorialId, armyCode: list.armyCode, browser, cacheDir })
      references.set(sectorialId, pending)
    }
    const reference = await pending
    return enrichDecodedList(list, reference)
  }
}

export function enrichDecodedList(list, reference) {
  const units = Array.isArray(reference?.units) ? reference.units : []
  const dataset = buildCanonicalDataset({ metadata: { weapons: reference?.weapons || [], extras: reference?.extras || [] }, payloads: [{ version: reference?.payloadVersion, units }] })
  const chartUnits = new Map()
  const typedTeams = (reference?.fireteamChart?.teams || []).filter((team) => Array.isArray(team.type) && team.type.length)
  for (const team of typedTeams) {
    const requiredNames = (team.units || []).filter((member) => member.required).map((member) => String(member.name || ''))
    for (const unit of team.units || []) {
    const id = Number(unit.unitId)
    if (!Number.isInteger(id)) continue
    const teams = chartUnits.get(id) || []
    teams.push({ team: String(team.name || ''), minSize: fireteamMinimumSize(team.type), required: Boolean(unit.required), requiredNames, memberName: String(unit.name || ''), countsAs: '' })
    chartUnits.set(id, teams)
    }
  }
  for (const wildcard of (reference?.fireteamChart?.teams || []).filter((team) => !Array.isArray(team.type) || !team.type.length).flatMap((team) => team.units || [])) {
    const id = Number(wildcard.unitId)
    if (!Number.isInteger(id)) continue
    const memberships = chartUnits.get(id) || []
    const countsAs = String(wildcard.comment || '').replace(/[()]/g, '').trim()
    for (const team of typedTeams) memberships.push({ team: String(team.name || ''), minSize: fireteamMinimumSize(team.type), required: false, requiredNames: (team.units || []).filter((member) => member.required).map((member) => String(member.name || '')), memberName: String(wildcard.name || ''), countsAs })
    chartUnits.set(id, memberships)
  }
  return {
    ...list,
    tacticalSchemaVersion: ARMY_INTELLIGENCE_TACTICAL_SCHEMA_VERSION,
    pipelineVersion: ARMY_INTELLIGENCE_PIPELINE_VERSION,
    combatGroups: list.combatGroups.map((group) => ({ ...group, entries: group.entries.map((entry) => enrichEntry(entry, units, dataset, chartUnits, reference)) })),
    enrichment: { provider: 'Corvus Belli Infinity Army browser-observed payload', datasetId: dataset.datasetId, payloadVersion: reference?.payloadVersion || null, officialUnitVersion: dataset.officialUnitVersion, sourceUrls: dataset.sourceUrls, capturedAt: dataset.capturedAt, fireteamStatus: reference?.status || 'unknown', unitCount: units.length, warning: reference?.warning || null, status: (reference?.status === 'available' || reference?.status === 'none') && units.length ? 'complete' : 'incomplete', enrichedAt: new Date().toISOString() },
  }
}

function enrichEntry(entry, units, dataset, chartUnits, reference) {
  const [sectorialId, unitId, groupId, optionId, profileId] = String(entry.combinedId || '').split('-').map(Number)
  const unit = units.find((candidate) => candidate.id === unitId)
  const profileGroups = unit?.profileGroups || []
  const legacyProfileName = normalizeCanonicalProfileName(entry.profile || entry.unit)
  const legacyGroups = groupId === 0
    ? profileGroups.filter((candidate) => (candidate.profiles || []).some((item) => {
        const canonicalName = normalizeCanonicalProfileName(item.name)
        return Boolean(legacyProfileName && canonicalName) && (canonicalName.includes(legacyProfileName) || legacyProfileName.includes(canonicalName))
      }))
    : []
  const optionGroups = groupId === 0
    ? profileGroups.filter((candidate) => (candidate.options || []).some((item) => item.id === optionId))
    : []
  const group = profileGroups.find((candidate) => candidate.id === groupId) ||
    (optionGroups.length === 1 ? optionGroups[0] : null) ||
    (legacyGroups.length === 1 ? legacyGroups[0] : null) ||
    (groupId === 0 && profileGroups.length === 1 ? profileGroups[0] : null)
  const profiles = group?.profiles || []
  const profile = profiles.find((candidate) => candidate.id === profileId) || (profiles.length === 1 ? profiles[0] : null)
  const option = group?.options?.find((candidate) => candidate.id === optionId)
  const weaponReferences = [...(profile?.weapons || []), ...(option?.weapons || [])]
  const weaponProfiles = resolveCanonicalWeaponRecords(dataset, weaponReferences, { expandAmbiguousModes: true }).filter((weapon) => weapon.name).map((weapon) => ({ id: weapon.id, name: weapon.name, modifiers: weapon.modifiers || [], mode: weapon.mode, variant: weapon.variant, modeResolution: weapon.modeResolution, type: weapon.type, burst: weapon.burst, burstStatus: weapon.burstStatus, source: weapon.sourceDatasetId }))
  const memberships = filterCanonicalFireteamMembershipsForProfile(
    chartUnits.get(unitId) || [],
    [option?.name, entry.profile, profile?.name, group?.isc],
  )
  const teams = Array.from(new Set(memberships.map((item) => item.team)))
  const fireteamEligibility = reference?.status === 'available' || reference?.status === 'none'
    ? { state: teams.length ? 'verified' : 'verified-false', verified: Boolean(teams.length), teams, memberships }
    : { state: 'unknown', verified: false, teams: [] }
  return { ...entry, bs: profile?.bs ?? null, cc: profile?.cc ?? null, weaponProfiles, fireteamEligibility, canonicalProfile: profile?.name || null, canonicalUnitId: unitId, canonicalOptionId: optionId, canonicalSource: { datasetId: dataset.datasetId, payloadVersion: reference?.payloadVersion || null, sectorialId } }
}

export function filterCanonicalFireteamMembershipsForProfile(memberships, profileNames = []) {
  const selectedNames = profileNames.map(normalizeCanonicalProfileName).filter(Boolean)
  return (memberships || []).filter((membership) => {
    const chartName = normalizeCanonicalProfileName(membership?.memberName)
    if (/(?:^|\s)fto(?:\s|$)/.test(chartName))
      return selectedNames.some((name) => /(?:^|\s)fto(?:\s|$)/.test(name))
    return true
  })
}

function normalizeCanonicalProfileName(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase()
}

function fireteamMinimumSize(types) { return types.includes('DUO') ? 2 : types.includes('HARIS') ? 3 : 3 }

function applyUnknownEnrichment(list) {
  return enrichDecodedList(list, { status: 'unknown', units: [], weapons: [], fireteamChart: [], payloadVersion: null })
}
