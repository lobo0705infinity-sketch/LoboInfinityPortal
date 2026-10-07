import { prepareInteractiveResponse } from './response-details.mjs'
import { randomUUID, createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, appendFile, readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { PermissionFlagsBits } from 'discord.js'

let cleanupAt = 0
async function pruneContexts(dir) {
  if (Date.now() - cleanupAt < 3600000) return
  cleanupAt = Date.now()
  for (const name of await readdir(join(dir, 'contexts'))) {
    if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue
    const path = join(dir, 'contexts', name)
    if (Date.now() - (await stat(path)).mtimeMs > 30 * 86400000) await unlink(path)
  }
}
const directory = () => process.env.BOT_FEEDBACK_PATH || '/data/bot-feedback'
const commands = new Set(['list', 'combat', 'rules', 'matchup', 'inf-list', 'build-list', 'random-list'])
const safeId = value => /^[a-f0-9-]{36}$/.test(value)
const optionsOf = options => (options || []).map(({ name, value, options }) => ({ name, ...(value == null ? {} : { value }), ...(options ? { options: optionsOf(options) } : {}) }))
const outputOf = payload => ({ content: payload.content || '', embeds: (payload.embeds || []).map(x => x.toJSON?.() || x), files: (payload.files || []).map(x => ({ name: x.name || 'attachment', ...(Buffer.isBuffer(x.attachment) && /\.txt$/.test(x.name || '') ? { text: x.attachment.toString('utf8') } : Buffer.isBuffer(x.attachment) ? { bytes:x.attachment.length, sha256:createHash('sha256').update(x.attachment).digest('hex') } : {}) })) })

export async function reportableResponse(payload, context, { dir = directory() } = {}) {
  if (typeof payload === 'string') payload = { content: payload }
  payload = await prepareInteractiveResponse(payload, context)
  const id = randomUUID()
  await mkdir(join(dir, 'contexts'), { recursive: true })
  await pruneContexts(dir)
  await writeFile(join(dir, 'contexts', `${id}.json`), JSON.stringify({ id, at: new Date().toISOString(), ...context, output: outputOf(payload) }), { mode: 0o600 })
  return { ...payload, components: [...(payload.components || []), { type: 1, components: [{ type: 2, style: 2, label: 'Report incorrect answer', custom_id: `bot-report:${id}` }] }] }
}

// Wrap only the selected commands, before their handlers run. Each follow-up
// receives its own context so reports refer to the exact list/answer selected.
export function installFeedbackCapture(interaction, { logger = console } = {}) {
  if (!interaction?.isChatInputCommand?.() || !commands.has(interaction.commandName)) return
  const context = { command: interaction.commandName, inputs: optionsOf(interaction.options?.data), guildId: interaction.guildId, requesterId: interaction.user?.id }
  for (const method of ['editReply', 'followUp']) {
    const original = interaction[method].bind(interaction)
    interaction[method] = async payload => {
      let response = payload
      try { response = await reportableResponse(payload, context) }
      catch (error) { logger.error('Bot report context could not be saved:', error.message) }
      return original(response)
    }
  }
}

export function createBotFeedbackHandler({ dir = directory(), logger = console } = {}) {
  return async interaction => {
    try {
      if (interaction.isChatInputCommand?.() && interaction.commandName === 'bot-reports') {
        if (!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.reply({ content: 'Server managers can review reports.', flags: 64 }); return true
        }
        await interaction.deferReply({ flags: 64 })
        let records = []
        try { records = (await readFile(join(dir, 'reports.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse) }
        catch (error) { if (error.code !== 'ENOENT') throw error }
        records = records.filter(x => x.guildId === interaction.guildId).slice(-25)
        await interaction.editReply({ content: `${records.length} recent reports for this server. Inputs, returned text, attachment fingerprints and source message links are included.`, files: records.length ? [{ attachment: Buffer.from(JSON.stringify(records, null, 2)), name: 'bot-reports.json' }] : [], allowedMentions: { parse: [] } }); return true
      }
      if (interaction.isButton?.() && interaction.customId.startsWith('bot-report:')) {
        const id = interaction.customId.slice('bot-report:'.length)
        if (!safeId(id) || interaction.message?.author?.id !== interaction.client.user.id) return false
        await interaction.showModal({ custom_id: `bot-report-submit:${id}`, title: 'Report incorrect answer', components: [{ type: 1, components: [{ type: 4, custom_id: 'reason', label: 'What is wrong? Include a source if available.', style: 2, required: true, max_length: 1500 }] }] }); return true
      }
      if (interaction.isModalSubmit?.() && interaction.customId.startsWith('bot-report-submit:')) {
        const id = interaction.customId.slice('bot-report-submit:'.length)
        if (!safeId(id)) return false
        await interaction.deferReply({ flags: 64 })
        const context = JSON.parse(await readFile(join(dir, 'contexts', `${id}.json`), 'utf8'))
        if (context.guildId !== interaction.guildId) throw Error('Report belongs to another server')
        await mkdir(join(dir, 'submitted'), { recursive: true })
        try { await writeFile(join(dir, 'submitted', `${id}-${interaction.user.id}`), '', { flag: 'wx', mode: 0o600 }) }
        catch (error) { if (error.code !== 'EEXIST') throw error; await interaction.editReply('You already reported this answer.'); return true }
        const record = { ...context, reportedAt: new Date().toISOString(), reporterId: interaction.user.id, reason: interaction.fields.getTextInputValue('reason'), messageUrl: interaction.message?.url || null }
        try { await appendFile(join(dir, 'reports.jsonl'), `${JSON.stringify(record)}\n`, { mode: 0o600 }) }
        catch (error) { await unlink(join(dir, 'submitted', `${id}-${interaction.user.id}`)); throw error }
        await interaction.editReply('Report saved. Server managers can review it with /bot-reports.'); return true
      }
    } catch (error) {
      logger.error('Bot feedback failed:', error.message)
      const reply = { content: 'The report could not be saved or loaded. Please try again.', flags: 64 }
      try { if (interaction.deferred || interaction.replied) await interaction.editReply({ content: reply.content }); else await interaction.reply(reply) } catch {}
      return true
    }
    return false
  }
}

export async function ensureBotReportsCommand(client) {
  for (const guild of client.guilds.cache.values()) {
    await guild.commands.create({ name: 'bot-reports', description: 'Review recent incorrect-answer reports for this server', defaultMemberPermissions: PermissionFlagsBits.ManageGuild })
  }
}
