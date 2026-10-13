import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile,mkdtemp,rm} from 'node:fs/promises'
import {resolve,join,extname} from 'node:path'
import {tmpdir} from 'node:os'
import {chromium} from 'playwright'
import {createCampaignGameStore} from '../bot/aurora-game-store.mjs'
import {createCampaignGameService} from '../bot/aurora-game-service.mjs'
import {emptyAuroraState} from '../shared/aurora-public-state.mjs'
const directory=await mkdtemp(join(tmpdir(),'aurora-browser-')),store=createCampaignGameStore(join(directory,'games.json'))
const state={...emptyAuroraState(),turn:1,deadline:'2026-12-01T23:59:00-05:00'};state.territories.forEach((t,i)=>t.vulnerable=i<4)
const a={userId:'111111111111111111',name:'Test submitter',faction:'ariadna'},b={userId:'222222222222222222',name:'Test opponent',faction:'pano'}
let account=a
const service=createCampaignGameService({store,registrations:{player:async id=>[a,b].find(p=>p.userId===id),players:async()=>[a,b]},identity:()=>({id:account.userId}),notify:async()=>{throw Error('DM disabled')},fetchObject:async()=>({ok:true,json:async()=>({state})})})
const mime={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json','.html':'text/html'}
const server=createServer(async(req,res)=>{
  if(req.url.startsWith('/api/aurora-games?')){req.url=req.url.replace('/api/aurora-games','/aurora-vii/games');req.headers.origin='https://lobo-infinity-portal.vercel.app';res.setHeader('content-type','application/json');return service.handler(req,res)}
  if(req.url.startsWith('/api/aurora-campaign')){res.setHeader('content-type','application/json');return res.end(JSON.stringify({revision:'test',publishedAt:new Date().toISOString(),state}))}
  if(req.url.startsWith('/api/')){res.writeHead(503,{'content-type':'application/json'});return res.end('{"error":"Unrelated test datasets are unavailable."}')}
  let file=resolve('dist','.'+new URL(req.url,'http://localhost').pathname);if(!extname(file))file=resolve('dist/app-shell.html')
  try{res.setHeader('content-type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404);res.end()}
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const root=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,...(process.env.CAMPAIGN_TEST_CHROMIUM?{executablePath:process.env.CAMPAIGN_TEST_CHROMIUM,args:['--no-sandbox']}:{})})
try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(`${root}/campaign/aurora-vii/submit`)
  await page.getByRole('combobox',{name:'Opponent',exact:true}).selectOption(b.userId)
  await page.getByRole('combobox',{name:'Campaign Location',exact:true}).selectOption('nova-prospect')
  await page.getByRole('combobox',{name:'Mission played',exact:true}).selectOption('Claim the Frontier')
  await page.getByLabel('Your Objective Points',{exact:true}).fill('7');await page.getByLabel('Opponent Objective Points',{exact:true}).fill('6')
  assert.equal(await page.getByLabel('Map / terrain layout (optional)').getAttribute('required'),null)
  await page.getByLabel('Battle notes (optional)').fill('Preserve these notes when editing the review.')
  await page.getByRole('button',{name:'Review scores before submission'}).click();await page.getByRole('heading',{name:'Review both players’ scores'}).waitFor()
  assert((await page.locator('body').innerText()).includes('5 TP'));await page.screenshot({path:join(directory,'desktop-review.png'),fullPage:true})
  await page.getByRole('button',{name:'Back to form'}).click();assert.equal(await page.getByLabel('Battle notes (optional)').inputValue(),'Preserve these notes when editing the review.')
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'No mobile overflow');await page.screenshot({path:join(directory,'mobile-form.png'),fullPage:true})
  await page.getByRole('button',{name:'Review scores before submission'}).click();await page.getByRole('button',{name:'Submit for opponent confirmation'}).click();await page.getByRole('heading',{name:'Game submitted',exact:true}).waitFor()
  const url=await page.getByLabel('Opponent verification link').inputValue(),id=new URL(url).searchParams.get('game');assert(id);assert.equal((await store.totals(1)).length,0);assert.equal(await page.getByRole('button',{name:'Copy verification link'}).count(),1)
  account=b;await page.goto(`${root}/campaign/aurora-vii/games?game=${id}`);await page.getByRole('button',{name:'Confirm result',exact:true}).waitFor()
  await page.getByLabel('Correction requested · Explain what needs changing').fill('My score should be 5.');await page.getByRole('button',{name:'Request correction',exact:true}).click();await page.getByText('Correction requested',{exact:true}).waitFor();assert.equal((await store.totals(1)).length,0)
  const disputed=(await store.view(b.userId,false,state)).games[0];await store.act({id,revision:disputed.revision,action:'correct',reason:'Verified scores',values:{opB:5}},null,true)
  await page.getByRole('button',{name:'Refresh games'}).click();await page.getByRole('button',{name:'Confirm result',exact:true}).click();await page.getByText('Confirmed',{exact:true}).waitFor();assert.equal((await store.totals(1)).find(t=>t.faction==='PanOceania').tp,2)
  await page.screenshot({path:join(directory,'mobile-confirmed.png'),fullPage:true});assert.deepEqual(errors,[])
  console.log(`PASS: desktop/mobile form, optional map, review preserves entries, durable submission, verification link, opponent correction, commissioner correction, reconfirmation and totals. Screenshots: ${directory}`)
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(join(directory,'games.json'),{force:true})}
