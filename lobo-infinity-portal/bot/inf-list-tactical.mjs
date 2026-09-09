import { decodeArmyCode } from '../scripts/infinity-army-decode.mjs'
import { buildCanonicalDataset, resolveCanonicalWeaponRecords } from '../scripts/infinity-army-canonical-dataset.mjs'

const categories = [
  ['apex', 'Apex Gunfighters'],
  ['competent', 'Competent Gunfighters'],
  ['apexCc', 'Apex Close Combat Fighters'],
  ['hacking', 'Hacking Network'],
  ['vision', 'Vision Control'],
  ['valuableAro', 'Valuable ARO Pieces'],
  ['disposableAro', 'Disposable ARO Pieces'],
  ['alternative', 'Alternative Attack Vectors'],
  ['defensive', 'Defensive Network'],
]
const emptyMessage = 'None detected in this submitted list'
const maxImageHeight = 7_500
const imageWidth = 1_440

export function buildSubmittedProfiles({ armyCode, cards = [], officialPayloads = [], metadata = {}, canonicalDataset = null }) {
  const decoded = decodeArmyCode(armyCode)
  const members = decoded.combatGroups.flatMap((group) => group.members)
  const cardQueues = new Map()
  for (const card of cards) {
    const queue = cardQueues.get(card.combinedId) || []
    queue.push(card)
    cardQueues.set(card.combinedId, queue)
  }
  const units = officialPayloads.flatMap((payload) => payload?.units || [])
  const unitById = new Map(units.map((unit) => [Number(unit.id), unit]))
  const names = {
    equipment: new Map((metadata.equips || []).map((item) => [Number(item.id), item.name])),
    skills: new Map((metadata.skills || []).map((item) => [Number(item.id), item.name])),
  }
  const dataset = canonicalDataset || buildCanonicalDataset({ metadata, payloads: officialPayloads })
  const linkableUnitIds = canonicalLinkableUnitIds(officialPayloads)
  const fireteamMembershipsByUnitId = canonicalFireteamMembershipsByUnitId(officialPayloads)

  return members.map((member) => {
    const card = cardQueues.get(member.combinedId)?.shift() || {}
    const unit = unitById.get(Number(member.unitId))
    const group = unit?.profileGroups?.find((item) => Number(item.id) === Number(member.groupId))
    const option = group?.options?.find((item) => Number(item.id) === Number(member.optionId))
    const profileId = Number(member.combinedId.split('-').at(-1))
    const base = group?.profiles?.find((item) => Number(item.id) === profileId) || group?.profiles?.[0]
    const skills = mergeNamedRefs(base?.skills, option?.skills, names.skills, card.skills)
    const equipment = mergeNamedRefs(base?.equip, option?.equip, names.equipment, card.equipment)
    const weaponRefs = [...(base?.weapons || []), ...(option?.weapons || [])]
    const weapons = dedupeWeapons(resolveCanonicalWeaponRecords(dataset, weaponRefs).map((weapon) => ({
      burst: weapon.burstStatus === 'canonical' ? finiteNumber(weapon.burst) : null,
      burstStatus: weapon.burstStatus,
      mode: weapon.mode || '',
      name: weapon.name || '',
      sourceDatasetId: weapon.sourceDatasetId,
      type: weapon.type || '',
      modifiers: weapon.modifiers || [],
    })))
    // Infinity-Data can expose inherited weapons that are absent from the selected
    // option's official weapon references. Recover those weapons only through an
    // exact canonical name match; otherwise retain the name with unverified Burst.
    for (const name of card.weapons || []) if (!weapons.some((weapon) => sameToken(weaponDisplay(weapon), name))) {
      weapons.push(resolveCanonicalCardWeapon(dataset, name) || { burst: null, mode: '', name, type: '' })
    }
    return {
      bs: finiteNumber(base?.bs ?? card.bs),
      cc: finiteNumber(base?.cc ?? card.cc),
      combinedId: member.combinedId,
      equipment,
      fireteamMemberships: fireteamMembershipsByUnitId.get(Number(member.unitId)) || [],
      fireteamTeams: unique((fireteamMembershipsByUnitId.get(Number(member.unitId)) || []).map((item) => item.team)),
      linkability: officialPayloads.length ? (linkableUnitIds.has(Number(member.unitId)) ? 'verified-linkable' : 'verified-not-linkable') : 'unavailable',
      profileName: option?.name || card.profileName || group?.isc || unit?.isc || unit?.name || 'Profile unavailable',
      points: finiteNumber(option?.points ?? card.points),
      skills,
      unitId: Number(member.unitId),
      unitName: unit?.isc || unit?.name || card.unitName || card.profileName || 'Unit unavailable',
      weapons,
    }
  })
}

