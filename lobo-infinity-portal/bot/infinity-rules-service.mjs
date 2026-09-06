import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
export const RULES_MANIFEST_PATH = resolve(root, 'data/infinity-rules/sources.json')
export const RULES_INDEX_PATH = resolve(root, 'data/infinity-rules/rules-search-index.json')

const aliases = new Map([
  ['aro', ['automatic reaction order']], ['camo', ['camouflaged state', 'camouflage']],
  ['link team', ['fireteam', 'fireteam integrity']], ['shoot back', ['automatic reaction order', 'bs attack']],
  ['repeater penalty', ['repeater', 'firewall', 'hacking area']], ['zoc', ['zone of control']], ['lof', ['line of fire']],
  ['msv', ['multispectral visor']], ['msv1', ['multispectral visor level 1']], ['msv2', ['multispectral visor level 2']], ['msv3', ['multispectral visor level 3']],
  ['khd', ['killer hacking device']], ['smoke', ['smoke ammunition','visibility zones']],
])
const stopWords = new Set('a an and are as at be before by can do does for from how i if in into is it my of on or same say since that the this through to what when which with'.split(' '))
const officialTerms = ['zero pain','discover','camouflaged state','camouflaged marker','order expenditure sequence','stealth','repeater','hacking area','firewall','dodge','impersonation','coordinated order','place deployable','deployable weapon','line of fire','zone of control','fireteam','fireteam integrity','mimetism','guts roll','suppressive fire','specialist troops','classified objective','secure hvt','bs attack','automatic reaction order','lieutenant','direct template weapon']

export function normalizeRuleText(value) { return String(value ?? '').normalize('NFKD').replace(/[^a-zA-Z0-9+.-]+/g, ' ').trim().toLowerCase() }
function terms(value) { return normalizeRuleText(value).split(/\s+/).filter((term) => term.length > 1 && !stopWords.has(term)) }
const wrapperPatterns=[/^how does (.+?) work$/,/^what does (.+?) do$/,/^what is (.+?)$/,/^explain (.+?)$/,/^how do i use (.+?)$/,/^tell me about (.+?)$/,/^what are the rules for (.+?)$/]
function stripLookupWrapper(value){for(const pattern of wrapperPatterns){const match=value.match(pattern);if(match)return match[1].replace(/\s+(?:skill|equipment)\s*$/,'').trim()}return value}
function editDistance(a,b){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const saved=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=saved}}return row[b.length]}
export function printedPageForSource(source, pdfPage) {
  if (source.pageMapping.unnumberedPdfPages?.includes(pdfPage)) return null
  return String(pdfPage + source.pageMapping.pdfOffset)
}
export function headingLines(pageText) {
  return pageText.split(/\r?\n/).map((line) => line.trim()).filter((line) => {
    if (line.length < 3 || line.length > 90) return false
    const letters = line.replace(/[^A-Za-z]/g, '')
    return letters.length >= 3 && letters === letters.toUpperCase()
  })
}
export function sectionForPage(pageText) { return headingLines(pageText).find((heading) => !/^(V\d|FAQS|VERSION|CORVUS|INFINITY$)/.test(heading)) ?? 'Page text' }
export function structuredBlocksForPage(pageText) {
  const labels = /^(REQUIREMENTS|EFFECTS|IMPORTANT|REMEMBER|EXAMPLE(?:\s+\d+)?|CANCELLATION|ACTIVATION)$/
  const blocks=[]; let current={label:'BODY',lines:[]}
  for(const raw of pageText.split(/\r?\n/)){const line=raw.trim();if(!line)continue;if(labels.test(line)){if(current.lines.length)blocks.push({label:current.label,text:current.lines.join(' ')});current={label:line,lines:[]}}else current.lines.push(line)}
  if(current.lines.length)blocks.push({label:current.label,text:current.lines.join(' ')})
  return blocks
}
function expandQuestion(question, extraAliases=[]) { const normalized=normalizeRuleText(question); const expansions=[...extraAliases]; for(const [phrase,values] of aliases)if(normalized.includes(phrase))expansions.push(...values);if(normalized.includes('discover')&&/(camo|camouflaged)/.test(normalized))expansions.push('camouflaged state','order expenditure sequence');if(normalized.includes('zero pain')&&normalized.includes('repeater'))expansions.push('firewall','hacking programs');if(normalized.includes('stealth')&&normalized.includes('aro'))expansions.push('automatic reaction order','zone of control'); return {normalized,expansions:[...new Set(expansions.map(normalizeRuleText))]} }

