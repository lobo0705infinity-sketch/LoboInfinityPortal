const GENERIC_HEADINGS = new Set([
  'activation', 'automatic equipment', 'automatic skill', 'basic rules', 'body',
  'cancellation', 'combat', 'common skills in infinity', 'effects', 'equipment',
  'example', 'game states', 'important', 'infinity', 'long skill', 'movement',
  'optional', 'quick reference charts', 'remember', 'requirements', 'short skill',
  'short skill aro', 'skills and equipment', 'special skill', 'special skills in infinity',
])

const GENERIC_SUFFIXES = new Set(['equipment', 'model', 'models', 'piece', 'pieces', 'rule', 'rules', 'skill', 'skills', 'trooper', 'troopers', 'unit', 'units'])
const NOISY_TOKENS = new Set(['enemy', 'active', 'reactive', 'opponent', 'range', 'level', 'mod'])
const NON_TERMS = new Set([
  'and hacking programs characteristics', 'attack mod', 'attribute', 'base', 'basic short skill', 'basic short skills',
  'common', 'control', 'deployment', 'device', 'diameter', 'effects', 'example 2', 'example 3', 'game table',
  'in infinity', 'item', 'level 1', 'level 2', 'level 3', 'level 4', 'long skills', 'minimum', 'mods', 'name',
  'normal', 'note', 'number', 'objectives', 'of control', 'order', 'page', 'painting', 'plus', 'points', 'reaction',
  'restrictions', 'roll', 'rolls', 'saving', 'scenarios', 'short skills', 'side', 'size', 'skills and', 'special',
  'states', 'step 3', 'target', 'token', 'total', 'traits', 'trajectory', 'troop', 'turn', 'type', 'weapons and equipment',
])
const TYPO_SAFE_WORDS = new Set('about against all already an and any are as at be because benefit can could did do does during for from gain get has have how if in into is it may my no not of on or should so than that the their them then there these they this through to trooper use what when where which while who why with without work yes'.split(' '))
const RELATION_TERM_ENDINGS = new Set(['area', 'contact', 'control', 'cover', 'fire', 'integrity', 'label', 'roll', 'sequence', 'state', 'turn', 'zone'])

// This is intentionally a small table of community vocabulary, not the terminology
// catalog. The catalog itself is generated from every activated official source.
// These aliases cover phrases whose meaning cannot be derived mechanically.
const COMMUNITY_ALIASES = Object.freeze({
  'automatic reaction order': ['aro', 'reaction order', 'reactive order', 'shoot back'],
  'ballistic skill attack': ['bs attack', 'shoot', 'shooting'],
  'camouflaged state': ['camo', 'camo state', 'camouflage marker', 'camo marker'],
  'fireteam': ['link', 'link team', 'linked team'],
  'killer hacking device': ['khd'],
  'line of fire': ['lof', 'line of sight', 'los'],
  'multispectral visor': ['msv'],
  'multispectral visor level 1': ['msv1', 'msv 1', 'msv-1'],
  'multispectral visor level 2': ['msv2', 'msv 2', 'msv-2'],
  'multispectral visor level 3': ['msv3', 'msv 3', 'msv-3'],
  'no wound incapacitation': ['nwi'],
  'silhouette contact': ['base contact', 'base to base', 'base-to-base', 'b2b', 'btb', 'touching bases'],
  'smoke ammunition': ['smoke', 'smoke ammo'],
  'symbiobomb': ['symbio bomb'],
  'zone of control': ['zoc'],
})

const WORD_ALIASES = Object.freeze({
  dodged: 'dodge', dodges: 'dodge', dodging: 'dodge',
  hacked: 'hack', hacking: 'hack', hacks: 'hack',
  repeaters: 'repeater',
  revealed: 'reveal', reveals: 'reveal', revealing: 'reveal',
  units: 'trooper', unit: 'trooper', models: 'trooper', model: 'trooper', pieces: 'trooper', piece: 'trooper',
})

const catalogCache = new WeakMap()

