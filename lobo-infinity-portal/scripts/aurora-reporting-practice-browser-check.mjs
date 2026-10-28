import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { resolve, extname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'
import { expect } from 'playwright/test'
import { createCampaignGameStore } from '../bot/aurora-game-store.mjs'
import { createCampaignGameService } from '../bot/aurora-game-service.mjs'
import { emptyAuroraState } from '../shared/aurora-public-state.mjs'
const directory = await mkdtemp(join(tmpdir(),'aurora-practice-browser-')), live = createCampaignGameStore(join(directory,'live.json')), practiceStore = createCampaignGameStore(join(directory,'practice.json'),{allowPracticeReset:true})
const state = emptyAuroraState(), dist = process.env.CAMPAIGN_TEST_DIST || 'dist'
let notified = 0, publicationWrites = 0
const service = createCampaignGameService({store:live,practiceStore,registrations:{player:async()=>null,players:async()=>[]},identity:()=>null,notify:async()=>{notified++},fetchObject:async url=>({ok:true,json:async()=>url.includes('verify-admin')?{authorized:true}:{state}})})
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'}
const server=createServer(async(req,res)=>{
 const send=(v,c=200)=>{res.writeHead(c,{'content-type':'application/json'});res.end(JSON.stringify(v))}
 if(req.url.startsWith('/api/aurora-games?')){req.url=req.url.replace('/api/aurora-games','/aurora-vii/games');req.headers.origin='https://lobo-infinity-portal.vercel.app';res.setHeader('content-type','application/json');return service.handler(req,res)}
 if(req.url.startsWith('/api/aurora-campaign')){if(req.method!=='GET')publicationWrites++;return send({revision:'',publishedAt:'',state})}
 if(req.url.startsWith('/api/aurora-activity'))return send(await live.activity(0))
 if(req.url.startsWith('/api/'))return send({error:'Unrelated fixture dataset'},503)
 let file=resolve(dist,'.'+new URL(req.url,'http://localhost').pathname);if(!extname(file))file=resolve(dist,'index.html')
 try{res.setHeader('content-type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404);res.end()}
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const root=`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({headless:true,...(process.env.CAMPAIGN_TEST_CHROMIUM?{executablePath:process.env.CAMPAIGN_TEST_CHROMIUM}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-software-rasterizer']})
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',async route=>{const req=route.request();let body;try{body=req.postDataJSON()}catch{};if(body?.action==='session'||new URLSearchParams(req.postData()||'').get('action')==='session'||new URL(req.url()).searchParams.get('action')==='session')return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,authenticated:true,permissions:{},user:{role:'Commissioner',displayName:'Fixture commissioner',enabled:true}})});return req.url().startsWith(root)?route.continue():route.abort()})
 await page.addInitScript(()=>localStorage.setItem('lobo-session-token','fixture-commissioner-token'))
 await page.goto(`${root}/commissioner/aurora-vii/reporting-test`)
 await expect(page.getByRole('heading',{name:'Test campaign reporting',exact:true})).toBeVisible()
 await page.getByRole('combobox',{name:'Opponent',exact:true}).selectOption('practice-player-b')
 await page.getByRole('combobox',{name:'Campaign Location',exact:true}).selectOption('nova-prospect')
 await page.getByRole('combobox',{name:'Mission played',exact:true}).selectOption('Claim the Frontier')
 await page.getByLabel('Your Objective Points',{exact:true}).fill('8');await page.getByLabel('Opponent Objective Points',{exact:true}).fill('6')
 await page.getByLabel('Battle notes (optional)').fill('Practice notes preserved during score review')
 await page.getByRole('button',{name:'Review scores before submission',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Review both players’ scores',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Back to form',exact:true}).click()
 await expect(page.getByLabel('Battle notes (optional)')).toHaveValue('Practice notes preserved during score review')
 await page.getByRole('button',{name:'Review scores before submission',exact:true}).click()
 await page.getByRole('button',{name:'Submit for opponent confirmation',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Game submitted',exact:true})).toBeVisible()
 const verification=await page.getByLabel('Practice verification link',{exact:true}).first().inputValue(),url=new URL(verification),id=url.searchParams.get('game')
 assert.equal(url.pathname,'/commissioner/aurora-vii/reporting-test');assert.equal(url.searchParams.get('as'),'b');assert(id)
 assert.equal(await page.getByRole('button',{name:'Confirm result',exact:true}).count(),0,'Submitter cannot confirm own report')
 await page.getByRole('link',{name:'Open as practice opponent →',exact:true}).click()
 await expect(page.getByRole('combobox',{name:'Test as',exact:true})).toHaveValue('b')
 await expect(page.getByRole('button',{name:'Confirm result',exact:true})).toBeVisible()
 await page.getByLabel('Correction requested · Explain what needs changing').fill('My score should be 5')
 await page.getByRole('button',{name:'Request correction',exact:true}).click()
 await expect(page.getByText('Correction requested',{exact:true})).toBeVisible()
 await page.getByRole('combobox',{name:'Test as',exact:true}).selectOption('commissioner')
 await page.getByText('Commissioner actions & correction',{exact:true}).click()
 await page.getByLabel('Commissioner explanation',{exact:true}).fill('Verified practice scores')
 await page.getByLabel('Opponent OP',{exact:true}).fill('5')
 await page.getByRole('button',{name:'Save correction & request confirmation',exact:true}).click()
 await expect(page.getByText('Awaiting opponent confirmation',{exact:true})).toBeVisible()
 await page.getByRole('combobox',{name:'Test as',exact:true}).selectOption('b')
 await page.getByRole('button',{name:'Confirm result',exact:true}).click()
 await expect(page.getByText('Confirmed',{exact:true})).toBeVisible()
 assert.equal((await practiceStore.view('practice-player-b',false,state)).games[0].opB,5)
 assert.equal((await live.activity(1)).games.length,0);assert.equal(state.turn,0);assert.equal(notified,0);assert.equal(publicationWrites,0)
 await page.setViewportSize({width:390,height:844});assert((await page.getByRole('combobox',{name:'Test as',exact:true}).boundingBox()).height>=44,'Practice role selector has a touch target');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile practice form fits')
 await page.getByRole('heading',{name:'Test campaign reporting',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:join(directory,'practice-mobile.png')})
 await page.getByRole('button',{name:'Clear practice records',exact:true}).click()
 await expect(page.getByText('No campaign games recorded yet.',{exact:true})).toBeVisible()
 assert.equal((await live.activity(1)).games.length,0);assert.deepEqual(errors,[])
 console.log('PASS: prelaunch commissioner form, real score review/submission, generated opponent verification link, opponent-only confirmation, correction/reconfirmation, mobile layout and disposable reset; no publication, live games or Discord messages. Screenshot:',join(directory,'practice-mobile.png'))
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(join(directory,'practice.json'),{force:true})}
