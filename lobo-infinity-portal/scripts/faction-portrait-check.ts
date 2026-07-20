import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import {
  FACTION_PORTRAIT_REGISTRY,
  resolveFactionPortrait,
  resolveFactionPortraitFromArmyPriority,
} from '../src/config/factionPortraits.ts'

const expected = [
  ['Operations Subsection', '/faction-portraits/operations-subsection.png'],
  ['Bakunin Jurisdictional Command', '/faction-portraits/bakunin.png'],
  ['Kosmoflot', '/faction-portraits/kosmoflot.png'],
  ['Morat Aggression Force', '/faction-portraits/morats.png'],
  ['Shasvastii Expeditionary Force', '/faction-portraits/shasvastii.png'],
] as const

const failures: string[] = []

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
  resolveFactionPortraitFromArmyPriority('vanilla aleph', 'Kosmoflot')?.src !==
  '/faction-portraits/kosmoflot.png'
) {
  failures.push('Portrait priority should use existing aliases without inventing unsupported parent portraits.')
}

if (resolveFactionPortraitFromArmyPriority('PanOceania', 'Yu Jing') !== null) {
  failures.push('Unsupported factions must keep the existing no-portrait fallback.')
}

for (const [faction] of expected) {
  console.log(`PASS ${faction} portrait resolves`)
}
console.log('PASS Unknown factions keep the existing tactical panel')
console.log('PASS Players portrait priority uses current army, preferred army, and existing aliases')

for (const result of assetResults) {
  console.log(
    `${result.hasUsableTransparency && !result.hasOpaqueRectangularBackground ? 'PASS' : 'FAIL'} ${result.file} transparency integrity`,
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
      const dataUrl = `data:image/png;base64,${readFileAsBase64(resolve(process.cwd(), 'public', src.replace(/^\//, '')))}`
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
