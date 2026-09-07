import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCompleteCorpusPrompt, calculateDeepSeekV4FlashCost, createDeepSeekRulesAnswer, isDeepSeekPeakPeriod, readUsage, validateDirectAnswer, writeUsage } from '../bot/deepseek-rules.mjs'

const corpus = {
  manifest: { sources: [
    { id: 'rules', title: 'Infinity Rules', version: 'N5.3', officialUrl: 'https://example.test/rules' },
    { id: 'faq', title: 'Infinity FAQ', version: 'v0.1', officialUrl: 'https://example.test/faq' },
    { id: 'its', title: 'ITS', version: '18', officialUrl: 'https://example.test/its' },
  ] },
  chunks: [
    { sourceId: 'rules', printedPage: '125', pdfPage: 125, section: 'MSV1', text: 'MSV1 draws LoF through Zero Visibility Zones with a -6 MOD.' },
    { sourceId: 'faq', printedPage: '2', pdfPage: 2, section: 'FAQ', text: 'FAQ clarification.' },
    { sourceId: 'its', printedPage: '10', pdfPage: 10, section: 'ITS', text: 'ITS mission rule.' },
  ],
}
const prompt = buildCompleteCorpusPrompt(corpus)
assert.match(prompt, /MSV1 draws LoF/); assert.match(prompt, /FAQ clarification/); assert.match(prompt, /ITS mission rule/)
assert.doesNotMatch(prompt, /search_rules|get_related_rules|get_rule_section/)

process.env.DEEPSEEK_API_KEY = 'invalid-placeholder-key'
process.env.DEEPSEEK_HOURLY_LIMIT_USD = '1'
process.env.DEEPSEEK_MONTHLY_LIMIT_USD = '10'
const dir = await mkdtemp(join(tmpdir(), 'deepseek-direct-rules-'))
const usagePath = join(dir, 'usage.json')
let calls = 0
const content = JSON.stringify({ answer: 'Apply a -6 MOD.', conclusion: 'YES', certainty: 'EXPLICIT RULES ANSWER', citationIds: ['C0001'] })
const answer = await createDeepSeekRulesAnswer({
  usagePath,
  logger: { info() {}, warn() {} },
  fetchImpl: async (_url, options) => {
    calls++
    const sent = JSON.parse(options.body)
    assert.equal(sent.messages.length, 2)
    assert.match(sent.messages[0].content, /MSV1 draws LoF/)
    assert.match(sent.messages[0].content, /FAQ clarification/)
    assert.match(sent.messages[0].content, /ITS mission rule/)
    assert.equal(sent.messages[1].content, 'What happens through smoke?')
    assert.equal(sent.tools, undefined)
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 20 } }) }
  },
})({ question: 'What happens through smoke?', corpus })
assert.equal(calls, 1); assert.equal(answer.deepSeek.answer, 'Apply a -6 MOD.'); assert.equal(answer.deepSeek.sources[0].section, 'MSV1')
assert.ok((await readFile(usagePath, 'utf8')).includes('promptTokens'))

for (const [name, response] of [
  ['empty', { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => '' }],
  ['html', { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<html>' }],
  ['http', { ok: false, status: 500, headers: { get: () => 'application/json' }, text: async () => '{}' }],
  ['truncated', { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ choices: [{ finish_reason: 'length', message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) }],
  ['tool', { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{}] } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) }],
]) {
  let branchCalls = 0
  const result = await createDeepSeekRulesAnswer({ usagePath: join(dir, `${name}.json`), logger: { info() {}, warn() {} }, fetchImpl: async () => { branchCalls++; return response } })({ question: name, corpus })
  assert.equal(branchCalls, 1); assert.equal(result.deepSeek, undefined); assert.ok(result.limitation)
}

assert.equal(validateDirectAnswer({ answer: 'Answer', conclusion: 'YES', certainty: 'EXPLICIT RULES ANSWER', citationIds: ['C0001'] }, corpus).ok, true)
for (const invalid of [
  { answer: '', conclusion: 'YES', certainty: 'EXPLICIT RULES ANSWER', citationIds: ['C0001'] },
  { answer: 'x', conclusion: 'MAYBE', certainty: 'EXPLICIT RULES ANSWER', citationIds: ['C0001'] },
  { answer: 'x', conclusion: 'YES', certainty: 'CERTAIN', citationIds: ['C0001'] },
  { answer: 'x', conclusion: 'YES', certainty: 'EXPLICIT RULES ANSWER', citationIds: ['BAD'] },
]) assert.equal(validateDirectAnswer(invalid, corpus).ok, false)

assert.deepEqual((await readUsage(join(dir, 'missing.json'))).records, [])
for (const [index, raw] of ['', ' ', '{bad', '{"records":{}}'].entries()) { const path = join(dir, `bad-${index}.json`); await writeFile(path, raw); assert.deepEqual((await readUsage(path, { warn() {} })).records, []) }
await writeUsage(join(dir, 'atomic.json'), { records: [{ timestamp: 1, cost: 0.01 }] })

const mondayPeak = Date.parse('2026-09-07T02:00:00Z')
const mondayOffPeak = Date.parse('2026-09-07T12:00:00Z')
assert.equal(isDeepSeekPeakPeriod(mondayPeak), true)
assert.equal(isDeepSeekPeakPeriod(mondayOffPeak), false)
assert.deepEqual(calculateDeepSeekV4FlashCost({ prompt_tokens: 200000, prompt_cache_hit_tokens: 150000, prompt_cache_miss_tokens: 50000, completion_tokens: 500 }, mondayPeak), {
  promptTokens: 200000, completionTokens: 500, cacheHitTokens: 150000, cacheMissTokens: 50000, ratePeriod: 'peak', cost: 150000 / 1e6 * 0.014 + 50000 / 1e6 * 0.44 + 500 / 1e6 * 1.32,
})
assert.equal(calculateDeepSeekV4FlashCost({ prompt_tokens: 200000, completion_tokens: 500 }, mondayOffPeak).cost, 200000 / 1e6 * 0.22 + 500 / 1e6 * 0.66)
console.log('Direct full-corpus DeepSeek path passed with exactly one mocked request and zero real network requests.')
