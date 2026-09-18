#!/usr/bin/env node

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { extractTtsWorkshopProfiles, TTS_PROFILE_CATALOG_SCHEMA } from '../bot/tts-workshop-profile-catalog.mjs'

const [inputValue, outputValue = 'data/infinity-army/tts-profile-catalog.json'] = process.argv.slice(2)
if (!inputValue) throw new Error('Usage: node scripts/build-tts-profile-catalog.mjs <workshop-save.json> [output.json]')
const input = resolve(inputValue)
const output = resolve(outputValue)
const source = JSON.parse(await readFile(input, 'utf8'))
const profiles = extractTtsWorkshopProfiles(source)
const artifact = {
  schemaVersion: TTS_PROFILE_CATALOG_SCHEMA,
  source: { saveName: source.SaveName || null, date: source.Date || null, epochTime: source.EpochTime || null, versionNumber: source.VersionNumber || null },
  profileCount: profiles.length,
  fingerprint: createHash('sha256').update(profiles.map((profile) => JSON.stringify(profile)).join('\n')).digest('hex'),
  profiles,
}
await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(artifact)}\n`, 'utf8')
console.log(JSON.stringify({ output, profiles: profiles.length, fingerprint: artifact.fingerprint }))
