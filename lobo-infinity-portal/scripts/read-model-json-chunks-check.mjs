import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
for (const model of ['ArmyLists','ArmyIntelligence']) {
  const file=model==='ArmyLists'?'ArmyListApi':'ArmyIntelligenceApi'
  let rows=[]
  const sheet={getLastRow:()=>rows.length,getRange:()=>({getValues:()=>rows.slice(1)})}
  const context=vm.createContext({Date,Set,console,CONFIG:{SHEETS:{ARMY_LISTS_READ_MODEL:'lists',ARMY_INTELLIGENCE_READ_MODEL:'intelligence'}},lifGetTargetSpreadsheet_:()=>({getSheetByName:()=>sheet})})
  vm.runInContext(fs.readFileSync(`backend/${file}.gs`,'utf8'),context)
  context.normalizeArmyIntelligenceReadModelRoleFlags=p=>p
  const prefix='{"lists":[{"name":"'
  for (const boundary of ['=6','\'quoted',' text ']) {
    const payload={lists:[{name:'x'.repeat(45000-prefix.length)+boundary+'z'.repeat(50000)}]}
    const encoded=context[`build${model}ReadModelRowsFromPayload`](payload)
    // Model Sheets' formula and literal-leading-apostrophe interpretation.
    rows=encoded.map(row=>row.map((cell,index)=>index===3 && typeof cell==='string'?cell.startsWith('=')?'#ERROR!':cell.startsWith("'")?cell.slice(1):cell:cell))
    const actual=context[`read${model}ReadModelPayload`]()
    assert.deepEqual(JSON.parse(JSON.stringify(actual.lists)),payload.lists,`${model}: ${boundary} must round trip`)
    assert.equal(rows[2][3].startsWith('\u200B'),true,'every persisted chunk has a literal prefix')
  }
  const legacy={lists:[{name:'old payload'}]}
  rows=[['Key','Generated At','Chunk Index','Payload JSON Chunk'],[model==='ArmyLists'?'armyLists:v2':'armyIntelligence:v4','',1,JSON.stringify(legacy)]]
  // Use the generator's actual key so key-version changes remain covered.
  rows[1][0]=context[`build${model}ReadModelRowsFromPayload`](legacy)[1][0]
  assert.deepEqual(JSON.parse(JSON.stringify(context[`read${model}ReadModelPayload`]().lists)),legacy.lists)
}
console.log('PASS: Sheets formula/apostrophe protection, chunk whitespace, multi-chunk round trip and legacy compatibility')
