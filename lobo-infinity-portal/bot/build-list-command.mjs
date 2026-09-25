import { ApplicationCommandOptionType } from 'discord.js'
import { resolve } from 'node:path'
import { readArtifact } from '../scripts/benchmark-artifacts.mjs'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'
import { LIVE_ROSTER_UNIT_SLUGS } from './official-army-rosters.mjs'
import { loadGunfighterBenchmarkCatalog } from './gunfighter-catalog-store.mjs'
import { loadAroBenchmarkCatalog } from './aro-catalog-store.mjs'
import { loadCloseCombatCatalog } from './close-combat-catalog-store.mjs'
import { loadMobilityCatalog } from './mobility-catalog-store.mjs'
import { availableProfiles, buildArmyListOptions, ListBuilderError, projectedRegularOrders, rosterConnections,
  resolveRequiredProfile } from './build-list-generator.mjs'
import { loadTeamTypeEvidence } from './build-list-team-evidence.mjs'

export const BUILD_LIST_COMMAND = 'build-list'
export const BUILD_LIST_FACTION_OPTION = 'faction'
export const BUILD_LIST_MISSION_OPTION = 'mission'
export const BUILD_LIST_MUST_INCLUDE_OPTION = 'must-include'
export const BUILD_LIST_COMMAND_DEFINITION = Object.freeze({
  name: BUILD_LIST_COMMAND,
  description: 'Build legal Infinity Army lists for a faction and mission',
  options: [
    { name: BUILD_LIST_FACTION_OPTION, description: 'Start typing a faction or sectorial, then select it', required: true, type: ApplicationCommandOptionType.String, autocomplete: true },
    { name: BUILD_LIST_MISSION_OPTION, description: 'Start typing a mission, such as Hardlock', required: true, type: ApplicationCommandOptionType.String, autocomplete: true },
    { name: BUILD_LIST_MUST_INCLUDE_OPTION, description: 'Start typing units, separated by commas', required: false, type: ApplicationCommandOptionType.String, autocomplete: true },
    { name: 'points', description: 'Army points (default: 300)', required: false, type: ApplicationCommandOptionType.Integer,
      choices: [100, 150, 200, 250, 300, 350, 400].map(value => ({ name: String(value), value })) },
  ],
})

const cache = new Map()
let bundledSourcePromise = null
const cacheAge = 20 * 60 * 1000
const headers = { accept: 'application/json, text/plain, */*', origin: 'https://infinityuniverse.com', referer: 'https://infinityuniverse.com/' }
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export async function getCurrentArmySource(factionName, fetchImpl = fetch) {
  const metadata = await cachedJson('metadata', 'https://api.corvusbelli.com/army/infinity/en/metadata', fetchImpl)
  const query = normalize(factionName)
  if (!query || query.length > 70) throw new ListBuilderError('Enter a faction or sectorial name.')
  const candidates = (metadata.factions || []).filter(item => String(item.id) === String(factionName).trim() || normalize(item.slug) === query || normalize(item.name) === query)
  const broad = candidates.length ? candidates : (metadata.factions || []).filter(item => normalize(item.slug).includes(query) || normalize(item.name).includes(query))
  if (broad.length !== 1) throw new ListBuilderError(broad.length ? 'That faction name matches several armies; use the sectorial name.' : `Unknown faction: ${factionName}.`)
  const faction = broad[0]
  if (!LIVE_ROSTER_UNIT_SLUGS.has(Number(faction.id))) throw new ListBuilderError('That faction has no verified Army roster yet.')
  const payload = await cachedJson(`units:${faction.id}`, `https://api.corvusbelli.com/army/units/en/${faction.id}`, fetchImpl)
  if (!Array.isArray(payload?.units)) throw new ListBuilderError('Current Army unit data are unavailable.')
  if (payload.fireteamChart && !Array.isArray(payload.fireteamChart.teams)) throw new ListBuilderError('Current Army Fireteam data are unavailable.')
  return { faction, metadata, payload: payload.fireteamChart ? payload : { ...payload, fireteamChart: { teams: [], spec: {} } } }
}

