import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reportableResponse, createBotFeedbackHandler, installFeedbackCapture } from '../bot/bot-feedback.mjs'
import { PermissionFlagsBits } from 'discord.js'
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
const explanations = ratingExplanations({ gunfighters:[{unitName:'Test',profileName:'Rifle',bs:12,skills:['Mimetism (-3)'],weapons:[{name:'Rifle',mode:''}], nonLinked:{grade:'A',rating:45,percentile:85,weaponsUsed:[{weapon:'Rifle',scoreContribution:45}]},fireteamLinked:{grade:'S',rating:60,percentile:97,weaponsUsed:[]}}]}, {weapons:[{id:1,name:'Rifle',distance:{a:{max:20,mod:0},b:{max:40,mod:3}},burst:3}]})
assert.match(explanations,/Unlinked: A/); assert.match(explanations,/Linked: S/); assert.match(explanations,/8–16 inches \(\+3\)/); assert.match(explanations,/not win probabilities/)
const shortfall = unmetTargetExplanation({quality:{sGunfighters:2,sAro:1,sCc:0,specialists:2,specialistTarget:4},points:299,swc:6}, {points:300,mustInclude:['Test']})
assert.match(shortfall,/S ARO models: 1\/3 \(2 short\)/); assert.match(shortfall,/Required models: Test/); assert.match(shortfall,/not proof/)
const obj = {GUID:'aaaaaa',Name:'Custom_Token',CustomImage:{ImageURL:'https://example.com/model.png'},Nickname:'Test · Group 1',ColorDiffuse:{r:1,g:0,b:0},GMNotes:JSON.stringify({armyProfile:'1/1/1',combatGroup:1}),States:{2:{GUID:'bbbbbb',Nickname:'Camouflage',ColorDiffuse:{r:1,g:0,b:0}}}}
const saved={ObjectStates:[{GUID:'cccccc',ContainedObjects:[obj]}]}
const opts={expectedCount:1,groupColors:[{combatGroup:1,color:{r:1,g:0,b:0}}],manifest:[{profile:'1/1/1',combatGroup:1,camo:true}]}
assert.match(validateTtsExport(saved,opts),/Validated 1 objects/)
for (const mutate of [s=>s.ObjectStates[0].ContainedObjects.pop(),s=>s.ObjectStates[0].ContainedObjects[0].States={},s=>s.ObjectStates[0].ContainedObjects[0].CustomImage.ImageURL='bad',s=>s.ObjectStates[0].ContainedObjects[0].GUID='cccccc',s=>s.ObjectStates[0].ContainedObjects[0].Nickname='Group 2']) {const broken=structuredClone(saved);mutate(broken);assert.throws(()=>validateTtsExport(broken,opts),/validation failed/)}
console.log('Bot explanations, target shortfalls, export rejection and feedback workflow checks passed.')
