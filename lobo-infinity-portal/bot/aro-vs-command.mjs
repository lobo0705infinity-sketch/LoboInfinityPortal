import { ApplicationCommandOptionType } from 'discord.js'
import { resolve } from 'node:path'
import { readArtifact } from '../scripts/benchmark-artifacts.mjs'
import { buildOfficialCombatSource } from './official-combat-source.mjs'
import { evaluateAroProfile } from './gunfighter-rating.mjs'
import { renderAroCounterImages } from './aro-counter-renderer.mjs'

export const ARO_VS_COMMAND = 'aro-counter'
export const TARGET_OPTION = 'target'
export const ARMY_OPTION = 'army'
export const RANGE_OPTION = 'range'
export const ARO_VS_COMMAND_DEFINITION = Object.freeze({
  name: ARO_VS_COMMAND,
  description: 'Rank the best AROs against a target profile',
  options: [
    { name: TARGET_OPTION, description: 'Start typing a profile name, then select its exact loadout', required: true, type: ApplicationCommandOptionType.String, autocomplete: true },
    { name: ARMY_OPTION, description: 'Optional: restrict counters to an Army or sectorial', required: false, type: ApplicationCommandOptionType.String, autocomplete: true },
    { name: RANGE_OPTION, description: 'Engagement range to rank', required: false, type: ApplicationCommandOptionType.String, choices: [
      { name: 'All standard ranges', value: 'all' },
      { name: '16–32 inches', value: '16-32' },
      { name: '16–24 inches', value: '16-24' },
      { name: '24–32 inches', value: '24-32' },
      { name: '32–40 inches', value: '32-40' },
    ] },
  ],
})

let combatSourcePromise = null

// The official metadata feed also contains reinforcements, legacy placeholders, and
// internal/orphan entries.  The counter picker intentionally exposes only the
// current, normal Army choices shown in the League portal.
const COUNTER_ARMY_IDS = new Set([
  101, 102, 103, 104, 105, 106, 107, // PanOceania
  201, 202, 204, 205,                // Yu Jing
  301, 302, 303, 304, 305, 306,      // Ariadna
  401, 402, 403, 404,                // Haqqislam
  501, 502, 503, 504,                // Nomads
  601, 602, 603, 604, 605,           // Combined Army
  701, 702, 703,                     // ALEPH
  801,                               // Tohaa
  901, 902, 904, 905, 908, 909,      // Non-Aligned Armies
  1001, 1002, 1003,                  // O-12
  1101, 1102, 1103,                  // JSA
])

export async function ensureAroVsCommand(client) {
  if (!client?.guilds?.cache) return []
  const registered = []
  for (const guild of client.guilds.cache.values()) {
    const commands = await guild.commands.fetch()
    let command = commands.find((candidate) => candidate.name === ARO_VS_COMMAND)
    if (!command) command = await guild.commands.create(ARO_VS_COMMAND_DEFINITION)
    else if (!matches(command)) command = await command.edit(ARO_VS_COMMAND_DEFINITION)
    registered.push({ applicationId: command.applicationId, guildId: guild.id, id: command.id })
  }
  const global = await client.application.commands.fetch()
  const obsolete = global.find((command) => command.name === ARO_VS_COMMAND)
  if (obsolete) await obsolete.delete()
  return registered
}

export async function rankArosAgainst({ target, army = null, range = 'all', limit = 10 } = {}) {
  const source = await loadCombatSource()
  const attacker = resolveTarget(source.profiles, target)
  const selectedArmy = army ? resolveArmy(source.factions, army) : null
  const candidates = uniqueAroCandidates(selectedArmy ? source.profiles.filter((profile) => belongsToArmy(profile, selectedArmy, source.factions)) : source.profiles)
  const rows = candidates.map((profile) => {
    const states = evaluateAroProfile(profile, [attacker], { excludeDirectTemplates: true }).states
    const state = states.map((entry) => ({ entry, score: scoreState(entry, range) })).sort((a, b) => b.score - a.score)[0].entry
    return { profile, state, score: scoreState(state, range) }
  }).sort((a, b) => b.score - a.score || a.profile.name.localeCompare(b.profile.name))

  const names = new Set()
  const results = []
  for (const row of rows) {
    if (names.has(row.profile.name)) continue
    names.add(row.profile.name)
    results.push(formatRow(row, range))
    if (results.length >= limit) break
  }
  return { target: attacker, army: selectedArmy, range, results }
}

