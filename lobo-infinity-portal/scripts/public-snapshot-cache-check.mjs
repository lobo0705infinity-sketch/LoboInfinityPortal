import assert from 'node:assert/strict'
import {readPublicDataset} from '../api/_lib/public-snapshot.mjs'
let pointers=0,datasets=0;const snapshotId='20261007T230000Z'
const mock=async url=>{await new Promise(resolve=>setTimeout(resolve,5));if(String(url).endsWith('current.json')){pointers++;return new Response(JSON.stringify({snapshotId,basePath:`public-snapshots/${snapshotId}/`}))}datasets++;return new Response(JSON.stringify({snapshotId,data:[{id:1}]}))}
const results=await Promise.all(Array.from({length:10},()=>readPublicDataset('games',mock)))
assert.equal(pointers,1);assert.equal(datasets,1);assert.deepEqual(results[0],[{id:1}]);await readPublicDataset('games',mock);assert.equal(datasets,1)
let attempts=0;const retry=async url=>String(url).endsWith('current.json')?new Response(JSON.stringify({snapshotId,basePath:`public-snapshots/${snapshotId}/`})):(++attempts===1?new Response('error',{status:503}):new Response(JSON.stringify({snapshotId,data:[]})))
await assert.rejects(readPublicDataset('events',retry));assert.deepEqual(await readPublicDataset('events',retry),[]);assert.equal(attempts,2)
await assert.rejects(readPublicDataset('private',mock));console.log('PASS snapshot requests coalesce, cache validated data, retry failures, and reject unsupported datasets')
