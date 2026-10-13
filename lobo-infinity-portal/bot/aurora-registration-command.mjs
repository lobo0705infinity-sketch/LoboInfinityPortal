import { createServer } from 'node:http'
import { ApplicationCommandOptionType as Type, PermissionFlagsBits } from 'discord.js'
import { createRegistrationStore } from './aurora-registration-store.mjs'
import { provisionFactionChannels } from './aurora-faction-channels.mjs'
import { createCampaignGameService } from './aurora-game-service.mjs'
import { createPortalRegistration } from './aurora-portal-registration.mjs'
import { createFactionBriefingPublisher } from './aurora-faction-briefing-publisher.mjs'
import { AURORA_FACTION_BRIEFINGS } from './aurora-faction-briefings.mjs'
import { AURORA_DISCORD_GUILD_ID, AURORA_REGISTRATION_FACTIONS } from '../shared/aurora-registration.mjs'

export const AURORA_COMMAND_DEFINITION = {
  name: 'aurora', description: 'Register for the Aurora VII narrative league', dmPermission: false,
  options: [
    { name: 'register', description: 'Join a faction and receive its campaign Discord role', type: Type.Subcommand, options: [
      { name: 'faction', description: 'Choose your campaign faction', type: Type.String, required: true, choices: AURORA_REGISTRATION_FACTIONS.map(faction => ({ name: faction.name, value: faction.id })) },
      { name: 'player', description: 'Your Lobo Portal player name', type: Type.String, required: true, minLength: 1, maxLength: 80 },
    ] },
    { name: 'status', description: 'See your registration and available faction places', type: Type.Subcommand },
    { name: 'change-faction', description: 'Commissioner only: move a registered player to another faction', type: Type.Subcommand, options: [
      { name: 'player', description: 'The registered Discord player', type: Type.User, required: true },
      { name: 'faction', description: 'The new campaign faction', type: Type.String, required: true, choices: AURORA_REGISTRATION_FACTIONS.map(faction => ({ name: faction.name, value: faction.id })) },
    ] },
  ],
}
export const campaignRoleName = faction => `Aurora VII — ${faction.name}`

export async function provisionCampaignRoles(guild) {
  const me = await guild.members.fetchMe()
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) throw Error('Lobo’s Little Helper needs Manage Roles to assign campaign roles.')
  const roles = await guild.roles.fetch()
  const result = new Map()
  for (const faction of AURORA_REGISTRATION_FACTIONS) {
    const matches = [...roles.values()].filter(role => role.name === campaignRoleName(faction))
    if (matches.length > 1) throw Error('Duplicate campaign role names need to be resolved by Lobo.')
    const role = matches[0] || await guild.roles.create({ name: campaignRoleName(faction), permissions: [], mentionable: false, reason: 'Aurora VII league registration setup' })
    if (role.managed || !role.editable || role.permissions.bitfield !== 0n) throw Error('Campaign roles must have no extra permissions and sit below Lobo’s Little Helper.')
    result.set(faction.id, role)
  }
  return result
}