export function normalizeTerminologyText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/\bbase\s*[- ]?to\s*[- ]?base\b/gi, 'base to base')
    .replace(/[^a-zA-Z0-9+.'/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function buildRulesTerminologyCatalog(corpus) {
  if (!corpus?.chunks?.length) throw new Error('The rules corpus is required to build terminology.')
  const cached = catalogCache.get(corpus)
  if (cached) return cached

  const records = new Map()
  const add = (name, location, { canonicalName = name, family = name, provenance = 'corpus' } = {}) => {
    const normalizedName = cleanCandidate(name)
    if (!isPlausibleTerm(normalizedName)) return
    const key = normalizedName
    const record = records.get(key) || {
      canonicalName: displayName(canonicalName, normalizedName),
      normalizedName,
      family: cleanCandidate(family) || normalizedName,
      aliases: new Set([normalizedName]),
      locations: [],
      provenance: new Set(),
    }
    if (location && !record.locations.some((item) => item.sourceId === location.sourceId && item.pdfPage === location.pdfPage)) record.locations.push(location)
    record.provenance.add(provenance)
    records.set(key, record)
  }

  for (const item of corpus.ruleCatalog || []) {
    const pageChunks = corpus.chunks.filter((chunk) => chunk.sourceId === item.sourceId && chunk.pdfPage === item.pdfPage)
    if (!hasRuleShape(item.normalizedName, pageChunks)) continue
    add(item.normalizedName, locationFor(item), { canonicalName: item.canonicalName, family: item.family, provenance: 'rule-catalog' })
  }

  for (const chunk of corpus.chunks) {
    if (chunk.canonicalTerm && hasRuleShape(chunk.canonicalTerm, [chunk])) add(chunk.canonicalTerm, locationFor(chunk), { provenance: 'canonical-chunk' })
    for (const rawHeading of chunk.headings || []) {
      for (const heading of splitHeading(rawHeading)) {
        if (hasRuleShape(heading, corpus.chunks.filter((item) => item.sourceId === chunk.sourceId && item.pdfPage === chunk.pdfPage))) {
          add(heading, locationFor(chunk), { canonicalName: heading, provenance: 'official-heading' })
        }
      }
    }
    for (const match of String(chunk.text || '').matchAll(/\bthe term\s+([A-Z][A-Za-z -]{2,45}?)\s+(?:refers|is defined)\b/g)) {
      add(match[1], locationFor(chunk), { canonicalName: match[1], provenance: 'defined-term' })
    }
    for (const match of String(chunk.text || '').matchAll(/\b([A-Z][A-Za-z]+(?:\s+(?:of|and|the|[A-Z][A-Za-z]+)){1,6})\s*\(([A-Za-z][A-Za-z0-9+/-]{1,7})\)/g)) {
      if (!isInitialism(match[1], match[2])) continue
      add(match[1], locationFor(chunk), { canonicalName: match[1], provenance: 'official-parenthetical' })
    }
  }

  for (const record of records.values()) addGeneratedAliases(record)
  for (const [target, aliases] of Object.entries(COMMUNITY_ALIASES)) {
    const matches = findAliasTargets(records, target)
    for (const record of matches) for (const alias of aliases) record.aliases.add(normalizeTerminologyText(alias))
  }
  addOfficialParentheticalAliases(corpus, records)

  const aliasOwners = new Map()
  for (const record of records.values()) for (const alias of record.aliases) {
    if (!alias || alias.length < 2) continue
    const owners = aliasOwners.get(alias) || []
    owners.push(record.normalizedName)
    aliasOwners.set(alias, owners)
  }
  // An automatically generated abbreviation is useful only when it resolves to
  // exactly one official concept. Explicit community aliases may intentionally
  // map to related levels (for example MSV plus its numbered forms).
  for (const [alias, owners] of aliasOwners) if (owners.length > 1 && !isExplicitAlias(alias)) {
    for (const owner of owners) records.get(owner)?.aliases.delete(alias)
    aliasOwners.delete(alias)
  }

  const entries = [...records.values()].map((record) => Object.freeze({
    ...record,
    aliases: Object.freeze([...record.aliases].sort((left, right) => right.length - left.length || left.localeCompare(right))),
    locations: Object.freeze(record.locations),
    provenance: Object.freeze([...record.provenance]),
  })).sort((left, right) => right.normalizedName.length - left.normalizedName.length || left.normalizedName.localeCompare(right.normalizedName))
  const tokenVocabulary = Object.freeze([...new Set(entries.filter((entry) => entry.provenance.some((value) => value !== 'official-heading')).flatMap((entry) => entry.aliases.flatMap((alias) => alias.split(' '))))]
    .filter((token) => /^[a-z][a-z0-9+-]{2,}$/.test(token) && !GENERIC_SUFFIXES.has(token))
    .sort())
  const catalog = Object.freeze({ entries: Object.freeze(entries), aliasOwners, tokenVocabulary })
  catalogCache.set(corpus, catalog)
  return catalog
}

export function resolveRulesTerminology(corpus, question) {
  const original = String(question ?? '').trim()
  const catalog = buildRulesTerminologyCatalog(corpus)
  const normalized = normalizePlayerLanguage(original)
  const exact = matchEntities(normalized, catalog)
  const correctedQuestion = correctUnambiguousTypos(normalized, catalog, exact)
  const exactNames = new Set(exact.map((item) => item.normalizedName))
  const corrected = correctedQuestion === normalized ? [] : matchEntities(correctedQuestion, catalog, { correction: true }).filter((item) => !exactNames.has(item.normalizedName))
  const entities = dedupeMatches([...exact, ...corrected])
  const dependencies = resolveDependencies(corpus, entities, catalog, normalized)
  const searchTerms = [...new Set([...entities, ...dependencies].map((item) => item.normalizedName))]
  const intent = entities.length > 1 ? 'INTERACTION' : entities.length === 1 ? 'DIRECT_LOOKUP' : 'BROAD_SEARCH'
  return Object.freeze({
    original,
    normalized,
    correctedQuestion,
    intent,
    entities: Object.freeze(entities),
    dependencies: Object.freeze(dependencies),
    searchTerms: Object.freeze(searchTerms),
    conceptSignature: `${intent}:${entities.map((item) => item.normalizedName).sort().join('|')}`,
  })
}

export function selectTerminologyEvidence(corpus, resolution, { maxPerConcept = 1 } = {}) {
  const selected = []
  for (const concept of [...resolution.entities, ...resolution.dependencies]) {
    const candidates = corpus.chunks.map((chunk) => ({ chunk, score: evidenceScore(chunk, concept) })).filter((item) => item.score > 0).sort((left, right) => right.score - left.score || left.chunk.authority - right.chunk.authority || left.chunk.pdfPage - right.chunk.pdfPage)
    for (const { chunk } of candidates.slice(0, maxPerConcept)) if (!selected.includes(chunk)) selected.push(chunk)
  }
  return selected
}

export function formatTerminologyContext(resolution) {
  if (!resolution?.entities?.length) return 'No official term was resolved with sufficient confidence; use the original wording and evidence.'
  const mappings = resolution.entities.map((item) => `"${item.surface}" = ${item.canonicalName}`).join('; ')
  const dependencies = resolution.dependencies.length ? ` Related controlling concepts: ${resolution.dependencies.map((item) => item.canonicalName).join(', ')}.` : ''
  return `Resolved official terminology: ${mappings}. Intent: ${resolution.intent}.${dependencies} These mappings aid retrieval only and do not decide the ruling.`
}

function cleanCandidate(value) {
  return normalizeTerminologyText(value)
    .replace(/^the\s+/, '')
    .replace(/\s+(?:chart|example)$/, '')
    .replace(/^[-/.]+|[-/.]+$/g, '')
    .trim()
}

function isPlausibleTerm(value) {
  if (!value || value.length < 3 || value.length > 70 || GENERIC_HEADINGS.has(value) || NON_TERMS.has(value)) return false
  const words = value.split(' ')
  if (words.length > 7 || words.some((word) => word.length === 1 && !/^\d$/.test(word))) return false
  if (/^\d/.test(value)) return false
  if (/^(?:mov|bs|wip|ph|cc|arm|bts|vita|str)\s*\d/i.test(value)) return false
  if (/\b(?:enemy [ab]|trooper who|troop that|roll item|number of|own deployment zone)\b/.test(value)) return false
  if (words.length === 1 && (value.length < 4 || NOISY_TOKENS.has(value))) return false
  const letters = value.replace(/[^a-z]/g, '')
  if (letters.length < 3 || !/[aeiouy]/.test(letters)) return false
  return true
}

function splitHeading(value) {
  return String(value || '')
    .split(/\s{3,}|\s*\/\s*/)
    .map((part) => cleanCandidate(part.replace(/^[+►»•\s]+/, '')))
    .filter(Boolean)
}

function hasRuleShape(term, chunks) {
  const normalizedTerm = cleanCandidate(term)
  if (!isPlausibleTerm(normalizedTerm)) return false
  for (const chunk of chunks) {
    const text = String(chunk.text || '')
    const normalizedText = normalizeTerminologyText(text)
    if (!containsPhrase(normalizedText, normalizedTerm)) continue
    const canonical = cleanCandidate(chunk.canonicalTerm)
    if (canonical === normalizedTerm && String(chunk.sourceId).includes('faq')) return true
    if (canonical === normalizedTerm && beginsWithTerm(text, normalizedTerm)) return true
    if ((chunk.headings || []).flatMap(splitHeading).includes(normalizedTerm)) {
      const at = normalizedText.indexOf(normalizedTerm)
      const nearby = normalizedText.slice(Math.max(0, at), at + 320)
      if (/\b(?:allows?|applies?|automatic|cannot|common|consists?|defined|effects?|equipment|is |long skill|must|refers|represents?|requirements?|short skill|special skill|state|troopers?|when)\b/.test(nearby)) return true
    }
    const exactLine = text.split(/\r?\n/).findIndex((line) => cleanCandidate(line) === normalizedTerm)
    if (exactLine >= 0) {
      const nearby = normalizeTerminologyText(text.split(/\r?\n/).slice(exactLine, exactLine + 12).join(' '))
      if (/\b(?:automatic|common|deployment|effects?|equipment|long skill|requirements?|short skill|special skill|state|troopers?)\b/.test(nearby)) return true
    }
    if (new RegExp(`\\bthe term\\s+${escapeRegex(normalizedTerm).replace(/\\ /g, '\\s+')}\\s+(?:refers|is defined)\\b`, 'i').test(normalizeTerminologyText(text))) return true
  }
  return false
}

function beginsWithTerm(text, term) {
  const first = cleanCandidate(String(text || '').split(/\r?\n/).find((line) => line.trim()) || '')
  return first === term || first.startsWith(`${term} `)
}

function displayName(value, fallback) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim()
  if (clean && clean.length <= 70 && !/[\uFFFD]/.test(clean)) return clean.replace(/\bAro\b/gi, 'ARO').replace(/\bLof\b/gi, 'LoF').replace(/\bZoc\b/gi, 'ZoC')
  return fallback.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function locationFor(value) {
  return { sourceId: value.sourceId, pdfPage: value.pdfPage, printedPage: value.printedPage ?? null }
}

function addGeneratedAliases(record) {
  const term = record.normalizedName
  record.aliases.add(term.replace(/-/g, ' '))
  record.aliases.add(term.replace(/[ -]/g, ''))
  const words = term.split(' ')
  const last = words.at(-1)
  if (last?.length >= 4) {
    if (!last.endsWith('s')) {
      const plural = last.endsWith('y') && !/[aeiou]y$/.test(last) ? `${last.slice(0, -1)}ies` : /(?:x|z|ch|sh)$/.test(last) ? `${last}es` : `${last}s`
      record.aliases.add([...words.slice(0, -1), plural].join(' '))
    }
  }
}

function findAliasTargets(records, target) {
  const exact = records.get(target)
  if (exact) return [exact]
  if (target === 'ballistic skill attack') return [...records.values()].filter((record) => record.normalizedName === 'bs attack')
  if (target === 'camouflaged state') return [...records.values()].filter((record) => ['camouflaged', 'camouflage'].includes(record.normalizedName))
  return [...records.values()].filter((record) => record.family === target || record.normalizedName.startsWith(`${target} level `))
}

function addOfficialParentheticalAliases(corpus, records) {
  const candidates = new Map()
  for (const chunk of corpus.chunks) for (const match of String(chunk.text || '').matchAll(/\b([A-Z][A-Za-z]+(?:\s+(?:of|and|the|[A-Z][A-Za-z]+)){1,6})\s*\(([A-Za-z][A-Za-z0-9+/-]{1,7})\)/g)) {
    if (!isInitialism(match[1], match[2])) continue
    const name = cleanCandidate(match[1]), alias = cleanCandidate(match[2])
    const record = records.get(name)
    if (!record || !alias || alias.length < 2) continue
    const found = candidates.get(alias) || new Set()
    found.add(record.normalizedName)
    candidates.set(alias, found)
  }
  for (const [alias, owners] of candidates) if (owners.size === 1) records.get([...owners][0])?.aliases.add(alias)
}

function isExplicitAlias(alias) {
  return Object.values(COMMUNITY_ALIASES).some((values) => values.map(normalizeTerminologyText).includes(alias))
}

function normalizePlayerLanguage(value) {
  let normalized = normalizeTerminologyText(value)
  normalized = normalized
    .replace(/\bbase\s+to\s+base\b/g, 'silhouette contact')
    .replace(/\b(?:in melee|in close combat|engaged)\b/g, 'silhouette contact')
    .replace(/\bline of sight\b/g, 'line of fire')
    .replace(/\btouching (?:a |the )?(?:base|bases|terrain|scenery)\b/g, 'silhouette contact')
  normalized = normalized.split(' ').map((word) => WORD_ALIASES[word] || word).join(' ')
  return normalized.replace(/\s+/g, ' ').trim()
}

function matchEntities(text, catalog, { correction = false } = {}) {
  const candidates = []
  for (const entry of catalog.entries) for (const alias of entry.aliases) {
    if (alias.length < 2) continue
    const regex = new RegExp(`(?:^|\\s)(${escapeRegex(alias).replace(/\\ /g, '\\s+')})(?=$|\\s)`, 'g')
    for (const match of text.matchAll(regex)) {
      const surface = match[1]
      const start = (match.index || 0) + match[0].indexOf(surface)
      candidates.push({ ...entry, surface, alias, start, end: start + surface.length, matchType: correction ? 'TYPO_CORRECTED' : alias === entry.normalizedName ? 'CANONICAL' : 'ALIAS' })
    }
  }
  candidates.sort((left, right) => left.start - right.start || right.end - right.start - (left.end - left.start) || left.normalizedName.localeCompare(right.normalizedName))
  const chosen = []
  for (const candidate of candidates) {
    const overlapping = chosen.find((item) => candidate.start < item.end && candidate.end > item.start)
    if (!overlapping) chosen.push(candidate)
  }
  return chosen
}

function correctUnambiguousTypos(text, catalog, exactMatches) {
  const protectedRanges = exactMatches.map((item) => [item.start, item.end])
  const tokens = [...text.matchAll(/[a-z0-9+.-]+/g)]
  const known = new Set(catalog.tokenVocabulary)
  const replacements = []
  for (const tokenMatch of tokens) {
    const token = tokenMatch[0], start = tokenMatch.index || 0, end = start + token.length
    if (token.length < 4 || TYPO_SAFE_WORDS.has(token) || known.has(token) || protectedRanges.some(([left, right]) => start >= left && end <= right)) continue
    const maximum = token.length >= 8 ? 2 : 1
    let bestDistance = maximum + 1
    const best = []
    for (const candidate of catalog.tokenVocabulary) {
      if (Math.abs(candidate.length - token.length) > maximum) continue
      const distance = editDistance(token, candidate)
      if (distance < bestDistance) { bestDistance = distance; best.length = 0; best.push(candidate) }
      else if (distance === bestDistance) best.push(candidate)
    }
    if (bestDistance <= maximum && best.length === 1) replacements.push({ start, end, value: best[0] })
  }
  let corrected = text
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) corrected = `${corrected.slice(0, replacement.start)}${replacement.value}${corrected.slice(replacement.end)}`
  return corrected
}

