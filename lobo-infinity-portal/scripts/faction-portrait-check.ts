import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import {
  FACTION_PORTRAIT_REGISTRY,
  resolveFactionPortrait,
  resolveFactionPortraitFromArmyPriority,
  resolvePlayerFactionPortrait,
  resolvePlayerFactionPortraitDetails,
} from '../src/config/factionPortraits.ts'

const expected = [
  ['ALEPH', '/faction-portraits/aleph.png'],
  ['Nomads', '/faction-portraits/nomads.png'],
  ['Corregidor', '/faction-portraits/corregidor.png'],
  ['Tunguska', '/faction-portraits/tunguska.png'],
  ['Combined Army', '/faction-portraits/combined-army.png'],
  ['Next Wave', '/faction-portraits/next-wave.png'],
  ['Onyx Contact Force', '/faction-portraits/onyx-contact-force.png'],
  ['Starmada', '/faction-portraits/starmada.png'],
  ['StarCo', '/faction-portraits/starco.png'],
  ['Torchlight Brigade', '/faction-portraits/torchlight-brigade.png'],
  ['White Company', '/faction-portraits/white-company.png'],
  ['Ariadna', '/faction-portraits/ariadna.png'],
  ['Haqqislam', '/faction-portraits/haqqislam.png'],
  ['Ramah Taskforce', '/faction-portraits/ramah-taskforce.png'],
  ['Hassassin Bahram', '/faction-portraits/hassassin-bahram.png'],
  ['Qapu Khalqi', '/faction-portraits/qapu-khalqi.png'],
  ['Japanese Secessionist Army', '/faction-portraits/jsa.png'],
  ['Tohaa', '/faction-portraits/tohaa.png'],
  ['O-12', '/faction-portraits/o-12.png'],
  ['Yu Jing', '/faction-portraits/yu-jing.png'],
  ['Military Orders', '/faction-portraits/military-orders.png'],
  ['Neoterran Capitaline Army', '/faction-portraits/neoterra.png'],
  ['Shock Army of Acontecimento', '/faction-portraits/acontecimento.png'],
  ['White Banner', '/faction-portraits/white-banner.png'],
  ['Varuna', '/faction-portraits/varuna.png'],
  ["Svalarheima's Winter Force", '/faction-portraits/winter-for.png'],
  ['PanOceania', '/faction-portraits/panoceania.png'],
  ['Kestrel Colonial Force', '/faction-portraits/kestrel-colonial-force.png'],
  ['Imperial Service', '/faction-portraits/imperial-service.png'],
  ['Invincible Army', '/faction-portraits/invincible-army.png'],
  ['Operations Subsection', '/faction-portraits/operations-subsection.png'],
  ['Steel Phalanx', '/faction-portraits/steel-phalanx.png'],
  ['Bakunin Jurisdictional Command', '/faction-portraits/bakunin.png'],
  ['Kosmoflot', '/faction-portraits/kosmoflot.png'],
  ['USAriadna Ranger Force', '/faction-portraits/usariadna.png'],
  ['Tartary Army Corps', '/faction-portraits/tartary-army-corps.png'],
  ['Caledonian Highlander Army', '/faction-portraits/caledonian-highlander-army.png'],
  ['Force de Réponse Rapide Merovingienne', '/faction-portraits/frrm.png'],
  ['Ikari Company', '/faction-portraits/ikari-company.png'],
  ['Dahshat Company', '/faction-portraits/dahshat-company.png'],
  ['Druze Bayram Security', '/faction-portraits/druze-bayram-security.png'],
  ['Morat Aggression Force', '/faction-portraits/morats.png'],
  ['Shasvastii Expeditionary Force', '/faction-portraits/shasvastii.png'],
  ['Oban', '/faction-portraits/oban.png'],
  ['Shindenbutai', '/faction-portraits/shindenbutai.png'],
] as const

