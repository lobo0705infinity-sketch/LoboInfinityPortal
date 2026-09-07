#!/usr/bin/env node

import { buildTacticalAnalysis } from '../src/services/armyIntelligenceTacticalAnalysis.ts'
import { ARMY_INTELLIGENCE_PIPELINE_VERSION } from './army-intelligence-snapshot-schema.mjs'

const endpoint = process.env.ARMY_INTELLIGENCE_MIGRATION_URL || 'https://lobo-infinity-portal.vercel.app/api/army-intelligence-refresh-worker'
const token = String(process.env.ARMY_INTELLIGENCE_BACKFILL_TOKEN || '').trim()
if (!token) throw new Error('ARMY_INTELLIGENCE_BACKFILL_TOKEN is required.')
const response = await fetch(endpoint, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-army-backfill-token': token },
  body: JSON.stringify({ dryRun: true }), signal: AbortSignal.timeout(60_000),
})
if (!response.ok) throw new Error(`Audit worker HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`)
const audit = await response.json()

const origin = 'https://ecwefvuvauaqpary.public.blob.vercel-storage.com/'
const pointer = await (await fetch(`${origin}public-snapshots/current.json`, { cache: 'no-store', signal: AbortSignal.timeout(30_000) })).json()
const envelope = await (await fetch(new URL(`${pointer.basePath}army-intelligence-detail.json`, origin), { cache: 'no-store', signal: AbortSignal.timeout(30_000) })).json()
const lists = envelope.data.flatMap((faction: any) => faction.lists || [])
const publicKeys = new Set(lists.map((list: any) => list.snapshotKey).filter(Boolean))
const omitted = audit.sourceSnapshotKeys.filter((key: string) => !publicKeys.has(key))
const entries = lists.flatMap((list: any) => list.decoded?.combatGroups?.flatMap((group: any) => group.entries || []) || [])
const missingBs = entries.filter((entry: any) => entry.bs == null).map((entry: any) => entry.combinedId)
const missingBurst = entries.flatMap((entry: any) => (entry.weaponProfiles || []).filter((weapon: any) =>
  !((weapon.burstStatus === 'canonical' && Number.isFinite(Number(weapon.burst))) || (weapon.burstStatus === 'not-applicable' && weapon.burst == null)),
).map((weapon: any) => ({ combinedId: entry.combinedId, weapon: weapon.name, status: weapon.burstStatus })))

function regression(listName: string) {
  const list = lists.find((item: any) => String(item.decoded?.listName || '').trim() === listName)
  if (!list) return { present: false }
  const analysis = buildTacticalAnalysis([list])
  return {
    present: true, pipelineVersion: list.pipelineVersion, enrichment: list.decoded.enrichment?.status,
    profiles: list.decoded.combatGroups.flatMap((group: any) => group.entries).map((entry: any) => ({ unit: entry.unit, bs: entry.bs, skills: entry.skills, equipment: entry.equipment, weapons: entry.weaponProfiles })),
    categories: Object.fromEntries(analysis.categories.map((category) => [category.id, category.profiles.map((profile) => profile.unit)])),
  }
}

console.log(JSON.stringify({
  pipelineVersion: ARMY_INTELLIGENCE_PIPELINE_VERSION,
  pointer,
  totalDistinctStoredLists: audit.totalDistinctLists,
  currentVersionSnapshots: audit.currentVersionSnapshots,
  staleSnapshots: audit.staleSnapshots,
  duplicateSnapshotKeys: audit.duplicateSnapshotKeys,
  listsOmittedFromPublishedReadModel: omitted,
  snapshotsMissingBs: missingBs,
  rangedWeaponsMissingCanonicalBurst: missingBurst,
  usariadna: regression('Bald Burgers'),
  caledonia: regression("Where's WalDon"),
}, null, 2))
