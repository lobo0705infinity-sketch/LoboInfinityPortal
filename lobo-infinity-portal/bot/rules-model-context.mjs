import { resolve } from 'node:path'
import { readArtifact } from '../scripts/benchmark-artifacts.mjs'
import { isInLiveArmyRoster } from './official-army-rosters.mjs'
import { includedMobilityOptions, officialMovementInches } from './mobility-rating.mjs'

const OFFICIAL_ARMY_SOURCE = resolve(import.meta.dirname, '..', 'data', 'infinity-army', 'benchmark-official-source.json.gz.b64')
const MODEL_CONTEXT_SCHEMA = 'rules-model-context-v2'
const MAX_PROMPT_CONTEXT_CHARACTERS = 24000
const CONTEXTUAL_SINGLE_ALIASES = new Set(['alpha', 'bit', 'blade', 'blink', 'bolt', 'bronze', 'delta', 'handler', 'mentor', 'operator', 'prime', 'regular', 'switcher', 'territorial', 'vector', 'zero'])
const STRICT_CONTEXT_ALIASES = new Set(['regular', 'zero'])
const MODEL_ACTION_WORDS = new Set(['attack', 'benefit', 'climb', 'declare', 'deploy', 'discover', 'dodge', 'enter', 'gain', 'get', 'hack', 'has', 'have', 'heal', 'jump', 'move', 'perform', 'place', 'receive', 'repair', 'shoot', 'trigger', 'use'])
let catalogPromise

export async function loadRulesModelCatalog({ force = false } = {}) {
  if (force || !catalogPromise) catalogPromise = readArtifact(OFFICIAL_ARMY_SOURCE).then(buildRulesModelCatalog)
  return catalogPromise
}

export function buildRulesModelCatalog(capture) {
  if (!capture?.metadata?.weapons?.length || !capture.payloads?.length) throw new Error('Complete official Army capture required.')
  const exactProfiles = buildOfficialRulesProfiles(capture)
  const exactById = new Map(exactProfiles.map((profile) => [profile.id, profile]))
  const aliases = buildAliasIndex(exactProfiles)
  const sortedAliases = [...aliases.values()]
    .filter((entry) => entry.alias.length >= 3)
    .sort((a, b) => tokenCount(b.alias) - tokenCount(a.alias) || b.alias.length - a.alias.length || a.alias.localeCompare(b.alias))
  const reachable = new Set([...aliases.values()].flatMap((entry) => [...entry.exactProfileIds]))
  const missing = exactProfiles.filter((profile) => !reachable.has(profile.id))
  if (missing.length) throw new Error(`Rules model catalog has ${missing.length} unreachable official profiles.`)
  return {
    schemaVersion: MODEL_CONTEXT_SCHEMA,
    datasetId: `official-army-${[...new Set(capture.payloads.map((payload) => payload.version).filter(Boolean))].sort().join('+') || 'unversioned'}`,
    exactProfileCount: exactProfiles.length,
    canonicalProfileCount: new Set(exactProfiles.map((profile) => profile.canonicalId)).size,
    exactProfiles,
    exactById,
    aliases,
    sortedAliases,
  }
}

export async function resolveRulesModelMentions(question, { catalog = null } = {}) {
  const activeCatalog = catalog || await loadRulesModelCatalog()
  return resolveRulesModelMentionsFromCatalog(activeCatalog, question)
}