function dedupeMatches(matches) {
  return [...new Map(matches.map((item) => [item.normalizedName, item])).values()]
    .sort((left, right) => left.start - right.start || left.normalizedName.localeCompare(right.normalizedName))
}

function resolveDependencies(corpus, entities, catalog, question) {
  if (!entities.length) return []
  const mentions = new Map()
  const questionTokens = new Set(question.split(' ').filter((token) => token.length >= 4 && !TYPO_SAFE_WORDS.has(token)))
  for (const entity of entities) {
    const chunks = bestConceptChunks(corpus, entity, 2)
    const entityMentions = new Set()
    for (const chunk of chunks) {
      const normalized = normalizeTerminologyText(chunk.text)
      for (const term of chunk.controllingTerms || []) entityMentions.add(`${cleanCandidate(term)}:controlling`)
      for (const candidate of catalog.entries) {
        if (candidate.normalizedName === entity.normalizedName || candidate.normalizedName.length < 5 || NON_TERMS.has(candidate.normalizedName) || !containsPhrase(normalized, candidate.normalizedName)) continue
        const formal = new RegExp(`\\b${escapeRegex(candidate.normalizedName).replace(/\\ /g, '\\s+')}\\s+(?:rule|skill|state|equipment|trait|program|weapon)\\b`, 'i').test(normalized)
        if (formal) entityMentions.add(`${candidate.normalizedName}:formal`)
        else entityMentions.add(candidate.normalizedName)
      }
    }
    for (const value of entityMentions) {
      const [name, marker] = value.split(':')
      const current = mentions.get(name) || { count: 0, formal: false, controlling: false }
      current.count++
      current.formal ||= marker === 'formal'
      current.controlling ||= marker === 'controlling'
      mentions.set(name, current)
    }
  }
  return [...mentions.entries()]
    .filter(([name, value]) => {
      const queryRelated = name.split(' ').some((token) => questionTokens.has(token))
      const words = name.split(' ')
      const sharedRelationship = value.count >= 2 && words.length > 1 && RELATION_TERM_ENDINGS.has(words.at(-1))
      return value.controlling || sharedRelationship || value.formal && queryRelated
    })
    .map(([name, value]) => ({ ...catalog.entries.find((entry) => entry.normalizedName === name), surface: name, alias: name, start: Number.MAX_SAFE_INTEGER, end: Number.MAX_SAFE_INTEGER, matchType: value.controlling ? 'CONTROLLING_REFERENCE' : value.formal ? 'FORMAL_REFERENCE' : 'SHARED_DEPENDENCY' }))
    .filter((item) => item.normalizedName)
    .sort((left, right) => dependencyPriority(right, mentions) - dependencyPriority(left, mentions) || left.normalizedName.localeCompare(right.normalizedName))
    .slice(0, 6)
}

