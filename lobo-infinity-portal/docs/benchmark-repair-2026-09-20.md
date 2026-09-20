# Benchmark repair and rebuild — 20 September 2026

Implemented shared fixes and rebuilt all dependent catalogs from one retained official Army capture. No unit-specific rating adjustments. This is a local rebuild; no deployment or remote refresh was performed.

## Scope of repairs

- Shared critical and saving-roll semantics across shooting and close combat, including expanded critical ranges, combined ARM/BTS saves, T2 critical saves, ammunition/state immunity and nonlethal effects.
- Canonical trait spelling, native versus Fireteam +1SD, reactive Burst, Neurocinetics, Burst/MOD caps, cover, reactive SR modifiers and correlated template Dodges.
- Defender weights now affect aggregates; normal shooting no longer assumes an unproven Surprise Attack state.
- Exact official profile stats, weapon modes, wound/Structure values and Fireteam identities. Removed TTS overrides and fuzzy ARO/CC matching; CC no longer merges different weapons merely because names and scores tie.
- WIP-sensitive evaluation caches, dependent fingerprint checks, reproducible offline rebuild, archive parity checks and obsolete-chunk cleanup. Benchmark tests gate both normal and Vercel builds.

## Rebuilt coverage

| Catalog | Before | After |
|---|---:|---:|
| Shooting profiles | 13921 | 13554 |
| ARO profiles | 12557 | 13554 |
| Distinct CC entries | 923 | 2554 |
| Exact CC source aliases | 11386 | 13345 |
| Mobility-adjusted normal profiles | — | 13534 |
| Mobility-adjusted linked profiles | — | 3614 |

Existing state scores changed: 16880 shooting and 15245 ARO. CC counts are not directly comparable: exact aliases and distinct combat loadouts now survive deduplication.

## Intruder/Grenzer check

- INTRUDERS, Corregidor Assault Commandos — INTRUDER: normal 40.99.
- GRENZERS, Grenz Security Team — GRENZER: normal 37.62; fireteam 46.56.
- The Intruder sniper retains native +1SD, Mimetism −3 and MSV2. The Grenzer has Marksmanship and MSV1; its +1SD is conditional on a qualifying Fireteam, never native.

## Validation and remaining assumptions

- Passed: `npm run test:benchmarks`, Army Intelligence integration tests, tactical-brief logic-only tests, rules routing, list legality, TypeScript compilation and Vite production bundling. All changed JavaScript modules also pass ESLint recommended rules.
- Not verified: browser-render integration. The required Chromium download repeatedly timed out; logic tests passed, but no successful browser-render run is claimed.
- Independent exhaustive dice oracle checks 20 distributions in both engines; hand-calculated fixtures cover saving rolls and effects. Tests also cover data precedence, WIP cache separation, weights, Surprise requirements, CC identity collisions, and full catalog/source consistency.
- The prior stored calculator comparison was not a live regression test; it has been removed as a gate. Historical calculator data are not represented as validation of the repaired engine.
- Scores remain scenario-weighted utility estimates, not win or kill probabilities. Range/defender weights and the 85/15 mobility blend are modeling choices. No smoke-support, terrain/line-of-fire simulation, order-economy simulation or automatic Surprise bonus is assumed.
- Defensive Smoke/Eclipse uses an assumed legal close placement around the defender, without enemy Mimetism/cover penalties or enemy-distance restrictions. Geometric placement optimization and external smoke support remain out of scope.
- Mobility excludes 16 forms without movement and 4 unresolved terrain-choice profiles; it does not manufacture scores for them. See the machine-readable validation file for exact identities.
- Linked ratings describe conditional capability, not proof a particular submitted list can form the required team. Existing list-level composition checks still apply.

- An obsolete generated gunfighter archive chunk was removed; its prior version is recoverable from Git. No source profiles were manually removed or re-scored.

## Reproduce

Run `npm ci --ignore-scripts`, `npm run benchmarks:rebuild`, then `npm run test:benchmarks`. The rebuild uses `data/infinity-army/benchmark-official-source.json.gz.b64`; a new capture can be supplied as the rebuild argument. Run `node scripts/summarize-benchmark-rebuild.mjs` to refresh this comparison against the recorded baseline.

Machine-readable provenance, code hashes, catalog fingerprints and changes: `data/infinity-army/benchmark-rebuild-validation.json`.

## Top 30 including mobility, excluding TAGs

Normal/unlinked, TAGs excluded. Equivalent named gunfighting loadouts are collapsed across faction, Lieutenant, FTO and reinforcement variants only when combat inputs and movement match; descriptive name suffixes are ignored for this display grouping. Exact profile aliases remain in the JSON report and catalogs. 85% gunfighter score anchored at 50 plus 15% mobility. Ranged/deployable weapons are shown; deployables are not scored as direct attacks. CC equipment is not listed.

