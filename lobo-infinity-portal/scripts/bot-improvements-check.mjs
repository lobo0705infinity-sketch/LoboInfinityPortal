import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reportableResponse, createBotFeedbackHandler, installFeedbackCapture } from '../bot/bot-feedback.mjs'
import { PermissionFlagsBits } from 'discord.js'
import { createInfListResponse } from '../bot/inf-list-command.mjs'
import { classifyTacticalBrief } from '../bot/inf-list-tactical.mjs'
import { ratingExplanations, unmetTargetExplanation } from '../bot/rating-explanations.mjs'
import { validateTtsExport } from '../bot/tts-export-validation.mjs'
const dir = await mkdtemp(join(tmpdir(), 'bot-feedback-test-'))
try {
  const response = await reportableResponse({ content: 'Answer', files: [{ attachment: Buffer.from('details'), name: 'rating-explanations.txt' }] }, { command: 'rules', inputs: [{ name: 'question', value: 'Test?' }], guildId: 'guild' }, { dir })
  const id = response.components[0].components[0].custom_id.split(':')[1]
  const handle = createBotFeedbackHandler({ dir })
  let modal, answer
  await handle({ isButton: () => true, customId: `bot-report:${id}`, message: { author: { id: 'bot' } }, client: { user: { id: 'bot' } }, showModal: async x => { modal = x } })
  assert.equal(modal.custom_id, `bot-report-submit:${id}`)
  const submit = { isModalSubmit: () => true, customId: modal.custom_id, guildId: 'guild', user: { id: 'user' }, message: { url: 'https://discord.com/channels/guild/channel/message' }, fields: { getTextInputValue: () => 'Wrong rule' }, deferReply: async () => {}, editReply: async x => { answer = x } }
  await handle(submit); assert.match(answer, /Report saved/)
  await handle(submit); assert.match(answer, /already reported/)
  const record = JSON.parse((await readFile(join(dir, 'reports.jsonl'), 'utf8')).trim())
  assert.equal(record.inputs[0].value, 'Test?'); assert.equal(record.output.content, 'Answer'); assert.equal(record.reason, 'Wrong rule'); assert.equal(record.output.files[0].text, 'details')
  const review = { isChatInputCommand: () => true, commandName: 'bot-reports', guildId: 'guild', memberPermissions: { has: permission => permission === PermissionFlagsBits.ManageGuild }, deferReply: async () => {}, editReply: async x => { answer = x } }
  await handle(review); assert.equal(JSON.parse(answer.files[0].attachment)[0].reason, 'Wrong rule')
  await handle({ ...review, guildId: 'other' }); assert.equal(answer.files.length, 0)
  let denied; await handle({ ...review, memberPermissions: { has: () => false }, reply: async x => { denied = x } }); assert.equal(denied.flags, 64)
  process.env.BOT_FEEDBACK_PATH = dir
  let sent; const input = { isChatInputCommand: () => true, commandName: 'matchup', guildId: 'guild', options: { data: [{ name:'model-one', value:'Test' }] }, user:{id:'user'}, editReply: async x => {sent=x}, followUp: async x => {sent=x} }
  installFeedbackCapture(input); await input.editReply({content:'first'}); const first=sent.components[0].components[0].custom_id; await input.followUp({content:'second'}); assert.notEqual(sent.components[0].components[0].custom_id,first)
  delete process.env.BOT_FEEDBACK_PATH
} finally { await rm(dir, { recursive:true, force:true }) }
const explanations = ratingExplanations({ categories: { gunfighters:[{unitName:'Test',profileName:'Rifle',bs:12,skills:['Mimetism (-3)'],weapons:[{name:'Rifle',mode:''}], nonLinked:{grade:'A',rating:45,percentile:85,weaponsUsed:[{weapon:'Rifle',scoreContribution:45}]},fireteamLinked:{grade:'S',rating:60,percentile:97,weaponsUsed:[]}}]} }, {weapons:[{id:1,name:'Rifle',distance:{a:{max:20,mod:0},b:{max:40,mod:3}},burst:3}]})
assert.match(explanations,/Gunfighter: A alone/); assert.match(explanations,/S with Fireteam \+1 SD/); assert.match(explanations,/8–16 inches \(\+3\)/); assert.match(explanations,/not win probabilities/)
const shortfall = unmetTargetExplanation({quality:{sGunfighters:2,sAro:1,sCc:0,specialists:2,specialistTarget:4},points:299,swc:6}, {points:300,mustInclude:['Test']})
assert.match(shortfall,/S ARO models: 1\/3 \(2 short\)/); assert.match(shortfall,/Required models: Test/); assert.match(shortfall,/not proof/)
const obj = {GUID:'aaaaaa',Name:'Custom_Token',CustomImage:{ImageURL:'https://example.com/model.png'},Nickname:'Test · Group 1',ColorDiffuse:{r:1,g:0,b:0},GMNotes:JSON.stringify({armyProfile:'1/1/1',combatGroup:1}),States:{2:{GUID:'bbbbbb',Nickname:'Camouflage',ColorDiffuse:{r:1,g:0,b:0}}}}
const saved={ObjectStates:[{GUID:'cccccc',ContainedObjects:[obj]}]}
const opts={expectedCount:1,groupColors:[{combatGroup:1,color:{r:1,g:0,b:0}}],manifest:[{profile:'1/1/1',combatGroup:1,camo:true}]}
assert.match(validateTtsExport(saved,opts),/Validated 1 objects/)
for (const mutate of [s=>s.ObjectStates[0].ContainedObjects.pop(),s=>s.ObjectStates[0].ContainedObjects[0].States={},s=>s.ObjectStates[0].ContainedObjects[0].CustomImage.ImageURL='bad',s=>s.ObjectStates[0].ContainedObjects[0].GUID='cccccc',s=>s.ObjectStates[0].ContainedObjects[0].Nickname='Group 2']) {const broken=structuredClone(saved);mutate(broken);assert.throws(()=>validateTtsExport(broken,opts),/validation failed/)}
console.log('Bot explanations, target shortfalls, export rejection and feedback workflow checks passed.')