export function classifyTacticalBrief(profiles, army = {}) {
  const aggregated = aggregateExactProfiles(profiles)
  const eligibleFireteams = legalFireteams(aggregated)
  const result = Object.fromEntries(categories.map(([key]) => [key, []]))
  for (const profile of aggregated) {
    const enhancements = preferredMatches(profile.skills, [gunfighterMimetismToken, gunfighterMsvToken, bsAttackMinusThreeToken, albedoToken])
    const burstBonus = bsAttackBurstBonus(profile.skills)
    const nativeSdBonus = bsAttackSdBonus(profile.skills)
    const qualifyingFireteams = (profile.fireteamTeams || []).filter((team) => eligibleFireteams.has(team))
    const fireteamSdBonus = qualifyingFireteams.length ? 1 : 0
    const activeWeapons = profile.weapons.map((weapon) => ({ ...weapon, baseBurst: weapon.burst, burst: weapon.burst === null ? null : weapon.burst + burstBonus }))
    const effectiveWeapons = activeWeapons.map((weapon) => ({ ...weapon, burst: weapon.burst === null ? null : weapon.burst + nativeSdBonus + fireteamSdBonus + weaponSdBonus(weapon) }))
    const apexWeapons = effectiveWeapons.filter((weapon) => apexGunfighterWeaponToken(weaponDisplay(weapon)) && isRangedWeapon(weapon) && (weapon.burst >= 5 || (profile.bs >= 14 && weapon.burst >= 4) || (profile.bs === 13 && weapon.burst >= 4 && enhancements.length)))
    if (apexWeapons.length) result.apex.push({ ...profile, badges: enhancements, qualifyingWeapons: apexWeapons })
    const competentCandidates = effectiveWeapons.map((weapon) => ({ ...weapon, activeBurst: activeWeapons.find((candidate) => sameToken(weaponDisplay(candidate), weaponDisplay(weapon)))?.burst ?? weapon.burst, nativeSdBonus, weaponSdBonus: weaponSdBonus(weapon), fireteamSdBonus }))
    const standardCompetentWeapons = competentCandidates.filter((weapon) => weapon.burst >= 4 && competentGunfighterWeaponToken(weaponDisplay(weapon)) && isRangedWeapon(weapon))
    const hrlCompetentWeapons = competentCandidates.filter((weapon) => weapon.burst >= 3 && heavyRocketLauncherToken(weaponDisplay(weapon)) && isRangedWeapon(weapon))
    const competentWeapons = dedupeWeapons([...(profile.bs === 12 || profile.bs === 13 ? standardCompetentWeapons : []), ...(profile.bs >= 12 ? hrlCompetentWeapons : [])])
    if (!apexWeapons.length && competentWeapons.length) result.competent.push({ ...profile, badges: unique([...(burstBonus ? preferredMatches(profile.skills, [bsAttackBurstToken]) : []), ...(nativeSdBonus ? preferredMatches(profile.skills, [bsAttackSdToken]) : []), ...competentWeapons.filter((weapon) => weapon.weaponSdBonus).map((weapon) => `${weaponDisplay(weapon)} (+${weapon.weaponSdBonus}SD)`), ...(fireteamSdBonus ? ['Fireteam (+1SD)'] : [])]), qualifyingFireteams, qualifyingWeapons: competentWeapons })
    const closeCombatBadges = preferredMatches(profile.skills, [martialArtsToken, naturalBornWarriorToken, berserkPlusThreeToken, ccAttackBurstToken])
    if (profile.cc >= 22 && closeCombatBadges.length) result.apexCc.push({ ...profile, badges: closeCombatBadges })

    const hackerTypes = unique([
      ...exactMatches(profile.skills, [hackerToken]),
      ...exactMatches(profile.equipment, [hackingDeviceToken]),
    ])
    const delivery = exactMatches([...profile.weapons.map(weaponDisplay), ...profile.equipment], [pitcherToken, fastPandaToken, deployableRepeaterToken, repeaterToken])
    if (hackerTypes.length || delivery.length) result.hacking.push({ ...profile, badges: [...hackerTypes, ...delivery], hackerTypes, delivery })
    const visionControl = preferredMatches([...profile.weapons.map(weaponDisplay), ...profile.equipment, ...profile.skills], [smokeGrenadeToken, smokeGrenadeLauncherToken, discoballerToken, pherowareMirrorballToken, eclipseToken])
    if (visionControl.length) result.vision.push({ ...profile, badges: visionControl })

    const aroWeapons = profile.weapons.filter((weapon) => aroWeaponToken(weaponDisplay(weapon)))
    const aroSkills = preferredMatches(profile.skills, [totalReactionToken, neurocineticsToken, bsAttackSdToken])
    const weaponSdBadges = aroWeapons.filter((weapon) => weaponSdBonus(weapon)).map((weapon) => `${weaponDisplay(weapon)} (+${weaponSdBonus(weapon)}SD)`)
    const pheroware = preferredMatches([...profile.skills, ...profile.equipment, ...profile.weapons.map(weaponDisplay)], [pherowareToken])
    const fireteamSdBadges = fireteamSdBonus ? ['Fireteam (+1SD)'] : []
    if ((pheroware.length || aroWeapons.length) && (aroSkills.length || weaponSdBadges.length || fireteamSdBonus)) result.valuableAro.push({ ...profile, badges: unique([...pheroware, ...aroSkills, ...weaponSdBadges, ...fireteamSdBadges]), qualifyingFireteams, qualifyingWeapons: aroWeapons })
    const disposableWeapons = profile.weapons.filter((weapon) => aroWeaponToken(weaponDisplay(weapon)) || flashPulseToken(weaponDisplay(weapon)))
    const sdWeapons = profile.weapons.filter((weapon) => weaponSdBonus(weapon) > 0)
    const qualifyingDisposableWeapons = dedupeWeapons([...disposableWeapons, ...sdWeapons, ...(nativeSdBonus ? profile.weapons.filter(isRangedWeapon) : [])])
    if (Number.isFinite(profile.points) && profile.points < 14 && (disposableWeapons.length || sdWeapons.length || nativeSdBonus)) result.disposableAro.push({ ...profile, badges: unique([...(nativeSdBonus ? preferredMatches(profile.skills, [bsAttackSdToken]) : []), ...sdWeapons.map((weapon) => `${weaponDisplay(weapon)} (+${weaponSdBonus(weapon)}SD)`)]), qualifyingWeapons: qualifyingDisposableWeapons })

    const deployments = preferredMatches(profile.skills, [parachutistToken, combatJumpToken, hiddenDeploymentToken, impersonationToken])
    if (deployments.length && !excludedAlternativeAttackVector(profile.unitName)) result.alternative.push({ ...profile, badges: deployments })

    const defenses = preferredMatches(profile.skills, [camouflageToken, decoyToken, minelayerToken])
    if (defenses.length) {
      const deployables = minelayerAssociated(profile.weapons, profile.equipment)
      result.defensive.push({ ...profile, badges: defenses, deployables })
    }
  }
  result.apex.sort((a, b) => b.badges.length - a.badges.length || b.bs - a.bs || profileSort(a, b))
  for (const key of ['valuableAro', 'disposableAro']) result[key].sort((a, b) => linkRank(a) - linkRank(b) || profileSort(a, b))
  for (const key of ['competent', 'apexCc', 'hacking', 'vision', 'alternative', 'defensive']) result[key].sort(profileSort)
  addMultiRoleMetadata(result)
  return {
    army: { faction: army.faction || '', listName: army.listName || '', sectorial: army.sectorial || '' },
    categories: result,
    networkSummary: {
      deployableRepeaterCarriers: countQuantity(result.hacking.filter((item) => item.delivery.some(deployableRepeaterToken))),
      fastPandaCarriers: countQuantity(result.hacking.filter((item) => item.delivery.some(fastPandaToken))),
      hackers: countQuantity(result.hacking.filter((item) => item.hackerTypes.length)),
      pitcherCarriers: countQuantity(result.hacking.filter((item) => item.delivery.some(pitcherToken))),
      repeaterCarriers: countQuantity(result.hacking.filter((item) => item.delivery.some(repeaterToken))),
    },
  }
}

