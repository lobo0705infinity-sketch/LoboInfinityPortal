import { ApplicationCommandOptionType } from 'discord.js'
import { getMissionScenario, MissionGeistError } from '../scripts/missiongeist-scenarios.mjs'
import { createConcurrencyLimiter } from './inf-list-command.mjs'

export const MISSION_COMMAND = 'mission'
export const MISSION_OPTION = 'scenario'
export const MISSION_COMMAND_DEFINITION = Object.freeze({
  name: MISSION_COMMAND,
  description: 'Retrieve an Infinity scenario from MissionGeist',
  options: [{
    name: MISSION_OPTION,
    description: 'Scenario name, such as Supplies or Highly Classified',
    required: true,
    type: ApplicationCommandOptionType.String,
  }],
})

export async function ensureMissionCommand(client) {
  if (!client?.application?.commands) return false
  const commands = await client.application.commands.fetch()
  const existing = commands.find((command) => command.name === MISSION_COMMAND)
  if (!existing) await client.application.commands.create(MISSION_COMMAND_DEFINITION)
  else if (existing.description !== MISSION_COMMAND_DEFINITION.description
    || existing.options?.length !== MISSION_COMMAND_DEFINITION.options.length
    || existing.options?.[0]?.name !== MISSION_OPTION
    || existing.options?.[0]?.required !== true) {
    await existing.edit(MISSION_COMMAND_DEFINITION)
  }
  return true
}

export function createMissionInteractionHandler({
  retrieve = getMissionScenario,
  withCaptureSlot = createConcurrencyLimiter(2),
  logger = console,
} = {}) {
  return async function handleMissionInteraction(interaction) {
    if (!interaction?.isChatInputCommand?.() || interaction.commandName !== MISSION_COMMAND) return false
    const query = interaction.options.getString(MISSION_OPTION, true).trim()
    await interaction.deferReply()
    try {
      const result = await withCaptureSlot(() => retrieve({ query }))
      if (result.kind === 'ambiguous') {
        await interaction.editReply(ambiguousMessage(result))
        return true
      }
      if (result.kind === 'missing' || result.kind === 'not_found') {
        await interaction.editReply(`I couldn't find a MissionGeist scenario matching '${query}'.`)
        return true
      }
      await sendMissionResult(interaction, result)
    } catch (error) {
      logger.error?.('MissionGeist request failed:', error)
      const link = error instanceof MissionGeistError && error.canonicalUrl
        ? `\n\nMissionGeist:\n${error.canonicalUrl}`
        : ''
      const message = error instanceof MissionGeistError && error.code === 'catalog_unavailable'
        ? 'MissionGeist could not be reached right now.'
        : "I found the MissionGeist page, but couldn't generate the scenario images."
      await interaction.editReply(`${message}${link}`)
    }
    return true
  }
}

async function sendMissionResult(interaction, result) {
  const slug = filenameSlug(result.mission.name)
  const files = result.segments.map((segment, index) => ({
    attachment: segment.imageBuffer,
    name: result.segments.length === 1
      ? `${slug}.png`
      : `${slug}-${String(index + 1).padStart(2, '0')}.png`,
  }))
  const content = `${result.mission.name.toUpperCase()}\n\nMissionGeist:\n${result.mission.canonicalUrl}\n\nScenario attached below.`
  const batches = chunk(files, 10)
  await interaction.editReply({ content, files: batches.shift() || [] })
  for (const batch of batches) await interaction.followUp({ files: batch })
}

function ambiguousMessage(result) {
  const matches = result.matches.map((mission) => `• ${mission.sourceCollectionName} — ${mission.name}`).join('\n')
  return `I found multiple possible missions:\n\n${matches}\n\nPlease specify the mission you want.`
}

function filenameSlug(name) {
  return normalizeAscii(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mission'
}

function normalizeAscii(value) {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function chunk(items, size) {
  const output = []
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size))
  return output
}
