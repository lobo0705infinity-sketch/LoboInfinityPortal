import { randomUUID } from 'node:crypto'
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ThreadAutoArchiveDuration,
} from 'discord.js'
import {
  buildTimeWindow,
  dailyDigestWindow,
  discordTimestamp,
  expandRecurringAvailability,
  matchAvailabilityOccurrences,
  normalizeClockTime,
  normalizeTimeZone,
  supportedTimeZones,
  timeZoneAutocompleteChoices,
} from './matchmaking-time.mjs'

export const AVAILABILITY_COMMAND = 'availability'
export const FIND_GAME_COMMAND = 'find-game'
export const MATCHMAKING_CHANNEL_NAME = 'scheduling-feed'
export const AVAILABILITY_THREAD_NAME = 'availability-records'
export const AVAILABILITY_RECORD_PREFIX = 'availability-record:v1:'
export const FIND_GAME_MARKER_PREFIX = 'find-game:v1:'
export const MATCHMAKING_DIGEST_MARKER_PREFIX = 'matchmaking-digest:v1:'
export const DEFAULT_MATCHMAKING_CHECK_INTERVAL_MS = 5 * 60 * 1000

export const WEEKDAY_CHOICES = Object.freeze([
  { name: 'Monday', value: 'monday' },
  { name: 'Tuesday', value: 'tuesday' },
  { name: 'Wednesday', value: 'wednesday' },
  { name: 'Thursday', value: 'thursday' },
  { name: 'Friday', value: 'friday' },
  { name: 'Saturday', value: 'saturday' },
  { name: 'Sunday', value: 'sunday' },
])

export const FORMAT_CHOICES = Object.freeze([
  { name: 'TTS (default)', value: 'tts' },
  { name: 'In person', value: 'in-person' },
  { name: 'Either', value: 'either' },
])

export const NEED_CHOICES = Object.freeze([
  { name: 'Open play / anything', value: 'open' },
  { name: 'Casual game', value: 'casual' },
  { name: 'I want to learn', value: 'learn' },
  { name: 'I can teach', value: 'teach' },
  { name: 'League game', value: 'league' },
  { name: 'Tournament practice', value: 'tournament' },
  { name: 'Competitive test game', value: 'competitive' },
])

export const AUDIENCE_CHOICES = Object.freeze([
  { name: 'No role ping', value: 'none' },
  { name: 'TTS players', value: 'tts' },
  { name: 'In-person players', value: 'local' },
  { name: 'New-player mentors', value: 'mentors' },
  { name: 'Tournament practice', value: 'tournament' },
  { name: 'League players', value: 'league' },
])

const SET_OPTIONS = Object.freeze([
  { name: 'weekday', description: 'Day in your own time zone', required: true, type: ApplicationCommandOptionType.String, choices: WEEKDAY_CHOICES },
  { name: 'start', description: 'Local start time in 24-hour HH:MM format', required: true, type: ApplicationCommandOptionType.String },
  { name: 'end', description: 'Local end time in 24-hour HH:MM format', required: true, type: ApplicationCommandOptionType.String },
  { name: 'timezone', description: 'Select a common zone or start typing your city or region', required: true, type: ApplicationCommandOptionType.String, autocomplete: true },
  { name: 'format', description: 'How you want to play; defaults to TTS', required: false, type: ApplicationCommandOptionType.String, choices: FORMAT_CHOICES },
  { name: 'points', description: 'Game size; defaults to 300', required: false, type: ApplicationCommandOptionType.Integer, min_value: 1, max_value: 500 },
  { name: 'need', description: 'What kind of game you need', required: false, type: ApplicationCommandOptionType.String, choices: NEED_CHOICES },
  { name: 'note', description: 'Short optional note about what you need', required: false, type: ApplicationCommandOptionType.String, max_length: 300 },
  { name: 'mention-me', description: 'Mention you in that day’s scheduling feed; defaults to yes', required: false, type: ApplicationCommandOptionType.Boolean },
])

export const AVAILABILITY_COMMAND_DEFINITION = Object.freeze({
  name: AVAILABILITY_COMMAND,
  description: 'Set recurring times when you are available for Infinity games',
  options: [
    { name: 'set', description: 'Set or replace one weekday availability window', type: ApplicationCommandOptionType.Subcommand, options: SET_OPTIONS },
    {
      name: 'clear',
      description: 'Remove one weekday or all of your availability',
      type: ApplicationCommandOptionType.Subcommand,
      options: [{
        name: 'weekday',
        description: 'Day to remove',
        required: true,
        type: ApplicationCommandOptionType.String,
        choices: [...WEEKDAY_CHOICES, { name: 'All days', value: 'all' }],
      }],
    },
    { name: 'show', description: 'Show your saved recurring availability', type: ApplicationCommandOptionType.Subcommand },
  ],
})

