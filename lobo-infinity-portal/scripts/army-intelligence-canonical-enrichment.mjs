import { getFireteamReference } from '../bot/inf-id-fireteams.mjs'
import { buildCanonicalDataset, resolveCanonicalWeaponRecords } from './infinity-army-canonical-dataset.mjs'

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
  const dataset = buildCanonicalDataset({ metadata: { weapons: reference?.weapons || [] }, payloads: [{ version: reference?.payloadVersion, units }] })
  const chartUnits = new Map()
  for (const team of reference?.fireteamChart?.teams || []) for (const unit of team.units || []) {
    const id = Number(unit.unitId)
    if (!Number.isInteger(id)) continue
    const teams = chartUnits.get(id) || []
    teams.push(String(team.name || ''))
    chartUnits.set(id, teams)
  }
  return {
    ...list,
    combatGroups: list.combatGroups.map((group) => ({ ...group, entries: group.entries.map((entry) => enrichEntry(entry, units, dataset, chartUnits, reference)) })),
    enrichment: { provider: 'Corvus Belli Infinity Army browser-observed payload', datasetId: dataset.datasetId, payloadVersion: reference?.payloadVersion || null, officialUnitVersion: dataset.officialUnitVersion, sourceUrls: dataset.sourceUrls, capturedAt: dataset.capturedAt, fireteamStatus: reference?.status || 'unknown', status: (reference?.status === 'available' || reference?.status === 'none') && units.length ? 'complete' : 'incomplete', enrichedAt: new Date().toISOString() },
  }
}

function enrichEntry(entry, units, dataset, chartUnits, reference) {
  const [sectorialId, unitId, groupId, optionId, profileId] = String(entry.combinedId || '').split('-').map(Number)
  const unit = units.find((candidate) => candidate.id === unitId)
  const group = unit?.profileGroups?.find((candidate) => candidate.id === groupId)
  const profile = group?.profiles?.find((candidate) => candidate.id === profileId) || null
  const option = group?.options?.find((candidate) => candidate.id === optionId)
  const weaponProfiles = resolveCanonicalWeaponRecords(dataset, option?.weapons || []).filter((weapon) => weapon.name).map((weapon) => ({ id: weapon.id, name: weapon.name, mode: weapon.mode, variant: weapon.variant, modeResolution: weapon.modeResolution, type: weapon.type, burst: weapon.burst, burstStatus: weapon.burstStatus, source: weapon.sourceDatasetId }))
  const teams = Array.from(new Set(chartUnits.get(unitId) || []))
  const fireteamEligibility = reference?.status === 'available' || reference?.status === 'none'
    ? { state: teams.length ? 'verified' : 'verified-false', verified: Boolean(teams.length), teams }
    : { state: 'unknown', verified: false, teams: [] }
  return { ...entry, bs: profile?.bs ?? null, weaponProfiles, fireteamEligibility, canonicalProfile: profile?.name || null, canonicalUnitId: unitId, canonicalOptionId: optionId, canonicalSource: { datasetId: dataset.datasetId, payloadVersion: reference?.payloadVersion || null, sectorialId } }
}

function applyUnknownEnrichment(list) {
  return enrichDecodedList(list, { status: 'unknown', units: [], weapons: [], fireteamChart: [], payloadVersion: null })
}
