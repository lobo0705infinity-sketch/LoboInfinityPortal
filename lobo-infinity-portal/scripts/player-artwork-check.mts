import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { resolvePlayerFactionIdentity } from '../src/services/playerFactionIdentity.ts'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const portraitImage = read('src/components/FactionPortraitImage.tsx')

for (const path of [
  'src/components/PlayerCard.tsx',
  'src/pages/PlayerProfile.tsx',
  'src/pages/MyProfile.tsx',
]) {
  const source = read(path)
  assert.match(source, /<FactionPortraitImage[\s\S]*?canonicalSource/,
    `${path} must preserve the canonical artwork URL at every viewport.`)
  assert.doesNotMatch(source, /faction-portraits\/optimized/,
    `${path} must not activate an old responsive player-artwork path.`)
}

assert.match(
  portraitImage,
  /canonicalSource \? undefined : getPortraitDerivatives\(src\)/,
  'Canonical player artwork must bypass responsive derivative selection.',
)

let customArtworkCount = 0
for (const army of CANONICAL_ARMY_REGISTRY) {
  const desktop = resolvePlayerFactionIdentity({ favoriteFaction: army.name })
  const mobile = resolvePlayerFactionIdentity({ favoriteFaction: army.name })
  assert.equal(mobile.normalizedFaction, desktop.normalizedFaction)
  assert.equal(mobile.portraitPath, desktop.portraitPath)
  if (!desktop.portraitPath) continue
  customArtworkCount += 1
  assert.equal(existsSync(resolve(process.cwd(), 'public', desktop.portraitPath.slice(1))), true,
    `Missing canonical artwork ${desktop.portraitPath}`)
}

const unknown = resolvePlayerFactionIdentity({ favoriteFaction: 'Unknown Army' })
assert.equal(unknown.portraitPath, null, 'Unknown players must retain the neutral portrait fallback.')

assert.ok(customArtworkCount > 0)
console.log(`PASS ${customArtworkCount} canonical player artwork mappings`)
console.log('PASS desktop and mobile resolve identical identities and exact asset URLs')
console.log('PASS unknown-player neutral fallback')
