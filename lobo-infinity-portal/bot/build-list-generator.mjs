import { encodeArmyCode } from '../scripts/infinity-army-encode.mjs'
import { decodeArmyCode } from '../scripts/infinity-army-decode.mjs'
import { validateInfListLegality } from './inf-list-legality.mjs'
import { lookupMobility } from './mobility-lookup.mjs'

const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const token = value => normalize(value).replace(/\s/g, '')
const roleNames = /\b(hacker|forward observer|engineer|doctor|paramedic|specialist operative|chain of command)\b/i
const gradeRank = grade => ({ S: 5, A: 4, B: 3, C: 2, D: 1, F: 0 })[String(grade || '').toUpperCase()] ?? 0

export class ListBuilderError extends Error {}

export function resolveRequiredProfile(profiles, name) {
  const query = token(name)
  if (!query) return null
  return profiles.map(profile => {
    const [slug, unit, option] = [profile.slug, profile.unitName, profile.optionName].map(token)
    const priority = slug === query ? 0 : unit === query ? 1 : option === query ? 2
      : [slug, unit, option].some(value => value.includes(query)) ? 3 : Infinity
    return { profile, priority }
  }).filter(item => Number.isFinite(item.priority))
    .sort((a, b) => a.priority - b.priority
      || Number(b.profile.groupId === 0) - Number(a.profile.groupId === 0)
      || b.profile.gunfighter - a.profile.gunfighter || a.profile.points - b.profile.points)[0]?.profile || null
}

export function availableProfiles({ payload, metadata, sectorialId, rosterSlugs, gunfighterCatalog, aroCatalog, closeCombatCatalog, mobilityCatalog }) {
  if (!Array.isArray(payload?.units) || !Array.isArray(payload?.fireteamChart?.teams) || !Array.isArray(metadata?.skills)) {
    throw new ListBuilderError('Current official Army profiles and Fireteam chart are unavailable.')
  }
  if (!rosterSlugs?.length) throw new ListBuilderError('This faction does not yet have a verified Army roster.')
  const roster = new Set(rosterSlugs)
  const skillNames = new Map(metadata.skills.map(item => [Number(item.id), item.name]))
  const equipmentNames = new Map((metadata.equips || []).map(item => [Number(item.id), item.name]))
  const weaponNames = new Map((metadata.weapons || []).map(item => [Number(item.id), item.name]))
  const surfaceId = Number(payload.filters?.chars?.find(item => item.name === 'Surface')?.id)
  const deepspaceId = Number(payload.filters?.chars?.find(item => item.name === 'Deepspace')?.id)
  const ratings = new Map((gunfighterCatalog?.entries || []).filter(item => Number(item.sectorialId) === sectorialId)
    .map(item => [item.key, item.result?.states || []]))
  const aroRatings = new Map((aroCatalog?.entries || []).filter(item => Number(item.sectorialId) === sectorialId)
    .map(item => [item.key, item.result?.states || []]))
  const ccRatings = new Map((closeCombatCatalog?.entries || []).flatMap(item => (item.aliases || []).filter(alias => Number(alias.sectorialId) === sectorialId)
    .map(alias => [alias.key, item])))
  const result = []
  const add = (unit, group, base, choice, groupId, includes = []) => {
    const points = Number(choice.points)
    const ava = String(base.ava).toUpperCase() === 'T' ? Infinity : Number(base.ava)
    const swcString = String(choice.swc ?? '')
    const swcAmount = Number(swcString)
    const slots = Number(choice.minis || 1)
    if (!Number.isFinite(points) || points < 1 || !Number.isFinite(swcAmount) || !Number.isInteger(slots) || slots < 1 || slots > 2 || ava < 1) return
    const includedOptions = (groupId === 0 ? includes : []).flatMap(include => (unit.profileGroups || []).filter(g => Number(g.id) === Number(include.group))
      .flatMap(g => (g.options || []).filter(option => Number(option.id) === Number(include.option))))
    const skills = [...(base.skills || []), ...(choice.skills || []), ...includedOptions.flatMap(o => o.skills || [])]
      .map(ref => skillNames.get(Number(ref.id)) || '').filter(Boolean)
    const equipment = [...(base.equip || []), ...(choice.equip || []), ...includedOptions.flatMap(o => o.equip || [])]
      .map(ref => equipmentNames.get(Number(ref.id)) || '').filter(Boolean)
    const weapons = [...(base.weapons || []), ...(choice.weapons || []), ...includedOptions.flatMap(o => o.weapons || [])]
      .map(ref => weaponNames.get(Number(ref.id)) || '').filter(Boolean)
    const roleText = [...skills, ...equipment.filter(name => /hacking device/i.test(name))].join(' ')
    const toolkit = [...skills, ...equipment, ...weapons].join(' ')
    const canAro = weapons.some(weapon => !/\bcc weapon\b/i.test(weapon))
      || [...skills, ...equipment].some(value => /\bpheroware\b/i.test(value))
    const lieutenant = (choice.orders || []).some(order => String(order.type).toUpperCase() === 'LIEUTENANT')
    const orderCount = type => (choice.orders || []).filter(order => String(order.type).toUpperCase() === type)
      .reduce((sum, order) => sum + Number(order.total || 0), 0)
    const side = (base.chars || []).includes(surfaceId) ? 'Surface'
      : (base.chars || []).includes(deepspaceId) ? 'Deepspace' : null
    const primaryWeapon = weapons.find(weapon => /rifle|shotgun|machine gun|spitfire|sniper|feuerbach|thunderbolt|launcher|smg|submachine/i.test(weapon)) || weapons[0]
    const key = `${sectorialId}:${unit.id}:${groupId}:${choice.id}:1`
    const shooting = ratings.get(key) || []
    const aroResults = aroRatings.get(key) || []
    const normalShooting = shooting.find(state => state.id === 'normal')
    const linkedShooting = shooting.find(state => state.id === 'fireteam')
    const normalAro = aroResults.find(state => state.id === 'normal')
    const linkedAro = aroResults.find(state => state.id === 'fireteam')
    result.push({
      id: key, unitId: Number(unit.id), unitName: unit.isc || unit.name, slug: unit.slug,
      groupId, optionId: Number(choice.id), optionName: choice.name, points,
      swc: swcString.startsWith('+') ? 0 : swcAmount,
      swcBonus: swcString.startsWith('+') ? swcAmount : 0,
      ava, avaKey: `${unit.id}:${group.id}:${base.id}`, slots,
      lieutenant, side,
      regular: (choice.orders || []).some(order => String(order.type).toUpperCase() === 'REGULAR'),
      startsOffTable: skills.some(skill => /\b(combat jump|parachutist|hidden deployment)\b/i.test(skill)),
      tacticalOrders: orderCount('TACTICAL') || (skills.some(skill => /\btactical awareness\b/i.test(skill)) ? 1 : 0),
      lieutenantOrders: lieutenant ? orderCount('LIEUTENANT') || 1 : 0,
      nco: skills.some(skill => /^NCO$/i.test(skill)),
      specialist: roleNames.test(roleText),
      fireteamEligible: slots === 1 && !(base.chars || []).includes(27)
        && !skills.some(skill => /\b(infiltration|combat jump|parachutist|peripheral)\b/i.test(skill)),
      engineer: /\bengineer\b/i.test(roleText),
      repairable: Boolean(base.str),
      hacker: /\bhacker\b|hacking device/i.test(roleText),
      smoke: /smoke|eclipse|disco baller|mirroball/i.test(toolkit),
      repeater: /repeater|pitcher|fastpanda/i.test(toolkit),
      aro: /sniper|feuerbach|missile launcher|rocket launcher|flash pulse|panzerfaust|thunderbolt/i.test(toolkit),
      closeThreat: /shotgun|flamethrower|chain rifle|submachine gun/i.test(toolkit),
      defensive: /camouflage|minelayer|decoy/i.test(roleText),
      gunfighter: Number(normalShooting?.rating || 0),
      gunfighterGrade: normalShooting?.grade || '',
      linkedGunfighter: Number(linkedShooting?.rating || 0),
      linkedGunfighterGrade: linkedShooting?.grade || '',
      aroRating: canAro ? Number(normalAro?.rating || 0) : 0,
      aroGrade: canAro ? normalAro?.grade || '' : '',
      linkedAroRating: canAro ? Number(linkedAro?.rating || 0) : 0,
      linkedAroGrade: canAro ? linkedAro?.grade || '' : '',
      ccRating: Number(ccRatings.get(key)?.rating || 0),
      ccGrade: ccRatings.get(key)?.grade || '',
      mobility: Number(lookupMobility(mobilityCatalog, key)?.score || 0),
      label: `${choice.name}${primaryWeapon ? ` · ${primaryWeapon}` : ''}${lieutenant ? ' · Lieutenant' : ''}${skills.filter(skill => roleNames.test(skill)).length ? ` · ${skills.filter(skill => roleNames.test(skill)).join(', ')}` : ''}`,
    })
  }
  for (const unit of payload.units) {
    if (!roster.has(unit.slug) || !(unit.factions || []).includes(sectorialId)) continue
    const group = (unit.profileGroups || []).find(group => Number(group.id) === 1 && group.profiles?.length === 1 && Number(group.profiles[0].id) === 1)
    const base = group?.profiles[0]
    if (!base) continue
    for (const choice of group.options || []) if (choice.disabled !== true) add(unit, group, base, choice, Number(group.id))
    for (const choice of unit.options || []) {
      if (choice.disabled === true || !(choice.includes || []).some(include => Number(include.group) === Number(group.id))) continue
      add(unit, group, base, choice, 0, choice.includes)
    }
  }
  return result
}