async function loadBundledSource() {
  bundledSourcePromise ||= readArtifact(resolve(import.meta.dirname, '..', 'data', 'infinity-army', 'benchmark-official-source.json.gz.b64'))
  return bundledSourcePromise
}

async function loadBundledFactions() {
  return (await loadBundledSource()).metadata.factions
}

export async function searchBuildListFactions(query, loadFactions = loadBundledFactions) {
  const needle = normalize(query)
  return (await loadFactions())
    .filter(faction => LIVE_ROSTER_UNIT_SLUGS.has(Number(faction.id)))
    .filter(faction => !needle || normalize(faction.slug).includes(needle) || normalize(faction.name).includes(needle))
    .sort((a, b) => {
      const rank = faction => !needle || normalize(faction.slug).startsWith(needle) ? 0 : normalize(faction.name).startsWith(needle) ? 1 : 2
      return rank(a) - rank(b) || a.name.localeCompare(b.name)
    })
    .slice(0, 25)
    .map(faction => ({ name: String(faction.name).slice(0, 100), value: String(faction.id) }))
}

export function searchBuildListMissions(query) {
  const needle = normalize(query)
  return CANONICAL_MISSIONS.filter(mission => !needle || normalize(mission).includes(needle))
    .slice(0, 25).map(mission => ({ name: mission, value: mission }))
}

export async function searchBuildListUnits(query, factionName, loadSource = loadBundledSource) {
  const source = await loadSource()
  const factionQuery = normalize(factionName)
  const factions = (source.metadata.factions || []).filter(item =>
    LIVE_ROSTER_UNIT_SLUGS.has(Number(item.id))
    && (String(item.id) === String(factionName).trim() || normalize(item.slug) === factionQuery || normalize(item.name) === factionQuery))
  if (factions.length !== 1) return []
  const faction = factions[0]
  const payload = source.payloads.find(item => item.url?.endsWith(`/units/en/${faction.id}`))
  if (!payload) return []
  const profiles = availableProfiles({ payload: payload.fireteamChart ? payload
    : { ...payload, fireteamChart: { teams: [], spec: {} } }, metadata: source.metadata,
    sectorialId: Number(faction.id), rosterSlugs: LIVE_ROSTER_UNIT_SLUGS.get(Number(faction.id)) })
  const availableUnitIds = new Set(profiles.map(profile => profile.unitId))
  const parts = String(query || '').split(',')
  const selected = parts.slice(0, -1).map(part => part.trim()).filter(Boolean)
  const selectedUnitIds = new Set(selected.map(value => resolveRequiredProfile(profiles, value)?.unitId).filter(Boolean))
  const needle = normalize(parts.at(-1))
  return payload.units.filter(unit => availableUnitIds.has(Number(unit.id)))
    .map(unit => {
      const unitProfiles = profiles.filter(profile => profile.unitId === Number(unit.id))
      const base = (unit.profileGroups || []).find(group => Number(group.id) === 1)
      const alias = base?.options?.[0]?.name || unitProfiles[0].optionName
      const value = [alias, unit.isc || unit.name, unit.slug].find(candidate => candidate && !candidate.includes(',')
        && resolveRequiredProfile(profiles, candidate)?.unitId === Number(unit.id)) || unit.slug
      return { name: `${alias} · ${unit.isc || unit.name}`.slice(0, 100), value, unit }
    })
    .filter(item => !needle || [item.value, item.unit.slug, item.unit.isc, item.unit.name].some(value => normalize(value).includes(needle)))
    .filter(item => !selectedUnitIds.has(Number(item.unit.id)))
    .map(({ name, value }) => ({ name, value: [...selected, value].join(', ') }))
    .filter(item => item.value.length <= 100)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 25)
}

