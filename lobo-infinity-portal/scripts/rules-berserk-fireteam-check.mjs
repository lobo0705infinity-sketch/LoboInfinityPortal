import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const root = new URL('../', import.meta.url)
const source = await readFile(new URL('bot/rules-command.mjs', root), 'utf8')
const corpus = { manifest: { sources: [
  { id: 'infinity-rules-n5.3', title: 'Infinity Rules', version: '5.3' },
  { id: 'infinity-faq', title: 'Infinity FAQ', version: '0.1' },
  { id: 'its-season-18', title: 'ITS', version: '18' },
] } }
let providerCalls = 0, benchmarkCalls = 0, modelCalls = 0
const context = vm.createContext({
  ApplicationCommandOptionType: { String: 3 }, setTimeout, clearTimeout,
  normalizeRuleText: value => String(value ?? '').normalize('NFKD').replace(/[^a-zA-Z0-9+.-]+/g, ' ').trim().toLowerCase(),
  loadProductionRulesCorpus: async () => corpus,
  resolveRulesModelMentions: async () => { modelCalls++; return { models: [] } },
  createDeepSeekRulesAnswer: () => async ({ question }) => { providerCalls++; return { fallback: true, question } },
  findApprovedRulesAnswer: async () => { benchmarkCalls++; return null },
})
vm.runInContext(source.replace(/^import .*$/gm, '').replace(/\bexport /g, ''), context)

const questions = [
  'a Fireteam Leader declares Berserk. can the Fireteam members all Berserk different enemy targets?',
  'If the Fireteam Leader declares Berserk, can the Fireteam members all Berserk different enemy targets?',
  'Can Fireteam members Berserk different targets?',
  'Can all Fireteam members declare Berserk against different enemy targets?',
  'Can all members of a Fireteam use Berserk?',
  'Can a whole Fireteam Berserk?',
  'May the other Fireteam members perform Berserk at separate targets?',
  'Can link team members Berserk the same target?',
  'How does Berserk work in a Fireteam?',
  'What is the Lobo TO ruling on Berserk in a Fireteam?',
  'Can Fireteam members without Berserk join a Berserk charge?',
  'Must Fireteam members using Berserk all charge the same target?',
  'Can Fireteam members all make separate CC attacks after declaring Berserk?',
]
for (const question of questions) {
  const result = await context.retrieveRulesReference({ question })
  assert.equal(result.answerSource, 'LOBO_TO_RULING', question)
  assert.equal(result.deepSeek.interpretationRequired, true)
  assert.equal(result.deepSeek.certainty, 'EVIDENCE-BOUNDED INTERPRETATION')
  assert.equal(result.deepSeek.questionType, 'EXPLANATORY')
  const payload = context.formatRulesDiscordResponse(result)
  const answer = payload.embeds[0].fields.find(field => field.name === 'ANSWER').value
  assert.match(answer, /LOBO TO RULING — PENDING OFFICIAL CLARIFICATION/)
  assert.match(answer, /members who also have Berserk may charge different targets/)
  assert.match(answer, /resolve their attacks in separate combats/)
  assert.match(answer, /Members without Berserk Idle/)
  assert.match(answer, /LoF to their target when declaring/)
  assert.match(answer, /otherwise that user Idles without moving or attacking/)
  assert.match(answer, /same CC, only the Fireteam Leader makes the CC Roll/)
  assert.match(answer, /Normal coherency rules still apply/)
  assert.match(answer, /includes Move \+ CC Attack/)
  assert.match(answer, /except Berserk.*conflicting wording/)
  assert.match(answer, /not an unambiguous official answer\.$/)
  assert.doesNotMatch(answer, /EXPLICIT RULES ANSWER|…/)
  assert.ok(answer.length <= 1024)
  assert.equal(result.deepSeek.sources.length, 3)
  assert.ok(result.deepSeek.sources.every(item => item.url.startsWith('https://infinitythewiki.com/')))
  assert.match(payload.embeds[0].footer.text, /Lobo TO ruling pending official clarification; no provider call/)
  assert.deepEqual(Array.from(payload.allowedMentions.parse), [])
}
assert.equal(providerCalls, 0)
assert.equal(benchmarkCalls, 0)
assert.equal(modelCalls, 0)

// Specific profiles, reactive activations and additional restrictions are not
// answered by the general ruling, nor by an older fuzzy benchmark match.
const exceptions = [
  'Can a Fireteam Berserk in the Reactive Turn?',
  'Can Fireteam members Berserk different targets under a special scenario exception?',
  'Can an Immobilized-A Fireteam member Berserk?',
  'Can a Fireteam member use Berserk while Unconscious?',
  'Can a Fireteam of Morlocks Berserk different targets?',
  'Can Fireteam members Berserk different targets through Smoke?',
  'Can Fireteam members Berserk different targets without LoF?',
  'Can Fireteam members Berserk different targets and then Dodge?',
]
for (const question of exceptions) {
  const result = await context.retrieveRulesReference({ question })
  assert.equal(result.fallback, true, question)
  assert.equal(result.question, question)
}
assert.equal(providerCalls, exceptions.length)
assert.equal(benchmarkCalls, 0, 'exceptions must bypass older Fireteam/Berserk benchmark answers')
for (const question of ['Can a trooper Berserk?', 'How do Fireteam bonuses work?', 'Can Coordinated Orders use Berserk?']) {
  assert.equal(context.loboBerserkFireteamRuling(question, corpus), null, question)
}

// Exercise delivery through the actual command handler without sending Discord
// messages: the corrected answer should be a direct response, never a paid call.
const interaction = {
  commandName: 'rules', deferred: false, replied: false, calls: [],
  isChatInputCommand: () => true, options: { getString: () => questions[0] },
  async reply(payload) { this.replied = true; this.calls.push(['reply', payload]) },
  async deferReply() { this.deferred = true; this.calls.push(['defer']) },
  async editReply(payload) { this.calls.push(['edit', payload]) },
}
await context.createRulesInteractionHandler({ logger: { info() {}, error() {} } })(interaction)
assert.deepEqual(interaction.calls.map(call => call[0]), ['reply'])
assert.match(interaction.calls[0][1].embeds[0].fields.find(field => field.name === 'ANSWER').value, /LOBO TO RULING/)
const prompt = await readFile(new URL('bot/deepseek-rules.mjs', root), 'utf8')
assert.match(prompt, /specific Fireteams and Berserk Sibylla clarification/)
assert.match(prompt, /acknowledge the conflicting wording/)
assert.match(prompt, /not a later separate CC declaration/)
console.log('Berserk/Fireteam regression passed: 13 ruling variants, 8 exception fallbacks, full Discord output and command delivery.')
