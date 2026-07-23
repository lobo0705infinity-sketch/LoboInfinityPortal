#!/usr/bin/env node

/*
 * Standalone Infinity Army list decoder.
 *
 * Army-code byte parsing is ported from twonirwana/Infinity-Data:
 * https://github.com/twonirwana/Infinity-Data
 *
 * Infinity-Data is MIT licensed.
 * Copyright (c) 2020 Oliver Matthews.
 * See docs/third-party/Infinity-Data-MIT-NOTICE.md.
 */

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const portalRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultOutputDir = resolve(portalRoot, '.tmp', 'army-decode')
const infinityDataBaseUrl =
  process.env.INFINITY_DATA_BASE_URL || 'https://infinity.2nirwana.de/cards'

const parentFactionBySectorialSlug = new Map([
  ['operations', 'ALEPH'],
])

export async function decodeArmyListToFiles({
  input,
  jsonPath,
  csvPath,
  outputDir = defaultOutputDir,
} = {}) {
  if (!input) {
    throw new Error('Missing required --input value.')
  }

  const armyCode = normalizeArmyCodeInput(input)
  const codeData = decodeArmyCode(armyCode)
  const html = await fetchInfinityDataOverview(armyCode)
  const resolved = parseInfinityDataOverview(html)
  const list = buildStructuredList(armyCode, codeData, resolved)
  const csv = toCsv(list)

  const safeName = slugify(list.listName || list.sectorial || 'army-list')
  const codeHash = createHash('sha256').update(armyCode).digest('hex').slice(0, 12)
  const finalJsonPath = resolve(jsonPath || outputDir, jsonPath ? '' : `${safeName}-${codeHash}.json`)
  const finalCsvPath = resolve(csvPath || outputDir, csvPath ? '' : `${safeName}-${codeHash}.csv`)

  await mkdir(dirname(finalJsonPath), { recursive: true })
  await mkdir(dirname(finalCsvPath), { recursive: true })
  await writeFile(finalJsonPath, `${JSON.stringify(list, null, 2)}\n`, 'utf8')
  await writeFile(finalCsvPath, csv, 'utf8')

  return {
    csvPath: finalCsvPath,
    jsonPath: finalJsonPath,
    list,
  }
}

export function normalizeArmyCodeInput(input) {
  const trimmed = String(input).trim()

  try {
    const url = new URL(trimmed)
    for (const key of ['armyData', 'armyCode', 'code', 'list']) {
      const value = url.searchParams.get(key)
      if (value) {
        return value.trim()
      }
    }

    const candidates = url.pathname
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .reverse()

    const pathCode = candidates.find((part) => /%3D|=|[A-Za-z0-9_-]{24,}/.test(part))
    if (pathCode) {
      return pathCode
    }
  } catch {
    // Raw army codes are not URLs.
  }

  return trimmed
}

export function decodeArmyCode(input) {
  const armyCode = decodeURIComponent(input)
  const bytes = Buffer.from(armyCode, 'base64')
  let offset = 0

  function readVli() {
    const value = bytes.readInt8(offset)
    if (value < 0) {
      const result = bytes.readUInt16BE(offset) & ~(1 << 15)
      offset += 2
      return result
    }
    offset += 1
    return value
  }

  function readString() {
    const length = readVli()
    const value = bytes.subarray(offset, offset + length).toString('utf8')
    offset += length
    return value
  }

  const sectorialId = readVli()
  const sectorialSlug = readString()
  const armyNameLength = bytes.readUInt8(offset)
  offset += 1
  const armyName = bytes.subarray(offset, offset + armyNameLength).toString('utf8')
  offset += armyNameLength
  const maxPoints = readVli()
  const combatGroupCount = readVli()
  const combatGroups = []

  for (let index = 0; index < combatGroupCount; index += 1) {
    const combatGroupId = readVli()
    const versionSwitch = readVli()
    const reinforcement = versionSwitch === 1 ? readVli() : null
    const size = readVli()
    const fillerZero = versionSwitch === 1 ? readVli() : null
    const members = []

    for (let memberIndex = 0; memberIndex < size; memberIndex += 1) {
      if (versionSwitch === 0) {
        readVli()
      }
      const unitId = readVli()
      const groupId = readVli()
      const optionId = readVli()
      const trailingZero = bytes.readUInt8(offset)
      offset += 1

      members.push({
        combinedId: `${sectorialId}-${unitId}-${groupId}-${optionId}-1`,
        groupId,
        optionId,
        trailingZero,
        unitId,
      })

      if (memberIndex < size - 1 && versionSwitch === 1) {
        readVli()
      }
    }

    combatGroups.push({
      combatGroup: index + 1,
      combatGroupId,
      fillerZero,
      members,
      reinforcement,
      versionSwitch,
    })
  }

  if (offset !== bytes.length) {
    throw new Error(`Army code decode ended at byte ${offset}, expected ${bytes.length}.`)
  }

  return {
    byteLength: bytes.length,
    combatGroupCount,
    combatGroups,
    listName: armyName,
    maxPoints,
    sectorialId,
    sectorialSlug,
  }
}