export const FIND_GAME_COMMAND_DEFINITION = Object.freeze({
  name: FIND_GAME_COMMAND,
  description: 'Post or close an urgent one-off Infinity game request',
  options: [
    {
      name: 'now',
      description: 'Post a one-off request to the scheduling feed',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        { name: 'date', description: 'Date in your time zone (YYYY-MM-DD)', required: true, type: ApplicationCommandOptionType.String },
        { name: 'start', description: 'Local start time in 24-hour HH:MM format', required: true, type: ApplicationCommandOptionType.String },
        { name: 'end', description: 'Local end time in 24-hour HH:MM format', required: true, type: ApplicationCommandOptionType.String },
        { name: 'timezone', description: 'Select a common zone or start typing your city or region', required: true, type: ApplicationCommandOptionType.String, autocomplete: true },
        { name: 'format', description: 'How you want to play; defaults to TTS', required: false, type: ApplicationCommandOptionType.String, choices: FORMAT_CHOICES },
        { name: 'points', description: 'Game size; defaults to 300', required: false, type: ApplicationCommandOptionType.Integer, min_value: 1, max_value: 500 },
        { name: 'need', description: 'What kind of game you need', required: false, type: ApplicationCommandOptionType.String, choices: NEED_CHOICES },
        { name: 'note', description: 'Short optional note about what you need', required: false, type: ApplicationCommandOptionType.String, max_length: 300 },
        { name: 'notify', description: 'Optional approved role to ping', required: false, type: ApplicationCommandOptionType.String, choices: AUDIENCE_CHOICES },
      ],
    },
    { name: 'close', description: 'Close your latest open one-off request', type: ApplicationCommandOptionType.Subcommand },
  ],
})

const FORMAT_LABELS = Object.freeze({ tts: 'TTS', 'in-person': 'In person', either: 'TTS or in person' })
const NEED_LABELS = Object.freeze({
  open: 'Open play / anything',
  casual: 'Casual game',
  learn: 'Learning game',
  teach: 'Teaching game',
  league: 'League game',
  tournament: 'Tournament practice',
  competitive: 'Competitive test game',
})
const AUDIENCE_ROLE_CONFIG = Object.freeze({
  tts: { env: 'INFINITY_MATCHMAKING_TTS_ROLE_ID', names: ['TTS Players', 'TTS Player', 'TTS'] },
  local: { env: 'INFINITY_MATCHMAKING_LOCAL_ROLE_ID', names: ['In-Person Players', 'Local Players', 'Local Player'] },
  mentors: { env: 'INFINITY_MATCHMAKING_MENTOR_ROLE_ID', names: ['New Player Mentors', 'New Player Mentor', 'Mentors'] },
  tournament: { env: 'INFINITY_MATCHMAKING_TOURNAMENT_ROLE_ID', names: ['Tournament Practice', 'Tournament Players'] },
  league: { env: 'INFINITY_MATCHMAKING_LEAGUE_ROLE_ID', names: ['League Players', 'League Player'] },
})

export async function ensureMatchmakingCommands(client) {
  if (!client?.application?.commands || !client?.guilds?.cache) return []
  const definitions = [AVAILABILITY_COMMAND_DEFINITION, FIND_GAME_COMMAND_DEFINITION]
  const registered = []
  for (const guild of client.guilds.cache.values()) {
    const commands = await guild.commands.fetch()
    for (const definition of definitions) {
      let command = commands.find((candidate) => candidate.name === definition.name)
      if (!command) command = await guild.commands.create(definition)
      else if (!commandMatchesDefinition(command, definition)) command = await command.edit(definition)
      registered.push({ applicationId: command.applicationId, guildId: guild.id, id: command.id, name: command.name })
    }
  }
  const globalCommands = await client.application.commands.fetch()
  for (const command of globalCommands.filter((candidate) => definitions.some((definition) => definition.name === candidate.name))) {
    await command.delete()
  }
  return registered
}