function dependencyPriority(item, mentions) {
  const value = mentions.get(item.normalizedName) || { count: 0, formal: false, controlling: false }
  return value.count * 10 + (value.controlling ? 60 : 0) + (value.formal ? 30 : 0) + (/(?:silhouette contact|partial cover|line of fire|zone of control|order expenditure sequence)/.test(item.normalizedName) ? 8 : 0)
}

function bestConceptChunks(corpus, concept, limit) {
  return corpus.chunks.map((chunk) => ({ chunk, score: evidenceScore(chunk, concept) })).filter((item) => item.score > 0).sort((left, right) => right.score - left.score || left.chunk.pdfPage - right.chunk.pdfPage).slice(0, limit).map((item) => item.chunk)
}

function evidenceScore(chunk, concept) {
  const term = concept.normalizedName
  if (!term || !containsPhrase(chunk.normalized || normalizeTerminologyText(chunk.text), term)) return 0
  let score = 10
  if (concept.locations?.some((location) => location.sourceId === chunk.sourceId && location.pdfPage === chunk.pdfPage)) score += 120
  if (cleanCandidate(chunk.canonicalTerm) === term) score += 90
  if ((chunk.headings || []).flatMap(splitHeading).includes(term)) score += 70
  if (new RegExp(`(?:^|\\n)\\s*${escapeRegex(term).replace(/\\ /g, '\\s+')}\\s*(?:\\n|$)`, 'i').test(String(chunk.text || ''))) score += 60
  if (new RegExp(`${escapeRegex(term).replace(/\\ /g, '\\s+')}\\s+(?:automatic|common|deployment|long|short|special)?\\s*(?:equipment|skill|state)`, 'i').test(normalizeTerminologyText(chunk.text))) score += 80
  if (/quick reference|contents|example/i.test(chunk.section || '')) score -= 35
  if (String(chunk.sourceId).includes('faq')) score += 12
  return score
}

function containsPhrase(text, phrase) {
  return new RegExp(`(?:^|\\s)${escapeRegex(phrase).replace(/\\ /g, '\\s+')}(?=$|\\s)`).test(text)
}

function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function isInitialism(name, alias) {
  const initials = normalizeTerminologyText(name).split(' ').filter((word) => word !== 'the').map((word) => word[0]).join('')
  const letters = normalizeTerminologyText(alias).replace(/[^a-z]/g, '')
  return initials.length >= 2 && letters === initials
}

function editDistance(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row++) {
    const current = [row]
    for (let column = 1; column <= right.length; column++) current[column] = left[row - 1] === right[column - 1] ? previous[column - 1] : Math.min(previous[column - 1], previous[column], current[column - 1]) + 1
    previous = current
  }
  return previous[right.length]
}