export function buildArmyListOptions({ payload, metadata, sectorialId, rosterSlugs, gunfighterCatalog,
  aroCatalog, closeCombatCatalog, mobilityCatalog, teamTypeEvidence, mission, mustInclude = [], points = 300, count = 3 } = {}) {
  const faction = metadata?.factions?.find(item => Number(item.id) === Number(sectorialId))
  if (!faction) throw new ListBuilderError('Unknown Infinity Army faction.')
  if (!String(mission || '').trim() || String(mission).length > 60) throw new ListBuilderError('Enter a mission name of 60 characters or fewer.')
  if (!Number.isInteger(points) || points < 100 || points > 400 || points % 50 !== 0) {
    throw new ListBuilderError('Choose a points limit from 100 to 400 in steps of 50.')
  }
  const profiles = availableProfiles({ payload, metadata, sectorialId: Number(sectorialId), rosterSlugs,
    gunfighterCatalog, aroCatalog, closeCombatCatalog, mobilityCatalog })
  const constraints = { payload, points, mission: String(mission || '').trim(), sectorialId: Number(sectorialId) }
  const forced = (Array.isArray(mustInclude) ? mustInclude : String(mustInclude).split(','))
    .map(String).map(value => value.trim()).filter(Boolean).map(name => {
      const match = resolveRequiredProfile(profiles, name)
      if (!match) throw new ListBuilderError(`No selectable ${faction.name} profile matches “${name}”.`)
      return match
    })
  const forcedKeys = new Set(forced.map(item => item.id))
  if (forcedKeys.size !== forced.length) throw new ListBuilderError('The same required profile was specified twice.')
  const side = forced.some(item => item.slug === 'iguana-squadron') ? 'Surface'
    : forced.some(item => item.slug === 'gator-squadron') ? 'Deepspace' : null
  constraints.side = side
  const teamPreference = teamTypeEvidence?.preferences?.[Number(sectorialId)] || teamTypeEvidence?.preferences?.global || {}
  const seeds = starterTeams(profiles, payload.fireteamChart, constraints, side, teamPreference)
  const options = []
  const seen = new Set()
  for (let attempt = 0; attempt < 48 && options.length < 48; attempt++) {
    const selected = []
    const seed = seeds[attempt % Math.max(1, seeds.length)]
    const buildConstraints = { ...constraints, side: side || (/\bSurface\b/i.test(seed?.name || '') ? 'Surface'
      : /\bDeepspace\b/i.test(seed?.name || '') ? 'Deepspace' : null) }
    for (const item of forced) {
      if (!canAdd(selected, item, 1, buildConstraints)) throw new ListBuilderError('Required profiles conflict with the selected Army limits or Surface/Deepspace restriction.')
      selected.push({ ...item, combatGroup: 1 })
    }
    if (seed) for (const item of seed.members) {
      if (canAdd(selected, item, 1, buildConstraints)) selected.push({ ...item, combatGroup: 1 })
    }
    const lieutenant = profiles.filter(item => item.lieutenant && !selected.some(entry => entry.lieutenant) && canAdd(selected, item, 1, buildConstraints))
      .sort((a, b) => (a.points - b.points) || b.regular - a.regular)[attempt % 3 === 2 ? 1 : 0]
    if (lieutenant) selected.push({ ...lieutenant, combatGroup: 1 })
    if (!selected.some(item => item.lieutenant)) continue

    const targetSpecialists = /hardlock/i.test(mission) ? 4 : 3
    for (let i = 0; i < targetSpecialists; i++) {
      if (selected.filter(item => item.specialist).length >= targetSpecialists) break
      const specialist = bestNext(profiles.filter(item => item.specialist), selected, buildConstraints, attempt, 'specialist')
      if (!specialist) break
      selected.push(specialist)
    }
    for (let i = 0; i < 15; i++) {
      const next = bestNext(profiles, selected, buildConstraints, attempt, 'general')
      if (!next) break
      selected.push(next)
    }
    const grouped = optimizeCombatGroups(selected, payload.fireteamChart, buildConstraints.side, teamPreference)
    const groups = [1, 2].map(index => ({ members: grouped.filter(item => item.combatGroup === index)
      .map(({ unitId, groupId, optionId }) => ({ unitId, groupId, optionId })) })).filter(group => group.members.length)
    const code = encodeArmyCode({ sectorialId: Number(sectorialId), sectorialSlug: faction.slug,
      listName: `Lobo ${mission || 'mission'} ${options.length + 1}`, maxPoints: points, combatGroups: groups })
    const decoded = decodeArmyCode(code)
    const legality = validateInfListLegality({ decoded, payload })
    if (legality.status !== 'legal') continue
    const signature = grouped.map(item => `${item.combatGroup}:${item.id}`).sort().join('|')
    if (seen.has(signature)) continue
    seen.add(signature)
    const fireteams = proposedFireteams(grouped, payload.fireteamChart, buildConstraints.side, teamPreference)
    const quality = roleCoverage(grouped, fireteams, mission)
    options.push({ code, url: `https://infinitytheuniverse.com/army/list/${encodeURIComponent(code)}`, profiles: grouped, fireteams,
      legality, mission, faction: faction.name, payloadVersion: payload.version, quality,
      specialistCount: grouped.filter(item => item.specialist).length,
      points: legality.totals.points, swc: legality.totals.swc,
      score: scoreList(grouped, fireteams, mission, points, teamPreference) })
  }
  if (!options.length) throw new ListBuilderError('I could not make a legal list with those required profiles and points.')
  const ranked = options.sort((a, b) => b.score - a.score)
  const fullEnough = ranked.filter(item => item.legality.totals.troopers >= 12
    && item.score >= ranked[0].score - 12)
  const candidates = fullEnough.length >= Math.min(3, count) ? fullEnough : ranked
  const complete = points >= 300 ? candidates.filter(item => item.quality.gunfighters >= 2
    && item.quality.cc >= 2 && item.quality.aro >= 2
    && item.quality.specialists >= item.quality.specialistTarget) : []
  const rolePool = complete.length ? complete : candidates
  // Prefer the fullest roster among similarly strong builds. A sparse list
  // can still win when adding bodies causes a marked loss in overall quality.
  const similarlyStrong = rolePool.filter(item => item.score >= rolePool[0].score - 6)
  const duoOrHaris = similarlyStrong.filter(item => item.fireteams.some(team =>
    (team.type === 'DUO' || team.type === 'HARIS') && team.level >= 2))
  const competitive = duoOrHaris.length ? duoOrHaris : similarlyStrong
  const pool = [...competitive].sort((a, b) => b.legality.totals.troopers - a.legality.totals.troopers
    || b.score - a.score)
  const chosen = []
  for (const option of pool) {
    const signature = option.fireteams.map(team => `${team.type}:${team.name}:${team.members.map(name => name.split(' · ')[0]).sort().join('+')}`).sort().join('|')
    if (chosen.length && chosen.some(item => item.teamSignature === signature)) continue
    chosen.push({ ...option, teamSignature: signature })
    if (chosen.length >= Math.min(3, count)) break
  }
  for (const option of [...pool, ...rolePool, ...candidates]) {
    if (chosen.length >= Math.min(3, count)) break
    if (!chosen.some(item => item.code === option.code)) chosen.push(option)
  }
  return chosen.map((option, index) => {
    const combatGroups = [1, 2].map(group => ({ members: option.profiles.filter(item => item.combatGroup === group)
      .map(({ unitId, groupId, optionId }) => ({ unitId, groupId, optionId })) })).filter(group => group.members.length)
    const code = encodeArmyCode({ sectorialId: Number(sectorialId), sectorialSlug: faction.slug,
      listName: `Lobo ${mission || 'mission'} ${index + 1}`, maxPoints: points, combatGroups })
    return { ...option, code, url: `https://infinitytheuniverse.com/army/list/${encodeURIComponent(code)}` }
  })
}

