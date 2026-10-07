import { ApplicationCommandOptionType as Type, PermissionFlagsBits } from 'discord.js'
import { INF_LIST_COMMAND_DEFINITION } from './inf-list-command.mjs'
import { BUILD_LIST_COMMAND_DEFINITION } from './build-list-command.mjs'
import { RANDOM_LIST_COMMAND_DEFINITION } from './random-list-command.mjs'
import { INF_ID_COMMAND_DEFINITION } from './inf-id-command.mjs'
import { MATCHUP_COMMAND_DEFINITION } from './matchup-command.mjs'
import { ARO_VS_COMMAND_DEFINITION } from './aro-vs-command.mjs'
import { AVAILABILITY_COMMAND_DEFINITION, FIND_GAME_COMMAND_DEFINITION } from './matchmaking-command.mjs'

const subcommand = (name, definition) => ({ name, description: definition.description, type: Type.Subcommand, options: structuredClone(definition.options || []) })
const group = (name, definition) => ({ name, description: definition.description, type: Type.SubcommandGroup, options: structuredClone(definition.options || []) })
export const GROUPED_COMMAND_DEFINITIONS = Object.freeze([
  { name: 'list', description: 'Analyse, build, randomize or identify an Infinity army', options: [
    subcommand('analyse', INF_LIST_COMMAND_DEFINITION), subcommand('build', BUILD_LIST_COMMAND_DEFINITION),
    subcommand('random', RANDOM_LIST_COMMAND_DEFINITION), subcommand('identify', INF_ID_COMMAND_DEFINITION),
  ] },
  { name: 'combat', description: 'Compare profiles or find ARO counters', options: [
    subcommand('matchup', MATCHUP_COMMAND_DEFINITION), subcommand('counters', ARO_VS_COMMAND_DEFINITION),
  ] },
  { name: 'play', description: 'Manage availability and find an Infinity game', options: [
    group('availability', AVAILABILITY_COMMAND_DEFINITION), group('find', FIND_GAME_COMMAND_DEFINITION),
  ] },
  { name: 'help', description: 'Browse Lobo’s Little Helper commands and examples' },
  { name: 'admin', description: 'Server manager tools for Lobo’s Little Helper', defaultMemberPermissions: PermissionFlagsBits.ManageGuild.toString(), options: [
    { name: 'reports', description: 'Privately review recent incorrect-answer reports for this server', type: Type.Subcommand },
  ] },
])
const routes = {
  list: { analyse: 'inf-list', build: 'build-list', random: 'random-list', identify: 'inf-id' },
  combat: { matchup: 'matchup', counters: 'aro-counter' },
  play: { availability: 'availability', find: 'find-game' },
  admin: { reports: 'bot-reports' },
}

export function groupedCommandRoute(interaction) {
  const table = routes[interaction.commandName]
  if (!table || !(interaction.isChatInputCommand?.() || interaction.isAutocomplete?.())) return null
  const key = interaction.commandName === 'play'
    ? interaction.options.getSubcommandGroup(false) : interaction.options.getSubcommand(false)
  return table[key] || null
}

// Methods stay bound to the actual Discord interaction: defer/reply state,
// files, options and webhook tokens behave exactly as on the legacy command.
export function routedInteraction(interaction, commandName) {
  return new Proxy(interaction, { get(target, key) {
    if (key === 'commandName') return commandName
    const value = Reflect.get(target, key, target)
    return typeof value === 'function' ? value.bind(target) : value
  } })
}

export function createGroupedCommandHandler({ handlers, autocompleteHandlers = {}, logger = console }) {
  return async interaction => {
    const alias = groupedCommandRoute(interaction)
    if (!alias) return false
    const handler = (interaction.isAutocomplete?.() ? autocompleteHandlers : handlers)[alias]
    if (!handler) return false
    try { return await handler(routedInteraction(interaction, alias)) }
    catch (error) {
      logger.error?.('Grouped command failed:', error.message)
      try {
        if (interaction.isAutocomplete?.()) await interaction.respond([])
        else if (interaction.deferred || interaction.replied) await interaction.editReply({ content: 'This command could not complete. Please try again.' })
        else await interaction.reply({ content: 'This command could not complete. Please try again.', flags: 64 })
      } catch {}
      return true
    }
  }
}