export function resolveRulesModelMentionsFromCatalog(catalog, question) {
  const normalizedQuestion = normalizeModelText(question)
  if (!normalizedQuestion) return emptyResolution(catalog, question)
  const matches = []
  const occupied = []
  const candidates = catalog.sortedAliases || [...catalog.aliases.values()]
    .filter((entry) => entry.alias.length >= 3)
    .sort((a, b) => tokenCount(b.alias) - tokenCount(a.alias) || b.alias.length - a.alias.length || a.alias.localeCompare(b.alias))
  for (const candidate of candidates) {
    let offset = 0
    while (offset <= normalizedQuestion.length - candidate.alias.length) {
      const start = normalizedQuestion.indexOf(candidate.alias, offset)
      if (start < 0) break
      const end = start + candidate.alias.length
      offset = start + 1
      if (!isTokenBoundary(normalizedQuestion, start, end)
        || !isCredibleModelMention(question, normalizedQuestion, candidate.alias, start, end)
        || occupied.some((range) => start < range.end && end > range.start)) continue
      const exactProfiles = [...candidate.exactProfileIds].map((id) => catalog.exactById.get(id)).filter(Boolean)
      const variants = dedupeCanonicalProfiles(exactProfiles)
      if (!variants.length) continue
      occupied.push({ start, end })
      matches.push(buildMatch(candidate.alias, exactProfiles, variants, start, end))
      break
    }
  }
  matches.sort((a, b) => a.start - b.start)
  return {
    schemaVersion: MODEL_CONTEXT_SCHEMA,
    source: 'Official Infinity Army',
    datasetId: catalog.datasetId,
    exactProfileCount: catalog.exactProfileCount,
    question: String(question || '').trim(),
    normalizedQuestion,
    models: matches.map(({ start, end, ...match }) => match),
  }
}

export function formatRulesModelContext(resolution, { maxCharacters = MAX_PROMPT_CONTEXT_CHARACTERS } = {}) {
  if (!resolution?.models?.length) return ''
  const header = [
    'OFFICIAL INFINITY ARMY MODEL CONTEXT:',
    'This section is authoritative only for the named model profiles, statistics, Characteristics, Skills, Equipment, and Weapons. It is not rules authority and cannot replace the cited rules evidence.',
    'Use every listed loadout that the question leaves possible. Physical profiles grouped beneath one loadout are state forms, not separate loadout choices. Use the initial/deployment form for Deployment Phase eligibility, and account for alternate state forms when the timing or current state makes them relevant.',
    'If relevant facts differ between possible loadouts, treat the unspecified loadout as a material ambiguity; never silently select the most convenient loadout.',
  ]
  const lines = [...header]
  let used = lines.join('\n').length
  for (const model of resolution.models) {
    const modelHeader = `${model.displayName} (matched “${model.matchedAlias}”): ${model.loadoutCount} official loadout${model.loadoutCount === 1 ? '' : 's'}, represented by ${model.formProfileCount} physical/state profile${model.formProfileCount === 1 ? '' : 's'} across ${model.exactProfileCount} live Army record${model.exactProfileCount === 1 ? '' : 's'}.`
    if (used + modelHeader.length + 1 > maxCharacters) break
    lines.push(modelHeader)
    used += modelHeader.length + 1
    let included = 0
    for (const [index, loadout] of model.loadouts.entries()) {
      const initial = `- Loadout ${index + 1}, initial/deployment form: ${formatPromptProfile(loadout.initialForm)}`
      if (used + initial.length + 1 > maxCharacters) break
      lines.push(initial)
      used += initial.length + 1
      for (const alternate of loadout.alternateForms) {
        const state = `  Alternate state form (${alternate.physicalName || `profile ${alternate.profileId}`}): ${formatPromptProfile(alternate)}`
        if (used + state.length + 1 > maxCharacters) break
        lines.push(state)
        used += state.length + 1
      }
      included += 1
    }
    if (included < model.loadouts.length) {
      const omitted = `- ${model.loadouts.length - included} additional official loadouts were omitted only because of the prompt-size limit. Their loadout must be treated as unresolved, not assumed.`
      if (used + omitted.length + 1 <= maxCharacters) {
        lines.push(omitted)
        used += omitted.length + 1
      }
    }
  }
  return lines.join('\n')
}

export function rulesModelSearchTerms(resolution) {
  if (!resolution?.models?.length) return []
  const terms = []
  for (const model of resolution.models) {
    const variants = referenceProfiles(model)
    for (const field of ['characteristics', 'skills', 'equipment']) terms.push(...intersection(variants.map((profile) => profile[field] || [])))
    const commonWeapons = intersection(variants.map((profile) => profile.weapons || []))
    terms.push(...commonWeapons)
    for (const profile of variants) for (const value of [...profile.skills, ...profile.equipment, ...profile.weapons]) {
      if (containsNormalized(resolution.normalizedQuestion, value)) terms.push(value)
    }
  }
  return uniqueByNormalized(terms).filter((term) => normalizeModelText(term).length >= 3).slice(0, 40)
}