async function fetchInfinityDataOverview(armyCode) {
  const url = new URL(`${infinityDataBaseUrl.replace(/\/+$/, '')}/generate`)
  url.searchParams.set('armyData', armyCode)
  url.searchParams.set('unit', 'inch')
  url.searchParams.set('style', 'a4_overview')
  url.searchParams.set('showEquipmentWeapons', 'on')
  url.searchParams.set('showSkillWeapon', 'on')

  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  const body = await response.text()
  if (!response.ok || !body.includes('Army List:')) {
    throw new Error(`Infinity-Data decode failed with HTTP ${response.status}: ${body.slice(0, 180)}`)
  }

  return body
}

function parseInfinityDataOverview(html) {
  const cards = []
  const cardPattern =
    /<div class="card" data-info="combinedId:([^"]+)">([\s\S]*?)(?=<div class="card" data-info=|<div class="card">\s*<div class="card-header">\s*<h2 class="card-header-title">Army List:|$)/g
  let cardMatch = cardPattern.exec(html)

  while (cardMatch) {
    const block = cardMatch[2]
    cards.push({
      combinedId: cardMatch[1],
      equipment: textContent(matchFirst(block, /<b>Equipment:<\/b>\s*<span>([\s\S]*?)<\/span>/)),
      group: Number(textContent(matchFirst(block, /<div class="unit-group-number">([\s\S]*?)<\/div>/))),
      icons: [...block.matchAll(/image\/(hackable|regular|irregular|impetuous|lieutenant|cube|cube-2)\.svg/g)].map(
        (match) => match[1],
      ),
      profile: textContent(matchFirst(block, /<h2 class="card-header-title">([\s\S]*?)<\/h2>/)),
      skills: textContent(matchFirst(block, /<b>Skills:<\/b>\s*<span>([\s\S]*?)<\/span>/)),
      weapons: [...block.matchAll(/<td class="weapon-table-name-header">([\s\S]*?)<\/td>/g)].map((match) =>
        textContent(match[1]),
      ),
    })
    cardMatch = cardPattern.exec(html)
  }

  const listBlock = html.slice(html.indexOf('Army List:'))
  const listHeader = textContent(matchFirst(listBlock, /<h2 class="card-header-title">Army List:\s*([\s\S]*?)<\/h2>/))
  const listRows = []
  const groupPattern =
    /<div class="army-group-title">Group:\s*(\d+)<\/div>([\s\S]*?)(?=<div class="army-group-title">|<div class="army-list-footer">)/g
  let groupMatch = groupPattern.exec(listBlock)

  while (groupMatch) {
    const combatGroup = Number(groupMatch[1])
    for (const rowMatch of groupMatch[2].matchAll(
      /<div class="army-list-row">\s*<div class="flex-grow">([\s\S]*?)<\/div>\s*<div>([\s\S]*?)<\/div>/g,
    )) {
      const cost = parseCost(textContent(rowMatch[2]))
      listRows.push({
        combatGroup,
        points: cost.points,
        swc: cost.swc,
        unit: textContent(rowMatch[1]),
      })
    }
    groupMatch = groupPattern.exec(listBlock)
  }

  return {
    cards,
    listHeader,
    listRows,
  }
}

function buildStructuredList(armyCode, codeData, resolved) {
  const cardsById = new Map()
  for (const card of resolved.cards) {
    const entries = cardsById.get(card.combinedId) || []
    entries.push(card)
    cardsById.set(card.combinedId, entries)
  }

  const rowsByGroupAndUnit = new Map()
  for (const row of resolved.listRows) {
    const key = `${row.combatGroup}:${row.unit}`
    const entries = rowsByGroupAndUnit.get(key) || []
    entries.push(row)
    rowsByGroupAndUnit.set(key, entries)
  }

  const entries = []
  for (const group of codeData.combatGroups) {
    for (const member of group.members) {
      const card = shift(cardsById.get(member.combinedId))
      const listRow = shift(rowsByGroupAndUnit.get(`${group.combatGroup}:${card?.profile || ''}`))
      const orderTypes = classifyOrders(card?.icons || [])
      const skills = card?.skills || ''
      const equipment = card?.equipment || ''

      entries.push({
        combatGroup: group.combatGroup,
        combinedId: member.combinedId,
        chainOfCommand: hasExactSkillToken(skills, 'Chain of Command'),
        forwardObserver: hasExactSkillToken(skills, 'Forward Observer'),
        hacker: isHackerProfile(skills, equipment),
        lieutenant: /lieutenant/i.test(`${skills} ${(card?.icons || []).join(' ')}`),
        orderTypes,
        points: listRow?.points ?? 0,
        profile: card?.profile || listRow?.unit || '',
        specialist: /\bSpecialist Operative\b/i.test(skills),
        doctor: /\bDoctor\b/i.test(skills),
        engineer: /\bEngineer\b/i.test(skills),
        swc: listRow?.swc ?? 0,
        unit: listRow?.unit || card?.profile || '',
      })
    }
  }

  const totals = entries.reduce(
    (accumulator, entry) => ({
      combatGroups: Math.max(accumulator.combatGroups, entry.combatGroup),
      points: accumulator.points + entry.points,
      swc: accumulator.swc + entry.swc,
    }),
    { combatGroups: 0, points: 0, swc: 0 },
  )

  const orderCounts = entries.reduce(
    (accumulator, entry) => {
      for (const order of entry.orderTypes) {
        accumulator[order] = (accumulator[order] || 0) + 1
      }
      return accumulator
    },
    { impetuous: 0, irregular: 0, lieutenant: 0, regular: 0 },
  )

  return {
    armyCode,
    combatGroups: codeData.combatGroups.map((group) => ({
      combatGroup: group.combatGroup,
      entries: entries.filter((entry) => entry.combatGroup === group.combatGroup),
    })),
    faction: parentFactionBySectorialSlug.get(codeData.sectorialSlug) || codeData.sectorialSlug,
    listName: codeData.listName,
    orderCounts,
    sectorial: normalizeSectorialName(codeData.sectorialSlug),
    sectorialId: codeData.sectorialId,
    source: {
      decoder: 'twonirwana/Infinity-Data ArmyCodeLoader format port',
      resolver: infinityDataBaseUrl,
    },
    totals,
  }
}

