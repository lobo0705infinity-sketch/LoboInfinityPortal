#!/usr/bin/env node
import { loadMobilityCatalog } from './mobility-catalog-store.mjs'
// Railway production deployment: matchup command release 2026-09-21

import { Client, Events, GatewayIntentBits } from 'discord.js'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createInfListInteractionHandler, createInfListMessageHandler, ensureInfListCommand } from './inf-list-command.mjs'
import { createBuildListAutocompleteHandler, createBuildListInteractionHandler, ensureBuildListCommand } from './build-list-command.mjs'
import { createMissionInteractionHandler, ensureMissionCommand } from './mission-command.mjs'
import { createInfIdInteractionHandler, ensureInfIdCommand } from './inf-id-command.mjs'
import { createRulesInteractionHandler, ensureRulesCommand } from './rules-command.mjs'
import { createAroCounterAutocompleteHandler, createAroVsInteractionHandler, ensureAroVsCommand } from './aro-vs-command.mjs'
import { createMatchupAutocompleteHandler, createMatchupInteractionHandler, ensureMatchupCommand } from './matchup-command.mjs'
import {
  createMatchmakingAutocompleteHandler,
  createMatchmakingInteractionHandler,
  ensureMatchmakingCommands,
  startMatchmakingScheduler,
} from './matchmaking-command.mjs'
import { startRulesResourceWatcher } from './rules-resource-watcher.mjs'
import { WORKSHOP_MAP_SOURCE } from './workshop-map-catalog.mjs'
import { loadGunfighterBenchmarkCatalog } from './gunfighter-catalog-store.mjs'
import { loadAroBenchmarkCatalog } from './aro-catalog-store.mjs'
import { loadCloseCombatCatalog } from './close-combat-catalog-store.mjs'

export const BOT_NAME = "Lobo's Little Helper"
export const DISCORD_TOKEN_ENV = 'DISCORD_BOT_TOKEN'
export const REQUIRED_INTENTS = Object.freeze([
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
])

export function mapAnnouncementMarker(item) {
  return `tts-map:${String(item?.id || '').trim()}:${String(item?.contentSignature || '').slice(0, 16)}`
}

export function workshopAnnouncementMarker(item) {
  return `steam-workshop:${String(item?.id || '').trim()}:${Number(item?.updatedAt)}`
}

async function recentBotMessages(channel, botUserId) {
  try {
    const recent = await channel.messages.fetch({ limit: 100 })
    return [...recent.values()].filter((message) => message.author?.id === botUserId)
  } catch {
    return []
  }
}

export async function filterUnannouncedMapChanges(channel, mapChanges = [], botUserId = '') {
  if (!mapChanges.length) return []
  const messages = await recentBotMessages(channel, botUserId)
  return mapChanges.filter(({ item }) => {
    const marker = mapAnnouncementMarker(item)
    return !messages.some((message) => String(message.content || '').includes(marker))
  })
}

export async function filterUnannouncedWorkshopChanges(channel, workshops = [], botUserId = '') {
  if (!workshops.length) return []
  const messages = await recentBotMessages(channel, botUserId)
  return workshops.filter((item) => {
    const marker = workshopAnnouncementMarker(item)
    return !messages.some((message) => String(message.content || '').includes(marker))
  })
}

export function formatMapAnnouncement({ item, kind = 'added' }) {
  const createdAt = Math.floor(Date.parse(item.createdAt) / 1000)
  if (item.source === WORKSHOP_MAP_SOURCE) {
    const headline = kind === 'updated' ? 'Lobo Workshop Map Updated' : 'New Lobo Workshop Map'
    const timing = Number.isFinite(createdAt) ? ` · Workshop updated <t:${createdAt}:R>` : ''
    const preview = item.previewUrl ? ` · [Workshop preview](${item.previewUrl})` : ''
    return [
      `**${headline}**`,
      `## [${item.name}](${item.pageUrl})`,
      `${Number(item.objectCount || 0).toLocaleString('en-US')} table objects${timing}`,
      `[Open Lobo's Infinity Maps workshop](${item.pageUrl})${preview}`,
      `-# ${mapAnnouncementMarker(item)}`,
    ].join('\n')
  }
  const headline = kind === 'updated' ? 'Infinity TTS Map Updated' : 'New Infinity TTS Map'
  const timing = Number.isFinite(createdAt) ? ` · added <t:${createdAt}:R>` : ''
  const preview = item.images?.[0] ? ` · [Preview image](${item.images[0]})` : ''
  const imageCount = Number(item.images?.length || 0)
  return [
    `**${headline}**`,
    `## [${item.name}](${item.pageUrl})`,
    `${imageCount} preview image${imageCount === 1 ? '' : 's'}${timing}`,
    `[Download TTS JSON](${item.jsonUrl})${preview}`,
    `-# ${mapAnnouncementMarker(item)}`,
  ].join('\n')
}