export function publicRulesModelResolution(resolution) {
  if (!resolution?.models?.length) return undefined
  return {
    source: resolution.source,
    datasetId: resolution.datasetId,
    models: resolution.models.map((model) => ({
      name: model.displayName,
      matchedAs: model.matchedAlias,
      variantCount: model.variantCount,
      loadoutCount: model.loadoutCount,
      formProfileCount: model.formProfileCount,
      exactProfileCount: model.exactProfileCount,
      sharedStats: sharedStats(referenceProfiles(model)),
      commonSkills: intersection(referenceProfiles(model).map((profile) => profile.skills || [])).slice(0, 8),
      commonEquipment: intersection(referenceProfiles(model).map((profile) => profile.equipment || [])).slice(0, 6),
    })),
  }
}

function buildOfficialRulesProfiles(capture) {
  const result = []
  for (const payload of capture.payloads || []) {
    const sectorialId = Number(payload.sectorialId ?? String(payload.url || '').split('/').filter(Boolean).at(-1))
    const names = {
      skills: indexNames([...(capture.metadata?.skills || []), ...(payload.filters?.skills || [])]),
      equipment: indexNames([...(capture.metadata?.equips || []), ...(payload.filters?.equip || [])]),
      chars: indexNames([...(payload.filters?.chars || [])]),
      extras: indexNames([...(capture.metadata?.extras || []), ...(payload.filters?.extras || [])]),
      types: indexNames([...(payload.filters?.type || [])]),
      weapons: indexWeaponNames([...(capture.metadata?.weapons || []), ...(payload.filters?.weapons || [])]),
    }
    for (const unit of payload.units || []) {
      if (!isInLiveArmyRoster(sectorialId, unit.slug, unit)) continue
      const included = includedMobilityOptions(unit)
      for (const group of unit.profileGroups || []) for (const option of group.options || []) {
        if (option.disabled && !included.has(`${group.id}:${option.id}`)) continue
        const physicalProfiles = group.profiles?.length ? group.profiles : [{}]
        for (const [physicalIndex, profile] of physicalProfiles.entries()) result.push(buildRulesProfile({ payload, sectorialId, unit, group, option, profile, physicalIndex, names }))
      }
    }
  }
  return result
}

