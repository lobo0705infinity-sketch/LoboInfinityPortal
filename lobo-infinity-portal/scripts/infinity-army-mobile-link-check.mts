import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  decodeInfinityArmyCode,
  getInfinityArmyAppUrl,
  isMobileOrTabletDevice,
} from '../src/services/infinityArmyLinks.ts'

const component = read('src/components/InfinityArmyLink.tsx')
const locations = [
  ['Army Lists', read('src/pages/ArmyLists.tsx'), 2],
  ['Faction Profile', read('src/pages/FactionProfile.tsx'), 1],
  ['Player Profile', read('src/pages/PlayerProfile.tsx'), 1],
  ['Army Intelligence', read('src/pages/ArmyIntelligence.tsx'), 1],
  ['Public Army Lists', read('src/public/SnapshotPublicApp.tsx'), 1],
  ['Public Army Intelligence', read('src/public/SnapshotArmyIntelligence.tsx'), 1],
] as const

for (const [label, source, expected] of locations) {
  assert.equal((source.match(/<InfinityArmyLink\b/g) || []).length, expected, `${label} uses the shared link`)
}
for (const source of locations.map(([, value]) => value)) {
  assert.doesNotMatch(source, /<a\s+href=\{(?:target\.href|armyLink|list\.armyLink|l\.armyLink)\}[^>]*target="_blank"/)
}

assert.match(component, /if \(!isMobileOrTabletDevice\(\)\) return\s+event\.preventDefault\(\)/)
assert.match(component, /href=\{href\}[\s\S]*rel="noreferrer"[\s\S]*target="_blank"/)
assert.match(component, /Open in Infinity Army App[\s\S]*Copy Army Code[\s\S]*Cancel/)
assert.match(component, /await navigator\.clipboard\.writeText\(decodedCode\)[\s\S]*attemptInfinityArmyAppLaunch\(\)/)
assert.match(component, /Army code copied\. In Infinity Army, tap Load List to import it\./)
assert.match(component, /Army code copied\./)
assert.match(component, /onClick=\{\(\) => setOpen\(false\)\}[^>]*>Cancel/)
assert.match(component, /try \{ attemptInfinityArmyAppLaunch\(\) \} catch \{ \/\* The copied code remains available\. \*\//)
assert.doesNotMatch(component, /window\.location(?:\.href)?\s*=/, 'failed app launch cannot navigate or break the portal')

const original = 'abc+def/ghi='
const encodedHref = `https://infinitytheuniverse.com/army/list/${encodeURIComponent(original)}`
assert.equal(decodeInfinityArmyCode(undefined, encodedHref), original)
assert.equal(decodeInfinityArmyCode(original, 'https://example.test/unchanged'), original)
assert.equal(decodeInfinityArmyCode('abc%2Bdef%2Fghi%3D', encodedHref), original)

setDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0, false)
assert.equal(isMobileOrTabletDevice(), false, 'desktop remains a native link')
setDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5, true)
assert.equal(isMobileOrTabletDevice(), true, 'iPhone receives action sheet')
assert.equal(getInfinityArmyAppUrl(), 'infinityarmy://')
setDevice('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 5, true)
assert.equal(isMobileOrTabletDevice(), true, 'iPad receives action sheet')
setDevice('Mozilla/5.0 (Linux; Android 15; Pixel Tablet)', 5, true)
assert.equal(isMobileOrTabletDevice(), true, 'Android tablet receives action sheet')
assert.match(getInfinityArmyAppUrl(), /^intent:\/\/open#Intent;.*package=com\.infinityarmy;end$/)

console.log(`Infinity Army mobile-link regression passed (${locations.length} link locations).`)

function read(path: string) { return readFileSync(path, 'utf8') }
function setDevice(userAgent: string, maxTouchPoints: number, coarse: boolean) {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { maxTouchPoints, userAgent } })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { href: 'https://lobo.test/' }, matchMedia: () => ({ matches: coarse }) },
  })
}