export function createAuroraRegistrationService({ store = createRegistrationStore(process.env.AURORA_REGISTRATION_PATH || '/data/aurora-vii-registrations.json'), logger = console } = {}) {
  let guild, roles = new Map(), available = false, issue = 'Campaign registration is starting. Please try again shortly.'
  let queue = Promise.resolve(), timer, server
  let channelCount = 0, channelsReady = false, channelIssue = ''
  const briefings = Object.fromEntries(AURORA_FACTION_BRIEFINGS.map(faction => [faction.id, { posted: false, pinned: false }]))
  const briefingIssues = new Map()
  const briefingPublishers = new Map(AURORA_FACTION_BRIEFINGS.map(faction => [faction.id, createFactionBriefingPublisher({ ...faction, factionId: faction.id })]))
  const serialize = action => { const result = queue.then(action); queue = result.catch(() => {}); return result }
  async function setupRoles() {
    if (!guild) throw Error('Campaign Discord server is unavailable.')
    roles = await provisionCampaignRoles(guild); available = true; issue = ''
  }
  async function assign(player) {
    const role = roles.get(player.faction)
    const member = await guild.members.fetch(player.userId)
    // Remove every other campaign role before granting the authoritative faction.
    // Pending transfers survive restarts and retry this reconciliation safely.
    for (const [factionId, other] of roles) if (factionId !== player.faction && (!member.roles.cache || member.roles.cache.has(other.id))) {
      await member.roles.remove(other.id, 'Aurora VII faction role reconciliation')
    }
    await member.roles.add(role.id, 'Aurora VII faction registration')
    await store.assigned(player.userId)
  }
  async function registerPortal({ userId, faction, name }) {
    return serialize(async () => {
      if (!available) throw Error(issue)
      try { await guild.members.fetch(userId) }
      catch { throw Error('Join Lobo’s Discord server before registering, then try again.') }
      const player = await store.register({ userId, faction, name })
      try { await assign(player) } catch { /* Durable reservation is recovered by the existing timer. */ }
      return store.player(userId)
    })
  }
  let portal, games
  async function recover() {
    return serialize(async () => {
      try {
        await setupRoles()
        await store.summary() // Fail closed on corrupt or inaccessible storage.
      } catch (error) {
        available = false; issue = 'Registration is temporarily unavailable. Lobo needs to check the campaign roles or registration storage.'
        logger.error?.(`Aurora VII registration setup: ${error.message}`); return
      }
      for (const player of await store.pending()) {
        try { await assign(player) }
        catch { logger.error?.('Aurora VII: a reserved registration is awaiting Discord role assignment; it will be retried.') }
      }
      try {
        const channels = await provisionFactionChannels(guild, roles)
        channelCount = channels.size
        if (!channelsReady) logger.info?.(`Aurora VII private faction channels verified: ${channelCount}; matching faction role only, plus bot and server administrators.`)
        channelsReady = true; channelIssue = ''
        for (const faction of AURORA_FACTION_BRIEFINGS) {
          if (briefings[faction.id].pinned) continue
          try {
            const channel = await guild.channels.fetch(channels.get(faction.id))
            const previous = briefings[faction.id]
            briefings[faction.id] = await briefingPublishers.get(faction.id)(channel, guild.client.user.id)
            const result = briefings[faction.id]
            if (result.posted && !previous.posted) logger.info?.(`Aurora VII ${faction.name} briefing posted: ${result.url}`)
            const issue = result.needsManageMessages ? 'Manage Messages is required to pin the posted faction briefing.' : ''
            if (issue && briefingIssues.get(faction.id) !== issue) logger.error?.(`Aurora VII ${faction.name} briefing: ${issue}`)
            if (result.pinned) logger.info?.(`Aurora VII ${faction.name} briefing pin verified: ${result.url}`)
            briefingIssues.set(faction.id, issue)
          } catch (error) {
            if (briefingIssues.get(faction.id) !== error.message) logger.error?.(`Aurora VII ${faction.name} briefing: ${error.message}`)
            briefingIssues.set(faction.id, error.message)
          }
        }
      } catch (error) {
        channelsReady = false
        if (channelIssue !== error.message) logger.error?.(`Aurora VII faction channel setup: ${error.message}`)
        channelIssue = error.message
      }
    })
  }
  async function handler(interaction) {
    if (!interaction.isChatInputCommand?.() || interaction.commandName !== 'aurora') return false
    await interaction.deferReply({ flags: 64 })
    const reply = content => interaction.editReply({ content, allowedMentions: { parse: [] } })
    if (interaction.guildId !== AURORA_DISCORD_GUILD_ID) { await reply('Use this command in Lobo’s Discord server.'); return true }
    try {
      await serialize(async () => {
        const command = interaction.options.getSubcommand()
        if (command === 'status') {
          const player = await store.player(interaction.user.id), state = await store.summary()
          await reply([
            player ? `You are registered for **${AURORA_REGISTRATION_FACTIONS.find(faction => faction.id === player.faction).name}**.${player.roleStatus === 'pending' ? ' Your place is reserved; Discord role assignment is being retried.' : ''}` : 'You are not registered yet. Use `/aurora register`.',
            `**${state.total} players · ${state.cap} places per faction in this batch**`,
            ...state.factions.map(faction => `${faction.name}: ${faction.count}/${state.cap}${faction.locked ? ' — locked' : ''}`),
            `All factions reopen at ${state.cap + 5} when every faction reaches ${state.cap}.`,
          ].join('\n')); return
        }
        if (command === 'withdraw') {
          await reply('Faction changes and withdrawals are controlled by Lobo. Contact the commissioner.'); return
        }
        if (command === 'change-faction') {
          if (interaction.user.id !== guild.ownerId) { await reply('Only Lobo, the server owner, can change campaign factions.'); return }
          await setupRoles()
          const user = interaction.options.getUser('player', true)
          const faction = interaction.options.getString('faction', true)
          const player = await store.changeFaction(user.id, faction)
          const selected = AURORA_REGISTRATION_FACTIONS.find(value => value.id === player.faction)
          try {
            await assign(player)
            await reply(`${player.name} is now registered for **${selected.name}**. Their faction role and private channel access have been updated.`)
          } catch {
            await reply(`${player.name} has been moved to **${selected.name}**. Discord role reconciliation is pending and will retry automatically.`)
          }
          return
        }
        if (command !== 'register') throw Error('Unknown campaign command.')
        if (!available) throw Error(issue)
        const faction = interaction.options.getString('faction', true)
        const name = interaction.options.getString('player', true)
        // Reservation is durable before touching Discord. A crash or failed
        // role request leaves one retryable reservation, never another signup.
        const player = await store.register({ userId: interaction.user.id, faction, name })
        const selected = AURORA_REGISTRATION_FACTIONS.find(value => value.id === player.faction)
        try {
          await assign(player)
          await reply(`You are registered for **${selected.name}** in Aurora VII. Your **${campaignRoleName(selected)}** role has been assigned.\nView registration: https://lobo-infinity-portal.vercel.app/campaign/aurora-vii/register`)
        } catch {
          await reply(`Your **${selected.name}** place is reserved. Discord role assignment is temporarily unavailable and will be retried automatically. Use \`/aurora status\` to check it; you do not need to register again.`)
        }
      })
    } catch (error) {
      // Expected registration errors are safe player-facing text; storage and
      // Discord errors must not leak paths, IDs or credentials.
      const message = /^(You are already|Choose one|Enter a player|That player|That faction|Registration is temporarily|That Discord)/.test(error.message) ? error.message : 'Registration could not be completed. Your existing place has not been changed. Please try again or contact Lobo.'
      await reply(message)
    }
    return true
  }
  return {
    handler,
    summary: async () => ({ ...await store.summary(), available, issue, channelsReady, channelCount, ariadnaBriefing: briefings.ariadna, briefings }),
    async start(client, { port = Number(process.env.PORT || 8080), serve = true } = {}) {
      guild = client.guilds.cache.get(AURORA_DISCORD_GUILD_ID)
      if (!guild) throw Error('Aurora VII server is not connected to this bot.')
      const commands = await guild.commands.fetch(), existing = commands.find(command => command.name === 'aurora')
      if (existing) await existing.edit(AURORA_COMMAND_DEFINITION)
      else await guild.commands.create(AURORA_COMMAND_DEFINITION)
      await recover()
      portal = createPortalRegistration({ clientId: client.application?.id || client.user?.id, register: registerPortal, joinServer: async (userId, accessToken) => {
        try { await guild.members.fetch(userId); return } catch { /* Discord OAuth consent permits joining. */ }
        await guild.members.add(userId, { accessToken })
      }, player: userId => store.player(userId), summary: () => store.summary() })
      games = createCampaignGameService({ registrations: store, identity: request => portal.session(request), notify: async game => {
        const member = await guild.members.fetch(game.playerB.id)
        await member.send({ content: `Aurora VII: ${game.playerA.name} submitted your ${game.mission} game (${game.opA}–${game.opB} OP). Review and confirm, or request a correction: https://lobo-infinity-portal.vercel.app/campaign/aurora-vii/games?game=${game.id}`, allowedMentions: { parse: [] } })
      } })
      void games.deliver().catch(() => logger.error?.('Aurora VII game notifications are temporarily unavailable.'))
      timer = setInterval(() => recover().catch(() => logger.error?.('Aurora VII recovery is temporarily unavailable.')), 60000); timer.unref()
      if (serve) {
        server = createServer(async (request, response) => {
          response.setHeader('content-type', 'application/json; charset=utf-8'); response.setHeader('x-content-type-options', 'nosniff')
          response.setHeader('cache-control', 'no-store')
          if (request.url?.startsWith('/aurora-vii/games?')) {
            try { await games.handler(request, response) }
            catch { response.writeHead(503); response.end('{"error":"Campaign games are temporarily unavailable."}') }
            return
          }
          if (request.url?.startsWith('/aurora-vii/portal?')) {
            try { await portal(request, response) }
            catch { response.writeHead(503); response.end('{"error":"Registration is temporarily unavailable."}') }
            return
          }
          if (request.method !== 'GET' || request.url !== '/aurora-vii/registration') { response.writeHead(404); response.end('{"error":"Not found"}'); return }
          try { response.end(JSON.stringify({ ...await store.summary(), available, issue, channelsReady, channelCount, ariadnaBriefing: briefings.ariadna, briefings })) }
          catch { response.writeHead(503); response.end('{"error":"Registration is temporarily unavailable."}') }
        })
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '0.0.0.0', resolve) })
      }
      logger.info?.(`Aurora VII registration ready: roles=${roles.size} available=${available} port=${port}`)
    },
    stop() { clearInterval(timer); server?.close() },
    recover,
  }
}
