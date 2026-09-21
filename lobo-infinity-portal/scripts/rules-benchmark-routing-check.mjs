import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { findApprovedRulesAnswer, loadRulesBenchmark, normalizeQuestion } from '../bot/rules-benchmark.mjs'
import { retrieveRulesReference, formatRulesDiscordResponse } from '../bot/rules-command.mjs'

const root = resolve(import.meta.dirname, '..')
const index = await loadRulesBenchmark({ force: true })
assert.equal(index.canonicalCases, 1400)

for (const file of ['rules-adjudicator-benchmark.json', 'rules-adjudicator-expansion-400.json', 'rules-adjudicator-new-topics-400.json', 'rules-adjudicator-new-topics-500.json', 'rules-benchmark-approved-updates-2026-09-15.json']) {
  const document = JSON.parse(await readFile(resolve(root, 'data/infinity-rules', file), 'utf8'))
  for (const item of document.cases || []) {
    const questions = [item.question, item.canonicalQuestion, ...(item.queryVariants || []).map((variant) => variant.question)].filter(Boolean)
    const trusted = item.reviewStatus === 'APPROVED' || item.reviewStatus === 'AUTO_VERIFIED_EXPLICIT' || file === 'rules-adjudicator-expansion-400.json' || (file === 'rules-adjudicator-new-topics-500.json' && Number(item.id.split('-').at(-1)) >= 481)
    for (const question of questions) {
      const match = await findApprovedRulesAnswer(question)
      assert.equal(Boolean(match), trusted, `${item.id}: ${question}`)
      if (trusted) {
        const expectedFamily = file === 'rules-adjudicator-expansion-400.json' ? item.canonicalId : item.id
        assert.equal(match.familyId, expectedFamily, `wrong ruling family for ${item.id}: ${question}`)
      }
    }
  }
}

