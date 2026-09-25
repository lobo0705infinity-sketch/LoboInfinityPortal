#!/usr/bin/env node

import assert from 'node:assert/strict'
import { formatInfListLegality, validateInfListLegality } from '../bot/inf-list-legality.mjs'

const payload = {
  version: 'fixture-1',
  units: [unit(10, 100, 2, [option(1, 20, 0, 'LINE TROOPER')]), unit(20, 200, 1, [option(1, 30, 1, 'OFFICER', 'LIEUTENANT')])],
}
const legal = validateInfListLegality({ decoded: decoded(100, [member(10, 1), member(10, 1), member(20, 1)]), payload })
assert.equal(legal.status, 'legal')
assert.deepEqual(legal.totals, { lieutenantCount: 1, points: 70, swc: 1, troopers: 3 })
assert.match(formatInfListLegality(legal), /✅ \*\*LEGAL ARMY LIST\*\*/)
assert.match(formatInfListLegality(legal), /70\/100 Points · 1\/2 SWC · 3\/15 Troopers/)

const bonusSwc = validateInfListLegality({
  decoded: decoded(100, [member(10, 1), member(20, 1)]),
  payload: { ...payload, units: [unit(10, 100, 2, [option(1, 20, '+1', 'LIEUTENANT', 'LIEUTENANT')]), payload.units[1]] },
})
assert.equal(bonusSwc.limits.swc, 3)
assert.equal(bonusSwc.totals.swc, 1)

const illegal = validateInfListLegality({ decoded: decoded(50, [member(10, 1), member(10, 1), member(10, 1)]), payload })
assert.equal(illegal.status, 'illegal')
assert.ok(illegal.violations.some((issue) => issue.includes('exceeds AVA 2')))
assert.ok(illegal.violations.some((issue) => issue.includes('exactly one Lieutenant')))

const oversizedGroup = validateInfListLegality({
  decoded: decoded(300, [...Array.from({ length: 10 }, () => member(10, 1)), member(20, 1)]),
  payload: { ...payload, units: [unit(10, 100, 'T', [option(1, 5, 0, 'LINE TROOPER')]), payload.units[1]] },
})
assert.ok(oversizedGroup.violations.some((issue) => issue.includes('Combat Group 1 contains 11 Troopers')))

const overBudget = validateInfListLegality({
  decoded: decoded(50, [member(20, 1), member(30, 1)]),
  payload: { ...payload, units: [...payload.units, unit(30, 300, 1, [option(1, 30, 1, 'HEAVY WEAPON')])] },
})
assert.ok(overBudget.violations.some((issue) => issue.includes('60 Points exceeds the 50 Point limit')))
assert.ok(overBudget.violations.some((issue) => issue.includes('2 SWC exceeds the 1 SWC limit')))

const fifteenTrooperLimit = validateInfListLegality({
  decoded: decoded(300, [member(40, 1), member(20, 1)]),
  payload: { ...payload, units: [...payload.units, unit(40, 400, 'T', [{ ...option(1, 20, 0, 'FIRETEAM'), minis: 15 }])] },
})
assert.ok(fifteenTrooperLimit.violations.some((issue) => issue.includes('16 Troopers exceeds the 15-Trooper limit')))

const elektronik = unit(41, 410, 'T', [option(1, 3, 0, 'ELEKTRONIK')])
elektronik.profileGroups[0].profiles[0].skills = [{ name: 'Peripheral (Servant)' }]
const elektronikLimit = validateInfListLegality({
  decoded: decoded(300, [...Array.from({ length: 14 }, () => member(10, 1)), member(20, 1), member(41, 1)]),
  payload: { ...payload, units: [unit(10, 100, 'T', [option(1, 5, 0, 'LINE TROOPER')]), payload.units[1], elektronik] },
})
assert.equal(elektronikLimit.totals.troopers, 15, 'Elektronik is a Peripheral and does not consume a Trooper slot')
assert.equal(elektronikLimit.violations.some((issue) => issue.includes('15-Trooper limit')), false)

const yudbot = unit(192, 192, 4, [{ ...option(1, 3, 0, 'YUDBOT'), minis: 0, orders: [] }])
yudbot.isc = 'Yudbots'
yudbot.profileGroups[0].profiles[0].skills = [{ id: 243, extra: [41] }]
const yudbotResult = validateInfListLegality({
  decoded: decoded(300, [...Array.from({ length: 9 }, () => member(10, 1)), member(20, 1), member(192, 1)]),
  payload: {
    ...payload,
    filters: { skills: [{ id: 243, name: 'Peripheral' }] },
    units: [unit(10, 100, 'T', [option(1, 5, 0, 'LINE TROOPER')]), payload.units[1], yudbot],
  },
})
assert.equal(yudbotResult.status, 'legal', 'ten Troopers plus a Yudbot fit in one Combat Group')
assert.equal(yudbotResult.totals.troopers, 10, 'Yudbot costs points but uses no Trooper slot')
assert.equal(yudbotResult.totals.points, 78, 'Yudbot points still count toward the list total')
assert.equal(yudbotResult.violations.some((issue) => issue.includes('Combat Group 1 contains 11 Troopers')), false)

const delta = unit(1453, 1453, 4, [option(1, 20, 0, 'DELTA')])
delta.profileGroups.push({
  id: 2, isc: 'Yudbot-B', profiles: [{ id: 1, ava: 4, skills: [{ id: 243 }] }],
  options: [{ ...option(1, 5, 0, 'YUDBOT-B'), minis: 0 }],
})
const controllerResult = validateInfListLegality({
  decoded: decoded(300, [member(1453, 1), member(20, 1)]),
  payload: { ...payload, filters: { skills: [{ id: 243, name: 'Peripheral' }] }, units: [delta, payload.units[1]] },
})
assert.equal(controllerResult.status, 'legal')
assert.equal(controllerResult.totals.troopers, 2, 'a Peripheral in a different profile group must not hide its Controller')

