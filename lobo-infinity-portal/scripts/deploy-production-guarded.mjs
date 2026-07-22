import { execFileSync, spawnSync } from 'node:child_process'
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
const diagnose = process.argv.includes('--diagnose')
let currentStep = 'initialization'

function fail(message) {
  const error = new Error(message)
  error.step = currentStep
  throw error
}

function run(command, args, options = {}) {
  const label = options.step ?? `${command} ${args.join(' ')}`
  currentStep = label
  if (diagnose) {
    console.log(`STEP: ${label}`)
  }

  if (dryRun && options.skipInDryRun) {
    console.log(`[dry-run] ${command} ${args.join(' ')}`)
    return options.dryRunOutput ?? ''
  }

  try {
    const output = execFileSync(command, args, {
      cwd: options.cwd ?? portalRoot,
      encoding: 'utf8',
      env: options.env ?? process.env,
      stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    }).trim()
    if (diagnose) {
      console.log(`PASS: ${label}`)
    }
    return output
  } catch (error) {
    error.step = label
    throw error
  }
}

function readJson(command, args, options = {}) {
  return JSON.parse(run(command, args, options))
}

function normalizeProcessOutput(output) {
  if (output == null) {
    return ''
  }
  if (Buffer.isBuffer(output)) {
    return output.toString('utf8')
  }
  return output
}

function spawnVercel(args, options) {
  if (process.platform !== 'win32') {
    return spawnSync('npx', args, options)
  }

  const commandLine = ['npx.cmd', ...args].join(' ')

  return spawnSync(
    'cmd.exe',
    ['/d', '/s', '/c', commandLine],
    options,
  )
}

function printError(error) {
  console.error(`FAIL: ${error.step ?? currentStep}`)
  console.error(`error name: ${error.name ?? 'Error'}`)
  console.error(`error message: ${error.message ?? String(error)}`)
  if (error.status != null) {
    console.error(`child exit code: ${error.status}`)
  }
  const stdout = normalizeProcessOutput(error.stdout)
  const stderr = normalizeProcessOutput(error.stderr)
  if (stdout) {
    console.error(`child stdout:\n${stdout}`)
  }
  if (stderr) {
    console.error(`child stderr:\n${stderr}`)
  }
  if (error.stack) {
    console.error(`stack trace:\n${error.stack}`)
  }
}

function validateEnvironment() {
  currentStep = 'environment-variable validation'
  if (diagnose) {
    console.log(`STEP: ${currentStep}`)
  }
  if (!scope) {
    fail('VERCEL_SCOPE is empty')
  }
  if (diagnose) {
    console.log(`PASS: ${currentStep}`)
  }
}

