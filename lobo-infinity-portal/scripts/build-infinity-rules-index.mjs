#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadCorpus } from './infinity-rules-search-poc.mjs'
import { normalizeRuleText } from '../bot/infinity-rules-service.mjs'

const root=resolve(import.meta.dirname,'..')
const cases=JSON.parse(await readFile(resolve(root,'data/infinity-rules/rules-retrieval-test-cases.json'),'utf8'))
const corpus=await loadCorpus()
const seedTerms=[...new Set(cases.cases.flatMap((test)=>[...test.expected.flatMap((item)=>item.terms),...(test.aliases??[])]).map(normalizeRuleText))]
const canonicalPageOverrides=new Map([
  ['infinity-rules-n5.3:mimetism',102],['infinity-rules-n5.3:zero pain',61],['infinity-rules-n5.3:firewall',55],
  ['infinity-rules-n5.3:repeater',56],['infinity-rules-n5.3:discover',77],['infinity-rules-n5.3:camouflaged',157],
  ['infinity-rules-n5.3:camouflaged state',157],['infinity-rules-n5.3:order expenditure sequence',21],
  ['infinity-rules-n5.3:automatic reaction order',13],
  ['infinity-rules-n5.3:smoke ammunition',66],
  ['its-season-18:specialist troops',17],
])

const genericHeadings=new Set(['activation','automatic equipment','automatic skill','body','cancellation','effects','equipment','example','important','infinity','long skill','optional','requirements','remember','short skill','skills and equipment','special skill'])
function catalogHeadings(chunk){
  const candidates=[...chunk.headings]
  for(const line of chunk.rawText.replace(/\r/g,'').split('\n'))for(const part of [line.slice(0,82),line.slice(82)]){
    const value=part.trim().replace(/\s{2,}.*$/,'').trim()
    const letters=value.replace(/[^A-Za-z]/g,'')
    if(value.length>=3&&value.length<=70&&letters.length>=3&&letters===letters.toUpperCase())candidates.push(value)
  }
  return [...new Set(candidates.map((value)=>value.replace(/\.{3,}.*$/,'').trim()).filter((value)=>{
    const normalized=normalizeRuleText(value)
    return normalized&&!genericHeadings.has(normalized)&&!/^v\d|^version |^corvus |^page text$/.test(normalized)&&!/[|]/.test(value)&&!/^\d/.test(value)
  }))]
}
function familyFor(name){return name.replace(/\s+(?:level|l)\s*[123]$/i,'').trim()}

