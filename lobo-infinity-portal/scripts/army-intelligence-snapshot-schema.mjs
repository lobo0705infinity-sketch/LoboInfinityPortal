export const ARMY_INTELLIGENCE_TACTICAL_SCHEMA_VERSION = 'army-intelligence-tactical-v5'
export const ARMY_INTELLIGENCE_PIPELINE_VERSION = 'army-intelligence-pipeline-v1'

export function snapshotHasCompleteTacticalMetadata(list) {
  if (
    list?.status !== 'decoded' ||
    !list.decoded ||
    list.pipelineVersion !== ARMY_INTELLIGENCE_PIPELINE_VERSION ||
    list.decoded.pipelineVersion !== ARMY_INTELLIGENCE_PIPELINE_VERSION ||
    list.tacticalSchemaVersion !== ARMY_INTELLIGENCE_TACTICAL_SCHEMA_VERSION ||
    list.decoded.tacticalSchemaVersion !== ARMY_INTELLIGENCE_TACTICAL_SCHEMA_VERSION ||
    list.decoded.enrichment?.status !== 'complete'
  ) return false

  const groups = Array.isArray(list.decoded.combatGroups) ? list.decoded.combatGroups : []
  const entries = groups.flatMap((group) => Array.isArray(group.entries) ? group.entries : [])
  if (!entries.length) return false

  return entries.every((entry) => {
    if (entry.bs == null || !Number.isFinite(Number(entry.bs)) || !Array.isArray(entry.skills)) return false
    const sourceWeapons = Array.isArray(entry.weapons) ? entry.weapons : []
    const canonicalWeapons = Array.isArray(entry.weaponProfiles) ? entry.weaponProfiles : []
    if (sourceWeapons.length && !canonicalWeapons.length) return false
    return canonicalWeapons.every((weapon) =>
      String(weapon?.name || '').trim() &&
      (
        (weapon.burstStatus === 'canonical' && weapon.burst != null && Number.isFinite(Number(weapon.burst))) ||
        (weapon.burstStatus === 'not-applicable' && weapon.burst == null)
      ),
    )
  })
}
