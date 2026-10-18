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
  ['Can unit cautious move inside enemy zoc, but the enemy is in impersonation?', 'NO', /No without Stealth/],
  ['Can unit cautious move inside enemy zoc, but that enemy is in impersonation?', 'NO', /No without Stealth/],
  ['Can I use Cautious Movement within the ZoC of an enemy Impersonation marker?', 'NO', /enemy Marker for this check/],
  ['May a trooper declare Cautious Movement inside the Zone of Control of an IMPersonation-2 marker?', 'NO', /declining to react changes nothing/],
  ['Can a trooper without Stealth use Cautious Movement within the ZoC of an enemy Impersonation marker?', 'NO', /other enemies with an ARO opportunity/],
  ['Can a trooper with Stealth use Cautious Movement within the ZoC of an enemy Impersonation marker?', 'YES', /remaining outside the marker’s LoF/],
  ['Can I use Cautious Movement within the ZoC of an enemy Impersonation marker with Stealth?', 'YES', /Sixth Sense or Combat Instinct/],
  ['Can I use Cautious Movement within the ZoC of an enemy Impersonation marker without Stealth?', 'NO', /starting or ending/],
  ['Can unit cautious move inside enemy zoc, but that enemy is in impersonation if it has stealth and stays outside its LoF?', 'YES', /other Cautious Movement conditions/],
  ['when does nfb stop applying?', 'DEPENDS', /until the new effect is canceled or voluntarily deactivated/],
  ['When does Negative Feedback end?', 'DEPENDS', /revealing the hacker ends Cybermask/],
  ['a trooper with mimetism is in cybermask. An active enemy trooper declares discover shoot against them. Does Mim reactivate after the successful discover roll or only after the order resolution?', 'YES', /same Order/],
  ['Does Mimetism return for the shot after successful Discover + BS Attack against Cybermask?', 'YES', /suppresses Mimetism for the Discover Roll/],
  ['does a nanoscreen model gain the +6 to save from vitroferro deployable cover', 'NO', /No Cover prohibits Partial Cover MODs/],
  ['Can a trooper with Nanoscreen gain +6 to saving rolls from Vitroferro cover?', 'NO', /does not produce \+9/],
  ['Does Nanoscreen stack with Vitroferro cover?', 'NO', /Nanoscreen still imposes -3 BS/],
  ['Can a model with No Cover claim the cover bonus from Vitroferro deployable cover?', 'NO', /cannot gain its \+6/],
  ['can an engineer clear the state of total control (possessed state) from a tag', 'NO', /cannot cancel Possessed State/],
  ['Can an Engineer cancel Possessed State?', 'NO', /1 Command Token/],
  ['Can my Engineer remove possession from my TAG?', 'NO', /fail a Saving Roll/],
  ['Does the Engineer skill remove Total Control from a TAG?', 'NO', /Silhouette contact does not remove Possessed/],
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
  ['when do you get cover from height?', 'DEPENDS', /roof or platform you stand on/],
  ['When do I gain Partial Cover from elevation?', 'DEPENDS', /do not need a parapet or to be Prone/],
  ['Does height grant cover?', 'DEPENDS', /Merely being higher is not automatic cover/],
  ['Can elevation provide Partial Cover?', 'DEPENDS', /whole Silhouette/],
  ['Do you get cover on a roof?', 'DEPENDS', /blocks all LoF/],
  ['Can a trooper gain cover from an elevated position?', 'DEPENDS', /cover-denying rules still apply/],
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
const cautious = await context.retrieveRulesReference({ question: cases[0][0] })
assert.equal(cautious.deepSeek.certainty, 'EVIDENCE-BOUNDED INTERPRETATION')
assert.equal(cautious.deepSeek.interpretationRequired, true)
assert.deepEqual(Array.from(cautious.deepSeek.sources, item => item.section), ['Cautious Movement', 'Impersonation State', 'Stealth', 'Alignment'])
const cautiousPayload = context.formatRulesDiscordResponse(cautious)
const cautiousText = cautiousPayload.embeds[0].fields.find(field => field.name === 'ANSWER').value
assert.match(cautiousText, /Hackable model/)
assert.match(cautiousText, /Recommended table ruling, not an explicit official clarification/)
assert.match(cautiousText, /declining to react changes nothing/)
assert.doesNotMatch(cautiousText, /provided the impersonator remains unrevealed/)
assert.match(cautiousText, /eligibility restrictions/)
for (const question of [
  'Can I use Cautious Movement within the ZoC of an enemy Impersonation marker if it reveals?',
  'Can a TAG use Cautious Movement within the ZoC of an enemy Impersonation marker?',
  'Can I use Cautious Movement inside an enemy camouflage marker ZoC?',
  'Can my impersonating trooper use Cautious Movement within an enemy ZoC?',
]) assert.equal((await context.retrieveRulesReference({ question })).fallback, true, question)
for (const question of [
  'Does Mimetism return for the shot after successful Discover + BS Attack against Cybermask under a scenario exception?',
  'Does Mimetism return for the shot after successful Discover + BS Attack against Cybermask with White Noise?',
  'Can an Engineer cancel Possessed State under a special scenario exception?',
  'Can an Engineer cancel Isolated State?',
  'Can an Engineer repair a wound on a Possessed TAG?',
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
for (const question of [
  'Does an Impetuous trooper get cover from height?',
  'Do I get cover on a roof while using Climb?',
  'Can I gain cover from height against a template weapon?',
  'Does height grant cover under a special scenario exception?',
]) assert.equal((await context.retrieveRulesReference({ question })).fallback, true, question)
assert.equal(providerCalls, 24)
const prompt = await readFile(new URL('bot/deepseek-rules.mjs', root), 'utf8')
assert.match(prompt, /intersect the allowed declarations/)
assert.match(prompt, /Without Stealth, starting or ending inside its ZoC prevents ARO suppression/)
assert.match(prompt, /With applicable Stealth and outside the marker’s LoF/)
assert.match(prompt, /not an explicit official clarification/)
assert.doesNotMatch(prompt, /derive the ZoC interaction from that status/)
assert.match(prompt, /Discover is not a BS Attack/)
assert.match(prompt, /defender’s Dodge/)
assert.match(prompt, /automatic Baggage replenishment during the States Phase/)
assert.match(prompt, /Declaring Reload is a separate Attack declaration/)
assert.match(prompt, /must announce it before either player spends the Order/)
console.log('Rules interaction regressions passed: ' + cases.length + ' corrections, 24 unrelated/exception fallbacks, Discord payloads, and AI guidance.')

const { loadProductionRulesCorpus } = await import('../bot/infinity-rules-service.mjs')
const { buildRulesEvidencePrompt } = await import('../bot/deepseek-rules.mjs')
const productionCorpus = await loadProductionRulesCorpus({ force: true })
for (const [question, expected] of [
  ['Can unit cautious move inside enemy zoc, but the enemy is in impersonation?', ['cautious movement', 'impersonation state', 'stealth']],
  ['Can I use Cautious Movement near an IMP-2 marker if it reveals with an ARO?', ['cautious movement', 'impersonation state', 'stealth']],
  ['when does nfb stop applying?', ['negative feedback', 'cybermask']],
  ['Does Mim reactivate after a successful discover shoot against cybermask?', ['negative feedback', 'cybermask', 'impersonation state']],
  ['Does Nanoscreen stack with Vitroferro cover?', ['nanoscreen', 'no cover', 'deployable cover']],
  ['How can my Engineer get a TAG back after Total Control?', ['possessed state', 'engineer', 'total control']],
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
const { retrieveRulesReference, createRulesInteractionHandler } = await import('../bot/rules-command.mjs')
const quickResult = await retrieveRulesReference({ question: cases[0][0], deepSeek: async () => { throw new Error('Fixed answer must not call AI') } })
function fakeInteraction() {
  return { commandName: 'rules', deferred: false, replied: false, calls: [],
    isChatInputCommand: () => true, options: { getString: () => cases[0][0] },
    async reply(payload) { this.replied = true; this.calls.push(['reply', payload]) },
    async deferReply() { this.deferred = true; this.calls.push(['defer']) },
    async editReply(payload) { this.calls.push(['edit', payload]) },
  }
}
const quietLogger = { info() {}, error() {} }
const direct = fakeInteraction()
await createRulesInteractionHandler({ retrieve: async () => quickResult, logger: quietLogger })(direct)
assert.deepEqual(direct.calls.map(call => call[0]), ['reply'])
assert.equal(direct.deferred, false)
for (const [question, conclusion] of cases.slice(0, 9)) {
  const result = await retrieveRulesReference({ question, deepSeek: async () => { throw new Error('Cautious/Stealth ruling must bypass AI') } })
  assert.equal(result.deepSeek.conclusion, conclusion, question)
  const payload = formatRulesDiscordResponseForTest(result)
  assert.match(payload, /eligibility restrictions still apply as modified by Stealth\.$/)
  const interaction = fakeInteraction()
  interaction.options = { getString: () => question }
  await createRulesInteractionHandler({ logger: quietLogger })(interaction)
  assert.deepEqual(interaction.calls.map(call => call[0]), ['reply'], question)
}
function formatRulesDiscordResponseForTest(result) {
  return context.formatRulesDiscordResponse(result).embeds[0].fields.find(field => field.name === 'ANSWER').value
}
console.log('All 9 Cautious Movement/Stealth variants return the corrected ruling directly without AI or truncation.')

let finishAnswer
const slowAnswer = new Promise(resolve => { finishAnswer = resolve })
const slow = fakeInteraction()
slow.deferReply = async function () { this.deferred = true; this.calls.push(['defer']); finishAnswer(quickResult) }
await createRulesInteractionHandler({ retrieve: () => slowAnswer, logger: quietLogger, quickReplyMs: 1 })(slow)
assert.deepEqual(slow.calls.map(call => call[0]), ['defer', 'edit'])
const failed = fakeInteraction()
await createRulesInteractionHandler({ retrieve: async () => { throw new Error('test failure') }, logger: quietLogger })(failed)
assert.deepEqual(failed.calls.map(call => call[0]), ['reply'])
assert.match(failed.calls[0][1].content, /temporarily unavailable/)
console.log('Fast rules answers reply directly; slow answers defer safely; retrieval failures reply without leaving a thinking indicator.')
for (const question of cases.slice(0, 3).map(item => item[0])) {
  const results = await Promise.all(Array.from({ length: 3 }, () => retrieveRulesReference({ question, deepSeek: async () => { throw new Error('Verified Cautious Movement interaction must bypass AI') } })))
  assert.equal(new Set(results.map(result => result.deepSeek.answer)).size, 1)
  assert.ok(results.every(result => result.deepSeek.certainty === 'EVIDENCE-BOUNDED INTERPRETATION'))
  const evidence = buildRulesEvidencePrompt(productionCorpus, question)
  assert.match(evidence.text, /considered an Allied Trooper/)
  assert.match(evidence.text, /both the starting and ending positions/)
  assert.match(evidence.text, /enemy Hackers’ Hacking Areas/)
}
const possessedRepeated = await Promise.all(Array.from({ length: 6 }, () => retrieveRulesReference({ question: 'can an engineer clear the state of total control (possessed state) from a tag', deepSeek: async () => { throw new Error('Verified Possessed ruling must bypass the AI provider') } })))
assert.equal(new Set(possessedRepeated.map(result => result.deepSeek.answer)).size, 1)
assert.ok(possessedRepeated.every(result => result.deepSeek.conclusion === 'NO' && result.deepSeek.certainty === 'EXPLICIT RULES ANSWER'))
const fireteamRepeated = await Promise.all(Array.from({ length: 6 }, () => retrieveRulesReference({ question: 'when can you voluntarily break a fireteam', deepSeek: async () => { throw new Error('Verified Fireteam cancellation must bypass the AI provider') } })))
assert.equal(new Set(fireteamRepeated.map(result => result.deepSeek.answer)).size, 1)
assert.ok(fireteamRepeated.every(result => result.deepSeek.conclusion === 'YES' && result.deepSeek.certainty === 'EXPLICIT RULES ANSWER'))
const repeated = await Promise.all(Array.from({ length: 6 }, () => retrieveRulesReference({ question: repeatedQuestion, deepSeek: async () => { throw new Error('Verified Baggage ruling must bypass the AI provider') } })))
assert.equal(new Set(repeated.map(result => result.deepSeek.answer)).size, 1)
assert.ok(repeated.every(result => result.deepSeek.conclusion === 'YES'))
console.log('Repeated production-corpus Baggage answers remain identical without an AI call.')

for (const question of [
  'does a nanoscreen model gain the +6 to save from vitroferro deployable cover',
  'Can a trooper with Nanoscreen gain +6 to saving rolls from Vitroferro cover?',
]) {
  const result = await retrieveRulesReference({ question, deepSeek: async () => { throw new Error('Verified No Cover ruling must bypass AI') } })
  assert.equal(result.deepSeek.conclusion, 'NO')
  assert.ok(result.deepSeek.sources.some(source => source.url.endsWith('/No_Cover')))
}
for (const question of [
  'Can a Nanoscreen model without No Cover gain the +6 to save from Vitroferro deployable cover?',
  'Can a Nanoscreen model gain the +6 to save from Vitroferro deployable cover under a special scenario exception?',
  'Does Nanoscreen protect against a Comms Attack?',
]) assert.equal(context.verifiedRulesInteraction(question, corpus), null, question)
console.log('Nanoscreen/Vitroferro ruling, controlling evidence, and exception routing passed.')

for (const question of [
  'when does nfb stop applying?',
  'a trooper with mimetism is in cybermask. An active enemy trooper declares discover shoot against them. Does Mim reactivate after the successful discover roll or only after the order resolution?',
]) {
  const results = await Promise.all(Array.from({ length: 3 }, () => retrieveRulesReference({ question, deepSeek: async () => { throw new Error('NFB regression must bypass the AI provider') } })))
  assert.equal(new Set(results.map(result => result.deepSeek.answer)).size, 1)
  assert.ok(results.every(result => result.deepSeek.certainty === 'EXPLICIT RULES ANSWER'))
}
console.log('Both reported NFB questions return consistent production-corpus answers without an AI call.')

const targetedCases = [
  'can a targeted model enter impersonation state?',
  'Can a Targeted trooper re-enter Impersonation?',
  'May my targeted unit return to the Impersonation-1 state?',
  'Can a model in Targeted State enter Impersonation-2?',
  'Could a trooper while in the Targeted state regain Impersonation?',
  'Can a targeted model use Cybermask?',
  'Can my trooper in Targeted State declare Cybermask?',
]
for (const question of targetedCases) {
  const result = await retrieveRulesReference({ question, deepSeek: async () => { throw new Error('Targeted/Impersonation correction must bypass AI') } })
  assert.equal(result.deepSeek.conclusion, 'YES', question)
  assert.equal(result.deepSeek.certainty, 'EXPLICIT RULES ANSWER')
  assert.equal(result.deepSeek.interpretationRequired, false)
  assert.match(result.deepSeek.answer, /being Targeted does not mean.*currently in enemy LoF/)
  assert.match(result.deepSeek.answer, /outside the LoF of enemy Markers or Troopers/)
  assert.match(result.deepSeek.answer, /Targeted remains in effect/)
  assert.match(result.deepSeek.answer, /\+3 Discover MOD/)
  assert.ok(result.deepSeek.sources.some(source => source.url.endsWith('/Targeted_State')))
  const interaction = fakeInteraction()
  interaction.options = { getString: () => question }
  await createRulesInteractionHandler({ logger: quietLogger })(interaction)
  assert.deepEqual(interaction.calls.map(call => call[0]), ['reply'], question)
  const rendered = interaction.calls[0][1].embeds[0].fields.find(field => field.name === 'ANSWER').value
  assert.ok(rendered.length <= 1024)
  assert.match(rendered, /Targeted still prohibits Stealth and Cautious Movement\.$/)
  const evidence = buildRulesEvidencePrompt(productionCorpus, question)
  for (const term of ['targeted state', 'impersonation state', 'cybermask']) {
    assert.ok(productionCorpus.chunks.some((chunk, index) => chunk.canonicalTerm === term
      && evidence.evidenceIds.has('C' + String(index + 1).padStart(4, '0'))), 'missing evidence: ' + term)
  }
}
for (const question of [
  'Can a Targeted model enter Impersonation State while in enemy LoF?',
  'Can a Targeted model enter Impersonation State while Immobilized-B?',
  'Can a Targeted model enter Impersonation State under a special scenario exception?',
  'Can a Targeted model enter Camouflaged State?',
  'Can a Targeted model use Stealth?',
  'Can a Targeted model enter Impersonation State and clear Targeted?',
]) assert.equal(context.verifiedRulesInteraction(question, corpus), null, question)
assert.match(prompt, /Targeted State is a persistent game state, not proof of current enemy LoF/)
assert.match(prompt, /Do not generalize this permission to Camouflaged State/)
console.log('Targeted/Impersonation: 7 direct no-AI answers, retained state effects, complete citations/evidence, untruncated Discord replies, and 6 exception fallbacks passed.')



const continuousCoverQuestions = [
  'when rolling a save from continuous damage, do you still roll with cover?',
  'if shot in cover with a continuous weapon do you get the bonus to armor on subsequent saves:',
  'if shot in cover with a continuous damage weapon do you get the bonus to armour on subsequent saves?',
  'Do you keep the cover bonus on subsequent continuous damage saves?',
  'Can I apply partial cover to repeated saving rolls from continuous damage?',
  'Does partial cover apply to continuous damage saving rolls?',
  'Does cover carry over to subsequent continuous damage saves?',
  'Do continuous damage saves benefit from partial cover?',
]
for (const question of continuousCoverQuestions) {
  const result = await retrieveRulesReference({ question, deepSeek: async () => { throw new Error('Continuous Damage/Cover correction must bypass AI') } })
  assert.equal(result.deepSeek.conclusion, 'YES', question)
  assert.equal(result.deepSeek.certainty, 'EVIDENCE-BOUNDED INTERPRETATION')
  assert.match(result.deepSeek.answer, /every subsequent Continuous Damage save/)
  assert.match(result.deepSeek.answer, /Template Weapons do not grant/)
  assert.equal(result.deepSeek.sources.length, 4)
  const interaction = fakeInteraction()
  interaction.options = { getString: () => question }
  await createRulesInteractionHandler({ logger: quietLogger })(interaction)
  assert.deepEqual(interaction.calls.map(call => call[0]), ['reply'], question)
  const rendered = interaction.calls[0][1].embeds[0].fields.find(field => field.name === 'ANSWER').value
  assert.ok(rendered.length <= 1024)
  assert.match(rendered, /Other rules that deny the cover bonus still apply\.$/)
}
for (const question of [
  'Does cover apply to continuous damage saving rolls from a flamethrower?',
  'Does cover apply to continuous damage saving rolls with No Cover?',
  'Does cover apply to continuous damage saving rolls under a special scenario exception?',
  'Does cover apply to continuous damage saving rolls and can I use Guts?',
  'Can I get cover on saves?',
]) assert.equal(context.verifiedRulesInteraction(question, corpus), null, question)
console.log('Continuous Damage/Cover: 8 no-AI direct replies, template exception, complete Discord output, and 5 unrelated/exception fallbacks passed.')

for (const question of continuousCoverQuestions.slice(0, 2)) {
  const evidence = buildRulesEvidencePrompt(productionCorpus, question)
  for (const term of ['cover', 'template weapons and equipment']) {
    assert.ok(productionCorpus.chunks.some((chunk, index) => chunk.canonicalTerm === term
      && evidence.evidenceIds.has('C' + String(index + 1).padStart(4, '0'))), 'missing Continuous Damage evidence: ' + term)
  }
  assert.match(evidence.text, /Cover grants \+3 to Saving Rolls/)
}
console.log('Cover and template exclusion evidence selected for both screenshot questions.')

for (const question of ['When do you get cover from height?', 'Does a trooper on a roof get cover against an enemy below?', 'Does an Impetuous model get cover from elevation?']) {
  const evidence = buildRulesEvidencePrompt(productionCorpus, question)
  const { entries } = JSON.parse(evidence.text.split('\n').at(-1))
  assert.ok(entries.some(entry => /in contact with a piece of scenery that partially obscures/.test(entry.text)), question)
  assert.match(evidence.text, /without a parapet and without being Prone/)
}
const heightResult = await context.retrieveRulesReference({ question: 'when do you get cover from height?' })
assert.equal(heightResult.deepSeek.conclusion, 'DEPENDS')
assert.equal(heightResult.deepSeek.sources.length, 2)
assert.ok(heightResult.deepSeek.sources.some(source => source.url.endsWith('#Line_of_Fire_and_Cover')))
console.log('Height cover regressions passed: conditional answer, roof contact, diagram citations, evidence retrieval and exception routing.')
