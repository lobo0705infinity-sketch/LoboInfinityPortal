import { createServer } from 'node:http'
import { ApplicationCommandOptionType as Type, PermissionFlagsBits } from 'discord.js'
import { createRegistrationStore } from './aurora-registration-store.mjs'
import { provisionFactionChannels } from './aurora-faction-channels.mjs'
import { AURORA_DISCORD_GUILD_ID, AURORA_REGISTRATION_FACTIONS } from '../shared/aurora-registration.mjs'

export const AURORA_COMMAND_DEFINITION = {
  name: 'aurora', description: 'Register for the Aurora VII narrative league', dmPermission: false,
  options: [
    { name: 'register', description: 'Join a faction and receive its campaign Discord role', type: Type.Subcommand, options: [
      { name: 'faction', description: 'Choose your campaign faction', type: Type.String, required: true, choices: AURORA_REGISTRATION_FACTIONS.map(faction => ({ name: faction.name, value: faction.id })) },
      { name: 'player', description: 'Your Lobo Portal player name', type: Type.String, required: true, minLength: 1, maxLength: 80 },
    ] },
    { name: 'status', description: 'See your registration and available faction places', type: Type.Subcommand },
    { name: 'withdraw', description: 'Cancel your registration and remove your campaign role', type: Type.Subcommand },
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
  const serialize = action => { const result = queue.then(action); queue = result.catch(() => {}); return result }
  async function setupRoles() {
    if (!guild) throw Error('Campaign Discord server is unavailable.')
    roles = await provisionCampaignRoles(guild); available = true; issue = ''
  }
  async function assign(player) {
    const role = roles.get(player.faction)
    const member = await guild.members.fetch(player.userId)
    await member.roles.add(role.id, 'Aurora VII faction registration')
    await store.assigned(player.userId)
  }
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
          const player = await store.player(interaction.user.id)
          if (!player) { await reply('You are not registered for Aurora VII.'); return }
          await setupRoles()
          const member = await guild.members.fetch(interaction.user.id)
          await member.roles.remove(roles.get(player.faction).id, 'Player withdrew from Aurora VII')
          try { await store.remove(player.userId) }
          catch (error) { await member.roles.add(roles.get(player.faction).id, 'Restore role after registration storage failure').catch(() => {}); throw error }
          await reply('You have withdrawn from Aurora VII. Your campaign role has been removed and your faction place is available again.'); return
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
      const message = /^(You are already|Choose one|Enter a player|That player|That faction|Registration is temporarily)/.test(error.message) ? error.message : 'Registration could not be completed. Your existing place has not been changed. Please try again or contact Lobo.'
      await reply(message)
    }
    return true
  }
  return {
    handler,
    summary: async () => ({ ...await store.summary(), available, issue, channelsReady, channelCount }),
    async start(client, { port = Number(process.env.PORT || 8080), serve = true } = {}) {
      guild = client.guilds.cache.get(AURORA_DISCORD_GUILD_ID)
      if (!guild) throw Error('Aurora VII server is not connected to this bot.')
      const commands = await guild.commands.fetch(), existing = commands.find(command => command.name === 'aurora')
      if (existing) await existing.edit(AURORA_COMMAND_DEFINITION)
      else await guild.commands.create(AURORA_COMMAND_DEFINITION)
      await recover()
      timer = setInterval(() => recover().catch(() => logger.error?.('Aurora VII recovery is temporarily unavailable.')), 60000); timer.unref()
      if (serve) {
        server = createServer(async (request, response) => {
          response.setHeader('content-type', 'application/json; charset=utf-8'); response.setHeader('x-content-type-options', 'nosniff')
          response.setHeader('cache-control', 'no-store')
          if (request.method !== 'GET' || request.url !== '/aurora-vii/registration') { response.writeHead(404); response.end('{"error":"Not found"}'); return }
          try { response.end(JSON.stringify({ ...await store.summary(), available, issue, channelsReady, channelCount })) }
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