function canAdd(selected, profile, combatGroup, { points, payload, side: requiredSide }) {
  const side = requiredSide || selected.find(item => item.side)?.side
  if (profile.side && side && profile.side !== side) return false
  if (selected.reduce((n, item) => n + item.points, profile.points) > points) return false
  if (selected.reduce((n, item) => n + item.slots, profile.slots) > 15) return false
  if (selected.filter(item => item.combatGroup === combatGroup).reduce((n, item) => n + item.slots, profile.slots) > 10) return false
  if (profile.lieutenant && selected.some(item => item.lieutenant)) return false
  const swc = selected.reduce((n, item) => n + item.swc, profile.swc)
  const bonus = selected.reduce((n, item) => n + item.swcBonus, profile.swcBonus)
  if (swc > points / 50 + bonus) return false
  if (selected.filter(item => item.avaKey === profile.avaKey).length >= profile.ava) return false
  // These official relations describe mutually exclusive choices; ignore
  // relations for units not selectable in the current sectorial.
  for (const relation of payload.relations || []) {
    if (relation.group || !Number.isFinite(Number(relation.max))) continue
    const ids = (relation.units || []).map(unit => Number(unit.unit)).filter(Number.isInteger)
    if (ids.includes(profile.unitId) && selected.filter(item => ids.includes(item.unitId)).length >= Number(relation.max)) return false
  }
  return true
}