function buildRulesProfile({ payload, sectorialId, unit, group, option, profile: physical, physicalIndex, names }) {
  const movement = officialMovementInches(physical.move ?? unit.move)
  const characteristics = resolveNamedReferences([
    ...(unit.chars || []), ...(group.chars || []), ...(physical.chars || []), ...(option.chars || []),
  ], names.chars, names.extras)
  const skills = resolveNamedReferences([
    ...(unit.skills || []), ...(group.skills || []), ...(physical.skills || []), ...(option.skills || []),
  ], names.skills, names.extras)
  const equipment = resolveNamedReferences([
    ...(unit.equipment || unit.equip || []), ...(group.equipment || group.equip || []),
    ...(physical.equipment || physical.equip || []), ...(option.equipment || option.equip || []),
  ], names.equipment, names.extras)
  const references = [...(physical.weapons || []), ...(option.weapons || [])]
  const weapons = uniqueByNormalized(references.flatMap((reference) => {
    const modifiers = extraNames(reference, names.extras)
    return (names.weapons.get(Number(reference.id)) || [reference.name]).filter(Boolean).map((name) => appendModifiers(name, modifiers))
  }))
  const rawAliases = {
    unit: uniqueStrings([unit.isc, unit.name, unit.iscAbbr, String(unit.slug || '').replace(/-/g, ' ')]),
    specific: uniqueStrings([group.isc, physical.name, option.name]),
  }
  const unitName = cleanDisplay(unit.isc || unit.name || 'Unknown official unit')
  const optionName = cleanDisplay(option.name || physical.name || group.isc || unitName)
  const structure = (physical.str ?? unit.str) === true
  const durability = stat(physical, unit, 'w') ?? stat(physical, unit, 'vitality') ?? 1
  const id = `${sectorialId}:${unit.id}:${group.id}:${option.id}:${physical.id ?? 1}`
  return {
    id,
    sectorialId,
    unitId: Number(unit.id),
    groupId: Number(group.id),
    optionId: Number(option.id),
    profileId: Number(physical.id ?? 1),
    loadoutId: `${unit.id}:${group.id}:${option.id}`,
    physicalIndex,
    isInitialForm: physicalIndex === 0,
    canonicalId: `${unit.id}:${group.id}:${option.id}:${physical.id ?? 1}`,
    name: [unit.name || unit.isc, option.name || physical.name].filter(Boolean).join(' — '),
    unitName,
    profileName: optionName,
    groupName: cleanDisplay(group.isc || ''),
    physicalName: cleanDisplay(physical.name || ''),
    movement,
    silhouette: finiteNumber(physical.s ?? unit.s),
    bs: stat(physical, unit, 'bs'),
    cc: stat(physical, unit, 'cc'),
    wip: stat(physical, unit, 'wip'),
    ph: stat(physical, unit, 'ph'),
    arm: stat(physical, unit, 'arm'),
    bts: stat(physical, unit, 'bts'),
    vitality: structure ? null : durability,
    structure: structure ? durability : (typeof physical.str === 'number' ? physical.str : stat(physical, unit, 'structure')),
    troopType: names.types.get(Number(physical.type ?? unit.type)) || null,
    points: finiteNumber(option.points),
    swc: option.swc == null || option.swc === '' ? null : String(option.swc),
    orders: (option.orders || []).map((order) => `${order.type}${Number(order.total) > 1 ? ` ×${order.total}` : ''}`),
    characteristics,
    skills,
    equipment,
    weapons,
    sectorialIds: [Number(sectorialId)],
    payloadVersion: payload.version || null,
    source: { kind: 'official-army', payloadVersion: payload.version || null },
    rawAliases,
  }
}

function buildAliasIndex(profiles) {
  const working = new Map()
  const add = (value, profile, priority) => {
    const alias = normalizeModelText(value)
    if (!validAlias(alias)) return
    if (!working.has(alias)) working.set(alias, new Map())
    const priorities = working.get(alias)
    priorities.set(profile.id, Math.max(priority, priorities.get(profile.id) || 0))
  }
  for (const profile of profiles) {
    for (const value of profile.rawAliases.specific) {
      add(value, profile, 3)
      // A base name must keep every official sibling loadout. For example,
      // “Léi Gōng” covers both LÉI GŌNG and LÉI GŌNG FTO, while the longer
      // “Léi Gōng FTO” alias still selects only the FTO profile.
      add(stripProfileQualifier(value), profile, 3)
    }
    for (const value of profile.rawAliases.unit) add(value, profile, 1)
    const primary = primaryModelName(profile.unitName)
    const specific = profile.rawAliases.specific.map(normalizeModelText)
    if (specific.some((value) => sameModelFamily(value, normalizeModelText(primary)))) add(primary, profile, 2)
  }
  const aliases = new Map()
  for (const [alias, priorities] of working) {
    const maximum = Math.max(...priorities.values())
    aliases.set(alias, { alias, exactProfileIds: new Set([...priorities].filter(([, priority]) => priority === maximum).map(([id]) => id)) })
  }
  return aliases
}

function buildMatch(alias, exactProfiles, variants, start, end) {
  const unitNames = uniqueStrings(variants.map((profile) => profile.unitName))
  const loadouts = groupLoadouts(variants)
  return {
    start,
    end,
    matchedAlias: alias,
    displayName: unitNames.length === 1 ? unitNames[0] : titleFromAlias(alias),
    exactProfileCount: exactProfiles.length,
    variantCount: loadouts.length,
    loadoutCount: loadouts.length,
    formProfileCount: variants.length,
    loadouts,
    variants,
  }
}

