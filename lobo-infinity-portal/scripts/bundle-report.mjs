import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const assetsDir = join(process.cwd(), 'dist', 'assets')
const assets = readdirSync(assetsDir)
  .map((name) => {
    const size = statSync(join(assetsDir, name)).size
    return { name, size }
  })
  .sort((left, right) => right.size - left.size)

const report = {
  generatedAt: new Date().toISOString(),
  largestAssets: assets.slice(0, 25),
  totalBytes: assets.reduce((total, asset) => total + asset.size, 0),
}

writeFileSync(
  join(process.cwd(), 'dist', 'bundle-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
)

console.log(JSON.stringify(report, null, 2))
