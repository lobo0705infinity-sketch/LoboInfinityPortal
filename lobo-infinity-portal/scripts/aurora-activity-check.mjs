import assert from 'node:assert/strict'
import {locationActivity} from '../shared/aurora-activity.mjs'
const activity={turn:1,games:[{id:'1',location:'korin-range',date:'2026-10-13'},{id:'2',location:'narrative',date:'2026-10-13'}],totals:[{location:'korin-range',faction:'Combined Army',tp:40,op:50},{location:'korin-range',faction:'ALEPH',tp:10,op:12},{location:'korin-range',faction:'Yu Jing',tp:10,op:11},{location:'narrative',faction:'Yu Jing',tp:100,op:100}]}
assert.deepEqual(locationActivity(activity,'korin-range').leaders,['ALEPH'])
assert.equal(locationActivity(activity,'korin-range').count,1)
assert.equal(locationActivity(activity,'korin-range').rows.length,3)
activity.totals[2].op=12
assert.deepEqual(locationActivity(activity,'korin-range').leaders,['ALEPH','Yu Jing'])
assert.equal(locationActivity(activity,'narrative').count,1)
assert.deepEqual(locationActivity(activity,'empty').leaders,[])
assert.equal(activity.totals[0].faction,'Combined Army')
console.log('PASS: location isolation, narrative separation, special-faction exclusions, OP tie-break, complete ties, immutable totals.')
const {default:handler}=await import('../api/aurora-activity.mjs')
const originalFetch=globalThis.fetch
try {
  globalThis.fetch=async()=>({ok:true,json:async()=>({turn:1,totals:[],games:[{id:'1',turn:1,date:'2026-10-13',location:'korin-range',mission:'Test',playerA:{name:'A',faction:'aleph',id:'private-a'},playerB:{name:'B',faction:'pano',id:'private-b'},opA:8,opB:2,tpA:5,tpB:0,secretClaims:['secret'],notes:'private notes'}],claims:['secret']})})
  let result,code
  const response={setHeader(){},status(value){code=value;return this},json(value){result=value}}
  await handler({method:'GET'},response)
  assert.equal(code,200)
  assert(!JSON.stringify(result).includes('secret'))
  assert(!JSON.stringify(result).includes('private'))
  globalThis.fetch=async()=>({ok:false})
  await handler({method:'GET'},response)
  assert.equal(code,503)
  await handler({method:'POST'},response)
  assert.equal(code,405)
  console.log('PASS: public activity projection removes private fields and fails closed.')
} finally {globalThis.fetch=originalFetch}
