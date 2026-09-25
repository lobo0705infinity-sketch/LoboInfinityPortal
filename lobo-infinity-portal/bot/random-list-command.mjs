import { ApplicationCommandOptionType } from 'discord.js'
import { getCurrentArmySource, searchBuildListFactions } from './build-list-command.mjs'
import { ListBuilderError } from './build-list-generator.mjs'
import { LIVE_ROSTER_UNIT_SLUGS } from './official-army-rosters.mjs'
import { formatRandomArmyList, generateRandomArmyList } from './random-list-generator.mjs'

export const RANDOM_LIST_COMMAND = 'random-list'
export const RANDOM_LIST_COMMAND_DEFINITION = Object.freeze({
  name: RANDOM_LIST_COMMAND,
  description: 'Randomly generate a legal Infinity Army list within your points and SWC limits',
  options: [
    { name: 'faction', description: 'Start typing a faction or sectorial, then select it', required: true,
      type: ApplicationCommandOptionType.String, autocomplete: true },
    { name: 'points', description: 'Maximum army points (100–400)', required: true,
      type: ApplicationCommandOptionType.Integer, minValue: 100, maxValue: 400 },
    { name: 'swc', description: 'Maximum SWC, including half-points (at most points ÷ 50)', required: true,
      type: ApplicationCommandOptionType.Number, minValue: 0, maxValue: 8 },
  ],
})

export async function searchRandomListFactions(query, searchFactions = searchBuildListFactions) {
  const suggestions = await searchFactions(query)
  return suggestions.filter(choice => (LIVE_ROSTER_UNIT_SLUGS.get(Number(choice.value))?.length || 0) > 1)
}

export async function buildRandomListResponse({ faction, points, swc, getSource = getCurrentArmySource,
  generate = generateRandomArmyList } = {}) {
  const source = await getSource(faction)
  const list = generate({ payload: source.payload, metadata: source.metadata,
    sectorialId: Number(source.faction.id), rosterSlugs: LIVE_ROSTER_UNIT_SLUGS.get(Number(source.faction.id)),
    points, swc })
  return formatRandomArmyList(list)
}

export function createRandomListAutocompleteHandler({ searchFaction = searchRandomListFactions, logger = console } = {}) {
  return async interaction => {
    if (!interaction?.isAutocomplete?.() || interaction.commandName !== RANDOM_LIST_COMMAND) return false
    if (interaction.options.getFocused(true).name !== 'faction') return false
    try { await interaction.respond(await searchFaction(interaction.options.getFocused(true).value)) }
    catch (error) {
      logger.error?.('Random list autocomplete failed:', error)
      try { await interaction.respond([]) } catch {}
    }
    return true
  }
}

export function createRandomListInteractionHandler({ build = buildRandomListResponse, logger = console } = {}) {
  return async interaction => {
    if (!interaction?.isChatInputCommand?.() || interaction.commandName !== RANDOM_LIST_COMMAND) return false
    try {
      await interaction.deferReply()
      await interaction.editReply(await build({
        faction: interaction.options.getString('faction', true),
        points: interaction.options.getInteger('points', true),
        swc: interaction.options.getNumber('swc', true),
      }))
    } catch (error) {
      logger.error?.('Random list generation failed:', error)
      const content = error instanceof ListBuilderError ? error.message : 'I could not build a verified random list right now.'
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content })
      else await interaction.reply({ content, ephemeral: true })
    }
    return true
  }
}

export async function ensureRandomListCommand(client) {
  if (!client?.guilds?.cache) return []
  const registered = []
  for (const guild of client.guilds.cache.values()) {
    const commands = await guild.commands.fetch()
    const existing = commands.find(command => command.name === RANDOM_LIST_COMMAND)
    const matches = existing?.description === RANDOM_LIST_COMMAND_DEFINITION.description
      && existing.options?.length === RANDOM_LIST_COMMAND_DEFINITION.options.length
      && existing.options?.every((option, index) => {
        const expected = RANDOM_LIST_COMMAND_DEFINITION.options[index]
        return option.name === expected.name && option.description === expected.description
          && option.type === expected.type && Boolean(option.autocomplete) === Boolean(expected.autocomplete)
          && (option.minValue ?? option.min_value ?? null) === (expected.minValue ?? null)
          && (option.maxValue ?? option.max_value ?? null) === (expected.maxValue ?? null)
      })
    const command = !existing ? await guild.commands.create(RANDOM_LIST_COMMAND_DEFINITION)
      : matches ? existing : await existing.edit(RANDOM_LIST_COMMAND_DEFINITION)
    registered.push({ applicationId: command.applicationId, guildId: guild.id, id: command.id })
  }
  const globals = await client.application.commands.fetch()
  const obsolete = globals.find(command => command.name === RANDOM_LIST_COMMAND)
  if (obsolete) await obsolete.delete()
  return registered
}
