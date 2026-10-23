import assert from 'node:assert/strict'
import {mkdtemp, writeFile, readFile, rm, readdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {runCachedBuild} from './build-artifact-cache.mjs'
const dir=await mkdtemp(join(tmpdir(),'lobo-cache-check-')), input=join(dir,'input.json'), output=join(dir,'output.json'), cacheRoot=join(dir,'cache')
let calls=0
const run=()=>runCachedBuild({name:'test',inputs:[input],outputs:[output],cacheRoot,build:async()=>{calls++;await writeFile(output,await readFile(input))}})
try {
 await writeFile(input,'one');assert.equal(await run(),false);assert.equal(await run(),true);assert.equal(calls,1)
 await rm(output);assert.equal(await run(),true);assert.equal(await readFile(output,'utf8'),'one')
 await writeFile(input,'two');assert.equal(await run(),false);assert.equal(calls,2);assert.equal(await readFile(output,'utf8'),'two')
 for(const file of await readdir(join(cacheRoot,'test')))if(file.endsWith('.bin'))await writeFile(join(cacheRoot,'test',file),'corrupt')
 assert.equal(await run(),false);assert.equal(calls,3);assert.equal(await readFile(output,'utf8'),'two')
 await writeFile(input,'failure');await assert.rejects(runCachedBuild({name:'test',inputs:[input],outputs:[output],cacheRoot,build:async()=>{throw Error('generator failed')}}),/generator failed/)
 assert.equal(await run(),false);assert.equal(calls,4)
 console.log('PASS: warm cache, missing output restoration, changed inputs, corrupt entries and failed generators.')
}finally{await rm(dir,{recursive:true,force:true})}