function excludedAlternativeAttackVector(unitName) {
  return /^(?:netrods?|imetrons?)(?:\s|$)/i.test(String(unitName || '').trim())
}

export async function renderTacticalBrief({ analysis, browser }) {
  const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: imageWidth, height: 1_600 } })
  try {
    const categoryBlocks = categories.map(([key, title]) => ({ key, title, entries: analysis.categories[key] }))
    const measured = await measureBlocks(page, analysis, categoryBlocks)
    const pages = paginateBlocks(measured, maxImageHeight - 250)
    const results = []
    for (let index = 0; index < pages.length; index += 1) {
      await page.setContent(markup(analysis, pages[index], index, pages.length), { waitUntil: 'load' })
      await page.evaluate(async () => document.fonts?.ready)
      const root = page.locator('.brief')
      const imageBuffer = await root.screenshot({ animations: 'disabled', timeout: 30_000, type: 'png' })
      results.push({ imageBuffer, width: imageBuffer.readUInt32BE(16), height: imageBuffer.readUInt32BE(20) })
    }
    return results
  } finally { await page.close() }
}

async function measureBlocks(page, analysis, blocks) {
  await page.setContent(markup(analysis, blocks, 0, 1), { waitUntil: 'load' })
  return await page.locator('.category').evaluateAll((nodes, source) => nodes.map((node, index) => ({ ...source[index], height: Math.ceil(node.getBoundingClientRect().height) + 18 })), blocks)
}

