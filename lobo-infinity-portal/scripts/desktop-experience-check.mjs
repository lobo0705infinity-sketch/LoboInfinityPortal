import assert from 'node:assert/strict'
import {addBenchmarkRanks} from './benchmark-ranking.mjs'
import {navigationItemActive as active} from '../src/components/navigationState.ts'
const ratings={'1:10:1:1:1':{normal:{rating:90}},'2:10:1:1:1':{normal:{rating:90}},'1:20:1:1:1':{normal:{rating:70}},'2:30:1:1:1':{normal:{rating:95},fireteam:{rating:100}},'1:40:1:1:1':{normal:{rating:90}}}
const result=addBenchmarkRanks(ratings)
assert.equal(result['1:10:1:1:1'].normal.globalTotal,4)
assert.equal(result['1:10:1:1:1'].normal.globalRank,2)
assert.equal(result['1:40:1:1:1'].normal.globalRank,2)
assert.equal(result['1:10:1:1:1'].normal.factionRank,1)
assert.equal(result['2:10:1:1:1'].normal.factionRank,2)
assert.equal(result['2:30:1:1:1'].fireteam.globalTotal,1)
assert(active('/games','/games/125',''))
assert(active('/players','/player/Lobo',''))
assert(active('/army-intelligence','/army-intelligence','?faction=Kosmoflot'))
assert(!active('/event/example','/event/example/standings',''))
assert(active('/event/example/standings','/event/example/standings',''))
assert(active('/standings?eventId=event-current-league','/standings',''))
assert(!active('/rules?eventId=example','/rules','?eventId=other'))
console.log('PASS: benchmark aliases, ties, faction/state pools, detail routes and event navigation')
