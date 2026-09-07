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
    const permittedIds = evidence.map((item) => item.id)
    const baseInstruction = `Answer only from the supplied excerpts. For interaction questions, explain how each cited condition applies to the exact declared Skill, target, Repeater, and Firewall; do not infer Firewall merely because an enemy Repeater is involved. If excerpts do not establish every required condition, use conclusion UNRESOLVED. Permitted evidence IDs: ${permittedIds.join(', ')}. Return JSON only, using this complete example shape: {"answer":"text","conclusion":"YES|NO|DEPENDS|UNRESOLVED","evidenceIds":["E1"],"interpretationRequired":false}. The response must contain exactly answer, conclusion, evidenceIds, and interpretationRequired. evidenceIds must use only permitted IDs. Every material conclusion must be supported by a cited excerpt. Distinguish explicit rules from interpretation. Preserve FAQ precedence and ITS scope.`
    let validationError = ''
    let totalCost = 0
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
      const corrective = validationError ? ` Previous output failed validation: ${validationError}. Return a non-empty JSON object now.` : ''
      const body = { model, temperature: 0, max_tokens: 1200, response_format: { type: 'json_object' }, thinking: { type: 'disabled' }, messages: [{ role: 'system', content: `${baseInstruction}${corrective}` }, { role: 'user', content: JSON.stringify({ question: result.question, excerpts: evidence, permittedEvidenceIds: permittedIds, validationError }) }] }
      const response = await fetchImpl('https://api.deepseek.com/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) })
      const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase()
      const responseText = await response.text()
      if (!response.ok) return withLimitation(result, `DeepSeek was unavailable (HTTP ${response.status}); returning the retrieval result.`)
      if (!responseText.trim()) { logger.warn?.('DeepSeek rules provider error: empty HTTP response body'); return withLimitation(result, 'DeepSeek returned an empty response; returning the retrieval result.') }
      if (!contentType.includes('application/json')) { logger.warn?.(`DeepSeek rules provider error: non-JSON content type ${contentType || 'missing'}`); return withLimitation(result, 'DeepSeek returned a non-JSON response; returning the retrieval result.') }
      let payload
      try { payload = JSON.parse(responseText) } catch { logger.warn?.('DeepSeek rules model error: invalid provider JSON'); return withLimitation(result, 'DeepSeek returned invalid JSON; returning the retrieval result.') }
      const content = payload?.choices?.[0]?.message?.content
      const finishReason = payload?.choices?.[0]?.finish_reason ?? null
      const reasoningPresent = Boolean(payload?.choices?.[0]?.message?.reasoning_content)
      logger.info?.(`DeepSeek rules response: finish_reason=${String(finishReason)} content_length=${typeof content === 'string' ? content.length : 0} reasoning_content_present=${reasoningPresent}`)
      let parsed = null
      if (typeof content !== 'string' || !content.trim()) { validationError = 'provider returned null or empty message.content'; logger.warn?.(`DeepSeek rules provider-output error: ${validationError}; retrying=${attempt === 0}`); if (attempt === 1) return withLimitation(result, 'DeepSeek returned empty content; returning the retrieval result.'); continue }
      try { parsed = JSON.parse(content) } catch { parsed = null }
      const promptTokens = Number(payload?.usage?.prompt_tokens || 0)
      const completionTokens = Number(payload?.usage?.completion_tokens || 0)
      const cost = promptTokens / 1e6 * INPUT_USD_PER_MILLION + completionTokens / 1e6 * OUTPUT_USD_PER_MILLION; totalCost += cost
      usage.records.push({ timestamp: now(), cost, promptTokens, completionTokens, model }); await writeUsage(usagePath, usage)
      const check = validateModelOutput(parsed, evidence)
      if (check.ok) return { ...result, deepSeek: { answer: parsed.answer, conclusion: parsed.conclusion, interpretationRequired: parsed.interpretationRequired, evidenceIds: parsed.evidenceIds, cost: totalCost }, status: 'DEEPSEEK EVIDENCE-BOUNDED ANSWER' }
      validationError = check.reason
      logger.warn?.(`DeepSeek rules model validation error: ${check.reason}; evidence IDs returned: ${JSON.stringify(parsed?.evidenceIds ?? null)}`)
      if (check.unsupported || attempt === 1) return withLimitation(result, 'DeepSeek returned an unsupported answer; returning the retrieval result.')
      const nextHourly = hourly + totalCost; const nextMonthly = monthly + totalCost
      if (nextHourly >= limits.hourly || nextMonthly >= limits.monthly) return withLimitation(result, 'DeepSeek spending limit reached; returning the retrieval result.')
      }
      return withLimitation(result, 'DeepSeek returned an unsupported answer; returning the retrieval result.')
    } catch (error) {
      logger.warn?.(`DeepSeek rules ${error?.source || 'provider'} error: ${error instanceof Error ? error.message : 'request failed'}`)
      return withLimitation(result, 'DeepSeek was unavailable; returning the retrieval result.')
    }
  }
}

function validateModelOutput(parsed, evidence) {
  if (!parsed || typeof parsed.answer !== 'string' || typeof parsed.conclusion !== 'string' || typeof parsed.interpretationRequired !== 'boolean' || !Array.isArray(parsed.evidenceIds)) return { ok: false, reason: 'strict output contract requires answer, conclusion, evidenceIds, and interpretationRequired' }
  const permitted = new Set(evidence.map((item) => item.id)); if (!parsed.evidenceIds.length || parsed.evidenceIds.some((id) => !permitted.has(id))) return { ok: false, reason: 'evidenceIds contain values outside the permitted evidence packet' }
  const citedText = parsed.evidenceIds.map((id) => evidence.find((item) => item.id === id)?.excerpt || '').join(' ').toLowerCase(); const terms = parsed.conclusion.toLowerCase().split(/\W+/).filter((term) => term.length > 4); if (terms.length && !terms.some((term) => citedText.includes(term))) return { ok: false, reason: 'conclusion has no material term supported by cited excerpts', unsupported: true }
  return { ok: true }
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
