import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const DEFAULT_USAGE_PATH = resolve(import.meta.dirname, '..', '.tmp', 'deepseek-rules-usage.json')
const V4_FLASH_PRICING = Object.freeze({
  offPeak: { cacheHitInput: 0.007, cacheMissInput: 0.22, output: 0.66 },
  peak: { cacheHitInput: 0.014, cacheMissInput: 0.44, output: 1.32 },
})
const MAX_OUTPUT_TOKENS = 1800
const ESTIMATED_TOKENS_PER_CHARACTER = 0.3
let cachedCorpusPrompt

export function buildCompleteCorpusPrompt(corpus) {
  if (cachedCorpusPrompt?.corpus === corpus) return cachedCorpusPrompt.text
  if (!corpus?.manifest?.sources?.length || !corpus?.chunks?.length) throw new Error('The complete rules corpus is unavailable.')
  const sources = corpus.manifest.sources.map((source) => ({ id: source.id, title: source.title, version: source.version, officialUrl: source.officialUrl }))
  const entries = corpus.chunks.map((chunk, index) => ({
    id: `C${String(index + 1).padStart(4, '0')}`,
    sourceId: chunk.sourceId,
    page: chunk.printedPage || `PDF ${chunk.pdfPage}`,
    section: chunk.section,
    text: chunk.text,
  }))
  const text = [
    'You are the rules assistant for Corvus Belli Infinity. The complete activated rules corpus follows.',
    'Answer the user question from this corpus only. Apply FAQ precedence and ITS rules only in ITS contexts.',
    'Read across every relevant rule and exception yourself. Do not ask the caller to search, retrieve, validate, or interpret rules for you.',
    'Return JSON only with exactly these fields: answer (string), conclusion (YES, NO, DEPENDS, UNRESOLVED, or INTERPRETATION), certainty (EXPLICIT RULES ANSWER or EVIDENCE-BOUNDED INTERPRETATION), and citationIds (array of corpus entry IDs).',
    'Use EXPLICIT RULES ANSWER when the corpus directly states the answer, even if supporting context spans several entries. Use EVIDENCE-BOUNDED INTERPRETATION when the exact result must be inferred. Use UNRESOLVED when the corpus cannot answer.',
    'Cite only entry IDs that directly support the answer. Never mention entry IDs in the prose answer.',
    JSON.stringify({ sources, entries }),
  ].join('\n')
  cachedCorpusPrompt = { corpus, text }
  return text
}