function windows(text,terms){
  const lowered=text.toLowerCase();const spans=[]
  for(const term of terms){const at=findTerm(lowered,term);if(at<0)continue;const start=Math.max(0,at-220),end=Math.min(text.length,at+820);spans.push([start,end])}
  spans.sort((a,b)=>a[0]-b[0]);const merged=[]
  for(const span of spans){const last=merged.at(-1);if(last&&span[0]<=last[1]+150)last[1]=Math.max(last[1],span[1]);else merged.push([...span])}
  return merged.slice(0,1).map(([start,end])=>text.slice(start,end).trim()).join('').slice(0,1400)
}
function findTerm(lowered,term){const pattern=term.split(/\s+/).map((part)=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');return lowered.search(new RegExp(pattern,'i'))}
function columnExcerpt(rawText,term,sourceId,max=1400){const raw=rawText.replace(/\r/g,''),at=findTerm(raw.toLowerCase(),term);if(at<0)return'';const lines=raw.split('\n'),lineIndex=raw.slice(0,at).split('\n').length-1,column=at-(raw.lastIndexOf('\n',at)+1);const split=sourceId.includes('faq')?54:sourceId==='its-season-18'?110:82;const right=column>=split;const selected=[];for(let index=Math.max(0,lineIndex-1);index<Math.min(lines.length,lineIndex+34);index++){const line=right?lines[index].slice(split):lines[index].slice(0,split);const clean=line.trimEnd();if(clean.trim())selected.push(clean.trimStart())}return selected.join('\n').slice(0,max).trim()}

const chunks=[]
for(const chunk of corpus.chunks){const matched=seedTerms.filter((term)=>chunk.normalized.includes(term));if(!matched.length)continue;const text=windows(chunk.text,matched);if(!text)continue;chunks.push({sourceId:chunk.sourceId,title:chunk.title,version:chunk.version,authority:chunk.authority,scope:chunk.scope,pdfPage:chunk.pdfPage,printedPage:chunk.printedPage,section:chunk.section,headings:chunk.headings,structuredBlockTypes:chunk.blocks.filter((block)=>matched.some((term)=>normalizeRuleText(block.text).includes(term))).map((block)=>block.label).slice(0,6),text,sourceUrl:chunk.sourceUrl})}
const curatedPairs=[['infinity-faq-n5-v0.1','total cover'],['infinity-faq-n5-v0.1','direct template weapon'],['infinity-faq-n5-v0.1','place deployable'],['infinity-faq-n5-v0.1','stealth'],['infinity-faq-n5-v0.1','coordinated orders'],['infinity-rules-n5.3','smoke ammunition']].map(([sourceId,term])=>({sourceId,term}))
const ruleCatalog=[]
for(const chunk of corpus.chunks.filter((item)=>item.sourceId==='infinity-rules-n5.3'&&item.pdfPage>=77&&item.pdfPage<=126))for(const heading of catalogHeadings(chunk)){
  const normalizedName=normalizeRuleText(heading),family=normalizeRuleText(familyFor(heading))
  if(normalizedName.split(' ').length>6||/[.:]$/.test(heading)||/chart|example|module|contents|quick reference|trooper activation|troop types/i.test(heading))continue
  ruleCatalog.push({canonicalName:heading,normalizedName,family,pdfPage:chunk.pdfPage,printedPage:chunk.printedPage,sourceId:chunk.sourceId})
}
const dedupedCatalog=[...new Map(ruleCatalog.map((item)=>[`${item.normalizedName}:${item.pdfPage}`,item])).values()]
const uniqueCatalog=dedupedCatalog.filter((item)=>item.normalizedName.includes('-')||item.normalizedName.split(' ').length>1||!dedupedCatalog.some((other)=>other.normalizedName.startsWith(`${item.normalizedName} `)))
const catalogPairs=uniqueCatalog.map((item)=>({sourceId:item.sourceId,term:item.normalizedName}))
const requiredPairs=[...new Map([...cases.cases.flatMap((test)=>test.expected.flatMap((need)=>need.terms.map((term)=>({sourceId:need.source,term:normalizeRuleText(term)})))),...curatedPairs,...catalogPairs].map((item)=>[`${item.sourceId}:${item.term}`,item])).values()]
for(const {sourceId,term} of requiredPairs){const candidates=corpus.chunks.filter((chunk)=>chunk.sourceId===sourceId&&chunk.normalized.includes(term));const override=canonicalPageOverrides.get(`${sourceId}:${term}`);const scored=candidates.map((chunk)=>{const at=findTerm(chunk.text.toLowerCase(),term),near=chunk.text.slice(Math.max(0,at-200),at+1100).toLowerCase();let score=0;if(chunk.pdfPage===override)score+=1000;if(/requirements|effects|important|remember/.test(near))score+=40;if(normalizeRuleText(chunk.headings.join(' ')).includes(term))score+=20;if(/quick reference|glossary|contents/.test(normalizeRuleText(chunk.section)))score-=50;if(chunk.pdfPage>180)score-=40;return{chunk,score,at}}).sort((a,b)=>b.score-a.score||a.chunk.pdfPage-b.chunk.pdfPage);const best=scored[0];if(!best)continue;const text=columnExcerpt(best.chunk.rawText,term,best.chunk.sourceId)||best.chunk.text.slice(Math.max(0,best.at-100),Math.max(0,best.at-100)+1400).trim();chunks.push({sourceId:best.chunk.sourceId,title:best.chunk.title,version:best.chunk.version,authority:best.chunk.authority,scope:best.chunk.scope,pdfPage:best.chunk.pdfPage,printedPage:best.chunk.printedPage,section:best.chunk.section,headings:best.chunk.headings,structuredBlockTypes:best.chunk.blocks.map((block)=>block.label).slice(0,8),canonicalTerm:term,text,sourceUrl:best.chunk.sourceUrl})}
const index={indexVersion:2,generatedAt:corpus.manifest.retrievedAt,description:'Bounded derived search excerpts and corpus-derived rule-name catalog; not complete PDFs or complete page transcriptions.',sources:corpus.manifest.sources.map((source)=>({id:source.id,version:source.version,sourceSha256:source.sha256})),seedTerms,ruleCatalog:uniqueCatalog,chunks}
const output=resolve(root,'data/infinity-rules/rules-search-index.json')
await writeFile(output,`${JSON.stringify(index,null,2)}\n`)
console.log(`Wrote ${chunks.length} bounded rule-page excerpts to ${output}`)