function toCsv(list) {
  const rows = [
    [
      'faction',
      'sectorial',
      'listName',
      'combatGroup',
      'unit',
      'profile',
      'points',
      'swc',
      'orderTypes',
      'lieutenant',
      'hacker',
      'forwardObserver',
      'chainOfCommand',
      'specialist',
      'doctor',
      'engineer',
      'combinedId',
    ],
  ]

  for (const group of list.combatGroups) {
    for (const entry of group.entries) {
      rows.push([
        list.faction,
        list.sectorial,
        list.listName,
        entry.combatGroup,
        entry.unit,
        entry.profile,
        entry.points,
        entry.swc,
        entry.orderTypes.join('|'),
        entry.lieutenant,
        entry.hacker,
        entry.forwardObserver,
        entry.chainOfCommand,
        entry.specialist,
        entry.doctor,
        entry.engineer,
        entry.combinedId,
      ])
    }
  }

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

function classifyOrders(icons) {
  const orders = []
  if (icons.includes('regular')) {
    orders.push('regular')
  }
  if (icons.includes('irregular')) {
    orders.push('irregular')
  }
  if (icons.includes('impetuous')) {
    orders.push('impetuous')
  }
  const lieutenantCount = icons.filter((icon) => icon === 'lieutenant').length
  for (let index = 0; index < lieutenantCount; index += 1) {
    orders.push('lieutenant')
  }
  return orders
}

function isHackerProfile(skills, equipment) {
  const skillText = String(skills || '')
  const equipmentText = String(equipment || '')

  return (
    /\bHacker\b/i.test(skillText) ||
    /\bHacking Device\b/i.test(skillText) ||
    /\b(?:EVO\s+)?(?:Killer\s+)?Hacking Device(?:\s+Plus)?\b/i.test(equipmentText)
  )
}

export function hasExactSkillToken(skills, expectedSkill) {
  const expected = normalizeSkillToken(expectedSkill)

  return splitSkillTokens(skills).some((skill) => normalizeSkillToken(skill) === expected)
}

function splitSkillTokens(skills) {
  return String(skills || '')
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean)
}

function normalizeSkillToken(skill) {
  return String(skill || '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[“”″]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function parseCost(value) {
  return {
    points: Number(value.match(/(\d+(?:\.\d+)?)\s*pts/i)?.[1] || 0),
    swc: Number(value.match(/(\d+(?:\.\d+)?)\s*swc/i)?.[1] || 0),
  }
}

function normalizeSectorialName(slug) {
  if (slug === 'operations') {
    return 'Operations Subsection'
  }
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function matchFirst(value, pattern) {
  return value.match(pattern)?.[1] || ''
}

function shift(values) {
  return values?.shift() || null
}

function textContent(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'army-list'
}

function readCliOptions(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--input') {
      options.input = argv[++index]
    } else if (arg === '--json') {
      options.jsonPath = argv[++index]
    } else if (arg === '--csv') {
      options.csvPath = argv[++index]
    } else if (arg === '--out-dir') {
      options.outputDir = argv[++index]
    } else if (!arg.startsWith('--') && !options.input) {
      options.input = arg
    }
  }
  return options
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await decodeArmyListToFiles(readCliOptions(process.argv.slice(2)))
    console.log(JSON.stringify({
      csvPath: result.csvPath,
      jsonPath: result.jsonPath,
      points: result.list.totals.points,
      swc: result.list.totals.swc,
      combatGroups: result.list.totals.combatGroups,
    }, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