export function createMatchmakingAutocompleteHandler({ zones = supportedTimeZones(), logger = console } = {}) {
  return async function handleMatchmakingAutocomplete(interaction) {
    if (!interaction?.isAutocomplete?.() || ![AVAILABILITY_COMMAND, FIND_GAME_COMMAND].includes(interaction.commandName)) return false
    try {
      const focused = interaction.options.getFocused(true)
      if (focused.name !== 'timezone') return false
      await interaction.respond(timeZoneAutocompleteChoices(focused.value, zones))
    } catch (error) {
      logger.error?.('Matchmaking autocomplete failed:', error)
      try { await interaction.respond([]) } catch {}
    }
    return true
  }
}

export function createMatchmakingInteractionHandler({
  resolveChannel = resolveMatchmakingChannel,
  createStore = createDiscordAvailabilityStore,
  now = () => Date.now(),
  logger = console,
} = {}) {
  return async function handleMatchmakingInteraction(interaction) {
    if (interaction?.isButton?.() && String(interaction.customId || '').startsWith(`${FIND_GAME_COMMAND}:`)) {
      await handleFindGameButton(interaction, { logger })
      return true
    }
    if (!interaction?.isChatInputCommand?.() || ![AVAILABILITY_COMMAND, FIND_GAME_COMMAND].includes(interaction.commandName)) return false
    try {
      await interaction.deferReply({ ephemeral: true })
      const channel = await resolveChannel(interaction.client, interaction)
      if (interaction.commandName === AVAILABILITY_COMMAND) {
        const store = await createStore(channel, interaction.client, logger)
        await handleAvailabilityCommand(interaction, store)
      } else {
        await handleFindGameCommand(interaction, channel, now())
      }
    } catch (error) {
      logger.error?.('Matchmaking command failed:', error)
      await sendMatchmakingFailure(interaction, error)
    }
    return true
  }
}

async function handleAvailabilityCommand(interaction, store) {
  const subcommand = interaction.options.getSubcommand(true)
  const userId = String(interaction.user.id)
  if (subcommand === 'set') {
    const record = buildAvailabilityRecord(interaction)
    await store.upsert(record)
    await interaction.editReply({
      content: [
        `Saved **${capitalize(record.weekday)}** availability.`,
        `${record.start}–${record.end} · ${record.timeZone}`,
        `${formatLabel(record.format)} · ${record.points} points · ${needLabel(record.need)}`,
        record.note ? `Note: ${record.note}` : '',
        record.mention ? 'You will be mentioned when this window appears in the daily feed.' : 'You will appear without a notification ping.',
      ].filter(Boolean).join('\n'),
      allowedMentions: { parse: [] },
    })
    return
  }
  if (subcommand === 'clear') {
    const weekday = interaction.options.getString('weekday', true)
    const removed = await store.remove(userId, weekday)
    await interaction.editReply({ content: removed ? `Removed ${weekday === 'all' ? 'all of your' : `your ${capitalize(weekday)}`} availability.` : 'No matching availability was saved.', allowedMentions: { parse: [] } })
    return
  }
  const records = (await store.load()).filter((record) => String(record.userId) === userId)
  await interaction.editReply({ content: formatSavedAvailability(records), allowedMentions: { parse: [] } })
}

async function handleFindGameCommand(interaction, channel, nowMs) {
  const subcommand = interaction.options.getSubcommand(true)
  if (subcommand === 'close') {
    const message = await findLatestOpenRequest(channel, interaction.user.id, interaction.client.user?.id)
    if (!message) {
      await interaction.editReply('You do not have an open one-off request in the scheduling feed.')
      return
    }
    await closeFindGameMessage(message)
    await interaction.editReply(`[Closed your request.](${message.url})`)
    return
  }

  const request = buildOneOffRequest(interaction)
  if (request.endMs <= nowMs) throw new Error('That availability window has already ended.')
  const audience = interaction.options.getString('notify') || 'none'
  const role = resolveAudienceRole(interaction.guild, audience)
  const payload = buildFindGameMessage(request, { role })
  const message = await channel.send(payload)
  await interaction.editReply({
    content: [
      `[Your game request is live.](${message.url})`,
      role ? `Notified @${role.name}.` : audience === 'none' ? '' : 'The selected opt-in role does not exist yet, so the request was posted without a role ping.',
    ].filter(Boolean).join('\n'),
    allowedMentions: { parse: [] },
  })
}