export function formatWorkshopAnnouncement(item) {
  const updatedAt = Number(item.updatedAt)
  return [
    '**Infinity TTS Workshop Updated**',
    `## [${item.title}](${item.url})`,
    `Published update <t:${updatedAt}:R>`,
    `-# ${workshopAnnouncementMarker(item)}`,
  ].join('\n')
}

export function createLobosLittleHelper() {
  const client = new Client({ intents: REQUIRED_INTENTS })
  client.setMaxListeners(12)
  const handleMessage = createInfListMessageHandler()
  const handleInfList = createInfListInteractionHandler()
  const handleBuildList = createBuildListInteractionHandler()
  const handleBuildListAutocomplete = createBuildListAutocompleteHandler()
  const handleMission = createMissionInteractionHandler()
  const handleInfId = createInfIdInteractionHandler()
  const handleRules = createRulesInteractionHandler()
  const handleAroVs = createAroVsInteractionHandler()
  const handleAroCounterAutocomplete = createAroCounterAutocompleteHandler()
  const handleMatchup = createMatchupInteractionHandler()
  const handleMatchupAutocomplete = createMatchupAutocompleteHandler()
  const handleMatchmaking = createMatchmakingInteractionHandler()
  const handleMatchmakingAutocomplete = createMatchmakingAutocompleteHandler()
  client.on(Events.MessageCreate, handleMessage)
  client.on(Events.InteractionCreate, handleInfList)
  client.on(Events.InteractionCreate, handleBuildList)
  client.on(Events.InteractionCreate, handleBuildListAutocomplete)
  client.on(Events.InteractionCreate, handleMission)
  client.on(Events.InteractionCreate, handleInfId)
  client.on(Events.InteractionCreate, handleRules)
  client.on(Events.InteractionCreate, handleAroVs)
  client.on(Events.InteractionCreate, handleAroCounterAutocomplete)
  client.on(Events.InteractionCreate, handleMatchup)
  client.on(Events.InteractionCreate, handleMatchupAutocomplete)
  client.on(Events.InteractionCreate, handleMatchmaking)
  client.on(Events.InteractionCreate, handleMatchmakingAutocomplete)
  client.on(Events.Error, () => {
    process.stderr.write(`${BOT_NAME} encountered a Discord client error.\n`)
  })
  return client
}