assert.equal(await findApprovedRulesAnswer('purple bananas orbit a quantum teapot'), null)
assert.equal((await findApprovedRulesAnswer('May a Hidden Deployment trooper place a Mine without revealing itself?'))?.id, 'new-topic-2-482')
const naturalParaphrases = [
  ['Can a hidden deployment unit drop a mine and stay hidden?', 'new-topic-2-482'],
  ['Does stealth stop hacking AROs through a repeater?', 'new-topic-2-490'],
  ['What are the rules for dodging?', 'direct_definition-02'],
  ['If my hidden deployment trooper delays, does it reveal?', 'new-topic-2-501'],
  ['does delaying your aro cancel hidden deployment state', 'new-topic-2-501'],
  ['Does delaying an ARO break Hidden Deployment?', 'new-topic-2-501'],
  ['Can a hidden model delay without revealing?', 'new-topic-2-501'],
  ['Does choosing to delay break camouflage?', 'new-topic-2-501'],
  ['Can cautious move in zoc without stealth?', 'new-topic-2-502'],
  ['Do you have to declare if a holomask trooper is hackable?', 'new-topic-2-503'],
  ['If I am doing a coordinated order with some targetless weapons and some without targetless can they target different things?', 'new-topic-2-504'],
  ['Can a coordinated rifle and smoke grenade choose different targets?', 'new-topic-2-504'],
  ['Can Targetless and non-Targetless attacks split targets in a coordinated order?', 'new-topic-2-504'],
  ['What is a TacBall and how it works', 'new-topic-2-505'],
  ['How does Tacball work?', 'new-topic-2-505'],
  ['how does request tacball work?', 'new-topic-2-506'],
  ['When can I request a Tacball?', 'new-topic-2-506'],
  ['Does Request a Tacball require a PH test?', 'new-topic-2-506'],
  ['Do I roll PH to request a Tacball?', 'new-topic-2-506'],
  ['can u drop tacball if only one player has tacops', 'new-topic-2-517'],
  ['can u dropp tacbal if only one player has tacopps', 'new-topic-2-517'],
  ['Can I drop a Tacball if only I have Team-Ops?', 'new-topic-2-517'],
  ['does reqest tacbal require a ph tst', 'new-topic-2-506'],
  ['Can a unit and their synchronize peripheral pick up from the same panoply on the same order?', 'new-topic-2-507'],
  ['Can a unit and their syncronize peripheral pik up from the same panopaly on the same order?', 'new-topic-2-507'],
  ['silly won but does fireteam master override the loss of lt irregular orders', 'new-topic-2-508'],
  ['Does FT Master stop Loss of Lieutenant from making the link Irregular?', 'new-topic-2-508'],
  ['Which takes precedence, FT Master or Loss of Lieutenant?', 'new-topic-2-508'],
  ['Can a model squeeze through a gap if it is along the table edge?', 'new-topic-2-509'],
  ['Can part of a model\'s base hang off the board while it moves past terrain?', 'new-topic-2-510'],
  ['Can half my base hang past the board edge while Climbing?', 'new-topic-2-511'],
  ['Can a model squeeze through a gap if it is along the table edge if it is jumping', 'new-topic-2-512'],
  ['What saves do you roll for a plasma crit save (ARM + BTS)?', 'new-topic-2-513'],
  ['How many saves does a Plasma critical cause?', 'new-topic-2-513'],
  ['Is a Plasma crit 2 ARM and 1 BTS?', 'new-topic-2-513'],
  ['Can you use berserk when you are in base to base contact?', 'new-topic-2-520'],
  ['Can I Berserk while engaged?', 'new-topic-2-520'],
  ['can i berzerk whille in btb', 'new-topic-2-520'],
]
for (const [question, expectedId] of naturalParaphrases) {
  assert.equal((await findApprovedRulesAnswer(question))?.id, expectedId, question)
}
const holoMaskHackable = await findApprovedRulesAnswer('Do you have to declare if a holomask trooper is hackable?')
assert.equal(holoMaskHackable?.conclusion, 'DEPENDS')
assert.match(holoMaskHackable?.answer || '', /enters or is inside an enemy Hacking Area/i)
assert.match(holoMaskHackable?.answer || '', /lacks Hacker or Hackable status/i)
const mixedCoordinatedTargetless = await findApprovedRulesAnswer('Can Targetless and non-Targetless attacks split targets in a coordinated order?')
assert.equal(mixedCoordinatedTargetless?.conclusion, 'NO')
assert.match(mixedCoordinatedTargetless?.answer || '', /all participating Troopers must act against that same single target/i)
const tacball = await findApprovedRulesAnswer('What is a TacBall and how it works')
assert.equal(tacball?.conclusion, 'INTERPRETATION')
assert.match(tacball?.answer || '', /stationary Deployable Weapon/i)
assert.deepEqual(tacball?.citations.map((citation) => citation.page), [29, 30])
const requestTacball = await findApprovedRulesAnswer('how does request tacball work?')
assert.equal(requestTacball?.conclusion, 'INTERPRETATION')
assert.match(requestTacball?.answer || '', /second Game Round/i)
assert.match(requestTacball?.answer || '', /requires no Roll/i)
assert.match(requestTacball?.answer || '', /only once per game/i)
assert.deepEqual(requestTacball?.citations.map((citation) => citation.page), [29])
const oneSidedTacball = await findApprovedRulesAnswer('can u drop tacball if only one player has tacops')
assert.equal(oneSidedTacball?.conclusion, 'YES')
assert.match(oneSidedTacball?.answer || '', /does not require the opponent to have Team-Ops/i)
assert.match(oneSidedTacball?.answer || '', /only if both players have Team-Ops Units/i)
assert.deepEqual(oneSidedTacball?.citations.map((citation) => citation.page), [29, 30])
const synchronizedPanoply = await findApprovedRulesAnswer('Can a unit and their synchronize peripheral pick up from the same panoply on the same order?')
assert.equal(synchronizedPanoply?.conclusion, 'YES')
assert.match(synchronizedPanoply?.answer || '', /both Models are in Silhouette contact/i)
assert.deepEqual(synchronizedPanoply?.citations.map((citation) => citation.page), [106, 54])
const ftMasterLossOfLieutenant = await findApprovedRulesAnswer('silly won but does fireteam master override the loss of lt irregular orders')
assert.equal(ftMasterLossOfLieutenant?.conclusion, 'NO')
assert.match(ftMasterLossOfLieutenant?.answer || '', /does not override Loss of Lieutenant/i)
assert.match(ftMasterLossOfLieutenant?.answer || '', /does not prevent its members from suffering the effects/i)
assert.deepEqual(ftMasterLossOfLieutenant?.citations.map((citation) => citation.page), [93, 18])
for (const question of [
  'Can Alert place a Mine?',
  'When is Alert allowed?',
  'Does Mimetism let a trooper hack through a Repeater?',
  'Can a purple unit shoot a quantum banana?',
]) {
  assert.equal(await findApprovedRulesAnswer(question), null, `unsafe match: ${question}`)
}
let calls = 0
const fallback = async ({ question }) => { calls++; return { question, status: 'FALLBACK' } }
const matched = await retrieveRulesReference({ question: 'What does Mimetism do?', deepSeek: fallback })
assert.equal(matched.answerSource, 'APPROVED_BENCHMARK')
assert.equal(calls, 0)
const unmatched = await retrieveRulesReference({ question: 'purple bananas orbit a quantum teapot', deepSeek: fallback })
assert.equal(unmatched.status, 'FALLBACK')
assert.equal(calls, 1)
const matchedTacball = await retrieveRulesReference({ question: 'What is a TacBall and how it works', deepSeek: fallback })
assert.equal(matchedTacball.answerSource, 'APPROVED_BENCHMARK')
assert.equal(matchedTacball.benchmark.id, 'new-topic-2-505')
assert.equal(calls, 1)
const matchedRequestTacball = await retrieveRulesReference({ question: 'how does request tacball work?', deepSeek: fallback })
assert.equal(matchedRequestTacball.answerSource, 'APPROVED_BENCHMARK')
assert.equal(matchedRequestTacball.benchmark.id, 'new-topic-2-506')
assert.equal(calls, 1)
const matchedSynchronizedPanoply = await retrieveRulesReference({ question: 'Can a unit and their synchronize peripheral pick up from the same panoply on the same order?', deepSeek: fallback })
assert.equal(matchedSynchronizedPanoply.answerSource, 'APPROVED_BENCHMARK')
assert.equal(matchedSynchronizedPanoply.benchmark.id, 'new-topic-2-507')
assert.equal(calls, 1)
const matchedMisspelledPanoply = await retrieveRulesReference({ question: 'Can a unit and their syncronize peripheral pik up from the same panopaly on the same order?', deepSeek: fallback })
assert.equal(matchedMisspelledPanoply.answerSource, 'APPROVED_BENCHMARK')
assert.equal(matchedMisspelledPanoply.benchmark.id, 'new-topic-2-507')
assert.equal(calls, 1)
for (const question of [
  'What Saving Rolls does a target make for a Critical hit from a Plasma weapon?',
  'What saves do you roll for a plasma crit save (ARM + BTS)?',
  'How many saves does a Plasma critical cause?',
  'Does a Plasma crit cause two ARM saves and one BTS save?',
  'Which attribute is used for the extra Saving Roll from a Plasma Critical?',
  'I was hit by a critical Plasma shot. What saves do I make?',
  'Is a Plasma crit 2 ARM and 1 BTS?',
  'For Plasma ammunition, does the Critical add an ARM roll or a BTS roll?',
]) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
  assert.equal(result.benchmark.id, 'new-topic-2-513', question)
  assert.equal(result.deepSeek.certainty, 'EXPLICIT RULES ANSWER', question)
  assert.match(result.deepSeek.answer || '', /three Saving Rolls: two ARM Saving Rolls and one BTS Saving Roll/i, question)
  assert.match(result.deepSeek.answer || '', /Critical adds one additional ARM Saving Roll/i, question)
  assert.deepEqual(result.deepSeek.sources.map((source) => source.page), ['p. 37', 'p. 47', 'p. 96'], question)
}
assert.equal(calls, 1)
for (const question of [
  'Can a model squeeze through a gap if it is along the table edge?',
  'Can a trooper squeeze between terrain and the table edge?',
  "Does a model's entire base have to fit through a gap beside the table edge?",
  'Can I move jump or climb past terrain using the edge of the board?',
  'Does a trooper need its whole base supported when moving, jumping, or climbing near the table edge?',
]) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
  assert.equal(result.benchmark.id, 'new-topic-2-509', question)
  assert.equal(result.deepSeek.conclusion, 'DEPENDS', question)
  assert.match(result.deepSeek.answer || '', /Move: Yes, provided at least half of the base remains supported/i, question)
  assert.match(result.deepSeek.answer || '', /Climb or Climbing Plus: Yes/i, question)
  assert.match(result.deepSeek.answer || '', /Jump or Super-Jump: The table-edge issue is not explicitly resolved/i, question)
  assert.match(result.deepSeek.answer || '', /without passing through scenery/i, question)
  assert.match(result.deepSeek.answer || '', /tournament-organizer ruling for Jump at the table edge/i, question)
  assert.equal(result.deepSeek.certainty, 'EVIDENCE-BOUNDED INTERPRETATION', question)
  assert.deepEqual(result.deepSeek.sources.map((source) => source.page), ['p. 28', 'p. 31', 'p. 32', 'p. 34', 'p. 10'], question)
}
assert.equal(calls, 1)
for (const question of [
  'Can a Trooper squeeze between terrain and the table edge using Move?',
  'Can I move through a narrow gap at the board edge if half the base stays supported?',
  'Can my base overhang the table edge during a Move?',
  "Can part of a model's base hang off the board while it moves past terrain?",
  "How much of a trooper's base must remain on the table while moving along the edge?",
  'Can a model Move past a building at the board edge when the whole base does not fit?',
]) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
  assert.equal(result.benchmark.id, 'new-topic-2-510', question)
  assert.equal(result.deepSeek.conclusion, 'YES', question)
  assert.match(result.deepSeek.answer || '', /^Yes, provided at least half of the Trooper's base remains supported/i, question)
  assert.deepEqual(result.deepSeek.sources.map((source) => source.page), ['p. 28', 'p. 31'], question)
}
assert.equal(calls, 1)
for (const question of [
  'Can a Trooper squeeze at the table edge using Climb or Climbing Plus?',
  'Can a trooper Climb through a narrow gap at the table edge?',
  'Can half my base hang past the board edge while Climbing?',
  'How much base contact does Climb require beside the table edge?',
  'Can Climbing Plus move along a narrow table-edge surface with only half the base supported?',
  'Is it legal to climb around terrain when part of the base is off the table?',
]) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
  assert.equal(result.benchmark.id, 'new-topic-2-511', question)
  assert.equal(result.deepSeek.conclusion, 'YES', question)
  assert.match(result.deepSeek.answer || '', /^Yes, provided at least half of the Trooper's base underside remains in contact/i, question)
  assert.deepEqual(result.deepSeek.sources.map((source) => source.page), ['p. 32', 'p. 10'], question)
}
assert.equal(calls, 1)
for (const question of [
  'Can a Trooper squeeze between terrain and the table edge while Jumping?',
  'Can a model squeeze through a gap if it is along the table edge if it is jumping',
  'Can a trooper Jump across a gap beside the table edge?',
  'Can I jump through the narrow space between terrain and the board edge?',
  'Does the base need support while a model is Jumping over an edge gap?',
  'Can a model leap over a gap along the edge of the table if its landing spot fits the whole base?',
  'Can you squeeze by terrain at the board edge using Jump instead of Move?',
  'Can Super-Jump leave the physical table boundary during its trajectory?',
]) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
  assert.equal(result.benchmark.id, 'new-topic-2-512', question)
  assert.equal(result.deepSeek.conclusion, 'UNRESOLVED', question)
  assert.match(result.deepSeek.answer || '', /^Not explicitly resolved\./i, question)
  assert.match(result.deepSeek.answer || '', /complete Silhouette/i, question)
  assert.doesNotMatch(result.deepSeek.answer || '', /Move:|Climb or Climbing Plus:/i, question)
  assert.deepEqual(result.deepSeek.sources.map((source) => source.page), ['p. 34', 'p. 10'], question)
}
assert.equal(calls, 1)
for (const question of [
  'Can my trooper and sync bot both use the same Panoply with one Order?',
  'Can a Controller and synchronized Peripheral each get an item from one Panoply in the same Order?',
  'If both the Controller and Peripheral are touching a Panoply, can they both roll on it?',
  'Does a synchronized Peripheral have to use a different Panoply from its Controller?',
  'Can two synchronized Models loot the same Panoply during one Order?',
  'Can a Peripheral (Synchronized) use a Panoply at the same time as its Controller?',
  'Do the Controller and its synchronized Peripheral make separate WIP Rolls on the same Panoply?',
  'Can a unit and its synced remote both take equipment from the same Panoply?',
  'Does one Order let a Controller and synchronized Peripheral both declare Use Panoplies?',
  'Can the Controller and sync peripheral use the same scenery Panoply together?',
  'One Panoply, two synchronized Models: can both receive equipment in the same Order?',
  'Can both members of a Controller and Peripheral (Synchronized) pair successfully use one Panoply at once?',
]) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
  assert.equal(result.benchmark.id, 'new-topic-2-507', question)
}
assert.equal(calls, 1)
for (const question of [
  'Does FT Master override Loss of Lieutenant and keep the Fireteam Regular?',
  'silly won but does fireteam master override the loss of lt irregular orders',
  'Does Fireteam Master override the loss of irregular orders?',
  'Does FT Master stop Loss of Lieutenant from making the link Irregular?',
  'Are members of a Fireteam with an FT Master Regular during Loss of Lieutenant?',
  'If my army is in Loss of Lieutenant, does Fireteam Master still make its members Regular?',
  'Can FT Master cancel the Irregular effect of Loss of Lieutenant?',
  'Which takes precedence, FT Master or Loss of Lieutenant?',
  'Does a Fireteam Master preserve Regular Orders in Loss of Lieutenant?',
  'Do troops in an FT Master link become Irregular when the Lieutenant is lost?',
  'Does the FT Master Order Count effect supersede Loss of Lieutenant?',
  'Can a Fireteam with FT Master contribute Regular Orders while in LoL?',
  'Are FT Master Fireteam members exempt from Loss of Lieutenant?',
  'My Lieutenant died but I have FT Master. Is that Fireteam still Regular?',
  'Does Fireteam Master prevent its members from suffering Loss of Lieutenant?',
]) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
  assert.equal(result.benchmark.id, 'new-topic-2-508', question)
  assert.equal(result.deepSeek.conclusion, 'NO', question)
}
assert.equal(calls, 1)

