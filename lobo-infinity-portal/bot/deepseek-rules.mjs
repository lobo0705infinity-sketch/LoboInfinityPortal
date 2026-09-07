import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const DEFAULT_USAGE_PATH = resolve(import.meta.dirname, '..', '.tmp', 'deepseek-rules-usage.json')
const V4_PRO_PRICING = Object.freeze({
  offPeak: { cacheHitInput: 0.022, cacheMissInput: 0.66, output: 1.98 },
  peak: { cacheHitInput: 0.044, cacheMissInput: 1.32, output: 3.96 },
})
const DEEPSEEK_RULES_MODEL = 'deepseek-v4-pro'
const MAX_OUTPUT_TOKENS = 4000
const REQUEST_TIMEOUT_MS = 60000
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
    'Before answering, silently translate informal player wording into the practical rules question. For example, "breaks Stealth" means the declaration causes the Trooper to lose Stealth protection and permits an otherwise-suppressed ARO; it does not mean permanently removing the Skill.',
    'Do not silently assume an omitted game state, Turn, active/reactive role, target, declared Skill, range, equipment, or other fact when changing that fact could change the answer. Identify every material ambiguity and evaluate all of its alternatives.',
    'If any material ambiguity has alternatives with different outcomes, conclusion must be DEPENDS, requestedOutcomeApplies must be null, and answer must begin "It depends." Explain each outcome concisely.',
    'Specific interpretation example: "Does Dodge break Stealth?" is ambiguous unless the acting Trooper and Turn are clear. An Active Trooper declaring Dodge does not meet Stealth’s protected-declaration requirements and can permit an otherwise-suppressed ARO; a Reactive Trooper’s Dodge does not use Stealth because Stealth functions during its user’s Active Turn. The unqualified question therefore requires DEPENDS and both cases.',
    'Silently identify every requirement, test whether it is satisfied, determine the practical game result, and then verify that the YES/NO wording agrees with that result. Never state correct premises and then reverse their consequence.',
    'Return JSON only with exactly these fields: questionMeaning (string), questionType (BINARY or EXPLANATORY), materialAmbiguities (array of objects containing missingFact and alternatives, where alternatives is an array of at least two objects containing state and outcome), assumptions (always an empty array), requirementChecks (array of objects containing requirement, satisfied (true, false, or null), explanation, and citationIds), practicalResult (string), requestedOutcomeApplies (boolean or null), answer (string), conclusion (YES, NO, DEPENDS, UNRESOLVED, or INTERPRETATION), certainty (EXPLICIT RULES ANSWER or EVIDENCE-BOUNDED INTERPRETATION), and citationIds (array of corpus entry IDs).',
    'For a BINARY question, requestedOutcomeApplies must be true or false, conclusion must be YES when true and NO when false, and answer must begin with the same Yes or No. For an EXPLANATORY question, requestedOutcomeApplies must be null.',
    'Use EXPLICIT RULES ANSWER when the corpus directly states the answer, even if supporting context spans several entries. Use EVIDENCE-BOUNDED INTERPRETATION when the exact result must be inferred. Use UNRESOLVED when the corpus cannot answer.',
    'Cite only entry IDs that directly support the answer. Never mention entry IDs in the prose answer.',
    JSON.stringify({ sources, entries }),
  ].join('\n')
  cachedCorpusPrompt = { corpus, text }
  return text
}

export function createDeepSeekRulesAnswer({ fetchImpl = fetch, usagePath = process.env.DEEPSEEK_USAGE_PATH || DEFAULT_USAGE_PATH, now = () => Date.now(), logger = console, requestTimeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  return async function answerRulesQuestion({ question, corpus }) {
    const cleanQuestion = String(question || '').trim()
    if (!cleanQuestion) throw new Error('A rules question is required.')
    if (cleanQuestion.length > 1000) throw new Error('Rules question exceeds 1000 characters.')
    const key = String(process.env.DEEPSEEK_API_KEY || '')
    const model = DEEPSEEK_RULES_MODEL
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
    const preflightCost = estimatedInputTokens / 1e6 * V4_PRO_PRICING.peak.cacheMissInput + MAX_OUTPUT_TOKENS / 1e6 * V4_PRO_PRICING.peak.output
    if (hourly + preflightCost > limits.hourly || monthly + preflightCost > limits.monthly) return unavailable(cleanQuestion, versions, 'DeepSeek spending limit reached.')

    try {
      const response = await fetchWithHardTimeout(fetchImpl, 'https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: MAX_OUTPUT_TOKENS,
          response_format: { type: 'json_object' },
          thinking: { type: 'enabled' },
          reasoning_effort: 'high',
          messages: [{ role: 'system', content: corpusPrompt }, { role: 'user', content: cleanQuestion }],
        }),
      }, requestTimeoutMs)
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
      if (error?.code === 'DEEPSEEK_TIMEOUT') return unavailable(cleanQuestion, versions, 'DeepSeek timed out after 60 seconds. Please try again later.')
      return unavailable(cleanQuestion, versions, 'DeepSeek was unavailable.')
    }
  }
}

async function fetchWithHardTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController()
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      const error = new Error('request exceeded its hard deadline')
      error.code = 'DEEPSEEK_TIMEOUT'
      reject(error)
    }, Math.max(1, Number(timeoutMs) || REQUEST_TIMEOUT_MS))
  })
  try {
    return await Promise.race([fetchImpl(url, { ...options, signal: controller.signal }), timeout])
  } finally {
    clearTimeout(timer)
  }
}