function bestNext(profiles, selected, constraints, attempt, mode) {
  const hasTag = selected.some(item => item.slug === 'iguana-squadron' || item.slug === 'gator-squadron')
  const specialists = selected.filter(item => item.specialist).length
  const engineers = selected.filter(item => item.engineer).length
  const count = selected.reduce((n, item) => n + item.slots, 0)
  const currentPoints = selected.reduce((n, item) => n + item.points, 0)
  const remaining = constraints.points - currentPoints
  const targetCount = attempt % 3 === 2 ? 12 : 15
  const currentSynergy = rosterSynergy(selected)
  const currentRedundancy = rosterRedundancy(selected)
  const currentQuality = rosterQuality(selected, [], constraints.mission, constraints.points)
  const candidates = []
  for (const item of profiles) {
    const group = selected.filter(profile => profile.combatGroup === 1).reduce((n, profile) => n + profile.slots, 0) + item.slots <= 10 ? 1 : 2
    if (!canAdd(selected, item, group, constraints)) continue
    if (item.lieutenant || item.slots > 1 && count > 8) continue
    const regular = item.regular ? 2.1 : 0.1
    const missionValue = item.specialist && specialists < (/hardlock/i.test(constraints.mission) ? 4 : 3) ? 5.5
      : item.specialist && specialists >= 5 ? -2.5 : item.specialist ? .5 : 0
    const engineer = hasTag && !engineers && item.engineer ? 3.5 : 0
    const qualityAro = item.aro && gradeRank(item.aroGrade) >= gradeRank('B')
    const firstAro = !selected.some(profile => profile.aro)
    const firstQualityAro = !selected.some(profile => profile.aro && gradeRank(profile.aroGrade) >= gradeRank('B'))
    const aroCoverage = constraints.points < 300
      ? item.aro && firstAro ? 2.5 + item.aroRating / 5 : 0
      : qualityAro && firstQualityAro ? 2.5 + item.aroRating / 5
        : item.aro && firstAro ? .8 + item.aroRating / 8 : 0
    const coverage = aroCoverage
      + (item.smoke && !selected.some(profile => profile.smoke) ? 1.8 : 0)
      + (item.defensive && !selected.some(profile => profile.defensive) ? 2 : 0)
      + (item.repeater && !selected.some(profile => profile.repeater) ? 1 : 0)
    const existing = selected.filter(profile => profile.unitId === item.unitId).length
    const variation = ((hash(item.id + ':' + attempt * 701) % 100) / 100 - .5) * (attempt ? 1.3 : .15)
    const spend = count >= 12 ? Math.min(item.points, remaining) * .055 : Math.min(item.points, 45) * .025
    // Most attempts reserve room for 15 troopers. Other attempts retain the
    // stronger expensive-profile builds for comparison in the final ranking.
    const affordable = targetCount === 15 && count < 15
      ? Math.max(0, item.points / item.slots - remaining / (15 - count)) * .3
      : count < 12 ? Math.max(0, item.points - remaining / Math.max(1, 14 - count) * 1.6) * .10 : 0
    const value = regular + missionValue + engineer + coverage + Math.min(5, item.gunfighter / 13)
      + (selected.some(profile => profile.ccRating > 10) ? 0 : item.ccRating / 14)
      + (item.specialist ? item.mobility / 80 : 0)
      + spend - item.points * .075 - existing * .35 - affordable + variation
      + (rosterSynergy([...selected, item]) - currentSynergy) * .9
      + (rosterQuality([...selected, item], [], constraints.mission, constraints.points) - currentQuality) * 1.2
      - (rosterRedundancy([...selected, item]) - currentRedundancy) * .8
    candidates.push({ ...item, combatGroup: group, value })
  }
  candidates.sort((a, b) => b.value - a.value || a.points - b.points)
  return mode === 'specialist' ? candidates.find(item => item.specialist) : candidates.find(item => item.value > -.5)
}

export function rosterSynergy(profiles) {
  const hackers = profiles.filter(item => item.hacker)
  const repeaters = profiles.filter(item => item.repeater)
  const externalRepeaters = repeaters.filter(repeater => hackers.some(hacker => hacker.unitId !== repeater.unitId))
  const engineer = profiles.some(item => item.engineer)
  const repairTargets = profiles.filter(item => item.repairable && !item.engineer)
  const specialists = new Set(profiles.filter(item => item.specialist).map(item => item.unitId)).size
  const network = hackers.some(hacker => repeaters.some(repeater => repeater !== hacker))
    ? 1.8 + Math.min(2, hackers.length) * .6
      + (externalRepeaters.length ? externalRepeaters : repeaters).map(item => .8 + Math.min(70, item.mobility || 0) / 120)
        .sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0)
      + (externalRepeaters.length ? .7 : 0)
    : 0
  const repairs = engineer && repairTargets.length
    ? 1.2 + Math.min(3, Math.max(...repairTargets.map(item => item.points)) / 18)
      + (repairTargets.length > 1 ? .7 : 0)
    : 0
  const smokeAttack = smokeAssaultPair(profiles) ? 2.5 : 0
  return network + repairs + smokeAttack
    + Math.min(3, specialists) * 1.2
}

function smokeAssaultPair(profiles) {
  for (const smoke of profiles) {
    if (!smoke.smoke) continue
    const assault = profiles.find(item => item !== smoke
      && (item.ccRating >= 25 || item.closeThreat && item.specialist))
    if (assault) return [smoke, assault]
  }
  return null
}