export function buildAvailabilityRecord(interaction) {
  return {
    version: 1,
    userId: String(interaction.user.id),
    displayName: String(interaction.member?.displayName || interaction.user.globalName || interaction.user.username || 'Player').trim(),
    weekday: interaction.options.getString('weekday', true),
    start: normalizeClockTime(interaction.options.getString('start', true), 'Start time'),
    end: normalizeClockTime(interaction.options.getString('end', true), 'End time'),
    timeZone: normalizeTimeZone(interaction.options.getString('timezone', true)),
    format: interaction.options.getString('format') || 'tts',
    points: interaction.options.getInteger('points') || 300,
    need: interaction.options.getString('need') || 'open',
    note: String(interaction.options.getString('note') || '').trim().slice(0, 300),
    mention: interaction.options.getBoolean('mention-me') ?? true,
    updatedAt: new Date().toISOString(),
  }
}

export function buildOneOffRequest(interaction) {
  const window = buildTimeWindow({
    date: interaction.options.getString('date', true),
    start: interaction.options.getString('start', true),
    end: interaction.options.getString('end', true),
    timeZone: interaction.options.getString('timezone', true),
  })
  return {
    id: randomUUID().replaceAll('-', '').slice(0, 16),
    userId: String(interaction.user.id),
    displayName: String(interaction.member?.displayName || interaction.user.globalName || interaction.user.username || 'Player').trim(),
    format: interaction.options.getString('format') || 'tts',
    points: interaction.options.getInteger('points') || 300,
    need: interaction.options.getString('need') || 'open',
    note: String(interaction.options.getString('note') || '').trim().slice(0, 300),
    ...window,
  }
}

export function buildFindGameMessage(request, { role = null } = {}) {
  const marker = `${FIND_GAME_MARKER_PREFIX}${request.id}:${request.userId}:open`
  const roleMention = role ? `<@&${role.id}>\n` : ''
  const embed = new EmbedBuilder()
    .setColor(0x28c4f4)
    .setTitle(`🎲 ${needLabel(request.need)} wanted`)
    .setDescription(`<@${request.userId}> is looking for an Infinity game.`)
    .addFields(
      { name: 'When', value: `${discordTimestamp(request.startMs, 'F')} – ${discordTimestamp(request.endMs, 't')}` },
      { name: 'Game', value: `${formatLabel(request.format)} · ${request.points} points`, inline: true },
      { name: 'Time zone entered', value: request.timeZone, inline: true },
      ...(request.note ? [{ name: 'What they need', value: request.note }] : []),
    )
    .setFooter({ text: marker })
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${FIND_GAME_COMMAND}:interest:${request.userId}:${request.id}`).setLabel("I'm interested").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${FIND_GAME_COMMAND}:close:${request.userId}:${request.id}`).setLabel('Close request').setStyle(ButtonStyle.Secondary),
  )
  return {
    content: `${roleMention}-# Times are shown in each reader’s local Discord time.`,
    embeds: [embed],
    components: [row],
    allowedMentions: { parse: [], roles: role ? [String(role.id)] : [] },
  }
}

export function buildDailyMatchmakingDigest(records, nowMs = Date.now(), options = {}) {
  const window = dailyDigestWindow(nowMs, options)
  const marker = `${MATCHMAKING_DIGEST_MARKER_PREFIX}${window.date}:${window.timeZone}`
  if (!window.due) return { status: 'NOT_DUE', marker, window, occurrences: [], matches: [], payload: null }

  const occurrences = []
  const invalidRecords = []
  for (const record of records || []) {
    try {
      occurrences.push(...expandRecurringAvailability(record, window))
    } catch (error) {
      invalidRecords.push({ record, error })
    }
  }
  if (!occurrences.length) return { status: 'EMPTY', marker, window, occurrences, matches: [], invalidRecords, payload: null }

  const matches = uniquePlayerMatches(matchAvailabilityOccurrences(occurrences))
  const mentions = [...new Set(occurrences.filter((entry) => entry.mention !== false).map((entry) => String(entry.userId)))].slice(0, 50)
  const fields = matches.slice(0, 10).map((match) => ({
    name: `${match.left.displayName || 'Player'} ↔ ${match.right.displayName || 'Player'}`.slice(0, 256),
    value: [
      `<@${match.left.userId}> and <@${match.right.userId}>`,
      `${discordTimestamp(match.overlapStartMs, 'F')} – ${discordTimestamp(match.overlapEndMs, 't')}`,
      `${formatLabel(match.left.format)} · ${Number(match.left.points || 300)} points · ${formatNeedPair(match.left.need, match.right.need)}`,
      formatMatchNotes(match.left, match.right),
    ].filter(Boolean).join('\n').slice(0, 1024),
    inline: false,
  }))
  const occurrenceLines = occurrences.slice(0, 18).map((entry) => (
    `• <@${entry.userId}> · ${discordTimestamp(entry.startMs, 't')}–${discordTimestamp(entry.endMs, 't')} · ${formatLabel(entry.format)} · ${Number(entry.points || 300)} pts · ${needLabel(entry.need)}`
  ))
  fields.push({
    name: matches.length ? 'Everyone available today' : 'Available today',
    value: [
      ...occurrenceLines,
      ...(occurrences.length > occurrenceLines.length ? [`• …and ${occurrences.length - occurrenceLines.length} more window${occurrences.length - occurrenceLines.length === 1 ? '' : 's'}`] : []),
    ].join('\n').slice(0, 1024),
    inline: false,
  })

  const embed = new EmbedBuilder()
    .setColor(matches.length ? 0x28c4f4 : 0xf2b134)
    .setTitle('🎲 Today’s Infinity scheduling board')
    .setDescription(matches.length
      ? `I found **${matches.length} compatible overlap${matches.length === 1 ? '' : 's'}** of at least 90 minutes. Times below automatically display in each reader’s local Discord time.`
      : 'Players are available today, but no compatible windows overlap by at least 90 minutes. Times below automatically display in each reader’s local Discord time.')
    .addFields(fields)
    .setFooter({ text: marker })
  return {
    status: 'READY',
    marker,
    window,
    occurrences,
    matches,
    invalidRecords,
    payload: {
      content: mentions.length ? mentions.map((userId) => `<@${userId}>`).join(' ') : '-# Daily recurring availability',
      embeds: [embed],
      allowedMentions: { parse: [], users: mentions },
    },
  }
}

