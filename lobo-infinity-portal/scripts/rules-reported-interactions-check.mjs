import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
const root = new URL('../', import.meta.url)
const corpus = { manifest: { sources: [{ id: 'infinity-rules-n5.3', title: 'Infinity Rules', version: '5.3' }] } }
const source = await readFile(new URL('bot/rules-command.mjs', root), 'utf8')
let providerCalls = 0, benchmarkCalls = 0
const context = vm.createContext({
  ApplicationCommandOptionType: { String: 3 },
  normalizeRuleText: (value) => String(value ?? '').normalize('NFKD').replace(/[^a-zA-Z0-9+.-]+/g, ' ').trim().toLowerCase(),
  loadProductionRulesCorpus: async () => corpus,
  resolveRulesModelMentions: async () => ({ models: [] }),
  createDeepSeekRulesAnswer: () => async () => { providerCalls++; return { fallback: true } },
  findApprovedRulesAnswer: async () => { benchmarkCalls++; return null },
})
vm.runInContext(source.replace(/^import .*$/gm, '').replace(/\bexport /g, ''), context)
const cases = [
  ['what happens if you do a transmutation but cant fit', 'DEPENDS', /Dodge and Engineer cannot cancel it/],
  ['what happens if you do a transmutation but cannot fit?', 'DEPENDS', /mandatory and inevitable/],
  ['What happens when transmutation happens and the new silhouette cannot fit in the available space?', 'DEPENDS', /optional profile changes/],
  ['does speculative attack ignore dodge-3?', 'YES', /defender.*-3 PH/],
  ['Does Speculative Attack ignore Dodge (-3)?', 'YES', /ignored/],
  ['can you reset if you are immobilised a and immobilised b?', 'NO', /simultaneously/],
  ['can you reset if you are immobilized-A and immobilized-B?', 'NO', /prohibits Dodge/],
  ['can you reset against hacking in immobilised-A state?', 'NO', /both the Active and Reactive/],
  ['can you reset in immobilized-a state in the active turn?', 'NO', /PH -6/],
  ['can you reset in immobilized-a state in the reactive turn?', 'NO', /cannot be declared/],
  ['does discover through white noise triggers bs attack aro from msv 1 model', 'NO', /Discover is not a BS Attack/],
  ['Does Discover through White Noise allow a BS Attack ARO from an MSV1 trooper?', 'NO', /cannot draw LoF/],
]
for (const [question, conclusion, detail] of cases) {
  const result = await context.retrieveRulesReference({ question })
  assert.ok(result.deepSeek, question)
  assert.equal(result.deepSeek.conclusion, conclusion, question)
  assert.match(result.deepSeek.answer, detail, question)
  assert.ok(result.deepSeek.sources.every((item) => item.url.startsWith('https://infinitythewiki.com/')))
  const payload = context.formatRulesDiscordResponse(result)
  assert.ok(payload.embeds[0].fields.find((field) => field.name === 'ANSWER').value.length <= 1024)
}
assert.equal(providerCalls, 0)
assert.equal(benchmarkCalls, 0)
for (const question of [
  'Does speculative attack ignore the no LoF dodge penalty?',
  'Can you reset in immobilized-b state?',
  'Does a BS Attack through white noise trigger an MSV1 ARO?',
  'Can an MSV1 model see through smoke?',
  'Can you reset in immobilized-a state with a special scenario exception?',
]) {
  const result = await context.retrieveRulesReference({ question })
  assert.equal(result.fallback, true, question)
}
assert.equal(providerCalls, 5)
const prompt = await readFile(new URL('bot/deepseek-rules.mjs', root), 'utf8')
assert.match(prompt, /intersect the allowed declarations/)
assert.match(prompt, /Discover is not a BS Attack/)
assert.match(prompt, /defender’s Dodge/)
console.log('Rules interaction regressions passed: 12 corrections, 5 unrelated/exception fallbacks, Discord payloads, and AI guidance.')

const { loadProductionRulesCorpus } = await import('../bot/infinity-rules-service.mjs')
const { buildRulesEvidencePrompt } = await import('../bot/deepseek-rules.mjs')
const productionCorpus = await loadProductionRulesCorpus({ force: true })
for (const [question, expected] of [
  ['what happens if you do a transmutation but cant fit', ['replacing game elements', 'transmutation']],
  ['does speculative attack ignore dodge-3?', ['modifiers explained', 'speculative attack']],
  ['can you reset if you are immobilised a and immobilised b?', ['immobilized-a state', 'immobilized-b state', 'replacing game elements']],
  ['does discover through white noise triggers bs attack aro from msv 1 model', ['visibility conditions']],
]) {
  const evidence = buildRulesEvidencePrompt(productionCorpus, question)
  const ids = evidence.evidenceIds
  for (const term of expected) {
    assert.ok(productionCorpus.chunks.some((chunk, index) =>
      chunk.canonicalTerm === term && ids.has('C' + String(index + 1).padStart(4, '0'))), 'missing controlling evidence: ' + term)
  }
}
console.log('Production corpus evidence checks passed.')
