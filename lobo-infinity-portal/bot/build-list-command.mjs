import { ApplicationCommandOptionType } from 'discord.js'
import { resolve } from 'node:path'
import { readArtifact } from '../scripts/benchmark-artifacts.mjs'
import { LIVE_ROSTER_UNIT_SLUGS } from './official-army-rosters.mjs'
import { loadGunfighterBenchmarkCatalog } from './gunfighter-catalog-store.mjs'
import { loadAroBenchmarkCatalog } from './aro-catalog-store.mjs'
import { loadCloseCombatCatalog } from './close-combat-catalog-store.mjs'
import { loadMobilityCatalog } from './mobility-catalog-store.mjs'
import { buildArmyListOptions, ListBuilderError } from './build-list-generator.mjs'

export const BUILD_LIST_COMMAND = 'build-list'
export const BUILD_LIST_FACTION_OPTION = 'faction'
export const BUILD_LIST_COMMAND_DEFINITION = Object.freeze({
  name: BUILD_LIST_COMMAND,
  description: 'Build legal Infinity Army lists for a faction and mission',
  options: [
    { name: BUILD_LIST_FACTION_OPTION, description: 'Start typing a faction or sectorial, then select it', required: true, type: ApplicationCommandOptionType.String, autocomplete: true },
    { name: 'mission', description: 'Mission, such as Hardlock', required: true, type: ApplicationCommandOptionType.String },
    { name: 'must-include', description: 'Required units separated by commas, such as Jazz, Iguana', required: false, type: ApplicationCommandOptionType.String },
    { name: 'points', description: 'Army points (default: 300)', required: false, type: ApplicationCommandOptionType.Integer,
      choices: [100, 150, 200, 250, 300, 350, 400].map(value => ({ name: String(value), value })) },
  ],
})

const cache = new Map()
let bundledFactionsPromise = null
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

async function loadBundledFactions() {
  bundledFactionsPromise ||= readArtifact(resolve(import.meta.dirname, '..', 'data', 'infinity-army', 'benchmark-official-source.json.gz.b64'))
    .then(source => source.metadata.factions)
  return bundledFactionsPromise
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

export function createBuildListAutocompleteHandler({ search = searchBuildListFactions, logger = console } = {}) {
  return async interaction => {
    if (!interaction?.isAutocomplete?.() || interaction.commandName !== BUILD_LIST_COMMAND) return false
    const focused = interaction.options.getFocused(true)
    if (focused.name !== BUILD_LIST_FACTION_OPTION) return false
    try { await interaction.respond(await search(focused.value)) }
    catch (error) {
      logger.error?.('Army list faction autocomplete failed:', error)
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
  getMobilityCatalog = loadMobilityCatalog } = {}) {
  const source = await getSource(faction)
  const [gunfighterCatalog, aroCatalog, closeCombatCatalog, mobilityCatalog] = await Promise.all([
    getCatalog(), getAroCatalog(), getCloseCombatCatalog(), getMobilityCatalog(),
  ])
  const lists = buildArmyListOptions({ ...source, sectorialId: Number(source.faction.id),
    rosterSlugs: LIVE_ROSTER_UNIT_SLUGS.get(Number(source.faction.id)), gunfighterCatalog,
    aroCatalog, closeCombatCatalog, mobilityCatalog,
    mission, mustInclude: String(mustInclude).split(','), points })
  return lists.map((list, index) => ({ allowedMentions: { parse: [] }, content: formatBuiltList(list, index + 1) }))
}

export function formatBuiltList(list, number) {
  const groupText = [1, 2].map(group => {
    const members = list.profiles.filter(item => item.combatGroup === group)
    return members.length ? `**Group ${group}**\n${members.map(item => `• ${item.label} — ${item.points} pts`).join('\n')}` : ''
  }).filter(Boolean).join('\n')
  const fireteams = list.fireteams.length
    ? list.fireteams.map(team => `• **${team.type} · Level ${team.level}** (${team.name}, Group ${team.combatGroup}): ${team.members.map(name => name.split(' · ')[0]).join(' + ')}${team.level >= 2 ? ' · BS Attack (+1 SD)' : ''}`).join('\n')
    : '• No legal Level 2 Duo or Haris found in this roster.'
  const message = `**${list.faction} · ${list.mission} · option ${number}**\n`
    + `${list.points}/${list.legality.limits.points} pts · ${list.swc}/${list.legality.limits.swc} SWC · ${list.legality.totals.troopers}/15 troopers · ${list.specialistCount} specialists\n`
    + `**Proposed fireteams**\n${fireteams}\n${groupText}\n[Open in Infinity Army](${list.url})\n`
    + `-# Army profiles ${list.payloadVersion}; verify fireteams during deployment.`
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
      && existing.options?.[0]?.autocomplete === true
    const command = !existing ? await guild.commands.create(BUILD_LIST_COMMAND_DEFINITION)
      : matches ? existing : await existing.edit(BUILD_LIST_COMMAND_DEFINITION)
    registered.push({ applicationId: command.applicationId, guildId: guild.id, id: command.id })
  }
  const globals = await client.application.commands.fetch()
  const obsolete = globals.find(command => command.name === BUILD_LIST_COMMAND)
  if (obsolete) await obsolete.delete()
  return registered
}
