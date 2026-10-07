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
  ['when can you voluntarily break a fireteam', 'YES', /before either player spends the next Order/],
  ['Can I voluntarily cancel my Fireteam?', 'YES', /without spending an Order or Command Token/],
  ['May you disband a link team in the reactive turn?', 'YES', /Active or Reactive Turn/],
  ['How do I break a linked team?', 'YES', /entire Fireteam/],
  ['Can I cancel a fireteam for free?', 'YES', /without spending an Order or Command Token/],
  ['Do models in camo state reload during the states phase if a unit with baggage is within zone of control', 'YES', /not a declaration of the Reload/],
  ['Do models in camo state reload during the states phase if a unit with baggage is within zone of control', 'YES', /does not reveal the marker/],
  ['Can a camouflaged trooper reload in the States Phase if an allied unit with Baggage is in ZoC?', 'YES', /Non-Reloadable/],
  ['May a model in Camouflaged State regain Disposable uses during the States Phase when it is in the Zone of Control of an allied Baggage trooper?', 'YES', /automatically cancels Unloaded/],
  ['Can a camouflaged trooper declare Reload during the States Phase?', 'NO', /automatically regain/],
  ['what happens if you transmute but you can’t fit', 'DEPENDS', /Dodge and Engineer cannot cancel it/],
  ["what happens if you transmute but you can't fit", 'DEPENDS', /centre-aligned or edge-aligned/],
  ['can you guts prone if you are immobilized', 'NO', /cannot voluntarily fail/],
  ['Can you go prone through a Guts Roll while in immobilised-B state?', 'NO', /merely declaring Dodge/],
  ['can you target a model witha template weapon if it would hit your own hvt', 'DEPENDS', /no PS value that inflicts no States/],
  ['Can you target a model with a template weapon if it would affect your HVT?', 'DEPENDS', /Other shots in the same Burst/],
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
  'Can a camouflaged trooper reload in the States Phase if an allied unit with Baggage is in ZoC but unconscious?',
  'Can a camouflaged trooper reload in the States Phase if an allied unit with Baggage is in ZoC and the weapon is Non-Reloadable?',
  'Can a camouflaged trooper declare Reload in the Active Turn?',
  'Does speculative attack ignore the no LoF dodge penalty?',
  'Can you reset in immobilized-b state?',
  'Does a BS Attack through white noise trigger an MSV1 ARO?',
  'Can an MSV1 model see through smoke?',
  'Can you reset in immobilized-a state with a special scenario exception?',
  'Can a single member voluntarily leave a Fireteam?',
  'Can I cancel a Fireteam after the enemy spends an Order?',
  'Can I break a Fireteam and form another one for free?',
]) {
  const result = await context.retrieveRulesReference({ question })
  assert.equal(result.fallback, true, question)
}
assert.equal(providerCalls, 11)
const prompt = await readFile(new URL('bot/deepseek-rules.mjs', root), 'utf8')
assert.match(prompt, /intersect the allowed declarations/)
assert.match(prompt, /Discover is not a BS Attack/)
assert.match(prompt, /defender’s Dodge/)
assert.match(prompt, /automatic Baggage replenishment during the States Phase/)
assert.match(prompt, /Declaring Reload is a separate Attack declaration/)
assert.match(prompt, /must announce it before either player spends the Order/)
console.log('Rules interaction regressions passed: ' + cases.length + ' corrections, 11 unrelated/exception fallbacks, Discord payloads, and AI guidance.')

const { loadProductionRulesCorpus } = await import('../bot/infinity-rules-service.mjs')
const { buildRulesEvidencePrompt } = await import('../bot/deepseek-rules.mjs')
const productionCorpus = await loadProductionRulesCorpus({ force: true })
for (const [question, expected] of [
  ['Can I cancel a Fireteam after the enemy spends an Order?', ['fireteam integrity']],
  ['Do models in camo state reload during the states phase if a unit with baggage is within zone of control', ['baggage', 'reload', 'unloaded state', 'camouflaged state']],
  ['Can an unconscious Baggage trooper replenish a camouflaged trooper?', ['baggage', 'reload', 'unloaded state', 'camouflaged state']],
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

for (const question of ['when can you voluntarily break a fireteam', 'How do I disband my link team?']) {
  const evidence = buildRulesEvidencePrompt(productionCorpus, question)
  assert.match(evidence.text, /may voluntarily cancel the Fireteam without spending an Order or Command Token/)
  assert.match(evidence.text, /before either player spends the Order/)
}

const repeatedQuestion = 'Do models in camo state reload during the states phase if a unit with baggage is within zone of control'
const { retrieveRulesReference } = await import('../bot/rules-command.mjs')
const fireteamRepeated = await Promise.all(Array.from({ length: 6 }, () => retrieveRulesReference({ question: 'when can you voluntarily break a fireteam', deepSeek: async () => { throw new Error('Verified Fireteam cancellation must bypass the AI provider') } })))
assert.equal(new Set(fireteamRepeated.map(result => result.deepSeek.answer)).size, 1)
assert.ok(fireteamRepeated.every(result => result.deepSeek.conclusion === 'YES' && result.deepSeek.certainty === 'EXPLICIT RULES ANSWER'))
const repeated = await Promise.all(Array.from({ length: 6 }, () => retrieveRulesReference({ question: repeatedQuestion, deepSeek: async () => { throw new Error('Verified Baggage ruling must bypass the AI provider') } })))
assert.equal(new Set(repeated.map(result => result.deepSeek.answer)).size, 1)
assert.ok(repeated.every(result => result.deepSeek.conclusion === 'YES'))
console.log('Repeated production-corpus Baggage answers remain identical without an AI call.')
