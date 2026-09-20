export const TTS_PROFILE_CATALOG_SCHEMA = 'infinity-tts-profile-catalog-v1'

export function extractTtsWorkshopProfiles(save = {}) {
  const profiles = new Map()
  walkObjects(save.ObjectStates, (object) => {
    const parsed = parseTtsProfileObject(object)
    if (!parsed) return
    const existing = profiles.get(parsed.id)
    if (!existing || profileCompleteness(parsed) > profileCompleteness(existing)) profiles.set(parsed.id, parsed)
  })
  return [...profiles.values()].sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }))
}

export function parseTtsProfileObject(object = {}) {
  const description = String(object.Description || '')
  if (!description.includes('---------Attributes-------') || !description.includes('----------Weapons---------')) return null
  const codes = [...description.matchAll(/\[([0-9a-f]{6})\]\[-\]/gi)].map((match) => Number.parseInt(match[1], 16))
  if (codes.length < 5) return null
  const [sectorialId, unitId, groupId, profileId, optionId] = codes.slice(-5)
  const attributes = Object.fromEntries([...description.matchAll(/\[b\](MOV|CC|BS|PH|WIP|ARM|BTS)\[\/b\]:\s*([^\r\n]+)/gi)].map((match) => [match[1].toLowerCase(), match[1].toUpperCase() === 'MOV' ? parseMovement(match[2]) : parseStat(match[2])]))
  const vitality = sectionStat(description, 'V')
  const structure = sectionStat(description, 'STR')
  const weapons = splitItems(section(description, 'Weapons', ['Equipment', 'Skills'])).map(parseWeaponLabel)
  if (!weapons.length) return null
  return {
    id: `${sectorialId}:${unitId}:${groupId}:${optionId}:${profileId}`,
    sectorialId,
    unitId,
    groupId,
    optionId,
    profileId,
    name: stripFormatting(object.Nickname || '').trim(),
    ...attributes,
    vitality,
    structure,
    weapons,
    equipment: splitItems(section(description, 'Equipment', ['Skills'])),
    skills: splitItems(section(description, 'Skills', [])),
  }
}

export function indexTtsWorkshopProfiles(profiles = []) {
  return new Map(profiles.map((profile) => [String(profile.id), profile]))
}

function walkObjects(value, visit) {
  if (!value) return
  if (Array.isArray(value)) return value.forEach((item) => walkObjects(item, visit))
  if (typeof value !== 'object') return
  visit(value)
  walkObjects(value.ContainedObjects, visit)
}

function section(description, heading, followingHeadings) {
  const start = description.search(new RegExp(`-+${heading}\\s*-+`, 'i'))
  if (start < 0) return ''
  const contentStart = description.indexOf('\n', start)
  if (contentStart < 0) return ''
  const tail = description.slice(contentStart + 1)
  const ends = followingHeadings.map((next) => tail.search(new RegExp(`-+${next}\\s*-+`, 'i'))).filter((index) => index >= 0)
  return tail.slice(0, ends.length ? Math.min(...ends) : undefined)
}

function splitItems(value) {
  return stripFormatting(value).split('●').map((item) => item.trim()).filter(Boolean)
}

function parseWeaponLabel(label) {
  const modifiers = [...label.matchAll(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].map((match) => match[1].trim()).filter(Boolean)
  const name = label.replace(/\([^()]*\)/g, '').replace(/\s+/g, ' ').trim()
  return { name, modifiers }
}

function sectionStat(description, label) {
  const match = description.match(new RegExp(`\\[B\\]${label}\\[\\/B\\]:\\s*([^\\r\\n]+)`, 'i'))
  return match ? parseStat(match[1]) : null
}

function parseStat(value) {
  const number = Number(String(value).replace(/\[[^\]]*\]/g, '').trim())
  return Number.isFinite(number) ? number : null
}

// Workshop profile descriptions express MOV as two values in inches.
export function parseMovement(value) {
  const text = String(value ?? '').replace(/\[[^\]]*\]/g, '').trim()
  const match = text.match(/^(\d+(?:\.\d+)?)\s*["″]?\s*[-–—]\s*(\d+(?:\.\d+)?)\s*["″]?$/)
  return match ? [Number(match[1]), Number(match[2])] : null
}

function stripFormatting(value) {
  return String(value || '').replace(/\[[^\]]*\]/g, '').replace(/\r/g, '').replace(/\s+/g, ' ')
}

function profileCompleteness(profile) {
  return profile.weapons.length * 10 + profile.skills.length + profile.equipment.length
}
