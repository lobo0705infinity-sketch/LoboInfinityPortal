import { ApplicationCommandOptionType } from 'discord.js'
import { loadProductionRulesCorpus } from './infinity-rules-service.mjs'
import { createDeepSeekRulesAnswer } from './deepseek-rules.mjs'
import { findApprovedRulesAnswer } from './rules-benchmark.mjs'

export const RULES_COMMAND = 'rules'
export const RULES_OPTION = 'question'
export const RULES_COMMAND_DEFINITION = Object.freeze({ name: RULES_COMMAND, description: 'Ask the current official Infinity rules', options: [{ name: RULES_OPTION, description: 'Infinity rules question', required: true, type: ApplicationCommandOptionType.String, max_length: 1000 }] })

export async function ensureRulesCommand(client) {
  if (!client?.guilds?.cache) return []
  const registered = []
  for (const guild of client.guilds.cache.values()) {
    const commands = await guild.commands.fetch(); let command = commands.find((candidate) => candidate.name === RULES_COMMAND)
    if (!command) command = await guild.commands.create(RULES_COMMAND_DEFINITION); else if (!matches(command)) command = await command.edit(RULES_COMMAND_DEFINITION)
    registered.push({ applicationId: command.applicationId, guildId: guild.id, id: command.id })
  }
  const globals = await client.application.commands.fetch(); const obsolete = globals.find((command) => command.name === RULES_COMMAND); if (obsolete) await obsolete.delete()
  return registered
}

export async function retrieveRulesReference({ question, deepSeek = createDeepSeekRulesAnswer() }) {
  const corpus = await loadProductionRulesCorpus()
  const benchmark = await findApprovedRulesAnswer(question)
  if (benchmark) return benchmarkResult(question, benchmark, corpus)
  return deepSeek({ question, corpus })
}

export function createRulesInteractionHandler({ retrieve = retrieveRulesReference, logger = console } = {}) {
  return async function handleRules(interaction) {
    if (!interaction?.isChatInputCommand?.() || interaction.commandName !== RULES_COMMAND) return false
    try {
      await interaction.deferReply(); const question = interaction.options.getString(RULES_OPTION, true).trim()
      if (!question) { await interaction.editReply({ content: 'Please provide an Infinity rules question.' }); return true }
      await interaction.editReply(formatRulesDiscordResponse(await retrieve({ question })))
    } catch (error) {
      logger.error?.('Infinity rules request failed:', error); const message = { content: 'The Infinity rules assistant is temporarily unavailable.' }
      try { if (interaction.deferred || interaction.replied) await interaction.editReply(message); else await interaction.reply({ ...message, ephemeral: true }) } catch (replyError) { logger.error?.('Infinity rules Discord error response failed:', replyError) }
    }
    return true
  }
}

export function formatRulesDiscordResponse(result) {
  const fields = []
  if (result.deepSeek) {
    const conclusion = normalizeConclusion(result.deepSeek.conclusion)
    const certainty = result.deepSeek.certainty === 'EVIDENCE-BOUNDED INTERPRETATION' ? 'EVIDENCE-BOUNDED INTERPRETATION' : 'EXPLICIT RULES ANSWER'
    const answer = scrubInternalIds(result.deepSeek.answer) || 'The rules assistant did not return an answer.'
    const provenance = result.answerSource === 'APPROVED_BENCHMARK' ? '**APPROVED BENCHMARK ANSWER**\n' : ''
    fields.push({ name: 'ANSWER', value: truncate(`${provenance}**${certainty}**\n**${conclusion}**\n${answer}`, 1024), inline: false })
    const citations = formatCitations(result.deepSeek.sources || []); if (citations) fields.push({ name: 'OFFICIAL SOURCES', value: truncate(citations, 1024), inline: false })
  } else fields.push({ name: 'STATUS', value: `**${result.status || 'AI RULES ANSWER UNAVAILABLE'}**\n${result.limitation || 'No answer was returned.'}`, inline: false })
  const versions = (result.versions || []).map((item) => item.label).join(' • ')
  const method = result.answerSource === 'APPROVED_BENCHMARK' ? 'Approved answer matched before AI; no provider call.' : 'AI answer from selected official evidence.'
  return scrubDiscordPayload({ embeds: [{ title: 'Infinity Rules Assistant', description: truncate(`**Question**\n${result.question}`, 1000), color: 0x8b1e2d, fields, footer: { text: truncate(`Activated corpus: ${versions} • ${method}`, 2048) } }], allowedMentions: { parse: [] } })
}

function benchmarkResult(question, benchmark, corpus) {
  const sources = benchmark.citations.map((citation, index) => {
    const source = corpus.manifest.sources.find((item) => item.id === citation.sourceId)
    return { id: `B${String(index + 1).padStart(4, '0')}`, title: source?.title || citation.sourceId, version: source?.version, page: `p. ${citation.page}`, section: citation.section, url: source?.officialUrl }
  })
  return {
    question: String(question || '').trim(),
    versions: corpus.manifest.sources.map((source) => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : `${source.title} ${source.version}` })),
    status: 'APPROVED BENCHMARK ANSWER',
    answerSource: 'APPROVED_BENCHMARK',
    benchmark: { id: benchmark.id, queryId: benchmark.queryId, matchType: benchmark.matchType, score: benchmark.score },
    deepSeek: { answer: benchmark.answer, conclusion: benchmark.conclusion, certainty: benchmark.certainty, interpretationRequired: benchmark.certainty === 'EVIDENCE-BOUNDED INTERPRETATION', sources },
  }
}

function formatCitations(sources) { return sources.slice(0, 8).map((source) => { const label = [source.title, source.version, source.page, source.section].filter(Boolean).join(' — '); return source.url ? `• [${label}](${source.url})` : `• ${label}` }).join('\n') }
function scrubInternalIds(value) { return String(value ?? '').replace(/\bC\d{4}\b/g, '').replace(/\s{2,}/g, ' ').trim() }
function scrubDiscordPayload(value, key = '') { if (Array.isArray(value)) return value.map((item) => scrubDiscordPayload(item)).filter((item) => item !== undefined); if (value && typeof value === 'object') { const out = {}; for (const [name, item] of Object.entries(value)) { const clean = scrubDiscordPayload(item, name); if (clean === undefined) continue; if (typeof clean === 'string' && !clean.trim() && ['name', 'value', 'url', 'text'].includes(name)) continue; out[name] = clean } return out } if (value === undefined || value === null) return undefined; return value }
function truncate(value, max) { const text = String(value ?? ''); return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).replace(/\s+\S*$/, '').trim()}…` }
function normalizeConclusion(value) { const normalized = String(value || '').trim().toUpperCase(); if (normalized === 'RULE') return 'INTERPRETATION'; return ['YES', 'NO', 'DEPENDS', 'UNRESOLVED', 'INTERPRETATION'].includes(normalized) ? normalized : 'UNRESOLVED' }
function matches(command) { const option = command.options?.[0]; return command.description === RULES_COMMAND_DEFINITION.description && command.options?.length === 1 && option?.name === RULES_OPTION && option?.required === true && option?.type === ApplicationCommandOptionType.String && option?.maxLength === 1000 }
