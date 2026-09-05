#!/usr/bin/env node

import { Client, Events, GatewayIntentBits } from 'discord.js'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createInfListMessageHandler } from './inf-list-command.mjs'
import { createMissionInteractionHandler, ensureMissionCommand } from './mission-command.mjs'

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
  const handleMission = createMissionInteractionHandler()
  client.on(Events.MessageCreate, handleMessage)
  client.on(Events.InteractionCreate, handleMission)
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
    await ensureMissionCommand(client)
    process.stdout.write(`${BOT_NAME} registered /mission and is ready.\n`)
  } catch {
    process.stderr.write(`${BOT_NAME} could not register /mission.\n`)
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

const INF_LIST_DESCRIPTION = 'ready for !!inf-list and /mission (not connected in dry-run mode)'

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await run()
}