export function startMatchmakingScheduler(client, {
  resolveChannel = resolveMatchmakingChannel,
  createStore = createDiscordAvailabilityStore,
  now = () => Date.now(),
  logger = console,
  intervalMs = Math.max(60_000, Number(process.env.INFINITY_MATCHMAKING_CHECK_INTERVAL_MS) || DEFAULT_MATCHMAKING_CHECK_INTERVAL_MS),
  digestOptions = {
    timeZone: String(process.env.INFINITY_MATCHMAKING_DIGEST_TIME_ZONE || '').trim() || undefined,
    hour: Number.isInteger(Number(process.env.INFINITY_MATCHMAKING_DIGEST_HOUR)) && String(process.env.INFINITY_MATCHMAKING_DIGEST_HOUR || '').trim()
      ? Number(process.env.INFINITY_MATCHMAKING_DIGEST_HOUR)
      : undefined,
  },
} = {}) {
  if (String(process.env.INFINITY_MATCHMAKING_ENABLED || 'true').toLowerCase() === 'false') {
    return { stop() {}, runNow: async () => ({ status: 'DISABLED', guilds: [] }) }
  }
  let stopped = false
  let running = null
  const runNow = async () => {
    if (running) return running
    running = (async () => {
      const guildResults = []
      for (const guild of client?.guilds?.cache?.values?.() || []) {
        try {
          const channel = await resolveChannel(client, { guild })
          const store = await createStore(channel, client, logger)
          const digest = buildDailyMatchmakingDigest(await store.load(), now(), compactDigestOptions(digestOptions))
          if (digest.status !== 'READY') {
            guildResults.push({ guildId: guild.id, channelId: channel.id, status: digest.status })
            continue
          }
          if (await matchmakingDigestAlreadyPosted(channel, digest.marker, client.user?.id)) {
            guildResults.push({ guildId: guild.id, channelId: channel.id, status: 'ALREADY_POSTED' })
            continue
          }
          const message = await channel.send(digest.payload)
          guildResults.push({ guildId: guild.id, channelId: channel.id, messageId: message.id, status: 'POSTED', matches: digest.matches.length })
        } catch (error) {
          logger.error?.(`Matchmaking digest failed for guild ${guild.id}: ${error instanceof Error ? error.message : String(error)}`)
          guildResults.push({ guildId: guild.id, status: 'ERROR', error })
        }
      }
      return { status: guildResults.some((entry) => entry.status === 'POSTED') ? 'POSTED' : 'UNCHANGED', guilds: guildResults }
    })().finally(() => { running = null })
    return running
  }
  const timer = setInterval(() => { if (!stopped) void runNow() }, intervalMs)
  timer.unref?.()
  void runNow()
  return { stop() { stopped = true; clearInterval(timer) }, runNow }
}

