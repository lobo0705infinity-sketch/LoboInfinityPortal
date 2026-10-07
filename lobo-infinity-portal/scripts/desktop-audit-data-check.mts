import assert from 'node:assert/strict'
import {presentStream} from '../src/public/streamPresentation.ts'
const stream={date:'10/7/2026',division:'Proving Ground',mission:'Wrong',player1:'Alice',player2:'Bob',title:'Old',youtubeUrl:'https://youtu.be/abcdefghijk'}
const game={date:'2026-10-07',player1:'alice',player1DisplayName:'Alice',player2:'bob',player2DisplayName:'Bob',mission:'The Dig',player1Faction:'O-12',player2Faction:'Nomads'} as any
assert.equal(presentStream(stream,[game]).mission,'The Dig')
assert.equal(presentStream(stream,[game]).division,'Proving Grounds')
assert.equal(presentStream(stream,[game,game]).mission,'Wrong')
assert.equal(presentStream({...stream,date:'2026-02-31'},[{...game,date:'2026-02-31'}]).mission,'Wrong')
assert.equal(presentStream({...stream,player1:'Someone'},[game]).title,'Old')
assert.equal(stream.mission,'Wrong')
console.log('PASS stream metadata uses one matching game and preserves ambiguous or invalid entries')
