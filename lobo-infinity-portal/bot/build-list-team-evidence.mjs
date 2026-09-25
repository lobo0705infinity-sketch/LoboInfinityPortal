import { validTeam } from './build-list-generator.mjs'

const TYPES = ['DUO', 'HARIS', 'CORE']
const SNAPSHOT_ORIGIN = 'https://ecwefvuvauaqpary.public.blob.vercel-storage.com/'
const SNAPSHOT_POINTER = 'public-snapshots/current.json'
const FRESH_FOR = 6 * 60 * 60 * 1000
const RETRY_AFTER = 10 * 60 * 1000
let cached = null
let pending = null
let expiresAt = 0

function combinations(values, size, start = 0, chosen = [], output = []) {
  if (chosen.length === size) { output.push(chosen); return output }
  for (let i = start; i <= values.length - (size - chosen.length); i++) {
    combinations(values, size, i + 1, [...chosen, values[i]], output)
  }
  return output
}

function listProfiles(list, payload) {
  const units = new Map((payload.units || []).map(unit => [Number(unit.id), unit]))
  return (list.decoded?.combatGroups || []).flatMap(group => (group.entries || []).flatMap(entry => {
    const [sectorialId, id, groupId, optionId] = String(entry.combinedId || '').split('-').map(Number)
    if (Number(sectorialId) !== Number(payload.sectorialId)
      || entry.fireteamEligibility?.state !== 'verified') return []
    const unit = units.get(id)
    if (!unit || !entry.fireteamEligibility.teams?.length) return []
    const profileGroup = (unit.profileGroups || []).find(candidate => Number(candidate.id) === groupId)
    const option = (groupId === 0 ? unit.options : profileGroup?.options)?.find(candidate => Number(candidate.id) === optionId)
    if (!option) return []
    return [{ id: entry.combinedId, unitId: id, slug: unit.slug, optionName: option.name,
      unitName: unit.isc || unit.name, combatGroup: Number(group.combatGroup),
      recordedTeams: entry.fireteamEligibility.teams }]
  }))
}

// These are combinations the submitted roster could form. Army codes do not
// record the Fireteam a player deployed or which member led it.
export function possibleFireteamTypes(list, payload) {
  const chart = payload?.fireteamChart
  if (!chart?.teams?.length || !list?.decoded) return []
  const sectorialId = Number(String(list.decoded.combatGroups?.[0]?.entries?.[0]?.combinedId || '').split('-')[0])
  const members = listProfiles(list, { ...payload, sectorialId })
  const found = new Set()
  for (const team of chart.teams) {
    if (!team.type?.length) continue
    for (const type of TYPES) {
      if (found.has(type) || !team.type.includes(type)) continue
      const sizes = type === 'CORE' ? [3, 4, 5] : [type === 'DUO' ? 2 : 3]
      for (const group of [1, 2]) {
        const eligible = members.filter(item => item.combatGroup === group && item.recordedTeams.includes(team.name))
        for (const size of sizes) {
          if (eligible.length < size) continue
          if (combinations(eligible, size).some(selection => validTeam(selection, team, type, chart)?.level >= 2)) {
            found.add(type)
            break
          }
        }
        if (found.has(type)) break
      }
    }
  }
  return [...found]
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function deriveTeamTypeEvidence(snapshot, source) {
  const payloads = new Map((source?.payloads || []).map(payload => {
    const id = Number(String(payload.url || '').split('/').at(-1))
    return [id, payload]
  }).filter(([id]) => Number.isInteger(id)))
  const byFaction = new Map()
  for (const group of snapshot?.data || []) for (const list of group.lists || []) {
    const outcomes = new Set([list.result, ...(list.results || [])].map(value => String(value || '').toLowerCase()))
    if (outcomes.has('win') === outcomes.has('loss') || list.status !== 'decoded') continue
    const id = Number(String(list.decoded?.combatGroups?.[0]?.entries?.[0]?.combinedId || '').split('-')[0])
    const payload = payloads.get(id)
    if (!payload?.fireteamChart?.teams?.length) continue
    const typeSet = new Set(possibleFireteamTypes(list, payload))
    const rows = byFaction.get(id) || []
    rows.push({ win: outcomes.has('win'), types: typeSet })
    byFaction.set(id, rows)
  }
  const observations = Object.fromEntries(TYPES.map(type => [type, { wins: 0, losses: 0, deviation: 0 }]))
  const preferences = {}
  for (const [id, rows] of byFaction) {
    const baseline = rows.filter(row => row.win).length / rows.length
    const local = {}
    for (const type of TYPES) {
      const matched = rows.filter(row => row.types.has(type))
      const wins = matched.filter(row => row.win).length
      const losses = matched.length - wins
      const deviation = wins - matched.length * baseline
      observations[type].wins += wins
      observations[type].losses += losses
      observations[type].deviation += deviation
      // A handful of games in one sectorial must not override list quality.
      local[type] = matched.length >= 4 ? clamp(6 * deviation / (matched.length + 10), -.75, .75) : 0
    }
    preferences[id] = local
  }
  const global = Object.fromEntries(TYPES.map(type => {
    const row = observations[type]
    const count = row.wins + row.losses
    return [type, count >= 8 ? clamp(10 * row.deviation / (count + 24), -1.5, 1.5) : 0]
  }))
  for (const local of Object.values(preferences)) for (const type of TYPES) local[type] += global[type]
  preferences.global = global
  return { snapshotId: snapshot?.snapshotId || null, observations, preferences,
    decisiveLists: [...byFaction.values()].reduce((count, rows) => count + rows.length, 0) }
}

export async function loadTeamTypeEvidence(source, fetchImpl = fetch) {
  if (fetchImpl === fetch && Date.now() < expiresAt) return cached
  if (fetchImpl === fetch && pending) return pending
  const read = async () => {
    const get = async path => {
      const response = await fetchImpl(SNAPSHOT_ORIGIN + path, { signal: AbortSignal.timeout(15_000) })
      if (!response.ok) throw new Error(`Portal snapshot unavailable: ${response.status}`)
      return response.json()
    }
    const pointer = await get(SNAPSHOT_POINTER)
    if (!/^public-snapshots\/\d{8}T\d{6}Z\/$/.test(pointer.basePath || '')) throw new Error('Invalid portal snapshot path')
    return deriveTeamTypeEvidence(await get(`${pointer.basePath}army-intelligence-detail.json`), source)
  }
  const attempt = read().then(value => {
    if (fetchImpl === fetch) { cached = value; expiresAt = Date.now() + FRESH_FOR }
    return value
  }).catch(() => {
    if (fetchImpl === fetch) expiresAt = Date.now() + RETRY_AFTER
    return cached
  }).finally(() => { if (fetchImpl === fetch) pending = null })
  if (fetchImpl === fetch) pending = attempt
  return attempt
}