export function searchRules(chunks, question, {extraAliases=[],limit=12}={}) {
  const expanded=expandQuestion(question,extraAliases); const queryTerms=[...new Set(terms(`${question} ${expanded.expansions.join(' ')}`))]
  const exactPhrases=[...new Set([...expanded.expansions,...question.match(/[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+/g)??[]].map(normalizeRuleText))]
  for(const phrase of officialTerms)if(expanded.normalized.includes(phrase))exactPhrases.push(phrase)
  const asksIts=/\bits\b|classified|mission|scenario|scoring|specialist troop|objective point/i.test(question)
  const scored=chunks.map((chunk)=>{let score=0;const matched=[];for(const term of queryTerms){const count=chunk.normalized.split(term).length-1;if(count>0){score+=Math.min(count,5)*(term.length>=8?2.2:1);matched.push(term)}}for(const phrase of exactPhrases)if(phrase.length>2&&chunk.normalized.includes(phrase))score+=officialTerms.includes(phrase)?80:18;if(chunk.sourceId.includes('faq')&&matched.length>=2)score+=5;if(chunk.scope==='ITS')score+=asksIts?8:-12;const heading=normalizeRuleText(chunk.section);for(const term of queryTerms)if(heading.includes(term))score+=6;const allHeadings=normalizeRuleText(chunk.headings.join(' | '));for(const phrase of exactPhrases)if(allHeadings.includes(phrase))score+=100;return{...chunk,score:Number(score.toFixed(2)),method:exactPhrases.some((phrase)=>chunk.normalized.includes(phrase))?'exact-term+lexical':'lexical',matched}}).filter((chunk)=>chunk.score>0).sort((a,b)=>b.score-a.score||a.authority-b.authority||a.pdfPage-b.pdfPage)
  const result=[];const pageKeys=new Set();for(const phrase of exactPhrases){const candidate=scored.find((chunk)=>chunk.normalized.includes(phrase));if(!candidate)continue;const key=`${candidate.sourceId}:${candidate.pdfPage}`;if(!pageKeys.has(key)){pageKeys.add(key);result.push(candidate)}}
  for(const chunk of scored){const key=`${chunk.sourceId}:${chunk.pdfPage}`;if(pageKeys.has(key))continue;pageKeys.add(key);result.push(chunk);if(result.length>=limit)break}
  for(const item of [...result]){if(!item.sourceId.includes('faq'))continue;const neighbor=chunks.find((chunk)=>chunk.sourceId===item.sourceId&&chunk.pdfPage===item.pdfPage+1);if(neighbor&&!result.some((chunk)=>chunk.sourceId===neighbor.sourceId&&chunk.pdfPage===neighbor.pdfPage))result.push({...neighbor,score:Number((item.score-.01).toFixed(2)),method:'adjacent-page-continuation',matched:[]})}
  result.sort((a,b)=>b.score-a.score||a.authority-b.authority||a.pdfPage-b.pdfPage);result.length=Math.min(result.length,limit);return result
}

export function relevantExcerpt(text, query, max=420) { const queryTerms=terms(query);const lower=normalizeRuleText(text);let at=0;for(const term of queryTerms.sort((a,b)=>b.length-a.length)){const found=lower.indexOf(term);if(found>=0){at=found;break}}const start=Math.max(0,at-100);return text.slice(start,start+max).replace(/\n+/g,' ').trim() }
export function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex').toUpperCase() }

let cachedCorpus
export async function loadProductionRulesCorpus({manifestPath=RULES_MANIFEST_PATH,indexPath=RULES_INDEX_PATH,force=false}={}) {
  if(cachedCorpus&&!force&&manifestPath===RULES_MANIFEST_PATH&&indexPath===RULES_INDEX_PATH)return cachedCorpus
  const [manifestRaw,indexRaw]=await Promise.all([readFile(manifestPath),readFile(indexPath)])
  const manifest=JSON.parse(manifestRaw);const index=JSON.parse(indexRaw)
  if(!manifest.derivedIndex?.sha256||sha256(indexRaw)!==manifest.derivedIndex.sha256)throw new Error('Infinity rules search index checksum mismatch')
  for(const source of manifest.sources){const indexed=index.sources.find((item)=>item.id===source.id);if(!indexed||indexed.version!==source.version||indexed.sourceSha256!==source.sha256)throw new Error(`Infinity rules index source mismatch: ${source.id}`)}
  const trustedUrls=new Map(manifest.sources.map((source)=>[source.id,source.officialUrl]))
  const chunks=index.chunks.map((chunk)=>{const source=manifest.sources.find((item)=>item.id===chunk.sourceId);if(!source)throw new Error(`Unknown indexed source: ${chunk.sourceId}`);if(chunk.sourceUrl!==trustedUrls.get(chunk.sourceId))throw new Error(`Untrusted indexed URL: ${chunk.sourceId}`);if(!Number.isInteger(chunk.pdfPage)||chunk.pdfPage<1||chunk.pdfPage>source.pageCount)throw new Error(`Invalid indexed page: ${chunk.sourceId}`);if(chunk.printedPage!==printedPageForSource(source,chunk.pdfPage))throw new Error(`Invalid printed page mapping: ${chunk.sourceId}:${chunk.pdfPage}`);return{...chunk,normalized:normalizeRuleText(`${chunk.section} ${chunk.headings.join(' ')} ${chunk.text}`)}})
  const ruleCatalog=(index.ruleCatalog??[]).map((item)=>({...item,normalizedName:normalizeRuleText(item.normalizedName??item.canonicalName),family:normalizeRuleText(item.family??item.canonicalName)}))
  const corpus={manifest,chunks,ruleCatalog,indexMetadata:{generatedAt:index.generatedAt,sourceCount:index.sources.length,chunkCount:chunks.length,catalogCount:ruleCatalog.length}}
  if(manifestPath===RULES_MANIFEST_PATH&&indexPath===RULES_INDEX_PATH)cachedCorpus=corpus
  return corpus
}
export function clearRulesCorpusCacheForTests(){cachedCorpus=undefined}

export const RULES_STATUS=Object.freeze({DIRECT:'DIRECT RULE REFERENCE',MULTI:'MULTIPLE RULES APPLY — INTERPRETATION MAY BE REQUIRED',NONE:'NO DEFINITIVE RULE SECTION FOUND'})
function trustedSourceLabel(source){if(source.id==='infinity-rules-n5.3')return `Infinity Rules N${source.version}`;if(source.id==='infinity-faq-n5-v0.1')return `Infinity FAQ v${source.version}`;if(source.id==='its-season-18')return 'ITS Season 18';return `${source.title} ${source.version}`}
function resultFamily(result){const heading=normalizeRuleText(result.section);return officialTerms.find((term)=>heading.includes(term))??heading}
export function resolveRuleQuery(corpus,question){
  const normalized=normalizeRuleText(question),stripped=stripLookupWrapper(normalized)
  const interaction=/\b(against|interact(?:s|ing)? with|through|see through|versus|vs|and|while|when|with)\b/.test(stripped)
  const aliasHits=[]
  for(const [alias,values] of aliases)if(new RegExp(`(?:^| )${alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:$| )`).test(normalized))aliasHits.push(...values)
  const exactNames=(corpus.ruleCatalog??[]).filter((entry)=>entry.normalizedName===stripped||entry.family===stripped)
  const rawMentioned=(corpus.ruleCatalog??[]).filter((entry)=>entry.normalizedName.length>=4&&new RegExp(`(?:^| )${entry.normalizedName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:$| )`).test(normalized))
  const mentioned=rawMentioned.filter((entry)=>!rawMentioned.some((other)=>other.normalizedName!==entry.normalizedName&&other.normalizedName.startsWith(`${entry.normalizedName} `)))
  const requested=[...new Set([...aliasHits,...exactNames.map((entry)=>entry.normalizedName),...mentioned.map((entry)=>entry.normalizedName)])]
  let fuzzy
  if(!requested.length&&!interaction&&stripped.length>=6){const ranked=[...new Map((corpus.ruleCatalog??[]).map((entry)=>[entry.normalizedName,entry])).values()].map((entry)=>({entry,distance:editDistance(stripped,entry.normalizedName)})).sort((a,b)=>a.distance-b.distance||a.entry.normalizedName.length-b.entry.normalizedName.length);if(ranked[0]?.distance<=2&&(!ranked[1]||ranked[1].distance>ranked[0].distance)){fuzzy=ranked[0].entry;requested.push(fuzzy.normalizedName)}}
  const resolved=[]
  for(const name of requested){const matches=(corpus.ruleCatalog??[]).filter((entry)=>entry.normalizedName===name||entry.family===name);const variants=matches.filter((entry)=>entry.normalizedName!==entry.family);resolved.push(...(variants.length?variants:matches))}
  const unique=[...new Map(resolved.map((entry)=>[entry.normalizedName,entry])).values()].sort((a,b)=>a.family.localeCompare(b.family)||a.normalizedName.localeCompare(b.normalizedName,undefined,{numeric:true}))
  const knownLegacy=officialTerms.includes(stripped),families=new Set([...unique.map((entry)=>entry.family),...aliasHits])
  return{intent:interaction&&families.size>1?'INTERACTION':unique.length||aliasHits.length||knownLegacy?'DIRECT_LOOKUP':'BROAD_SEARCH',extractedRuleTerm:stripped,aliases:[...new Set(aliasHits)],fuzzyMatch:fuzzy?.canonicalName??null,resolved:unique}
}
function targetTermsForQuestion(question){const normalized=normalizeRuleText(question),targets=officialTerms.filter((term)=>normalized.includes(term));for(const[phrase,values]of aliases)if(normalized.includes(phrase))targets.push(...values);if(normalized.includes('discover')&&/(camo|camouflaged)/.test(normalized)){const markerAt=targets.indexOf('camouflaged marker');if(markerAt>=0)targets.splice(markerAt,1);targets.push('discover','camouflaged state','order expenditure sequence')}if(normalized.includes('zero pain')&&normalized.includes('repeater'))targets.push('zero pain','repeater','firewall');if(normalized.includes('stealth')&&normalized.includes('aro'))targets.push('stealth','automatic reaction order','zone of control');return[...new Set(targets.map(normalizeRuleText))]}
function displayHeading(item,target){return item.headings.find((heading)=>normalizeRuleText(heading).includes(target))??item.section}
function cropusCandidates(chunks,target,asksIts){return chunks.filter((item)=>(asksIts||item.scope!=='ITS')&&item.normalized.includes(target))}
function compactExcerpt(result,question,max=650){
  const preferred=result.sourceId==='infinity-faq-n5-v0.1'&&/total cover/i.test(question)?'total cover':result.canonicalTerm
  let value=preferred?sliceAtPhrase(result.text,preferred,max+80):relevantExcerpt(result.text,question,max+80)
  if(/^multispectral visor level [123]$/.test(result.canonicalTerm??'')){const next=value.slice(result.canonicalTerm.length).search(/\nMULTISPECTRAL VISOR LEVEL [123]\b/);if(next>=0)value=value.slice(0,result.canonicalTerm.length+next)}
  value=value.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim()
  if(value.length>max)value=`${value.slice(0,max-1).replace(/\s+\S*$/,'').trim()}…`
  return value
}
function sliceAtPhrase(text,phrase,max){const pattern=phrase.split(/\s+/).map((part)=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');const at=text.search(new RegExp(pattern,'i'));return text.slice(Math.max(0,at),Math.max(0,at)+max)}
export function buildRulesReference(corpus,question,{maxResults=4}={}){
  const clean=String(question??'').trim();if(!clean)throw new Error('A rules question is required.');if(clean.length>1000)throw new Error('Rules question exceeds 1000 characters.')
  const resolution=resolveRuleQuery(corpus,clean);const searched=searchRules(corpus.chunks,clean,{extraAliases:[...resolution.aliases,...resolution.resolved.map((item)=>item.normalizedName)],limit:24});const meaningful=searched.filter((item)=>item.score>=10);const legacyTargets=targetTermsForQuestion(clean).filter((legacy)=>!resolution.resolved.some((item)=>item.family===legacy));const resolvedTargets=resolution.resolved.map((item)=>item.normalizedName).filter((name)=>!legacyTargets.some((legacy)=>legacy.includes(name)||name.includes(legacy)));const unresolvedAliases=resolution.aliases.filter((alias)=>!resolution.resolved.some((item)=>item.normalizedName===alias||item.family===alias)&&!legacyTargets.some((legacy)=>legacy.includes(alias)||alias.includes(legacy)));const targets=[...new Set([...resolvedTargets,...unresolvedAliases,...legacyTargets])]
  const asksIts=/\bits\b|classified|mission|scenario|scoring|specialist troop|objective point/i.test(clean)
  const selected=[]
  for(const target of targets){const indexed=cropusCandidates(corpus.chunks,target,asksIts);const candidates=meaningful.filter((item)=>(asksIts||item.scope!=='ITS')&&item.normalized.includes(target));const item=indexed.find((candidate)=>candidate.canonicalTerm===target)??indexed.find((candidate)=>candidate.canonicalTerm&&(target.includes(candidate.canonicalTerm)||candidate.canonicalTerm.includes(target)))??candidates.find((candidate)=>normalizeRuleText(candidate.headings.join(' ')).includes(target))??candidates[0];const identity=item&&`${item.sourceId}:${item.pdfPage}:${item.canonicalTerm??target}`;if(item&&!selected.some((candidate)=>candidate._identity===identity||candidate.sourceId===item.sourceId&&candidate.pdfPage===item.pdfPage&&candidate.text===item.text))selected.push({...item,_identity:identity,displayRuleName:target.toUpperCase()});if(selected.length>=maxResults)break}
  const faqIntent=/(camouflaged|camo).+total cover|total cover.+(camouflaged|camo)|deployable.+(occupied|silhouette contact)|special die.+coordinated|stealth.+several troopers|several troopers.+stealth/i.test(clean)
  const faqTerm=/total cover/i.test(clean)?'total cover':/direct template/i.test(clean)?'direct template weapon':/place deployable|deployable.+(occupied|silhouette)/i.test(clean)?'place deployable':/stealth/i.test(clean)?'stealth':/special die|coordinated/i.test(clean)?'coordinated orders':null
  const faq=faqIntent?(corpus.chunks.find((item)=>item.sourceId==='infinity-faq-n5-v0.1'&&item.canonicalTerm===faqTerm)??meaningful.find((item)=>item.sourceId==='infinity-faq-n5-v0.1'&&targets.some((target)=>item.normalized.includes(target)))):null
  if(faq&&!selected.some((item)=>item.sourceId===faq.sourceId&&item.pdfPage===faq.pdfPage))selected.unshift({...faq,displayRuleName:'FAQ CLARIFICATION'})
  if(!selected.length&&targets.length){const item=meaningful.find((candidate)=>asksIts||candidate.scope!=='ITS');if(item)selected.push(item)}
  selected.length=Math.min(selected.length,maxResults)
  const interactionConnector=/\b(and|through|while|when|with|against|same|see through)\b/i.test(clean),direct=(resolution.intent==='DIRECT_LOOKUP'&&!interactionConnector)||(selected.length===1&&targets.length===1&&!interactionConnector)
  const status=!selected.length?RULES_STATUS.NONE:direct?RULES_STATUS.DIRECT:selected.length>1?RULES_STATUS.MULTI:RULES_STATUS.DIRECT
  const noExplicitFaq=status===RULES_STATUS.MULTI&&!selected.some((item)=>item.sourceId==='infinity-faq-n5-v0.1')
  return {question:clean,status,noExplicitFaq,resolution:{intent:resolution.intent,extractedRuleTerm:resolution.extractedRuleTerm,aliases:resolution.aliases,fuzzyMatch:resolution.fuzzyMatch,candidates:resolution.resolved.map((item)=>item.canonicalName)},versions:corpus.manifest.sources.map((source)=>({id:source.id,label:trustedSourceLabel(source),version:source.version})),rules:selected.map((item)=>({ruleName:item.displayRuleName??item.section,sourceLabel:trustedSourceLabel(corpus.manifest.sources.find((source)=>source.id===item.sourceId)),sourceId:item.sourceId,scope:item.scope,pageLabel:item.printedPage?`p. ${item.printedPage}`:`PDF page ${item.pdfPage}`,pdfPage:item.pdfPage,printedPage:item.printedPage,excerpt:compactExcerpt(item,item.canonicalTerm??clean,item.sourceId.includes('faq')?360:item.scope==='ITS'?400:560),structuredBlockTypes:item.structuredBlockTypes??[],url:corpus.manifest.sources.find((source)=>source.id===item.sourceId).officialUrl}))}
}
