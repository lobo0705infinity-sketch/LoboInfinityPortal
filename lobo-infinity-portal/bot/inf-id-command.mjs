import { ApplicationCommandOptionType } from 'discord.js'
import { cleanupInfId, generateInfId, InfIdError } from './inf-id-service.mjs'
import { createConcurrencyLimiter } from './inf-list-command.mjs'

export const INF_ID_COMMAND = 'inf-id'
export const INF_ID_OPTION = 'army-code'
export const INF_ID_COMMAND_DEFINITION = Object.freeze({
  name: INF_ID_COMMAND,
  description: 'Create a printable miniature identification sheet from an Infinity Army list',
  options: [{ name: INF_ID_OPTION, description: 'Infinity Army code', required: true, type: ApplicationCommandOptionType.String }],
})
const maxAttachmentBytes = 25 * 1024 * 1024

export async function ensureInfIdCommand(client) {
  if (!client?.guilds?.cache) return []
  const registered = []
  for (const guild of client.guilds.cache.values()) {
    const commands = await guild.commands.fetch()
    let command = commands.find((candidate) => candidate.name === INF_ID_COMMAND)
    if (!command) command = await guild.commands.create(INF_ID_COMMAND_DEFINITION)
    else if (!matches(command)) command = await command.edit(INF_ID_COMMAND_DEFINITION)
    registered.push({ applicationId: command.applicationId, guildId: guild.id, id: command.id })
  }
  const globals = await client.application.commands.fetch()
  const obsolete = globals.find((command) => command.name === INF_ID_COMMAND)
  if (obsolete) await obsolete.delete()
  return registered
}

export function createInfIdInteractionHandler({ generate = generateInfId, cleanup = cleanupInfId, withRenderSlot = createConcurrencyLimiter(2), logger = console } = {}) {
  return async function handleInfId(interaction) {
    if (!interaction?.isChatInputCommand?.() || interaction.commandName !== INF_ID_COMMAND) return false
    let result
    try {
      await interaction.deferReply()
      const input = interaction.options.getString(INF_ID_OPTION, true).trim()
      result = await withRenderSlot(() => generate({ input }))
      const files = [...result.pages.map((page) => ({ attachment: page.buffer, name: page.name })), { attachment: result.pdf.buffer, name: result.pdf.name }]
      const accepted = files.filter((file) => file.attachment.length <= maxAttachmentBytes)
      const omittedPdf = !accepted.some((file) => file.name.endsWith('.pdf'))
      const missing = result.missingImageCount ? ` ${result.missingImageCount} model${result.missingImageCount === 1 ? ' does not' : 's do not'} yet have a verified miniature image.` : ''
      await interaction.editReply({ content: `Miniature identification sheet generated.${missing}${omittedPdf ? ' The printable PDF exceeded the attachment limit; PNG pages are attached.' : ''}`, files: accepted })
    } catch (error) {
      logger.error?.('Infinity identification sheet request failed:', error)
      const message = error instanceof InfIdError && ['invalid_army_code', 'decode_failed', 'empty_roster'].includes(error.code)
        ? "That doesn't look like a valid Infinity Army code."
        : "I couldn't generate that miniature identification sheet right now."
      try { if (interaction.deferred || interaction.replied) await interaction.editReply(message); else await interaction.reply({ content: message, ephemeral: true }) } catch (replyError) { logger.error?.('Infinity identification sheet error response failed:', replyError) }
    } finally {
      try { await cleanup(result) } catch (error) { logger.error?.('Infinity identification sheet cleanup failed:', error) }
    }
    return true
  }
}

function matches(command) {
  const option = command.options?.[0]
  return command.description === INF_ID_COMMAND_DEFINITION.description && command.options?.length === 1 && option?.name === INF_ID_OPTION && option?.required === true && option?.type === ApplicationCommandOptionType.String
}
