import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { evaluateRulesAnswers } from './rules-adjudicator-evaluate.mjs'
import { assertRulesModelEvaluationAllowed } from './rules-adjudicator-model-gate.mjs'

const root = new URL('../', import.meta.url)
const args = new Set(process.argv.slice(2))
const live = args.has('--live')
const mock = args.has('--mock') || !live
if (live && args.has('--mock')) throw new Error('Choose either --mock or --live, not both.')

const outputArgument = process.argv.slice(2).find((value) => value.startsWith('--output='))
const outputPath = resolve(process.cwd(), outputArgument?.slice('--output='.length) || '.tmp/rules-adjudicator-candidate.json')
const [benchmark, manifest, index] = await Promise.all([
  readFile(new URL('data/infinity-rules/rules-adjudicator-benchmark.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('data/infinity-rules/sources.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('data/infinity-rules/rules-search-index.json', root), 'utf8').then(JSON.parse),
])
assert.equal(benchmark.cases.length, 100)
assert.equal(benchmark.semanticAudit?.auditedCases, 100)
assert.ok(benchmark.cases.every((item) => item.semanticAuditStatus === 'PASSED'))

let answers
let providerRequests = 0
if (mock) {
  globalThis.fetch = async () => {
    throw new Error('Network access is forbidden in mock candidate mode.')
  }
  answers = benchmark.cases.map((item) => ({
    id: item.id,
    answer: item.draftAnswer,
    conclusion: item.draftConclusion,
    certainty: item.draftCertainty,
    citations: item.draftCitations,
    mode: 'AUDITED_REFERENCE_MOCK',
  }))
} else {
  const maximumArgument = process.argv.slice(2).find((value) => value.startsWith('--max-cases='))
  const maximum = Number(maximumArgument?.slice('--max-cases='.length))
  assertRulesModelEvaluationAllowed({ benchmark, live: true, maximum })
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('Live mode requires DEEPSEEK_API_KEY.')
  const { createDeepSeekRulesAnswer } = await import('../bot/deepseek-rules.mjs')
  const corpus = { manifest, chunks: index.chunks }
  const answerQuestion = createDeepSeekRulesAnswer()
  answers = []
  for (const item of benchmark.cases.slice(0, maximum)) {
    providerRequests++
    const result = await answerQuestion({ question: item.question, corpus })
    const sources = result.deepSeek?.sources || []
    answers.push({
      id: item.id,
      answer: result.deepSeek?.answer || result.limitation || 'The provider did not return an answer.',
      conclusion: result.deepSeek?.conclusion || 'UNRESOLVED',
      certainty: result.deepSeek?.certainty || 'EVIDENCE-BOUNDED INTERPRETATION',
      citations: sources.map((source) => ({
        sourceId: manifest.sources.find((candidate) => candidate.title === source.title && candidate.version === source.version)?.id || '',
        page: source.page,
        section: source.section,
      })),
      mode: 'LIVE_PROVIDER',
      providerStatus: result.status,
    })
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  mode: mock ? 'AUDITED_REFERENCE_MOCK' : 'LIVE_PROVIDER',
  providerRequests,
  answers,
}
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8')
const evaluation = evaluateRulesAnswers(benchmark, payload)
console.log(JSON.stringify({ outputPath, mode: payload.mode, providerRequests, evaluation }, null, 2))
if (mock) {
  assert.equal(providerRequests, 0)
  assert.equal(evaluation.contractPass, true)
  assert.equal(evaluation.releaseEligible, false)
}