export function serializeAvailabilityRecord(record) {
  return `${AVAILABILITY_RECORD_PREFIX}${Buffer.from(JSON.stringify(record)).toString('base64url')}`
}

export function parseAvailabilityRecord(content) {
  const text = String(content || '').trim()
  if (!text.startsWith(AVAILABILITY_RECORD_PREFIX)) return null
  try {
    const record = JSON.parse(Buffer.from(text.slice(AVAILABILITY_RECORD_PREFIX.length), 'base64url').toString('utf8'))
    if (Number(record?.version) !== 1 || !/^\d+$/.test(String(record?.userId || '')) || !WEEKDAY_CHOICES.some((choice) => choice.value === record.weekday)) return null
    return record
  } catch {
    return null
  }
}

export async function createDiscordAvailabilityStore(channel, client, logger = console) {
  const thread = await ensureAvailabilityThread(channel, logger)
  const botUserId = String(client?.user?.id || '')
  const readMessages = async () => fetchThreadMessages(thread)
  return {
    thread,
    async load() {
      return (await readMessages())
        .filter((message) => !botUserId || String(message.author?.id || '') === botUserId)
        .map((message) => parseAvailabilityRecord(message.content))
        .filter(Boolean)
    },
    async upsert(record) {
      const messages = await readMessages()
      const existing = messages.find((message) => {
        if (botUserId && String(message.author?.id || '') !== botUserId) return false
        const candidate = parseAvailabilityRecord(message.content)
        return candidate && String(candidate.userId) === String(record.userId) && candidate.weekday === record.weekday
      })
      const payload = { content: serializeAvailabilityRecord(record), allowedMentions: { parse: [] } }
      if (existing) await existing.edit(payload)
      else await thread.send(payload)
      return record
    },
    async remove(userId, weekday) {
      const messages = await readMessages()
      const targets = messages.filter((message) => {
        if (botUserId && String(message.author?.id || '') !== botUserId) return false
        const record = parseAvailabilityRecord(message.content)
        return record && String(record.userId) === String(userId) && (weekday === 'all' || record.weekday === weekday)
      })
      for (const message of targets) await message.delete()
      return targets.length
    },
  }
}

export async function resolveMatchmakingChannel(client, interaction = {}) {
  const channelId = String(process.env.INFINITY_MATCHMAKING_CHANNEL_ID || '').trim()
  const channelName = String(process.env.INFINITY_MATCHMAKING_CHANNEL_NAME || MATCHMAKING_CHANNEL_NAME).trim()
  const guild = interaction.guild
  let channel = null
  if (channelId) channel = await client.channels.fetch(channelId)
  if (!channel && guild?.channels?.cache) {
    channel = [...guild.channels.cache.values()].find((candidate) => candidate?.name === channelName && supportsMatchmakingChannel(candidate)) || null
  }
  if (!channel && !guild && client?.channels?.cache) {
    channel = [...client.channels.cache.values()].find((candidate) => candidate?.name === channelName && supportsMatchmakingChannel(candidate)) || null
  }
  const autoCreate = String(process.env.INFINITY_MATCHMAKING_AUTO_CREATE_CHANNEL || 'true').toLowerCase() !== 'false'
  if (!channel && guild?.channels?.create && autoCreate) {
    channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      topic: 'Recurring availability, one-off game requests, and automatic Infinity match suggestions.',
      reason: 'Lobo matchmaking scheduling feed',
    })
  }
  if (!channel || !supportsMatchmakingChannel(channel)) throw new Error(`Create a text channel named #${channelName}, or set INFINITY_MATCHMAKING_CHANNEL_ID.`)
  return channel
}

export async function matchmakingDigestAlreadyPosted(channel, marker, botUserId = '') {
  const messages = await channel.messages.fetch({ limit: 100 })
  return [...messages.values()].some((message) => {
    if (botUserId && String(message.author?.id || '') !== String(botUserId)) return false
    return String(message.embeds?.[0]?.footer?.text || '') === marker
  })
}

export function parseFindGameMarker(message) {
  const footer = String(message?.embeds?.[0]?.footer?.text || '')
  if (!footer.startsWith(FIND_GAME_MARKER_PREFIX)) return null
  const [id, userId, status] = footer.slice(FIND_GAME_MARKER_PREFIX.length).split(':')
  return id && /^\d+$/.test(userId) && ['open', 'closed'].includes(status) ? { id, userId, status } : null
}