const expectedAliases = [
  ['Aleph', '/faction-portraits/aleph.png'],
  ['ALEPH', '/faction-portraits/aleph.png'],
  ['Nomad', '/faction-portraits/nomads.png'],
  ['Jurisdictional Command of Corregidor', '/faction-portraits/corregidor.png'],
  ['Tunguska Jurisdictional Command', '/faction-portraits/tunguska.png'],
  ['Combined', '/faction-portraits/combined-army.png'],
  ['CA', '/faction-portraits/combined-army.png'],
  ['Panoceania', '/faction-portraits/panoceania.png'],
  ['PanO', '/faction-portraits/panoceania.png'],
  ['Pan O', '/faction-portraits/panoceania.png'],
  ['Onyx', '/faction-portraits/onyx-contact-force.png'],
  ['StarCo. Free Company of the Star', '/faction-portraits/starco.png'],
  ['Free Company of the Star', '/faction-portraits/starco.png'],
  ['Torchlight', '/faction-portraits/torchlight-brigade.png'],
  ['WhiteCo', '/faction-portraits/white-company.png'],
  ['White Co', '/faction-portraits/white-company.png'],
  ['Ramah Task Force', '/faction-portraits/ramah-taskforce.png'],
  ['Neoterra', '/faction-portraits/neoterra.png'],
  ['NCA', '/faction-portraits/neoterra.png'],
  ['Acontecimento', '/faction-portraits/acontecimento.png'],
  ['SAA', '/faction-portraits/acontecimento.png'],
  ['JSA', '/faction-portraits/jsa.png'],
  ['vanilla jsa', '/faction-portraits/jsa.png'],
  ['O12', '/faction-portraits/o-12.png'],
  ['o 12', '/faction-portraits/o-12.png'],
  ['Hassassin Bahram', '/faction-portraits/hassassin-bahram.png'],
  ['Varuna Immediate Reaction Division', '/faction-portraits/varuna.png'],
  ['Svalarheima Winter Force', '/faction-portraits/winter-for.png'],
  ['WinterFor', '/faction-portraits/winter-for.png'],
  ['Svalarheima', '/faction-portraits/winter-for.png'],
  ['Kestrel', '/faction-portraits/kestrel-colonial-force.png'],
  ['Imperial Service Sectorial Army', '/faction-portraits/imperial-service.png'],
  ['IA', '/faction-portraits/invincible-army.png'],
  ['USARF', '/faction-portraits/usariadna.png'],
  ['US Ariadna', '/faction-portraits/usariadna.png'],
  ['Tartary Army Korps', '/faction-portraits/tartary-army-corps.png'],
  ['TAK', '/faction-portraits/tartary-army-corps.png'],
  ['Caledonia', '/faction-portraits/caledonian-highlander-army.png'],
  ['CHA', '/faction-portraits/caledonian-highlander-army.png'],
  ['Force de Reponse Rapide Merovingienne', '/faction-portraits/frrm.png'],
  ['FRRM', '/faction-portraits/frrm.png'],
  ['Merovingienne', '/faction-portraits/frrm.png'],
  ['Merovingian Rapid Response Force', '/faction-portraits/frrm.png'],
  ['Ikari', '/faction-portraits/ikari-company.png'],
  ['Dahshat', '/faction-portraits/dahshat-company.png'],
  ['Dashat Company', '/faction-portraits/dahshat-company.png'],
  ['Dashat', '/faction-portraits/dahshat-company.png'],
  ['Druze', '/faction-portraits/druze-bayram-security.png'],
  ['DBS', '/faction-portraits/druze-bayram-security.png'],
  ['Oban', '/faction-portraits/oban.png'],
  ['vanilla aleph', '/faction-portraits/aleph.png'],
] as const

const failures: string[] = []
const expectedSources = new Set(expected.map(([, src]) => src))

if (FACTION_PORTRAIT_REGISTRY.length !== expected.length) {
  failures.push(
    `Expected ${expected.length} portrait registry entries, found ${FACTION_PORTRAIT_REGISTRY.length}.`,
  )
}

