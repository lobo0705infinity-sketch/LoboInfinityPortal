import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fail, pass, repoRoot } from './release-utils.mjs'

const knownGood = JSON.parse(
  readFileSync(resolve(repoRoot, 'release', 'known-good.json'), 'utf8'),
)
const latest = knownGood.releases?.[0]

if (!latest) {
  fail('No known-good release pair is recorded.')
}

pass('latest known-good release pair')
console.log(`gitCommit=${latest.gitCommit}`)
console.log(`vercelDeploymentId=${latest.vercelDeploymentId}`)
console.log(`vercelUrl=${latest.vercelUrl}`)
console.log(`appsScriptDeploymentId=${latest.appsScriptDeploymentId}`)
console.log(`appsScriptVersion=${latest.appsScriptVersion}`)
console.log(`apiEndpoint=${latest.apiEndpoint}`)
console.log('')
console.log('Rollback must restore this matching pair. Do not roll back only one side.')
console.log(`Suggested frontend alias command after approval: npx vercel alias set ${latest.vercelUrl} lobo-infinity-portal.vercel.app`)
