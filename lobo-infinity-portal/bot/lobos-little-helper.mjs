#!/usr/bin/env node

import { Client, Events, GatewayIntentBits } from 'discord.js'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createInfListInteractionHandler, createInfListMessageHandler, ensureInfListCommand } from './inf-list-command.mjs'
import { createMissionInteractionHandler, ensureMissionCommand } from './mission-command.mjs'
import { createInfIdInteractionHandler, ensureInfIdCommand } from './inf-id-command.mjs'
import { createRulesInteractionHandler, ensureRulesCommand } from './rules-command.mjs'

export const BOT_NAME = "Lobo's Little Helper"
export const DISCORD_TOKEN_ENV = 'DISCORD_BOT_TOKEN'
export const REQUIRED_INTENTS = Object.freeze([
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
])

export function createLobosLittleHelper() {
  const client = new Client({ intents: REQUIRED_INTENTS })
  const handleMessage = createInfListMessageHandler()
  const handleInfList = createInfListInteractionHandler()
  const handleMission = createMissionInteractionHandler()
  const handleInfId = createInfIdInteractionHandler()
  const handleRules = createRulesInteractionHandler()
  client.on(Events.MessageCreate, handleMessage)
  client.on(Events.InteractionCreate, handleInfList)
  client.on(Events.InteractionCreate, handleMission)
  client.on(Events.InteractionCreate, handleInfId)
  client.on(Events.InteractionCreate, handleRules)
  client.on(Events.Error, () => {
    process.stderr.write(`${BOT_NAME} encountered a Discord client error.\n`)
  })
  return client
}

export async function startLobosLittleHelper({ token = process.env[DISCORD_TOKEN_ENV] } = {}) {
  if (!token) throw new Error(`${DISCORD_TOKEN_ENV} is required to connect ${BOT_NAME}.`)
  const client = createLobosLittleHelper()
  await client.login(token)
  try {
    const commands = await ensureMissionCommand(client)
    const infListCommands = await ensureInfListCommand(client)
    const infIdCommands = await ensureInfIdCommand(client)
    const rulesCommands = await ensureRulesCommand(client)
    const guildIds = [...client.guilds.cache.keys()]
    process.stdout.write(`${BOT_NAME} ready: botUserId=${client.user.id} applicationId=${client.application.id} guildIds=${guildIds.join(',') || 'none'} interactionListeners=${client.listenerCount(Events.InteractionCreate)} missionCommands=${commands.map((command) => `${command.guildId}:${command.id}`).join(',') || 'none'} infListCommands=${infListCommands.map((command) => `${command.guildId}:${command.id}`).join(',') || 'none'} infIdCommands=${infIdCommands.map((command) => `${command.guildId}:${command.id}`).join(',') || 'none'} rulesCommands=${rulesCommands.map((command) => `${command.guildId}:${command.id}`).join(',') || 'none'}\n`)
  } catch {
    process.stderr.write(`${BOT_NAME} could not register slash commands.\n`)
  }
  return client
}

async function run() {
  if (process.argv.includes('--dry-run')) {
    const client = createLobosLittleHelper()
    client.destroy()
    process.stdout.write(`${BOT_NAME}: ${INF_LIST_DESCRIPTION}\n`)
    return
  }
  await startLobosLittleHelper()
}

const INF_LIST_DESCRIPTION = 'ready for !!inf-list, /inf-list, /mission, /inf-id, and /rules (not connected in dry-run mode)'

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await run()
}
