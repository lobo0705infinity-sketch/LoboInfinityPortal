import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const now=Date.now(), t=new Date(now-180000), activatedAt=new Date(now-3600000).toISOString();
const values=[['Timestamp','Player','Opponent','Mission'],[t,'Arg','Dr Hareng','Uplink Center']];
const matches=[{status:'Active',playerA:'Arg',playerB:'Dr Hareng',activatedAt}];
let held=false,blocked=false,imports=0,fail=false,logs=[],triggers=[];
const lock={tryLock:()=>blocked?false:(held=true),waitLock:()=>{held=true},releaseLock:()=>{held=false}};
const source={getFormUrl:()=>'/forms/form-id',getSheetId:()=>521529464,getDataRange:()=>({getValues:()=>values}),getRange:()=>({})};
const ctx=vm.createContext({Date,Number,Math,JSON,Error,LockService:{getScriptLock:()=>lock},Logger:{log:()=>{}},
 SpreadsheetApp:{openById:()=>({getSheets:()=>[source]})},LIF_FORMS:{PROPERTIES:{RESPONSE_SPREADSHEET_ID:'book',TOP40_FORM_ID:'form'},TYPES:{TOP40:'top-40'}},TOP40_FORM_EVENT_ID:'top40',
 lifRequireProperty_:key=>key==='form'?'form-id':'book-id',lifGetTargetSpreadsheet_:()=>({}),
 lifEnsureImportLog_:()=>({getDataRange:()=>({getValues:()=>[[],...logs]})}),readEventBracketMatches_:()=>matches,
 lifBuildCasualNamedValuesFromResponseRow_:()=>({}),importTop40FormSubmission_:()=>{assert.equal(held,true);imports++;if(fail)throw Error('temporary');matches[0].status='Completed';return {gameId:161,matchId:'W3-M3'}},
 lifWriteImportLog_:(_l,key,type,row,status,message)=>logs.push([key,type,new Date(),row,status,message]),
 publishDirtyTop40PublicProjectionBestEffort_:()=>{assert.equal(held,false);return {success:true}},
 ScriptApp:{getProjectTriggers:()=>triggers.map(handler=>({getHandlerFunction:()=>handler})),newTrigger:handler=>({timeBased:()=>({everyMinutes:n=>{assert.equal(n,1);return {create:()=>triggers.push(handler)}}})})}});
vm.runInContext(fs.readFileSync('backend/Top40FormInboxRecovery.gs','utf8'),ctx);
const select=(v=values,l=[],m=matches)=>ctx.top40FormInboxCandidates_(v,521529464,l,m,now);
assert.equal(select().length,1);
assert.equal(select(values,[['521529464:2:00','','','','Imported']]).length,0);
assert.equal(select(values,[['521529464:2','','','','Duplicate']]).length,0);
assert.equal(select([values[0],[new Date(now),'Arg','Dr Hareng','Uplink Center']]).length,0);
assert.equal(select(values,[],[{...matches[0],activatedAt:new Date(now).toISOString()}]).length,0);
assert.equal(select(values,[],[{...matches[0],status:'Completed'}]).length,0);
blocked=true;assert.equal(ctx.recoverTop40FormInbox().skipped,true);assert.equal(imports,0);
blocked=false;fail=true;assert.equal(ctx.recoverTop40FormInbox().success,false);assert.equal(held,false);assert.equal(select(values,logs).length,0);
logs[0][2]=new Date(now-360000);fail=false;assert.equal(ctx.recoverTop40FormInbox().recovered.length,1);assert.equal(imports,2);
assert.equal(ctx.recoverTop40FormInbox().recovered.length,0);assert.equal(imports,2);
ctx.installTop40FormInboxRecovery();ctx.installTop40FormInboxRecovery();assert.equal(triggers.length,1);
console.log('PASS: lock contention retains inbox; retry backoff; duplicate and rematch protection; original response recovery; publish outside lock; idempotent installation.');
