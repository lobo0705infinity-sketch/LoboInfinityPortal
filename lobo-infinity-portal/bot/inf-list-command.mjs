import { InfListRenderError, renderInfListPng, validateArmyCode } from '../scripts/inf-list-render-poc.mjs'
import { ApplicationCommandOptionType } from 'discord.js'

export const INF_LIST_COMMAND = '!!inf-list'
export const INF_LIST_SLASH_COMMAND = 'inf-list'
export const INF_LIST_OPTION = 'army-code'
export const SUCCESS_TEXT = 'Here is a link to your army list'
export const USAGE_TEXT = 'Usage: !!inf-list <army code>'
export const INF_LIST_COMMAND_DEFINITION = Object.freeze({
  name: INF_LIST_SLASH_COMMAND,
  description: 'Create a readable Infinity Army list',
  options: [{
    name: INF_LIST_OPTION,
    description: 'Infinity Army code',
    required: true,
    type: ApplicationCommandOptionType.String,
    max_length: 4096,
  }],
})

const malformedCodes = new Set([
  'army_code_too_long',
  'invalid_army_code',
  'url_not_allowed',
])
const unavailableRenderer = new Set([
  'classification_unavailable',
  'invalid_render',
  'renderer_invalid_redirect',
  'renderer_timeout',
  'renderer_unavailable',
])

export function parseInfListCommand(content) {
  const match = String(content ?? '').match(/^!!inf-list(?:\s+([\s\S]*))?$/)
  if (!match) return null
  return { armyCode: match[1]?.trim() || '' }
}

export function createConcurrencyLimiter(limit = 2) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Concurrency limit must be a positive integer.')
  let active = 0
  const waiting = []

  async function acquire() {
    if (active < limit) {
      active += 1
      return
    }
    await new Promise((resolve) => waiting.push(resolve))
    active += 1
  }

  function release() {
    active -= 1
    waiting.shift()?.()
  }

  return async function withSlot(task) {
    await acquire()
    try {
      return await task()
    } finally {
      release()
    }
  }
}

const sharedRenderLimiter = createConcurrencyLimiter(2)

export async function createInfListResponse({
  armyCode,
  render = renderInfListPng,
  withRenderSlot = sharedRenderLimiter,
} = {}) {
  const validatedArmyCode = validateArmyCode(armyCode)
  const result = await withRenderSlot(() => render({ input: validatedArmyCode }))
  const files = []
  if (result.readableImageBuffer) {
    files.push({ attachment: result.readableImageBuffer, name: 'infinity-army-list-readable.png' })
  }
  for (const [index, tacticalPage] of (result.tacticalPages || []).entries()) {
    const suffix = result.tacticalPages.length > 1 ? `-${index + 1}` : ''
    files.push({ attachment: tacticalPage.imageBuffer, name: `infinity-army-tactical-brief${suffix}.png` })
  }
  for (const [index, profilePage] of result.profilePages.entries()) {
    files.push({ attachment: profilePage.imageBuffer, name: `infinity-army-profiles-${index + 1}.png` })
  }
  return {
    allowedMentions: { repliedUser: false },
    content: `${SUCCESS_TEXT}\n\n[Open in Infinity Army](${result.officialArmyUrl})`,
    files,
  }
}

export function createInfListMessageHandler({
  render = renderInfListPng,
  withRenderSlot = sharedRenderLimiter,
} = {}) {
  return async function handleInfListMessage(message) {
    if (message?.author?.bot) return false

    const command = parseInfListCommand(message?.content)
    if (!command) return false
    if (!command.armyCode) {
      await message.reply(USAGE_TEXT)
      return true
    }

    try {
      await message.reply(await createInfListResponse({ armyCode: command.armyCode, render, withRenderSlot }))
    } catch (error) {
      await message.reply(messageForError(error))
    }

    return true
  }
}

export function createInfListInteractionHandler({
  render = renderInfListPng,
  withRenderSlot = sharedRenderLimiter,
  logger = console,
} = {}) {
  return async function handleInfListInteraction(interaction) {
    if (!interaction?.isChatInputCommand?.() || interaction.commandName !== INF_LIST_SLASH_COMMAND) return false
    try {
      await interaction.deferReply()
      const armyCode = interaction.options.getString(INF_LIST_OPTION, true)
      await interaction.editReply(await createInfListResponse({ armyCode, render, withRenderSlot }))
    } catch (error) {
      logger.error?.('Infinity Army list slash-command request failed:', error)
      try {
        const response = messageForError(error)
        if (interaction.deferred || interaction.replied) await interaction.editReply(response)
        else await interaction.reply({ content: response, ephemeral: true })
      } catch (replyError) {
        logger.error?.('Infinity Army list slash-command error response failed:', replyError)
      }
    }
    return true
  }
}

export async function ensureInfListCommand(client) {
  if (!client?.guilds?.cache) return []
  const registered = []
  for (const guild of client.guilds.cache.values()) {
    const commands = await guild.commands.fetch()
    let command = commands.find((candidate) => candidate.name === INF_LIST_SLASH_COMMAND)
    if (!command) command = await guild.commands.create(INF_LIST_COMMAND_DEFINITION)
    else if (!slashCommandMatches(command)) command = await command.edit(INF_LIST_COMMAND_DEFINITION)
    registered.push({ applicationId: command.applicationId, guildId: guild.id, id: command.id })
  }
  const globals = await client.application.commands.fetch()
  const obsolete = globals.find((command) => command.name === INF_LIST_SLASH_COMMAND)
  if (obsolete) await obsolete.delete()
  return registered
}

function slashCommandMatches(command) {
  const option = command.options?.[0]
  return command.description === INF_LIST_COMMAND_DEFINITION.description
    && command.options?.length === 1
    && option?.name === INF_LIST_OPTION
    && option?.required === true
    && option?.type === ApplicationCommandOptionType.String
    && option?.maxLength === 4096
}

export function messageForError(error) {
  if (error instanceof InfListRenderError) {
    if (malformedCodes.has(error.code)) return "That doesn't look like a valid Infinity Army code."
    if (error.code === 'renderer_rejected') return 'That Army code could not be rendered.'
    if (unavailableRenderer.has(error.code)) {
      return 'The Army list renderer is temporarily unavailable. Try again shortly.'
    }
  }
  return 'The Army list renderer is temporarily unavailable. Try again shortly.'
}
