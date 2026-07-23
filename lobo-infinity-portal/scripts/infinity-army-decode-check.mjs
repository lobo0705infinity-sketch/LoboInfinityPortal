import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decodeArmyListToFiles, hasExactSkillToken } from './infinity-army-decode.mjs'

const forWorkCode =
  'gr8Kb3BlcmF0aW9ucwhGb3IgV29ya4EsAgEBAAUAhK0BAgAAhusBAgAAh2oBBQAAgkgBBgAAh1IBAQACAQAKAIJQAQEAAIJTAQEAAIJTAQEAADIBAQAAh28CAQAAh28CAQAAh28BAgAAh0YBAgAAglQBAQAAh2YBAgA%3D'
const panoceaniaJoanCode =
  'ZQpwYW5vY2VhbmlhBSBKb2FugSwCAQEACgCHEAEEAAAJAQMAACoBBAAAhMYBBAAAhMYBBAAAhwwBAwAAhh0BAgAAMgEBAAARAQEAABMBAQACAQAFAIcYAQIAAIdvAQEAAIdvAgEAAIdvAgEAAIdSAQEA'

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
const panoceaniaResult = await decodeArmyListToFiles({
  input: panoceaniaJoanCode,
  outputDir,
})

const profiles = result.list.combatGroups.flatMap((group) =>
  group.entries.map((entry) => entry.profile),
)
const entries = result.list.combatGroups.flatMap((group) => group.entries)
const hackers = entries.filter((entry) => entry.hacker).map((entry) => entry.profile)
const panoceaniaEntries = panoceaniaResult.list.combatGroups.flatMap((group) => group.entries)
const panoceaniaHackers = panoceaniaEntries.filter((entry) => entry.hacker).map((entry) => entry.profile)
const rudra = entries.find((entry) => entry.profile === 'RUDRA FTO')
const artalis = entries.find((entry) => entry.profile === 'ARTALIS')
const asura = entries.find((entry) => entry.profile === 'ASURA')
const sacha = entries[4]
const samekh = entries.find((entry) => entry.profile === 'SAMEKH Rebot')
const netrods = entries.filter((entry) => entry.profile === 'NETROD')
const warcor = entries.find((entry) => entry.profile === 'WARCOR')
const racerbots = entries.filter((entry) => entry.profile === 'RACERBOT Mk-III')
const pilotX = entries.find((entry) => entry.profile === 'Pilot-X Team')
const maximus = entries.find((entry) => entry.profile === 'MAXIMUS AGENT FTO')
const probot = entries.find((entry) => entry.profile === 'PROBOT')
const claire = entries.find((entry) => entry.profile === 'CLAIRE LAZHARI FTO')
const totalWounds = entries.reduce((total, entry) => total + (entry.wounds ?? 0), 0)
const totalDurability = entries.reduce((total, entry) => total + (entry.wounds ?? entry.structure ?? 0), 0)
const durabilityModelCount = entries.filter((entry) => entry.wounds !== null || entry.structure !== null).length

assertEqual(result.list.faction, 'ALEPH', 'faction')
assertEqual(result.list.sectorial, 'Operations Subsection', 'sectorial')
assertEqual(result.list.listName, 'For Work', 'list name')
assertEqual(result.list.totals.points, 300, 'points')
assertEqual(result.list.totals.swc, 3, 'SWC')
assertEqual(result.list.totals.combatGroups, 2, 'combat groups')
assertEqual(JSON.stringify(profiles), JSON.stringify(expectedProfiles), 'profiles')
assertEqual(rudra?.troopType, 'REM', 'RUDRA troop type')
assertEqual(rudra?.points, 35, 'RUDRA points')
assertEqual(rudra?.wounds, null, 'RUDRA Structure must not be counted as Wounds')
assertEqual(rudra?.structure, 2, 'RUDRA Structure')
assertEqual(artalis?.wounds, 1, 'ARTALIS Wounds')
assertEqual(artalis?.structure, null, 'ARTALIS Structure')
assertEqual(asura?.troopType, 'HI', 'ASURA troop type')
assertEqual(asura?.wounds, 2, 'ASURA Wounds')
assertEqual(asura?.skills.includes('Hacker'), true, 'ASURA skill tokens')
assertEqual(sacha?.wounds, 1, 'SACHA Wounds')
assertEqual(samekh?.wounds, null, 'SAMEKH Rebot Structure must not be counted as Wounds')
assertEqual(samekh?.structure, 1, 'SAMEKH Rebot Structure')
assertEqual(netrods.length, 2, 'NETROD duplicate entries')
assertEqual(netrods.every((entry) => entry.wounds === null), true, 'NETROD Structure must not be counted as Wounds')
assertEqual(netrods.every((entry) => entry.structure === 1), true, 'NETROD Structure')
assertEqual(warcor?.wounds, 1, 'WARCOR Wounds')
assertEqual(racerbots.length, 2, 'RACERBOT duplicate entries')
assertEqual(racerbots.every((entry) => entry.wounds === null), true, 'RACERBOT Structure must not be counted as Wounds')
assertEqual(racerbots.every((entry) => entry.structure === 1), true, 'RACERBOT Structure')
assertEqual(pilotX?.wounds, 1, 'Pilot-X Team Wounds')
assertEqual(maximus?.wounds, 1, 'MAXIMUS AGENT FTO Wounds')
assertEqual(probot?.wounds, null, 'PROBOT Structure must not be counted as Wounds')
assertEqual(probot?.structure, 1, 'PROBOT Structure')
assertEqual(claire?.wounds, 1, 'CLAIRE LAZHARI FTO Wounds')
assertEqual(totalWounds, 8, 'For Work total Wounds')
assertEqual(totalDurability, 17, 'For Work total Wounds or Structure')
assertEqual(durabilityModelCount, 15, 'For Work Wounds or Structure divisor')
assertEqual(JSON.stringify(hackers), JSON.stringify(['ASURA', 'Pilot-X Team']), 'hackers')
assertEqual(
  entries.some((entry) => ['RACERBOT Mk-III', 'DIKPALA', 'RUDRA FTO'].includes(entry.profile) && entry.hacker),
  false,
  'repeater support profiles as hackers',
)
assertEqual(entries.every((entry) => typeof entry.forwardObserver === 'boolean'), true, 'forward observer flags')
assertEqual(entries.every((entry) => typeof entry.chainOfCommand === 'boolean'), true, 'chain of command flags')
assertEqual(entries[4]?.forwardObserver, false, 'SACHA forward observer')
assertEqual(entries.find((entry) => entry.profile === 'MAXIMUS AGENT FTO')?.chainOfCommand, false, 'MAXIMUS chain of command')
assertEqual(hasExactSkillToken('Forward Deployment (+8″), Specialist Operative', 'Forward Observer'), false, 'forward deployment exact token')
assertEqual(hasExactSkillToken('Forward Observer, Mimetism [-3]', 'Forward Observer'), true, 'true forward observer exact token')
assertEqual(hasExactSkillToken('Number 2, Specialist Operative, Tactical Awareness', 'Chain of Command'), false, 'number 2 chain of command')
assertEqual(hasExactSkillToken('Chain of Command, Courage', 'Chain of Command'), true, 'true chain of command exact token')
assertEqual(
  JSON.stringify(panoceaniaHackers),
  JSON.stringify(['BLACK A.I.R.', 'Pilot-X Team']),
  'PanOceania hackers',
)
assertEqual(
  panoceaniaEntries.some((entry) => entry.profile === 'RACERBOT Mk-III' && entry.hacker),
  false,
  'PanOceania Racerbot support profiles as hackers',
)

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
