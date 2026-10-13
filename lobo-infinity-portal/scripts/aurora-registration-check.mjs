import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRegistrationStore } from '../bot/aurora-registration-store.mjs'
import { AURORA_COMMAND_DEFINITION, createAuroraRegistrationService, provisionCampaignRoles } from '../bot/aurora-registration-command.mjs'
import { AURORA_DISCORD_GUILD_ID, AURORA_REGISTRATION_FACTIONS as factions } from '../shared/aurora-registration.mjs'
import { readRegistration } from '../api/aurora-registration.mjs'

const directory = await mkdtemp(join(tmpdir(), 'aurora-registration-'))
try {
  const path = join(directory, 'players.json'), store = createRegistrationStore(path)
  let sequence = 10000000000000000n
  const player = faction => { const id = String(sequence++); return { userId: id, name: `Player ${id}`, faction } }
  const contenders = Array.from({ length: 15 }, () => player('pano'))
  const results = await Promise.allSettled(contenders.map(input => store.register(input)))
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 5)
  assert.equal((await store.summary()).cap, 5)
  assert.equal((await store.summary()).total, 5)
  assert.equal((await store.register(contenders[0])).userId, contenders[0].userId)
  await assert.rejects(store.register({ ...player('ariadna'), name: contenders[0].name.toUpperCase() }), /already registered/)
  await assert.rejects(store.register({ ...contenders[0], faction: 'ariadna' }), /another faction/)
  await assert.rejects(store.register(player('nomads')), /eligible/)
  for (const faction of factions.slice(1)) for (let i = 0; i < 5; i++) await store.register(player(faction.id))
  assert.equal((await store.summary()).cap, 10)
  for (const faction of factions) for (let i = 0; i < 5; i++) await store.register(player(faction.id))
  assert.equal((await store.summary()).cap, 15)
  assert.equal((await store.summary()).total, 100)
  // Restart, withdrawals and refilling never lower an unlocked tier.
  const restarted = createRegistrationStore(path)
  await restarted.remove(contenders[0].userId)
  assert.equal((await restarted.summary()).cap, 15)
  await restarted.register(player('pano'))
  for (const faction of factions) for (let i = 0; i < 5; i++) await restarted.register(player(faction.id))
  assert.equal((await restarted.summary()).total, 150)
  assert.equal((await restarted.summary()).cap, 20)
  const awaitSummary = await restarted.summary()
  const projected = await readRegistration(async () => ({ ok: true, json: () => ({ ...awaitSummary, available: true, secret: 'private' }) }))
  assert.equal(projected.total, 150)
  assert(!JSON.stringify(projected).includes('Player'))
  assert(!JSON.stringify(projected).includes('secret'))
  await writeFile(path, '{bad-json')
  await assert.rejects(restarted.summary())
  await assert.rejects(restarted.register(player('pano')))
  assert.equal(await readFile(path, 'utf8'), '{bad-json')

  const roleMap = new Map(), created = [], assignments = []
  let denyAssignment = false, allowRoles = true
  const guild = {
    id: AURORA_DISCORD_GUILD_ID,
    members: {
      fetchMe: async () => ({ permissions: { has: () => allowRoles } }),
      fetch: async userId => ({ roles: {
        add: async roleId => { if (denyAssignment) throw Error('Discord failure'); assignments.push({ userId, roleId }) },
        remove: async () => {},
      } }),
    },
    roles: {
      fetch: async () => roleMap,
      create: async options => { const role = { id: String(roleMap.size), name: options.name, editable: true, managed: false, permissions: { bitfield: 0n } }; roleMap.set(role.id, role); created.push(options); return role },
    },
    commands: { fetch: async () => ({ find: () => null }), create: async definition => assert.equal(definition.name, 'aurora') },
  }
  assert.equal((await provisionCampaignRoles(guild)).size, 10)
  await provisionCampaignRoles(guild)
  assert.equal(created.length, 10); assert(created.every(role => role.permissions.length === 0 && role.mentionable === false))
  allowRoles = false
  await assert.rejects(provisionCampaignRoles(guild), /Manage Roles/)
  allowRoles = true
  const serviceStore = createRegistrationStore(join(directory, 'service.json'))
  const service = createAuroraRegistrationService({ store: serviceStore, logger: { info() {}, error() {} } })
  await service.start({ guilds: { cache: new Map([[guild.id, guild]]) } }, { serve: false })
  const user = player('ariadna')
  function interaction(command, guildId = guild.id) {
    const replies = []
    return { commandName: 'aurora', guildId, user: { id: user.userId }, isChatInputCommand: () => true,
      options: { getSubcommand: () => command, getString: name => name === 'faction' ? user.faction : user.name },
      deferReply: async options => assert.equal(options.flags, 64), editReply: async response => replies.push(response), replies }
  }
  denyAssignment = true
  const first = interaction('register'); await service.handler(first)
  assert.match(first.replies[0].content, /reserved/)
  assert.equal((await serviceStore.player(user.userId)).roleStatus, 'pending')
  denyAssignment = false; await service.recover()
  assert.equal((await serviceStore.player(user.userId)).roleStatus, 'assigned')
  const duplicate = interaction('register'); await service.handler(duplicate)
  assert.equal((await service.summary()).total, 1)
  const wrongServer = interaction('register', 'other'); await service.handler(wrongServer)
  assert.match(wrongServer.replies[0].content, /Lobo’s Discord/)
  const withdraw = interaction('withdraw'); await service.handler(withdraw)
  assert.equal((await service.summary()).total, 0)
  service.stop()
  assert.equal(AURORA_COMMAND_DEFINITION.options[0].options[0].choices.length, 10)
  console.log('PASS: concurrency, duplicate identity/name checks, exact faction allowlist, 5/10/15/20 tiers, restart persistence, withdrawals, corrupt-ledger safety, count-only projection, role creation/permissions, assignment retries and server scope.')
} finally { await rm(directory, { recursive: true, force: true }) }
