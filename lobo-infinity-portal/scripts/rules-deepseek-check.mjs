import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDeepSeekFallback, shouldUseDeepSeek, readUsage, writeUsage } from '../bot/deepseek-rules.mjs'

const base = { question: 'Can this interaction occur?', status: 'MULTIPLE RULES APPLY — INTERPRETATION MAY BE REQUIRED', rules: [{ sourceId: 'rules', sourceLabel: 'Rules', pageLabel: 'p. 10', excerpt: 'Only the supplied rule applies.' }], versions: [{ id: 'rules', version: '5.3' }] }
assert.equal(shouldUseDeepSeek({ ...base, status: 'DIRECT RULE REFERENCE' }), false)
let calls = 0
const clear = await createDeepSeekFallback({ fetchImpl: async () => { calls++; throw new Error('must not call') } })({ ...base, status: 'DIRECT RULE REFERENCE' })
assert.equal(calls, 0); assert.equal(clear.status, 'DIRECT RULE REFERENCE')
const dir = await mkdtemp(join(tmpdir(), 'deepseek-rules-')); const usagePath = join(dir, 'usage.json')
assert.deepEqual((await readUsage(join(dir, 'missing.json'))).records, [])
for (const [index, raw] of ['', '   ', '{bad json', '{"records":{}}'].entries()) { const p = join(dir, `ledger-${index}.json`); await (await import('node:fs/promises')).writeFile(p, raw); assert.deepEqual((await readUsage(p, { warn() {} })).records, []) }
await writeUsage(join(dir, 'valid.json'), { records: [{ timestamp: 1, cost: 0.01 }] }); assert.equal((await readUsage(join(dir, 'valid.json'))).records.length, 1)
process.env.DEEPSEEK_API_KEY = 'test-key'; process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash'; process.env.DEEPSEEK_HOURLY_LIMIT_USD = '1'; process.env.DEEPSEEK_MONTHLY_LIMIT_USD = '10'
const answer = JSON.stringify({ answer: 'The excerpts support this interpretation.', conclusion: 'The rule applies.', evidenceIds: ['E1'], interpretationRequired: true })
const fallback = createDeepSeekFallback({ usagePath, fetchImpl: async (_url, options) => { calls++; const sent = JSON.parse(options.body); assert.equal(sent.response_format.type, 'json_object'); assert.deepEqual(sent.thinking, { type: 'disabled' }); assert.match(sent.messages[0].content, /JSON/); assert.match(sent.messages[1].content, /Only the supplied rule applies/); assert.doesNotMatch(sent.messages[1].content, /entire corpus/i); return { ok: true, status: 200, headers: { get: () => 'application/json' }, async text() { return JSON.stringify({ choices: [{ message: { content: answer }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 10 } }) } } } })
const result = await fallback(base); assert.equal(calls, 1); assert.equal(result.deepSeek.interpretationRequired, true)
let retryCalls = 0
const retried = await createDeepSeekFallback({ usagePath: join(dir, 'retry.json'), fetchImpl: async (_url, options) => { retryCalls++; const sent = JSON.parse(options.body); const content = retryCalls === 1 ? JSON.stringify({ answer: 'The rule applies.', conclusion: 'The rule applies.', evidenceIds: ['BAD'], interpretationRequired: false }) : answer; assert.match(sent.messages[1].content, retryCalls === 1 ? /E1/ : /outside the permitted/); return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }) } } })(base)
assert.equal(retryCalls, 2); assert.deepEqual(retried.deepSeek.evidenceIds, ['E1'])
let emptyCalls = 0
const emptyThenSuccess = await createDeepSeekFallback({ usagePath: join(dir, 'empty-retry.json'), fetchImpl: async () => { emptyCalls++; const content = emptyCalls === 1 ? null : answer; return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ choices: [{ message: { content, ...(emptyCalls === 1 ? { reasoning_content: 'redacted' } : {}) }, finish_reason: emptyCalls === 1 ? 'stop' : 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 10 } }) } } })(base)
assert.equal(emptyCalls, 2); assert.ok(emptyThenSuccess.deepSeek)
let unsupportedCalls = 0
const unsupported = await createDeepSeekFallback({ usagePath: join(dir, 'unsupported.json'), fetchImpl: async () => { unsupportedCalls++; return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answer: 'Dragons are legal.', conclusion: 'Dragons are legal.', evidenceIds: ['E1'], interpretationRequired: false }) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) } } })(base)
assert.equal(unsupportedCalls, 1); assert.ok(unsupported.limitation)
for (const provider of [{ headers: { get: () => 'application/json' }, status: 200, ok: true, text: async () => '' }, { headers: { get: () => 'text/html' }, status: 200, ok: true, text: async () => '<html>' }]) { const safe = await createDeepSeekFallback({ usagePath: join(dir, `provider-${calls}`), fetchImpl: async () => provider, logger: { warn() {} } })(base); assert.ok(safe.limitation); calls++ }
const limited = createDeepSeekFallback({ usagePath, fetchImpl: async () => { throw new Error('blocked') } }); const again = await limited(base); assert.match(again.limitation, /DeepSeek/); assert.ok((await readFile(usagePath, 'utf8')).includes('promptTokens'))
console.log('DeepSeek rules routing, evidence bounds, citation validation, failure fallback, and durable usage checks passed.')
