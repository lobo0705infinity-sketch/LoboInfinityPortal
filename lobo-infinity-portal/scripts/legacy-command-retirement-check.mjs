import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Collection } from 'discord.js'
import { LEGACY_SLASH_REPLACEMENTS, retireLegacySlashCommands } from '../bot/grouped-commands.mjs'
const legacyNames = Object.keys(LEGACY_SLASH_REPLACEMENTS)
function fixture() {
  const deleted = []
  function manager(scope, names) {
    const registry = new Collection()
    for (const [index, name] of names.entries()) {
      const id = `${scope}-${index}`
      registry.set(id, { id, name, type: 1, applicationId: 'app', delete: async () => { deleted.push(`${scope}:${name}`); registry.delete(id) } })
    }
    registry.set('foreign', { name: 'inf-list', type: 1, applicationId: 'other', delete: async () => assert.fail('foreign application deletion') })
    registry.set('context', { name: 'build-list', type: 2, applicationId: 'app', delete: async () => assert.fail('context menu deletion') })
    return { registry, fetch: async () => new Collection(registry) }
  }
  const guild = manager('guild', [...legacyNames, 'list', 'combat', 'play', 'admin', 'help', 'rules', 'mission', 'unrelated'])
  const global = manager('global', [...legacyNames, 'unrelated'])
  const client = { application: { id: 'app', commands: global }, guilds: { cache: new Collection([['guild', { id: 'guild', commands: guild }]]) } }
  return { client, guild, global, deleted }
}
const f = fixture()
const result = await retireLegacySlashCommands(f.client)
assert.equal(result.removed.length, 18)
assert.equal(f.deleted.length, 18)
assert.deepEqual(result.remaining[0].names.filter(name => name !== 'build-list'), ['admin','combat','help','list','mission','play','rules','unrelated'])
assert.ok(f.guild.registry.has('foreign')); assert.ok(f.guild.registry.has('context'))
assert.equal((await retireLegacySlashCommands(f.client)).removed.length, 0)
const missing = fixture()
for (const [id, command] of missing.guild.registry) if (command.name === 'list') missing.guild.registry.delete(id)
await assert.rejects(retireLegacySlashCommands(missing.client), /replacement list missing/)
assert.equal(missing.deleted.length, 0)
const failed = fixture()
failed.guild.registry.values().next().value.delete = async () => { throw new Error('Discord denied deletion') }
await assert.rejects(retireLegacySlashCommands(failed.client), /Discord denied deletion/)
const stale = fixture()
stale.guild.registry.values().next().value.delete = async () => {}
await assert.rejects(retireLegacySlashCommands(stale.client), /could not be verified/)
const noGuild = fixture(); noGuild.client.guilds.cache.clear()
assert.deepEqual(await retireLegacySlashCommands(noGuild.client), {removed: [], remaining: []})
assert.equal(noGuild.deleted.length, 0)
const startup = await readFile(new URL('../bot/lobos-little-helper.mjs', import.meta.url), 'utf8')
for (const registration of ['ensureInfListCommand','ensureBuildListCommand','ensureRandomListCommand','ensureInfIdCommand','ensureAroVsCommand','ensureMatchupCommand','ensureMatchmakingCommands','ensureBotReportsCommand']) assert.ok(!startup.includes(registration), registration)
assert.ok(startup.indexOf('await ensureGroupedCommands(client)') < startup.indexOf('await retireLegacySlashCommands(client)'))
console.log('PASS - legacy slash registrations retired in guild/global scope; ownership, replacement checks, idempotence and failures verified.')
