#!/usr/bin/env node

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import {
  A4_PDF_HEIGHT_POINTS,
  A4_PDF_WIDTH_POINTS,
  calculateA4PdfImagePlacement,
  renderIdentificationSheet,
} from '../bot/inf-id-renderer.mjs'

const tolerance = 0.001
const sourceWidth = 2480
const sourceHeight = 3508
const placement = calculateA4PdfImagePlacement(sourceWidth, sourceHeight)
assert.ok(placement.x >= -tolerance)
assert.ok(placement.y >= -tolerance)
assert.ok(placement.x + placement.renderedWidth <= A4_PDF_WIDTH_POINTS + tolerance)
assert.ok(placement.y + placement.renderedHeight <= A4_PDF_HEIGHT_POINTS + tolerance)
assert.ok(Math.abs(placement.renderedWidth / placement.renderedHeight - sourceWidth / sourceHeight) < tolerance)

const output = await mkdtemp(join(tmpdir(), 'inf-id-pdf-check-'))
const browser = await chromium.launch({ headless: true })
try {
  const onePixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3MxZ5wAAAABJRU5ErkJggg=='
  const makeEntries = (count) => Array.from({ length: count }, (_, index) => ({
    rosterPosition: `G1.${index + 1}`,
    combatGroup: 1,
    position: index + 1,
    unitName: `UNIT ${index + 1}`,
    profileName: '',
    weapons: [],
    image: { resolves: true, matchType: 'exact-troop-sculpt' },
    imageDataUrl: onePixel,
  }))
  for (const [name, count, expectedPages] of [['single', 1, 1], ['multiple', 16, 2]]) {
    const result = await renderIdentificationSheet({
      army: { faction: 'Fixture', sectorial: 'Fixture', listName: name },
      entries: makeEntries(count),
      fireteams: { status: 'none' },
      fireteamMatches: [],
      outputDir: join(output, name),
      browser,
    })
    assert.equal(result.pages.length, expectedPages)
    assert.equal(pdfPageCount(result.pdf.buffer), expectedPages)
    for (const [pdfWidth, pdfHeight] of pdfMediaBoxes(result.pdf.buffer)) {
      assert.ok(Math.abs(pdfWidth - A4_PDF_WIDTH_POINTS) < 1)
      assert.ok(Math.abs(pdfHeight - A4_PDF_HEIGHT_POINTS) < 1)
    }
    assert.equal(pdfMediaBoxes(result.pdf.buffer).length, expectedPages)
  }
} finally {
  await browser.close()
  await rm(output, { recursive: true, force: true })
}

console.log('PASS - /inf-id raster pages are proportionally contained on one A4 portrait PDF page each, including multi-page output.')

function pdfPageCount(buffer) {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length
}

function pdfMediaBoxes(buffer) {
  return [...buffer.toString('latin1').matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((match) => [Number(match[1]), Number(match[2])])
}
