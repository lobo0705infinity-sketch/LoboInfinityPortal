import assert from 'node:assert/strict'
import { isDeterministicInvalidArmyCodeResponse } from './infinity-army-decode.mjs'

const deterministic = `<!doctype html><html><head><title>Errors in Army Code</title></head><body>
  <p>The following IDs from the army code could not resolved. Most likely it is out of date.</p>
  <table><tr><th>ID</th><th>Name</th><th>Error</th></tr>
  <tr><td>1874-1-1</td><td>SĀCHĀ, Xenotech Hunters</td><td>Unit option not found in sectorial</td></tr></table>
</body></html>`

assert.equal(isDeterministicInvalidArmyCodeResponse(200, deterministic), true)
assert.equal(isDeterministicInvalidArmyCodeResponse(200, deterministic.replaceAll('th>', 'td>')), true)
assert.equal(isDeterministicInvalidArmyCodeResponse(503, deterministic), false)
assert.equal(isDeterministicInvalidArmyCodeResponse(200, deterministic.replace('Most likely it is out of date.', 'Please retry.')), false)
assert.equal(isDeterministicInvalidArmyCodeResponse(200, deterministic.replace('Unit option not found in sectorial', 'Temporary lookup error')), false)
assert.equal(isDeterministicInvalidArmyCodeResponse(200, deterministic.replace('</body>', '<h2>Army List:</h2></body>')), false)

console.log('Infinity-Data deterministic invalid-code response checks passed.')
