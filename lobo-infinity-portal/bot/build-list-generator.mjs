import { encodeArmyCode } from '../scripts/infinity-army-encode.mjs'
import { decodeArmyCode } from '../scripts/infinity-army-decode.mjs'
import { validateInfListLegality } from './inf-list-legality.mjs'
import { lookupMobility } from './mobility-lookup.mjs'
import { deploymentCoverage, deploymentPositionValue, missionPlan, missionScore, missionSummary } from './build-list-missions.mjs'

const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const token = value => normalize(value).replace(/\s/g, '')
const roleNames = /\b(hacker|forward observer|engineer|doctor|paramedic|specialist operative|chain of command)\b/i
const gradeRank = grade => ({ S: 5, A: 4, B: 3, C: 2, D: 1, F: 0 })[String(grade || '').toUpperCase()] ?? 0
const percentileGrade = percentile => percentile >= 95 ? 'S' : percentile >= 80 ? 'A'
  : percentile >= 60 ? 'B' : percentile >= 40 ? 'C' : percentile >= 20 ? 'D' : 'F'

// These three missions award no OP for specialist actions. Preserve combat
// profiles and useful support roles even when they also have FO or SO.
export function missionSpecialistPenalty(item, plan, linked = false) {
  if (!plan?.deprioritizeFOandSO || !(item.forwardObserver || item.specialistOperative)
    || item.paramedic || item.doctor || item.engineer || item.hacker
    || gradeRank(item.gunfighterGrade) >= gradeRank('A')
    || gradeRank(item.ccGrade) >= gradeRank('A')
    || linked && gradeRank(item.linkedGunfighterGrade) >= gradeRank('A')) return 0
  return 6
}

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
      || Number(token(b.profile.optionName) === query) - Number(token(a.profile.optionName) === query)
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
  const weaponRules = new Map((metadata.weapons || []).map(item => [Number(item.id), item]))
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
    const equipmentRefs = [...(base.equip || []), ...(choice.equip || []), ...includedOptions.flatMap(o => o.equip || [])]
    const weapons = [...(base.weapons || []), ...(choice.weapons || []), ...includedOptions.flatMap(o => o.weapons || [])]
      .map(ref => weaponNames.get(Number(ref.id)) || '').filter(Boolean)
    const roleText = [...skills, ...equipment.filter(name => /hacking device/i.test(name))].join(' ')
    const toolkit = [...skills, ...equipment, ...weapons].join(' ')
    const weaponRefs = [...(base.weapons || []), ...(choice.weapons || []), ...includedOptions.flatMap(o => o.weapons || [])]
    const demolition = weaponRefs.some(ref => {
      const weapon = weaponRules.get(Number(ref.id))
      return weapon?.name === 'D-Charges' || weapon?.properties?.some(rule => /anti-materiel/i.test(rule))
        && weapon.properties.some(rule => /^CC$/i.test(rule))
    })
    const canAro = weapons.some(weapon => !/\bcc weapon\b/i.test(weapon))
      || [...skills, ...equipment].some(value => /\bpheroware\b/i.test(value))
    const impetuous = skills.some(skill => /^Impetuous$/i.test(skill))
    const closeThreat = /shotgun|flamethrower|chain rifle|submachine gun/i.test(toolkit)
    const lieutenant = (choice.orders || []).some(order => String(order.type).toUpperCase() === 'LIEUTENANT')
    const orderCount = type => (choice.orders || []).filter(order => String(order.type).toUpperCase() === type)
      .reduce((sum, order) => sum + Number(order.total || 0), 0)
    const side = (base.chars || []).includes(surfaceId) ? 'Surface'
      : (base.chars || []).includes(deepspaceId) ? 'Deepspace' : null
    const primaryWeapon = weapons.find(weapon => /rifle|shotgun|machine gun|spitfire|sniper|feuerbach|thunderbolt|launcher|smg|submachine/i.test(weapon)) || weapons[0]
    // A Lieutenant decoy must have the same visible unit and complete loadout,
    // not merely the same primary weapon. Ignore only the Lieutenant skill.
    const disguiseKey = [unit.id, groupId, token(choice.name),
      skills.filter(skill => !/^lieutenant\b/i.test(skill)).map(normalize).sort().join(','),
      equipment.map(normalize).sort().join(','), weapons.map(normalize).sort().join(',')].join(':')
    const key = `${sectorialId}:${unit.id}:${groupId}:${choice.id}:1`
    const deploymentPosition = deploymentPositionValue(skills)
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
      troopType: Number(base.type), armor: Number(base.arm || 0), wounds: Number(base.w || 1),
      lieutenant, side, disguiseKey,
      regular: (choice.orders || []).some(order => String(order.type).toUpperCase() === 'REGULAR'),
      irregular: (choice.orders || []).some(order => String(order.type).toUpperCase() === 'IRREGULAR'),
      // The extra order is restricted to its own trooper, so it earns only a
      // modest attack-piece bonus rather than another Regular order.
      impetuousWarband: impetuous && (Number(base.type) === 7 || closeThreat && points <= 25),
      startsOffTable: skills.some(skill => /\b(combat jump|parachutist|hidden deployment)\b/i.test(skill)),
      tacticalOrders: orderCount('TACTICAL') || (skills.some(skill => /\btactical awareness\b/i.test(skill)) ? 1 : 0),
      lieutenantOrders: lieutenant ? orderCount('LIEUTENANT') || 1 : 0,
      nco: skills.some(skill => /^NCO$/i.test(skill)),
      specialist: roleNames.test(roleText),
      fireteamEligible: slots === 1 && !(base.chars || []).includes(27)
        && !skills.some(skill => /\b(infiltration|combat jump|parachutist|peripheral)\b/i.test(skill)),
      engineer: /\bengineer\b/i.test(roleText),
      doctor: /\bdoctor\b/i.test(roleText),
      paramedic: /\bparamedic\b/i.test(roleText),
      specialistOperative: /\bspecialist operative\b/i.test(roleText),
      forwardObserver: /\bforward observer\b/i.test(roleText),
      chainOfCommand: /\bchain of command\b/i.test(roleText),
      number2: skills.some(skill => /^number 2$/i.test(skill)),
      essentialPersonnel: lieutenant || skills.some(skill => /^(number 2|NCO|chain of command)$/i.test(skill))
        || (unit.filters?.categories || []).some(category => category === 6 || category === 10),
      baggage: [...skills, ...equipment].some(value => /^baggage$/i.test(value)),
      unarmedBaggageBot: unit.slug !== 'ikadron-batroids' && Boolean(base.str)
        && [...skills, ...equipment].some(value => /^baggage$/i.test(value))
        && !weapons.some(weapon => !/\bcc weapon\b/i.test(weapon)),
      demolition,
      civEvacEligible: ![5, 8].includes(Number(base.type)) && !(base.chars || []).includes(6)
        && !(base.chars || []).includes(27) && !skills.some(skill => /\b(impetuous|peripheral)\b/i.test(skill)),
      deploymentPosition,
      forwardDeployment: deploymentPosition > 0,
      repairable: Boolean(base.str),
      hacker: /\bhacker\b|hacking device/i.test(roleText),
      trinityHacker: equipmentRefs.some(ref => Number(ref.id) === 145
        || /hacking device/i.test(equipmentNames.get(Number(ref.id)) || '')
          && (ref.extra || []).some(extra => Number(extra) === 12)),
      pitcher: weapons.some(weapon => /^pitcher$/i.test(weapon)),
      discoBaller: weapons.some(weapon => /^disco baller$/i.test(weapon)),
      racerBot: unit.slug === 'racerbots',
      smoke: /smoke|eclipse|disco baller|mirroball/i.test(toolkit),
      repeater: /repeater|pitcher|fastpanda/i.test(toolkit),
      flashPulse: weapons.some(weapon => /\bflash pulse\b/i.test(weapon)),
      aro: /sniper|feuerbach|missile launcher|rocket launcher|flash pulse|panzerfaust|thunderbolt/i.test(toolkit),
      closeThreat,
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
    // The Celestial Guard Monitor belongs to the Kuang Shi unit's second
    // profile group, so it must be selectable to make Kuang Shi legal.
    if (unit.slug === 'kuang-shi') {
      const monitor = (unit.profileGroups || []).find(profileGroup => /celestial guard monitor/i.test(profileGroup.isc || ''))
      if (monitor?.profiles?.length === 1) {
        for (const choice of monitor.options || []) if (choice.disabled !== true) {
          add(unit, monitor, monitor.profiles[0], choice, Number(monitor.id))
        }
      }
    }
    for (const choice of unit.options || []) {
      if (choice.disabled === true || !(choice.includes || []).some(include => Number(include.group) === Number(group.id))) continue
      add(unit, group, base, choice, 0, choice.includes)
    }
  }
  const localGrades = (rating, values) => percentileGrade(100 * values.filter(value => value <= rating).length / Math.max(1, values.length))
  for (const [rating, field] of [['gunfighter', 'armyGunfighterGrade'], ['linkedGunfighter', 'armyLinkedGunfighterGrade'],
    ['aroRating', 'armyAroGrade'], ['linkedAroRating', 'armyLinkedAroGrade'], ['ccRating', 'armyCcGrade']]) {
    const values = result.filter(item => rating === 'ccRating' ? item.ccGrade : rating.startsWith('linked')
      ? item[rating === 'linkedGunfighter' ? 'linkedGunfighterGrade' : 'linkedAroGrade']
      : item[rating === 'gunfighter' ? 'gunfighterGrade' : 'aroGrade']).map(item => item[rating])
    for (const item of result) item[field] = localGrades(item[rating], values)
  }
  for (const item of result) item.linkable = item.fireteamEligible && payload.fireteamChart.teams.some(team =>
    team.type?.length && membershipRows(item, team, payload.fireteamChart).length)
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
  forced.sort((a, b) => Number(isKuangShiMonitor(b)) - Number(isKuangShiMonitor(a)))
  const side = forced.some(item => item.slug === 'iguana-squadron') ? 'Surface'
    : forced.some(item => item.slug === 'gator-squadron') ? 'Deepspace' : null
  constraints.side = side
  const teamPreference = teamTypeEvidence?.preferences?.[Number(sectorialId)] || teamTypeEvidence?.preferences?.global || {}
  const seeds = starterTeams(profiles, payload.fireteamChart, constraints, side, teamPreference)
  const support = profiles.filter(item => item.slots === 1 && (item.flashPulse || item.racerBot) && !item.specialist
    && !item.lieutenant && (item.regular && item.repairable && item.points <= 9
      || item.racerBot && item.regular && item.points <= 12
      || /warcor/i.test(item.slug) && item.points <= 5))
    .sort((a, b) => Number(b.racerBot) - Number(a.racerBot) || a.points - b.points || Number(b.regular) - Number(a.regular))
  const options = []
  const seen = new Set()
  for (let attempt = 0; attempt < 96 && options.length < 96; attempt++) {
    const selected = []
    const baseAttempt = attempt < 48 ? attempt : attempt - 48
    const seed = seeds[baseAttempt % Math.max(1, seeds.length)]
    const plan = missionPlan(mission, attempt % 3)
    const buildConstraints = { ...constraints, plan, side: side || (/\bSurface\b/i.test(seed?.name || '') ? 'Surface'
      : /\bDeepspace\b/i.test(seed?.name || '') ? 'Deepspace' : null) }
    for (const item of forced) {
      if (isKuangShiFighter(item)) {
        const monitor = profiles.find(isKuangShiMonitor)
        while (selected.filter(entry => isKuangShiFighter(entry) && entry.combatGroup === 1).length
          >= 4 * selected.filter(entry => isKuangShiMonitor(entry) && entry.combatGroup === 1).length) {
          if (!monitor || !canAdd(selected, monitor, 1, buildConstraints)) {
            throw new ListBuilderError('Kuang Shi require a Celestial Guard Monitor in the same Combat Group.')
          }
          selected.push({ ...monitor, combatGroup: 1 })
        }
      }
      if (!canAdd(selected, item, 1, buildConstraints)) throw new ListBuilderError('Required profiles conflict with the selected Army limits or Surface/Deepspace restriction.')
      selected.push({ ...item, combatGroup: 1 })
    }
    if (seed) for (const item of seed.members) {
      if (canAdd(selected, item, 1, buildConstraints)) selected.push({ ...item, combatGroup: 1 })
    }
    selectLieutenantPackage(profiles, selected, buildConstraints, baseAttempt)
    if (!selected.some(item => item.lieutenant) || plan.tacticalLink
      && selected.some(item => item.lieutenant && item.startsOffTable)) continue
    addLieutenantNco(profiles, selected, buildConstraints, baseAttempt)

    if (plan.seed && !selected.some(item => plan.seed === 'medical'
      ? item.doctor || item.paramedic || item.specialistOperative : item.demolition)) {
      const role = bestNext(profiles.filter(item => plan.seed === 'medical'
        ? item.doctor || item.paramedic || item.specialistOperative : item.demolition),
      selected, buildConstraints, baseAttempt, 'general')
      if (role) selected.push(role)
    }
    const targetSpecialists = plan.target
    for (let i = 0; i < targetSpecialists; i++) {
      if (selected.filter(item => item.specialist).length >= targetSpecialists) break
      const specialist = bestNext(profiles.filter(item => item.specialist), selected, buildConstraints, baseAttempt, 'specialist')
      if (!specialist) break
      selected.push(specialist)
    }
    // Explore inexpensive linked Pitchers with their full hacking package.
    if (baseAttempt % 4 === 0 && !selected.some(item => item.pitcher && item.linkable)) {
      const pitcher = profiles.filter(item => item.pitcher && item.linkable && item.points <= 25 && !item.lieutenant)
        .sort((a, b) => a.points - b.points)[0]
      if (pitcher && canAdd(selected, pitcher, 1, buildConstraints)) selected.push({ ...pitcher, combatGroup: 1 })
    }
    if (!addHackingSupport(selected, profiles, buildConstraints)) continue
    // Vary the order base before the greedy fill. A cheap Regular Flash Pulse
    // trooper can finance better specialists and attackers; a Warcor may do
    // the same when the roster already has enough Regular orders. They are
    // alternatives for scoring, not compulsory picks or A/S ARO coverage.
    const supportMode = attempt < 48 ? 0 : 1 + (baseAttempt + 2) % 4
    if (supportMode === 1 || supportMode === 3 || supportMode === 4) {
      const remoteCount = supportMode === 3 ? 2 : 1
      for (let i = 0; i < remoteCount; i++) {
        const remote = support.find(item => item.regular && canAdd(selected, item, 1, buildConstraints))
        if (remote) selected.push({ ...remote, combatGroup: 1 })
      }
    }
    if (supportMode === 2 || supportMode === 4) {
      const warcor = support.find(item => !item.regular && /warcor/i.test(item.slug)
        && !selected.some(entry => /warcor/i.test(entry.slug)) && canAdd(selected, item, 1, buildConstraints))
      if (warcor) selected.push({ ...warcor, combatGroup: 1 })
    }
    for (let i = 0; i < 15; i++) {
      const next = bestNext(profiles, selected, buildConstraints, baseAttempt, 'general')
      if (!next) break
      selected.push(next)
    }
    if (!hackingPackageComplete(selected)) continue
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
    const quality = roleCoverage(grouped, fireteams, mission, plan)
    const lieutenantPlan = assessLieutenantPackage(grouped, fireteams, plan)
    options.push({ code, url: `https://infinitytheuniverse.com/army/list/${encodeURIComponent(code)}`, profiles: grouped, fireteams,
      legality, mission, missionPlan: plan, missionSummary: missionSummary(grouped, plan), lieutenantPlan,
      faction: faction.name, payloadVersion: payload.version, quality,
      specialistCount: grouped.filter(item => item.specialist).length,
      points: legality.totals.points, swc: legality.totals.swc,
      score: scoreList(grouped, fireteams, mission, points, teamPreference, plan) })
  }
  if (!options.length) throw new ListBuilderError('I could not make a legal list with those required profiles and points.')
  const ranked = options.sort((a, b) => b.score - a.score)
  const minTroopers = points >= 300 ? 12 : points >= 200 ? 10 : 0
  const viable = ranked.filter(item => item.legality.totals.troopers >= minTroopers)
  const fullEnough = viable.filter(item => item.score >= ranked[0].score - 12)
  const candidates = fullEnough.length >= Math.min(3, count) ? fullEnough
    : viable.length >= Math.min(3, count) ? viable : ranked
  const complete = points >= 300 ? candidates.filter(item => item.quality.gunfighters >= 3
    && item.quality.cc >= 3 && item.quality.aro >= 3
    && item.quality.specialists >= item.quality.specialistTarget) : []
  const fallbackCoverage = points >= 300 ? candidates.filter(item => item.quality.gunfighters >= 2
    && item.quality.cc >= 2 && item.quality.aro >= 2
    && item.quality.specialists >= item.quality.specialistTarget) : []
  const rolePool = complete.length ? complete : fallbackCoverage.length ? fallbackCoverage : candidates
  const preferredPackage = rolePool.filter(item => item.score >= rolePool[0].score - 12
    && (item.missionPlan.tacticalLink ? item.lieutenantPlan.kind === 'apex-open'
      : item.missionPlan.lieutenantKills ? item.lieutenantPlan.kind === 'apex-coc'
        : ['cheap-decoy', 'apex-coc'].includes(item.lieutenantPlan.kind)))
  const leadershipPool = preferredPackage.length ? preferredPackage : rolePool
  // Prefer the fullest roster among similarly strong builds. A sparse list
  // can still win when adding bodies causes a marked loss in overall quality.
  const similarlyStrong = leadershipPool.filter(item => item.score >= leadershipPool[0].score - 6)
  const duoOrHaris = similarlyStrong.filter(item => item.fireteams.some(team =>
    (team.type === 'DUO' || team.type === 'HARIS') && team.level >= 2))
  const competitive = duoOrHaris.length ? duoOrHaris : similarlyStrong
  const pool = [...competitive].sort((a, b) => b.legality.totals.troopers - a.legality.totals.troopers
    || b.score - a.score)
  const chosen = []
  const doubleBind = missionPlan(mission).focus.startsWith('Encryption:') && count >= 3
  const firstPass = doubleBind
    ? [0, 1, 2].map(variant => leadershipPool.find(item => item.missionPlan.variant === variant)
      || candidates.find(item => item.missionPlan.variant === variant)
      || ranked.find(item => item.missionPlan.variant === variant)).filter(Boolean)
    : pool
  for (const option of firstPass) {
    const signature = option.fireteams.map(team => `${team.type}:${team.name}:${team.members.map(name => name.split(' · ')[0]).sort().join('+')}`).sort().join('|')
    if (chosen.length && chosen.some(item => item.teamSignature === signature
      && (!doubleBind || item.missionPlan.variant === option.missionPlan.variant))) continue
    chosen.push({ ...option, teamSignature: signature })
    if (chosen.length >= Math.min(3, count)) break
  }
  for (const option of [...pool, ...leadershipPool, ...rolePool, ...candidates]) {
    if (chosen.length >= Math.min(3, count)) break
    if (!chosen.some(item => item.code === option.code)) chosen.push(option)
  }
  return chosen.map((option, index) => {
    const combatGroups = [1, 2].map(group => ({ members: option.profiles.filter(item => item.combatGroup === group)
      .map(({ unitId, groupId, optionId }) => ({ unitId, groupId, optionId })) })).filter(group => group.members.length)
    const code = encodeArmyCode({ sectorialId: Number(sectorialId), sectorialSlug: faction.slug,
      listName: `Lobo ${mission || 'mission'}${count === 1 ? '' : ` ${index + 1}`}`, maxPoints: points, combatGroups })
    return { ...option, code, url: `https://infinitytheuniverse.com/army/list/${encodeURIComponent(code)}` }
  })
}

