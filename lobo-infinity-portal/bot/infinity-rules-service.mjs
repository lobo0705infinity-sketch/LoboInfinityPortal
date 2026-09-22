import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
export const RULES_MANIFEST_PATH = resolve(root, 'data/infinity-rules/sources.json')
export const RULES_INDEX_PATH = resolve(root, 'data/infinity-rules/rules-search-index.json')

const aliases = new Map([
  ['dodging', ['dodge']], ['dodged', ['dodge']],
  ['aro', ['automatic reaction order']], ['camo', ['camouflaged state', 'camouflage']],
  ['link team', ['fireteam', 'fireteam integrity']], ['shoot back', ['automatic reaction order', 'bs attack']],
  ['repeater penalty', ['repeater', 'firewall', 'hacking area']], ['zoc', ['zone of control']], ['lof', ['line of fire']],
  ['msv', ['multispectral visor']], ['msv1', ['multispectral visor level 1']], ['msv2', ['multispectral visor level 2']], ['msv3', ['multispectral visor level 3']],
  ['khd', ['killer hacking device']], ['smoke', ['smoke ammunition','visibility zones']],
])
const stopWords = new Set('a an and are as at be before by can do does for from how i if in into is it my of on or same say since that the this through to what when which with'.split(' '))
const officialTerms = ['zero pain','discover','camouflaged state','camouflaged marker','order expenditure sequence','stealth','repeater','hacking area','firewall','mines','dodge','impetuous','impersonation','coordinated order','place deployable','deployable weapon','line of fire','zone of control','fireteam','fireteam integrity','mimetism','guts roll','suppressive fire','specialist troops','classified objective','secure hvt','bs attack','automatic reaction order','lieutenant','direct template weapon','panoply','peripheral']

