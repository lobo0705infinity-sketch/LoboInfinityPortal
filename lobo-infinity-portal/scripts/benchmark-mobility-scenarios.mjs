import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { validateMobilityEntries } from '../bot/mobility-catalog-validation.mjs'
import { evaluateMobilityScenarios, MOBILITY_SCENARIO_VERSION } from '../bot/mobility-scenarios.mjs'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw Error('Usage: node scripts/benchmark-mobility-scenarios.mjs <catalog.json[.gz.b64]> <report.json>')
const text = await readFile(input, 'utf8')
const catalog = JSON.parse(input.endsWith('.gz.b64') ? gunzipSync(Buffer.from(text, 'base64')).toString('utf8') : text)
validateMobilityEntries(catalog.entries)
const evaluated = catalog.entries.map(profile => ({ profile, scenarios: evaluateMobilityScenarios(profile) }))
const selectors = [
  ['Redeye', 'REDEYE'], ['Fēiquán', 'FĒIQUÁN'], ['Haytham', 'HAYTHAM'], ['Zeybek', 'ZEYBEK'],
  ['Go-Pod', 'GO-POD'], ['Skyhound', 'SKYHOUND'], ['Tarksia', 'Tarksia'], ['Firebat', 'FIREBAT'],
  ['Garuda', 'GARUDA'], ['Shikami', 'SHIKAMI'], ['Nisse', 'NISSE'], ['Locust', 'LOCUST'],
  ['Roadbot mobility form', 'ROADBOTS', 'HIGH MOBILITY FORM'], ['Roadbot combat form', 'ROADBOTS', 'COMBAT FORM'],
  ['Su-Jian mobility form', 'SÙ-JIÀN', 'HIGH MOBILITY FORM'], ['Su-Jian combat form', 'SÙ-JIÀN', 'COMBAT FORM'],
  ['Penthesilea', 'PENTHESILEA'], ['Motorized Bounty Hunter', 'Motorized Bounty Hunters'], ['Fusilier', 'FUSILIERS'],
]
const samples = selectors.map(([label, name, form]) => {
    const row = evaluated.find(({ profile: p }) => !p.name.startsWith('REINF:') && (label === 'Fusilier' ? p.unitId === 1 : p.name.toUpperCase().includes(name.toUpperCase())) && (!form || p.name.includes(form)))
  if (!row) throw Error(`Missing benchmark sample: ${label}`)
  return { label, id: row.profile.id, name: row.profile.name, mov: row.profile.mov, ph: row.profile.ph, silhouette: row.profile.silhouette, skills: row.profile.skills, equipment: row.profile.equipment, provisionalScore: row.profile.mobility.score, scenarios: row.scenarios }
})
const ranked = evaluated.filter(x => x.scenarios.status === 'ok')
const report = {
  schemaVersion: MOBILITY_SCENARIO_VERSION,
  catalogCaptureFingerprint: catalog.captureFingerprint,
  officialVersions: catalog.officialVersions,
  generatedAt: new Date().toISOString(),
  coverage: { entries: evaluated.length, evaluated: ranked.length, unrankedNoMovement: evaluated.length - ranked.length, normalDodgeMissingPh: ranked.filter(x => x.scenarios.normalDodge.status !== 'ok').length, terrainNeedsChoiceOrType: ranked.filter(x => Object.values(x.scenarios.difficultTerrain).some(t => t.status !== 'ok')).length },
  assumptions: [
    'Distances are inches. Movement actions begin standing, unengaged, with unrestricted clear paths and no enemy interference.',
    'Best open travel compares Move+Move, a Long Jump, and Super-Jump+Move. Jumping is permitted on this clear route; no extra Orders or deployment bonuses are assumed.',
    'Jump/ascent paths are premeasured legal trajectories with sufficiently large landing surfaces for each base. No collision, vaulting, silhouette-clearance or landing-footprint simulation.',
    'Gap test is a single horizontal 11-inch Jump trajectory. Ascent test is one 9-inch upward Jump or Climb trajectory with no intermediate landing.',
    'Bent-air test is a 10-inch upward/turning trajectory without intermediate surfaces, requiring Jet Propulsion and a follow-up BS Attack.',
    'A follow-up attack means an action remains available, not that a target is in range/LoF or that the shooter survives an ARO.',
    '12-inch Difficult Terrain travel starts inside and remains inside the specified zone. Entry-boundary stopping is deliberately excluded.',
    'Terrain choices are not optimized separately for each test: a multi-type choice remains unresolved until selected. An unqualified Terrain label is reported as unspecified.',
    'Dodge is an eligible Normal Roll with no situational penalties, not a face-to-face survival estimate. Expected distance includes failure probability.',
    'Scores are still the original provisional v1 weights. Scenario measurements are separate; no new aggregate score or combat blend is introduced.',
  ],
  sources: ['Super-Jump', 'Jump', 'Climb', 'Climbing_Plus', 'Terrain', 'Difficult_Terrain', 'Dodge', 'Motorcycle', 'AI_Motorcycle', 'Aerial', 'Modifiers_Explained'].map(x => `https://infinitythewiki.com/${x}`),
  samples,
}
await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ output, ...report.coverage, samples: samples.length }))