export function rosterRedundancy(profiles) {
  const counts = new Map()
  const units = new Map()
  for (const item of profiles) {
    const entry = counts.get(item.id) || { count: 0, points: item.points,
      gunfighter: item.gunfighter || 0, gunfighterGrade: item.gunfighterGrade || '', ccGrade: item.ccGrade || '' }
    entry.count++
    counts.set(item.id, entry)
    units.set(item.unitId, [...(units.get(item.unitId) || []), item.points])
  }
  const identical = [...counts.values()].reduce((sum, { count, points }) =>
    sum + Math.max(0, count - 1) * Math.max(0, points - 28) * .3
      + Math.max(0, count - 2) * (1.5 + Math.max(0, points - 18) * .3), 0)
  const repeatedRole = [...counts.values()].reduce((sum, item) => sum + Math.max(0, item.count - 1)
    * (item.points >= 20 && gradeRank(item.gunfighterGrade) >= gradeRank('B')
      ? 3 + Math.min(1.5, Math.max(0, item.gunfighter - 20) / 8)
      : item.points >= 20 && gradeRank(item.ccGrade) >= gradeRank('A') ? 1.5 : 0), 0)
  const expensiveUnitCopies = [...units.values()].reduce((sum, points) =>
    sum + points.sort((a, b) => b - a).slice(1)
      .reduce((extra, points) => extra + Math.max(0, points - 30) * .35, 0), 0)
  return identical + repeatedRole + expensiveUnitCopies
}

// Grade the physical models in the proposed teams, not just their unlinked
// profiles. Each gunfighter or ARO slot must be filled by a different model;
// a gunfighter may also satisfy a CC slot. Linked grades count only when the
// model belongs to a proposed Level 2+ team.
export function roleCoverage(profiles, fireteams = [], mission = '') {
  const linked = new Set()
  for (const team of fireteams) {
    if (team.level < 2) continue
    for (const label of team.members) {
      const index = profiles.findIndex((item, index) => !linked.has(index)
        && item.combatGroup === team.combatGroup && item.label === label)
      if (index >= 0) linked.add(index)
    }
  }
  const qualify = (normal, upgraded, index) => gradeRank(normal) >= gradeRank('A')
    || linked.has(index) && gradeRank(upgraded) >= gradeRank('A')
  const gunfighters = profiles.map((item, index) => index)
    .filter(index => qualify(profiles[index].gunfighterGrade, profiles[index].linkedGunfighterGrade, index))
  const aro = profiles.map((item, index) => index)
    .filter(index => qualify(profiles[index].aroGrade, profiles[index].linkedAroGrade, index))
  const gunChoices = [[], ...gunfighters.map(index => [index])]
  for (let i = 0; i < gunfighters.length; i++) {
    for (let j = i + 1; j < gunfighters.length; j++) gunChoices.push([gunfighters[i], gunfighters[j]])
  }
  let best = null
  for (const guns of gunChoices) {
    const remainingAro = aro.filter(index => !guns.includes(index))
    const defenders = remainingAro.length >= 2
      ? [remainingAro[0], remainingAro.find(index => profiles[index].unitId !== profiles[remainingAro[0]].unitId) ?? remainingAro[1]]
      : remainingAro
    const distinctGunfighters = new Set(guns.map(index => profiles[index].unitId)).size
    const distinctAro = new Set(defenders.map(index => profiles[index].unitId)).size
    const score = guns.length * 8 + defenders.length * 6
      + (distinctGunfighters >= 2 ? 2 : 0) + (distinctAro >= 2 ? 1.5 : 0)
    if (!best || score > best.score) best = { guns, defenders, distinctGunfighters, distinctAro, score }
  }
  const cc = profiles.filter(item => gradeRank(item.ccGrade) >= gradeRank('A'))
  const specialists = profiles.filter(item => item.specialist)
  const linkedRequired = (index, normalGrade) => linked.has(index) && gradeRank(normalGrade) < gradeRank('A')
  return { gunfighters: best.guns.length, aro: best.defenders.length, cc: cc.length,
    specialists: specialists.length, specialistTarget: /hardlock/i.test(mission) ? 4 : 3,
    distinctGunfighters: best.distinctGunfighters, distinctAro: best.distinctAro,
    linkedGunfighters: best.guns.filter(index => linkedRequired(index, profiles[index].gunfighterGrade)).length,
    linkedAro: best.defenders.filter(index => linkedRequired(index, profiles[index].aroGrade)).length }
}

export function rosterQuality(profiles, fireteams = [], mission = '', points = 300) {
  if (points < 300) return 0
  const quality = roleCoverage(profiles, fireteams, mission)
  return Math.min(2, quality.gunfighters) * 8 + Math.min(2, quality.cc) * 5
    + Math.min(2, quality.aro) * 6
    + (quality.distinctGunfighters >= 2 ? 2 : 0)
    + (quality.distinctAro >= 2 ? 1.5 : 0)
}

// Level 2 unlocks the linked benchmark. Higher purity still matters, but
// must not overwhelm the smaller teams' ability to do a job with fewer models.
export function fireteamUsefulness(team, members, teamPreference = {}) {
  if (team.level < 2) return 0
  const ranked = (item, role, linkedRole) => Math.max(gradeRank(item[role]), gradeRank(item[linkedRole]))
  const shooters = members.filter(item => ranked(item, 'gunfighterGrade', 'linkedGunfighterGrade') >= gradeRank('A')).length
  const defenders = members.filter(item => ranked(item, 'aroGrade', 'linkedAroGrade') >= gradeRank('A')).length
  const fighters = members.filter(item => gradeRank(item.ccGrade) >= gradeRank('A')).length
  const specialists = members.filter(item => item.specialist).length
  const upgrades = members.filter(item => (
    gradeRank(item.gunfighterGrade) < gradeRank('A')
      && gradeRank(item.linkedGunfighterGrade) >= gradeRank('A')
  ) || (
    gradeRank(item.aroGrade) < gradeRank('A') && gradeRank(item.linkedAroGrade) >= gradeRank('A')
  )).length
  const useful = shooters + defenders + fighters + specialists > 0
  const compact = useful ? { DUO: 3, HARIS: 3.5, CORE: 0 }[team.type] || 0 : 0
  return 6 + Math.max(0, team.level - 2) * .65 + compact
    + Math.min(2, shooters) * 1.8 + Math.min(2, defenders) * 1.1
    + Math.min(2, fighters) * .55 + Math.min(2, specialists) * .6
    + Math.min(2, upgrades) * .5 + (teamPreference[team.type] || 0)
}

