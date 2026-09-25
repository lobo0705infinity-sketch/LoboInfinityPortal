import { randomInt } from 'node:crypto'
import { encodeArmyCode } from '../scripts/infinity-army-encode.mjs'
import { decodeArmyCode } from '../scripts/infinity-army-decode.mjs'
import { availableProfiles, ListBuilderError, projectedRegularOrders } from './build-list-generator.mjs'
import { validateInfListLegality } from './inf-list-legality.mjs'

const selectIndex = length => randomInt(length)

function chooseProfile(profiles, pickIndex) {
  // Select a unit first so units with many loadouts are not more likely to appear.
  const byUnit = new Map()
  for (const profile of profiles) {
    const choices = byUnit.get(profile.unitId) || []
    choices.push(profile)
    byUnit.set(profile.unitId, choices)
  }
  const units = [...byUnit.values()]
  const choices = units[pickIndex(units.length)]
  return choices[pickIndex(choices.length)]
}

function shuffle(items, pickIndex) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const swap = pickIndex(index + 1)
    const held = result[index]
    result[index] = result[swap]
    result[swap] = held
  }
  return result
}

function canAdd(selected, profile, { points, swc, payload }) {
  if (selected.reduce((total, item) => total + item.points, profile.points) > points) return false
  if (selected.reduce((total, item) => total + item.swc, profile.swc) > swc + 1e-9) return false
  if (selected.reduce((total, item) => total + item.slots, profile.slots) > 15) return false
  if (profile.lieutenant && selected.some(item => item.lieutenant)) return false
  if (selected.filter(item => item.avaKey === profile.avaKey).length >= profile.ava) return false
  const side = selected.find(item => item.side)?.side
  if (profile.side && side && profile.side !== side) return false
  for (const relation of payload.relations || []) {
    if (relation.group || !Number.isFinite(Number(relation.max))) continue
    const ids = (relation.units || []).map(unit => Number(unit.unit)).filter(Number.isInteger)
    if (ids.includes(profile.unitId) && selected.filter(item => ids.includes(item.unitId)).length >= Number(relation.max)) return false
  }
  return true
}

function assignCombatGroups(profiles, pickIndex) {
  const shuffled = shuffle(profiles, pickIndex)
  const slots = [0, 0]
  const groups = [[], []]
  const split = shuffled.reduce((total, item) => total + item.slots, 0) > 10
  for (const item of shuffled) {
    const choices = split ? [0, 1].filter(index => slots[index] + item.slots <= 10) : [0]
    const group = choices[pickIndex(choices.length)]
    if (group === undefined) throw new ListBuilderError('The random roster could not fit into two combat groups.')
    groups[group].push({ ...item, combatGroup: group + 1 })
    slots[group] += item.slots
  }
  return groups.filter(group => group.length).flat()
}

export function generateRandomArmyList({ payload, metadata, sectorialId, rosterSlugs, points, swc,
  pickIndex = selectIndex } = {}) {
  if (!Number.isInteger(points) || points < 100 || points > 400) {
    throw new ListBuilderError('Choose an integer points limit from 100 to 400.')
  }
  if (!Number.isFinite(swc) || swc < 0 || swc > points / 50 || !Number.isInteger(swc * 2)) {
    throw new ListBuilderError(`Choose an SWC limit in half-point steps from 0 to ${points / 50}.`)
  }
  const faction = metadata?.factions?.find(item => Number(item.id) === Number(sectorialId))
  if (!faction) throw new ListBuilderError('Unknown Infinity Army faction.')
  const profiles = availableProfiles({ payload, metadata, sectorialId: Number(sectorialId), rosterSlugs })
  const limits = { points, swc, payload }
  const lieutenants = profiles.filter(item => item.lieutenant && canAdd([], item, limits))
  if (!lieutenants.length) throw new ListBuilderError('No Lieutenant fits those points and SWC limits in this faction.')

  // Reroll only when official Army validation rejects the randomly drawn roster.
  // Do not rank models, seek roles, or optimize Fireteams or combat groups.
  for (let attempt = 0; attempt < 40; attempt++) {
    const selected = [chooseProfile(lieutenants, pickIndex)]
    for (let step = 0; step < 15; step++) {
      const eligible = profiles.filter(item => canAdd(selected, item, limits))
      if (!eligible.length) break
      selected.push(chooseProfile(eligible, pickIndex))
    }
    const arranged = assignCombatGroups(selected, pickIndex)
    const combatGroups = [1, 2].map(group => ({ members: arranged.filter(item => item.combatGroup === group)
      .map(({ unitId, groupId, optionId }) => ({ unitId, groupId, optionId })) })).filter(group => group.members.length)
    const code = encodeArmyCode({ sectorialId: Number(sectorialId), sectorialSlug: faction.slug,
      listName: `Random ${faction.name}`, maxPoints: points, combatGroups })
    const legality = validateInfListLegality({ decoded: decodeArmyCode(code), payload })
    if (legality.status !== 'legal' || legality.totals.swc > swc + 1e-9) continue
    return { faction: faction.name, profiles: arranged, points: legality.totals.points,
      swc: legality.totals.swc, pointsLimit: points, swcLimit: swc,
      legality, code, url: `https://infinitytheuniverse.com/army/list/${encodeURIComponent(code)}`,
      payloadVersion: payload.version }
  }
  throw new ListBuilderError('No verified legal random list was found for those limits. Try a higher points or SWC limit.')
}

export function formatRandomArmyList(list) {
  const heading = `**Random list · ${list.faction}**\n${list.points}/${list.pointsLimit} pts · ${list.swc}/${list.swcLimit} requested SWC · ${list.legality.totals.troopers}/15 troopers\n`
  const footer = `\n[Open in Infinity Army](${list.url})\n-# Random roster; no ratings, missions, or Fireteam optimization. Army profiles ${list.payloadVersion}.`
  const render = compact => heading + [1, 2].map(group => {
    const members = list.profiles.filter(item => item.combatGroup === group)
    if (!members.length) return ''
    return `**Group ${group} · ${projectedRegularOrders(list.profiles, group)} Regular**\n`
      + members.map(item => `• ${compact ? item.optionName : item.label} — ${item.points} pts`).join('\n')
  }).filter(Boolean).join('\n') + footer
  const message = render(false)
  const content = message.length <= 1990 ? message : render(true)
  if (content.length > 1990) throw new ListBuilderError('The random list is too long to display in Discord. Try again.')
  return { allowedMentions: { parse: [] }, content }
}