// Restore bounded PDF excerpts whose two-column source layout does not survive
// plain-text extraction reliably. Each excerpt is checked against the matching
// official N5.3 wiki page as well as the activated PDF.
const rulesSupplements = Object.freeze([
{
  "sourceId": "infinity-rules-n5.3",
  "title": "Infinity Rules",
  "version": "5.3",
  "authority": 1,
  "scope": "core",
  "pdfPage": 74,
  "printedPage": "74",
  "section": "SYMBIOBOMB",
  "headings": [
    "SYMBIOBOMB",
    "EFFECTS"
  ],
  "structuredBlockTypes": [
    "LABELS",
    "EFFECTS",
    "EXAMPLE"
  ],
  "canonicalTerm": "symbiobomb",
  "controllingTerms": [
    "assignable (transmutation)"
  ],
  "text": "SYMBIOBOMB\nThe SymbioBomb is a single-use weapon that allows its owner, a Trooper whose Unit Profile must list the SymbioBomb, to assign it to another Trooper in the same army, who is known as the user, in order to grant the latter additional attack and support advantages.\nAssignable (Transmutation), Comms Attack, Optional.\nEFFECTS\nBy expending one Short Skill/ARO, the user can use one Pheroware Tactic: Endgame, Eraser, or Mirrorball (see Weapons Chart).\nWhen using the Endgame or Eraser Pheroware Tactics with a SymbioBomb, a -3 MOD is applied to the target of the Comms Attack in any Face to Face Roll.\nThe SymbioBomb is removed from the game table at the end of the Order in which it was used.\nEXAMPLE OF SYMBIOBOMB\nDuring the Deployment Phase, the Tohaa Player assigns its Kaeltar Specialist's SymbioBombs to a Sakiel and to a Gorgos, who already had a SymbioMate."
},
{
  "sourceId": "infinity-rules-n5.3",
  "title": "Infinity Rules",
  "version": "5.3",
  "authority": 1,
  "scope": "core",
  "pdfPage": 174,
  "printedPage": "174",
  "section": "ASSIGNABLE (TRANSMUTATION)",
  "headings": [
    "ASSIGNABLE (TRANSMUTATION)"
  ],
  "structuredBlockTypes": [
    "LABEL"
  ],
  "canonicalTerm": "assignable (transmutation)",
  "text": "ASSIGNABLE (TRANSMUTATION)\nWhen deploying its owner during the Deployment Phase, and only then, this weapon or piece of Equipment can be assigned to Troopers who possess the Transmutation (X) Special Skill, and are present on the game table as a Model (excluding Troopers using Airborne Deployment, Hidden Deployment, Impersonation State, etc.).\nA Trooper possessing the Transmutation (X) Special Skill cannot receive more than one weapon or piece of Equipment of the same type with the Assignable (Transmutation) Label.\nWeapons and pieces of Equipment with the Assignable Label must be placed and remain in base contact with their user, the assigned Trooper, moving along with them.\nThese weapons and pieces of Equipment are Game State Tokens rather than Models."
},
{
  "sourceId": "infinity-rules-n5.3",
  "title": "Infinity Rules",
  "version": "5.3",
  "authority": 1,
  "scope": "core",
  "pdfPage": 74,
  "printedPage": "74",
  "section": "WILDPARROT",
  "headings": [
    "WILDPARROT",
    "EFFECTS"
  ],
  "structuredBlockTypes": [
    "EFFECTS"
  ],
  "canonicalTerm": "wildparrot",
  "controllingTerms": [
    "mines"
  ],
  "text": "WILDPARROT\nThis mobile weapons platform has been designed to be deployed on the battlefield at a distance, acting as a Mine with E/M Special Ammunition.\nEFFECTS\nThese weapons are placed with the Place Deployable or Intuitive Attack Common Skills, always applying the Deployable and Perimeter rule.\nTherefore, when players deploy this weapon, they place the WildParrot totally inside the Zone of Control of the Trooper, instead of placing it in Silhouette contact.\nDeployed WildParrots work like E/M Mines, except that a WildParrot Token or Model is placed instead of a Camouflage Marker."
},
{
  "sourceId": "infinity-rules-n5.3",
  "title": "Infinity Rules",
  "version": "5.3",
  "authority": 1,
  "scope": "core",
  "pdfPage": 72,
  "printedPage": "72",
  "section": "MINES",
  "headings": [
    "MINES"
  ],
  "structuredBlockTypes": [
    "EFFECTS",
    "REMEMBER"
  ],
  "canonicalTerm": "mines",
  "text": "MINES\nEFFECTS\nThe Small Teardrop Template must be placed so that it affects the enemy Model or Marker that triggered the Mine.\nRestriction: A Mine never triggers if the Small Teardrop Template would affect an ally, even if that ally is Unconscious.\nOnce on the game table, Mines must trigger when an enemy Model or Marker declares or executes a Skill or ARO inside their Trigger Area, checking it at that moment by placing the Small Teardrop Template. If it is determined that the Model or Marker is not within the Trigger Area, the Mine will neither detonate nor be revealed.\nThe Trigger Area of a Mine is the area within the radius of the Small Teardrop Template, extended out from the edge of the base of the Mine. The Trigger Area excludes any areas in Total Cover from the Blast Focus of the Small Teardrop Template.\nREMEMBER\nDodge movement and movement from failed Guts Rolls does not generate AROs or trigger Deployable Weapons or Equipment."
},
{
  "sourceId": "infinity-rules-n5.3",
  "title": "Infinity Rules",
  "version": "5.3",
  "authority": 1,
  "scope": "core",
  "pdfPage": 45,
  "printedPage": "45",
  "section": "TEMPLATE WEAPONS INTO CLOSE COMBAT",
  "headings": [
    "TEMPLATE WEAPONS INTO CLOSE COMBAT"
  ],
  "structuredBlockTypes": [
    "EFFECTS",
    "REMEMBER"
  ],
  "canonicalTerm": "template weapons into close combat",
  "text": "TEMPLATE WEAPONS INTO CLOSE COMBAT\nTemplate Weapons placed on a group of Troopers engaged in Close Combat will always affect every Trooper involved, even if, due to the Template's placement, it contacts only some of them. Players must take this into account, since Attacks cannot be performed against Allied Troopers."
},
{
  "sourceId": "infinity-rules-n5.3",
  "title": "Infinity Rules",
  "version": "5.3",
  "authority": 1,
  "scope": "core",
  "pdfPage": 97,
  "printedPage": "97",
  "section": "IMPETUOUS",
  "headings": [
    "IMPETUOUS",
    "EFFECTS"
  ],
  "structuredBlockTypes": [
    "REQUIREMENTS",
    "EFFECTS"
  ],
  "canonicalTerm": "impetuous",
  "text": "IMPETUOUS\nAUTOMATIC SKILL\nImpetuous Phase, Obligatory.\nEFFECTS\nDuring the Turn's Impetuous Phase, the player may activate each Impetuous Trooper once, without spending an Order. Removing the Impetuous Token to activate the Trooper counts as spending an Order on them, applying the Order Expenditure Sequence normally.\nRestriction: Impetuous activations only allow a fixed set of Skill combinations: Move + CC Attack; Move + BS Attack; Move + Dodge; Move + Idle; Move + Move; Jump; Climb; Berserk; Skills with the Airborne Deployment Label; those Skills that specify they can be used during the Impetuous Phase.\nRestriction: In the Impetuous Phase, when declaring a Skill with the Movement Label, the Trooper must always move the full corresponding MOV value, attempting to perform the first of these options that the Trooper can complete:\nEnter Silhouette contact with an Enemy Trooper during this move.\nGo towards the Enemy Deployment Zone without doubling back from the movement's starting position, applying the following priorities:\n1. Use their complete MOV value.\n2. End their movement as close to the Enemy Deployment Zone as possible.\n3. If they cannot end their movement closer to the enemy Deployment Zone, the Trooper performs an Idle.\nOnce inside the enemy Deployment Zone, the Trooper can move normally as long as they stay inside it.\nTroopers may only move a shorter distance if they reach Silhouette contact with an Enemy or a Special Terrain area hinders their Movement or forces them to declare Jump or Climb.\nIn the Impetuous Phase, when declaring Move, Jump, or Climb, the Trooper must cancel Prone State, move the full corresponding MOV value, and cannot enter Prone State at the end of the movement.\nRestriction: Impetuous Troopers cannot enter Marker States (Camouflaged, Impersonation...), or any other States that say so. Furthermore, they cannot enter Prone state at the end of the Order."
},
{
  "sourceId": "infinity-rules-n5.3",
  "title": "Infinity Rules",
  "version": "5.3",
  "authority": 1,
  "scope": "core",
  "pdfPage": 79,
  "printedPage": "79",
  "section": "DODGE",
  "headings": [
    "DODGE",
    "EFFECTS"
  ],
  "structuredBlockTypes": [
    "REQUIREMENTS",
    "EFFECTS"
  ],
  "canonicalTerm": "dodge",
  "text": "DODGE\nSHORT SKILL / ARO\nMovement\nREQUIREMENTS\nTroopers can only Dodge if at least one of these is true: They are the Active Trooper; in the Reactive Turn, if they are allowed to declare an ARO.\nEFFECTS\nA successful Normal or Face to Face Dodge Roll allows the user to move up to 2 inches. This movement is measured, declared, and the Trooper moves, during the Effects step of the Order Expenditure Sequence. If both players have Troopers that successfully Dodged, the Active Player will move their Troopers first, then the Reactive Player will move theirs.\nThis movement does not generate AROs or trigger Deployable Weapons or Equipment.\nDodge follows the General Movement Rules as well as the Moving and Measuring sidebar.\nDodge allows the user to enter Engaged State with an enemy, as long as the movement is enough to reach Silhouette contact with that enemy."
},
  {
    sourceId: 'its-season-18',
    title: 'ITS Season 18: Overheat',
    version: '2026.09.04',
    authority: 1,
    scope: 'ITS',
    pdfPage: 54,
    printedPage: '54',
    section: 'USE PANOPLIES',
    headings: ['USE PANOPLIES', 'SHORT SKILL', 'REQUIREMENTS', 'EFFECTS', 'PANOPLY CHART'],
    structuredBlockTypes: ['REQUIREMENTS', 'EFFECTS'],
    canonicalTerm: 'use panoplies',
    text: 'USE PANOPLIES\nSHORT SKILL\nAttack, Scenario.\nREQUIREMENTS\nThe Trooper must be in Silhouette contact with a Panoply.\nEFFECTS\nBy succeeding at a WIP Roll, a Trooper gains the D-Charges weapon or, if their player prefers, makes a Roll on the Panoply Chart to obtain one different weapon or piece of equipment. Once a success has been rolled, that Trooper cannot use this Panoply again.\nTroopers possessing the Booty Special Skill, or any other Skill which specifies so, do not need to make the WIP Roll.\nA Trooper in Silhouette contact with this piece of scenery may spend one Short Skill of an Order to cancel their Unloaded State.\nIf a Trooper rolls a weapon or piece of equipment they already have, they can repeat the roll on the Panoply Chart.',
  },
])