export function createBuildListAutocompleteHandler({ searchFaction = searchBuildListFactions,
  searchMission = searchBuildListMissions, searchUnit = searchBuildListUnits, logger = console } = {}) {
  return async interaction => {
    if (!interaction?.isAutocomplete?.() || interaction.commandName !== BUILD_LIST_COMMAND) return false
    try {
      const focused = interaction.options.getFocused(true)
      if (focused.name === BUILD_LIST_FACTION_OPTION) await interaction.respond(await searchFaction(focused.value))
      else if (focused.name === BUILD_LIST_MISSION_OPTION) await interaction.respond(await searchMission(focused.value))
      else if (focused.name === BUILD_LIST_MUST_INCLUDE_OPTION) await interaction.respond(await searchUnit(focused.value, interaction.options.getString(BUILD_LIST_FACTION_OPTION)))
      else return false
    }
    catch (error) {
      logger.error?.('Army list autocomplete failed:', error)
      try { await interaction.respond([]) } catch {}
    }
    return true
  }
}

async function cachedJson(key, url, fetchImpl) {
  const entry = cache.get(key)
  if (fetchImpl === fetch && entry && Date.now() - entry.at < cacheAge) return entry.value
  let response
  try { response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(15_000) }) }
  catch { throw new ListBuilderError('Infinity Army is unavailable right now. Try again shortly.') }
  if (!response.ok) throw new ListBuilderError('Infinity Army is unavailable right now. Try again shortly.')
  let value
  try { value = await response.json() }
  catch { throw new ListBuilderError('Infinity Army returned invalid profile data.') }
  if (fetchImpl === fetch) cache.set(key, { at: Date.now(), value })
  return value
}

export async function buildListResponses({ faction, mission, mustInclude = '', points = 300,
  getSource = getCurrentArmySource, getCatalog = loadGunfighterBenchmarkCatalog,
  getAroCatalog = loadAroBenchmarkCatalog, getCloseCombatCatalog = loadCloseCombatCatalog,
  getMobilityCatalog = loadMobilityCatalog,
  getTeamEvidence = async () => loadTeamTypeEvidence(await loadBundledSource()) } = {}) {
  const source = await getSource(faction)
  const [gunfighterCatalog, aroCatalog, closeCombatCatalog, mobilityCatalog, teamTypeEvidence] = await Promise.all([
    getCatalog(), getAroCatalog(), getCloseCombatCatalog(), getMobilityCatalog(), getTeamEvidence(),
  ])
  const lists = buildArmyListOptions({ ...source, sectorialId: Number(source.faction.id),
    rosterSlugs: LIVE_ROSTER_UNIT_SLUGS.get(Number(source.faction.id)), gunfighterCatalog,
    aroCatalog, closeCombatCatalog, mobilityCatalog,
    mission, mustInclude: String(mustInclude).split(','), points, teamTypeEvidence })
  for (const list of lists) list.teamTypeEvidence = teamTypeEvidence?.decisiveLists ? teamTypeEvidence : null
  return lists.map((list, index) => ({ allowedMentions: { parse: [] }, content: formatBuiltList(list, index + 1) }))
}