const impetuousDocument = JSON.parse(await readFile(resolve(root, 'data/infinity-rules/rules-benchmark-approved-updates-2026-09-15.json'), 'utf8'))
const impetuousCase = impetuousDocument.cases.find((item) => item.id === 'new-topic-2-514')
assert.equal(impetuousCase.queryVariants.length, 10)
assert.equal(new Set(impetuousCase.queryVariants.map((item) => item.question.toLowerCase())).size, 10)
for (const { question } of impetuousCase.queryVariants) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
  assert.equal(result.benchmark.id, 'new-topic-2-514', question)
  assert.equal(result.deepSeek.conclusion, 'DEPENDS', question)
  assert.match(result.deepSeek.answer, /Dodge has the Movement label/, question)
  assert.match(result.deepSeek.answer, /Impetuous movement restrictions apply/, question)
  assert.match(result.deepSeek.answer, /First reach Silhouette contact/, question)
  assert.match(result.deepSeek.answer, /without doubling back/, question)
  assert.match(result.deepSeek.answer, /Once inside the enemy Deployment Zone/, question)
  assert.match(result.deepSeek.answer, /ARO or during a regular Order/, question)
  assert.doesNotMatch(result.deepSeek.answer, /Dodge allows movement with no directional restriction/, question)
  assert.deepEqual(result.deepSeek.sources.map((source) => source.page), ['p. 79', 'p. 97'], question)
  const payload = formatRulesDiscordResponse(result)
  const answer = payload.embeds[0].fields.find((field) => field.name === 'ANSWER').value
  assert.ok(answer.length <= 1024)
  assert.match(answer, /ARO or during a regular Order/, 'Discord must preserve the exceptions, not truncate them')
}
assert.equal(calls, 1, 'All ten Impetuous phrasings must bypass the AI provider')
// Similar vocabulary must not turn reactive/regular Dodge into an Impetuous activation.
for (const question of [
  'Can an Impetuous trooper Dodge sideways in ARO?',
  'Can I Dodge sideways during a regular Order with an Impetuous trooper?',
]) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.status, 'FALLBACK', question)
}
assert.equal(calls, 3)


