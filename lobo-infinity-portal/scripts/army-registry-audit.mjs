import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const scannedRoots = ['src', 'backend']
const allowedFiles = new Set([
  'src/config/armies.ts',
  'src/content/rulebooks/teamTournament.ts',
  'backend/ArmyRegistry.gs',
])

const blockedPatterns = [
  /canonicalFactionFallbacks/,
  /Vanilla Pan O/i,
  /Vanilla Pan-?O/i,
  /Vanilla CA/i,
  /Vanilla YJ/i,
  /Vanilla Haqq/i,
  /Vanilla Nomads/i,
]

const hardcodedArrayPattern =
  /const\s+\w*(?:Faction|Army|Armies)\w*\s*=\s*\[[\s\S]*?(PanOceania|Yu Jing|Haqqislam|Nomads|Combined Army|ALEPH|Ariadna)[\s\S]*?\]/m

const issues = []

for (const file of walk(scannedRoots.map((entry) => join(root, entry)))) {
  const path = relative(root, file).replaceAll('\\', '/')
  const text = readFileSync(file, 'utf8')

  if (!allowedFiles.has(path)) {
    for (const pattern of blockedPatterns) {
      if (pattern.test(text)) {
        issues.push(`${path}: contains legacy army alias ${pattern}`)
      }
    }

    if (hardcodedArrayPattern.test(text)) {
      issues.push(`${path}: contains a hardcoded army/faction array`)
    }
  }
}

if (issues.length > 0) {
  console.error('Army registry audit failed:')
  for (const issue of issues) console.error(`- ${issue}`)
  process.exit(1)
}

console.log('Army registry audit passed.')

function walk(paths) {
  const files = []

  for (const path of paths) {
    if (!statSync(path).isDirectory()) {
      files.push(path)
      continue
    }

    for (const entry of readdirSync(path)) {
      const child = join(path, entry)
      const stats = statSync(child)
      if (stats.isDirectory()) {
        files.push(...walk([child]))
      } else if (/\.(ts|tsx|gs|js)$/.test(entry)) {
        files.push(child)
      }
    }
  }

  return files
}
