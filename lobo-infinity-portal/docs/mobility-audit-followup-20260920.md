# Mobility audit follow-up — 2026-09-20

## Outcome

Data-validation defects are fixed. Rule-based action scenarios have been run on every mobile entry. The original provisional rating is retained for comparison; no revised weights, production UI or combat blend are enabled.

## Data safeguards

The builder now requires exact coverage of the faction manifest, rejects duplicate or unexpected faction IDs and malformed profile groups, validates unique profile identities, and rejects missing MOV/PH or unresolved traits before writing output. It retains per-faction source versions and a source-capture fingerprint. Faction-local trait metadata resolves all 146 previously unresolved Exrah/Commlink labels. PH is now persisted.

This rerun uses the same complete official capture as the initial audit to isolate implementation changes. Mixed official versions are recorded per faction; this is not a transactionally consistent live API snapshot.

- 58 of 58 faction payloads.
- 13166 unique enabled profile/option entries.
- 13150 mobile entries evaluated; 16 official nonmoving forms unranked.
- Zero missing movement, zero missing mobile PH, zero unresolved traits.
- 23 entries require a terrain choice or specify Terrain without a type; their terrain scenarios are explicitly unresolved.
- 20 targeted data/rules tests pass, plus existing MOV extraction and provisional-score regressions.
- End-to-end partial-capture test exits unsuccessfully before creating output.
- All original provisional scores are unchanged.

## Measured comparisons

Inches, unless stated otherwise. Best travel uses the best legal sequence of Move+Move, Long Jump, or Super-Jump+Move on a clear horizontal route. Dodge is expected movement from an eligible, unopposed Normal Roll, including failures; it is not a face-to-face estimate. “Unavailable” means the particular action combination is unavailable, not that the unit cannot reach any elevated position.

| Profile/form | Best travel/order | Jump + shoot | Climb + shoot | Expected Dodge | Best travel in Difficult Jungle/order |
|---|---:|---:|---:|---:|---:|
| Redeye | 13 | 11 | Unavailable | 1.3 | 14 |
| Fēiquán | 13 | 11 | Unavailable | 1.2 | 14 |
| Haytham | 13 | 11 | Unavailable | 1.3 | 14 |
| Zeybek | 13 | 11 | Unavailable | 1.2 | 14 |
| Go-Pod | 13 | 11 | Unavailable | 1.3 | 14 |
| Skyhound | 13 | 11 | Unavailable | 1.3 | 14 |
| Tarksia | 13 | 11 | Unavailable | 1.2 | 14 |
| Firebat | 13 | 11 | Unavailable | 1.2 | 14 |
| Garuda | 12 | 10 | Unavailable | 1.1 | 11 |
| Shikami | 11 | 9 | 8 | 2.8 | 9 |
| Nisse | 8 | Unavailable | Unavailable | 1.2 | 9 |
| Locust | 8 | Unavailable | Unavailable | 1.2 | 9 |
| Roadbot mobility form | 12 | Unavailable | 10 | 2.8 | 13 |
| Roadbot combat form | 8 | Unavailable | Unavailable | 1.1 | 6 |
| Su-Jian mobility form | 10 | Unavailable | 10 | 2.8 | 11 |
| Su-Jian combat form | 8 | Unavailable | Unavailable | 1.4 | 6 |
| Penthesilea | 14 | Unavailable | Unavailable | 2.2 | 12 |
| Motorized Bounty Hunter | 14 | Unavailable | Unavailable | 2 | 12 |
| Fusilier | 8 | Unavailable | Unavailable | 1 | 6 |

## What the tests establish

