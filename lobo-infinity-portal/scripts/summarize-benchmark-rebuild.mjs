import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { readArtifact } from './benchmark-artifacts.mjs'
import { buildOfficialCombatSource } from '../bot/official-combat-source.mjs'
import { lookupMobileGunfighter } from '../bot/mobile-gunfighter.mjs'

const baselineCommit = process.argv[2] || 'ab7f355a109ebed2a15c6bb487578b75001a9bff'
const prefix = execFileSync('git', ['rev-parse', '--show-prefix'], { encoding: 'utf8' }).trim()
const before = path => {
  const value = execFileSync('git', ['show', `${baselineCommit}:${prefix}${path}`], { encoding: 'utf8', maxBuffer: 100_000_000 })
  return JSON.parse(path.endsWith('.gz.b64') ? gunzipSync(Buffer.from(value, 'base64')) : value)
}
const dir = 'data/infinity-army/'
const source = buildOfficialCombatSource(await readArtifact(dir + 'benchmark-official-source.json.gz.b64'))
const gunfighter = await readArtifact(dir + 'gunfighter-benchmark-catalog.json')
const aro = await readArtifact(dir + 'aro-benchmark-catalog.json.gz.b64')
const cc = await readArtifact(dir + 'close-combat-benchmark.json')
const mobile = await readArtifact('src/data/mobile-gunfighter.json')
const mobility = await readArtifact('src/data/mobility-index.json')
const validation = await readArtifact(dir + 'mobility-index-validation.json')
const oldG = before(dir + 'gunfighter-benchmark-catalog.json')
const oldA = before(dir + 'aro-benchmark-catalog.json.gz.b64')
const oldCC = before(dir + 'close-combat-benchmark.json')
const compare = (old, current) => {
  const map = new Map(old.entries.map(e => [e.key, e]))
  const now = new Set(current.entries.map(e => e.key))
  const changes = current.entries.flatMap(e => e.result.states.filter(s => map.get(e.key)?.result.states.some(oldState => oldState.id === s.id && oldState.rating !== s.rating)))
  return { before: old.entryCount, after: current.entryCount, added: current.entries.filter(e => !map.has(e.key)).length, removed: old.entries.filter(e => !now.has(e.key)).length, changedExistingStateScores: changes.length }
}
const gunByKey = new Map(gunfighter.entries.map(e => [e.key, e]))
const round = n => Math.round(n * 100) / 100
const clean = name => name.replace(/^REINF(?:ORCEMENTS?)?[.:]?\s*/i, '').replace(/\b(?:FTO|REINF)\b\.?/gi, '').replace(/\s+/g, ' ').trim()
// Presentation only: keep all exact source identities in the catalogs. Collapse
// equivalent unlinked combat loadouts, not entries that merely tie in score.
const relevant = values => (values || []).filter(s => /bs attack|mimetism|marksmanship|warhorse|no wound incapacitation|dogged|immunity|vulnerability|cover|neurocinetics|multispectral visor|x visor/i.test(s)).sort()
const unique = new Map()
for (const p of source.profiles) {
  if (String(p.troopType).replace(/[^a-z]/gi, '').toUpperCase() === 'TAG') continue
  const rating = lookupMobileGunfighter(mobile, p.id)
  if (!rating) continue
  const normal = gunByKey.get(p.id).result.states.find(s => s.id === 'normal')
  const weapons = p.weapons.map(w => {
    const sd = Math.max(0, ...w.modes.map(m => Number(m.specialDice || 0)))
    return w.name + (sd ? ` (+${sd}SD)` : '')
  })
  const weaponIdentity = p.weapons.map(w => JSON.stringify({ name: w.name, modes: w.modes.map(m => JSON.stringify(m)).sort() })).sort()
  const displayNameIdentity = clean(p.name).split(' — ').map(part => part.split(',')[0].trim().toLowerCase()).join(' — ')
  const identity = JSON.stringify([displayNameIdentity, p.bs, p.wip, p.ph, p.arm, p.bts, p.vitality, p.structure, p.troopType, relevant(p.skills), relevant(p.equipment), weaponIdentity, mobility.profiles[mobility.keys[p.id]]])
  const row = { key: p.id, profileKeys: [p.id], name: clean(p.name), type: p.troopType, gunfighter: normal.rating, mobility: round(rating.mobility), combined: round(rating.score), weapons }
  if (!unique.has(identity)) unique.set(identity, row)
  else {
    const existing = unique.get(identity)
    if (existing.gunfighter !== normal.rating || existing.combined !== row.combined) throw Error('Report deduplication omitted a combat-relevant difference')
    existing.profileKeys.push(p.id)
  }
}
const top30 = [...unique.values()].sort((a, b) => b.combined - a.combined || b.gunfighter - a.gunfighter || a.key.localeCompare(b.key)).slice(0, 30)
const comparison = ['501:395:1:6:1', '501:393:1:8:1'].map(key => ({ key, name: gunByKey.get(key).result.name, before: oldG.entries.find(e => e.key === key)?.result.states.map(s => ({ state: s.id, rating: s.rating })), after: gunByKey.get(key).result.states.map(s => ({ state: s.id, rating: s.rating })) }))
const codeFiles = ['bot/combat-rules.mjs', 'bot/official-combat-source.mjs', 'bot/gunfighter-rating.mjs', 'bot/gunfighter-profile-canonicalizer.mjs', 'bot/gunfighter-standard-benchmark.mjs', 'bot/gunfighter-benchmark-catalog.mjs', 'bot/aro-benchmark-catalog.mjs', 'bot/infinity-weapon-chart.mjs', 'bot/close-combat-benchmark.mjs', 'bot/close-combat-canonicalizer.mjs', 'bot/close-combat-catalog.mjs', 'bot/close-combat-standard-benchmark.mjs', 'bot/mobile-gunfighter.mjs', 'bot/mobility-index.mjs', 'bot/mobility-scenarios.mjs', 'bot/mobility-rating.mjs', 'scripts/benchmark-artifacts.mjs', 'scripts/rebuild-combat-benchmarks.mjs', 'scripts/build-gunfighter-catalog.mjs', 'scripts/build-official-aro-catalog.mjs', 'scripts/build-close-combat-benchmark.mjs']
const hashes = Object.fromEntries(await Promise.all(codeFiles.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])))
const report = {
  baselineCommit, rulesVersion: source.rulesVersion, datasetId: source.datasetId, captureFingerprint: source.captureFingerprint, codeHashes: hashes,
  changes: { gunfighter: compare(oldG, gunfighter), aro: compare(oldA, aro), closeCombat: { before: oldCC.entryCount, after: cc.entryCount, aliasesBefore: oldCC.sourceAliasCount, aliasesAfter: cc.sourceAliasCount }, mobile: mobile.coverage },
  fingerprints: { gunfighter: gunfighter.fingerprint, aro: aro.fingerprint, closeCombat: cc.fingerprint, mobility: mobility.fingerprint, mobile: mobile.fingerprint },
  comparison, mobilityCoverage: validation.coverage,
  top30Scope: 'Normal/unlinked, TAGs excluded. Equivalent named gunfighting loadouts are collapsed across faction, Lieutenant, FTO and reinforcement variants only when combat inputs and movement match; descriptive name suffixes are ignored for this display grouping. Exact profile aliases remain in the JSON report and catalogs. 85% gunfighter score anchored at 50 plus 15% mobility. Ranged/deployable weapons are shown; deployables are not scored as direct attacks. CC equipment is not listed.',
  top30,
}
await writeFile(dir + 'benchmark-rebuild-validation.json', JSON.stringify(report, null, 2) + '\n')
const lines = [
  '# Benchmark repair and rebuild — 20 September 2026', '',
  'Implemented shared fixes and rebuilt all dependent catalogs from one retained official Army capture. No unit-specific rating adjustments. This is a local rebuild; no deployment or remote refresh was performed.', '',
  '## Scope of repairs', '',
  '- Shared critical and saving-roll semantics across shooting and close combat, including expanded critical ranges, combined ARM/BTS saves, T2 critical saves, ammunition/state immunity and nonlethal effects.',
  '- Canonical trait spelling, native versus Fireteam +1SD, reactive Burst, Neurocinetics, Burst/MOD caps, cover, reactive SR modifiers and correlated template Dodges.',
  '- Defender weights now affect aggregates; normal shooting no longer assumes an unproven Surprise Attack state.',
  '- Exact official profile stats, weapon modes, wound/Structure values and Fireteam identities. Removed TTS overrides and fuzzy ARO/CC matching; CC no longer merges different weapons merely because names and scores tie.',
  '- WIP-sensitive evaluation caches, dependent fingerprint checks, reproducible offline rebuild, archive parity checks and obsolete-chunk cleanup. Benchmark tests gate both normal and Vercel builds.', '',
  '## Rebuilt coverage', '',
  '| Catalog | Before | After |', '|---|---:|---:|',
  `| Shooting profiles | ${oldG.entryCount} | ${gunfighter.entryCount} |`,
  `| ARO profiles | ${oldA.entryCount} | ${aro.entryCount} |`,
  `| Distinct CC entries | ${oldCC.entryCount} | ${cc.entryCount} |`,
  `| Exact CC source aliases | ${oldCC.sourceAliasCount} | ${cc.sourceAliasCount} |`,
  `| Mobility-adjusted normal profiles | — | ${mobile.coverage.normal} |`,
  `| Mobility-adjusted linked profiles | — | ${mobile.coverage.fireteam} |`, '',
  `Existing state scores changed: ${report.changes.gunfighter.changedExistingStateScores} shooting and ${report.changes.aro.changedExistingStateScores} ARO. CC counts are not directly comparable: exact aliases and distinct combat loadouts now survive deduplication.`, '',
  '## Intruder/Grenzer check', '',
  ...comparison.map(p => `- ${p.name}: ${p.after.map(s => `${s.state} ${s.rating.toFixed(2)}`).join('; ')}.`),
  '- The Intruder sniper retains native +1SD, Mimetism −3 and MSV2. The Grenzer has Marksmanship and MSV1; its +1SD is conditional on a qualifying Fireteam, never native.', '',
  '## Validation and remaining assumptions', '',
  '- Passed: `npm run test:benchmarks`, Army Intelligence integration tests, tactical-brief logic-only tests, rules routing, list legality, TypeScript compilation and Vite production bundling. All changed JavaScript modules also pass ESLint recommended rules.',
  '- Not verified: browser-render integration. The required Chromium download repeatedly timed out; logic tests passed, but no successful browser-render run is claimed.',
  '- Independent exhaustive dice oracle checks 20 distributions in both engines; hand-calculated fixtures cover saving rolls and effects. Tests also cover data precedence, WIP cache separation, weights, Surprise requirements, CC identity collisions, and full catalog/source consistency.',
  '- The prior stored calculator comparison was not a live regression test; it has been removed as a gate. Historical calculator data are not represented as validation of the repaired engine.',
  '- Scores remain scenario-weighted utility estimates, not win or kill probabilities. Range/defender weights and the 85/15 mobility blend are modeling choices. No smoke-support, terrain/line-of-fire simulation, order-economy simulation or automatic Surprise bonus is assumed.',
  '- Defensive Smoke/Eclipse uses an assumed legal close placement around the defender, without enemy Mimetism/cover penalties or enemy-distance restrictions. Geometric placement optimization and external smoke support remain out of scope.',
  `- Mobility excludes ${validation.coverage.noMovement} forms without movement and ${validation.coverage.unresolved.length} unresolved terrain-choice profiles; it does not manufacture scores for them. See the machine-readable validation file for exact identities.`,
  '- Linked ratings describe conditional capability, not proof a particular submitted list can form the required team. Existing list-level composition checks still apply.', '',
  '- An obsolete generated gunfighter archive chunk was removed; its prior version is recoverable from Git. No source profiles were manually removed or re-scored.', '',
  '## Reproduce', '',
  'Run `npm ci --ignore-scripts`, `npm run benchmarks:rebuild`, then `npm run test:benchmarks`. The rebuild uses `data/infinity-army/benchmark-official-source.json.gz.b64`; a new capture can be supplied as the rebuild argument. Run `node scripts/summarize-benchmark-rebuild.mjs` to refresh this comparison against the recorded baseline.', '',
  'Machine-readable provenance, code hashes, catalog fingerprints and changes: `data/infinity-army/benchmark-rebuild-validation.json`.', '',
  '## Top 30 including mobility, excluding TAGs', '',
  report.top30Scope, '',
  '| # | Profile | Ranged / deployable weapons | Gunfighter | Mobility | Combined |', '|---:|---|---|---:|---:|---:|',
  ...top30.map((p, i) => `| ${i + 1} | ${p.name} | ${p.weapons.join('; ')} | ${p.gunfighter.toFixed(2)} | ${p.mobility.toFixed(2)} | ${p.combined.toFixed(2)} |`), '',
  '## Rules references', '',
  '- [Rolls](https://infinitythewiki.com/Rolls), [Combined Saving Roll](https://infinitythewiki.com/Combined_Saving_Roll), [Immunity](https://infinitythewiki.com/Immunity).',
  '- [T2 ammunition](https://infinitythewiki.com/T2_Ammunition), [Combined Ammunition](https://infinitythewiki.com/Combined_Ammunition), [Electromagnetic ammunition](https://infinitythewiki.com/Electromagnetic_(E/M)_Ammunition).',
  '- [Limited Cover](https://infinitythewiki.com/Limited_Cover), [No Cover](https://infinitythewiki.com/No_Cover), [Martial Arts](https://infinitythewiki.com/Martial_Arts), [Neurocinetics](https://infinitythewiki.com/Neurocinetics).', '',
  '- [Combat Instinct](https://infinitythewiki.com/Combat_Instinct), [Sixth Sense](https://infinitythewiki.com/Sixth_Sense), [Surprise Attack](https://infinitythewiki.com/Surprise_Attack).', '',
  '- [Smoke Ammunition](https://infinitythewiki.com/Smoke_Ammunition).', '',
]
await mkdir('docs', { recursive: true })
await writeFile('docs/benchmark-repair-2026-09-20.md', lines.join('\n'))
console.log(JSON.stringify({ changes: report.changes, comparison, top30: top30.length }))