function groupLoadouts(variants) {
  const grouped = new Map()
  for (const profile of variants) {
    const id = profile.loadoutId || `${profile.unitId}:${profile.groupId}:${profile.optionId}`
    if (!grouped.has(id)) grouped.set(id, [])
    grouped.get(id).push(profile)
  }
  return [...grouped.entries()].map(([id, profiles]) => {
    const forms = [...profiles].sort((left, right) => left.physicalIndex - right.physicalIndex || left.profileId - right.profileId || left.canonicalId.localeCompare(right.canonicalId))
    const initialForm = forms.find((profile) => profile.isInitialForm) || forms[0]
    return { id, initialForm, alternateForms: forms.filter((profile) => profile !== initialForm), forms }
  }).sort((left, right) => (left.initialForm.points ?? 999) - (right.initialForm.points ?? 999) || left.initialForm.profileName.localeCompare(right.initialForm.profileName) || left.id.localeCompare(right.id))
}

function referenceProfiles(model) {
  return model?.loadouts?.length ? model.loadouts.map((loadout) => loadout.initialForm).filter(Boolean) : model?.variants || []
}

function dedupeCanonicalProfiles(profiles) {
  const canonical = new Map()
  for (const profile of profiles) {
    if (!canonical.has(profile.canonicalId)) canonical.set(profile.canonicalId, { ...profile, sectorialIds: [] })
    const current = canonical.get(profile.canonicalId)
    current.sectorialIds = [...new Set([...current.sectorialIds, ...profile.sectorialIds])].sort((a, b) => a - b)
  }
  return [...canonical.values()].sort((a, b) => (a.points ?? 999) - (b.points ?? 999) || a.profileName.localeCompare(b.profileName) || a.canonicalId.localeCompare(b.canonicalId))
}

function indexWeaponNames(records = []) {
  const result = new Map()
  for (const record of records) {
    if (['EQUIPMENT', 'SKILL'].includes(String(record.type || '').toUpperCase()) || !record.name) continue
    result.set(Number(record.id), uniqueStrings([...(result.get(Number(record.id)) || []), record.name]))
  }
  return result
}

function resolveNamedReferences(references, names, extras) {
  return uniqueByNormalized(references.map((reference) => {
    if (typeof reference === 'string') return reference
    const id = typeof reference === 'number' ? reference : reference.id
    const name = names.get(Number(id)) || reference?.name
    return name ? appendTraitModifiers(name, extraNames(reference, extras)) : null
  }).filter(Boolean))
}

function formatPromptProfile(profile) {
  const stats = [
    profile.movement ? `MOV ${profile.movement.join('-')}”` : null,
    profile.silhouette != null ? `S ${profile.silhouette}` : null,
    ...[['CC', profile.cc], ['BS', profile.bs], ['PH', profile.ph], ['WIP', profile.wip], ['ARM', profile.arm], ['BTS', profile.bts]].map(([name, value]) => value == null ? null : `${name} ${value}`),
    profile.vitality != null ? `W ${profile.vitality}` : null,
    profile.structure != null ? `STR ${profile.structure}` : null,
  ].filter(Boolean).join(', ')
  return [
    `${profile.unitName} — ${profile.profileName}`,
    profile.points != null ? `${profile.points} pts` : null,
    profile.swc != null ? `${profile.swc} SWC` : null,
    stats,
    profile.characteristics.length ? `Characteristics: ${profile.characteristics.join(', ')}` : null,
    profile.skills.length ? `Skills: ${profile.skills.join(', ')}` : null,
    profile.equipment.length ? `Equipment: ${profile.equipment.join(', ')}` : null,
    profile.weapons.length ? `Weapons: ${profile.weapons.join(', ')}` : null,
  ].filter(Boolean).join('; ')
}

function sharedStats(variants) {
  const fields = [
    ['MOV', (profile) => profile.movement?.join('–')], ['S', (profile) => profile.silhouette],
    ['CC', (profile) => profile.cc], ['BS', (profile) => profile.bs], ['PH', (profile) => profile.ph],
    ['WIP', (profile) => profile.wip], ['ARM', (profile) => profile.arm], ['BTS', (profile) => profile.bts],
    ['W', (profile) => profile.vitality], ['STR', (profile) => profile.structure],
  ]
  return fields.flatMap(([name, getter]) => {
    const values = [...new Set(variants.map(getter).filter((value) => value != null))]
    return values.length === 1 ? [`${name} ${values[0]}`] : []
  })
}

