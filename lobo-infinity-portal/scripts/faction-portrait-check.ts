import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import {
  FACTION_PORTRAIT_REGISTRY,
  resolveFactionPortrait,
  resolveFactionPortraitFromArmyPriority,
} from '../src/config/factionPortraits.ts'

const expected = [
  ['ALEPH', '/faction-portraits/aleph.png'],
  ['Nomads', '/faction-portraits/nomads.png'],
  ['Combined Army', '/faction-portraits/combined-army.png'],
  ['Starmada', '/faction-portraits/starmada.png'],
  ['Torchlight Brigade', '/faction-portraits/torchlight-brigade.png'],
  ['Ariadna', '/faction-portraits/ariadna.png'],
  ['Haqqislam', '/faction-portraits/haqqislam.png'],
  ['Japanese Secessionist Army', '/faction-portraits/jsa.png'],
  ['Tohaa', '/faction-portraits/tohaa.png'],
  ['O-12', '/faction-portraits/o-12.png'],
  ['Operations Subsection', '/faction-portraits/operations-subsection.png'],
  ['Bakunin Jurisdictional Command', '/faction-portraits/bakunin.png'],
  ['Kosmoflot', '/faction-portraits/kosmoflot.png'],
  ['Morat Aggression Force', '/faction-portraits/morats.png'],
  ['Shasvastii Expeditionary Force', '/faction-portraits/shasvastii.png'],
] as const

const expectedAliases = [
  ['Aleph', '/faction-portraits/aleph.png'],
  ['ALEPH', '/faction-portraits/aleph.png'],
  ['Nomad', '/faction-portraits/nomads.png'],
  ['Combined', '/faction-portraits/combined-army.png'],
  ['Torchlight', '/faction-portraits/torchlight-brigade.png'],
  ['JSA', '/faction-portraits/jsa.png'],
  ['vanilla jsa', '/faction-portraits/jsa.png'],
  ['O12', '/faction-portraits/o-12.png'],
  ['o 12', '/faction-portraits/o-12.png'],
  ['Hassassin Bahram', '/faction-portraits/haqqislam.png'],
  ['Oban', '/faction-portraits/jsa.png'],
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
  if (!result.hasUsableTransparency) {
    failures.push(
      `${result.file} is invalid: expected usable alpha transparency, found ${result.transparentPixels} fully transparent pixels and ${result.translucentPixels} translucent pixels across ${result.totalPixels} pixels.`,
    )
  }

  if (result.hasOpaqueRectangularBackground) {
    failures.push(
      `${result.file} is invalid: edge and corner pixels form an opaque white/checkerboard rectangular background.`,
    )
  }

  if (!result.hasAlphaChannel) {
    failures.push(`${result.file} is invalid: PNG color type does not include an alpha channel.`)
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

if (resolveFactionPortrait('Combined')?.src !== '/faction-portraits/combined-army.png') {
  failures.push('Combined shorthand must resolve through the centralized portrait alias map.')
}

if (resolveFactionPortraitFromArmyPriority('PanOceania', 'Yu Jing') !== null) {
  failures.push('Unsupported factions must keep the existing no-portrait fallback.')
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
  console.log(
    `${result.hasAlphaChannel && result.hasUsableTransparency && !result.hasOpaqueRectangularBackground ? 'PASS' : 'FAIL'} ${result.file} transparency integrity`,
  )
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

        return {
          hasOpaqueRectangularBackground: opaqueLightEdgeRatio > 0.85,
          hasUsableTransparency:
            (transparentPixels + translucentPixels) / (canvas.width * canvas.height) > 0.05,
          height: canvas.height,
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

      results.push({ file, hasAlphaChannel: pngHasAlphaChannel(publicPath), ...result })
    }

    return results
  } finally {
    await browser.close()
  }
}

function readFileAsBase64(path: string) {
  return readFileSync(path).toString('base64')
}

function pngHasAlphaChannel(path: string) {
  const bytes = readFileSync(path)
  const colorType = bytes[25]

  return colorType === 4 || colorType === 6
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
    !/resolveFactionPortraitFromArmyPriority\(\s*player\.favoriteArmy,\s*player\.faction,\s*\)/.test(
      playerCard,
    )
  ) {
    failures.push('Player cards must resolve preferred/current army inputs in the same order used by public profiles.')
  }

  if (
    !/resolveFactionPortraitFromArmyPriority\(\s*leagueModel\?\.preferredArmy,[\s\S]*player\.favoriteFaction,[\s\S]*player\.armyListSummary\.favoriteFaction/.test(
      playerProfile,
    )
  ) {
    failures.push('Public profiles must keep using centralized preferred/current army portrait resolution.')
  }

  if (!/resolveFactionPortrait\(\s*data\.user\.favoriteFaction \|\| leagueModel\?\.preferredArmy,\s*\)/.test(myProfile)) {
    failures.push('My Profile portrait behavior must remain on the existing centralized resolver call.')
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