function paginateBlocks(blocks, availableHeight) {
  const pages = [[]]
  let used = 0
  for (const block of blocks) {
    if (used && used + block.height > availableHeight) { pages.push([]); used = 0 }
    pages.at(-1).push(block)
    used += block.height
  }
  return pages
}

function markup(analysis, blocks, pageIndex, pageCount) {
  const subtitle = [analysis.army.sectorial || analysis.army.faction, analysis.army.listName].filter(Boolean).map(escapeHtml).join(' · ')
  return `<!doctype html><html><head><meta charset="utf-8"><style>${styles()}</style></head><body><main class="brief"><header><div class="brand">LOBO'S LITTLE HELPER</div><h1>TACTICAL INTELLIGENCE BRIEF</h1><h2>OBSERVED CAPABILITIES — SUBMITTED LIST</h2><p>${subtitle}</p><p class="role-note">Profiles may appear in multiple sections when they perform multiple tactical roles. Quantities represent models in the submitted list.</p></header><div class="categories">${blocks.map((block) => categoryMarkup(block, analysis)).join('')}</div>${pageCount > 1 ? `<footer>PAGE ${pageIndex + 1} OF ${pageCount}</footer>` : ''}</main></body></html>`
}

function categoryMarkup({ key, title, entries }, analysis) {
  const summary = key === 'hacking' ? `<div class="summary"><b>NETWORK:</b> ${analysis.networkSummary.hackers} Hackers · ${analysis.networkSummary.pitcherCarriers} Pitcher · ${analysis.networkSummary.fastPandaCarriers} FastPanda · ${analysis.networkSummary.deployableRepeaterCarriers} Deployable Repeater · ${analysis.networkSummary.repeaterCarriers} Repeater</div>` : ''
  const content = entries.length ? `<div class="grid">${entries.map((entry) => entryMarkup(key, entry)).join('')}</div>` : `<div class="empty">${emptyMessage}</div>`
  return `<section class="category"><h3><span>${escapeHtml(title)}</span><small>${entries.length} exact profile${entries.length === 1 ? '' : 's'}</small></h3>${summary}${content}</section>`
}

function entryMarkup(key, entry) {
  let detail = ''
  if (['apex', 'competent', 'valuableAro', 'disposableAro'].includes(key)) detail = `${key.endsWith('Aro') ? `${value(entry.points)} pts · ` : ''}BS ${value(entry.bs)} · ${entry.qualifyingWeapons.map((weapon) => [escapeHtml(weaponDisplay(weapon)), formatBurst(weapon)].filter(Boolean).join(' · ')).join(' · ')}`
  if (key === 'apexCc') detail = `CC ${value(entry.cc)}`
  if (key === 'hacking') detail = [...entry.hackerTypes, ...entry.delivery].map(escapeHtml).join(' · ')
  if (key === 'alternative') detail = `PRIMARY: ${escapeHtml(primaryWeapon(entry.weapons) || 'Unavailable')}`
  if (key === 'defensive' && entry.deployables.length) detail = `DEPLOYABLE: ${entry.deployables.map(escapeHtml).join(' · ')}`
  const fireteam = key.endsWith('Aro') ? `<span class="badge fireteam">${entry.linkability === 'verified-linkable' ? 'VERIFIED LINKABLE' : entry.linkability === 'unavailable' ? 'LINKABILITY UNAVAILABLE' : 'NOT LINKABLE IN CANONICAL CHART'}</span>` : ''
  const secondary = detail || loadoutDetail(entry)
  const multiRole = entry.roles?.length > 1 ? `<span class="badge multi-role">MULTI-ROLE</span>` : ''
  const otherRoles = entry.roles?.filter((role) => role !== key) || []
  return `<article><div class="entry-head"><div><h4>${escapeHtml(entry.unitName)}</h4><p>${escapeHtml(entry.profileName)}</p></div><strong>×${entry.quantity}</strong></div>${secondary ? `<div class="detail">${secondary}</div>` : ''}<div class="badges">${multiRole}${entry.badges.map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join('')}${fireteam}</div>${otherRoles.length ? `<div class="also">Also classified as: ${otherRoles.map((role) => escapeHtml(categories.find(([candidate]) => candidate === role)?.[1] || role)).join(' · ')}</div>` : ''}</article>`
}