const smokeCase = impetuousDocument.cases.find((item) => item.id === 'new-topic-2-515')
assert.equal(smokeCase.queryVariants.length, 100)
assert.equal(new Set(smokeCase.queryVariants.map((item) => normalizeQuestion(item.question))).size, 100, 'All 100 must remain distinct after normalization')
assert.deepEqual(['BOTH_SHOOT', 'TARGET_DODGES', 'RESPONSE_UNSPECIFIED'].map((style) => smokeCase.queryVariants.filter((item) => item.style === style).length), [40, 30, 30])
for (const { question } of smokeCase.queryVariants) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
  assert.equal(result.benchmark.id, 'new-topic-2-515', question)
  assert.equal(result.deepSeek.conclusion, 'DEPENDS', question)
  assert.match(result.deepSeek.answer, /both MSV1 troopers shoot at each other.*each takes a -3 Visibility MOD/, question)
  assert.match(result.deepSeek.answer, /target Dodges instead, the MSV1 shooter takes -6/, question)
  assert.match(result.deepSeek.answer, /Dodge takes no Visibility Zone MOD/, question)
  assert.match(result.deepSeek.answer, /other Dodge MODs may apply/, question)
  assert.match(result.deepSeek.answer, /Range, Cover and other applicable MODs separately/, question)
  assert.deepEqual(result.deepSeek.sources.map((source) => source.page), ['p. 125', 'p. 144'], question)
  const answerField = formatRulesDiscordResponse(result).embeds[0].fields.find((field) => field.name === 'ANSWER').value
  assert.ok(answerField.length <= 1024)
  assert.match(answerField, /does not apply to Eclipse or White Noise/, 'All conditions must fit the Discord answer')
}
assert.equal(calls, 3, 'None of the 100 MSV1 phrasings may call the AI provider')
// Equipment changes and special exceptions must not inherit the ordinary-smoke answer.
for (const question of [
  'MSV2 versus MSV1 through smoke: what modifiers do both get?',
  'MSV3 versus MSV1 through smoke: what modifiers do both get?',
  'MSV1 versus MSV1 through Eclipse smoke: what modifiers do both get?',
  'MSV1 versus MSV1 through smoke and White Noise: what modifiers do both get?',
  'MSV1 versus MSV1 through smoke with Sixth Sense: what modifiers do both get?',
  'MSV1 versus MSV1 through smoke with Albedo: what modifiers do both get?',
  'MSV1 versus a model without MSV1 through smoke: what modifiers do both get?',
  'MSV1 versus MSV1 through smoke using Speculative Attack: what modifiers do both get?',
  'MSV1 versus MSV1 through smoke using Intuitive Attack: what modifiers do both get?',
]) {
  assert.notEqual((await findApprovedRulesAnswer(question))?.id, 'new-topic-2-515', question)
}
// Formatting variants not copied into the 100 questions still normalize to the right family.
for (const question of [
  'MSV 1 versus MSV 1 through smoke: what modifiers do both get?',
  'MSV-1 versus MSV-1 through smoke: what modifiers do both get?',
  'Multispectral Visor Level 1 versus Multispectral Visor Level 1 through smoke: what modifiers do both get?',
]) assert.equal((await findApprovedRulesAnswer(question))?.id, 'new-topic-2-515', question)
console.log('PASS - 100 distinct MSV1/smoke phrasings, 9 exception boundaries, spelling normalization, complete Discord output, and zero AI calls.')


