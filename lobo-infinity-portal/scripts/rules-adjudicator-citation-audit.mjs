import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const [benchmark, manifest, index] = await Promise.all([
  readFile(new URL('data/infinity-rules/rules-adjudicator-benchmark.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('data/infinity-rules/sources.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('data/infinity-rules/rules-search-index.json', root), 'utf8').then(JSON.parse),
])

const sources = new Map(manifest.sources.map((source) => [source.id, source]))
const normalized = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const ignoredSectionTerms = new Set(['and', 'automatic', 'combat', 'effects', 'equipment', 'faq', 'requirements', 'rule', 'rules', 'skill', 'state', 'the'])

let citationCount = 0
let indexedPageCount = 0
let sectionCorroboratedCount = 0
const boundedIndexWarnings = []
const sectionWarnings = []

for (const testCase of benchmark.cases) {
  for (const citation of testCase.draftCitations || []) {
    citationCount++
    const source = sources.get(citation.sourceId)
    assert.ok(source, `Unknown citation source in ${testCase.id}: ${citation.sourceId}`)
    const page = Number(citation.page)
    assert.ok(Number.isInteger(page) && page >= 1 && page <= source.pageCount, `Invalid citation page in ${testCase.id}: ${citation.sourceId} p.${citation.page}`)

    const pageChunks = index.chunks.filter((chunk) => chunk.sourceId === citation.sourceId && String(chunk.printedPage) === String(citation.page))
    if (!pageChunks.length) {
      boundedIndexWarnings.push({ id: testCase.id, sourceId: citation.sourceId, page: citation.page, section: citation.section })
      continue
    }
    indexedPageCount++

    const terms = normalized(citation.section).split(' ').filter((term) => term.length >= 4 && !ignoredSectionTerms.has(term))
    const pageText = normalized(pageChunks.map((chunk) => [chunk.section, ...(chunk.headings || []), chunk.text].join(' ')).join(' '))
    const hits = terms.filter((term) => pageText.includes(term))
    if (!terms.length || hits.length >= Math.ceil(terms.length / 2)) sectionCorroboratedCount++
    else sectionWarnings.push({ id: testCase.id, sourceId: citation.sourceId, page: citation.page, section: citation.section })
  }
}

assert.ok(citationCount > 0)
assert.equal(benchmark.cases.filter((item) => item.reviewStatus === 'VERIFIED_DRAFT').length, 100)
console.log(JSON.stringify({
  cases: benchmark.cases.length,
  citations: citationCount,
  validSourceAndPageRange: citationCount,
  indexedPageEvidence: indexedPageCount,
  sectionHintsCorroborated: sectionCorroboratedCount,
  boundedIndexWarnings,
  sectionWarnings,
  status: boundedIndexWarnings.length || sectionWarnings.length ? 'MANUAL_REVIEW_REMAINS' : 'CITATIONS_CORROBORATED',
  note: 'The repository index contains bounded excerpts, not complete page transcriptions. Warnings are not treated as verified or as automatic failures.',
}, null, 2))
