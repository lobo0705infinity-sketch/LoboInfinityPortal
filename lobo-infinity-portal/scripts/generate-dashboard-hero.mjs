import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { chromium } from 'playwright'

const sourcePath = resolve(
  process.cwd(),
  'docs',
  'design',
  'Dashboard',
  'docs',
  'dashboard-concept-v2.1.png',
)
const outputPath = resolve(process.cwd(), 'public', 'dashboard', 'dashboard-hero.webp')
const quality = 0.84

if (!existsSync(sourcePath)) {
  throw new Error(`Dashboard hero source is missing: ${sourcePath}`)
}

const source = readFileSync(sourcePath)
const sourceHashBefore = sha256(source)
const dimensions = readPngDimensions(source)
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

try {
  const webp = await renderWebp(page, source, {
    height: dimensions.height,
    quality,
    width: dimensions.width,
  })

  mkdirSync(dirname(outputPath), { recursive: true })

  const unchanged = existsSync(outputPath) && readFileSync(outputPath).equals(webp)

  if (!unchanged) {
    writeFileSync(outputPath, webp)
  }

  const sourceHashAfter = sha256(readFileSync(sourcePath))
  const report = {
    format: 'webp',
    generated: unchanged ? 0 : 1,
    height: dimensions.height,
    output: outputPath,
    outputBytes: statSync(outputPath).size,
    preservedSourceImage: sourceHashBefore === sourceHashAfter,
    quality,
    sourceBytes: source.length,
    sourceSha256: sourceHashAfter,
    verified: unchanged ? 1 : 0,
    width: dimensions.width,
  }

  console.log(JSON.stringify(report, null, 2))

  if (!report.preservedSourceImage) {
    throw new Error('Dashboard hero source hash changed during derivative generation.')
  }
} finally {
  await browser.close()
}

async function renderWebp(page, source, options) {
  const dataUrl = `data:image/png;base64,${source.toString('base64')}`
  const base64 = await page.evaluate(
    async ({ dataUrl, height, quality, width }) => {
      const image = new Image()
      image.decoding = 'async'
      await new Promise((resolveImage, rejectImage) => {
        image.onload = () => resolveImage()
        image.onerror = () => rejectImage(new Error('Dashboard hero failed to load.'))
        image.src = dataUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Canvas context unavailable.')
      }

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, width, height)

      const blob = await new Promise((resolveBlob) =>
        canvas.toBlob(resolveBlob, 'image/webp', quality),
      )

      if (!blob) {
        throw new Error('WebP encoding failed.')
      }

      const buffer = await blob.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''

      for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index])
      }

      return btoa(binary)
    },
    {
      dataUrl,
      height: options.height,
      quality: options.quality,
      width: options.width,
    },
  )

  return Buffer.from(base64, 'base64')
}

function readPngDimensions(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('Expected PNG signature.')
  }

  return {
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16),
  }
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}