const manager = interaction => Boolean(interaction.guildId && interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
const topics = {
  lists: {
    title: 'Army Lists',
    description: '**/list analyse** — Army code → readable list, legality, tactical brief, ratings, classifieds and TTS export.\nExample: `/list analyse army-code:<your Army code>`\n\n**/list build** — Faction + mission → three guided list options. Required models are optional.\nExample: `/list build faction:Corregidor mission:Hardlock must-include:Jazz, Iguana`\n\n**/list random** — Faction + points + SWC → a random legal list.\nExample: `/list random faction:TAK points:300 swc:6`\n\n**/list identify** — Army code → printable model identification sheet.\nExample: `/list identify army-code:<your Army code>`\n\nExisting `/inf-list`, `/build-list`, `/random-list`, `/inf-id` and `!!inf-list` still work.',
  },
  combat: {
    title: 'Combat',
    description: '**/combat matchup** — Compare two exact profiles in both attack directions. Start typing and select each loadout from autocomplete.\nExample: `/combat matchup model-1:<profile> model-2:<profile>`\n\n**/combat counters** — Find ARO counters against a target; optionally filter by army and range.\nExample: `/combat counters target:<profile> army:Corregidor range:16–24 inches`\n\nExisting `/matchup` and `/aro-counter` still work.',
  },
  reference: {
    title: 'Game Reference',
    description: '**/rules** — Ask an Infinity rules question.\nExample: `/rules question:How does Mimetism work?`\n\n**/mission** — Look up a mission by scenario name.\nExample: `/mission scenario:Hardlock`\n\nUse **Report incorrect answer** on supported responses to describe an issue and provide a source.',
  },
  play: {
    title: 'Find a Game',
    description: '**/play availability set** — Set a recurring day or weekday bundle in your time zone.\nExample: `/play availability set weekday:Monday start:7 PM end:10 PM timezone:America/New_York`\n\n**/play availability show** — Show your saved availability.\n**/play availability clear** — Remove a day or all days.\n\n**/play find now** — Post a one-off game request. Provide the date, start, end and time zone. Optional choices include format, game size and type of game.\nExample: `/play find now date:2026-10-10 start:7 PM end:10 PM timezone:America/New_York`\n\n**/play find close** — Close your latest open request.\n\nExisting `/availability` and `/find-game` still work.',
  },
  admin: {
    title: 'Server Manager Tools',
    description: '**/admin reports** — Privately download the latest 25 incorrect-answer reports for this server. Requires **Manage Server**.\n\nReports include the command inputs, answer context, reason and source message link. They do not automatically change the bot’s answers.\n\nExisting `/bot-reports` still works. Workshop monitoring runs automatically.',
  },
}
export function helpResponse(topic = 'home', isManager = false) {
  const selected = topics[topic]
  const buttons = [['lists', 'Army Lists'], ['combat', 'Combat'], ['reference', 'Game Reference'], ['play', 'Find a Game'], ...(isManager ? [['admin', 'Server Tools']] : [])]
  const description = selected?.description || 'Choose what you want to do:\n\n**Army Lists** — analyse, build, randomize and identify.\n**Combat** — compare profiles and find counters.\n**Game Reference** — rules questions and missions.\n**Find a Game** — availability and game requests.\n\nGrouped commands and existing commands both work during the transition.'
  return { embeds: [{ title: selected ? `Lobo’s Little Helper · ${selected.title}` : 'Lobo’s Little Helper · Command Guide', description, color: 0x8b6fed }], components: [{ type: 1, components: buttons.map(([id, label]) => ({ type: 2, style: topic === id ? 1 : 2, label, custom_id: `lobo-help:${id}` })) }], allowedMentions: { parse: [] } }
}
export function createHelpInteractionHandler() {
  return async interaction => {
    if (interaction.isChatInputCommand?.() && interaction.commandName === 'help') {
      await interaction.reply({ ...helpResponse('home', manager(interaction)), flags: 64 }); return true
    }
    if (!interaction.isButton?.() || !interaction.customId.startsWith('lobo-help:')) return false
    if (interaction.message?.author?.id !== interaction.client.user.id) return false
    const topic = interaction.customId.slice('lobo-help:'.length)
    if (!topics[topic] || (topic === 'admin' && !manager(interaction))) {
      await interaction.reply({ content: 'This help topic is unavailable for your permissions.', flags: 64 }); return true
    }
    await interaction.update(helpResponse(topic, manager(interaction))); return true
  }
}

// Discord returns camelCase option properties; definitions may contain API
// snake_case. Normalize both for idempotent registration on worker restarts.
function normalizedOptions(options = []) {
  return options.map(option => ({ name: option.name, description: option.description, type: option.type,
    required: Boolean(option.required), autocomplete: Boolean(option.autocomplete),
    choices: (option.choices || []).map(({name,value}) => ({name,value})), options: normalizedOptions(option.options),
    minValue: option.minValue ?? option.min_value ?? null, maxValue: option.maxValue ?? option.max_value ?? null,
    minLength: option.minLength ?? option.min_length ?? null, maxLength: option.maxLength ?? option.max_length ?? null,
  }))
}
export async function ensureGroupedCommands(client) {
  const registered = []
  for (const guild of client.guilds.cache.values()) {
    const commands = await guild.commands.fetch()
    for (const definition of GROUPED_COMMAND_DEFINITIONS) {
      const existing = commands.find(command => command.name === definition.name)
      const permissions = existing?.defaultMemberPermissions?.bitfield?.toString() ?? existing?.defaultMemberPermissions?.toString() ?? null
      const matches = existing?.description === definition.description
        && JSON.stringify(normalizedOptions(existing.options)) === JSON.stringify(normalizedOptions(definition.options))
        && permissions === (definition.defaultMemberPermissions || null)
      const command = !existing ? await guild.commands.create(definition) : matches ? existing : await existing.edit(definition)
      registered.push({ guildId: guild.id, name: definition.name, id: command.id })
    }
  }
  return registered
}
