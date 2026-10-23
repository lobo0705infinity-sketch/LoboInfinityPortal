import assert from 'node:assert/strict'
import {resolveLoboWorkshopMissionMap,resolveLoboWorkshopMapLabel} from '../shared/lobo-workshop-maps.mjs'
import {top40ReportingAvailability} from '../src/config/top40Reporting.ts'
assert.equal(resolveLoboWorkshopMissionMap('Azure Circuit','The Dig')?.slug,'the-dig-2-satellite')
assert.equal(resolveLoboWorkshopMissionMap('Skyrail Exchange','The Dig')?.slug,'the-dig-1')
assert.equal(resolveLoboWorkshopMissionMap('Neoterran Command','Critical Intervention')?.slug,'critical-intervention-1')
assert.equal(resolveLoboWorkshopMissionMap('Azure Circuit','Akial Interference')?.slug,'akial-interference-2')
assert.equal(resolveLoboWorkshopMissionMap('unknown map','The Dig'),undefined)
assert.equal(resolveLoboWorkshopMapLabel('the-dig-2')?.isCurrent,false,'Historical reports keep their archived layout')
const event={status:'Registration Open',lifecycleStage:'Registration',bracket:[]}
assert.equal(top40ReportingAvailability(event,new Date('2026-10-23T12:00:00Z')).open,false)
assert.match(top40ReportingAvailability(event,new Date('2026-10-23T12:00:00Z')).message,/November 1/)
assert.equal(top40ReportingAvailability({...event,status:'Active'}).open,true)
assert.equal(top40ReportingAvailability({...event,bracket:[{status:'Active'}]}).open,true)
assert.equal(top40ReportingAvailability({...event,status:'Completed',bracket:[{status:'Active'}]}).open,false)
assert.equal(top40ReportingAvailability(undefined).open,false)
console.log('PASS: mission-specific replacements preserve historical reports; Top 40 reporting respects event readiness.')
