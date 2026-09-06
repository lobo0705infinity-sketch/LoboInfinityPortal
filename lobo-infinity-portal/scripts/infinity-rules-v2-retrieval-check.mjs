#!/usr/bin/env node
import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {buildRulesReference,loadProductionRulesCorpus} from '../bot/infinity-rules-service.mjs'
import {formatRulesDiscordResponse} from '../bot/rules-command.mjs'

const root=resolve(import.meta.dirname,'..')
const suite=JSON.parse(await readFile(resolve(root,'data/infinity-rules/rules-v2-retrieval-test-cases.json'),'utf8'))
const corpus=await loadProductionRulesCorpus({force:true})
const records=suite.cases.map((test)=>{
  const result=buildRulesReference(corpus,test.query)
  const names=result.rules.map((rule)=>rule.ruleName)
  const missing=test.expected.filter((expected)=>!names.some((name)=>name.includes(expected)))
  const pass=result.status===test.status&&result.resolution.intent===test.intent&&!missing.length
  return{id:test.id,category:test.category,query:test.query,detectedIntent:result.resolution.intent,extractedRuleTerms:result.resolution.extractedRuleTerm,aliasFamilyResolution:{aliases:result.resolution.aliases,fuzzyMatch:result.resolution.fuzzyMatch,candidates:result.resolution.candidates},primaryRuleCandidates:result.resolution.candidates,finalRetrievedSections:result.rules.map((rule)=>({ruleName:rule.ruleName,sourceId:rule.sourceId,page:rule.pageLabel})),status:result.status,pass,failures:[result.status!==test.status&&`Expected status ${test.status}`,result.resolution.intent!==test.intent&&`Expected intent ${test.intent}`,missing.length&&`Missing ${missing.join(', ')}`].filter(Boolean)}
})
const passed=records.filter((record)=>record.pass).length
const audit={generatedAt:new Date().toISOString(),suite:suite.suite,summary:{passed,total:records.length,failed:records.length-passed,categories:Object.fromEntries([...new Set(records.map((record)=>record.category))].map((category)=>{const selected=records.filter((record)=>record.category===category);return[category,{passed:selected.filter((record)=>record.pass).length,total:selected.length}]}))},records}
await mkdir(resolve(root,'tmp'),{recursive:true});await writeFile(resolve(root,'tmp/infinity-rules-v2-retrieval-audit.json'),`${JSON.stringify(audit,null,2)}\n`)
assert.equal(passed,records.length,records.filter((record)=>!record.pass).map((record)=>`${record.id}: ${record.failures.join('; ')}`).join('\n'))
console.log(`PASS - Infinity rules V2 retrieval audit ${passed}/${records.length}.`)

const review=['how does Multispectral Visor work','what does MSV2 do','how does Multispectral Visor work against Mimetism','Can MSV see through Smoke?','how does mimetism work','how does camouflage work','Does Zero Pain suffer the -3 MOD when used through an enemy Repeater?','how does multispectal visor work','purple bananas quantum teapot']
for(const query of review)console.log(`\n===== ${query} =====\n${renderText(formatRulesDiscordResponse(buildRulesReference(corpus,query)))}`)

function renderText(payload){const embed=payload.embeds[0];return[embed.title,embed.description,...embed.fields.map((field)=>`\n${field.name}\n${field.value}`),`\n${embed.footer.text}`].join('\n')}
