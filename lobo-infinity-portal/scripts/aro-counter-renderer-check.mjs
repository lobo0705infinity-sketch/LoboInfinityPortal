import assert from 'node:assert/strict'
import { renderAroCounterImages } from '../bot/aro-counter-renderer.mjs'

const pages = []
let viewport = null
const browserFactory = async () => ({
  async newPage(options) {
    viewport = options.viewport
    return {
      async setContent(html) { pages.push(html) },
      async evaluate() {},
      locator() { return { async screenshot() { return Buffer.from('png') } } },
      async close() {},
    }
  },
  async close() {},
})

const band = (range) => ({
  range,
  targetWeapon: 'AP HMG (AP)',
  aroWeapon: 'MULTI Sniper Rifle:Hit Mode — DA',
  reactiveWin: 54.6,
  meaningfulEffect: 33.3,
  survival: 66.7,
})
const results = Array.from({ length: 10 }, (_, index) => ({
  name: `Reactive Trooper ${index + 1}`,
  state: index % 2 ? 'normal' : 'fireteam',
  weapon: 'MULTI Sniper Rifle:Hit Mode — DA',
  bands: ['0-8', '8-16', '16-24', '24-32', '32-40', '40-48'].map(band),
}))

const images = await renderAroCounterImages({
  browserFactory,
  result: {
    target: { name: 'Avatar — AVATAR Lieutenant' },
    army: null,
    range: 'all',
    results,
  },
})

assert.deepEqual(viewport, { width: 2200, height: 1660 }, 'ARO counter uses the readable matchup-sized canvas')
assert.equal(images.length, 4, 'top ten counters render as four pages')
assert.deepEqual(pages.map((html) => (html.match(/<article class="card">/g) || []).length), [3, 3, 3, 1])
assert.match(pages[0], /TOP 10 REACTIVE RESPONSES/)
assert.match(pages[0], /FIRETEAM \+1SD/)
assert.match(pages[0], /NON-LINKED/)
assert.match(pages[0], /PAGE 1 \/ 4/)
assert.match(pages[3], /Reactive Trooper 10/)
assert.match(pages[3], /PAGE 4 \/ 4/)
assert.ok(pages.every((html) => /DIRECT TEMPLATE WEAPONS EXCLUDED/.test(html)))

console.log('PASS - ARO counter renders a readable matchup-style top ten across four pages.')
