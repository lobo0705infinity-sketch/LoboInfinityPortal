#!/usr/bin/env node

import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const output = resolve(process.argv[2] || 'tmp/official-army-payloads.json')
const metadata = await fetchJson('https://api.corvusbelli.com/army/infinity/en/metadata')
const ids = collectFactionIds(metadata.factions)
const payloads = []
for (let offset = 0; offset < ids.length; offset += 8) {
  const batch = ids.slice(offset, offset + 8)
  const values = await Promise.all(batch.map(async (sectorialId) => {
    const url = `https://api.corvusbelli.com/army/units/en/${sectorialId}`
    const body = await fetchJson(url)
    return Array.isArray(body?.units) ? { ...body, url } : null
  }))
  payloads.push(...values.filter(Boolean))
  console.log(`Captured official payloads ${Math.min(offset + batch.length, ids.length)}/${ids.length}`)
}
await writeFile(output, `${JSON.stringify({ metadata, payloads })}\n`, 'utf8')
console.log(JSON.stringify({ output, payloads: payloads.length }))

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', origin: 'https://infinityuniverse.com', referer: 'https://infinityuniverse.com/army/' } })
  if (!response.ok) throw new Error(`Official Infinity Army request failed (${response.status}) for ${url}`)
  return response.json()
}

function collectFactionIds(factions) {
  const ids = new Set()
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    if (Number.isInteger(Number(value.id))) ids.add(Number(value.id))
    for (const [key, child] of Object.entries(value)) if (key !== 'id') visit(child)
  }
  visit(factions)
  return [...ids].filter((id) => id > 0 && id < 10_000).sort((a, b) => a - b)
}
