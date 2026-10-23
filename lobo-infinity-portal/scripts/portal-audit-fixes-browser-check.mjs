import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile,access} from 'node:fs/promises'
import {resolve,extname} from 'node:path'
import {chromium} from 'playwright'
let shell=resolve('dist/app-shell.html');try{await access(shell)}catch{shell=resolve('dist/index.html')}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.png':'image/png'}
const server=createServer(async(req,res)=>{let path=resolve('dist','.'+new URL(req.url,'http://localhost').pathname);if(!extname(path))path=shell;try{res.setHeader('content-type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path))}catch{res.writeHead(404);res.end()}})
await new Promise(done=>server.listen(0,'127.0.0.1',done))
const browser=await chromium.launch({headless:true,...(process.env.CAMPAIGN_TEST_CHROMIUM?{executablePath:process.env.CAMPAIGN_TEST_CHROMIUM}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--single-process','--no-zygote']})
let active=false,failPlayers=false
const snapshotId='20261023T040302Z'
const players=[{player:'Lobo',displayName:'Lobo'},{player:'Harrower',displayName:'Harrower'},{player:'canonical-community',displayName:'Community Display Name'}]
const schedule=[{eventId:'event-current-league',missions:[{mission:'The Dig',maps:['Skyrail Exchange','Azure Circuit']},{mission:'Critical Intervention',maps:['Neoterran Command','Bastion Courtyard']}],updatedAt:'2026-10-20T16:58:04Z',weekNumber:'10/20 to 11/04'}]
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.route('https://**/*',route=>route.fulfill({status:503,body:'{}'}))
 await page.route('https://ecwefvuvauaqpary.public.blob.vercel-storage.com/**',route=>{
  const url=route.request().url(),name=url.split('/').at(-1)
  if(name==='players.json'&&failPlayers)return route.fulfill({status:503,body:'{}'})
  const event={id:'event-lobo-s-american-top-40',name:"Lobo's Top 40",status:active?'Active':'Registration Open',lifecycleStage:active?'Active':'Registration',bracket:[],rounds:[],teams:[],participants:[],bracketMissions:[]}
  const data=name==='players.json'?players:name==='schedule.json'?schedule:name==='events.json'?[event]:[]
  return route.fulfill({contentType:'application/json',body:JSON.stringify(name==='current.json'?{schemaVersion:1,snapshotId,sourceCutoff:'2026-10-23',basePath:`public-snapshots/${snapshotId}/`}:{schemaVersion:1,snapshotId,data})})
 })
 const root=`http://127.0.0.1:${server.address().port}`
 await page.goto(root+'/army-lists/submit')
 const picker=page.locator('form select').first()
 await picker.locator('option[value="Harrower"]').waitFor({state:'attached'})
 await picker.selectOption('Harrower');assert.equal(await picker.inputValue(),'Harrower')
 await picker.selectOption({label:'Community Display Name'});assert.equal(await picker.inputValue(),'canonical-community','Submit canonical identity rather than display label')
 failPlayers=true;await page.reload();await page.getByRole('button',{name:'Retry player directory'}).waitFor();assert.equal(await page.getByRole('button',{name:'Submit Army List',exact:true}).isDisabled(),true)
 failPlayers=false;await page.getByRole('button',{name:'Retry player directory'}).click();await picker.locator('option[value="Harrower"]').waitFor({state:'attached'})
 await page.getByRole('link',{name:'Mission & Map',exact:true}).click()
 await page.getByRole('link',{name:/The Dig — Old Quarter Excavation/}).waitFor()
 assert.equal(await page.getByRole('link',{name:/The Dig — Old Quarter Excavation/}).getAttribute('href'),'/maps/the-dig-2-satellite')
 assert.equal(await page.getByRole('link',{name:/The Dig — Skyrail Exchange/}).getAttribute('href'),'/maps/the-dig-1')
 assert.equal(await page.getByRole('link',{name:/Critical Intervention — NeoTerran Command/}).getAttribute('href'),'/maps/critical-intervention-1')
 await page.goto(root+'/submit-game')
 await page.getByRole('button',{name:'Reporting not open'}).waitFor();assert.equal(await page.getByRole('button',{name:'Reporting not open'}).isDisabled(),true)
 assert.equal(await page.locator('a[href*="docs.google.com/forms/"]').count(),3)
 active=true;await page.reload();await page.getByRole('link',{name:'Submit Top 40 Game',exact:true}).waitFor();assert.equal(await page.locator('a[href*="docs.google.com/forms/"]').count(),4)
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile submissions fit the viewport')
 await page.goto(root+'/league-operations');await page.getByRole('link',{name:/The Dig — Old Quarter Excavation/}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Long bag labels fit on mobile')
 assert.deepEqual(errors,[])
 console.log('PASS: community players, canonical IDs, failed-directory retry, mission-specific map links, prelaunch/active reporting, desktop/mobile layouts; no submissions created.')
}finally{await browser.close();await new Promise(done=>server.close(done))}
