import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const portalRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const releaseRoot = resolve(portalRoot, '..')
const expectedReleaseRoot = resolve('C:/Users/19734/Documents/LoboInfinityLeague/.codex-deploy/release-safeguards-main')
const expectedPortalRootName = 'lobo-infinity-portal'
const expectedProject = 'lobo-infinity-portal'
const productionAlias = 'lobo-infinity-portal.vercel.app'
const scope = process.env.VERCEL_SCOPE || 'lobo0705infinity-5309s-projects'
const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run')

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

function run(command, args, options = {}) {
  if (dryRun && options.skipInDryRun) {
    console.log(`[dry-run] ${command} ${args.join(' ')}`)
    return options.dryRunOutput ?? ''
  }

  return execFileSync(command, args, {
    cwd: options.cwd ?? portalRoot,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function readJson(command, args, options = {}) {
  return JSON.parse(run(command, args, options))
}

if (process.cwd() !== portalRoot) {
  fail(`run from ${portalRoot}`)
}

if (portalRoot.split(/[\\/]/).at(-1) !== expectedPortalRootName) {
  fail(`portal root must end with ${expectedPortalRootName}`)
}

if (releaseRoot !== expectedReleaseRoot) {
  fail(`unexpected release root ${releaseRoot}`)
}

const project = readJson('node', ['--input-type=module', '-e', "import fs from 'node:fs'; console.log(fs.readFileSync('../.vercel/project.json','utf8'))"])
if (project.projectName !== expectedProject) {
  fail(`Vercel project must be ${expectedProject}; got ${project.projectName}`)
}
if (project.settings?.rootDirectory !== expectedPortalRootName) {
  fail(`Vercel rootDirectory must be ${expectedPortalRootName}; got ${project.settings?.rootDirectory}`)
}

const branch = run('git', ['branch', '--show-current'])
const commit = run('git', ['rev-parse', 'HEAD'])
if (branch !== 'main') {
  fail(`production deploy requires main; got ${branch}`)
}

const status = run('git', ['status', '--porcelain'])
if (status) {
  if (dryRun) {
    console.log(`DRY-RUN WARNING: real deployment would fail until these files are clean:\n${status}`)
  } else {
    fail(`production deploy requires a clean portal worktree; dirty files:\n${status}`)
  }
}

const buildEnv = {
  ...process.env,
  VITE_BUILD_GIT_COMMIT: commit,
  VITE_BUILD_GIT_BRANCH: branch,
}

const deployArgs = [
  '--yes',
  'vercel',
  '--prod',
  '--yes',
  '--scope',
  scope,
  '--build-env',
  `VITE_BUILD_GIT_COMMIT=${commit}`,
  '--build-env',
  `VITE_BUILD_GIT_BRANCH=${branch}`,
]

if (dryRun) {
  console.log(`PASS: guarded deploy dry run`)
  console.log(`releaseRoot=${releaseRoot}`)
  console.log(`project=${project.projectName}`)
  console.log(`rootDirectory=${project.settings.rootDirectory}`)
  console.log(`commit=${commit}`)
  console.log(`deployCommand=npx.cmd ${deployArgs.slice(1).join(' ')}`)
  process.exit(0)
}

const deploy = spawnSync('npx.cmd', deployArgs.slice(1), {
  cwd: releaseRoot,
  encoding: 'utf8',
  env: buildEnv,
})
process.stdout.write(deploy.stdout)
process.stderr.write(deploy.stderr)
if (deploy.status !== 0) {
  process.exit(deploy.status ?? 1)
}

const deploymentId = deploy.stdout.match(/"id":\s*"(dpl_[^"]+)"/)?.[1]
if (!deploymentId) {
  fail('could not determine Vercel deployment ID from deploy output')
}

run('npx.cmd', ['--yes', 'vercel', 'alias', 'set', deploymentId, productionAlias, '--scope', scope], {
  cwd: releaseRoot,
  stdio: 'inherit',
})

run('node', ['scripts/post-deploy-production-verify.mjs'], {
  cwd: portalRoot,
  env: {
    ...process.env,
    EXPECTED_DEPLOYMENT_ID: deploymentId,
    EXPECTED_GIT_COMMIT: commit,
    PRODUCTION_URL: `https://${productionAlias}`,
  },
  stdio: 'inherit',
})

console.log(`PASS: guarded production deployment ${deploymentId} verified`)