function isKuangShiFighter(item) {
  return item.slug === 'kuang-shi' && item.groupId === 1
}

function isKuangShiMonitor(item) {
  return item.slug === 'kuang-shi' && item.groupId === 2
}

function canAdd(selected, profile, combatGroup, { points, payload, side: requiredSide }) {
  if (profile.unarmedBaggageBot && selected.some(item => item.unarmedBaggageBot)) return false
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
  if (isKuangShiFighter(profile)) {
    const fighters = selected.filter(item => isKuangShiFighter(item) && item.combatGroup === combatGroup).length
    const monitors = selected.filter(item => isKuangShiMonitor(item) && item.combatGroup === combatGroup).length
    if (fighters >= 4 * monitors) return false
  }
  // These official relations describe mutually exclusive choices; ignore
  // relations for units not selectable in the current sectorial.
  for (const relation of payload.relations || []) {
    if (relation.group || !Number.isFinite(Number(relation.max))) continue
    const matches = item => (relation.units || []).some(unit => Number(unit.unit) === item.unitId
      && (unit.profile == null || Number(unit.profile) === item.groupId))
    if (matches(profile) && selected.filter(matches).length >= Number(relation.max)) return false
  }
  return true
}

function placeProfile(selected, profile, constraints) {
  for (const combatGroup of [1, 2]) {
    if (canAdd(selected, profile, combatGroup, constraints)) return { ...profile, combatGroup }
  }
  return null
}