export function createAroVsInteractionHandler({ rank = rankArosAgainst, render = renderAroCounterImages, logger = console } = {}) {
  return async function handleAroVs(interaction) {
    if (!interaction?.isChatInputCommand?.() || interaction.commandName !== ARO_VS_COMMAND) return false
    try {
      await interaction.deferReply()
      const target = interaction.options.getString(TARGET_OPTION, true).trim()
      const army = interaction.options.getString(ARMY_OPTION)
      const range = interaction.options.getString(RANGE_OPTION) || 'all'
      const result = await rank({ target, army, range })
      const images = await render({ result })
      await interaction.editReply({ content: `**ARO Counter · ${shortName(result.target.name)}**`, files: images.map((image) => ({ attachment: image.imageBuffer, name: image.name })), allowedMentions: { parse: [] } })
    } catch (error) {
      logger.error?.('ARO comparison request failed:', error)
      const message = { content: error?.code === 'target_not_found' ? error.message : 'The ARO comparison engine is temporarily unavailable.' }
      try { if (interaction.deferred || interaction.replied) await interaction.editReply(message); else await interaction.reply({ ...message, ephemeral: true }) } catch {}
    }
    return true
  }
}

export function createAroCounterAutocompleteHandler({ search = searchTargetProfiles, logger = console } = {}) {
  return async function handleAroCounterAutocomplete(interaction) {
    if (!interaction?.isAutocomplete?.() || interaction.commandName !== ARO_VS_COMMAND) return false
    try {
      const focused = interaction.options.getFocused(true)
      await interaction.respond(focused.name === ARMY_OPTION ? await searchArmies(focused.value) : await search(focused.value))
    } catch (error) {
      logger.error?.('ARO counter autocomplete failed:', error)
      try { await interaction.respond([]) } catch {}
    }
    return true
  }
}

export async function searchTargetProfiles(query) {
  const source = await loadCombatSource()
  const needle = normalize(query)
  const seen = new Set()
  return source.profiles
    .filter((profile) => profile.weapons?.some((weapon) => weapon.modes?.length) && (!needle || normalize(profile.name).includes(needle)))
    .map((profile) => ({ name: `${profile.name} · ${profile.weapons.map((weapon) => weapon.name).join(', ')}`.slice(0, 100), value: profile.id }))
    .filter((choice) => !seen.has(choice.name) && seen.add(choice.name))
    .slice(0, 25)
}

export async function searchArmies(query) {
  const source = await loadCombatSource()
  const needle = normalize(query)
  return source.factions
    .filter((army) => COUNTER_ARMY_IDS.has(Number(army.id)))
    .filter((army) => !needle || normalize(army.name).includes(needle))
    .map((army) => ({ name: `${army.name} · ${Number(army.parent) === Number(army.id) ? 'Vanilla faction' : 'Sectorial'}`.slice(0, 100), value: String(army.id) }))
    .slice(0, 25)
}

export function formatAroVsDiscordResponse(result) {
  const rangeLabel = result.range === 'all' ? 'all standard ranges' : `${result.range}″`
  const fields = result.results.map((entry, index) => {
    const rows = entry.bands.map((band) => `${band.range.padEnd(6)} ${band.reactiveWin.toFixed(1).padStart(5)}%  ${band.meaningfulEffect.toFixed(1).padStart(5)}%  ${band.survival.toFixed(1).padStart(5)}%`).join('\n')
    return {
      name: `#${index + 1}  ${shortName(entry.name)}${entry.state === 'fireteam' ? '  •  Fireteam +1SD' : ''}`.slice(0, 256),
      value: `**${cleanWeaponName(entry.weapon)}**\n\`\`\`Range    F2F   Effect  Survive\n${rows}\`\`\``.slice(0, 1024),
      inline: false,
    }
  })
  const pages = chunk(fields, 5)
  return {
    embeds: pages.map((page, index) => ({
      title: `ARO Counter  •  ${shortName(result.target.name)}${pages.length > 1 ? `  (${index * 5 + 1}–${Math.min((index + 1) * 5, fields.length)})` : ''}`,
      description: index === 0 ? `**Top 10 counters at ${rangeLabel}**\nF2F = win the Face-to-Face roll · Effect = Wound/STR or meaningful state · Survive = remains on table` : undefined,
      color: 0x00b8e6,
      fields: page.length ? page : [{ name: 'Best responses', value: 'No legal direct AROs found.' }],
      footer: { text: 'Direct Template Weapons excluded • +1SD requires the legal Fireteam condition' },
    })),
    allowedMentions: { parse: [] },
  }
}

async function loadCombatSource() {
  combatSourcePromise ||= readArtifact(resolve(import.meta.dirname, '..', 'data', 'infinity-army', 'benchmark-official-source.json.gz.b64')).then((capture) => ({ ...buildOfficialCombatSource(capture), factions: capture.metadata.factions || [] }))
  return combatSourcePromise
}

