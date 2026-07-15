import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fail, pass, repoRoot } from './release-utils.mjs'

const backendDir = resolve(repoRoot, 'backend')
const files = readdirSync(backendDir)
  .filter((file) => file.endsWith('.gs'))
  .sort()

const failures = []

files.forEach((file) => {
  const fullPath = resolve(backendDir, file)
  const source = readFileSync(fullPath, 'utf8')
  try {
    execFileSync('node', ['--check', '--input-type=commonjs'], {
      cwd: repoRoot,
      input: source,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (error) {
    failures.push(file)
  }
})

if (failures.length) {
  fail('Apps Script syntax check failed', failures)
}

pass(`Apps Script syntax check passed for ${files.length} files`)
