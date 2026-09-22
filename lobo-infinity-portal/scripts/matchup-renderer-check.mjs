import assert from 'node:assert/strict'
import { renderMatchupImages } from '../bot/matchup-renderer.mjs'

const pages = []
const browserFactory = async () => ({
  async close() {},
  async newPage() {
    return {
      async close() {},
      async evaluate() {},
      locator() { return { screenshot: async () => Buffer.from('png') } },
      async setContent(html) { pages.push(html) },
    }
  },
})

const nativeSources = ['Native BS Attack +1SD']
const linkedSources = ['Native BS Attack +1SD', 'Fireteam +1SD']
const pool = (specialDice, modifierSources) => ({ baseTarget: 12, burst: 1, modifierSources, modifiers: 0, specialDice, target: 12 })
const band = (range, specialDice, modifierSources) => ({
  range,
  attackerAction: 'E/Mitter',
  attackerPool: pool(specialDice, modifierSources),
  defenderAction: 'Boarding Pistol',
  defenderPool: pool(specialDice, modifierSources),
  f2fWin: 50,
  oneEffect: 25,
  twoEffects: 10,
  threePlusEffects: 5,
  defenderSurvival: 60,
})

await renderMatchupImages({
  browserFactory,
  result: {
    directions: [{
      attacker: { name: 'COYOTE FTO' },
      defender: { name: 'COYOTE FTO' },
      variants: [
        { attackerState: 'normal', defenderState: 'normal', bands: [band('0-8', 1, nativeSources), band('8-16', 1, nativeSources)] },
        { attackerState: 'fireteam', defenderState: 'fireteam', bands: [band('0-8', 2, linkedSources), band('8-16', 2, linkedSources)] },
      ],
    }],
  },
})

assert.equal(pages.length, 2)
assert.match(pages[0], /E\/Mitter[\s\S]*B2 \(base B1 \+ 1SD\)/)
assert.match(pages[0], /Boarding Pistol[\s\S]*B2 \(base B1 \+ 1SD\)/)
assert.doesNotMatch(pages[0], /· B1 \+ 1SD/)
assert.match(pages[1], /E\/Mitter[\s\S]*B3 \(base B1 \+ 2SD\)/)
assert.match(pages[1], /Boarding Pistol[\s\S]*B3 \(base B1 \+ 2SD\)/)
assert.match(pages[1], /Native BS Attack \+1SD · Fireteam \+1SD/)
assert.doesNotMatch(pages[1], /· B1 \+ 2SD/)

for (const html of pages) {
  assert.equal((html.match(/base B1/g) || []).length, 4, 'both combatants show resolved Burst in every range band')
}

console.log('PASS - matchup renderer shows resolved Coyote Burst with native and Fireteam +SD sources.')
