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
const answer = JSON.stringify({ answer: 'The excerpts support this interpretation.', classification: 'INTERPRETATION', citations: [{ id: 'E1' }] })
const fallback = createDeepSeekFallback({ usagePath, fetchImpl: async (_url, options) => { calls++; const sent = JSON.parse(options.body); assert.match(sent.messages[1].content, /Only the supplied rule applies/); assert.doesNotMatch(sent.messages[1].content, /entire corpus/i); return { ok: true, status: 200, headers: { get: () => 'application/json' }, async text() { return JSON.stringify({ choices: [{ message: { content: answer } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }) } } } })
const result = await fallback(base); assert.equal(calls, 1); assert.equal(result.deepSeek.classification, 'INTERPRETATION')
for (const provider of [{ headers: { get: () => 'application/json' }, status: 200, ok: true, text: async () => '' }, { headers: { get: () => 'text/html' }, status: 200, ok: true, text: async () => '<html>' }]) { const safe = await createDeepSeekFallback({ usagePath: join(dir, `provider-${calls}`), fetchImpl: async () => provider, logger: { warn() {} } })(base); assert.ok(safe.limitation); calls++ }
const limited = createDeepSeekFallback({ usagePath, fetchImpl: async () => { throw new Error('blocked') } }); const again = await limited(base); assert.match(again.limitation, /DeepSeek/); assert.ok((await readFile(usagePath, 'utf8')).includes('promptTokens'))
console.log('DeepSeek rules routing, evidence bounds, citation validation, failure fallback, and durable usage checks passed.')
