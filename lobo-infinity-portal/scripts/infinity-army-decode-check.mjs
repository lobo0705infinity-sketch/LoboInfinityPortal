import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decodeArmyListToFiles } from './infinity-army-decode.mjs'

const forWorkCode =
  'gr8Kb3BlcmF0aW9ucwhGb3IgV29ya4EsAgEBAAUAhK0BAgAAhusBAgAAh2oBBQAAgkgBBgAAh1IBAQACAQAKAIJQAQEAAIJTAQEAAIJTAQEAADIBAQAAh28CAQAAh28CAQAAh28BAgAAh0YBAgAAglQBAQAAh2YBAgA%3D'

const expectedProfiles = [
  'RUDRA FTO',
  'ARTALIS',
  'DIKPALA',
  'ASURA',
  'SĀCHĀ',
  'SAMEKH Rebot',
  'NETROD',
  'NETROD',
  'WARCOR',
  'RACERBOT Mk-III',
  'RACERBOT Mk-III',
  'Pilot-X Team',
  'MAXIMUS AGENT FTO',
  'PROBOT',
  'CLAIRE LAZHARI FTO',
]

const outputDir = await mkdtemp(join(tmpdir(), 'lobo-army-decode-'))
const result = await decodeArmyListToFiles({
  input: forWorkCode,
  outputDir,
})

const profiles = result.list.combatGroups.flatMap((group) =>
  group.entries.map((entry) => entry.profile),
)

assertEqual(result.list.faction, 'ALEPH', 'faction')
assertEqual(result.list.sectorial, 'Operations Subsection', 'sectorial')
assertEqual(result.list.listName, 'For Work', 'list name')
assertEqual(result.list.totals.points, 300, 'points')
assertEqual(result.list.totals.swc, 3, 'SWC')
assertEqual(result.list.totals.combatGroups, 2, 'combat groups')
assertEqual(JSON.stringify(profiles), JSON.stringify(expectedProfiles), 'profiles')

console.log(JSON.stringify({
  csvPath: result.csvPath,
  jsonPath: result.jsonPath,
  result: 'PASS',
}, null, 2))

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`)
  }
}
