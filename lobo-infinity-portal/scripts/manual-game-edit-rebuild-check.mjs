import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync('backend/Rebuild.gs', 'utf8')
const submissions = fs.readFileSync('backend/CanonicalSubmissionService.gs', 'utf8')
const calls = { cache: 0, marks: [] }

const context = vm.createContext({
  CONFIG: { SHEETS: { FORM: 'Form Responses', SETTINGS: 'Settings', STREAMS: 'Streams' } },
  FORM: { LOSER_ARMY_LIST_ID: 22 },
  Math,
  clearPortalCache() { calls.cache += 1 },
  markCanonicalRebuildRequired_(details) { calls.marks.push(details); return { required: true } },
})

vm.runInContext(source, context)

function edit(sheetName, row, column, numRows = 1, numColumns = 1) {
  return {
    range: {
      getColumn: () => column,
      getNumColumns: () => numColumns,
      getNumRows: () => numRows,
      getRow: () => row,
      getSheet: () => ({ getName: () => sheetName }),
    },
  }
}

context.onEdit(edit('Settings', 2, 1))
context.onEdit(edit('Streams', 2, 1))
assert.equal(calls.cache, 2, 'Settings and Streams cache invalidation must remain unchanged.')
assert.equal(calls.marks.length, 0, 'Settings and Streams must not queue canonical game rebuilds.')

context.onEdit(edit('Form Responses', 83, 7))
assert.deepEqual(JSON.parse(JSON.stringify(calls.marks.at(-1))), {
  reason: 'manual-authoritative-games-edit',
  targetRow: 83,
  workflow: 'manual-edit',
})

const markedAfterGameEdit = calls.marks.length
context.onEdit(edit('Form Responses', 1, 7))
assert.equal(calls.marks.length, markedAfterGameEdit, 'Header edits must not queue a rebuild.')

context.onEdit(edit('Players', 83, 7))
assert.equal(calls.marks.length, markedAfterGameEdit, 'Unrelated sheet edits must not queue a rebuild.')

context.onEdit(edit('Form Responses', 83, 24))
assert.equal(calls.marks.length, markedAfterGameEdit, 'Columns outside the canonical game schema must not queue a rebuild.')

context.onEdit(edit('Form Responses', 1, 6, 2, 2))
assert.equal(calls.marks.length, markedAfterGameEdit + 1, 'An edit intersecting a canonical data row must queue a rebuild.')
assert.equal(calls.marks.at(-1).targetRow, 2)

const onEditSource = source.match(/function onEdit\(e\) \{[\s\S]*?\n\}/)?.[0] ?? ''
assert.match(onEditSource, /markCanonicalRebuildRequired_/)
assert.doesNotMatch(onEditSource, /rebuildGameEngine\s*\(/)
assert.doesNotMatch(onEditSource, /rebuildEverything\s*\(/)
assert.doesNotMatch(onEditSource, /setValue|setValues|appendRow/)

assert.match(submissions, /markCanonicalRebuildRequired_[\s\S]*\.appendRow\(row\)[\s\S]*coordinateCanonicalRebuild/)

console.log('PASS: Settings and Streams onEdit behavior remains unchanged')
console.log('PASS: canonical Games data edits queue the existing rebuild obligation')
console.log('PASS: headers, unrelated sheets, and non-canonical columns are ignored')
console.log('PASS: onEdit performs no synchronous rebuild or spreadsheet write')
console.log('PASS: submission-driven canonical rebuild remains unchanged')
