import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { chromium } from 'playwright'

const sourceRoot = resolve(process.cwd(), 'public', 'faction-portraits')
const cardRoot = join(sourceRoot, 'cards')
const registryPath = resolve(process.cwd(), 'src', 'config', 'factionPortraits.ts')
const cardWidth = 320
const webpQuality = 0.82

const expectedSources = getRegistryPortraitFiles()
const failures = []
const sourceHashesBefore = new Map()
const generated = []
const verified = []
const skipped = []

mkdirSync(cardRoot, { recursive: true })

for (const file of expectedSources) {
  const sourcePath = join(sourceRoot, file)

  if (!existsSync(sourcePath)) {
    failures.push(`Missing source portrait: ${sourcePath}`)
    continue
  }

  sourceHashesBefore.set(file, sha256(sourcePath))
}

if (failures.length === 0) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    for (const file of expectedSources) {
      const sourcePath = join(sourceRoot, file)
      const outputFile = `${basename(file, extname(file))}.webp`
      const outputPath = join(cardRoot, outputFile)
      const source = readFileSync(sourcePath)
      const dimensions = readPngDimensions(source)
      const targetWidth = Math.min(cardWidth, dimensions.width)
      const targetHeight = Math.max(1, Math.round((dimensions.height / dimensions.width) * targetWidth))
      const webp = await renderWebpDerivative(page, source, {
        height: targetHeight,
        quality: webpQuality,
        width: targetWidth,
      })

      if (existsSync(outputPath) && readFileSync(outputPath).equals(webp)) {
        verified.push({
          file: outputFile,
          height: targetHeight,
          size: statSync(outputPath).size,
          source: file,
          width: targetWidth,
        })
        continue
      }

      writeFileSync(outputPath, webp)
      generated.push({
        file: outputFile,
        height: targetHeight,
        size: webp.length,
        source: file,
        width: targetWidth,
      })
    }
  } finally {
    await browser.close()
  }
}

const expectedDerivativeFiles = new Set(
  expectedSources.map((file) => `${basename(file, extname(file))}.webp`),
)

for (const file of readdirSync(cardRoot).filter((entry) => entry.endsWith('.webp'))) {
  if (!expectedDerivativeFiles.has(file)) {
    skipped.push(file)
  }
}

for (const file of expectedSources) {
  const expectedHash = sourceHashesBefore.get(file)
  const currentHash = sha256(join(sourceRoot, file))

  if (expectedHash !== currentHash) {
    failures.push(`Source portrait changed while generating derivatives: ${file}`)
  }
}

const missingDerivatives = [...expectedDerivativeFiles]
  .filter((file) => !existsSync(join(cardRoot, file)))
  .sort()

if (missingDerivatives.length > 0) {
  failures.push(`Missing card portrait derivatives: ${missingDerivatives.join(', ')}`)
}

const report = {
  cardWidth,
  format: 'webp',
  generated,
  missingDerivatives,
  preservedSourcePortraits: failures.every(
    (failure) => !failure.startsWith('Source portrait changed'),
  ),
  skippedUnmappedDerivatives: skipped.sort(),
  sourceCount: expectedSources.length,
  verified,
  webpQuality,
}

console.log(JSON.stringify(report, null, 2))

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

function getRegistryPortraitFiles() {
  const source = readFileSync(registryPath, 'utf8')
  const matches = [...source.matchAll(/src:\s*`\$\{FACTION_PORTRAIT_BASE_PATH\}([^`]+\.png)`/g)]
  const files = [...new Set(matches.map((match) => match[1]))].sort()

  if (files.length === 0) {
    throw new Error(`No registry portrait files found in ${registryPath}`)
  }

  return files
}

async function renderWebpDerivative(page, source, options) {
  const dataUrl = `data:image/png;base64,${source.toString('base64')}`

  const base64 = await page.evaluate(
    async ({ dataUrl, height, quality, width }) => {
      const image = new Image()
      image.decoding = 'async'
      await new Promise((resolveImage, rejectImage) => {
        image.onload = () => resolveImage()
        image.onerror = () => rejectImage(new Error('Portrait failed to load.'))
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
  const signature = buffer.subarray(0, 8).toString('hex')

  if (signature !== '89504e470d0a1a0a') {
    throw new Error('Expected PNG signature.')
  }

  return {
    colorType: buffer[25],
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16),
  }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}
