import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
// Read Lua data literals without executing the uploaded script.
class LuaData {
  constructor(text, offset = 0) { this.text = text; this.offset = offset }
  skip() { for (;;) { const m = /^(?:\s+|--[^\n]*(?:\n|$))/.exec(this.text.slice(this.offset)); if (!m) return; this.offset += m[0].length } }
  take(value) { this.skip(); if (!this.text.startsWith(value, this.offset)) throw Error(`Expected ${value} at ${this.offset}`); this.offset += value.length }
  value() {
    this.skip(); const rest = this.text.slice(this.offset), long = /^\[(=*)\[/.exec(rest)
    if (long) { const end = this.text.indexOf(`]${long[1]}]`, this.offset + long[0].length); if (end < 0) throw Error('Unterminated literal'); const value = this.text.slice(this.offset + long[0].length, end); this.offset = end + long[1].length + 2; return value }
    if (rest[0] === '"') { const m = /^"(?:[^"\\]|\\.)*"/.exec(rest); if (!m) throw Error('Unterminated string'); this.offset += m[0].length; return JSON.parse(m[0]) }
    if (rest[0] === '{') {
      this.offset++; const array = [], object = {}; let keyed = false
      for (;;) {
        this.skip(); if (this.text[this.offset] === '}') { this.offset++; return keyed ? object : array }
        const key = /^([A-Za-z_]\w*)\s*=/.exec(this.text.slice(this.offset))
        if (this.text[this.offset] === '[' && !/^\[(=*)\[/.test(this.text.slice(this.offset))) { this.offset++; const name = this.value(); this.take(']'); this.take('='); object[name] = this.value(); keyed = true }
        else if (key) { this.offset += key[0].length; object[key[1]] = this.value(); keyed = true }
        else array.push(this.value())
        this.skip(); if (this.text[this.offset] === ',') this.offset++
      }
    }
    const m = /^(true|false|nil|-?\d+(?:\.\d+)?)/.exec(rest); if (!m) throw Error(`Unsupported data at ${this.offset}: ${rest.slice(0,30)}`)
    this.offset += m[0].length; return m[0] === 'true' ? true : m[0] === 'false' ? false : m[0] === 'nil' ? null : Number(m[0])
  }
}
const input = process.argv[2]; if (!input) throw Error('Pass the spawner JSON path')
const bytes = readFileSync(input), script = JSON.parse(bytes).ObjectStates[0].LuaScript
function table(name) {
  const matches = [...script.matchAll(new RegExp(`(?:^|\\n)(?:local )?${name} = (\\{)`, 'g'))]
  for (const m of matches.reverse()) { const value = new LuaData(script, m.index + m[0].length - 1).value(); if (Object.keys(value).length) return value }
  throw Error(`Missing ${name}`)
}
function indexed(name) {
  const output = {}
  for (const m of script.matchAll(new RegExp(`(?:^|\\n)${name}\\[`, 'g'))) { const p = new LuaData(script, m.index + m[0].length), key = p.value(); p.take(']'); p.take('='); output[key] = p.value() }
  return output
}
const library = table('MODEL_LIBRARY')
const catalog = { version: 1, sourceSha256: createHash('sha256').update(bytes).digest('hex'), library,
  silhouettes: table('SILHOUETTE_TEMPLATES'), remaps: table('OPTION_REMAP'), peripherals: table('UNIT_PERIPHERALS'), peripheralFallbacks: table('PERIPHERAL_FALLBACKS'),
  minelayers: indexed('MINELAYER_LOADOUTS'), deployables: indexed('DEPLOYABLE_MODELS') }
const output = new URL('../bot/tts-2d-catalog.json.gz', import.meta.url)
writeFileSync(output, gzipSync(JSON.stringify(catalog), { level: 9 }))
console.log(`Built ${library.rows.length} profiles; ${library.pool.length} pooled fragments; ${readFileSync(output).length} bytes`)