function styles() { return `*{box-sizing:border-box}html,body{margin:0;background:#070b10;color:#eef2f6;font-family:Arial,sans-serif}.brief{width:${imageWidth}px;padding:48px 52px 38px;background:radial-gradient(circle at 90% 0,#263540 0,transparent 32%),#0b1117;border-top:12px solid #a7242b}header{padding:0 4px 30px;border-bottom:3px solid #53616d}.brand{color:#df3942;font-size:20px;font-weight:900;letter-spacing:5px}h1{margin:9px 0 2px;font-size:50px;line-height:1;letter-spacing:2px}header h2{margin:0;color:#aeb8c1;font-size:25px;letter-spacing:3px}header p{margin:12px 0 0;color:#dfe6eb;font-size:21px;font-weight:700}header .role-note{color:#aeb8c1;font-size:16px;font-weight:600}.categories{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:24px}.category{border:2px solid #53616d;background:#111a22;break-inside:avoid}.category:nth-child(1),.category:nth-child(2){grid-column:span 1}.category:nth-child(n+3){grid-column:1/-1}.category h3{display:flex;align-items:center;justify-content:space-between;margin:0;padding:13px 17px;background:#202c36;border-left:9px solid #c42e37;font-size:26px;letter-spacing:1px;text-transform:uppercase}.category h3 small{color:#aeb8c1;font-size:15px;letter-spacing:0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px}.category:nth-child(-n+2) .grid{grid-template-columns:1fr}.summary{padding:10px 15px;background:#701a20;color:#fff;font-size:17px}.empty{padding:26px 18px;color:#9faab3;font-size:20px;font-style:italic}article{min-width:0;padding:13px 15px;border:1px solid #40505d;border-left:6px solid #7f919f;background:#17222b}.entry-head{display:flex;gap:12px;justify-content:space-between}.entry-head div{min-width:0}h4{margin:0;color:#fff;font-size:21px;line-height:1.1;overflow-wrap:anywhere;text-transform:uppercase}.entry-head p{margin:4px 0 0;color:#b9c5cd;font-size:17px;line-height:1.2;overflow-wrap:anywhere}.entry-head strong{flex:none;color:#ef454f;font-size:24px}.detail{margin-top:9px;color:#fff;font-size:17px;font-weight:800;line-height:1.3;overflow-wrap:anywhere}.badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.badge{padding:4px 8px;border:1px solid #8e9ba5;border-radius:3px;background:#263640;color:#e8edf0;font-size:14px;font-weight:800}.multi-role{border-color:#50c7df;background:#123f49}.fireteam{border-color:#db3942;background:#5e171c}.also{margin-top:8px;color:#9edbe7;font-size:14px;font-weight:700}footer{padding-top:18px;text-align:right;color:#8e9aa4;font-size:14px;font-weight:800;letter-spacing:2px}` }

function aggregateExactProfiles(profiles) {
  const map = new Map()
  for (const profile of profiles) {
    const key = profile.combinedId ? `${profile.combinedId}|${loadoutSignature(profile)}` : loadoutSignature(profile)
    const existing = map.get(key)
    if (existing) existing.quantity += 1
    else map.set(key, { ...profile, quantity: 1 })
  }
  return [...map.values()]
}

