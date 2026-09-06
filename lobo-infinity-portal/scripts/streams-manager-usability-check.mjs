import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const manager = read('src/pages/CommunityManager.tsx')
const styles = read('src/App.css')
const api = read('src/services/api.ts')
const router = read('src/App.tsx')
const operations = read('backend/OperationsApi.gs')
const streams = read('backend/StreamsApi.gs')
const projection = read('backend/PublicDetailProjection.gs')
const snapshot = read('backend/PublicSnapshotExporter.gs')
const publicPage = read('src/public/SnapshotPublicApp.tsx')

// Canonical schema and supported operations remain the single source of truth.
for (const header of ['Date', 'Division', 'Mission', 'YouTube URL', 'Stream Title', 'Platform', 'Active', 'Stream Type']) {
  assert.match(streams, new RegExp(`"${header}"`))
}
assert.match(router, /community-manager\/streams/)
assert.match(api, /getCommissionerStreams[\s\S]*?scope: 'streams'/)
assert.match(operations, /function saveOperationsStream\([\s\S]*?STREAM_HEADERS\.length[\s\S]*?setValues/)
assert.match(operations, /function deleteOperationsStream\([\s\S]*?sheet\.deleteRow/)
assert.match(projection, /savePublicDetailStream_[\s\S]*?markPublicDetailProjectionDirty_/)
assert.match(projection, /deletePublicDetailStream_[\s\S]*?markPublicDetailProjectionDirty_/)

// Every manager control is backed by an existing operation.
assert.match(manager, /operationsAction\('saveStream', draft\)/)
assert.match(manager, /operationsAction\('saveStream', \{ \.\.\.stream, active: !stream\.active \}\)/)
assert.match(manager, /operationsAction\('deleteStream', \{ id: stream\.id \}\)/)
assert.match(manager, /window\.confirm\(`Delete “\$\{getStreamTitle\(stream\)\}”\? This cannot be undone\.`\)/)
assert.match(manager, /onDelete\(stream\)/)
assert.match(manager, /target="_blank" rel="noopener noreferrer">Open video/)
assert.match(manager, /getSafeStreamUrl/)
assert.doesNotMatch(manager.match(/function StreamList[\s\S]*?function getStreamTitle/)?.[0] || '', /<p>\{stream\.youtubeUrl/)

// Search, filters, states, desktop table, and compact mobile presentation.
assert.match(manager, /placeholder="Search by title"/)
assert.match(manager, /All platforms/)
assert.match(manager, /All visibility/)
assert.match(manager, /No streams match the active search and filters\./)
assert.match(manager, /Loading Streams/)
assert.match(manager, /streamsState\.status === 'error'/)
assert.match(manager, /className="streams-manager-table"/)
assert.match(manager, /className="streams-manager-badge platform"/)
assert.match(manager, /stream\.active \? 'Visible' : 'Hidden'/)
assert.match(styles, /\.streams-manager-table[\s\S]*?@media \(max-width: 760px\)[\s\S]*?\.streams-manager-table tr/)
assert.match(styles, /\.streams-manager-primary/)

// Public projection continues to omit hidden streams and the public page uses safe new-tab links.
assert.match(streams, /stream\.youtubeUrl !== "" &&[\s\S]*?stream\.active/)
assert.match(snapshot, /filter\(function\(stream\) \{ return stream\.youtubeUrl && String\(stream\.active\)\.toLowerCase\(\) !== "false"; \}\)/)
assert.match(publicPage, /function StreamsDirectory/)
assert.match(publicPage, /target="_blank" rel="noopener noreferrer">Watch/)

console.log('PASS - Streams Manager uses canonical CRUD, compact responsive management, real filters, safe links, and preserves public visibility rules.')