export function matchingLieutenantDecoy(lieutenant, profile) {
  return Boolean(lieutenant?.lieutenant && !profile?.lieutenant && lieutenant.disguiseKey
    && lieutenant.disguiseKey === profile.disguiseKey && profile.slots === 1)
}

function findLieutenantPartner(profiles, selected, lieutenant, constraints, role) {
  const qualifies = role === 'decoy'
    ? item => matchingLieutenantDecoy(lieutenant, item)
    : item => item.chainOfCommand && !item.lieutenant && !item.startsOffTable
  const existing = selected.find(qualifies)
  if (existing) return existing
  const candidates = profiles.filter(qualifies).map(item => placeProfile(selected, item, constraints)).filter(Boolean)
  candidates.sort((a, b) => role === 'decoy'
    ? a.points - b.points || Number(b.regular) - Number(a.regular)
    : ((b.wounds || 1) - (a.wounds || 1)) * 3 + ((b.armor || 0) - (a.armor || 0))
      + (b.regular - a.regular) + (b.gunfighter - a.gunfighter) / 15 + (a.points - b.points) / 5)
  return candidates[0] || null
}

function selectLieutenantPackage(profiles, selected, constraints, attempt) {
  const current = selected.find(item => item.lieutenant)
  const choices = (current ? [current] : profiles.filter(item => item.lieutenant
    && (!constraints.plan.tacticalLink || !item.startsOffTable)))
    .map(item => current || placeProfile(selected, item, constraints)).filter(Boolean)
    .map(lieutenant => {
      const roster = current ? selected : [...selected, lieutenant]
      const cheap = lieutenant.troopType === 1 && lieutenant.points <= 20 && lieutenant.slots === 1
      const apex = lieutenant.points >= 30 && (lieutenant.gunfighterGrade === 'S'
        || lieutenant.fireteamEligible && lieutenant.linkedGunfighterGrade === 'S')
      const decoy = !constraints.plan.tacticalLink && cheap
        ? findLieutenantPartner(profiles, roster, lieutenant, constraints, 'decoy') : null
      const successor = !constraints.plan.tacticalLink && apex
        ? findLieutenantPartner(profiles, roster, lieutenant, constraints, 'successor') : null
      return { lieutenant, decoy, successor, cheap: Boolean(decoy), apex: Boolean(apex && (successor || constraints.plan.tacticalLink)) }
    })
  if (!choices.length) return
  const preferApex = constraints.plan.lieutenantKills || constraints.plan.tacticalLink || attempt % 2 === 1
  const sortApex = (a, b) => Number(b.lieutenant.gunfighterGrade === 'S') - Number(a.lieutenant.gunfighterGrade === 'S')
    || b.lieutenant.gunfighter - a.lieutenant.gunfighter
    || b.lieutenant.wounds - a.lieutenant.wounds || b.lieutenant.armor - a.lieutenant.armor
  const sortCheap = (a, b) => a.lieutenant.points + a.decoy.points - b.lieutenant.points - b.decoy.points
    || b.lieutenant.regular - a.lieutenant.regular
  const apex = choices.filter(item => item.apex).sort(sortApex)
  const cheap = choices.filter(item => item.cheap).sort(sortCheap)
  const wanted = preferApex ? apex.length ? apex : cheap : cheap.length ? cheap : apex
  const fallbacks = [...choices].sort(constraints.plan.lieutenantKills
    ? (a, b) => b.lieutenant.gunfighter - a.lieutenant.gunfighter || a.lieutenant.points - b.lieutenant.points
    : (a, b) => a.lieutenant.points - b.lieutenant.points || b.lieutenant.regular - a.lieutenant.regular)
  const choice = (wanted.length ? wanted : fallbacks)[attempt % Math.min(3, (wanted.length ? wanted : fallbacks).length)]
  if (!current) selected.push(choice.lieutenant)
  if (constraints.plan.tacticalLink) return
  const partner = choice.apex ? choice.successor : choice.cheap ? choice.decoy : null
  if (partner && !selected.includes(partner) && !selected.some(item => item.id === partner.id
    && item.combatGroup === partner.combatGroup)) selected.push(partner)
}

