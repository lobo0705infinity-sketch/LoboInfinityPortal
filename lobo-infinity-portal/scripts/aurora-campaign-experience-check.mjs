import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { resolve, extname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'
import { emptyAuroraState } from '../shared/aurora-public-state.mjs'
import { AURORA_REGISTRATION_FACTIONS } from '../shared/aurora-registration.mjs'
import { createCampaignGameStore } from '../bot/aurora-game-store.mjs'
const directory = await mkdtemp(join(tmpdir(), 'aurora-experience-'))
const store = createCampaignGameStore(join(directory, 'games.json'))
let state = emptyAuroraState(), failActivity = false
const a = {userId:'111111111111111111',name:'Verified A',faction:'nomads'}, b = {userId:'222222222222222222',name:'Verified B',faction:'aleph'}
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json','.woff2':'font/woff2'}
const server = createServer(async (req,res) => {
 const send=(value,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value))}
 if(req.url.startsWith('/api/aurora-campaign'))return send({revision:'test',publishedAt:'',state})
 if(req.url.startsWith('/api/aurora-activity'))return failActivity ? send({error:'Unavailable'},503) : send(await store.activity(state.turn))
 if(req.url.startsWith('/api/aurora-registration'))return send({cap:5,total:0,available:true,factions:AURORA_REGISTRATION_FACTIONS.map(f=>({...f,count:0,locked:false}))})
 if(req.url.startsWith('/api/aurora-signup'))return send({ready:true,account:null,registration:null})
 if(req.url.startsWith('/api/aurora-games'))return send({error:'Sign in with your campaign Discord account.'},401)
 if(req.url.startsWith('/api/'))return send({error:'Unrelated fixture API'},503)
 let file=resolve('dist','.'+new URL(req.url,'http://localhost').pathname);if(!extname(file))file=resolve('dist/app-shell.html')
 try{res.setHeader('content-type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404);res.end()}
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const root=`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({headless:true,...(process.env.CAMPAIGN_TEST_CHROMIUM?{executablePath:process.env.CAMPAIGN_TEST_CHROMIUM}:{}),args:['--no-sandbox']})
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[];page.on('pageerror',e=>errors.push(e.message))
 const mockRoute=async route=>{const req=route.request();let body;try{body=req.postDataJSON()}catch{};if(body?.action==='session'||new URLSearchParams(req.postData()||'').get('action')==='session'||new URL(req.url()).searchParams.get('action')==='session')return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,authenticated:true,permissions:{},user:{role:'Commissioner',displayName:'Test commissioner',enabled:true}})});if(!req.url().startsWith(root))return route.abort();return route.continue()}
 await page.route('**/*',mockRoute)
 await page.goto(`${root}/campaign/aurora-vii`)
 await page.getByRole('heading',{name:'Registration open · Turn 1 awaiting announcement'}).waitFor()
 assert.equal(await page.getByRole('link',{name:'Submit Campaign Game →',exact:true}).count(),0)
 assert((await page.locator('main').innerText()).includes('11 campaign factions'))
 await page.goto(`${root}/campaign/aurora-vii/rules`)
 await page.getByRole('heading',{name:'Game scores & Tournament Points'}).waitFor()
 assert((await page.locator('main').innerText()).includes('8–6 OP gives 5–2 TP'))
 state={...emptyAuroraState(),turn:1};state.territories.forEach((t,i)=>t.vulnerable=i<4)
 state.totals=[{location:'korin-range',faction:'Nomads',tp:999,op:999}]
 const input={turn:1,kind:'territory',mission:'Claim the Frontier',date:'2026-10-13',location:'korin-range',opA:8,opB:6}
 const first=await store.submit(input,a,b,state)
 await page.goto(`${root}/campaign/aurora-vii/standings`)
 await page.getByText('0 confirmed games this Turn.',{exact:true}).waitFor()
 assert.equal(await page.getByText('Verified A vs Verified B',{exact:true}).count(),0)
 await store.act({id:first.id,revision:first.revision,action:'confirm'},b.userId,false)
 await page.getByRole('button',{name:'Refresh live results'}).click()
 await page.getByText('Verified A vs Verified B',{exact:true}).waitFor()
 assert.equal(await page.locator(`#battle-${first.id}`).count(),1)
 assert.equal(await page.getByText('8–6 OP · 5–2 TP',{exact:true}).count(),1)
 assert.equal(await page.getByRole('heading',{name:'Published campaign battles'}).count(),0)
 assert.equal(await page.getByRole('heading',{name:'Published Turn TP / OP'}).count(),0)
 await page.goto(`${root}/campaign/aurora-vii/map`)
 await page.getByRole('button',{name:/Select Korin Range/}).click()
 await page.locator('.aurora-map-grid').getByText('1 confirmed battle',{exact:true}).waitFor()
 await page.getByRole('link',{name:'View confirmed battle →'}).click()
 await page.locator(`#battle-${first.id}`).waitFor()
 state.narrativeMission={title:'Released narrative fixture',briefing:'Published rules.',reward:'Published reward.',sheetUrl:''}
 const narrative=await store.submit({...input,kind:'narrative'},a,b,state)
 await store.act({id:narrative.id,revision:narrative.revision,action:'confirm'},b.userId,false)
 await page.goto(`${root}/campaign/aurora-vii/standings`)
 await page.getByText('2 confirmed games this Turn.',{exact:true}).waitFor()
 const territoryTable=page.getByRole('heading',{name:'Territory battle totals'}).locator('..').locator('table')
 const narrativeTable=page.getByRole('heading',{name:'Narrative Mission totals'}).locator('..').locator('table')
 assert((await territoryTable.innerText()).includes('Korin Range'))
 assert((await narrativeTable.innerText()).includes('Narrative Mission'))
 assert(!(await territoryTable.innerText()).includes('999'))
 assert(!(await territoryTable.innerText()).includes('Narrative Mission'))
 await page.setViewportSize({width:390,height:844})
 await page.goto(`${root}/campaign/aurora-vii/map`)
 const selector=page.getByRole('combobox',{name:'Choose a territory'})
 await selector.selectOption('korin-range')
 await page.locator('.aurora-map-grid').getByText('1 confirmed battle',{exact:true}).waitFor()
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1))
 assert(await page.locator('.aurora-map-surface').evaluate(e=>e.scrollWidth<=e.clientWidth+1))
 assert(await selector.evaluate(e=>e.getBoundingClientRect().height>=44))
 assert(await page.locator('.aurora-mobile-marker[data-activity="active"]').first().isVisible())
 const nav=page.getByRole('combobox',{name:'Campaign page',exact:true});await nav.selectOption('register')
 await page.getByRole('heading',{name:'Choose your faction'}).waitFor()
 await page.waitForFunction(()=>!document.querySelector('input[value="nomads"]')?.disabled)
 assert(await page.locator('input[value="nomads"]').isEnabled())
 const commissioner=await browser.newPage({viewport:{width:390,height:844}})
 commissioner.on('pageerror',e=>errors.push(e.message))
 await commissioner.route('**/*',mockRoute)
 await commissioner.addInitScript(()=>localStorage.setItem('lobo-session-token','fixture-commissioner-token'))
 await commissioner.goto(`${root}/commissioner/aurora-vii/registration`)
 await commissioner.getByRole('heading',{name:'Aurora VII registration form',exact:true}).waitFor()
 await commissioner.getByRole('heading',{name:'Choose your faction'}).waitFor()
 await commissioner.waitForFunction(()=>!document.querySelector('input[value="nomads"]')?.disabled)
 assert(await commissioner.locator('input[value="nomads"]').isEnabled())
 assert.equal(await commissioner.locator('.aurora-registration-factions').evaluate(e=>getComputedStyle(e).display),'grid')
 await commissioner.close()
 await page.goto(`${root}/campaign/aurora-vii/standings`)
 await page.getByText('2 confirmed games this Turn.',{exact:true}).waitFor()
 failActivity=true;await page.getByRole('button',{name:'Refresh live results'}).click()
 await page.getByRole('alert').filter({hasText:'last successful check'}).waitFor()
 assert.equal(await page.locator(`#battle-${first.id}`).count(),1)
 assert.deepEqual(errors,[])
 console.log('PASS: prelaunch guidance, eleven factions, scoring example, confirmed-only ledger battle history, map-to-history link, unified totals, failed-refresh honesty, mobile navigation/map/selection and authenticated commissioner registration form.')
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true})}