export function formatBuiltList(list, number) {
  const groupText = [1, 2].map(group => {
    const members = list.profiles.filter(item => item.combatGroup === group)
    if (!members.length) return ''
    const regular = projectedRegularOrders(list.profiles, group)
    const tactical = members.reduce((sum, item) => sum + (item.tacticalOrders || 0), 0)
    const lieutenantOrders = list.profiles.reduce((sum, item) => sum + (item.lieutenantOrders || 0), 0)
    const nco = lieutenantOrders && members.some(item => item.nco) ? ` · NCO (${lieutenantOrders} Lt, shared)` : ''
    const delayed = members.filter(item => item.regular && item.startsOffTable).length
    return `**Group ${group} · ${regular} Regular${tactical ? ` +${tactical} Tactical` : ''}${nco}${delayed ? ` · ${delayed} off table` : ''}**\n${members.map(item => `• ${item.label} — ${item.points} pts`).join('\n')}`
  }).filter(Boolean).join('\n')
  const fireteams = list.fireteams.length
    ? list.fireteams.map(team => `• **${team.type} · Level ${team.level}** (${team.name}, Group ${team.combatGroup}): ${team.members.map(name => name.split(' · ')[0]).join(' + ')}${team.level >= 2 ? ' · BS Attack (+1 SD)' : ''}`).join('\n')
    : '• No legal Level 2 Fireteam found in this roster.'
  const quality = list.quality
    ? `**A/S coverage (separate Guns/ARO)** Guns ${list.quality.gunfighters}/2 · CC ${list.quality.cc}/2 · ARO ${list.quality.aro}/2 · Specialists ${list.quality.specialists}/${list.quality.specialistTarget}${list.quality.linkedGunfighters || list.quality.linkedAro ? ' · linked grades included' : ''}\n`
    : ''
  const intro = `**${list.faction} · ${list.mission} · option ${number}**\n`
    + `${list.points}/${list.legality.limits.points} pts · ${list.swc}/${list.legality.limits.swc} SWC · ${list.legality.totals.troopers}/15 troopers · ${list.specialistCount} specialists\n`
    + `**Proposed fireteams**\n${fireteams}\n${quality}`
  const evidenceNote = list.teamTypeEvidence
    ? ` Portal type prior: ${list.teamTypeEvidence.decisiveLists} decisive lists; compatible teams inferred, not observed.` : ''
  const baseEnding = `${groupText}\n[Open in Infinity Army](${list.url})\n`
    + `-# Army profiles ${list.payloadVersion}; verify fireteams during deployment.`
  let ending = baseEnding
  if (intro.length + baseEnding.length + evidenceNote.length <= 1990) ending += evidenceNote
  const links = rosterConnections(list.profiles)
  let support = ''
  for (let size = links.length; size > 0; size--) {
    const proposed = `**Support links** ${links.slice(0, size).join(' · ')}\n`
    if (intro.length + proposed.length + ending.length <= 1990) {
      support = proposed
      break
    }
  }
  const message = intro + support + ending
  if (message.length > 1990) throw new ListBuilderError('The generated list is too long for Discord; try fewer required profiles.')
  return message
}

export function createBuildListInteractionHandler({ build = buildListResponses, logger = console } = {}) {
  return async interaction => {
    if (!interaction?.isChatInputCommand?.() || interaction.commandName !== BUILD_LIST_COMMAND) return false
    try {
      await interaction.deferReply()
      const results = await build({
        faction: interaction.options.getString('faction', true),
        mission: interaction.options.getString('mission', true),
        mustInclude: interaction.options.getString('must-include') || '',
        points: interaction.options.getInteger('points') || 300,
      })
      await interaction.editReply(results[0])
      for (const result of results.slice(1)) await interaction.followUp(result)
    } catch (error) {
      logger.error?.('Army list generation failed:', error)
      const content = error instanceof ListBuilderError ? error.message : 'I could not build a verified list right now.'
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content })
      else await interaction.reply({ content, ephemeral: true })
    }
    return true
  }
}

export async function ensureBuildListCommand(client) {
  if (!client?.guilds?.cache) return []
  const registered = []
  for (const guild of client.guilds.cache.values()) {
    const commands = await guild.commands.fetch()
    const existing = commands.find(command => command.name === BUILD_LIST_COMMAND)
    const matches = existing?.description === BUILD_LIST_COMMAND_DEFINITION.description
      && existing.options?.map(option => option.name).join(',') === BUILD_LIST_COMMAND_DEFINITION.options.map(option => option.name).join(',')
      && existing.options?.slice(0, 3).every(option => option.autocomplete === true)
    const command = !existing ? await guild.commands.create(BUILD_LIST_COMMAND_DEFINITION)
      : matches ? existing : await existing.edit(BUILD_LIST_COMMAND_DEFINITION)
    registered.push({ applicationId: command.applicationId, guildId: guild.id, id: command.id })
  }
  const globals = await client.application.commands.fetch()
  const obsolete = globals.find(command => command.name === BUILD_LIST_COMMAND)
  if (obsolete) await obsolete.delete()
  return registered
}
