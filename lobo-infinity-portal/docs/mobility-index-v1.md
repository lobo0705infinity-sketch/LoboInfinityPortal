# Mobility index v1

Mobility is a separate 0–100 scenario index. It does not change gunfighter, ARO, or close-combat ratings and is neither a percentile nor a win probability. Weights are explicit design choices; they have not been fitted to match outcomes.

## Scoring

For each component, divide the scenario capacity by the reference below, clamp to 0–1, multiply by its weight, and sum. Round the final score to one decimal place.

| Component | Weight | Scenario / reference |
| --- | ---: | --- |
| Attack reach | 25 | Best Move or short Jump followed by an action / 11 inches |
| Open travel | 15 | Best legal one-order travel / 14 inches |
| Vertical movement with action | 12 | Best short upward Jump or Climbing Plus / 11 inches |
| Whole-order vertical movement | 8 | Best legal upward Jump or Climb / 12 inches; mounted motorcycles excluded |
| Gap with action | 12 | Short Jump / 11 inches |
| Whole-order gap | 3 | Long Jump / 12 inches |
| Turning jump with action | 10 | Pass/fail 10-inch Jet Propulsion path |
| Difficult Terrain | 10 | Mean Move+Move across five terrain types / 15 inches |
| Dodge | 5 | Expected successful Normal Dodge movement / 5 inches |

All paths are premeasured and clear, with legal landings and sufficient space for the base. Distances are inches. Terrain tests start and remain inside the zone; entry-boundary stops are outside the scenario. Aquatic, Desert, Mountain, Jungle and Zero-G have equal frequency. A profile with a choice of terrain specialties fixes one choice for the entire suite. Under this symmetric weighting, the selected specialty does not affect the mean. Bare Terrain without a specified specialty remains unresolved.

Dodge uses PH, positive Dodge target modifiers, fixed PH, bonus distance and special dice. Negative Dodge modifiers affect the opponent and are excluded from the Normal Roll. Enemy reactions, cover, deployment skills, orders generated, mission objectives and map geometry are outside this index. Super-Jump, Climbing Plus and Motorcycle restrictions follow the scenario module and its rule regression checks. Aerial profiles cannot Climb because they cannot enter scenery contact.

## Coverage and sensitivity

The audited capture includes all 58 official faction payloads, retaining their individual versions and a source fingerprint. There are 13,166 exact profile/option/form keys: 13,146 rated, 16 without MOV, and four Confessor Team Ops options with unresolved Terrain. Missing entries never borrow another faction or form's rating. Legacy group-zero IDs are accepted only where every compatible exact entry has the same movement record.

The eight aerial units are the highest-rated distinct movement profiles, at 92.5–92.6. They remain the top eight in all 18 one-at-a-time sensitivity runs (each of the nine weights varied by ±20%, with the total renormalized). This checks local ranking stability, not empirical balance or all possible weight combinations.

## Shared integration

`npm run mobility:build` deterministically generates `src/data/mobility-index.json` and the validation report from the audited capture. The bot and portal consume this same compact catalog through `mobility-lookup.mjs`. Its fingerprint covers the index version, weights, exact keys and movement records.

The bot's `/inf-list` brief shows up to six top movement profiles and a separate Mobility line on rated gunfighter cards. The portal's Army Intelligence page shows up to twelve exact movement profiles from selected decoded lists, with unresolved and stationary entry counts. The portal loads the catalog only when this component is used. No snapshot rewrite is required.

Run `npm run test:mobility` to check source-to-projection parity across all keys, provenance fingerprint, rule scenarios, monotonic movement examples, ambiguous identity rejection, combat classification isolation and bot markup contracts. Run `node scripts/inf-list-tactical-check.mjs --logic-only` for existing tactical regressions. `npm run build:vercel` runs the repository's build gates and TypeScript/Vite build.

Local verification on 2026-09-20 passed these checks. The browser-rendering portion of the legacy tactical test could not run because the local Playwright browser executable is absent; markup checks do not substitute for image layout verification. Production deployment status must be checked separately.

Rules referenced by the scenario audit: [Super-Jump](https://infinitythewiki.com/Super-Jump), [Jump](https://infinitythewiki.com/Jump), [Climb](https://infinitythewiki.com/Climb), [Climbing Plus](https://infinitythewiki.com/Climbing_Plus), [Terrain](https://infinitythewiki.com/Terrain), [Difficult Terrain](https://infinitythewiki.com/Difficult_Terrain), [Dodge](https://infinitythewiki.com/Dodge), [Motorcycle](https://infinitythewiki.com/Motorcycle), and [Aerial](https://infinitythewiki.com/Aerial).
