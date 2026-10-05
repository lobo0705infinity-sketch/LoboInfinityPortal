import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

class Sheet {
  constructor(rows) { this.rows = rows; this.columns = 26; this.interrupt = false }
  getMaxColumns() { return this.columns }
  insertColumnsAfter(_column, count) { this.columns += count }
  getLastColumn() { return this.columns }
  getLastRow() { return this.rows.length }
  getDataRange() { return { getValues: () => this.rows.map(row => row.slice()) } }
  appendRow(row) { this.rows.push([...row]) }
  getRange(row, column, height = 1, width = 1) {
    return { getValues: () => Array.from({length:height}, (_,i) =>
      Array.from({length:width}, (_,j) => this.rows[row-1+i]?.[column-1+j] ?? '')),
    setValue: value => { this.rows[row-1][column-1] = value },
    setValues: values => {
      for (let i=0;i<height;i++) {
        this.rows[row-1+i] ||= []
        for (let j=0;j<width;j++) this.rows[row-1+i][column-1+j] = values[i][j]
        if (this.interrupt) { this.interrupt=false; throw new Error('interrupted partial queue write') }
      }
    } }
  }
}
const row = player => Object.assign(Array(25).fill(''), {4:player,5:'Opponent',17:'casual'})
const canonical = new Sheet([Array(25).fill(''),row('A'),row('B'),row('C')])
const events = new Sheet([['Event ID']]), queue = new Sheet([['Queue ID']])
const properties = new Map(); let locked=false; let uuid=0
const context=vm.createContext({console,Number,Date,JSON,Math,String,Object,
 CONFIG:{SHEETS:{FORM:'Form Responses'}}, Logger:{log(){}},
 Utilities:{getUuid:()=>`submission-${++uuid}`}, SpreadsheetApp:{flush(){}},
 LockService:{getScriptLock:()=>({hasLock:()=>locked,waitLock(){assert.equal(locked,false);locked=true},releaseLock(){locked=false}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},
 lifGetTargetSpreadsheet_:()=>({getSheetByName:()=>canonical}),
 validateGame:r=>Boolean(r[4]&&r[5]),getGameEngineEventId:()=>'',getGameEngineGameType:r=>r[17],
})
for(const file of ['CanonicalRebuildCoordinator.gs','GamePipelineReliability.gs','AutomationApi.gs']) vm.runInContext(fs.readFileSync('backend/'+file,'utf8'),context)
context.ensureAutomationEventsSheet=()=>events;context.ensureAutomationQueueSheet=()=>queue
context.getAutomationRules=()=>({gameSubmitted:{enabled:true}})
context.getRuleDestinations=()=>['discord','portal'];context.getAutomationTimestamp=()=>new Date().toISOString()
context.withGamePipelineLock_(() => {
  context.markCanonicalRebuildRequired_({ reason: 'nested-lock-test' })
  assert.equal(locked, true, 'rebuild bookkeeping must not release the enclosing submission lock')
})
assert.equal(locked, false)
canonical.interrupt=true
assert.throws(()=>context.ensureCanonicalGameIdentities_(canonical),/interrupted/)
assert.notEqual(canonical.rows[0][25],'Game ID','migration marker is written only after all IDs')
context.ensureCanonicalGameIdentities_(canonical)
assert.deepEqual(canonical.rows.slice(1).map(r=>r[25]),[1,2,3])
assert.equal(canonical.columns,28)
assert.equal(context.recoverCanonicalGameOutbox_().attempted,0,'migration must not reannounce historical games')
canonical.rows.splice(1,1); canonical.rows.splice(1,2,...canonical.rows.slice(1).reverse())
context.ensureCanonicalGameIdentities_(canonical)
assert.deepEqual(canonical.rows.slice(1).map(r=>r[25]),[3,2],'sorting/deletion preserves assigned URLs')
const appended=context.appendCanonicalGameDurably_(canonical,row('D'),'google-form:test-1')
assert.equal(appended.gameId,4,'deleted ID 1 must not be reused')
assert.equal(canonical.rows.at(-1)[27],'Pending','game and enqueue obligation persist together')
const duplicate=context.appendCanonicalGameDurably_(canonical,row('D'),'google-form:test-1')
assert.equal(duplicate.gameId,4);assert.equal(canonical.rows.length,4,'retry after append crash must not duplicate a game')
queue.interrupt=true
assert.equal(context.recoverCanonicalGameOutbox_().results[0].success,false)
assert.equal(canonical.rows.at(-1)[27],'Pending','partial fan-out must retain obligation')
queue.rows[1][4]='Sent'
assert.equal(context.recoverCanonicalGameOutbox_().results[0].success,true)
assert.equal(queue.rows.length,3);assert.equal(events.rows.length,2)
assert.equal(queue.rows[1][4],'Sent','recovery never resets an existing delivery')
assert.equal(canonical.rows.at(-1)[27],'Queued')
assert.equal(context.recoverCanonicalGameOutbox_().attempted,0)
// Manual appended rows also receive a new persistent identity and obligation.
canonical.rows.push(row('E'));context.ensureCanonicalGameIdentities_(canonical)
assert.equal(canonical.rows.at(-1)[25],5);assert.equal(canonical.rows.at(-1)[27],'Pending')
vm.runInContext(fs.readFileSync('backend/GameScoreCorrectionApi.gs','utf8'),context)
context.FORM = {GAME_RESULT:19,PLAYER1:4,PLAYER2:5,EVENT_ID:16}
context.getResultSubmissionString = String; context.getGameEngineFormValue = () => ''
assert.equal(context.getGameScoreCorrectionTarget(3).row[4], 'C', 'score correction follows the game after sorting')
assert.equal(context.getGameScoreCorrectionTarget(1).found, false, 'deleted game never selects a different row')
canonical.rows.at(-1)[25]=4
assert.throws(()=>context.ensureCanonicalGameIdentities_(canonical),/Duplicate/)
console.log('Stable IDs, deletion/sorting, append crash, partial fan-out, sent-job preservation and manual append recovery PASS')

// Rebuilding intelligence retains good persisted rows even when another source is absent.
vm.runInContext(fs.readFileSync('backend/ArmyListApi.gs','utf8'),context)
context.getArmyIntelligenceRequiredArmyListIds=()=>['good','missing','pending']
context.getArmyIntelligenceSourceListLookup=()=>({good:{id:'good',armyCode:'good-code'},pending:{id:'pending',armyCode:'pending-code'}})
context.readPersistedDeterministicArmyIntelligenceRows=()=>[['Header'],['good persisted roster']]
context.getPersistedArmyIntelligenceSnapshotLookup=()=>({})
context.getArmyIntelligenceHash=x=>x
context.findPersistedArmyIntelligenceSnapshot=source=>source.armyListId==='good'?{status:'decoded'}:null
assert.equal(context.buildArmyIntelligenceForGameEngineRows([])[1][0],'good persisted roster')
vm.runInContext(fs.readFileSync('backend/ArmyIntelligenceApi.gs','utf8'),context)
canonical.rows.pop()
context.getApiParameters=()=>({snapshots:JSON.stringify([{snapshotKey:'good'},{snapshotKey:'bad'}]),deferReadModelRebuild:'true'})
context.getApiParameter=(p,k)=>p[k];context.buildArmyIntelligenceSources=()=>[{snapshotKey:'good'},{snapshotKey:'bad'}]
context.validateArmyIntelligenceRefreshSnapshot=source=>{if(source.snapshotKey==='bad')throw new Error('bad decoded roster')}
context.findPersistedArmyIntelligenceSnapshot=()=>null
context.buildPersistedArmyIntelligenceSnapshotRow=source=>[source.snapshotKey]
let persisted=[];context.upsertPersistedArmyIntelligenceSnapshotRows=rows=>persisted.push(...rows)
context.jsonOutput=x=>x
const batch=context.refreshArmyIntelligence({})
assert.equal(batch.updated,1);assert.equal(batch.rejectedSnapshots.length,1);assert.equal(persisted[0][0],'good')
console.log('Missing historical source isolation and mixed refresh batch persistence PASS')
