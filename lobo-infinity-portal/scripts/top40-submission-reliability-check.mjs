import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const eventId='event-lobo-s-american-top-40'
let rows,matches,dirty,published,fail,held,rebuilds,triggers
const props=new Map(), lock={hasLock:()=>held,waitLock:()=>{held=true},tryLock:()=>held?false:(held=true),releaseLock:()=>{held=false}}
const sheet={getDataRange:()=>({getValues:()=>[[],...rows]})}
const ctx=vm.createContext({Date,Set,console:{error:()=>{}},Logger:{log:()=>{}},
 LockService:{getScriptLock:()=>lock},SpreadsheetApp:{flush:()=>{}},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},
 ScriptApp:{getProjectTriggers:()=>triggers.map(()=>({getHandlerFunction:()=> 'recoverTop40Submissions'})),newTrigger:()=>({timeBased:()=>({everyMinutes:n=>{assert.equal(n,5);return {create:()=>triggers.push(1)}}})})},
 CONFIG:{SHEETS:{FORM:'Form Responses'}},FORM:{MISSION:3,PLAYER1:4,PLAYER2:5,GAME_RESULT:18},TOP40_PUBLIC_PROJECTION_DIRTY_PROPERTY:'dirty',
 lifGetTargetSpreadsheet_:()=>({getSheetByName:()=>sheet}),canonicalGameId_:r=>r?.[25],getGameEngineEventId:r=>r[16],validateGame:()=>true,
 resolveIndividualDoubleEliminationPlayer:v=>v==='Wax'?'aro_wax':v,getGameEngineExplicitResult:r=>r[18]==='Player 1 Victory'?'player1':r[18]==='Player 2 Victory'?'player2':'draw',
 readEventBracketMatches_:()=>structuredClone(matches),writeEventBracketMatches_:(_e,m)=>{matches=structuredClone(m);if(fail==='write'){fail='';throw Error('after write')}},
 markPublicProjectionRequired_:()=>{dirty=true},publishDirtyTop40PublicProjectionBestEffort_:()=>{if(fail==='publish')return {success:false,error:'offline'};if(dirty){published++;dirty=false}return {success:true}},
 invalidateEventEngineSnapshotCache:()=>{},invalidatePortalCacheGroup:()=>{},invalidateEventRegistrationCaches:()=>{},buildAuditIssue:(severity,title)=>({severity,title})})
for(const f of ['GamePipelineReliability.gs','DoubleEliminationBracketApi.gs','CanonicalSubmissionService.gs','Top40SubmissionReliability.gs'])vm.runInContext(fs.readFileSync(`backend/${f}`,'utf8'),ctx)
ctx.readEventBracketMatches_=()=>structuredClone(matches)
ctx.writeEventBracketMatches_=(_e,m)=>{matches=structuredClone(m);if(fail==='write'){fail='';throw Error('after write')}}
ctx.getEventBracketMission_=()=> 'Corporate Appropriation'
ctx.resolveEventBracketByes_=()=>{}
ctx.activatePlayableEventBracketMatches_=state=>state.forEach(m=>{if(m.status==='Pending'&&m.playerA&&m.playerB)m.status='Active'})
ctx.appendCanonicalGameDurably_=(_s,row,key)=>{let r=rows.find(r=>r[26]===key);if(r)return {gameId:r[25],targetRow:2,duplicate:true};r=[...row];r[25]=140;r[26]=key;rows.push(r);if(fail==='append'){fail='';throw Error('after append')}return {gameId:140,targetRow:2}}
ctx.markCanonicalRebuildRequired_=()=>({generation:1})
ctx.validateCanonicalGame=()=>({valid:true,value:{eventId,player:'Vision',opponent:'Wax'}})
ctx.buildCanonicalGameRow=()=>{const r=Array(28).fill('');r[3]='Corporate Appropriation';r[4]='Vision';r[5]='aro_wax';r[16]=eventId;r[18]='Player 1 Victory';return r}
ctx.canonicalSubmissionBuildPortalGameCommand_=()=>({})
ctx.ensureResultSubmissionArmyListHeaders=()=>{}
ctx.canonicalSubmissionRecordPortalAudit_=()=>{assert.equal(matches[0].status,'Completed');if(fail==='audit')throw Error('offline')}
ctx.canonicalSubmissionEnqueueGameAutomation_=()=>{}
ctx.invalidateResultSubmissionCaches=()=>{}
ctx.coordinateCanonicalRebuild=()=>{rebuilds++;throw Error('must not run')}
function reset(){rows=[];matches=[{matchId:'W1-M3',bracket:'Winners',playerA:'Wax',seedA:8,playerB:'Vision',seedB:25,status:'Active',nextWinnerMatch:'W2-M2',nextWinnerSlot:'A',nextLoserMatch:'L1-M2',nextLoserSlot:'A'},{matchId:'W2-M2',playerA:'',playerB:'Rysanov',status:'Pending'},{matchId:'L1-M2',playerA:'',playerB:'Sam',status:'Pending'}];dirty=false;published=0;fail='';held=false;rebuilds=0;triggers=[];props.clear()}
const submit=()=>ctx.canonicalSubmitPortalGame_({params:{eventId,matchId:'W1-M3'},commissionerContext:{}},'top-40')
function completed(){assert.equal(matches[0].status,'Completed');assert.equal(matches[0].gameId,140);assert.equal(matches[0].winner,'Vision');assert.equal(matches[1].playerA,'Vision');assert.equal(matches[2].playerA,'Wax');assert.equal(rows.length,1)}
reset();submit();completed();assert.equal(rebuilds,0);submit();completed()
reset();fail='audit';assert.equal(submit().success,true);completed()
reset();fail='append';assert.throws(submit,/after append/);assert.equal(matches[0].status,'Active');submit();completed()
reset();fail='append';assert.throws(submit);assert.equal(ctx.recoverTop40Submissions().success,true);completed();assert.equal(published,1)
reset();fail='write';assert.throws(submit,/after write/);assert.equal(dirty,true);assert.equal(ctx.recoverTop40Submissions().success,true);completed();assert.equal(published,1)
reset();submit();fail='publish';assert.equal(ctx.recoverTop40Submissions().success,false);assert.equal(dirty,true);assert.equal(ctx.getTop40SubmissionHealthIssues_()[0].severity,'critical');fail='';assert.equal(ctx.recoverTop40Submissions().success,true);assert.equal(dirty,false);assert.equal(ctx.getTop40SubmissionHealthIssues_().length,0)
reset();submit();rows[0][18]='Draw';assert.equal(ctx.recoverTop40Submissions().success,false);assert.equal(matches[0].winner,'Vision')
reset();fail='append';assert.throws(submit);rows[0][4]='Unrelated';assert.equal(ctx.recoverTop40Submissions().success,false);assert.equal(matches[0].status,'Active')
reset();submit();const duplicate=[...rows[0]];duplicate[25]=141;rows.push(duplicate);assert.equal(ctx.recoverTop40Submissions().success,false);assert.equal(rows.length,2)
reset();held=true;assert.equal(ctx.recoverTop40Submissions().skipped,true);held=false;ctx.installTop40SubmissionRecovery();ctx.installTop40SubmissionRecovery();assert.equal(triggers.length,1)
assert.throws(()=>ctx.top40MatchSubmissionKey_('unrelated','W1-M3'))
console.log('PASS interruption after append/write; idempotent retry; graph advancement; independent publication retry; audit alerts; participant/conflict rejection; lock and trigger idempotency.')