for (const [faction, src] of expected) {
  const portrait = resolveFactionPortrait(faction)

  if (!portrait) {
    failures.push(`${faction} did not resolve a portrait.`)
    continue
  }

  if (portrait.src !== src) {
    failures.push(`${faction} resolved ${portrait.src}, expected ${src}.`)
  }

  const publicPath = resolve(process.cwd(), 'public', src.replace(/^\//, ''))
  if (!existsSync(publicPath)) {
    failures.push(`${faction} portrait asset is missing at ${publicPath}.`)
  } else if (statSync(publicPath).size === 0) {
    failures.push(`${faction} portrait asset at ${publicPath} must not be empty.`)
  }

  const duplicatedPath = resolve(process.cwd(), 'public', 'public', src.replace(/^\//, ''))
  if (existsSync(duplicatedPath)) {
    failures.push(`${faction} portrait asset must not be duplicated at ${duplicatedPath}.`)
  }
}

const registrySources = new Set(FACTION_PORTRAIT_REGISTRY.map((portrait) => portrait.src))

if (registrySources.size !== FACTION_PORTRAIT_REGISTRY.length) {
  failures.push('Each faction must resolve to exactly one unique portrait source.')
}

for (const portrait of FACTION_PORTRAIT_REGISTRY) {
  if (!expectedSources.has(portrait.src)) {
    failures.push(`${portrait.faction} uses unexpected portrait source ${portrait.src}.`)
  }
}

const publicPortraitFiles = listFactionPortraitFiles(resolve(process.cwd(), 'public', 'faction-portraits'))
const expectedFiles = [...expectedSources].map((src) => src.replace('/faction-portraits/', '')).sort()

if (publicPortraitFiles.join('|') !== expectedFiles.join('|')) {
  failures.push(
    `public/faction-portraits must contain exactly the approved portrait files. Found ${publicPortraitFiles.join(', ') || 'none'}.`,
  )
}

for (const [alias, src] of expectedAliases) {
  const portrait = resolveFactionPortraitFromArmyPriority(alias)

  if (portrait?.src !== src) {
    failures.push(`${alias} resolved ${portrait?.src || 'no portrait'}, expected ${src}.`)
  }
}

const assetResults = await inspectPortraitAssets()

for (const result of assetResults) {
  if (result.width <= 0 || result.height <= 0) {
    failures.push(`${result.file} is invalid: image dimensions must be nonzero.`)
  }
}

if (resolveFactionPortrait('Unknown Sectorial') !== null) {
  failures.push('Unknown factions must not resolve a fallback portrait.')
}

if (resolveFactionPortrait('  kosmoflot  ')?.src !== '/faction-portraits/kosmoflot.png') {
  failures.push('Portrait resolution should be deterministic for whitespace/case variants.')
}

if (
  resolveFactionPortraitFromArmyPriority('Unknown Army', 'Operations Subsection')?.src !==
  '/faction-portraits/operations-subsection.png'
) {
  failures.push('Portrait priority should fall through from unsupported current army to supported preferred army.')
}

if (
  resolvePlayerFactionPortrait({
    currentEventArmy: 'ALEPH',
    preferredArmy: 'Operations Subsection',
    playerFaction: 'ALEPH',
  })?.src !== '/faction-portraits/aleph.png'
) {
  failures.push('Current active-event army must be the first player portrait candidate when supplied.')
}

if (
  resolvePlayerFactionPortrait({
    preferredArmy: 'Operations Subsection',
    playerFaction: 'ALEPH',
    parentFaction: 'ALEPH',
  })?.src !== '/faction-portraits/operations-subsection.png'
) {
  failures.push('Valid sectorials must resolve before parent-faction fallback portraits.')
}

if (
  resolvePlayerFactionPortrait({
    favoriteArmy: 'bakunin jurisdictional command',
    playerFaction: 'Nomads',
  })?.src !== '/faction-portraits/bakunin.png'
) {
  failures.push('Casing differences must resolve through the shared player portrait resolver.')
}

if (
  resolvePlayerFactionPortrait({
    favoriteArmy: 'Force de Reponse Rapide Merovingienne',
  })?.src !== '/faction-portraits/frrm.png'
) {
  failures.push('Accented and unaccented FRRM values must resolve consistently.')
}

if (
  resolvePlayerFactionPortrait({
    preferredArmy: 'Operations Subsection (4 games)',
    playerFaction: 'ALEPH',
  })?.src !== '/faction-portraits/operations-subsection.png'
) {
  failures.push('Profile metric suffixes from real player data must not block exact sectorial portraits.')
}

if (
  resolvePlayerFactionPortrait({
    playerFaction: 'ALEPH',
    preferredArmy: 'Bakunin Jurisdictional Command',
  })?.src !== '/faction-portraits/bakunin.png'
) {
  failures.push('Preferred army must outrank player faction outside explicit current-event context.')
}

if (
  resolvePlayerFactionPortrait({
    playerFaction: 'ALEPH',
  })?.src !== '/faction-portraits/aleph.png'
) {
  failures.push('Stale tournament army data must not be treated as current-event army unless supplied in context.')
}

if (
  resolvePlayerFactionPortrait({
    mostPlayedArmy: 'Kosmoflot',
    mostPlayedParentFaction: 'Ariadna',
    playerFaction: 'Ariadna',
  })?.src !== '/faction-portraits/ariadna.png'
) {
  failures.push('Player faction must outrank most-played army under the shared priority contract.')
}

if (
  resolvePlayerFactionPortrait({
    mostPlayedArmy: 'Kosmoflot',
    mostPlayedParentFaction: 'Ariadna',
  })?.src !== '/faction-portraits/kosmoflot.png'
) {
  failures.push('Most-played army must outrank its parent faction.')
}

if (!resolvePlayerFactionPortraitDetails({ preferredArmy: 'Unknown Sectorial' }).unsupported) {
  failures.push('Unsupported player portrait contexts must report unsupported/no portrait.')
}

if (resolveFactionPortrait('Combined')?.src !== '/faction-portraits/combined-army.png') {
  failures.push('Combined shorthand must resolve through the centralized portrait alias map.')
}

if (
  resolveFactionPortraitFromArmyPriority('PanOceania', 'Yu Jing')?.src !==
  '/faction-portraits/panoceania.png'
) {
  failures.push('Approved PanOceania portraits must resolve through the centralized registry.')
}

if (resolveFactionPortraitFromArmyPriority('Nighthawkmk2') !== null) {
  failures.push('Player names must not resolve faction portraits.')
}

assertSourceContracts()
assertBuildOutputIfRequested()

for (const [faction] of expected) {
  console.log(`PASS ${faction} portrait resolves`)
}
console.log('PASS Unknown factions keep the existing tactical panel')
console.log('PASS Players, My Profile, and Public Profile reuse centralized ALEPH portrait resolution')

for (const result of assetResults) {
  console.log(`PASS ${result.file} approved portrait asset loads`)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

async function inspectPortraitAssets() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setContent('<!doctype html><html><body></body></html>')

  try {
    const results = []

    for (const [, src] of expected) {
      const file = src.replace('/faction-portraits/', '')
      const publicPath = resolve(process.cwd(), 'public', src.replace(/^\//, ''))
      const dataUrl = `data:image/png;base64,${readFileAsBase64(publicPath)}`
      const result = await page.evaluate(async (imageSrc: string) => {
        const image = new Image()
        await new Promise<void>((resolveImage, rejectImage) => {
          image.onload = () => resolveImage()
          image.onerror = () => rejectImage(new Error('Image failed to load.'))
          image.src = imageSrc
        })

        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d', { willReadFrequently: true })

        if (!context) {
          throw new Error('Canvas context unavailable.')
        }

        context.drawImage(image, 0, 0)
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data
        let transparentPixels = 0
        let translucentPixels = 0
        const edgeSamples: Array<{ alpha: number; blue: number; green: number; red: number }> = []
        const sampleStride = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / 28))

        for (let index = 3; index < data.length; index += 4) {
          const alpha = data[index]

          if (alpha === 0) {
            transparentPixels += 1
          } else if (alpha < 255) {
            translucentPixels += 1
          }
        }

        for (let x = 0; x < canvas.width; x += sampleStride) {
          edgeSamples.push(readPixel(data, canvas.width, x, 0))
          edgeSamples.push(readPixel(data, canvas.width, x, canvas.height - 1))
        }

        for (let y = 0; y < canvas.height; y += sampleStride) {
          edgeSamples.push(readPixel(data, canvas.width, 0, y))
          edgeSamples.push(readPixel(data, canvas.width, canvas.width - 1, y))
        }

        const opaqueLightEdgeSamples = edgeSamples.filter(
          (sample) =>
            sample.alpha === 255 &&
            sample.red >= 228 &&
            sample.green >= 228 &&
            sample.blue >= 228,
        ).length
        const opaqueLightEdgeRatio = opaqueLightEdgeSamples / edgeSamples.length
        const opaqueEdgeRatio =
          edgeSamples.filter((sample) => sample.alpha === 255).length / edgeSamples.length

        return {
          hasOpaqueEdgeBackground: opaqueEdgeRatio > 0.85,
          hasOpaqueRectangularBackground: opaqueLightEdgeRatio > 0.85,
          hasUsableTransparency:
            (transparentPixels + translucentPixels) / (canvas.width * canvas.height) > 0.05,
          height: canvas.height,
          opaqueEdgeRatio,
          opaqueLightEdgeRatio,
          totalPixels: canvas.width * canvas.height,
          translucentPixels,
          transparentPixels,
          width: canvas.width,
        }

        function readPixel(
          pixels: Uint8ClampedArray,
          width: number,
          x: number,
          y: number,
        ) {
          const index = (y * width + x) * 4

          return {
            red: pixels[index],
            green: pixels[index + 1],
            blue: pixels[index + 2],
            alpha: pixels[index + 3],
          }
        }
      }, dataUrl)

      results.push({ file, ...result })
    }

    return results
  } finally {
    await browser.close()
  }
}

function readFileAsBase64(path: string) {
  return readFileSync(path).toString('base64')
}

function listFactionPortraitFiles(path: string) {
  if (!existsSync(path)) {
    return []
  }

  return readdirSync(path)
    .filter((file) => file.endsWith('.png'))
    .sort()
}

function assertSourceContracts() {
  const playerCard = readFileSync(resolve(process.cwd(), 'src', 'components', 'PlayerCard.tsx'), 'utf8')
  const playerProfile = readFileSync(resolve(process.cwd(), 'src', 'pages', 'PlayerProfile.tsx'), 'utf8')
  const myProfile = readFileSync(resolve(process.cwd(), 'src', 'pages', 'MyProfile.tsx'), 'utf8')
  const portraits = readFileSync(resolve(process.cwd(), 'src', 'config', 'factionPortraits.ts'), 'utf8')

  if (
    !/resolvePlayerFactionIdentity\(player\)/.test(playerCard) ||
    !/resolvePortraitFromIdentity\(factionIdentity\.portraitPath, factionIdentity\.normalizedFaction\)/.test(playerCard)
  ) {
    failures.push('Player cards must use the shared player faction identity portrait path.')
  }

  if (
    !/resolvePlayerFactionIdentity\(player\)/.test(playerProfile) ||
    !/resolvePortraitFromIdentity\(factionIdentity\)/.test(playerProfile)
  ) {
    failures.push('Public profiles must use the shared player faction identity portrait path.')
  }

  if (
    !/resolvePlayerFactionIdentity\(data\.user\)/.test(myProfile) ||
    !/resolvePortraitFromIdentity\(factionIdentity\)/.test(myProfile)
  ) {
    failures.push('My Profile must use the shared player faction identity portrait path.')
  }

  if (/Nighthawkmk2|playerName|displayName|decodedPlayerName/.test(portraits)) {
    failures.push('Faction portrait resolution must not include player-name-specific matching.')
  }
}

function assertBuildOutputIfRequested() {
  if (process.env.CHECK_FACTION_PORTRAIT_BUILD_OUTPUT !== '1') {
    return
  }

  const distPath = resolve(process.cwd(), 'dist', 'faction-portraits')
  const distFiles = listFactionPortraitFiles(distPath)

  if (distFiles.join('|') !== expectedFiles.join('|')) {
    failures.push(
      `dist/faction-portraits must include exactly the approved portrait files. Found ${distFiles.join(', ') || 'none'}.`,
    )
  }
}
