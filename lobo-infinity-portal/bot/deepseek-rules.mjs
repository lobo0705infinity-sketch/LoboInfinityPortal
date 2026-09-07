import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const DEFAULT_USAGE_PATH = resolve(import.meta.dirname, '..', '.tmp', 'deepseek-rules-usage.json')
const INPUT_USD_PER_MILLION = 0.14
const OUTPUT_USD_PER_MILLION = 0.28

export function shouldUseDeepSeek(result) {
  return result.status !== 'DIRECT RULE REFERENCE'
}

export function buildEvidencePacket(result) {
  return result.rules.slice(0, 6).map((rule, index) => ({
    id: `E${index + 1}`,
    source: rule.sourceLabel,
    version: result.versions.find((item) => item.id === rule.sourceId)?.version ?? 'unknown',
    page: rule.pageLabel,
    excerpt: rule.excerpt,
    scope: rule.scope ?? 'CORE',
  }))
}

export function createDeepSeekFallback({ fetchImpl = fetch, usagePath = process.env.DEEPSEEK_USAGE_PATH || DEFAULT_USAGE_PATH, now = () => Date.now(), logger = console } = {}) {
  return async function deepSeekFallback(result) {
    if (!shouldUseDeepSeek(result)) return result
    const key = String(process.env.DEEPSEEK_API_KEY || '')
    const model = String(process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash')
    if (!key) return withLimitation(result, 'DeepSeek is not configured; returning the retrieval result.')
    const evidence = buildEvidencePacket(result)
    if (!evidence.length) return withLimitation(result, 'No relevant retrieved excerpts were available for DeepSeek.')
    const usage = await readUsage(usagePath, logger)
    const limits = { hourly: Number(process.env.DEEPSEEK_HOURLY_LIMIT_USD || 1), monthly: Number(process.env.DEEPSEEK_MONTHLY_LIMIT_USD || 10) }
    const current = usage.records.filter((item) => now() - item.timestamp < 31 * 24 * 60 * 60 * 1000)
    const hourly = current.filter((item) => now() - item.timestamp < 60 * 60 * 1000).reduce((sum, item) => sum + item.cost, 0)
    const monthly = current.reduce((sum, item) => sum + item.cost, 0)
    if (hourly >= limits.hourly || monthly >= limits.monthly) return withLimitation(result, 'DeepSeek spending limit reached; returning the retrieval result.')
    const body = { model, temperature: 0, max_tokens: 700, messages: [{ role: 'system', content: 'Answer only from the supplied excerpts. Cite source, version, and page for every material claim. Distinguish EXPLICIT RULE from INTERPRETATION. If the excerpts do not resolve the question, say so. Never invent citations or rules. Preserve FAQ precedence and use ITS evidence only for ITS questions. Return JSON: {"answer":string,"classification":"EXPLICIT RULE|INTERPRETATION|UNRESOLVED","citations":[{"id":string}]}.' }, { role: 'user', content: JSON.stringify({ question: result.question, excerpts: evidence }) }] }
    try {
      const response = await fetchImpl('https://api.deepseek.com/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) })
      const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase()
      const responseText = await response.text()
      if (!response.ok) return withLimitation(result, `DeepSeek was unavailable (HTTP ${response.status}); returning the retrieval result.`)
      if (!responseText.trim()) { logger.warn?.('DeepSeek rules provider error: empty HTTP response body'); return withLimitation(result, 'DeepSeek returned an empty response; returning the retrieval result.') }
      if (!contentType.includes('application/json')) { logger.warn?.(`DeepSeek rules provider error: non-JSON content type ${contentType || 'missing'}`); return withLimitation(result, 'DeepSeek returned a non-JSON response; returning the retrieval result.') }
      let payload
      try { payload = JSON.parse(responseText) } catch { logger.warn?.('DeepSeek rules model error: invalid provider JSON'); return withLimitation(result, 'DeepSeek returned invalid JSON; returning the retrieval result.') }
      const content = payload?.choices?.[0]?.message?.content
      let parsed = null
      try { if (typeof content === 'string' && content.trim()) parsed = JSON.parse(content) } catch { logger.warn?.('DeepSeek rules model error: invalid model JSON') }
      const citations = Array.isArray(parsed?.citations) ? parsed.citations.filter((item) => evidence.some((entry) => entry.id === item?.id)) : []
      if (!parsed?.answer || !['EXPLICIT RULE', 'INTERPRETATION', 'UNRESOLVED'].includes(parsed.classification) || !citations.length) return withLimitation(result, 'DeepSeek returned an unsupported answer; returning the retrieval result.')
      const promptTokens = Number(payload?.usage?.prompt_tokens || 0)
      const completionTokens = Number(payload?.usage?.completion_tokens || 0)
      const cost = promptTokens / 1e6 * INPUT_USD_PER_MILLION + completionTokens / 1e6 * OUTPUT_USD_PER_MILLION
      if (hourly + cost > limits.hourly || monthly + cost > limits.monthly) return withLimitation(result, 'DeepSeek response exceeded the configured spending limit; returning the retrieval result.')
      usage.records.push({ timestamp: now(), cost, promptTokens, completionTokens, model })
      await writeUsage(usagePath, usage)
      return { ...result, deepSeek: { answer: parsed.answer, classification: parsed.classification, citations, cost }, status: 'DEEPSEEK EVIDENCE-BOUNDED ANSWER' }
    } catch (error) {
      logger.warn?.(`DeepSeek rules ${error?.source || 'provider'} error: ${error instanceof Error ? error.message : 'request failed'}`)
      return withLimitation(result, 'DeepSeek was unavailable; returning the retrieval result.')
    }
  }
}

function withLimitation(result, message) { return { ...result, limitation: message } }
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
export async function writeUsage(path, usage) {
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.tmp`
  await writeFile(temp, `${JSON.stringify({ records: usage.records })}\n`, 'utf8')
  await rename(temp, path)
}
