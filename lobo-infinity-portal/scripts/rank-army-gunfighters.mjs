#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { rankArmyGunfighters } from '../bot/gunfighter-benchmark-catalog.mjs'
import { decodeArmyCode, normalizeArmyCodeInput } from './infinity-army-decode.mjs'

const args = parseArgs(process.argv.slice(2))
if (!args.input || !args.catalog) throw new Error('Usage: npm run gunfighters:rank -- --input <Army code> --catalog <catalog.json> [--limit 4]')
const catalog = JSON.parse(await readFile(resolve(args.catalog), 'utf8'))
const decoded = decodeArmyCode(normalizeArmyCodeInput(args.input))
const results = rankArmyGunfighters(catalog, decoded, { limit: Number(args.limit || 4) })
console.log(JSON.stringify({ catalogFingerprint: catalog.fingerprint, listName: decoded.listName, results }, null, 2))

function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 2) result[values[index].replace(/^--/, '')] = values[index + 1]; return result }
