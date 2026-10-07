import assert from 'node:assert/strict'
import { initializeDeploymentRecovery } from '../src/services/deploymentRecovery.ts'
let handler, reloads = 0, prevented = 0
const values = new Map()
globalThis.window = { addEventListener: (name, callback) => { assert.equal(name, 'vite:preloadError'); handler = callback }, location: { reload: () => reloads++ } }
globalThis.sessionStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
initializeDeploymentRecovery()
const event = { preventDefault: () => prevented++ }
handler(event)
assert.equal(reloads, 1)
assert.equal(prevented, 1)
handler(event)
assert.equal(reloads, 1, 'repeated failure must reach the error boundary rather than reload in a loop')
values.set('lobo:deployment-recovery-at', String(Date.now() - 61_000))
handler(event)
assert.equal(reloads, 2, 'later deployments can recover again')
globalThis.sessionStorage = { getItem: () => { throw Error('blocked') } }
handler(event)
assert.equal(reloads, 2)
console.log('PASS deployment chunk recovery reloads once, avoids loops, and tolerates blocked storage')