function canonicalLinkableUnitIds(payloads) {
  const ids = new Set()
  for (const payload of payloads) {
    const units = new Map((payload?.units || []).map((unit) => [unit.slug, Number(unit.id)]))
    for (const team of payload?.fireteamChart?.teams || []) for (const member of team.units || []) {
      const id = units.get(member.slug)
      if (id) ids.add(id)
    }
  }
  return ids
}
function canonicalFireteamMembershipsByUnitId(payloads) {
  const result = new Map()
  for (const payload of payloads) {
    const units = new Map((payload?.units || []).map((unit) => [unit.slug, Number(unit.id)]))
    const teams = (payload?.fireteamChart?.teams || []).filter((team) => Array.isArray(team.type) && team.type.length)
    for (const team of teams) {
      const requiredNames = (team.units || []).filter((member) => member.required).map((member) => String(member.name || ''))
      for (const member of team.units || []) {
      const id = Number(member.unitId || units.get(member.slug))
      if (!Number.isInteger(id)) continue
      const memberships = result.get(id) || []
      memberships.push({ team: String(team.name || ''), minSize: fireteamMinimumSize(team.type), required: Boolean(member.required), requiredNames, memberName: String(member.name || ''), countsAs: '' })
      result.set(id, memberships)
      }
    }
    const wildcards = (payload?.fireteamChart?.teams || []).filter((team) => !Array.isArray(team.type) || !team.type.length).flatMap((team) => team.units || [])
    for (const wildcard of wildcards) {
      const id = Number(wildcard.unitId || units.get(wildcard.slug))
      if (!Number.isInteger(id)) continue
      const countsAs = String(wildcard.comment || '').replace(/[()]/g, '').trim()
      const memberships = result.get(id) || []
      for (const team of teams) memberships.push({ team: String(team.name || ''), minSize: fireteamMinimumSize(team.type), required: false, requiredNames: (team.units || []).filter((member) => member.required).map((member) => String(member.name || '')), memberName: String(wildcard.name || ''), countsAs })
      result.set(id, memberships)
    }
  }
  return result
}
function fireteamMinimumSize(types) { return types.includes('DUO') ? 2 : types.includes('HARIS') ? 3 : 3 }
function legalFireteams(profiles) {
  const byTeam = new Map()
  for (const profile of profiles) for (const membership of profile.fireteamMemberships || (profile.fireteamTeams || []).map((team) => ({ team, minSize: 2, required: false, requiredNames: [], memberName: profile.unitName, countsAs: '' }))) {
    const rows = byTeam.get(membership.team) || []
    for (let index = 0; index < profile.quantity; index += 1) rows.push(membership)
    byTeam.set(membership.team, rows)
  }
  const legal = new Set()
  for (const [team, rows] of byTeam) {
    const minimum = rows[0]?.minSize || 2
    const requiredNames = unique((rows[0]?.requiredNames || []).map(normalized))
    const hasRequired = !requiredNames.length || rows.some((row) => row.required || (normalized(row.countsAs) && requiredNames.some((name) => normalized(row.countsAs).startsWith(name) || name.startsWith(normalized(row.countsAs)))))
    if (rows.length >= minimum && hasRequired) legal.add(team)
  }
  return legal
}
function mergeNamedRefs(base = [], option = [], lookup, fallback = []) { return unique([...base, ...option].map((ref) => lookup.get(Number(ref.id))).filter(Boolean).concat(fallback || [])) }
function exactMatches(values, predicates) { return unique(values.filter((value) => predicates.some((predicate) => predicate(value)))) }
function preferredMatches(values, predicates) { return predicates.flatMap((predicate) => { const matches = unique(values.filter(predicate)); return matches.length ? [matches.sort((a, b) => normalized(b).length - normalized(a).length)[0]] : [] }) }
function normalized(value) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[−–—-]/g, ' ').replace(/[^a-z0-9+]+/g, ' ').replace(/\s+/g, ' ').trim() }
function sameToken(a, b) { return normalized(a) === normalized(b) }
function mimetismToken(v) { return /^mimetism(?:\s+(?:l(?:evel\s*)?)?\d+)?$/.test(normalized(v)) }
function msvToken(v) { return /^(?:multispectral visor|msv)(?:\s+(?:l(?:evel\s*)?)?\d+)?$/.test(normalized(v)) }
function gunfighterMimetismToken(v) { return /^mimetism\s+(?:3|6)$/.test(normalized(v)) }
function gunfighterMsvToken(v) { return /^(?:multispectral visor|msv)\s+(?:l(?:evel\s*)?)?[123]$/.test(normalized(v)) }
function bsAttackMinusThreeToken(v) { return /^bs attack\s+3$/.test(normalized(v)) }
function albedoToken(v) { return /^albedo\s+(?:3|6)$/.test(normalized(v)) }
function bsAttackBurstToken(v) { return /^bs attack\s+(?:\+\s*)?(?:(\d+)\s*)?(?:b|burst)$/.test(normalized(v)) }
function bsAttackBurstBonus(skills) { for (const skill of skills || []) { const match = normalized(skill).match(/^bs attack\s+(?:\+\s*)?(?:(\d+)\s*)?(?:b|burst)$/); if (match) return Number(match[1] || 1) } return 0 }
function martialArtsToken(v) { return /^martial arts(?:\s+(?:l(?:evel\s*)?)?\d+)?$/.test(normalized(v)) }
function naturalBornWarriorToken(v) { return /^natural born warrior$/.test(normalized(v)) }
function berserkPlusThreeToken(v) { return /^berserk\s+\+?3$/.test(normalized(v)) }
function ccAttackBurstToken(v) { return /^cc attack\s+\+(?:(?:\d+\s*)?b|burst)$/.test(normalized(v)) }
function smokeGrenadeToken(v) { return /^smoke grenades?$/.test(normalized(v)) }
function smokeGrenadeLauncherToken(v) { return /^smoke grenade launchers?$/.test(normalized(v)) }
function discoballerToken(v) { return /^discoballer$/.test(normalized(v)) }
function pherowareMirrorballToken(v) { return /^(?:pheroware(?:\s+tactics)?|pt)\s+(?:mirroball|mirrorball)$/.test(normalized(v)) }
function eclipseToken(v) { return /^eclipse(?:\s+.*)?$/.test(normalized(v)) }
function pherowareToken(v) { return /^(?:pheroware(?:\s+tactics)?|pt)(?:\s+.*)?$/.test(normalized(v)) }
function apexGunfighterWeaponToken(v) { return /(?:^|\s)(?:marksman rifle|spitfire|red fury|heavy machine gun|hmg|hyper rapid magnetic cannon|hrmc|thunderbolt)(?:\s+(?:burst|anti materiel|hit|blast) mode)?$/.test(normalized(v)) }
function competentGunfighterWeaponToken(v) { return apexGunfighterWeaponToken(v) || /(?:^|\s)rifle(?:\s+(?:burst|anti materiel|hit|blast) mode)?$/.test(normalized(v)) }
function heavyRocketLauncherToken(v) { return /^heavy rocket launcher(?:\s+(?:burst|anti materiel|hit|blast) mode)?$/.test(normalized(v)) }
function resolveCanonicalCardWeapon(dataset, cardName) {
  const token = normalized(cardName)
  const exactDisplay = (dataset?.metadata?.weapons || []).filter((weapon) => normalized(weaponDisplay(weapon)) === token && weapon.burstStatus === 'canonical')
  const exactName = (dataset?.metadata?.weapons || []).filter((weapon) => normalized(weapon.name) === token && weapon.burstStatus === 'canonical')
  const candidates = exactDisplay.length ? exactDisplay : exactName
  if (!candidates.length) return null
  const selected = [...candidates].sort((a, b) => b.burst - a.burst || String(a.mode || '').localeCompare(String(b.mode || '')))[0]
  return { ...selected, modifiers: [], sourceDatasetId: dataset?.datasetId || null }
}
function totalReactionToken(v) { return /^total reaction$/.test(normalized(v)) }
function neurocineticsToken(v) { return /^neurocinetics$/.test(normalized(v)) }
function bsAttackSdToken(v) { return /^bs attack\s+\+(?:\d+\s*)?sd$/.test(normalized(v)) }
function bsAttackSdBonus(skills) { for (const skill of skills || []) { const match = normalized(skill).match(/^bs attack\s+\+(?:(\d+)\s*)?sd$/); if (match) return Number(match[1] || 1) } return 0 }
function weaponSdBonus(weapon) { for (const modifier of weapon?.modifiers || []) { const match = normalized(modifier).match(/^\+(?:(\d+)\s*)?sd$/); if (match) return Number(match[1] || 1) } return 0 }
function hackerToken(v) { return /^hacker$/.test(normalized(v)) }
function hackingDeviceToken(v) { return /^(?:(?:assault|defensive|evo|killer|plus|white|zero pain)\s+)?hacking device(?:\s+plus)?$/.test(normalized(v)) }
function pitcherToken(v) { return /^pitcher$/.test(normalized(v)) }
function fastPandaToken(v) { return /^fast\s*panda$/.test(normalized(v)) }
function deployableRepeaterToken(v) { return /^deployable\s+repeater$/.test(normalized(v)) }
function repeaterToken(v) { return /^repeater$/.test(normalized(v)) }
function parachutistToken(v) { return /^parachutist(?:\s+(?:l(?:evel\s*)?)?\+?\d+)?$/.test(normalized(v)) }
function combatJumpToken(v) { return /^combat jump(?:\s+(?:ph\s*)?\d+)?$/.test(normalized(v)) }
function hiddenDeploymentToken(v) { return /^hidden deployment$/.test(normalized(v)) }
function impersonationToken(v) { return /^impersonation(?:\s+\d+)?$/.test(normalized(v)) }
function camouflageToken(v) { return /^camouflage(?:\s+(?:l(?:evel\s*)?)?\d+)?$/.test(normalized(v)) }
function decoyToken(v) { return /^decoy(?:\s+\d+)?$/.test(normalized(v)) }
function minelayerToken(v) { return /^minelayer$/.test(normalized(v)) }
function aroWeaponToken(v) { return /^(?:(?:ap|viral|multi|plasma|k1)\s+)?sniper rifle(?:\s+(?:burst|anti materiel|hit|blast) mode)?$|^(?:missile launcher|portable autocannon|panzerfaust|flammenspeer|heavy rocket launcher|feuerbach)(?:\s+(?:burst|anti materiel|hit|blast) mode)?$/.test(normalized(v)) }
function flashPulseToken(v) { return /^flash pulse$/.test(normalized(v)) }
function isRangedWeapon(w) { return normalized(w.type) !== 'cc' && !/\bcc weapon\b/.test(normalized(w.name)) }
function minelayerAssociated(weapons, equipment) { return unique([...weapons.map(weaponDisplay), ...equipment].filter((v) => /(?:^|\s)(?:mine|mines)(?:\s|$)|deployable/i.test(normalized(v)))) }
function primaryWeapon(weapons) { return weaponDisplay(weapons.find(isRangedWeapon) || weapons[0]) }
function weaponDisplay(w) { return [w?.name, w?.mode].filter(Boolean).join(' — ') }
function dedupeWeapons(weapons) { const seen = new Set(); return weapons.filter((weapon) => { const key = `${normalized(weaponDisplay(weapon))}:${weapon.burst ?? ''}:${(weapon.modifiers || []).map(normalized).sort().join(',')}`; if (seen.has(key)) return false; seen.add(key); return true }) }
function unique(values) { return [...new Set(values)] }
function finiteNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : null }
function countQuantity(items) { return items.reduce((sum, item) => sum + item.quantity, 0) }
function profileSort(a, b) { return a.unitName.localeCompare(b.unitName) || a.profileName.localeCompare(b.profileName) }
function linkRank(v) { return v.linkability === 'verified-linkable' ? 0 : v.linkability === 'unavailable' ? 2 : 1 }
function value(v) { return Number.isFinite(v) ? v : 'Unavailable' }
function formatBurst(weapon) {
  const raw = weapon?.burst
  const burst = raw === null || raw === undefined || raw === '' ? null : finiteNumber(raw)
  if (burst !== null) {
    const sdBonus = Number(weapon?.nativeSdBonus || 0) + Number(weapon?.weaponSdBonus || 0) + Number(weapon?.fireteamSdBonus || 0)
    const activeBurst = finiteNumber(weapon?.activeBurst)
    if (sdBonus && activeBurst !== null) {
      const activeLabel = weapon?.baseBurst !== null && weapon?.baseBurst !== undefined && weapon.baseBurst !== activeBurst ? `B${activeBurst} (base B${weapon.baseBurst} + BS Attack)` : `B${activeBurst}`
      return `${activeLabel} +${sdBonus}SD (${burst} dice)`
    }
    return weapon?.baseBurst !== null && weapon?.baseBurst !== undefined && weapon.baseBurst !== burst ? `B${burst} (base B${weapon.baseBurst} + BS Attack)` : `B${burst}`
  }
  if (weapon?.burstStatus === 'not-applicable') return ''
  if (weapon?.burstStatus === 'ambiguous') return 'Burst ambiguous'
  return 'Burst unavailable'
}
function loadoutSignature(profile) {
  return JSON.stringify({ bs: finiteNumber(profile.bs), points: finiteNumber(profile.points), skills: [...(profile.skills || [])].map(normalized).sort(), equipment: [...(profile.equipment || [])].map(normalized).sort(), weapons: [...(profile.weapons || [])].map((weapon) => [normalized(weapon.name), normalized(weapon.mode), weapon.burst ?? null, weapon.burstStatus || '', ...(weapon.modifiers || []).map(normalized).sort()]).sort(), linkability: profile.linkability || 'unavailable', fireteamTeams: [...(profile.fireteamTeams || [])].sort() })
}
function addMultiRoleMetadata(result) {
  const memberships = new Map()
  for (const [key] of categories) for (const profile of result[key]) {
    const id = `${profile.combinedId}|${loadoutSignature(profile)}`
    const roles = memberships.get(id) || []
    roles.push(key)
    memberships.set(id, roles)
  }
  for (const [key] of categories) result[key] = result[key].map((profile) => ({ ...profile, roles: memberships.get(`${profile.combinedId}|${loadoutSignature(profile)}`) || [key] }))
}
function loadoutDetail(entry) {
  const parts = unique([...(entry.weapons || []).map(weaponDisplay), ...(entry.skills || []), ...(entry.equipment || [])].filter(Boolean))
  return parts.length ? parts.slice(0, 4).map(escapeHtml).join(' · ') : ''
}
function escapeHtml(v) { return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]) }

export { emptyMessage as TACTICAL_EMPTY_MESSAGE, formatBurst, aggregateExactProfiles, loadoutDetail }