export const createDeepSeekFallback = createDeepSeekRulesAnswer

export function validateDirectAnswer(parsed, corpus) {
  if (typeof parsed?.questionMeaning !== 'string' || !parsed.questionMeaning.trim()) return { ok: false, reason: 'missing interpreted question meaning' }
  if (!['BINARY', 'EXPLANATORY'].includes(parsed?.questionType)) return { ok: false, reason: 'invalid question type' }
  if (!Array.isArray(parsed?.requirementChecks) || parsed.requirementChecks.length === 0) return { ok: false, reason: 'missing requirement checks' }
  if (!Array.isArray(parsed?.materialAmbiguities)) return { ok: false, reason: 'missing ambiguity analysis' }
  if (!Array.isArray(parsed?.assumptions) || parsed.assumptions.length !== 0) return { ok: false, reason: 'answer made an unsupported assumption' }
  if (typeof parsed?.practicalResult !== 'string' || !parsed.practicalResult.trim()) return { ok: false, reason: 'missing practical result' }
  if (!parsed || typeof parsed.answer !== 'string' || !parsed.answer.trim()) return { ok: false, reason: 'missing answer' }
  if (!['YES', 'NO', 'DEPENDS', 'UNRESOLVED', 'INTERPRETATION'].includes(parsed.conclusion)) return { ok: false, reason: 'invalid conclusion' }
  if (!['EXPLICIT RULES ANSWER', 'EVIDENCE-BOUNDED INTERPRETATION'].includes(parsed.certainty)) return { ok: false, reason: 'invalid certainty' }
  if (!Array.isArray(parsed.citationIds)) return { ok: false, reason: 'missing citationIds' }
  if (parsed.conclusion !== 'UNRESOLVED' && parsed.citationIds.length === 0) return { ok: false, reason: 'missing citations' }
  const maximum = corpus?.chunks?.length || 0
  const validCitation = (id) => /^C\d{4}$/.test(id) && Number(id.slice(1)) >= 1 && Number(id.slice(1)) <= maximum
  if (parsed.citationIds.some((id) => !validCitation(id))) return { ok: false, reason: 'invalid citation ID' }
  if (parsed.requirementChecks.some((check) => !check || typeof check.requirement !== 'string' || !check.requirement.trim() || ![true, false, null].includes(check.satisfied) || typeof check.explanation !== 'string' || !check.explanation.trim() || !Array.isArray(check.citationIds) || check.citationIds.some((id) => !validCitation(id)))) return { ok: false, reason: 'invalid requirement check' }
  if (parsed.materialAmbiguities.some((ambiguity) => !ambiguity || typeof ambiguity.missingFact !== 'string' || !ambiguity.missingFact.trim() || !Array.isArray(ambiguity.alternatives) || ambiguity.alternatives.length < 2 || ambiguity.alternatives.some((alternative) => !alternative || typeof alternative.state !== 'string' || !alternative.state.trim() || typeof alternative.outcome !== 'string' || !alternative.outcome.trim()))) return { ok: false, reason: 'invalid ambiguity analysis' }
  if (parsed.materialAmbiguities.length > 0) {
    if (parsed.conclusion !== 'DEPENDS' || parsed.requestedOutcomeApplies !== null) return { ok: false, reason: 'ambiguous question must conclude DEPENDS' }
    if (!/^it depends\b/i.test(parsed.answer.trim())) return { ok: false, reason: 'ambiguous answer must explain that it depends' }
  }
  if (parsed.questionType === 'BINARY') {
    if (parsed.materialAmbiguities.length > 0) return { ok: true }
    if (typeof parsed.requestedOutcomeApplies !== 'boolean') return { ok: false, reason: 'binary answer is missing its outcome' }
    const expected = parsed.requestedOutcomeApplies ? 'YES' : 'NO'
    if (parsed.conclusion !== expected) return { ok: false, reason: 'conclusion contradicts requested outcome' }
    if (!new RegExp(`^${expected}\\b`, 'i').test(parsed.answer.trim())) return { ok: false, reason: 'answer prose contradicts conclusion' }
  } else if (parsed.requestedOutcomeApplies !== null) return { ok: false, reason: 'explanatory answer must use a null requested outcome' }
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
export function calculateDeepSeekV4ProCost(apiUsage, timestamp) {
  const promptTokens = Math.max(0, Number(apiUsage?.prompt_tokens || 0))
  const completionTokens = Math.max(0, Number(apiUsage?.completion_tokens || 0))
  const reportedHit = Math.max(0, Number(apiUsage?.prompt_cache_hit_tokens || 0))
  const reportedMiss = Math.max(0, Number(apiUsage?.prompt_cache_miss_tokens || 0))
  const hasCacheBreakdown = Number.isFinite(Number(apiUsage?.prompt_cache_hit_tokens)) && Number.isFinite(Number(apiUsage?.prompt_cache_miss_tokens))
  const cacheHitTokens = hasCacheBreakdown ? Math.min(promptTokens, reportedHit) : 0
  const cacheMissTokens = hasCacheBreakdown ? Math.max(0, Math.min(promptTokens, reportedMiss) + Math.max(0, promptTokens - reportedHit - reportedMiss)) : promptTokens
  const peak = isDeepSeekPeakPeriod(timestamp)
  const rates = peak ? V4_PRO_PRICING.peak : V4_PRO_PRICING.offPeak
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
  const charge = calculateDeepSeekV4ProCost(payload?.usage, now)
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
