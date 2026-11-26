import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildRulesEvidencePrompt } from '../bot/deepseek-rules.mjs'
import { findApprovedRulesAnswer } from '../bot/rules-benchmark.mjs'
import { formatRulesDiscordResponse, retrieveRulesReference } from '../bot/rules-command.mjs'

const benchmark = JSON.parse(await readFile(new URL('../data/infinity-rules/rules-benchmark-approved-updates-2026-09-15.json', import.meta.url)))
const reported = 'if a model with an E/M weapon and BS attack shock shoots a model in NWI state does the model die if it fails the e/m save?'
const expectations = [
  ['new-topic-2-535', 'YES', [reported, 'Can BS Attack (Shock) with an E/Mitter kill a trooper already in No Wound Incapacitation?'], [/failing either save/i, /VITA 1/, /Non-Lethal prevents the Wound/i, /directly to Dead/i]],
  ['new-topic-2-536', 'NO', [], [/healthy/i, /zero Wounds/i, /conscious/i]],
  ['new-topic-2-537', 'NO', [], [/Immunity \(Shock\)/i, /VITA 2\+ or STR/, /remains in NWI/i]],
  ['new-topic-2-538', 'NO', [], [/E\/M alone/i, /zero Wounds/i, /remains in NWI/i]],
  ['new-topic-2-539', 'NO', ["Doesn't shock state the model has to take a wound?"], [/no additional Wound is required/i, /on that failed save/i]],
]
const noProvider = () => { throw new Error('The approved case reached the AI provider') }
let prompts = 0
for (const [id, verdict, examples, details] of expectations) {
  const item = benchmark.cases.find(record => record.id === id)
  const questions = new Set([item.canonicalQuestion, ...item.queryVariants.map(v => v.question), ...examples])
  for (const question of questions) {
    const answer = await retrieveRulesReference({ question, deepSeek: noProvider })
    assert.equal(answer.answerSource, 'APPROVED_BENCHMARK', question)
    assert.equal(answer.benchmark.id, id, question)
    assert.equal(answer.deepSeek.conclusion, verdict, question)
    assert.equal(answer.deepSeek.interpretationRequired, id !== 'new-topic-2-538')
    const fields = formatRulesDiscordResponse(answer).embeds[0].fields
    const body = fields.find(field => field.name === 'ANSWER').value
    assert.ok(body.includes(item.approvedAnswer), 'Discord clipped the approved answer')
    for (const pattern of details) assert.match(body, pattern, question)
    const sources = fields.find(field => field.name === 'OFFICIAL SOURCES').value
    for (const citation of item.approvedCitations) assert.ok(sources.includes('(' + citation.url + ')'), citation.url)
    prompts++
  }
}

// These change who has Shock, which weapon attacks, or what happened to the target.
const ids = new Set(expectations.map(([id]) => id))
for (const question of [
  reported.replace('fails the', 'passes the'),
  reported.replace('and BS attack shock', 'without BS attack shock'),
  'Does a failed N+E/M CC Weapon save kill a Shock-immune trooper in NWI?',
  'My E/M Mine hits a model in NWI. Does the owner’s BS Attack (Shock) carry over?',
  'A model with an E/M weapon shoots an NWI model that has BS Attack (Shock). Does the target die?',
  'Can a healthy target survive a Shock Rifle hit?',
]) assert.ok(!ids.has((await findApprovedRulesAnswer(question))?.id), question)

// Named profiles use Army data and the same rules, including on a short evidence retry.
const namedQuestion = 'Dart is already in NWI. Can an E/M Carbine fired with BS Attack (Shock) kill her?'
let evidenceChecked = false
await retrieveRulesReference({ question: namedQuestion, deepSeek: async ({ question, corpus, modelResolution }) => {
  const dart = modelResolution.models.find(model => model.matchedAlias === 'dart')
  assert.ok(dart?.variants.length && dart.variants.every(profile => profile.skills.includes('Immunity Shock')))
  for (const options of [{}, { limit: 6, maxEvidenceCharacters: 12000 }]) {
    const prompt = buildRulesEvidencePrompt(corpus, question, { ...options, modelResolution })
    const { entries } = JSON.parse(prompt.text.split('\n').at(-1))
    for (const [section, page, text] of [
      ['MODIFIERS EXPLAINED', '75', /adds Shock ammunition/i],
      ['COMBINED AMMUNITION', '67', /effects of each component/i],
      ['SHOCK AMMUNITION', '65', /a failed Shock Saving Roll also cancels/i],
      ['NO WOUND INCAPACITATION', '104', /enters Unconscious State/i],
      ['NON-LETHAL', '175', /cannot inflict a Wound/i],
      ['IMMUNITY', '95', /ignores its special effects/i],
      ['ELECTROMAGNETIC (E/M) AMMUNITION', '64', /two Saving Rolls per hit/i],
      ['WEAPON CHART — E/M CARBINE', '176', /Non-Lethal/i],
    ]) assert.ok(entries.some(entry => entry.sourceId === 'infinity-rules-n5.3' && entry.section === section && entry.page === page && text.test(entry.text)), section)
  }
  evidenceChecked = true
} })
assert.ok(evidenceChecked)
console.log(`E/M + Shock: ${prompts} Discord rulings passed, plus changed-premise and named-profile evidence checks.`)
