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
const pool = ({ baseBurst = 1, burst = 1, specialDice = 0, diceSources = [] }) => ({ baseBurst, baseTarget: 12, burst, diceSources, modifierSources: diceSources, modifiers: 0, specialDice, target: 12 })
const band = (range, attackerPool, defenderPool) => ({
  range,
  attackerAction: 'E/Mitter',
  attackerPool,
  defenderAction: 'Boarding Pistol',
  defenderPool,
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
        { attackerState: 'normal', defenderState: 'normal', bands: [band('0-8', pool({ specialDice: 1, diceSources: nativeSources }), pool({ specialDice: 1, diceSources: nativeSources }))] },
        { attackerState: 'fireteam', defenderState: 'fireteam', bands: [band('0-8', pool({ specialDice: 2, diceSources: linkedSources }), pool({ specialDice: 2, diceSources: linkedSources }))] },
      ],
    }, {
      attacker: { name: 'NIMROD FTO' },
      defender: { name: 'COYOTE FTO' },
      variants: [{
        attackerState: 'fireteam',
        defenderState: 'fireteam',
        bands: [band('16-24', pool({ baseBurst: 2, burst: 3, specialDice: 1, diceSources: ['Native Weapon +1B', 'Fireteam +1SD'] }), pool({ specialDice: 2, diceSources: linkedSources }))],
      }],
    }],
  },
})

assert.equal(pages.length, 3)
assert.match(pages[0], /E\/Mitter[\s\S]*B2 \(base B1 \+ Native BS Attack \+1SD\)/)
assert.match(pages[0], /Boarding Pistol[\s\S]*B2 \(base B1 \+ Native BS Attack \+1SD\)/)
assert.doesNotMatch(pages[0], /· B1 \+ 1SD/)
assert.match(pages[1], /E\/Mitter[\s\S]*B3 \(base B1 \+ Native BS Attack \+1SD \+ Fireteam \+1SD\)/)
assert.match(pages[1], /Boarding Pistol[\s\S]*B3 \(base B1 \+ Native BS Attack \+1SD \+ Fireteam \+1SD\)/)
assert.match(pages[1], /Native BS Attack \+1SD · Fireteam \+1SD/)
assert.doesNotMatch(pages[1], /· B1 \+ 2SD/)
assert.match(pages[2], /B4 \(base B2 \+ Native Weapon \+1B \+ Fireteam \+1SD\)/)
assert.match(pages[2], /B3 \(base B1 \+ Native BS Attack \+1SD \+ Fireteam \+1SD\)/)

console.log('PASS - matchup renderer separately shows native +B, native +SD, and Fireteam +SD sources.')