export function rosterConnections(profiles) {
  const connections = []
  const hacker = profiles.find(item => item.hacker && !item.repeater && profiles.some(other => other.repeater))
    || profiles.find(item => item.hacker && profiles.some(other => other !== item && other.repeater))
  const repeater = hacker && (profiles.find(item => item.repeater && item.unitId !== hacker.unitId)
    || profiles.find(item => item !== hacker && item.repeater))
  if (repeater) connections.push(`Hacking: ${hacker.optionName} + ${repeater.optionName} repeater`)
  const engineer = profiles.find(item => item.engineer)
  const target = engineer && profiles.filter(item => item !== engineer && item.repairable)
    .sort((a, b) => Number(b.combatGroup === engineer.combatGroup)
      - Number(a.combatGroup === engineer.combatGroup) || b.points - a.points)[0]
  if (target) connections.push(`Repairs: ${engineer.optionName} + ${target.optionName}`)
  const smoke = smokeAssaultPair(profiles)
  if (smoke) connections.push(`Smoke: ${smoke[0].optionName} + ${smoke[1].optionName}`)
  return connections
}

export function projectedRegularOrders(profiles, group) {
  return profiles.filter(item => item.combatGroup === group && item.regular && !item.startsOffTable).length
}

function actionPotential(item) {
  return Math.min(65, Math.max(0, item.gunfighter || 0)) / 16
    + (item.specialist ? 1.7 + Math.min(1, (item.mobility || 0) / 100) : 0)
    + Math.min(1.5, Math.max(0, item.ccRating || 0) / 24)
    + (item.hacker ? .4 : 0)
}

function groupActivity(members, teams, ncoOrders = 0) {
  let first = 0, second = 0, third = 0
  let orders = 0
  let tactical = 0, ncoWeight = 0
  const teamMembers = new Set(teams.flatMap(team => team.members))
  for (const item of members) {
    if (item.regular && !item.startsOffTable) orders++
    const action = actionPotential(item)
    const selfOrderWeight = Math.min(1, Math.max(.2, action / 3 + (teamMembers.has(item) ? .25 : 0)))
    tactical += (item.tacticalOrders || 0) * selfOrderWeight
    if (item.nco) ncoWeight = Math.max(ncoWeight, selfOrderWeight)
    if (action > first) { third = second; second = first; first = action }
    else if (action > second) { third = second; second = action }
    else if (action > third) third = action
  }
  const teamActivity = teams.reduce((sum, team) => sum + .6
    + (team.members.some(item => item.specialist) ? .6 : 0)
    + (team.members.some(item => item.gunfighter >= 25) ? .6 : 0), 0)
  const repairSupport = members.some(item => item.engineer) && members.some(item => item.repairable && !item.engineer)
    ? .5 + Math.min(1, Math.max(...members.filter(item => item.repairable).map(item => item.points)) / 40) : 0
  const activity = .35 + first + second * .65 + third * .3 + teamActivity + repairSupport
  // Tactical Awareness and NCO orders belong to their user (or their Fireteam
  // when leading it), so their contribution is weighted by that user's role.
  const usable = orders + tactical + ncoOrders * ncoWeight
  return { orders, activity, ncoWeight, utility: activity * Math.log1p(usable)
    - (orders < 3 ? Math.max(0, activity - 2) * (3 - orders) * .5 : 0) }
}

function groupPlacementScore(groups, teamGroups, lieutenantOrders) {
  const initial = groups.map((members, index) => groupActivity(members, teamGroups[index]))
  const possible = [initial[0].utility + initial[1].utility]
  for (const index of [0, 1]) {
    if (!initial[index].ncoWeight || !lieutenantOrders) continue
    possible.push(groupActivity(groups[index], teamGroups[index], lieutenantOrders).utility + initial[1 - index].utility)
  }
  return Math.max(...possible) + initial[0].activity * .04
}

export function optimizeCombatGroups(profiles, chart, side = null, teamPreference = {}) {
  const totalSlots = profiles.reduce((sum, item) => sum + item.slots, 0)
  if (totalSlots <= 10) return profiles
  const teams = proposedFireteams(profiles, chart, side, teamPreference)
  const lieutenantOrders = profiles.reduce((sum, item) => sum + (item.lieutenantOrders || 0), 0)
  const claimed = new Set()
  const blocks = []
  for (const team of teams) {
    const withinTeam = new Set()
    const indices = team.members.map(label => {
      const index = profiles.findIndex((item, index) => !claimed.has(index) && !withinTeam.has(index)
        && item.combatGroup === team.combatGroup && item.label === label)
      if (index !== -1) withinTeam.add(index)
      return index
    })
    if (indices.includes(-1)) continue
    indices.forEach(index => claimed.add(index))
    blocks.push({ indices, team })
  }
  profiles.forEach((item, index) => { if (!claimed.has(index)) blocks.push({ indices: [index], team: null }) })

  let best = null
  for (let mask = 1; mask < 2 ** blocks.length - 1; mask++) {
    const groups = [[], []], teamGroups = [[], []], slots = [0, 0]
    for (let index = 0; index < blocks.length; index++) {
      const group = mask & (1 << index) ? 0 : 1
      const block = blocks[index]
      for (const profileIndex of block.indices) {
        const member = profiles[profileIndex]
        groups[group].push(member)
        slots[group] += member.slots
      }
      if (block.team) teamGroups[group].push({ ...block.team, members: block.indices.map(i => profiles[i]) })
    }
    if (slots[0] > 10 || slots[1] > 10) continue
    const main = groupActivity(groups[0], teamGroups[0])
    const reserve = groupActivity(groups[1], teamGroups[1])
    if (main.orders < reserve.orders) continue
    const score = groupPlacementScore(groups, teamGroups, lieutenantOrders)
    if (!best || score > best.score + 1e-8) best = { mask, score }
  }
  if (!best) return profiles
  const assignment = new Map()
  blocks.forEach((block, index) => block.indices.forEach(i => assignment.set(i, best.mask & (1 << index) ? 1 : 2)))
  return profiles.map((item, index) => ({ ...item, combatGroup: assignment.get(index) }))
}

