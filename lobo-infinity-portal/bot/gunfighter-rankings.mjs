import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { readArtifact } from '../scripts/benchmark-artifacts.mjs'
import { availableProfiles } from './build-list-generator.mjs'
import { LIVE_ROSTER_UNIT_SLUGS } from './official-army-rosters.mjs'

let cachedFingerprint = null
let cachedRankings = null

export function buildGunfighterRankings(catalog, capture, rosters = LIVE_ROSTER_UNIT_SLUGS) {
  if (!Array.isArray(catalog?.entries) || !Array.isArray(capture?.payloads) || !capture?.metadata) {
    throw new Error('Official profiles and a gunfighter catalog are required for rankings.')
  }
  const payloads = new Map(capture.payloads.map(payload => [Number(payload.sectorialId ?? payload.url?.split('/').at(-1)), payload]))
  const selectable = new Map()
  for (const [sectorialId, rosterSlugs] of rosters) {
    const payload = payloads.get(Number(sectorialId))
    if (!payload) throw new Error(`Missing official Army payload for faction ${sectorialId}.`)
    const withFireteams = payload.fireteamChart ? payload : { ...payload, fireteamChart: { teams: [], spec: {} } }
    for (const profile of availableProfiles({ payload: withFireteams, metadata: capture.metadata,
      sectorialId: Number(sectorialId), rosterSlugs })) selectable.set(profile.id, profile.troopType)
  }

  const cohorts = new Map()
  for (const entry of catalog.entries) {
    if (!selectable.has(entry.key)) continue
    for (const state of entry.result?.states || []) {
      if (!Number.isFinite(state.rating)) continue
      // TAGs may enter a Fireteam, but cannot receive the Fireteam +1SD bonus.
      if (state.id === 'fireteam' && selectable.get(entry.key) === 4) continue
      if (!cohorts.has(state.id)) cohorts.set(state.id, [])
      cohorts.get(state.id).push({ key: entry.key, faction: Number(entry.sectorialId), rating: state.rating })
    }
  }

  const rankings = new Map()
  for (const [state, cohort] of cohorts) {
    const global = place(cohort)
    const factions = new Map()
    for (const row of cohort) {
      if (!factions.has(row.faction)) factions.set(row.faction, [])
      factions.get(row.faction).push(row)
    }
    const inFaction = new Map([...factions].map(([id, rows]) => [id, place(rows)]))
    for (const row of cohort) {
      if (!rankings.has(row.key)) rankings.set(row.key, {})
      rankings.get(row.key)[state] = { faction: inFaction.get(row.faction).get(row.key), global: global.get(row.key) }
    }
  }
  return rankings
}

function place(rows) {
  const ordered = [...rows].sort((a, b) => b.rating - a.rating || a.key.localeCompare(b.key))
  const ranks = new Map()
  let rank = 0
  for (const [index, row] of ordered.entries()) {
    if (index === 0 || row.rating !== ordered[index - 1].rating) rank = index + 1
    ranks.set(row.key, { rank, total: ordered.length })
  }
  return ranks
}

export async function loadBundledGunfighterRankings(catalog) {
  if (!catalog) return null
  if (cachedFingerprint === catalog.fingerprint && cachedRankings) return cachedRankings
  const capture = await readArtifact(resolve(import.meta.dirname, '..', 'data', 'infinity-army', 'benchmark-official-source.json.gz.b64'))
  if (createHash('sha256').update(JSON.stringify(capture)).digest('hex') !== catalog.source?.captureFingerprint) {
    throw new Error('Gunfighter benchmark and official Army profiles do not match.')
  }
  const rankings = buildGunfighterRankings(catalog, capture)
  cachedFingerprint = catalog.fingerprint
  cachedRankings = rankings
  return rankings
}