export function createDeepSeekRulesAnswer({ fetchImpl = fetch, usagePath = process.env.DEEPSEEK_USAGE_PATH || DEFAULT_USAGE_PATH, now = () => Date.now(), logger = console } = {}) {
  return async function answerRulesQuestion({ question, corpus }) {
    const cleanQuestion = String(question || '').trim()
    if (!cleanQuestion) throw new Error('A rules question is required.')
    if (cleanQuestion.length > 1000) throw new Error('Rules question exceeds 1000 characters.')
    const key = String(process.env.DEEPSEEK_API_KEY || '')
    const model = String(process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash')
    const versions = buildVersions(corpus)
    if (!key) return unavailable(cleanQuestion, versions, 'DeepSeek is not configured.')

    const corpusPrompt = buildCompleteCorpusPrompt(corpus)
    const usage = await readUsage(usagePath, logger)
    const timestamp = now()
    const limits = { hourly: Number(process.env.DEEPSEEK_HOURLY_LIMIT_USD || 1), monthly: Number(process.env.DEEPSEEK_MONTHLY_LIMIT_USD || 10) }
    const hourly = usage.records.filter((item) => timestamp - item.timestamp < 60 * 60 * 1000).reduce((sum, item) => sum + item.cost, 0)
    const monthKey = calendarMonth(timestamp)
    const monthly = usage.records.filter((item) => calendarMonth(item.timestamp) === monthKey).reduce((sum, item) => sum + item.cost, 0)
    const estimatedInputTokens = Math.ceil((corpusPrompt.length + cleanQuestion.length) * ESTIMATED_TOKENS_PER_CHARACTER)
    // Cache hits are best-effort, so admission control assumes a peak-rate cache miss.
    const preflightCost = estimatedInputTokens / 1e6 * V4_FLASH_PRICING.peak.cacheMissInput + MAX_OUTPUT_TOKENS / 1e6 * V4_FLASH_PRICING.peak.output
    if (hourly + preflightCost > limits.hourly || monthly + preflightCost > limits.monthly) return unavailable(cleanQuestion, versions, 'DeepSeek spending limit reached.')

    try {
      const response = await fetchImpl('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: MAX_OUTPUT_TOKENS,
          response_format: { type: 'json_object' },
          thinking: { type: 'disabled' },
          messages: [{ role: 'system', content: corpusPrompt }, { role: 'user', content: cleanQuestion }],
        }),
        signal: AbortSignal.timeout(120000),
      })
      const responseText = await response.text()
      if (!response.ok) return unavailable(cleanQuestion, versions, `DeepSeek was unavailable (HTTP ${response.status}).`)
      if (!String(response.headers?.get?.('content-type') || '').toLowerCase().includes('application/json') || !responseText.trim()) return unavailable(cleanQuestion, versions, 'DeepSeek returned an unusable response.')
      let payload
      try { payload = JSON.parse(responseText) } catch { return unavailable(cleanQuestion, versions, 'DeepSeek returned an unusable response.') }
      const charge = await recordProviderUsage({ payload, usage, usagePath, now: timestamp, model })
      const choice = payload?.choices?.[0]
      if (choice?.finish_reason === 'length' || choice?.message?.tool_calls?.length) return unavailable(cleanQuestion, versions, 'DeepSeek did not complete its answer.')
      let parsed
      try { parsed = JSON.parse(choice?.message?.content) } catch { return unavailable(cleanQuestion, versions, 'DeepSeek returned an unusable answer.') }
      const checked = validateDirectAnswer(parsed, corpus)
      if (!checked.ok) {
        logger.warn?.(`DeepSeek rules output rejected mechanically: ${checked.reason}`)
        return unavailable(cleanQuestion, versions, 'DeepSeek returned an unusable answer.')
      }
      logger.info?.(`DeepSeek rules request: provider_calls=1 prompt_tokens=${charge.promptTokens} cache_hit_tokens=${charge.cacheHitTokens} cache_miss_tokens=${charge.cacheMissTokens} completion_tokens=${charge.completionTokens} rate_period=${charge.ratePeriod} cost_usd=${charge.cost.toFixed(6)} outcome=answered`)
      return {
        question: cleanQuestion,
        versions,
        status: 'DEEPSEEK RULES ANSWER',
        deepSeek: {
          answer: parsed.answer.trim(),
          conclusion: parsed.conclusion,
          certainty: parsed.certainty,
          interpretationRequired: parsed.certainty === 'EVIDENCE-BOUNDED INTERPRETATION',
          sources: mapCitations(parsed.citationIds, corpus),
        },
      }
    } catch (error) {
      logger.warn?.(`DeepSeek rules provider error: ${error instanceof Error ? error.message : 'request failed'}`)
      return unavailable(cleanQuestion, versions, 'DeepSeek was unavailable.')
    }
  }
}

export const createDeepSeekFallback = createDeepSeekRulesAnswer

export function validateDirectAnswer(parsed, corpus) {
  if (!parsed || typeof parsed.answer !== 'string' || !parsed.answer.trim()) return { ok: false, reason: 'missing answer' }
  if (!['YES', 'NO', 'DEPENDS', 'UNRESOLVED', 'INTERPRETATION'].includes(parsed.conclusion)) return { ok: false, reason: 'invalid conclusion' }
  if (!['EXPLICIT RULES ANSWER', 'EVIDENCE-BOUNDED INTERPRETATION'].includes(parsed.certainty)) return { ok: false, reason: 'invalid certainty' }
  if (!Array.isArray(parsed.citationIds)) return { ok: false, reason: 'missing citationIds' }
  if (parsed.conclusion !== 'UNRESOLVED' && parsed.citationIds.length === 0) return { ok: false, reason: 'missing citations' }
  const maximum = corpus?.chunks?.length || 0
  if (parsed.citationIds.some((id) => !/^C\d{4}$/.test(id) || Number(id.slice(1)) < 1 || Number(id.slice(1)) > maximum)) return { ok: false, reason: 'invalid citation ID' }
  return { ok: true }
}