const unavailable = validateInfListLegality({ decoded: decoded(300, [member(999, 1)]), payload })
assert.equal(unavailable.status, 'unavailable')
assert.match(formatInfListLegality(unavailable), /VALIDATION UNAVAILABLE/)

const renumberedSingletonProfile = structuredClone(payload)
renumberedSingletonProfile.units[0].profileGroups[0].profiles[0].id = 2
const singletonResult = validateInfListLegality({
  decoded: decoded(100, [member(10, 1), member(20, 1)]),
  payload: renumberedSingletonProfile,
})
assert.equal(singletonResult.status, 'legal', 'a renumbered sole base profile remains unambiguous')

const ambiguousMissingProfile = structuredClone(renumberedSingletonProfile)
ambiguousMissingProfile.units[0].profileGroups[0].profiles.push({ id: 3, ava: 2 })
const ambiguousResult = validateInfListLegality({
  decoded: decoded(100, [member(10, 1), member(20, 1)]),
  payload: ambiguousMissingProfile,
})
assert.equal(ambiguousResult.status, 'unavailable', 'multiple nonmatching base profiles remain fail-closed')

const combinedUnit = unit(50, 500, 1, [
  { ...option(1, 18, 0.5, 'JAZZ'), disabled: true },
])
combinedUnit.options = [{
  ...option(1, 25, 0.5, 'JAZZ Hacker & BILLIE'),
  includes: [{ q: 1, group: 1, option: 1 }],
  minis: 2,
}]
const combinedOptionResult = validateInfListLegality({
  decoded: decoded(100, [member(50, 1, 0), member(20, 1)]),
  payload: { ...payload, units: [combinedUnit, payload.units[1]] },
})
assert.equal(combinedOptionResult.status, 'legal', 'enabled combined Army options make their disabled component profiles legal')
assert.deepEqual(combinedOptionResult.totals, { lieutenantCount: 1, points: 55, swc: 1.5, troopers: 3 })

const disabledStandaloneUnit = unit(60, 600, 1, [{ ...option(1, 10, 0, 'RETIRED PROFILE'), disabled: true }])
const disabledStandaloneResult = validateInfListLegality({
  decoded: decoded(100, [member(60, 1), member(20, 1)]),
  payload: { ...payload, units: [disabledStandaloneUnit, payload.units[1]] },
})
assert.equal(disabledStandaloneResult.status, 'illegal', 'a disabled profile without an enabled parent remains illegal')
assert.ok(disabledStandaloneResult.violations.some((issue) => issue.includes('RETIRED PROFILE is disabled')))

const posthumans = {
  id: 597,
  isc: 'Posthumans',
  notes: 'All the Proxies of a G: Jumper trooper must be in the same Combat Group, where they are counted as only one trooper.',
  profileGroups: [
    { id: 1, isc: 'PROXY Mk.1', profiles: [{ id: 1, ava: 1 }], options: [option(1, 13, 0, 'PROXY Mk.1')] },
    { id: 4, isc: 'PROXY Mk.4', profiles: [{ id: 1, ava: 1 }], options: [option(1, 30, 1.5, 'PROXY Mk.4')] },
  ],
}
const pilotXTeam = {
  id: 1903,
  isc: 'Pilot-X Team',
  notes: 'A Pilot-X Team is composed of 1 Pilot-X and 0 to 2 RacerBots Mk-III. All of them must belong to the same Combat Group.',
  profileGroups: [
    { id: 1, isc: 'Pilot-X', profiles: [{ id: 1, ava: 1 }], options: [option(2, 23, 0.5, 'Pilot-X Team')] },
    { id: 2, isc: 'RacerBots', profiles: [{ id: 1, ava: 2 }], options: [option(1, 8, 0, 'RACERBOT Mk-III')] },
  ],
}
const alephMember = (unitId, groupId, optionId) => ({ combinedId: `701-${unitId}-${groupId}-${optionId}-1`, groupId, optionId, unitId })
const alephMembers = [
  alephMember(597, 1, 1),
  alephMember(597, 4, 1),
  alephMember(1903, 1, 2),
  alephMember(1903, 2, 1),
  alephMember(1903, 2, 1),
  member(20, 1),
]
const alephResult = validateInfListLegality({
  decoded: decoded(300, alephMembers),
  payload: { ...payload, units: [posthumans, pilotXTeam, payload.units[1]] },
})
assert.equal(alephResult.status, 'legal', 'distinct Proxy and Pilot-X Team profile groups must not share AVA')
assert.equal(alephResult.totals.troopers, 5, 'multiple Posthuman Proxies in one Combat Group count as one Trooper')
assert.equal(alephResult.violations.some((issue) => /PROXY|RACERBOT|Pilot-X/.test(issue)), false)

console.log('PASS - inf-list legality uses current official profile data and fails closed.')

function decoded(maxPoints, members) {
  return { maxPoints, combatGroups: [{ combatGroup: 1, members }] }
}

function member(unitId, optionId, groupId = 1) {
  return { combinedId: `1-${unitId}-${groupId}-${optionId}-1`, groupId, optionId, unitId }
}

function unit(id, canonical, ava, options) {
  return { id, canonical, isc: `UNIT ${id}`, profileGroups: [{ id: 1, isc: `UNIT ${id}`, profiles: [{ id: 1, ava }], options }] }
}

function option(id, points, swc, name, orderType = 'REGULAR') {
  return { disabled: false, id, minis: 1, name, orders: [{ type: orderType, total: 1 }], points, swc: String(swc) }
}