export async function startLobosLittleHelper({ token = process.env[DISCORD_TOKEN_ENV] } = {}) {
  if (!token) throw new Error(`${DISCORD_TOKEN_ENV} is required to connect ${BOT_NAME}.`)
  const gunfighterCatalog = await loadGunfighterBenchmarkCatalog()
  if (!gunfighterCatalog) throw new Error('The bundled gunfighter benchmark catalog could not be loaded.')
  const aroCatalog = await loadAroBenchmarkCatalog()
  if (!aroCatalog) throw new Error('The bundled ARO benchmark catalog could not be loaded.')
  const mobilityCatalog = await loadMobilityCatalog()
  const closeCombatCatalog = await loadCloseCombatCatalog()
  if (!closeCombatCatalog) throw new Error('The bundled close-combat benchmark catalog could not be loaded.')
  const client = createLobosLittleHelper()
  await client.login(token)
  try {
    const commands = await ensureMissionCommand(client)
    const infListCommands = await ensureInfListCommand(client)
    const buildListCommands = await ensureBuildListCommand(client)
    const infIdCommands = await ensureInfIdCommand(client)
    const rulesCommands = await ensureRulesCommand(client)
    const aroVsCommands = await ensureAroVsCommand(client)
    const matchupCommands = await ensureMatchupCommand(client)
    const matchmakingCommands = await ensureMatchmakingCommands(client)
    const guildIds = [...client.guilds.cache.keys()]
    process.stdout.write(`${BOT_NAME} ready: botUserId=${client.user.id} applicationId=${client.application.id} guildIds=${guildIds.join(',') || 'none'} interactionListeners=${client.listenerCount(Events.InteractionCreate)} missionCommands=${commands.map((command) => `${command.guildId}:${command.id}`).join(',') || 'none'} infListCommands=${infListCommands.map((command) => `${command.guildId}:${command.id}`).join(',') || 'none'} buildListCommands=${buildListCommands.map((command) => `${command.guildId}:${command.id}`).join(',') || 'none'} infIdCommands=${infIdCommands.map((command) => `${command.guildId}:${command.id}`).join(',') || 'none'} rulesCommands=${rulesCommands.map((command) => `${command.guildId}:${command.id}`).join(',') || 'none'} aroVsCommands=${aroVsCommands.map((command) => `${command.guildId}:${command.id}`).join(',') || 'none'} matchupCommands=${matchupCommands.map((command) => `${command.guildId}:${command.id}`).join(',') || 'none'} matchmakingCommands=${matchmakingCommands.map((command) => `${command.guildId}:${command.name}:${command.id}`).join(',') || 'none'} gunfighterBenchmark=${gunfighterCatalog.benchmarkVersion || 'unknown'} gunfighterCatalog=${gunfighterCatalog.fingerprint || 'unknown'} aroBenchmark=${aroCatalog.benchmarkVersion || 'unknown'} aroCatalog=${aroCatalog.fingerprint || 'unknown'} mobilityCatalog=${mobilityCatalog?.fingerprint || 'unavailable'} closeCombatBenchmark=${closeCombatCatalog.benchmarkVersion || 'unknown'} closeCombatCatalog=${closeCombatCatalog.fingerprint || 'unknown'}\n`)
  } catch {
    process.stderr.write(`${BOT_NAME} could not register slash commands.\n`)
  }
  startRulesResourceWatcher({
    logger: console,
    onChange: async ({ changes }) => {
      const channelId = String(process.env.INFINITY_RESOURCES_CHANNEL_ID || '').trim()
      const channelName = String(process.env.INFINITY_RESOURCES_CHANNEL_NAME || 'tts-map-submissions').trim()
      const channel = channelId
        ? await client.channels.fetch(channelId)
        : [...client.channels.cache.values()].find((candidate) => candidate?.isTextBased?.() && candidate.name === channelName)
      if (!channel?.isTextBased?.()) throw new Error(`Infinity resources announcement channel was not found: ${channelId || `#${channelName}`}`)
      const mapChanges = [
        ...changes.added.map((item) => ({ kind: 'added', item })),
        ...changes.updated.map((item) => ({ kind: 'updated', item })),
        ...(changes.workshopMaps?.added || []).map((item) => ({ kind: 'added', item })),
        ...(changes.workshopMaps?.updated || []).map((item) => ({ kind: 'updated', item })),
      ]
      const unannouncedMaps = await filterUnannouncedMapChanges(channel, mapChanges, client.user.id)
      const changedWorkshopIds = new Set(mapChanges
        .map(({ item }) => String(item.workshopId || ''))
        .filter(Boolean))
      const genericWorkshopChanges = (changes.workshops || [])
        .filter((item) => !changedWorkshopIds.has(String(item.id)))
      const unannouncedWorkshops = await filterUnannouncedWorkshopChanges(channel, genericWorkshopChanges, client.user.id)
      for (const change of unannouncedMaps.slice(0, 10)) {
        await channel.send(formatMapAnnouncement(change))
      }
      for (const workshop of unannouncedWorkshops.slice(0, 10)) {
        await channel.send(formatWorkshopAnnouncement(workshop))
      }
    },
  })
  startMatchmakingScheduler(client, { logger: console })
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

const INF_LIST_DESCRIPTION = 'ready for !!inf-list, /inf-list, /mission, /inf-id, /rules, /aro-counter, /matchup, /availability, and /find-game (not connected in dry-run mode)'

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await run()
}