function starterTeams(profiles, chart, constraints, side, teamPreference = {}) {
  const plans = []
  for (const team of chart.teams || []) {
    if (!Array.isArray(team.type) || !team.type.length || side && /Surface|Deepspace/i.test(team.name) && !team.name.includes(side)) continue
    const eligible = profiles.filter(profile => profile.fireteamEligible && membershipRows(profile, team, chart).length)
    for (const member of team.units || []) {
      const matches = eligible.filter(profile => profile.slug === member.slug
        && (!/\bFTO\b/i.test(member.comment || '') || /\bFTO\b/i.test(profile.optionName))
        && (!/\bFTO\b/i.test(member.name || '') || /\bFTO\b/i.test(profile.optionName)))
        .sort((a, b) => (b.specialist - a.specialist) * 3 + (b.gunfighter - a.gunfighter) / 20 + (a.points - b.points) / 10)
        .slice(0, 5)
      for (const type of ['HARIS', 'DUO', 'CORE']) {
        if (!team.type.includes(type)) continue
        const size = type === 'DUO' ? 2 : 3
        for (const item of matches) {
          const partners = [
            ...(item.ava >= 2 ? [item] : []),
            ...matches.filter(profile => profile.unitId === item.unitId && profile.id !== item.id).slice(0, 3),
            ...eligible.filter(profile => constraints.points >= 300 && profile.unitId !== item.unitId)
              .sort((a, b) => Number(b.specialist) - Number(a.specialist)
                || b.gunfighter - a.gunfighter || a.points - b.points).slice(0, 4),
          ]
          for (const partner of partners) {
            const thirdOptions = size === 2 ? [null] : [
              ...eligible.filter(profile => profile.id !== item.id && profile.id !== partner.id)
                .sort((a, b) => {
                  const value = profile => rosterSynergy([item, partner, profile]) * 1.5
                    + (profile.specialist ? 1 : 0) + profile.gunfighter / 17 - profile.points * .09
                  return value(b) - value(a)
                }).slice(0, 8),
              item,
            ]
            for (const third of thirdOptions) {
              const initial = third ? [item, partner, third] : [item, partner]
              const variants = [initial]
              if (type === 'CORE') {
                let extended = initial
                for (let length = 4; length <= 5; length++) {
                  const options = eligible.filter(candidate => canAdd(extended.map(profile => ({ ...profile, combatGroup: 1 })), candidate, 1, constraints))
                    .map(candidate => {
                      const members = [...extended, candidate].map(profile => ({ ...profile, combatGroup: 1 }))
                      const plan = validTeam(members, team, type, chart)
                      return { candidate, plan, value: (plan?.level || 0) * 4
                        + (candidate.specialist ? 1 : 0) - candidate.points * .06 - rosterRedundancy(members) * .8 }
                    }).filter(option => option.plan?.level >= 2)
                    .sort((a, b) => b.value - a.value)
                  if (!options.length) break
                  extended = [...extended, options[0].candidate]
                  variants.push(extended)
                }
              }
              for (const choices of variants) {
                if (choices.reduce((n, choice) => n + choice.points, 0) > constraints.points * .45) continue
                const seed = choices.map(choice => ({ ...choice, combatGroup: 1 }))
                if (seed.some((choice, index) => !canAdd(seed.slice(0, index), choice, 1, constraints))) continue
                const teamPlan = validTeam(seed, team, type, chart)
                if (!teamPlan || teamPlan.level < 2) continue
                const teamValue = constraints.points < 300
                  ? 12 + (type === 'HARIS' ? 1 : 0) + choices.filter(choice => choice.specialist).length * 1.5
                    + Math.max(...choices.map(choice => choice.gunfighter)) / 17
                    + (teamPreference[type] || 0)
                  : 6 + fireteamUsefulness(teamPlan, choices, teamPreference)
                plans.push({ ...teamPlan, members: choices,
                  value: teamValue
                    - choices.reduce((n, choice) => n + choice.points, 0) * .09
                    + rosterSynergy(choices) * 1.4 - rosterRedundancy(choices) * 1.3 })
              }
            }
          }
        }
      }
    }
  }
  const unique = new Map()
  for (const plan of plans) {
    const key = `${plan.name}:${plan.type}:${plan.members.map(m => m.id).sort().join('|')}`
    if (!unique.has(key)) unique.set(key, plan)
  }
  const sorted = [...unique.values()].sort((a, b) => b.value - a.value)
  const diverse = new Map()
  for (const plan of sorted) {
    const key = `${plan.type}:${plan.members[0].unitId}`
    if (!diverse.has(key)) diverse.set(key, plan)
  }
  return [...diverse.values(), ...sorted.filter(plan => ![...diverse.values()].includes(plan))].slice(0, 24)
}

export function proposedFireteams(profiles, chart, side = null, teamPreference = {}) {
  const choices = []
  const used = new Set()
  const usedTypes = new Map()
  for (const team of chart?.teams || []) {
    if (!team.type?.length || side && /Surface|Deepspace/i.test(team.name) && !team.name.includes(side)) continue
    for (const type of ['HARIS', 'DUO', 'CORE']) {
      if (!team.type.includes(type)) continue
      const sizes = type === 'CORE' ? [5, 4, 3] : [type === 'HARIS' ? 3 : 2]
      for (const group of [1, 2]) {
        const eligible = profiles.map((item, index) => ({ ...item, listIndex: index }))
          .filter(item => item.combatGroup === group && item.fireteamEligible !== false && item.slots === 1 && membershipRows(item, team, chart).length)
        for (const size of sizes) for (const members of combinations(eligible, size)) {
          const plan = validTeam(members, team, type, chart)
          if (plan?.level >= 2) choices.push({ ...plan, members, combatGroup: group,
            value: fireteamUsefulness(plan, members, teamPreference)
            - members.reduce((n, item) => n + item.points, 0) * .015
            - Math.max(0, members.length - plan.level) * 1.4 })
        }
      }
    }
  }
  choices.sort((a, b) => b.value - a.value)
  const selected = []
  for (const choice of choices) {
    const cap = Number(chart.spec?.[choice.type] ?? (choice.type === 'DUO' ? 256 : 1))
    if ((usedTypes.get(choice.type) || 0) >= cap || choice.members.some(member => used.has(member.listIndex))) continue
    choice.members.forEach(member => used.add(member.listIndex))
    usedTypes.set(choice.type, (usedTypes.get(choice.type) || 0) + 1)
    selected.push({ name: choice.name, type: choice.type, level: choice.level, combatGroup: choice.combatGroup,
      members: choice.members.map(item => item.label) })
    if (selected.length === 3) break
  }
  return selected
}