export function ncoCombatValue(item) {
  return Math.max(gradeRank(item.gunfighterGrade) * 3 + (item.gunfighter || 0) / 8,
    gradeRank(item.ccGrade) * 3 + (item.ccRating || 0) / 8)
}

function addLieutenantNco(profiles, selected, constraints, attempt) {
  const lieutenant = selected.find(item => item.lieutenant)
  if (!lieutenant || selected.some(item => item.nco && !item.lieutenant && !item.startsOffTable)) return
  const cheapPair = lieutenant.troopType === 1 && lieutenant.points <= 20
    && selected.some(item => matchingLieutenantDecoy(lieutenant, item))
  if (lieutenant.lieutenantOrders <= 1 && !cheapPair) return
  const candidates = profiles.filter(item => item.nco && !item.lieutenant && !item.startsOffTable)
    .map(item => placeProfile(selected, item, constraints)).filter(Boolean)
    .sort((a, b) => ncoCombatValue(b) - ncoCombatValue(a)
      || b.gunfighter - a.gunfighter || b.ccRating - a.ccRating || a.points - b.points)
  if (candidates.length) selected.push(candidates[attempt % Math.min(3, candidates.length)])
}

export function assessLieutenantPackage(profiles, fireteams = [], plan = {}) {
  const lieutenant = profiles.find(item => item.lieutenant)
  if (!lieutenant) return { kind: 'missing', score: -20 }
  const decoy = profiles.find(item => matchingLieutenantDecoy(lieutenant, item))
  const successor = profiles.find(item => item.chainOfCommand && !item.lieutenant && !item.startsOffTable)
  const linked = fireteams.some(team => team.level >= 2 && team.combatGroup === lieutenant.combatGroup
    && team.members.includes(lieutenant.label))
  const grade = lieutenant.gunfighterGrade === 'S' || linked && lieutenant.linkedGunfighterGrade === 'S'
    ? 'S' : lieutenant.gunfighterGrade
  const apex = grade === 'S' && lieutenant.points >= 30
  const cheap = lieutenant.troopType === 1 && lieutenant.points <= 20 && Boolean(decoy)
  const nco = profiles.filter(item => item.nco && !item.lieutenant && !item.startsOffTable)
    .sort((a, b) => ncoCombatValue(b) - ncoCombatValue(a))[0] || null
  const ncoNeeded = lieutenant.lieutenantOrders > 1 || cheap && !plan.tacticalLink
  const ncoScore = ncoNeeded ? nco ? 11 + Math.min(8, ncoCombatValue(nco) * .55) : -10 : 0
  if (plan.tacticalLink) return { kind: apex ? 'apex-open' : 'fallback', lieutenant, partner: null, grade,
    score: (apex ? 16 : grade === 'A' ? 8 : 0)
      - (successor ? 8 : 0) - (decoy ? 7 : 0) + ncoScore, nco }
  if (apex && successor) return { kind: 'apex-coc', lieutenant, partner: successor, grade, nco,
    score: (plan.lieutenantKills ? 22 : 11) + ncoScore }
  if (cheap) return { kind: 'cheap-decoy', lieutenant, partner: decoy, grade, nco,
    score: (plan.lieutenantKills ? 3 : 11) + ncoScore }
  return { kind: 'fallback', lieutenant, partner: null, grade, nco, score: -6 + ncoScore }
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
  const currentAnchors = constraints.points >= 300 ? impactAnchorValue(selected) : 0
  const currentMission = missionScore(selected, constraints.plan)
  const currentDeployment = deploymentCoverage(selected)
  const currentWarbands = impetuousWarbandValue(selected)
  const candidates = []
  for (const item of profiles) {
    const group = selected.filter(profile => profile.combatGroup === 1).reduce((n, profile) => n + profile.slots, 0) + item.slots <= 10 ? 1 : 2
    if (!canAdd(selected, item, group, constraints)) continue
    if (item.lieutenant || item.slots > 1 && count > 8) continue
    // Peripheral helpers take a list slot but do not add a trooper or an
    // order. Do not use one to fill the last slot of a 300-point army.
    if (!item.regular && !item.irregular && count >= 10) continue
    if (/warcor/i.test(item.slug) && selected.some(profile => /warcor/i.test(profile.slug))) continue
    const regular = item.regular ? 2.1 : 0.1
    const missionValue = item.specialist && specialists < constraints.plan.target ? 5.5
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
      + (item.racerBot ? 7 : 0)
      + (item.discoBaller && item.linkable && item.points <= 25 ? 5 : 0)
      + (item.pitcher && item.linkable && item.points <= 25 && hackingPackageComplete(selected) ? 5 : 0)
      + (selected.some(profile => profile.ccRating > 10) ? 0 : item.ccRating / 14)
      + (item.specialist ? item.mobility / 80 : 0)
      + spend - item.points * .075 - existing * .35 - affordable + variation
      + (rosterSynergy([...selected, item]) - currentSynergy) * .9
      + (rosterQuality([...selected, item], [], constraints.mission, constraints.points) - currentQuality) * 1.2
      + (constraints.points >= 300 ? impactAnchorValue([...selected, item]) - currentAnchors : 0) * .65
      + (missionScore([...selected, item], constraints.plan) - currentMission) * .75
      + (deploymentCoverage([...selected, item]) - currentDeployment) * 3
      + (impetuousWarbandValue([...selected, item]) - currentWarbands)
      - (rosterRedundancy([...selected, item]) - currentRedundancy) * .8
      // A linked A/S gunfighter remains a candidate; the final roster verifies
      // that the Fireteam really exists before granting that exemption.
      - missionSpecialistPenalty(item, constraints.plan, item.fireteamEligible
        && gradeRank(item.linkedGunfighterGrade) >= gradeRank('A'))
      - (constraints.plan.tacticalLink && item.chainOfCommand ? 8 : 0)
      - (constraints.plan.tacticalLink && matchingLieutenantDecoy(selected.find(profile => profile.lieutenant), item) ? 7 : 0)
      - (!constraints.plan.tacticalLink && selected.some(profile => profile.lieutenant && profile.troopType === 1)
        && item.chainOfCommand ? 3 : 0)
    candidates.push({ ...item, combatGroup: group, value })
  }
  candidates.sort((a, b) => b.value - a.value || a.points - b.points)
  return mode === 'specialist' ? candidates.find(item => item.specialist) : candidates.find(item => item.value > -.5)
}