async function handleFindGameButton(interaction, { logger }) {
  const [, action, creatorId, requestId] = String(interaction.customId).split(':')
  const marker = parseFindGameMarker(interaction.message)
  if (!marker || marker.id !== requestId || marker.userId !== creatorId || marker.status !== 'open') {
    await interaction.reply({ content: 'That request is no longer open.', ephemeral: true })
    return
  }
  if (action === 'close') {
    if (String(interaction.user.id) !== creatorId) {
      await interaction.reply({ content: 'Only the player who posted this request can close it.', ephemeral: true })
      return
    }
    await interaction.update(closedFindGamePayload(interaction.message))
    return
  }
  if (action !== 'interest') return
  if (String(interaction.user.id) === creatorId) {
    await interaction.reply({ content: 'This is your own request.', ephemeral: true })
    return
  }

  const requester = await interaction.client.users.fetch(creatorId)
  const requestUrl = interaction.message.url
  let requesterDmSent = false
  try {
    await requester.send({
      content: `**${interaction.user.globalName || interaction.user.username} is interested in your game request.**\n${requestUrl}\n\nYou can reply to them on Discord: <@${interaction.user.id}>`,
      allowedMentions: { parse: [] },
    })
    requesterDmSent = true
  } catch (error) {
    logger.warn?.(`Could not DM matchmaking requester ${creatorId}: ${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    await interaction.user.send({
      content: `I notified **${requester.globalName || requester.username}** about your interest.\n${requestUrl}`,
      allowedMentions: { parse: [] },
    })
  } catch {}

  if (!requesterDmSent && interaction.channel?.send) {
    await interaction.channel.send({
      content: `<@${creatorId}> — <@${interaction.user.id}> is interested in this game request. Please coordinate here because I could not deliver the private message.`,
      allowedMentions: { parse: [], users: [creatorId, String(interaction.user.id)] },
    })
  }
  await interaction.reply({
    content: requesterDmSent ? 'I sent the requester a private message with your interest.' : 'I could not DM the requester, so I notified both of you in the scheduling feed.',
    ephemeral: true,
  })
}

async function ensureAvailabilityThread(channel, logger) {
  const cached = channel.threads?.cache && [...channel.threads.cache.values()].find((thread) => thread.name === AVAILABILITY_THREAD_NAME)
  if (cached) {
    if (cached.archived && cached.setArchived) await cached.setArchived(false)
    return cached
  }
  try {
    const active = await channel.threads.fetchActive()
    const thread = [...active.threads.values()].find((candidate) => candidate.name === AVAILABILITY_THREAD_NAME)
    if (thread) return thread
  } catch {}
  for (const type of ['private', 'public']) {
    try {
      const archived = await channel.threads.fetchArchived({ type, limit: 100 })
      const thread = [...archived.threads.values()].find((candidate) => candidate.name === AVAILABILITY_THREAD_NAME)
      if (thread) {
        if (thread.setArchived) await thread.setArchived(false)
        return thread
      }
    } catch {}
  }
  try {
    return await channel.threads.create({
      name: AVAILABILITY_THREAD_NAME,
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: 'Persistent matchmaking availability records',
    })
  } catch (error) {
    logger.warn?.(`Private availability thread unavailable; using a public thread: ${error instanceof Error ? error.message : String(error)}`)
    return channel.threads.create({
      name: AVAILABILITY_THREAD_NAME,
      type: ChannelType.PublicThread,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: 'Persistent matchmaking availability records',
    })
  }
}

async function fetchThreadMessages(thread, maximum = 1_000) {
  const output = []
  let before
  while (output.length < maximum) {
    const batch = await thread.messages.fetch({ limit: Math.min(100, maximum - output.length), ...(before ? { before } : {}) })
    const messages = [...batch.values()]
    output.push(...messages)
    if (messages.length < 100) break
    before = messages.at(-1)?.id
    if (!before) break
  }
  return output
}

async function findLatestOpenRequest(channel, userId, botUserId) {
  const messages = await channel.messages.fetch({ limit: 100 })
  return [...messages.values()].find((message) => {
    const marker = parseFindGameMarker(message)
    return marker?.status === 'open' && marker.userId === String(userId) && (!botUserId || String(message.author?.id || '') === String(botUserId))
  }) || null
}

async function closeFindGameMessage(message) {
  await message.edit(closedFindGamePayload(message))
}

function closedFindGamePayload(message) {
  const marker = parseFindGameMarker(message)
  const source = message.embeds?.[0]
  const embed = EmbedBuilder.from(source)
    .setColor(0x64748b)
    .setTitle(`Closed · ${String(source?.title || 'Game request').replace(/^Closed · /, '')}`)
    .setFooter({ text: `${FIND_GAME_MARKER_PREFIX}${marker.id}:${marker.userId}:closed` })
  return { content: String(message.content || '').replace(/<@&\d+>\s*/g, ''), embeds: [embed], components: [], allowedMentions: { parse: [] } }
}

function resolveAudienceRole(guild, audience) {
  if (!guild || audience === 'none') return null
  const config = AUDIENCE_ROLE_CONFIG[audience]
  if (!config) return null
  const configuredId = String(process.env[config.env] || '').trim()
  if (configuredId) return guild.roles?.cache?.get(configuredId) || null
  const names = new Set(config.names.map(normalizeSearch))
  return [...(guild.roles?.cache?.values?.() || [])].find((role) => names.has(normalizeSearch(role.name))) || null
}

function formatSavedAvailability(records) {
  if (!records.length) return 'You have no recurring availability saved.'
  const order = new Map(WEEKDAY_CHOICES.map((choice, index) => [choice.value, index]))
  return [
    '**Your recurring availability**',
    ...records.sort((a, b) => order.get(a.weekday) - order.get(b.weekday)).map((record) => [
      `• **${capitalize(record.weekday)}** ${record.start}–${record.end} (${record.timeZone})`,
      `  ${formatLabel(record.format)} · ${record.points || 300} points · ${needLabel(record.need)}${record.note ? ` · ${record.note}` : ''}`,
    ].join('\n')),
  ].join('\n')
}

function uniquePlayerMatches(matches) {
  const seen = new Set()
  return matches.filter((match) => {
    const pair = [String(match.left.userId), String(match.right.userId)].sort().join(':')
    if (seen.has(pair)) return false
    seen.add(pair)
    return true
  })
}

function formatNeedPair(left, right) {
  const first = needLabel(left)
  const second = needLabel(right)
  return first === second ? first : `${first} / ${second}`
}

function formatMatchNotes(left, right) {
  const notes = [left, right]
    .filter((entry) => entry.note)
    .map((entry) => `${entry.displayName || 'Player'}: ${entry.note}`)
  return notes.join('\n')
}

function compactDigestOptions(options) {
  return Object.fromEntries(Object.entries(options || {}).filter(([, value]) => value !== undefined && value !== null && value !== ''))
}

function commandMatchesDefinition(command, definition) {
  if (command.description !== definition.description || command.options?.length !== definition.options.length) return false
  return definition.options.every((expected, index) => commandOptionMatches(command.options?.[index], expected))
}

function commandOptionMatches(actual, expected) {
  if (!actual || actual.name !== expected.name || actual.type !== expected.type || actual.description !== expected.description) return false
  if (Boolean(actual.required) !== Boolean(expected.required) || Boolean(actual.autocomplete) !== Boolean(expected.autocomplete)) return false
  for (const [apiKey, definitionKey] of [['minValue', 'min_value'], ['maxValue', 'max_value'], ['minLength', 'min_length'], ['maxLength', 'max_length']]) {
    if ((actual[apiKey] ?? actual[definitionKey] ?? null) !== (expected[definitionKey] ?? null)) return false
  }
  const actualChoices = actual.choices || []
  const expectedChoices = expected.choices || []
  if (actualChoices.length !== expectedChoices.length) return false
  if (!expectedChoices.every((choice, index) => actualChoices[index]?.name === choice.name && actualChoices[index]?.value === choice.value)) return false
  const actualOptions = actual.options || []
  const expectedOptions = expected.options || []
  return actualOptions.length === expectedOptions.length
    && expectedOptions.every((option, index) => commandOptionMatches(actualOptions[index], option))
}

function supportsMatchmakingChannel(channel) {
  return Boolean(channel?.isTextBased?.() && channel?.messages && channel?.threads)
}

function formatLabel(value) {
  return FORMAT_LABELS[value] || FORMAT_LABELS.tts
}

function needLabel(value) {
  return NEED_LABELS[value] || NEED_LABELS.open
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function capitalize(value) {
  const text = String(value || '')
  return text ? text[0].toUpperCase() + text.slice(1) : text
}

async function sendMatchmakingFailure(interaction, error) {
  const content = error instanceof Error ? error.message : 'The matchmaking command could not be completed.'
  try {
    if (interaction.deferred || interaction.replied) await interaction.editReply({ content, allowedMentions: { parse: [] } })
    else await interaction.reply({ content, ephemeral: true, allowedMentions: { parse: [] } })
  } catch {}
}