function intersection(lists) {
  if (!lists.length) return []
  const [first, ...rest] = lists.map((list) => uniqueByNormalized(list))
  return first.filter((value) => rest.every((list) => list.some((candidate) => normalizeModelText(candidate) === normalizeModelText(value))))
}

function extraNames(reference, extras) {
  const ids = reference?.extra ?? reference?.extras ?? []
  return (Array.isArray(ids) ? ids : [ids]).map((id) => extras.get(Number(id))).filter(Boolean)
}

function appendModifiers(name, modifiers) { return modifiers.length ? `${cleanDisplay(name)} (${modifiers.join(', ')})` : cleanDisplay(name) }
function appendTraitModifiers(name, modifiers) { return [cleanDisplay(name), ...modifiers].filter(Boolean).join(' ') }
function indexNames(values = []) { return new Map(values.map((value) => [Number(value.id), cleanDisplay(value.name)])) }
function finiteNumber(value) { return value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value) }
function stat(profile, unit, key) { const value = profile?.[key] ?? unit?.[key]; return value == null || value === '' ? null : Number(value) }
function cleanDisplay(value) { return String(value || '').replace(/\s+/g, ' ').trim() }
function uniqueStrings(values = []) { return [...new Set(values.map(cleanDisplay).filter(Boolean))] }
function uniqueByNormalized(values = []) { return [...new Map(values.map((value) => [normalizeModelText(value), cleanDisplay(value)]).filter(([key]) => key)).values()] }
function tokenCount(value) { return String(value || '').split(' ').filter(Boolean).length }
function containsNormalized(haystack, needle) { const value = normalizeModelText(needle); return value && (` ${haystack} `).includes(` ${value} `) }
function isTokenBoundary(value, start, end) { return (start === 0 || value[start - 1] === ' ') && (end === value.length || value[end] === ' ') }
function isCredibleModelMention(rawQuestion, normalizedQuestion, alias, start, end) {
  if (tokenCount(alias) > 1 || !CONTEXTUAL_SINGLE_ALIASES.has(alias)) return true
  const titleCaseMention = new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegex(titleFromAlias(alias))}(?=$|[^A-Za-z0-9])`).test(String(rawQuestion || ''))
  if (titleCaseMention && !STRICT_CONTEXT_ALIASES.has(alias)) return true
  const before = normalizedQuestion.slice(0, start).trim().split(' ').filter(Boolean).at(-1)
  const after = normalizedQuestion.slice(end).trim().split(' ').filter(Boolean)[0]
  return ['model', 'trooper', 'unit', 'profile', 'named', 'called'].includes(before)
    || ['model', 'trooper', 'unit', 'profile'].includes(after)
    || MODEL_ACTION_WORDS.has(after)
}
function validAlias(alias) { return alias.length >= 3 && !/^(?:trooper|model|unit|profile|hacker|engineer|doctor|paramedic|lieutenant|forward observer)$/.test(alias) }
function primaryModelName(value) { return cleanDisplay(String(value || '').split(/[,.;]/)[0]) }
function stripProfileQualifier(value) { return cleanDisplay(String(value || '').replace(/\b(?:FTO|REINF(?:ORCEMENTS?)?|REINFORCEMENTS?)\b[.\s-]*/gi, ' ')) }
function sameModelFamily(specific, primary) {
  if (!specific || !primary) return false
  const singular = (value) => value.replace(/s$/, '')
  return specific === primary || specific.startsWith(`${primary} `) || singular(specific) === singular(primary) || singular(specific).startsWith(`${singular(primary)} `)
}
function titleFromAlias(alias) { return alias.replace(/\b\w/g, (character) => character.toUpperCase()) }
function escapeRegex(value) { return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function emptyResolution(catalog, question) { return { schemaVersion: MODEL_CONTEXT_SCHEMA, source: 'Official Infinity Army', datasetId: catalog?.datasetId, exactProfileCount: catalog?.exactProfileCount || 0, question: String(question || '').trim(), normalizedQuestion: '', models: [] } }

export function normalizeModelText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/[’']/g, '')
    .replace(/[−–—-]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