const mineCase = impetuousDocument.cases.find((item) => item.id === 'new-topic-2-516')
assert.equal(mineCase.queryVariants.length, 40)
assert.equal(new Set(mineCase.queryVariants.map((item) => normalizeQuestion(item.question))).size, 40)
for (const { question } of mineCase.queryVariants) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
  assert.equal(result.benchmark.id, 'new-topic-2-516', question)
  assert.equal(result.deepSeek.conclusion, 'DEPENDS', question)
  assert.match(result.deepSeek.answer, /Already Engaged with the Mine owner's ally: no trigger/, question)
  assert.match(result.deepSeek.answer, /valid position before contact/, question)
  assert.match(result.deepSeek.answer, /without affecting any ally/, question)
  assert.match(result.deepSeek.answer, /does not undo that earlier legal trigger/, question)
  assert.match(result.deepSeek.answer, /LoF alone is insufficient/, question)
  assert.match(result.deepSeek.answer, /Dodge movement itself does not trigger Mines/, question)
  assert.match(result.deepSeek.answer, /declaring Dodge while already inside the Trigger Area can trigger/, question)
  assert.deepEqual(result.deepSeek.sources.map((source) => source.page), ['p. 72', 'p. 45', 'p. 14'], question)
  const field = formatRulesDiscordResponse(result).embeds[0].fields.find((item) => item.name === 'ANSWER').value
  assert.ok(field.length <= 1024)
  assert.match(field, /These distinctions assume/, 'Discord must retain the ownership qualification')
}
assert.equal(calls, 3, 'All 40 Mine cases must bypass the provider')
for (const question of [
  'Do Chest Mines trigger against engaged models?',
  'Do Cybermines trigger against engaged models?',
  'Do mines trigger against engaged models in multiplayer with no allies involved?',
]) assert.notEqual((await findApprovedRulesAnswer(question))?.id, 'new-topic-2-516', question)
console.log('PASS - 40 Mine/Engaged phrasings, timing and friendly-fire conditions, Dodge movement versus declaration, full Discord output, and zero AI calls.')