- Fliers have an 11-inch short Jump and 12-inch Long Jump; Jump+Move reaches 13 inches in one clear-route Order. Garuda has a 10-inch short Jump and 12-inch Long Jump; its best clear-route travel is 12 inches. An 11-inch gap therefore separates their ability to retain an attack, rather than whether they can cross at all.
- Motorcycle speed is useful: 8–6 yields 14 inches on Move+Move. The ascent and Climb tests enforce mounted restrictions instead of assigning an invented flat penalty.
- Shikami and Roadbot mobility form each average 2.8 inches in the specified Normal Dodge test; the sampled fliers average 1.2–1.3. Dodge(-3) is correctly ignored for the user's Normal Roll target, because it modifies an opponent in a face-to-face roll.
- Nisse's Climb(+3 inches) reaches 9 inches on a Long Climb instead of 8. It does not grant Climbing Plus or a follow-up attack.
- Terrain Total is contextual: it increases the first MOV value and removes Difficult Terrain penalties only in the terrain scenario. It does not give an unconditional speed bonus on ordinary ground.
- Roadbot and Su-Jian retain distinct physical forms. The benchmark does not give a combat form the movement or skills of its mobility form.

## Remaining limits and recommendation

These measurements improve validation but do not calibrate a universal rating. Do not deploy a revised aggregate score yet. Next weighting work should use separately reported travel, access and reactive movement outcomes, with explicit terrain prevalence and sensitivity checks. Aerial units need not tie once Dodge is included. First place under the original formula is not a regression requirement for a future benchmark.

- Distances are inches. Movement actions begin standing, unengaged, with unrestricted clear paths and no enemy interference.
- Best open travel compares Move+Move, a Long Jump, and Super-Jump+Move. Jumping is permitted on this clear route; no extra Orders or deployment bonuses are assumed.
- Jump/ascent paths are premeasured legal trajectories with sufficiently large landing surfaces for each base. No collision, vaulting, silhouette-clearance or landing-footprint simulation.
- Gap test is a single horizontal 11-inch Jump trajectory. Ascent test is one 9-inch upward Jump or Climb trajectory with no intermediate landing.
- Bent-air test is a 10-inch upward/turning trajectory without intermediate surfaces, requiring Jet Propulsion and a follow-up BS Attack.
- A follow-up attack means an action remains available, not that a target is in range/LoF or that the shooter survives an ARO.
- 12-inch Difficult Terrain travel starts inside and remains inside the specified zone. Entry-boundary stopping is deliberately excluded.
- Terrain choices are not optimized separately for each test: a multi-type choice remains unresolved until selected. An unqualified Terrain label is reported as unspecified.
- Dodge is an eligible Normal Roll with no situational penalties, not a face-to-face survival estimate. Expected distance includes failure probability.
- Scores are still the original provisional v1 weights. Scenario measurements are separate; no new aggregate score or combat blend is introduced.

## Reproduce

```sh
node --test scripts/mobility-audit-check.mjs
node scripts/mobility-rating-check.mjs
node scripts/tts-workshop-profile-catalog-check.mjs
node scripts/build-mobility-catalog.mjs --api data/infinity-army/mobility-provisional-catalog.json.gz.b64
node scripts/benchmark-mobility-scenarios.mjs data/infinity-army/mobility-provisional-catalog.json.gz.b64 data/infinity-army/mobility-scenario-validation.json
```

## Rules sources

- [Super-Jump](https://infinitythewiki.com/Super-Jump)
- [Jump](https://infinitythewiki.com/Jump)
- [Climb](https://infinitythewiki.com/Climb)
- [Climbing Plus](https://infinitythewiki.com/Climbing_Plus)
- [Terrain](https://infinitythewiki.com/Terrain)
- [Difficult Terrain](https://infinitythewiki.com/Difficult_Terrain)
- [Dodge](https://infinitythewiki.com/Dodge)
- [Motorcycle](https://infinitythewiki.com/Motorcycle)
- [AI Motorcycle](https://infinitythewiki.com/AI_Motorcycle)
- [Aerial](https://infinitythewiki.com/Aerial)
- [Modifiers Explained](https://infinitythewiki.com/Modifiers_Explained)
