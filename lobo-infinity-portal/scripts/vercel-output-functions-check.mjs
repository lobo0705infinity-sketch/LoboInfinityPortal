import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const outputRoot = resolve(process.argv[2] || '.vercel/output')
const requiredFunctions = [
  'api/army-intelligence-refresh-worker',
  'api/automation-queue-worker',
  'api/commissioner-login',
]

const failures = []
for (const name of requiredFunctions) {
  const functionRoot = resolve(outputRoot, 'functions', `${name}.func`)
  const configPath = resolve(functionRoot, '.vc-config.json')
  if (!existsSync(functionRoot)) failures.push(`missing function output: ${name}`)
  if (!existsSync(configPath)) failures.push(`missing function runtime config: ${name}`)
}

const outputConfigPath = resolve(outputRoot, 'config.json')
if (!existsSync(outputConfigPath)) {
  failures.push('missing .vercel/output/config.json')
} else {
  const config = JSON.parse(readFileSync(outputConfigPath, 'utf8'))
  const routes = Array.isArray(config.routes) ? config.routes : []
  const filesystemIndex = routes.findIndex((route) => route?.handle === 'filesystem')
  const fallbackIndex = routes.findIndex((route) => route?.dest === '/index.html')
  if (filesystemIndex < 0) failures.push('missing filesystem/function routing stage')
  if (fallbackIndex < 0) failures.push('missing SPA fallback')
  if (filesystemIndex >= 0 && fallbackIndex >= 0 && filesystemIndex > fallbackIndex) {
    failures.push('SPA fallback precedes filesystem/function routing')
  }
}

if (failures.length) {
  console.error('FAIL: deployable Vercel output is incomplete')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

requiredFunctions.forEach((name) => console.log(`PASS: deployable function ${name}`))
console.log('PASS: filesystem/functions route before SPA fallback')
