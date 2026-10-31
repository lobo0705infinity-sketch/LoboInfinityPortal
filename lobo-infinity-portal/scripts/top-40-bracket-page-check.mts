import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildTop40BracketSections, top40BracketSlot } from '../src/public/top40BracketModel.ts'
import type { PublicEvent } from '../src/public/snapshotTypes.ts'
const page = await readFile('src/components/Top40BracketPage.tsx','utf8')
const event = { bracket:[
  {matchId:'W1-M2',bracket:'Winners',bracketRound:1,position:2,playerA:'Blitchga',seedA:16,playerB:'ADangerousFrog',seedB:17},
  {matchId:'W1-M1',bracket:'Winners',bracketRound:1,position:1,playerA:'Lobo',seedA:1,playerB:'BYE'},
  {matchId:'GF-M2',bracket:'Grand Final',bracketRound:2,position:1,playerASource:'Winners finalist, if reset required'},
]} as unknown as PublicEvent
const sections=buildTop40BracketSections(event)
assert.equal(sections.length,2)
assert.equal(sections[0].rounds[0].matches[0].matchId,'W1-M1')
assert.equal(sections[1].rounds[0].title,'Reset · if required')
assert.equal(top40BracketSlot(event.bracket[0],'A'),'#16 · Blitchga')
assert.equal(top40BracketSlot(event.bracket[2],'A'),'Winners finalist, if reset required')
assert.match(page,/useSnapshotData<PublicEvent\[\]>\('events'\)/)
assert.doesNotMatch(page,/TOP_40_PLACEHOLDER_BRACKET|Forty players enter/)
assert.match(page,/Deadlines are paused/)
assert.match(page,/match\.deadline/)
assert.match(page,/eliminated after their second loss/)
assert.match(page,/src="\/assets\/events\/top-40-bracket\.png"/)
console.log('PASS: public bracket uses event snapshot, real names and seeds, reset, statuses and deadlines')