function resolveTarget(profiles, query) {
  const exactId = profiles.find((profile) => profile.id === String(query || '').trim())
  if (exactId) return exactId
  const normalized = normalize(query)
  const matches = profiles.filter((profile) => normalize(profile.name).includes(normalized) && profile.weapons?.some((weapon) => weapon.modes?.length))
  if (!matches.length) {
    const error = new Error(`I couldn't find a combat profile matching “${query}”. Try a more specific profile name.`)
    error.code = 'target_not_found'
    throw error
  }
  const distinctLoadouts = new Set(matches.map((profile) => profile.weapons.map((weapon) => weapon.name).join('|')))
  if (distinctLoadouts.size > 1) {
    const error = new Error(`“${query}” has multiple loadouts. Start typing the name and select the exact profile from Discord’s autocomplete list.`)
    error.code = 'target_not_found'
    throw error
  }
  return matches.sort((a, b) => Number(b.bs || 0) - Number(a.bs || 0) || a.name.localeCompare(b.name))[0]
}

function uniqueAroCandidates(profiles) {
  const unique = new Map()
  for (const profile of profiles) {
    if (!profile.weapons?.some((weapon) => weapon.modes?.some((mode) => !mode.deployable && !mode.smoke && !mode.eclipse && mode.attackType !== 'direct-template'))) continue
    const key = JSON.stringify({ bs: profile.bs, wip: profile.wip, ph: profile.ph, arm: profile.arm, bts: profile.bts, vitality: profile.vitality, structure: profile.structure, troopType: profile.troopType, skills: profile.skills, equipment: profile.equipment, weapons: profile.weapons, fireteamCapable: profile.fireteamCapable })
    if (!unique.has(key)) unique.set(key, profile)
  }
  return [...unique.values()]
}

function resolveArmy(factions, query) {
  const text = String(query || '').trim()
  const exactId = factions.find((army) => COUNTER_ARMY_IDS.has(Number(army.id)) && Number(army.id) === Number(text))
  if (exactId) return exactId
  const matches = factions.filter((army) => COUNTER_ARMY_IDS.has(Number(army.id)) && normalize(army.name) === normalize(text))
  if (matches.length === 1) return matches[0]
  const error = new Error(`I couldn't identify the Army “${query}”. Start typing it and select an autocomplete option.`)
  error.code = 'army_not_found'
  throw error
}

function belongsToArmy(profile, army) { return Number(profile.sectorialId) === Number(army.id) }

function scoreState(state, range) {
  const matchups = selectMatchups(state, range)
  return matchups.reduce((sum, matchup) => sum + Number(matchup.selected?.optimalResponse?.defenderScore || 0), 0) / Math.max(1, matchups.length)
}

function formatRow({ profile, state }, range) {
  const matchups = selectMatchups(state, range)
  const bands = matchups.map((matchup) => ({
    range: matchup.range,
    reactiveWin: Number(matchup.selected?.optimalResponse?.roll?.reactiveWin || 0),
    meaningfulEffect: 100 * Number(matchup.selected?.optimalResponse?.returnEffect?.meaningfulEffectProbability || 0),
    survival: 100 * (1 - Number(matchup.selected?.optimalResponse?.effect?.neutralizeProbability || 0)),
  }))
  const response = [...matchups].sort((a, b) => Number(b.selected?.optimalResponse?.defenderScore || 0) - Number(a.selected?.optimalResponse?.defenderScore || 0))[0]?.selected?.optimalResponse
  return { name: profile.name, state: state.id, weapon: response?.aro || 'No effective direct ARO', bands }
}

function selectMatchups(state, range) {
  const desired = range === '16-32' ? new Set(['16-24', '24-32']) : range === 'all' ? null : new Set([range])
  return state.matchups.filter((matchup) => !desired || desired.has(matchup.range))
}

function normalize(value) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function shortName(value) { return String(value || '').split('—').at(-1).trim() || String(value || '').trim() }
function cleanWeaponName(value) { return String(value || '').replace(/:[^:]+\s*—\s*/, ' · ').replace(/\s*—\s*/g, ' · ') }
function chunk(values, size) { const pages = []; for (let index = 0; index < values.length; index += size) pages.push(values.slice(index, index + size)); return pages }
function matches(command) { return command.description === ARO_VS_COMMAND_DEFINITION.description && command.options?.length === 3 && command.options?.[0]?.name === TARGET_OPTION && command.options?.[0]?.required === true && command.options?.[0]?.autocomplete === true && command.options?.[1]?.name === ARMY_OPTION && command.options?.[1]?.autocomplete === true && command.options?.[2]?.name === RANGE_OPTION }
