import { ApplicationCommandOptionType } from 'discord.js'
import { resolve } from 'node:path'
import { readArtifact } from '../scripts/benchmark-artifacts.mjs'
import { buildOfficialCombatSource } from './official-combat-source.mjs'
import { evaluateGunfighterProfile } from './gunfighter-rating.mjs'
import { renderMatchupImages } from './matchup-renderer.mjs'

export const MATCHUP_COMMAND = 'matchup'
export const MODEL_ONE_OPTION = 'model-1'
export const MODEL_TWO_OPTION = 'model-2'
export const MATCHUP_COMMAND_DEFINITION = Object.freeze({
  name: MATCHUP_COMMAND,
  description: 'Compare two exact profiles in both attack directions',
  options: [
    { name: MODEL_ONE_OPTION, description: 'Start typing and select the exact first profile', required: true, type: ApplicationCommandOptionType.String, autocomplete: true },
    { name: MODEL_TWO_OPTION, description: 'Start typing and select the exact second profile', required: true, type: ApplicationCommandOptionType.String, autocomplete: true },
  ],
})

let combatSourcePromise = null

export async function ensureMatchupCommand(client) {
  if (!client?.guilds?.cache) return []
  const registered = []
  for (const guild of client.guilds.cache.values()) {
    const commands = await guild.commands.fetch()
    let command = commands.find((candidate) => candidate.name === MATCHUP_COMMAND)
    if (!command) command = await guild.commands.create(MATCHUP_COMMAND_DEFINITION)
    else if (!matches(command)) command = await command.edit(MATCHUP_COMMAND_DEFINITION)
    registered.push({ applicationId: command.applicationId, guildId: guild.id, id: command.id })
  }
  const global = await client.application.commands.fetch()
  const obsolete = global.find((command) => command.name === MATCHUP_COMMAND)
  if (obsolete) await obsolete.delete()
  return registered
}

export async function compareMatchup({ modelOne, modelTwo } = {}) {
  const source = await loadCombatSource()
  const first = resolveProfile(source.profiles, modelOne)
  const second = resolveProfile(source.profiles, modelTwo)
  return { first, second, directions: [evaluateDirection(first, second), evaluateDirection(second, first)] }
}

export function createMatchupInteractionHandler({ compare = compareMatchup, render = renderMatchupImages, logger = console } = {}) {
  return async function handleMatchup(interaction) {
    if (!interaction?.isChatInputCommand?.() || interaction.commandName !== MATCHUP_COMMAND) return false
    try {
      await interaction.deferReply()
      const result = await compare({
        modelOne: interaction.options.getString(MODEL_ONE_OPTION, true).trim(),
        modelTwo: interaction.options.getString(MODEL_TWO_OPTION, true).trim(),
      })
      const images = await render({ result })
      await interaction.editReply({ content: `**Matchup · ${shortName(result.first.name)} vs ${shortName(result.second.name)}**`, files: images.map((image) => ({ attachment: image.imageBuffer, name: image.name })), allowedMentions: { parse: [] } })
    } catch (error) {
      logger.error?.('Matchup request failed:', error)
      const message = { content: error?.code === 'profile_not_found' ? error.message : 'The matchup engine is temporarily unavailable.' }
      try { if (interaction.deferred || interaction.replied) await interaction.editReply(message); else await interaction.reply({ ...message, ephemeral: true }) } catch {}
    }
    return true
  }
}

export function createMatchupAutocompleteHandler({ search = searchMatchupProfiles, logger = console } = {}) {
  return async function handleMatchupAutocomplete(interaction) {
    if (!interaction?.isAutocomplete?.() || interaction.commandName !== MATCHUP_COMMAND) return false
    try { await interaction.respond(await search(interaction.options.getFocused(true).value)) }
    catch (error) { logger.error?.('Matchup autocomplete failed:', error); try { await interaction.respond([]) } catch {} }
    return true
  }
}

export async function searchMatchupProfiles(query) {
  const source = await loadCombatSource()
  const needle = normalize(query)
  const seen = new Set()
  return source.profiles
    .filter((profile) => profile.weapons?.some((weapon) => weapon.modes?.length) && (!needle || normalize(profile.name).includes(needle)))
    .map((profile) => ({ name: `${profile.name} · ${profile.weapons.map((weapon) => weapon.name).join(', ')}`.slice(0, 100), value: profile.id }))
    .filter((choice) => !seen.has(choice.name) && seen.add(choice.name))
    .slice(0, 25)
}

function evaluateDirection(attacker, defender) {
  const state = evaluateGunfighterProfile(attacker, [defender]).states.find((entry) => entry.id === 'normal')
  return {
    attacker,
    defender,
    bands: state.matchups.map((matchup) => {
      const selected = [...matchup.candidates].filter((entry) => entry.status === 'evaluated').sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || String(a.weapon).localeCompare(String(b.weapon)))[0]
      const effect = selected?.optimalResponse?.effect
      const distribution = effect?.woundDistribution || []
      return {
        range: matchup.range,
        weapon: selected ? `${selected.weapon}${selected.mode ? ` (${selected.mode})` : ''}` : 'No legal attack',
        f2fWin: Number(selected?.optimalResponse?.roll?.activeWin || 0),
        oneWound: 100 * Number(distribution[1] || 0),
        twoWounds: 100 * Number(distribution[2] || 0),
        threePlusWounds: 100 * distribution.slice(3).reduce((sum, probability) => sum + Number(probability || 0), 0),
        defenderSurvival: 100 * (1 - Number(effect?.neutralizeProbability || 0)),
      }
    }),
  }
}

async function loadCombatSource() {
  combatSourcePromise ||= readArtifact(resolve(import.meta.dirname, '..', 'data', 'infinity-army', 'benchmark-official-source.json.gz.b64')).then(buildOfficialCombatSource)
  return combatSourcePromise
}

function resolveProfile(profiles, query) {
  const exact = profiles.find((profile) => profile.id === String(query || '').trim())
  if (exact) return exact
  const text = String(query || '').trim()
  const matches = profiles.filter((profile) => normalize(profile.name) === normalize(text) && profile.weapons?.some((weapon) => weapon.modes?.length))
  if (matches.length === 1) return matches[0]
  const error = new Error(`I couldn't identify “${text}”. Start typing and select an exact profile from Discord’s autocomplete list.`)
  error.code = 'profile_not_found'
  throw error
}

function shortName(value) { return String(value || '').split('—').at(-1).trim() || String(value || '').trim() }
function normalize(value) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function matches(command) { return command.description === MATCHUP_COMMAND_DEFINITION.description && command.options?.length === 2 && command.options?.every((option) => option.autocomplete === true && option.required === true) }