const perimeterCase = impetuousDocument.cases.find((item) => item.id === 'new-topic-2-518')
assert.equal(perimeterCase.queryVariants.length, 8)
for (const { question } of perimeterCase.queryVariants) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
  assert.equal(result.benchmark.id, 'new-topic-2-518', question)
  assert.equal(result.deepSeek.conclusion, 'NO', question)
  assert.match(result.deepSeek.answer, /do not trigger on Camouflage Markers/i, question)
  assert.deepEqual(result.deepSeek.sources.map((source) => source.page), ['p. 69'], question)
}
for (const question of [
  'can a crazy koala trigger on a camouflage marker?',
  'Can a Crazy Koala trigger on a Camouflage Marker?',
]) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
  assert.equal(result.benchmark.id, 'new-topic-2-518', question)
  assert.equal(result.deepSeek.conclusion, 'NO', question)
}
assert.equal(calls, 3, 'All CrazyKoala/Camouflage phrasings must bypass the provider')
console.log('PASS - CrazyKoala and Perimeter Weapon marker triggers route directly from the approved rules benchmark.')

const perimeterPlacementCase = impetuousDocument.cases.find((item) => item.id === 'new-topic-2-519')
assert.equal(perimeterPlacementCase.queryVariants.length, 12)
for (const { question } of perimeterPlacementCase.queryVariants) {
  const result = await retrieveRulesReference({ question, deepSeek: fallback })
  assert.equal(result.answerSource, 'APPROVED_BENCHMARK', question)
  assert.equal(result.benchmark.id, 'new-topic-2-519', question)
  assert.equal(result.deepSeek.conclusion, 'DEPENDS', question)
  assert.match(result.deepSeek.answer, /valid, non-Camouflaged enemy/i, question)
  assert.deepEqual(result.deepSeek.sources.map((source) => source.page), ['p. 82', 'p. 69'], question)
}
assert.equal(calls, 3, 'CrazyKoala placement questions must bypass the provider')
console.log('PASS - CrazyKoala placement near Camouflage Markers routes directly from the approved rules benchmark.')

console.log(`PASS - ${index.canonicalCases} trusted benchmark rulings route before DeepSeek; unmatched questions fall back exactly once.`)