function mapCitations(ids, corpus) {
  return [...new Set(ids)].map((id) => {
    const chunk = corpus.chunks[Number(id.slice(1)) - 1]
    const source = corpus.manifest.sources.find((item) => item.id === chunk.sourceId)
    return { id, title: source?.title || chunk.title, version: source?.version || chunk.version, page: chunk.printedPage || `PDF ${chunk.pdfPage}`, section: chunk.section, url: source?.officialUrl || chunk.sourceUrl }
  })
}
function buildVersions(corpus) { return (corpus?.manifest?.sources || []).map((source) => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : `${source.title} ${source.version}` })) }
function unavailable(question, versions, limitation) { return { question, versions, status: 'AI RULES ANSWER UNAVAILABLE', limitation } }
function calendarMonth(timestamp) { const date = new Date(Number(timestamp)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}` }
export function calculateDeepSeekV4FlashCost(apiUsage, timestamp) {
  const promptTokens = Math.max(0, Number(apiUsage?.prompt_tokens || 0))
  const completionTokens = Math.max(0, Number(apiUsage?.completion_tokens || 0))
  const reportedHit = Math.max(0, Number(apiUsage?.prompt_cache_hit_tokens || 0))
  const reportedMiss = Math.max(0, Number(apiUsage?.prompt_cache_miss_tokens || 0))
  const hasCacheBreakdown = Number.isFinite(Number(apiUsage?.prompt_cache_hit_tokens)) && Number.isFinite(Number(apiUsage?.prompt_cache_miss_tokens))
  const cacheHitTokens = hasCacheBreakdown ? Math.min(promptTokens, reportedHit) : 0
  const cacheMissTokens = hasCacheBreakdown ? Math.max(0, Math.min(promptTokens, reportedMiss) + Math.max(0, promptTokens - reportedHit - reportedMiss)) : promptTokens
  const peak = isDeepSeekPeakPeriod(timestamp)
  const rates = peak ? V4_FLASH_PRICING.peak : V4_FLASH_PRICING.offPeak
  const cost = cacheHitTokens / 1e6 * rates.cacheHitInput + cacheMissTokens / 1e6 * rates.cacheMissInput + completionTokens / 1e6 * rates.output
  return { promptTokens, completionTokens, cacheHitTokens, cacheMissTokens, ratePeriod: peak ? 'peak' : 'off-peak', cost }
}

export function isDeepSeekPeakPeriod(timestamp) {
  const date = new Date(Number(timestamp))
  const day = date.getUTCDay()
  const hour = date.getUTCHours()
  return day >= 1 && day <= 5 && ((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10))
}

async function recordProviderUsage({ payload, usage, usagePath, now, model }) {
  const charge = calculateDeepSeekV4FlashCost(payload?.usage, now)
  if (payload?.usage) {
    usage.records.push({ timestamp: now, cost: charge.cost, promptTokens: charge.promptTokens, completionTokens: charge.completionTokens, cacheHitTokens: charge.cacheHitTokens, cacheMissTokens: charge.cacheMissTokens, ratePeriod: charge.ratePeriod, model, outcome: 'provider-response' })
    await writeUsage(usagePath, usage)
  }
  return charge
}

export async function readUsage(path, logger = console) {
  try {
    const raw = await readFile(path, 'utf8')
    if (!raw.trim()) return { records: [] }
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.records) || parsed.records.some((item) => !item || !Number.isFinite(Number(item.timestamp)) || !Number.isFinite(Number(item.cost)))) throw new Error('invalid usage ledger schema')
    return { records: parsed.records }
  } catch (error) {
    if (error?.code !== 'ENOENT') logger.warn?.(`DeepSeek rules usage ledger error: ${error instanceof Error ? error.message : 'unreadable ledger'}; starting with zero usage`)
    return { records: [] }
  }
}
export async function writeUsage(path, usage) { await mkdir(dirname(path), { recursive: true }); const temp = `${path}.${process.pid}.tmp`; await writeFile(temp, `${JSON.stringify({ records: usage.records })}\n`, 'utf8'); await rename(temp, path) }