function runMain() {
  currentStep = 'current working directory check'
  if (diagnose) {
    console.log(`STEP: ${currentStep}`)
    console.log(`cwd=${process.cwd()}`)
    console.log(`portalRoot=${portalRoot}`)
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
  if (diagnose) {
    console.log(`PASS: ${currentStep}`)
  }

  currentStep = 'Vercel project/root validation'
  if (diagnose) {
    console.log(`STEP: ${currentStep}`)
  }
  const project = readJson('node', ['--input-type=module', '-e', "import fs from 'node:fs'; console.log(fs.readFileSync('../.vercel/project.json','utf8'))"], {
    step: 'read Vercel project metadata',
  })
  if (project.projectName !== expectedProject) {
    fail(`Vercel project must be ${expectedProject}; got ${project.projectName}`)
  }
  if (project.settings?.rootDirectory !== expectedPortalRootName) {
    fail(`Vercel rootDirectory must be ${expectedPortalRootName}; got ${project.settings?.rootDirectory}`)
  }
  if (diagnose) {
    console.log(`PASS: ${currentStep}`)
  }

  currentStep = 'Git commit detection'
  if (diagnose) {
    console.log(`STEP: ${currentStep}`)
  }
  const branch = run('git', ['branch', '--show-current'], { step: 'detect Git branch' })
  const commit = run('git', ['rev-parse', 'HEAD'], { step: 'detect Git commit' })
  if (branch !== 'main') {
    fail(`production deploy requires main; got ${branch}`)
  }
  if (diagnose) {
    console.log(`PASS: ${currentStep}`)
    console.log(`branch=${branch}`)
    console.log(`commit=${commit}`)
  }

  currentStep = 'clean-worktree check'
  if (diagnose) {
    console.log(`STEP: ${currentStep}`)
  }
  const status = run('git', ['status', '--porcelain'], { step: 'read Git worktree status' })
  if (status) {
    if (dryRun || diagnose) {
      console.log(`WARNING: real deployment would fail until these files are clean:\n${status}`)
    } else {
      fail(`production deploy requires a clean portal worktree; dirty files:\n${status}`)
    }
  }
  if (diagnose && !status) {
    console.log(`PASS: ${currentStep}`)
  }

  validateEnvironment()

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

  if (dryRun || diagnose) {
    console.log(diagnose ? `PASS: guarded deploy diagnose` : `PASS: guarded deploy dry run`)
    console.log(`releaseRoot=${releaseRoot}`)
    console.log(`project=${project.projectName}`)
    console.log(`rootDirectory=${project.settings.rootDirectory}`)
    console.log(`commit=${commit}`)
    console.log(`deployCommand=npx.cmd ${deployArgs.slice(1).join(' ')}`)
    return
  }

  currentStep = 'execute Vercel production deployment'
  const deploy = spawnVercel(deployArgs.slice(1), {
    cwd: releaseRoot,
    encoding: 'utf8',
    env: buildEnv,
  })
  if (deploy.error) {
    deploy.error.step = currentStep
    deploy.error.status = deploy.status
    deploy.error.stdout = deploy.stdout
    deploy.error.stderr = deploy.stderr
    throw deploy.error
  }
  const deployStdout = normalizeProcessOutput(deploy.stdout)
  const deployStderr = normalizeProcessOutput(deploy.stderr)
  process.stdout.write(deployStdout)
  process.stderr.write(deployStderr)
  if (deploy.status !== 0) {
    const error = new Error('Vercel deployment command failed')
    error.step = currentStep
    error.status = deploy.status
    error.stdout = deploy.stdout
    error.stderr = deploy.stderr
    throw error
  }

  const deploymentId = deployStdout.match(/"id":\s*"(dpl_[^"]+)"/)?.[1]
  if (!deploymentId) {
    fail('could not determine Vercel deployment ID from deploy output')
  }

  currentStep = 'assign production alias'
  const alias = spawnVercel(['--yes', 'vercel', 'alias', 'set', deploymentId, productionAlias, '--scope', scope], {
    cwd: releaseRoot,
    encoding: 'utf8',
  })
  if (alias.error) {
    alias.error.step = currentStep
    alias.error.status = alias.status
    alias.error.stdout = alias.stdout
    alias.error.stderr = alias.stderr
    throw alias.error
  }
  const aliasStdout = normalizeProcessOutput(alias.stdout)
  const aliasStderr = normalizeProcessOutput(alias.stderr)
  process.stdout.write(aliasStdout)
  process.stderr.write(aliasStderr)
  if (alias.status !== 0) {
    const error = new Error('Vercel alias command failed')
    error.step = currentStep
    error.status = alias.status
    error.stdout = alias.stdout
    error.stderr = alias.stderr
    throw error
  }

  currentStep = 'post-deploy verification'
  run('node', ['scripts/post-deploy-production-verify.mjs'], {
    cwd: portalRoot,
    env: {
      ...process.env,
      EXPECTED_DEPLOYMENT_ID: deploymentId,
      EXPECTED_GIT_COMMIT: commit,
      PRODUCTION_URL: `https://${productionAlias}`,
    },
    stdio: 'inherit',
    step: currentStep,
  })

  console.log(`PASS: guarded production deployment ${deploymentId} verified`)
}

try {
  runMain()
} catch (error) {
  printError(error)
  process.exit(1)
}
