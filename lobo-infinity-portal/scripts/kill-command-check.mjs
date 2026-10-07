import assert from 'node:assert/strict'
import { ApplicationCommandManager, CommandInteractionOptionResolver, Events } from 'discord.js'
import { readFile } from 'node:fs/promises'
import { KILL_COMMAND_DEFINITION, LOBO_DEATH_GIF, createKillInteractionHandler } from '../bot/kill-command.mjs'
import { GROUPED_COMMAND_DEFINITIONS } from '../bot/grouped-commands.mjs'
import { createLobosLittleHelper } from '../bot/lobos-little-helper.mjs'

const api = ApplicationCommandManager.transformCommand(KILL_COMMAND_DEFINITION)
assert.equal(api.name, 'kill')
assert.equal(api.options[0].name, 'lobo')
assert.equal(api.options[0].type, 1)
assert.ok(GROUPED_COMMAND_DEFINITIONS.includes(KILL_COMMAND_DEFINITION))
const gif = await readFile(LOBO_DEATH_GIF)
assert.equal(gif.subarray(0, 6).toString(), 'GIF89a')
assert.ok(gif.length < 8 * 1024 * 1024)

function fixture(commandName = 'kill', subcommand = 'lobo') {
  const client = { user: { id: 'bot' } }
  return {
    client, commandName, replies: [], isChatInputCommand: () => true,
    options: new CommandInteractionOptionResolver(client, [{ name: subcommand, type: 1 }], {}),
    async deferReply(options) { this.deferred = true; this.deferOptions = options },
    async editReply(payload) { this.replies.push(payload) },
    async reply(payload) { this.replies.push(payload) },
  }
}
// Dispatch through the running worker's actual listeners without logging in or posting.
const client = createLobosLittleHelper()
const interaction = fixture()
for (const handler of client.listeners(Events.InteractionCreate)) await handler(interaction)
assert.equal(interaction.replies.length, 1)
assert.ok(interaction.deferred)
assert.equal(interaction.deferOptions, undefined, 'GIF is visible in the channel')
assert.equal(interaction.replies[0].content, '**TELL EVERYONE I DIED COOL.**')
assert.deepEqual(interaction.replies[0].files[0].attachment, gif)
assert.equal(interaction.replies[0].files[0].name, 'lobo-dramatic-death.gif')
assert.deepEqual(interaction.replies[0].allowedMentions, { parse: [] })
const handle = createKillInteractionHandler()
assert.equal(await handle(fixture('rules')), false)
assert.equal(await handle(fixture('kill', 'other')), false)
assert.equal(await handle({ isChatInputCommand: () => false }), false)
const failed = fixture()
await createKillInteractionHandler({ loadGif: async () => { throw new Error('missing asset') }, logger: { error() {} } })(failed)
assert.match(failed.replies[0].content, /technical difficulties/)
const deferredFailure = fixture()
deferredFailure.deferReply = async () => { throw new Error('cannot defer') }
await createKillInteractionHandler({ logger: { error() {} } })(deferredFailure)
assert.equal(deferredFailure.replies[0].flags, 64)
client.destroy()
console.log('PASS - /kill lobo SDK definition, worker dispatch, public GIF, isolation and failure replies.')