| # | Profile | Ranged / deployable weapons | Gunfighter | Mobility | Combined |
|---:|---|---|---:|---:|---:|
| 1 | ATALANTA, Agêma's NCO — ATALANTA | MULTI Sniper Rifle; Pistol | 44.42 | 28.30 | 79.76 |
| 2 | KNAUF, Outlaw Sniper — KNAUF | MULTI Sniper Rifle; AP Heavy Pistol | 41.33 | 30.30 | 74.81 |
| 3 | GO-POD — GO-POD | MULTI Rifle; E/Mitter | 35.77 | 92.60 | 74.70 |
| 4 | INTRUDERS, Corregidor Assault Commandos — INTRUDER | MULTI Sniper Rifle (+1SD); Heavy Pistol | 40.99 | 30.40 | 74.24 |
| 5 | TEUCER, Team Achilles' shooter — TEUCER | Plasma Sniper Rifle; Zapper; Heavy Pistol | 41.06 | 28.30 | 74.05 |
| 6 | SILVERSTAR PRIME — PRIME | Heavy Pistol; Heavy Machine Gun; Heavy Riotstopper | 39.53 | 34.80 | 72.42 |
| 7 | THE CHARONTIDS — CHARONTID | AP Heavy Machine Gun; Pulzar; AP Heavy Pistol | 39.33 | 35.50 | 72.19 |
| 8 | DASYUS — DASYU | MULTI Sniper Rifle; Pulzar; Silenced Pistol | 39.03 | 36.70 | 71.86 |
| 9 | SKYHOUNDS, Combat and Recon Air Squadron — SKYHOUND | Plasma Carbine; Thunderbolt | 33.72 | 92.60 | 71.21 |
| 10 | YĀN HUǑ Invincibles, Fire Support Heavy Regiment — YĀN HUǑ | Hyper-Rapid Magnetic Cannon; Heavy Pistol | 38.94 | 28.50 | 70.47 |
| 11 | THE CHARONTIDS — CHARONTID | Plasma Rifle; Pulzar; AP Heavy Pistol | 38.29 | 35.50 | 70.42 |
| 12 | Armata-4 Proyekt "KOSMOSOLDAT" — KOSMOSOLDAT | AP Heavy Machine Gun; AP Heavy Pistol; Chain Rifle | 38.77 | 28.80 | 70.23 |
| 13 | Tunguska TRIGGERMEN — TRIGGERMEN | MULTI Sniper Rifle; E/Marat; Pulzar; MULTI Pistol | 37.89 | 34.70 | 69.62 |
| 14 | MAJOR LUNAH, ex-Aristeia! Sniper — MAJOR LUNAH | Boarding Pistol; VIRAL Sniper Rifle (+1SD) | 38.26 | 30.20 | 69.57 |
| 15 | NOMADS TEAM-OPS — VORTEX HEAVY | MULTI Sniper Rifle; Pistol | 37.64 | 36.80 | 69.51 |
| 16 | GO-POD — GO-POD | Heavy Rocket Launcher; AP Submachine Gun | 32.56 | 92.60 | 69.24 |
| 17 | SWISS GUARD — SWISS GUARD | Light Shotgun; Heavy Pistol; Missile Launcher (+1SD); Pulzar | 37.81 | 28.60 | 68.57 |
| 18 | GRENZERS, Grenz Security Team — GRENZER | MULTI Sniper Rifle; Pistol; Breaker Pistol | 37.62 | 28.30 | 68.20 |
| 19 | ACHILLES — ACHILLES | Plasma Rifle; Pulzar; Pistol | 36.59 | 40.00 | 68.20 |
| 20 | NEOTERRA BOLTS — BOLT | MULTI Sniper Rifle; Pistol | 37.26 | 30.30 | 67.89 |
| 21 | SOGARAT Tempest Regiment — SOGARAT | Feuerbach; Pulzar; Heavy Pistol | 37.00 | 28.60 | 67.19 |
| 22 | MIRANDA ASHCROFT, Authorized Bounty Hunter — MIRANDA ASHCROFT | Combi Rifle; E/Mitter; PARA Mine; Boarding Pistol | 37.01 | 28.20 | 67.15 |
| 23 | Hetkari Shooters — HETKARI | MULTI Red Fury; Breaker Pistol; E/Marat | 36.42 | 34.90 | 67.15 |
| 24 | DRUMMERS, Mobile Support Section — DRUMBOT_2 | Hyper-Rapid Magnetic Cannon | 36.15 | 37.90 | 67.14 |
| 25 | AQUILA GUARD — AQUILA | Heavy Machine Gun; MULTI Pistol | 35.78 | 36.90 | 66.36 |
| 26 | YAOGAT Strike Infantry — YAOGAT | MULTI Sniper Rifle; Heavy Pistol | 36.44 | 28.40 | 66.21 |
| 27 | INDIGO TEAM-OPS — INDIGO HEAVY | Heavy Machine Gun; Pistol | 35.65 | 36.70 | 66.11 |
| 28 | KARHU Special Group — KARHU | Feuerbach; AP Mine; Pistol | 34.57 | 46.70 | 65.77 |
| 29 | KRIZA BORACS, Special Crisis Unit — KRIZA BORAC | Heavy Machine Gun; Heavy Pistol | 35.89 | 30.50 | 65.59 |
| 30 | SWISS GUARD — SWISS GUARD | Heavy Machine Gun; Pulzar; Heavy Pistol | 35.84 | 28.60 | 65.22 |

## Rules references

- [Rolls](https://infinitythewiki.com/Rolls), [Combined Saving Roll](https://infinitythewiki.com/Combined_Saving_Roll), [Immunity](https://infinitythewiki.com/Immunity).
- [T2 ammunition](https://infinitythewiki.com/T2_Ammunition), [Combined Ammunition](https://infinitythewiki.com/Combined_Ammunition), [Electromagnetic ammunition](https://infinitythewiki.com/Electromagnetic_(E/M)_Ammunition).
- [Limited Cover](https://infinitythewiki.com/Limited_Cover), [No Cover](https://infinitythewiki.com/No_Cover), [Martial Arts](https://infinitythewiki.com/Martial_Arts), [Neurocinetics](https://infinitythewiki.com/Neurocinetics).

- [Combat Instinct](https://infinitythewiki.com/Combat_Instinct), [Sixth Sense](https://infinitythewiki.com/Sixth_Sense), [Surprise Attack](https://infinitythewiki.com/Surprise_Attack).

- [Smoke Ammunition](https://infinitythewiki.com/Smoke_Ammunition).