// Regression: the real classifier nests rated entries under categories. Verify
// the command attaches explanations alongside the readable/tactical PNGs.
const actualAnalysis = classifyTacticalBrief([], {}, [{status:'matched',key:'301:1:1:1:1',unitName:'TEST RATED MODEL',normal:45,nonLinked:{rating:45,grade:'A',percentile:85,weaponsUsed:[]}}])
const commandResponse = await createInfListResponse({armyCode:'QUJDRA==', withRenderSlot:fn=>fn(), render:async()=>({tacticalAnalysis:actualAnalysis,readableImageBuffer:Buffer.from('png'),tacticalPages:[{imageBuffer:Buffer.from('tactical')}],officialArmyUrl:'https://example.test/army'})})
const explanationFile = commandResponse.files.find(file=>file.name==='rating-explanations.txt')
assert.ok(explanationFile, 'actual classifier response must attach explanations')
assert.match(explanationFile.attachment.toString(), /TEST RATED MODEL/)
assert.match(explanationFile.attachment.toString(), /Gunfighter: A alone/)
assert.match(ratingExplanations({categories:{}}), /No matched combat rating entries/)
console.log('PASS - real tactical classifier output includes rating-explanations.txt in the Discord response.')

// Concise, actionable explanations preserve scores without raw engine fields.
const readable = ratingExplanations({categories:{
  valuableAro:[{unitName:'Tankhunter',skills:['Mimetism (-3)','Mimetism [-3]'],nonLinked:{grade:'S',rating:12.72,percentile:99.08,weaponsUsed:[{weapon:'Portable Autocannon',scoreContribution:2226.69}]}}],
  closeCombat:[{unitName:'Voronin',grade:'A',rating:28.86,percentile:81.26,states:[
    {id:'normal',label:'Normal active-turn CC',grade:'B',rating:28.86,percentile:76.06,weaponsUsed:[{weapon:'AP CC Weapon',scoreContribution:230.87}]},
    {id:'ally-1',label:'One allied Trooper engaged',grade:'A',rating:48.24,percentile:86.83,weaponsUsed:[]}
  ]}]
}})
assert.match(readable,/CC: A/)
assert.match(readable,/normal CC profiles/)
assert.match(readable,/One allied Trooper engaged raises the score to 48.24/)
assert.match(readable,/Faction-specific grades are not available/)
assert.match(readable,/Tankhunter · Portable Autocannon/)
assert.doesNotMatch(readable,/Recorded skills|Profile stats|2226\.69|scoreContribution|weaponsUsed|States:|undefined|NaN|CC: B/)
for (const label of ['Best use:', 'What earns the rating:', 'What limits it:']) assert.equal(readable.split(label).length-1,2)
const kazak = {unitName:'Veteran Kazak',profileName:'VETERAN KAZAK',combinedId:'test',weapons:[{name:'AP Heavy Machine Gun',mode:''}],nonLinked:{grade:'A',rating:33.89,percentile:91.17,weaponsUsed:[{weapon:'AP Heavy Machine Gun (AP)',scoreContribution:33.89}]},fireteamLinked:{grade:'S',rating:39.11,percentile:97,weaponsUsed:[]}}
const approvedSample = ratingExplanations({categories:{gunfighters:[kazak],valuableAro:[{...kazak,nonLinked:{grade:'B',rating:4.25,percentile:67.06},fireteamLinked:{grade:'A',rating:7.37,percentile:91.36}}]}},{weapons:[{id:1,name:'AP Heavy Machine Gun',distance:{a:{max:40,mod:0},b:{max:80,mod:3}},burst:4}]})
assert.match(approvedSample,/Gunfighter: A alone → S with Fireteam \+1 SD/)
assert.match(approvedSample,/16–32 inches \(\+3\)/)
assert.match(approvedSample,/top 9%/)
assert.match(approvedSample,/33.89 to 39.11 \(about 15% higher\), around the top 3%/)
assert.match(approvedSample,/ARO grade is B alone or A linked/)
assert.doesNotMatch(ratingExplanations({categories:{gunfighters:[{unitName:'Unknown',nonLinked:{grade:'B',rating:0,percentile:null},fireteamLinked:{grade:'A',rating:2,percentile:null}}]}}),/NaN|Infinity|top 100%/)
console.log('PASS - approved sample structure, range, score improvement, cross-role limits and conditional CC results.')