export function validTeam(members, team, type, chart = { teams: [] }) {
  if (!team.type?.includes(type) || members.length < (type === 'DUO' ? 2 : 3)
    || members.length > (type === 'CORE' ? 5 : type === 'HARIS' ? 3 : 2)
    || members.some(item => item.combatGroup !== members[0].combatGroup)) return null
  const selections = members.map(item => membershipRows(item, team, chart))
  if (selections.some(rows => !rows.length)) return null
  const rows = selections.map(candidates => candidates[0])
  const counts = new Map()
  for (const row of rows) {
    const key = `${row.slug}:${row.name}`
    counts.set(key, (counts.get(key) || 0) + 1)
    if (counts.get(key) > Number(row.max || 5)) return null
  }
  const required = (team.units || []).filter(row => row.required)
  if (required.length && !rows.some(row => row.required)) return null
  if ((team.units || []).some(row => Number(row.min) > rows.filter(selected => selected.slug === row.slug && selected.name === row.name).length)) return null
  const purity = new Map()
  for (const [index, item] of members.entries()) {
    purity.set(`unit:${item.unitId}`, (purity.get(`unit:${item.unitId}`) || 0) + 1)
    for (const match of String(rows[index].comment || '').matchAll(/\(([^)]+)\)/g)) {
      for (const tag of match[1].split(',')) {
        const key = `tag:${normalize(tag)}`
        purity.set(key, (purity.get(key) || 0) + 1)
      }
    }
  }
  return { name: team.name, type, level: Math.max(1, ...purity.values()) }
}

function membershipRows(item, team, chart) {
  const wildcard = (chart.teams || []).filter(entry => !entry.type?.length && !/no wildcards/i.test(team.obs || ''))
    .filter(entry => { const scope = normalize(entry.name).replace(/\bwildcards?\b/g, '').trim(); return !scope || normalize(team.name).includes(scope) })
    .flatMap(entry => entry.units || [])
  return [...(team.units || []), ...wildcard].filter(row => row.slug === item.slug
    && (!/\bFTO-\d+\b/i.test(row.comment || '') || normalize(item.optionName).includes(normalize(row.comment.match(/\bFTO-\d+\b/i)[0])))
    && (!/\bFTO\b/i.test(`${row.comment || ''} ${row.name || ''}`) || /\bFTO\b/i.test(item.optionName))
    && (!row.name || token(item.optionName).includes(token(row.name)) || token(item.unitName).includes(token(row.name))
      || row.slug === item.slug && !/BAMBADROID|BAMBABOT|OPERATOR/i.test(row.name)))
}

function combinations(values, size, offset = 0, prefix = [], output = []) {
  if (prefix.length === size) { output.push(prefix); return output }
  for (let i = offset; i <= values.length - (size - prefix.length); i++) combinations(values, size, i + 1, [...prefix, values[i]], output)
  return output
}

function membersInTeam(profiles, team, used) {
  return team.members.map(label => {
    const index = profiles.findIndex((item, index) => !used.has(index)
      && item.combatGroup === team.combatGroup && item.label === label)
    if (index < 0) return null
    used.add(index)
    return profiles[index]
  }).filter(Boolean)
}

function scoreList(profiles, fireteams, mission, points, teamPreference = {}) {
  const specialists = profiles.filter(item => item.specialist).length
  const regular = profiles.filter(item => item.regular).length
  const distinctShooters = new Map()
  for (const item of profiles) distinctShooters.set(item.unitId,
    Math.max(distinctShooters.get(item.unitId) || 0, item.gunfighter || 0))
  const [bestShooter = 0, secondShooter = 0] = [...distinctShooters.values()].sort((a, b) => b - a)
  const troopers = profiles.reduce((sum, item) => sum + item.slots, 0)
  const groups = [1, 2].map(group => profiles.filter(item => item.combatGroup === group))
  const usedTeamMembers = new Set()
  const resolvedTeams = fireteams.map(team => ({ ...team,
    members: membersInTeam(profiles, team, usedTeamMembers) }))
  const teamGroups = [1, 2].map(group => resolvedTeams.filter(team => team.combatGroup === group))
  const lieutenantOrders = profiles.reduce((sum, item) => sum + (item.lieutenantOrders || 0), 0)
  return (Math.min(specialists, /hardlock/i.test(mission) ? 4 : 3) * 6) + regular * 2
    + (bestShooter + secondShooter * .6) / 8
    + resolvedTeams.reduce((n, item) => n + fireteamUsefulness(item, item.members, teamPreference), 0)
    + Math.max(0, ...profiles.map(item => item.aroRating)) / 4
    + Math.max(0, ...profiles.map(item => item.ccRating)) / 8
    + profiles.filter(item => item.specialist).map(item => item.mobility).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0) / 65
    + Math.min(profiles.reduce((n, item) => n + item.points, 0), points) / points * 12
    + Math.min(15, troopers) * 4
    + groupPlacementScore(groups, teamGroups, lieutenantOrders) * .35
    + rosterSynergy(profiles) * 1.5 + rosterQuality(profiles, fireteams, mission, points)
    - rosterRedundancy(profiles) * 1.5
}

function hash(input) {
  let result = 2166136261
  for (const char of String(input)) result = Math.imul(result ^ char.charCodeAt(0), 16777619)
  return result >>> 0
}
