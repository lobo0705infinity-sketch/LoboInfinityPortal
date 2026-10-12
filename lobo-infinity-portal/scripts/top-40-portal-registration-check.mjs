import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const source = fs.readFileSync('backend/Top40PortalRegistration.gs', 'utf8')
const names = new Map([['existing', { player: 'Existing', active: false, division: 'Retired' }]])
const imported = new Set(), logs = [], headers = ['Timestamp', 'Email', 'What is your Lobo Portal User Name?', 'Discord']
const rows = [['Today','private@example.com',' Newbie ','private-discord'], ['Today','private@example.com','EXISTING','private-discord'], ['Today','','','NoHandle'], ['Today','','=IMPORTDATA("https://bad")','']]
const target = { getId: () => 'target' }
const sheet = { getName:()=> 'Form Responses 2', getParent:()=>target, getSheetId:()=>123, getLastRow:()=> rows.length+1, getLastColumn:()=>4, getRange: row => ({getDisplayValues:()=> [row===1?headers:rows[row-2]]}) }
const context = vm.createContext({ Set, Number, PUBLIC_SNAPSHOT_TOP40_REGISTRATION_SHEET:'Form Responses 2', PUBLIC_SNAPSHOT_TOP40_PORTAL_NAME_HEADERS:['What is your Lobo Portal User Name?','Lobo Portal User Name','Lobo Portal Name'], normalizePublicSnapshotTop40Header_: x=>String(x).toLowerCase().replace(/[^a-z0-9]/g,''),lifGetTargetSpreadsheet_:()=>target,lifWasImported_:(_log,key)=>imported.has(key),lifWriteImportLog_:(_log,key,_type,_row,status,message)=>{logs.push({key,status,message});if(['Imported','Duplicate'].includes(status)) imported.add(key)},createCanonicalPlayer: handle=>{const key=handle.toLowerCase();if(names.has(key)) return {duplicate:true,success:false};names.set(key,{player:handle,active:true});return {success:true,row:10}},Logger:{log(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},lifEnsureImportLog_:()=>({}) })
vm.runInContext(source,context)
assert.equal(context.isTop40PortalRegistrationSheet_(sheet),true)
assert.equal(context.isTop40PortalRegistrationSheet_({...sheet,getParent:()=>({getId:()=> 'unrelated'})}),false)
assert.equal(context.importTop40PortalRegistrationRow_(sheet,2,{}).created,true)
assert.equal(names.get('newbie').active,true)
assert.equal(context.importTop40PortalRegistrationRow_(sheet,3,{}).existing,true)
assert.deepEqual(names.get('existing'),{player:'Existing',active:false,division:'Retired'})
assert.equal(context.importTop40PortalRegistrationRow_(sheet,2,{}).alreadyProcessed,true)
assert.equal(names.size,2)
assert.equal(context.importTop40PortalRegistrationRow_(sheet,4,{}).rejected,true)
assert.equal(context.importTop40PortalRegistrationRow_(sheet,5,{}).rejected,true)
assert.throws(()=>context.readTop40PortalHandle_(['Lobo Portal Name','Lobo Portal User Name'],['One','Two']),/Conflicting/)
assert.equal(context.readTop40PortalHandle_(['Lobo Portal Name','Lobo Portal User Name'],['One','one']),'One')
assert.equal(context.handleTop40RegistrationFormSubmit({range:{getSheet:()=>({...sheet,getName:()=> 'Unrelated'})}}).ignored,true)
assert.ok(!JSON.stringify([...names.values(),...logs]).includes('private@example.com'))
assert.ok(!JSON.stringify([...names.values(),...logs]).includes('private-discord'))
assert.match(source,/setRequired\(true\)/)
assert.match(source,/getTriggerSourceId\(\) === target.getId\(\)/)
console.log('PASS: Top 40 creates active portal players, retains existing profiles, ignores unrelated forms, rejects missing/conflicting/formula handles, retries idempotently and excludes private contact fields.')
