import { readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { chromium } from 'playwright'

const manifestSource = readFileSync(resolve('src/config/factionPortraitDerivatives.ts'), 'utf8')
const manifest = JSON.parse(manifestSource.match(/= (\{[\s\S]*\}) as const/)?.[1] ?? '{}')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const failures = []
const results = []

try {
  for (const [id, derivatives] of Object.entries(manifest)) {
    const source = readFileSync(join('public', 'faction-portraits', `${id}.png`)).toString('base64')
    const derivative = readFileSync(join('public', derivatives[0].src)).toString('base64')
    const result = await page.evaluate(async ({ derivative, source }) => {
      const [original, optimized] = await Promise.all([
        load(`data:image/png;base64,${source}`),
        load(`data:image/webp;base64,${derivative}`),
      ])
      const width = optimized.naturalWidth
      const height = optimized.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Canvas unavailable')
      context.drawImage(original, 0, 0, width, height)
      const expected = context.getImageData(0, 0, width, height).data
      context.clearRect(0, 0, width, height)
      context.drawImage(optimized, 0, 0)
      const actual = context.getImageData(0, 0, width, height).data
      let squaredError = 0
      for (let index = 0; index < actual.length; index += 1) {
        const difference = expected[index] - actual[index]
        squaredError += difference * difference
      }
      const mse = squaredError / actual.length
      return { height, psnr: mse === 0 ? 99 : 10 * Math.log10((255 * 255) / mse), width }

      function load(src) {
        return new Promise((resolveImage, rejectImage) => {
          const image = new Image()
          image.onload = () => resolveImage(image)
          image.onerror = rejectImage
          image.src = src
        })
      }
    }, { derivative, source })
    results.push({ file: basename(derivatives[0].src), ...result })
    if (result.width !== 320 || result.psnr < 30) failures.push(`${id}: ${result.width}px, ${result.psnr.toFixed(2)} dB`)
  }
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`Portrait fidelity failures:\n${failures.join('\n')}`)
  process.exit(1)
}

console.log(`PASS ${results.length} responsive portraits preserve visual fidelity`)
console.log(JSON.stringify({ minimumPsnr: Math.min(...results.map(({ psnr }) => psnr)), testedWidth: 320 }, null, 2))
