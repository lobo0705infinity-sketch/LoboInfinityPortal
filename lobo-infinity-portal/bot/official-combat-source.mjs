import { createHash } from 'node:crypto'
import { buildCanonicalDataset } from '../scripts/infinity-army-canonical-dataset.mjs'
import { filterCanonicalFireteamMembershipsForProfile } from '../scripts/army-intelligence-canonical-enrichment.mjs'
import { buildCanonicalGunfighterProfiles } from './gunfighter-profile-canonicalizer.mjs'
import { buildFireteamBonusEligibility } from './fireteam-bonus-eligibility.mjs'
import { canonicalMemberships } from './fireteam-list-eligibility.mjs'
import { weaponChartFromArmyMetadata } from './infinity-weapon-chart.mjs'
import { COMBAT_RULES_VERSION } from './combat-rules.mjs'
import { validateMobilityCapture } from './mobility-catalog-validation.mjs'
import { isInLiveArmyRoster } from './official-army-rosters.mjs'

export function buildOfficialCombatSource(capture) {
  if (!capture?.metadata?.weapons?.length || !capture.payloads?.length) throw Error('Complete official Army capture required')
  validateMobilityCapture(capture)
  const weaponChart = weaponChartFromArmyMetadata(capture.metadata)
  const dataset = buildCanonicalDataset(capture)
  const profiles = capture.payloads.flatMap(payload => {
    const local = buildCanonicalDataset({ metadata: capture.metadata, payloads: [payload] })
    const merge = (a = [], b = []) => [...new Map([...a, ...b].map(x => [Number(x.id), x])).values()]
    local.metadata.skills = merge(local.metadata.skills, payload.filters?.skills)
    local.metadata.equips = merge(local.metadata.equips, payload.filters?.equip)
    local.metadata.types = payload.filters?.type || []
    const memberships = canonicalMemberships(payload)
    const sectorialId = Number(payload.sectorialId ?? payload.url?.split('/').at(-1))
    // The endpoint includes inactive/cross-army profiles.  Retain only units
    // exposed by the live Army roster for the selected army.
    local.units = local.units.filter((unit) => isInLiveArmyRoster(sectorialId, unit.slug, unit))
    const eligibility = buildFireteamBonusEligibility([payload])
    const entries = buildCanonicalGunfighterProfiles({ dataset: local, weaponChart, sectorialId, ...eligibility })
    for (const entry of entries) {
      const unit = payload.units.find(u => Number(u.id) === entry.unitId)
      const group = unit.profileGroups.find(g => Number(g.id) === entry.groupId)
      const option = group.options.find(o => Number(o.id) === entry.optionId)
      const physical = group.profiles.find(p => Number(p.id) === entry.profileId)
      const exactMemberships = entry.skills.some(s => /^Peripheral(?:\s|\(|$)/i.test(s)) ? [] : filterCanonicalFireteamMembershipsForProfile(memberships.get(entry.unitId) || [], [option.name, physical?.name, group.isc])
      entry.fireteamCapable &&= exactMemberships.length > 0
      entry.source = { kind: 'official-army', datasetId: local.datasetId, payloadVersion: payload.version }
    }
    return entries
  })
  if (new Set(profiles.map(p => p.id)).size !== profiles.length) throw Error('Duplicate exact combat profile identities')
  return { schemaVersion: 'official-combat-source-v1', rulesVersion: COMBAT_RULES_VERSION, datasetId: dataset.datasetId, captureFingerprint: createHash('sha256').update(JSON.stringify(capture)).digest('hex'), weaponChart, profiles }
}