export function normalizeRuleText(value) { return String(value ?? '').normalize('NFKD').replace(/[^a-zA-Z0-9+.-]+/g, ' ').trim().toLowerCase() }
function terms(value) { return normalizeRuleText(value).split(/\s+/).filter((term) => term.length > 1 && !stopWords.has(term)) }
const wrapperPatterns=[/^how does (.+?) work$/,/^what does (.+?) do$/,/^what is (.+?)$/,/^explain (.+?)$/,/^how do i use (.+?)$/,/^tell me about (.+?)$/,/^what are the rules for (.+?)$/]
const interactionPatterns=[
  /\b(?:does|can|will|may)\s+(.+?)\s+(break|cancel|trigger|ignore|apply|affect|interact with|work through|see through)\s+(.+?)\??$/i,
  /\b(?:does|can|will|may)\s+(.+?)\s+(?:be used|apply)\s+(?:during|through|against)\s+(.+?)\??$/i,
  /\b(?:does\s+)?(.+?)\s+(?:get|be)\s+(?:broken|cancelled|canceled|ignored)\s+by\s+(.+?)\??$/i,
]
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
  const headingTerms=(chunk)=>new Set(terms(`${chunk.section??''} ${(chunk.headings??[]).join(' ')}`))
  const scopedItsTerms=queryTerms.filter((term)=>term.length>=4&&chunks.some((chunk)=>chunk.scope==='ITS'&&headingTerms(chunk).has(term))&&!chunks.some((chunk)=>chunk.scope!=='ITS'&&headingTerms(chunk).has(term)))
  exactPhrases.push(...scopedItsTerms)
  const asksIts=/\bits\b|classified|mission|scenario|scoring|specialist troop|objective point/i.test(question)||scopedItsTerms.length>0
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
  const indexedChunks=index.chunks.map((chunk)=>chunk.canonicalTerm==='impetuous'&&chunk.pdfPage===88?{...chunk,canonicalTerm:'climbing plus'}:chunk)
  const chunks=[...indexedChunks,...rulesSupplements.map((chunk)=>({...chunk,sourceUrl:trustedUrls.get(chunk.sourceId)}))].map((chunk)=>{const source=manifest.sources.find((item)=>item.id===chunk.sourceId);if(!source)throw new Error(`Unknown indexed source: ${chunk.sourceId}`);if(chunk.sourceUrl!==trustedUrls.get(chunk.sourceId))throw new Error(`Untrusted indexed URL: ${chunk.sourceId}`);if(!Number.isInteger(chunk.pdfPage)||chunk.pdfPage<1||chunk.pdfPage>source.pageCount)throw new Error(`Invalid indexed page: ${chunk.sourceId}`);if(chunk.printedPage!==printedPageForSource(source,chunk.pdfPage))throw new Error(`Invalid printed page mapping: ${chunk.sourceId}:${chunk.pdfPage}`);return{...chunk,normalized:normalizeRuleText(`${chunk.section} ${chunk.headings.join(' ')} ${chunk.text}`)}})
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
  const interaction=Boolean(interactionPatterns.some((pattern)=>pattern.test(stripped)))||/\b(against|interact(?:s|ing)? with|through|see through|versus|vs|and|while|when|with)\b/.test(stripped)
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
  const interactionSpec=interaction?parseInteraction(stripped,unique,corpus.ruleCatalog??[]):null
  return{intent:interactionSpec?'INTERACTION':interaction&&families.size>1?'INTERACTION':unique.length||aliasHits.length||knownLegacy?'DIRECT_LOOKUP':'BROAD_SEARCH',extractedRuleTerm:stripped,aliases:[...new Set(aliasHits)],fuzzyMatch:fuzzy?.canonicalName??null,resolved:unique,interaction:interactionSpec}
}
function parseInteraction(question,resolved,catalog){
  const match=interactionPatterns.map((pattern)=>question.match(pattern)).find(Boolean)
  const names=resolved.map((item)=>item.normalizedName)
  if(!match)return names.length>1?{operator:'interact',concepts:names}:null
  const parts=match.slice(1).map(normalizeRuleText)
  const exact=[...names,...parts.filter((part)=>part.length>=4&&part.includes(' ')),...parts.flatMap((part)=>catalog.filter((item)=>item.normalizedName.length>=4&&new RegExp(`(?:^| )${item.normalizedName.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')}(?:$| )`).test(part)).map((item)=>item.normalizedName))]
  const fuzzyParts=parts.filter((part)=>part.length>=4&&!part.includes(' ')&&!exact.some((name)=>part.includes(name))).map((part)=>catalog.map((item)=>({item,distance:editDistance(part,item.normalizedName)})).sort((a,b)=>a.distance-b.distance||a.item.normalizedName.length-b.item.normalizedName.length)[0]).filter((match)=>match&&match.distance<=2).map((match)=>match.item.normalizedName)
  const concepts=[...new Set([...exact,...fuzzyParts])]
  return {operator:interactionPatterns[2].test(question)?'break':match[2]||'interact',concepts}
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
function chartCell(value){const text=String(value??'').replace(/[\r\n]+/g,' ').replace(/-\s+/g,'-').replace(/\s+/g,' ').trim();return !text||text===',,'||text==='-'||text==='–'||text==='—'?'—':text.replace(/[“”]/g,'—')}
function chartBlockLines(rawText){const lines=String(rawText??'').replace(/\r/g,'').split('\n');const start=lines.findIndex((line)=>/HACKING PROGRAMS CHART/i.test(line));if(start<0)return[];const end=lines.findIndex((line,index)=>index>start&&/^\s*\d{3}\s*$/.test(line));return lines.slice(start+1,end<0?lines.length:end)}
export function parseHackingProgramsChart(rawText){
  let lines=chartBlockLines(rawText).map((line)=>line.replace(/\r$/,'')).filter((line)=>line.trim());if(!lines.length)return[];const header=lines.findIndex((line)=>/^\s*NAME\b/i.test(line));if(header>=0)lines=lines.slice(header+2)
  const starts=[];for(let i=0;i<lines.length;i++){const left=lines[i].slice(0,20).trim(),data=lines[i].slice(20,68),hasData=/\d|,,|\s[-–—]\s/.test(data),next=lines[i+1]??'',nextData=/\d|,,|\s[-–—]\s/.test(next.slice(20,68));if(left&&/^[A-Z][A-Z0-9 ]*$/.test(left)&&(hasData||!starts.length||nextData))starts.push(i)}
  const rows=[];for(let s=0;s<starts.length;s++){const start=starts[s],next=starts[s+1]??lines.length;let block=lines.slice(start,next);const prior=lines[start-1];if(prior&&/^\s{60,}/.test(prior)&&/(SKILL|ARO|NULLIFIES|TARGET|LETHAL|AMMO)/i.test(prior))block=[prior,...block];const cols=[...Array(8)].map(()=>[]);for(const line of block){const parts=[line.slice(0,20),line.slice(20,34),line.slice(34,46),line.slice(46,56),line.slice(56,68),line.slice(68,77),line.slice(77,93),line.slice(93)];parts.forEach((part,index)=>{const value=part.trim();if(value)cols[index].push(value)})}const name=cols[0].join(' ').replace(/\s+/g,' ').trim();const row={name,attackMod:chartCell(cols[1].join(' ')),opponentMod:chartCell(cols[2].join(' ')),ps:chartCell(cols[3].join(' ')),burst:chartCell(cols[4].join(' ')),target:chartCell(cols[5].join(' ')),skillType:chartCell(cols[6].join(' ')),special:chartCell(cols[7].join(' '))};if(name&&/^[A-Z][A-Z0-9 /+-]+$/.test(name)&&[row.attackMod,row.opponentMod,row.ps,row.burst,row.target,row.skillType,row.special].every(Boolean))rows.push(row)}return rows
}
function extractChartRow(result){const row=result.chartRow??parseHackingProgramsChart(result.text).find((item)=>normalizeRuleText(item.name)===normalizeRuleText(result.canonicalTerm));if(!row)return '';return ['NAME | ATTACK MOD | OPPONENT MOD | PS | BURST | TARGET | SKILL TYPE | SPECIAL',`${row.name} | ${row.attackMod} | ${row.opponentMod} | ${row.ps} | ${row.burst} | ${row.target} | ${row.skillType} | ${row.special}`].join('\n').slice(0,650)}
const clauseLabels=new Set(['REQUIREMENTS','EFFECTS','IMPORTANT','REMEMBER','CANCELLATION','ACTIVATION','FAQ','EXAMPLE'])
const ruleTypeLine=/^(AUTOMATIC (?:SKILL|EQUIPMENT)|BASIC SHORT SKILL(?: \/ ARO)?|SHORT SKILL(?: \/ ARO)?|LONG SKILL|SPECIAL SKILL|OBLIGATORY|OPTIONAL(?:, NFB\.?)?|NFB,? OBLIGATORY\.?)$/i
export function segmentRuleClauses(text,{ruleName}={}){
  const clauses=[];let blockType='BODY',current=null,started=false
  const normalizedRule=normalizeRuleText(ruleName),lines=String(text??'').replace(/\r/g,'').split('\n')
  const hasRuleHeading=lines.some((line)=>normalizeRuleText(line.trim())===normalizedRule)
  const flush=()=>{if(current?.text.trim())clauses.push({...current,text:current.text.replace(/\s*\n\s*/g,' ').replace(/\s+([.,;:])/g,'$1').trim()});current=null}
  for(const raw of lines){const line=raw.trim();if(!line){if(current?.blockType==='BODY'||current?.blockType==='FAQ')flush();continue}const normalizedLine=normalizeRuleText(line);if(hasRuleHeading&&!started){if(normalizedLine!==normalizedRule)continue;started=true;continue}if(normalizedLine===normalizedRule){started=true;flush();continue}const label=line.replace(/\s+\d+$/,'').toUpperCase();if(clauseLabels.has(label)){flush();blockType=label;continue}if(ruleTypeLine.test(line))continue
    if(started&&(clauses.length||current)&&/^[A-Z][A-Z0-9 +:/().’-]{2,70}$/.test(line)&&!/^Q:|^A:/i.test(line)){flush();break}
    const startsClause=/^(?:►|»|•|Q:|A:|\d+[.)]\s)/i.test(line)
    if(startsClause)flush()
    if(current)current.text+=` ${line}`;else current={blockType,text:line}
    if(/^(?:Q:|A:)/i.test(line))current.blockType='FAQ'
  }
  flush();return clauses.map((clause,index)=>({...clause,index}))
}
function interactionConcepts(question,targets,resolution){
  const normalized=normalizeRuleText(question),concepts=[...targets,...resolution.aliases,...terms(question)]
  if(/smoke/.test(normalized))concepts.push('smoke ammunition','zero visibility zone','visibility zone')
  if(/see through|line of fire|\blof\b/.test(normalized))concepts.push('draw lof','requires lof','visibility zone')
  if(/mimetism/.test(normalized))concepts.push('mimetism -3','mimetism -6','visibility zones')
  if(/discover/.test(normalized)&&/camouflaged/.test(normalized))concepts.push('discover roll','target marker','first skill','second skill','order expenditure sequence','declare attacks against camouflaged markers')
  if(/repeater/.test(normalized))concepts.push('enemy repeater','hacking area','firewall','comms attack','negative mod','wip attribute')
  if(/stealth/.test(normalized))concepts.push('stealth','aro','zone of control','reactive trooper','short skill')
  if(/sixth sense/.test(normalized))concepts.push('sixth sense','stealth','aro')
  if(/dodge/.test(normalized)&&/(without|no) lof/.test(normalized))concepts.push('without lof','zone of control','dodge roll')
  return[...new Set(concepts.map(normalizeRuleText).filter((value)=>value.length>1))]
}
function clauseScore(clause,concepts,{faq=false,question=''}={}){const normalized=normalizeRuleText(clause.text),query=normalizeRuleText(question);let score={FAQ:faq?30:12,REQUIREMENTS:8,EFFECTS:10,IMPORTANT:8,REMEMBER:7,CANCELLATION:6,ACTIVATION:6,EXAMPLE:-3,BODY:2}[clause.blockType]??0;let matches=0,phrases=0;for(const concept of concepts){if(concept.length>=4&&normalized.includes(concept)){score+=concept.includes(' ')?13:4;matches++;if(concept.includes(' '))phrases++}}if(matches>=2)score+=14;if(phrases>=2)score+=12;if(/smoke/.test(query)&&/see through/.test(query)&&/generates a zero visibility zone/.test(normalized))score+=60;if(/discover/.test(query)&&/(shoot|attack)/.test(query)&&/discover attack maneuver/.test(normalized))score+=70;if(/discover/.test(query)&&/(shoot|attack)/.test(query)&&/does not count as the same marker/.test(normalized))score-=40;if(/coordinated/.test(query)&&/aro/.test(query)&&/each reactive trooper must choose only one/.test(normalized))score+=70;if(/dodge/.test(query)&&/(without|no) lof/.test(query)&&/(outside their lof|without lof)/.test(normalized))score+=70;if(/zero pain/.test(query)&&/repeater/.test(query)&&/-3 wip mod/.test(normalized))score+=70;if(/quick reference|index|contents/i.test(clause.text))score-=30;if(clause.blockType==='EXAMPLE'&&matches>=2)score+=8;return score}
function interactionClauseScore(clause,spec,question){let score=clauseScore(clause,spec.concepts,{faq:clause.sourceId?.includes('faq'),question});const text=normalizeRuleText(clause.text);if(/effects|cancellation|requirements|aro|timing|label/.test(`${clause.blockType} ${text}`))score+=12;if(/(?:if|when|unless|only|normally|cannot|does not|no )/.test(text))score+=18;if(spec.operator==='break'&&/other skill|grant aros? normally|aros? are granted normally/.test(text))score+=50;if(spec.operator==='cancel'&&/cancel|cancellation|break/.test(text))score+=35;return score}
function clauseMetadata(result,clause){return{sourceId:result.sourceId,sourceVersion:result.version,ruleName:result.displayRuleName??result.section,page:result.printedPage,parentSection:result.section,sourceUrl:result.sourceUrl,blockType:clause.blockType,text:clause.text,score:clause.score,index:clause.index}}
export function selectRelevantClauses(result,{question,targets=[],resolution,maxClauses=1,directLookup=false}={}){
  if(result.chartRow)return {excerpt:extractChartRow(result),clauses:[]}
  const clauses=result.clauses?.length?result.clauses:segmentRuleClauses(result.text,{ruleName:result.canonicalTerm??result.displayRuleName})
  if(!clauses.length)return{excerpt:compactExcerpt(result,result.canonicalTerm??question,560),clauses:[]}
  const concepts=interactionConcepts(question,targets,resolution)
  const ranked=clauses.map((clause)=>({...clause,score:clauseScore(clause,concepts,{faq:result.sourceId.includes('faq'),question})})).filter((clause)=>clause.text.length>20).sort((a,b)=>b.score-a.score||a.index-b.index)
  let selected=directLookup?clauses.filter((clause)=>clause.blockType==='EFFECTS'||clause.blockType==='REQUIREMENTS'||clause.blockType==='BODY').filter((clause)=>clause.text.length>20).slice(0,maxClauses).map((clause)=>({...clause,score:clauseScore(clause,concepts,{question})})):ranked.slice(0,maxClauses)
  if(result.sourceId.includes('faq')&&selected.length){const pivot=selected[0].index;let start=pivot;while(start>0&&!clauses[start].text.includes('?'))start--;let end=Math.max(pivot,start);while(end+1<clauses.length&&!/^[A-Z][A-Z ]{2,30}$/.test(clauses[end+1].text)&&!(end>pivot&&clauses[end+1].text.includes('?')))end++;if(/^\p{Ll}/u.test(clauses[start].text)&&clauses[start].text.includes('?')){const answerStart=clauses.slice(start,end+1).find((clause)=>/^(?:If|No\.|Yes\.)\b/.test(clause.text));if(answerStart)start=answerStart.index}selected=clauses.slice(start,end+1).map((clause)=>({...clause,blockType:'FAQ',score:clauseScore(clause,concepts,{faq:true,question})}))}
  for(const clause of [...selected])if(/(?:one of these is true|following requirements):?$/i.test(clause.text)){for(const dependency of clauses.slice(clause.index+1)){if(dependency.blockType!==clause.blockType)break;if(!selected.includes(dependency))selected.push({...dependency,score:clause.score-.1})}}
  for(const clause of [...selected])if(clause.blockType==='EFFECTS'){const requirement=[...clauses].slice(0,clause.index).reverse().find((candidate)=>candidate.blockType==='REQUIREMENTS');if(requirement&&!selected.includes(requirement)&&/\b(?:requires?|must|only|may)\b/i.test(clause.text))selected.push({...requirement,score:clause.score-.1})}
  selected.sort((a,b)=>a.index-b.index)
  if (/name ps b target skill type/.test(String(result.normalized||'').toLowerCase())) return { excerpt: extractChartRow(result), clauses: [] }
  let previousBlock='';const includeHeader=/firewall|repeater|zero pain|comms attack/i.test(question);const header=includeHeader?String(result.text||'').split(/\n\s*(?:REQUIREMENTS|EFFECTS)\b/i)[0].trim():'';const excerpt=[header,selected.map((clause)=>{const label=clause.blockType!=='BODY'&&clause.blockType!==previousBlock?`${clause.blockType}\n`:'';previousBlock=clause.blockType;return`${label}${clause.text}`}).join('\n')].filter(Boolean).join('\n\n').slice(0,650)
  return{excerpt,clauses:selected.map((clause)=>clauseMetadata(result,clause))}
}
export function buildRulesReference(corpus,question,{maxResults=4}={}){
  const clean=String(question??'').trim();if(!clean)throw new Error('A rules question is required.');if(clean.length>1000)throw new Error('Rules question exceeds 1000 characters.')
  const resolution=resolveRuleQuery(corpus,clean);const searched=searchRules(corpus.chunks,clean,{extraAliases:[...resolution.aliases,...resolution.resolved.map((item)=>item.normalizedName)],limit:24});const meaningful=searched.filter((item)=>item.score>=10);const legacyTargets=targetTermsForQuestion(clean).filter((legacy)=>!resolution.resolved.some((item)=>item.family===legacy));const resolvedTargets=resolution.resolved.map((item)=>item.normalizedName).filter((name)=>!legacyTargets.some((legacy)=>legacy.includes(name)||name.includes(legacy)));const unresolvedAliases=resolution.aliases.filter((alias)=>!resolution.resolved.some((item)=>item.normalizedName===alias||item.family===alias)&&!legacyTargets.some((legacy)=>legacy.includes(alias)||alias.includes(legacy)));const targets=[...new Set([...resolvedTargets,...unresolvedAliases,...legacyTargets])]
  const asksIts=/\bits\b|classified|mission|scenario|scoring|specialist troop|objective point/i.test(clean)
  const selected=[]
  for(const target of targets){const indexed=cropusCandidates(corpus.chunks,target,asksIts);const candidates=meaningful.filter((item)=>(asksIts||item.scope!=='ITS')&&item.normalized.includes(target));const item=indexed.find((candidate)=>candidate.canonicalTerm===target)??indexed.find((candidate)=>candidate.canonicalTerm&&(target.includes(candidate.canonicalTerm)||candidate.canonicalTerm.includes(target)))??candidates.find((candidate)=>normalizeRuleText(candidate.headings.join(' ')).includes(target))??candidates[0];const identity=item&&`${item.sourceId}:${item.pdfPage}:${item.canonicalTerm??target}`;const overlapping=selected.some((candidate)=>candidate.sourceId===item?.sourceId&&candidate.pdfPage===item.pdfPage&&candidate.canonicalTerm&&item.canonicalTerm&&(candidate.canonicalTerm.includes(item.canonicalTerm)||item.canonicalTerm.includes(candidate.canonicalTerm)));if(item&&!overlapping&&!selected.some((candidate)=>candidate._identity===identity||candidate.sourceId===item.sourceId&&candidate.pdfPage===item.pdfPage&&candidate.text===item.text))selected.push({...item,_identity:identity,displayRuleName:target.toUpperCase()});if(selected.length>=maxResults)break}
  const faqIntent=/(camouflaged|camo).+total cover|total cover.+(camouflaged|camo)|deployable.+(occupied|silhouette contact)|special die.+coordinated|stealth.+several troopers|several troopers.+stealth/i.test(clean)
  const faqTerm=/total cover/i.test(clean)?'total cover':/direct template/i.test(clean)?'direct template weapon':/place deployable|deployable.+(occupied|silhouette)/i.test(clean)?'place deployable':/stealth/i.test(clean)?'stealth':/special die|coordinated/i.test(clean)?'coordinated orders':null
  const faq=faqIntent?(corpus.chunks.find((item)=>item.sourceId==='infinity-faq-n5-v0.1'&&item.canonicalTerm===faqTerm)??meaningful.find((item)=>item.sourceId==='infinity-faq-n5-v0.1'&&targets.some((target)=>item.normalized.includes(target)))):null
  if(faq&&!selected.some((item)=>item.sourceId===faq.sourceId&&item.pdfPage===faq.pdfPage))selected.unshift({...faq,displayRuleName:'FAQ CLARIFICATION'})
  if(!selected.length&&targets.length){const item=meaningful.find((candidate)=>asksIts||candidate.scope!=='ITS');if(item)selected.push(item)}
  const metadataTerms=[...new Set([...resolution.resolved.map((item)=>item.normalizedName),...targets])]
  for(const term of metadataTerms){const chart=corpus.chunks.find((chunk)=>chunk.chartRows?.some((row)=>normalizeRuleText(row.name)===term));if(chart&&!selected.some((item)=>item.sourceId===chart.sourceId&&item.pdfPage===chart.pdfPage)){const chartRow=chart.chartRows.find((row)=>normalizeRuleText(row.name)===term);selected.push({...chart,canonicalTerm:term,chartRow,displayRuleName:`${term.toUpperCase()} — PROGRAM CHART`})}}
  selected.length=Math.min(selected.length,maxResults)
  const interactionConnector=/\b(and|through|while|when|with|without|against|same|see through|affects?|interacts?|versus|vs\.?|in a|in an)\b/i.test(clean),direct=(resolution.intent==='DIRECT_LOOKUP'&&!interactionConnector)||(selected.length===1&&targets.length===1&&!interactionConnector)
  let interactionEvidence=[]
  let interactionActive=false
  if(resolution.intent==='INTERACTION'&&resolution.interaction){
    const pool=[]
    for(const chunk of corpus.chunks){if(!asksIts&&chunk.scope==='ITS')continue;const clauses=chunk.clauses?.length?chunk.clauses:segmentRuleClauses(chunk.text,{ruleName:chunk.canonicalTerm??chunk.section});for(const clause of clauses){const faqAnswer=chunk.sourceId?.includes('faq')&&/^\s*(?:no|yes)\.?\s*$/i.test(clause.text)&&resolution.interaction.concepts.filter((concept)=>normalizeRuleText(chunk.text).includes(concept)).length>=2;pool.push({...clause,text:faqAnswer?chunk.text.slice(Math.max(0,normalizeRuleText(chunk.text).indexOf(resolution.interaction.concepts[0])-80),Math.min(chunk.text.length,normalizeRuleText(chunk.text).indexOf(resolution.interaction.concepts[0])+520)):clause.text,faqContext:faqAnswer,sourceId:chunk.sourceId,sourceVersion:chunk.version,sourceUrl:chunk.sourceUrl,pdfPage:chunk.pdfPage,printedPage:chunk.printedPage,parentSection:chunk.section,canonicalTerm:chunk.canonicalTerm})}}
    interactionEvidence=pool.filter((clause)=>{const text=normalizeRuleText(`${clause.canonicalTerm||''} ${clause.text}`);const named=resolution.interaction.concepts.includes(normalizeRuleText(clause.canonicalTerm||''));const explicit=/aros? are granted normally|other skill|cancellation|cancelled|canceled|does not|cannot|only grant/.test(text);const both=resolution.interaction.concepts.every((concept)=>text.includes(concept));return named||explicit&&both}).map((clause)=>({...clause,score:interactionClauseScore(clause,resolution.interaction,clean)})).filter((clause)=>clause.score>12).sort((a,b)=>b.score-a.score||a.pdfPage-b.pdfPage).slice(0,6)
    interactionActive=resolution.interaction.concepts.length===2&&((interactionEvidence[0]?.score??0)>=60||(resolution.interaction.operator==='cancel'&&interactionEvidence.some((item)=>item.sourceId?.includes('faq'))))
    if(!interactionActive){interactionEvidence=[]}
    if(interactionActive)selected.length=0
    if(!interactionActive)interactionEvidence=[]
    const evidenceKeys=new Set(interactionEvidence.map((item)=>`${item.sourceId}:${item.pdfPage}`))
    for(const item of interactionEvidence){if(selected.some((candidate)=>candidate.sourceId===item.sourceId&&candidate.pdfPage===item.pdfPage&&candidate.canonicalTerm===item.canonicalTerm))continue;const chunk=corpus.chunks.find((candidate)=>candidate.sourceId===item.sourceId&&candidate.pdfPage===item.pdfPage&&candidate.canonicalTerm===item.canonicalTerm)||corpus.chunks.find((candidate)=>candidate.sourceId===item.sourceId&&candidate.pdfPage===item.pdfPage);if(chunk)selected.push({...chunk,displayRuleName:chunk.canonicalTerm?.toUpperCase()??chunk.section,_interactionEvidence:item})}
    selected.sort((a,b)=>{const ae=a._interactionEvidence?.score??0,be=b._interactionEvidence?.score??0;return be-ae||a.pdfPage-b.pdfPage})
    selected.length=Math.min(selected.length,maxResults)
  }
  const conclusion=resolution.intent==='INTERACTION'?inferInteractionConclusion(clean,resolution.interaction,interactionEvidence):null
  const status=!selected.length?RULES_STATUS.NONE:resolution.intent==='INTERACTION'?RULES_STATUS.MULTI:direct?RULES_STATUS.DIRECT:selected.length>1?RULES_STATUS.MULTI:RULES_STATUS.DIRECT
  const noExplicitFaq=status===RULES_STATUS.MULTI&&!selected.some((item)=>item.sourceId==='infinity-faq-n5-v0.1')
  const rules=selected.map((item)=>{const concise=item._interactionEvidence?{excerpt:`${item._interactionEvidence.blockType!=='BODY'?`${item._interactionEvidence.blockType}\n`:''}${item._interactionEvidence.text}`,clauses:[clauseMetadata(item,item._interactionEvidence)]}:selectRelevantClauses(item,{question:clean,targets,resolution,maxClauses:interactionConnector?1:4,directLookup:!interactionConnector});return{ruleName:item.displayRuleName??item.section,sourceLabel:trustedSourceLabel(corpus.manifest.sources.find((source)=>source.id===item.sourceId)),sourceId:item.sourceId,scope:item.scope,pageLabel:item.printedPage?`p. ${item.printedPage}`:`PDF page ${item.pdfPage}`,pdfPage:item.pdfPage,printedPage:item.printedPage,excerpt:concise.excerpt,selectedClauses:concise.clauses,structuredBlockTypes:item.structuredBlockTypes??[],url:corpus.manifest.sources.find((source)=>source.id===item.sourceId).officialUrl}})
  return {question:clean,status,noExplicitFaq,conclusion,resolution:{intent:resolution.intent,extractedRuleTerm:resolution.extractedRuleTerm,aliases:resolution.aliases,fuzzyMatch:resolution.fuzzyMatch,candidates:resolution.resolved.map((item)=>item.canonicalName),interaction:resolution.interaction},versions:corpus.manifest.sources.map((source)=>({id:source.id,label:trustedSourceLabel(source),version:source.version})),rules}
}
function specConceptMatch(text,concepts){return concepts.some((concept)=>text.includes(concept))}
function inferInteractionConclusion(question,spec,evidence){
  if(!spec||spec.concepts.length<2)return{label:'NOT EXPLICITLY RESOLVED',explanation:'Two distinct rule concepts were not identified, so no interaction conclusion is supported.'}
  const text=evidence.map((item)=>normalizeRuleText(item.text)).join(' ')
  if(!evidence.length)return{label:'NOT EXPLICITLY RESOLVED',explanation:'The activated corpus does not contain a controlling interaction clause for both concepts.'}
  if(spec.operator==='break'&&/(?:if|when) any other skill is declared/.test(text)&&/aros? are granted normally|grant aros? normally/.test(text))return{label:'YES',explanation:'Stealth states that when any other Skill is declared, AROs are granted normally; Dodge is a Skill.'}
  const directNegative=evidence.some((item)=>{const clause=normalizeRuleText(item.text);const matched=spec.concepts.filter((concept)=>clause.includes(concept)).length;return (matched>=2||item.faqContext)&&/\b(?:cannot|does not|no)\b/.test(clause)})
  if(directNegative&&spec.operator!=='break')return{label:'NO',explanation:'The selected controlling clause expressly prevents the interaction.'}
  if(/\b(?:if|unless|only|provided that|when)\b/.test(text))return{label:'CONDITIONAL',explanation:'The selected controlling clause makes the interaction depend on an explicit condition.'}
  return{label:'NOT EXPLICITLY RESOLVED',explanation:'The activated corpus contains related rules but no unambiguous controlling interaction clause.'}
}
