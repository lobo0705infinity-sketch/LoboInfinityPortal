#!/usr/bin/env node

import { loadAroBenchmarkCatalog } from '../bot/aro-catalog-store.mjs'
import { rankArmyAros } from '../bot/aro-benchmark-catalog.mjs'
import { decodeArmyCode, normalizeArmyCodeInput } from './infinity-army-decode.mjs'

const input = process.argv.slice(2).join(' ').trim()
if (!input) throw new Error('Usage: node scripts/rank-army-aros.mjs <Army code>')
const catalog = await loadAroBenchmarkCatalog()
if (!catalog) throw new Error('ARO catalog unavailable')
const decoded = decodeArmyCode(normalizeArmyCodeInput(input))
console.log(JSON.stringify({ benchmarkVersion: catalog.benchmarkVersion, fingerprint: catalog.fingerprint, results: rankArmyAros(catalog, decoded) }, null, 2))