export function impetuousWarbandValue(profiles) {
  // An Impetuous order can help the warband itself, but cannot fuel another
  // attacker. Stop rewarding extra copies once three have been selected.
  return Math.min(3, profiles.filter(item => item.impetuousWarband).length) * 1.5
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

function hackingPackageComplete(profiles) {
  return !profiles.some(item => item.pitcher && item.linkable)
    || profiles.filter(item => item.hacker).length >= 2 && profiles.some(item => item.hacker && item.trinityHacker)
}

function addHackingSupport(selected, profiles, constraints) {
  if (!selected.some(item => item.pitcher && item.linkable)) return true
  while (!hackingPackageComplete(selected)) {
    const needsTrinity = !selected.some(item => item.hacker && item.trinityHacker)
    const hacker = profiles.filter(item => item.hacker && (!needsTrinity || item.trinityHacker) && !item.lieutenant)
      .sort((a, b) => a.points - b.points)
      .find(item => canAdd(selected, item, selected.filter(entry => entry.combatGroup === 1).reduce((sum, entry) => sum + entry.slots, 0) + item.slots <= 10 ? 1 : 2, constraints))
    if (!hacker) return false
    const group = selected.filter(item => item.combatGroup === 1).reduce((sum, item) => sum + item.slots, 0) + hacker.slots <= 10 ? 1 : 2
    selected.push({ ...hacker, combatGroup: group })
  }
  return true
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

// Grade physical models in actual proposed teams. Gunfighters and CC may
// overlap, while an ARO model cannot fill either attacking role.
export function roleCoverage(profiles, fireteams = [], mission = '', plan = missionPlan(mission)) {
  const linked = new Set()
  for (const team of fireteams) {
    if (team.level < 2) continue
    for (const label of team.members) {
      const index = profiles.findIndex((item, index) => !linked.has(index)
        && item.combatGroup === team.combatGroup && item.label === label)
      if (index >= 0) linked.add(index)
    }
  }
  const grade = (item, normal, upgraded, index) => Math.max(gradeRank(item[normal]),
    linked.has(index) ? gradeRank(item[upgraded]) : 0)
  const candidates = profiles.map((item, index) => ({ item, index,
    gun: grade(item, 'gunfighterGrade', 'linkedGunfighterGrade', index),
    aro: grade(item, 'aroGrade', 'linkedAroGrade', index), cc: gradeRank(item.ccGrade) }))
  const defenders = candidates.filter(entry => entry.aro >= 4)
    .sort((a, b) => b.aro - a.aro || b.item.aroRating - a.item.aroRating).slice(0, 9)
  const defenseChoices = [[]]
  for (let a = 0; a < defenders.length; a++) {
    defenseChoices.push([defenders[a]])
    for (let b = a + 1; b < defenders.length; b++) {
      defenseChoices.push([defenders[a], defenders[b]])
      for (let c = b + 1; c < defenders.length; c++) defenseChoices.push([defenders[a], defenders[b], defenders[c]])
    }
  }
  let best = null
  for (const defense of defenseChoices) {
      const used = new Set(defense.map(entry => entry.index))
      const attacks = candidates.filter(entry => !used.has(entry.index))
      const guns = attacks.filter(entry => entry.gun >= 4).sort((x, y) => y.gun - x.gun || y.item.gunfighter - x.item.gunfighter).slice(0, 3)
      const cc = attacks.filter(entry => entry.cc >= 4).sort((x, y) => y.cc - x.cc || y.item.ccRating - x.item.ccRating).slice(0, 3)
      const distinctGunfighters = new Set(guns.map(entry => entry.item.unitId)).size
      const distinctAro = new Set(defense.map(entry => entry.item.unitId)).size
      const sGunfighters = guns.filter(entry => entry.gun >= 5).length
      const sAro = defense.filter(entry => entry.aro >= 5).length
      const sCc = cc.filter(entry => entry.cc >= 5).length
      const score = guns.length * 8 + defense.length * 6 + cc.length * 5
        + (sGunfighters * 3 + sAro * 3 + sCc * 2)
        + (distinctGunfighters >= 2 ? 2 : 0) + (distinctAro >= 2 ? 1.5 : 0)
      if (!best || score > best.score) best = { guns, defense, cc, sGunfighters, sAro, sCc,
        distinctGunfighters, distinctAro, score }
  }
  const specialists = profiles.filter(item => item.specialist)
  const linkedRequired = (index, normalGrade) => linked.has(index) && gradeRank(normalGrade) < gradeRank('A')
  const summary = (entries, normal, upgraded, armyNormal, armyUpgraded) => entries.map(({ item, index }) => {
    const useLinked = linked.has(index) && gradeRank(item[upgraded]) > gradeRank(item[normal])
    return { name: item.unitName, global: useLinked ? item[upgraded] : item[normal],
      army: useLinked ? item[armyUpgraded] : item[armyNormal], linked: useLinked }
  })
  return { gunfighters: best.guns.length, aro: best.defense.length, cc: best.cc.length,
    sGunfighters: best.sGunfighters, sAro: best.sAro, sCc: best.sCc,
    gunfighterTiers: summary(best.guns, 'gunfighterGrade', 'linkedGunfighterGrade', 'armyGunfighterGrade', 'armyLinkedGunfighterGrade'),
    aroTiers: summary(best.defense, 'aroGrade', 'linkedAroGrade', 'armyAroGrade', 'armyLinkedAroGrade'),
    ccTiers: best.cc.map(({ item }) => ({ name: item.unitName, global: item.ccGrade, army: item.armyCcGrade })),
    specialists: specialists.length, specialistTarget: plan.target,
    distinctGunfighters: best.distinctGunfighters, distinctAro: best.distinctAro,
    linkedGunfighters: best.guns.filter(entry => linkedRequired(entry.index, entry.item.gunfighterGrade)).length,
    linkedAro: best.defense.filter(entry => linkedRequired(entry.index, entry.item.aroGrade)).length }
}

export function rosterQuality(profiles, fireteams = [], mission = '', points = 300) {
  if (points < 300) return 0
  const quality = roleCoverage(profiles, fireteams, mission)
  return quality.gunfighters * 8 + quality.cc * 5 + quality.aro * 6
    + quality.sGunfighters * 3 + quality.sAro * 3 + quality.sCc * 2
    + (quality.distinctGunfighters >= 2 ? 2 : 0)
    + (quality.distinctAro >= 2 ? 1.5 : 0)
}

// A costly profile only gets this budget priority when its benchmarked combat
// or specialist role justifies it. Distinct units and diminishing returns
// favor one or two useful anchors over expensive copies or an arbitrary TAG.
export function impactAnchorValue(profiles) {
  const byUnit = new Map()
  for (const item of profiles) {
    if (item.points < 30 || item.slots !== 1) continue
    const bestGrade = Math.max(gradeRank(item.gunfighterGrade), gradeRank(item.aroGrade), gradeRank(item.ccGrade))
    const role = bestGrade >= gradeRank('S') ? 1.15 : bestGrade >= gradeRank('A') ? 1
      : item.specialist && bestGrade >= gradeRank('B') ? .55 : 0
    if (!role) continue
    const value = Math.min(1.25, role * (1 + Math.min(20, item.points - 30) / 100))
    byUnit.set(item.unitId, Math.max(byUnit.get(item.unitId) || 0, value))
  }
  const [first = 0, second = 0] = [...byUnit.values()].sort((a, b) => b - a)
  return first * 5 + second * 2
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
  if (shooters + defenders + fighters + specialists === 0) return 0
  const compact = { DUO: 3, HARIS: 3.5, CORE: 0 }[team.type] || 0
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
    if (groups.some(members => members.filter(isKuangShiFighter).length
      > 4 * members.filter(isKuangShiMonitor).length)) continue
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
                if (!teamPlan || teamPlan.level < 2
                  || constraints.points >= 300 && fireteamUsefulness(teamPlan, choices, teamPreference) <= 0) continue
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
          if (plan?.level >= 2 && fireteamUsefulness(plan, members, teamPreference) > 0) choices.push({ ...plan, members, combatGroup: group,
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

function scoreList(profiles, fireteams, mission, points, teamPreference = {}, plan = missionPlan(mission)) {
  const specialists = profiles.filter(item => item.specialist).length
  const regular = profiles.filter(item => item.regular).length
  // Flash Pulse remotes supply a Regular order and a disposable defense for
  // fewer points than ordinary line infantry. Reward that economy modestly;
  // role coverage and the rest of the roster still decide the list.
  const cheapFlashOrders = Math.min(2, profiles.filter(item => item.regular && item.repairable
    && item.flashPulse && item.points <= 9).length)
  const racerOrders = Math.min(2, profiles.filter(item => item.racerBot && item.regular).length)
  const cheapDisco = Math.min(2, profiles.filter(item => item.discoBaller && item.linkable && item.points <= 25).length)
  const cheapPitcher = Math.min(2, profiles.filter(item => item.pitcher && item.linkable && item.points <= 25).length)
  const distinctShooters = new Map()
  for (const item of profiles) distinctShooters.set(item.unitId,
    Math.max(distinctShooters.get(item.unitId) || 0, item.gunfighter || 0))
  const [bestShooter = 0, secondShooter = 0] = [...distinctShooters.values()].sort((a, b) => b - a)
  const troopers = profiles.reduce((sum, item) => sum + item.slots, 0)
  const groups = [1, 2].map(group => profiles.filter(item => item.combatGroup === group))
  const usedTeamMembers = new Set()
  const resolvedTeams = fireteams.map(team => ({ ...team,
    members: membersInTeam(profiles, team, usedTeamMembers) }))
  const linkedMembers = new Set(resolvedTeams.filter(team => team.level >= 2).flatMap(team => team.members))
  const teamGroups = [1, 2].map(group => resolvedTeams.filter(team => team.combatGroup === group))
  const lieutenantOrders = profiles.reduce((sum, item) => sum + (item.lieutenantOrders || 0), 0)
  return (Math.min(specialists, plan.target) * 6) + regular * 2
    + cheapFlashOrders * 1.5 + (cheapFlashOrders === 2 ? 3.5 : 0)
    + racerOrders * 5 + cheapDisco * 3 + (hackingPackageComplete(profiles) ? cheapPitcher * 3 : 0)
    + (bestShooter + secondShooter * .6) / 8
    + resolvedTeams.reduce((n, item) => n + fireteamUsefulness(item, item.members, teamPreference), 0)
    + Math.max(0, ...profiles.map(item => item.aroRating)) / 4
    + Math.max(0, ...profiles.map(item => item.ccRating)) / 8
    + profiles.filter(item => item.specialist).map(item => item.mobility).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0) / 65
    + Math.min(profiles.reduce((n, item) => n + item.points, 0), points) / points * 12
    + Math.min(15, troopers) * 4
    + groupPlacementScore(groups, teamGroups, lieutenantOrders) * .35
    + rosterSynergy(profiles) * 1.5 + rosterQuality(profiles, fireteams, mission, points)
    + (points >= 300 ? impactAnchorValue(profiles) : 0) + missionScore(profiles, plan)
    + deploymentCoverage(profiles) * 3
    + impetuousWarbandValue(profiles)
    + assessLieutenantPackage(profiles, fireteams, plan).score
    - profiles.reduce((sum, item) => sum + missionSpecialistPenalty(item, plan, linkedMembers.has(item)), 0)
    - rosterRedundancy(profiles) * 1.5
}

function hash(input) {
  let result = 2166136261
  for (const char of String(input)) result = Math.imul(result ^ char.charCodeAt(0), 16777619)
  return result >>> 0
}
