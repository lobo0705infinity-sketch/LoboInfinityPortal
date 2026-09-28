# Generated battle-story editorial review — 28 September 2026

**Decision: keep PR #34 in draft.** These scenes are fictional accounts assembled from a match's mission, armies, and result. The game feed does not establish the individual moves, objective activations, or scores described in the scenes.

## Corrections after the latest audit

- Uplink Center, Hardlock, Superiority, Data Harvest, Double Bind and Akial Interference no longer treat an unreported activation, deposit, or completed card as a known scored event. The incident presents a contested objective or an attempt; winning an aggregate game result does not certify a particular objective.
- Last Launch distinguishes scenes before an ID download from those with an existing ID bearer. Its gunfight and close combat actions now fit each incident's position in that sequence. Data Harvest no longer introduces an unexplained carrier beside an unattended device or places a harvester inside the designated zone solely because that side won the game.
- A repeated B-Pong console consequence and long reusable tactical phrases were revised. Closing tactics vary by matchup. These changes reduce examples of repetition; they do not give the engine the distinct plots and faction decisions that a human editor can establish.
- The regression check covers four incidents and three hero roles for the missions with identified objective-status errors, plus before/after ID scenes and the unsupported Data Harvest carrier and ending. It also checks the 22,770 canonical matchup keys and the resulting possible compositions. This is structural coverage, not an independent editorial verdict on 22,770 stories.

## Current limits

| Check | Observed result | Limit |
| --- | --- | --- |
| Mission and result | Sampled scenes leave objective status open and order the ID Scanner before the checker. Endings refer to the mission contest without claiming a specific unreported score. | The scenarios and match feed still need a rules editor to confirm each premise and version. |
| Prose variety | Two fresh 110-scene packets contain all 22 missions, four incidents, three roles, a mirror, and a deliberate faction reversal per mission. In the scene paragraphs, after excluding the 22 deliberate reversals in each packet, no complete sentence recurs across scenes; no 13-word phrase appears in three scenes. But 19 and 14 distinct ten-word phrases, respectively, do recur in three or more scenes. | Reusable tactics remain visible, and two independent readers have not scored either packet. |
| Authored catalog | The 1,300 authored entries remain unchanged and retain routing priority. | They need a separate mission-fidelity decision; this pilot does not satisfy the 22,770 individually written-story release gate. |
| Runtime | Akial Interference, Critical Intervention and Double Bind remain preview-only because the feed lacks the selected setup. | No inferred card, attacker assignment, or objective set may be treated as observed play. |

The [24 September 2026 ITS 18 hotfix](https://infinityuniverse.com/en/news/its18-hotfix-september) affects Dig, Crossing Lines and Double Bind; the scenario sources and editions are recorded in `src/data/generatedStoryScenarios.ts`. The test suites and sampling do not replace a mission-rule signoff.

## Reproduce an editorial packet

From `lobo-infinity-portal`, run:

```bash
node --experimental-strip-types scripts/prepare-story-editorial-review.mts --output-dir <empty-directory> --seed 20260928-final-check-0124-a4cb90fd
```

The packet labels all scenes as generated and substitutes Player A/B and “the operative” for an actual game and roster hero. Readers should examine all three alternative endings, although a game displays only the applicable one. Give separate packets to two readers who have not inspected the generator; have them score mission correctness, faction choice, causality, prose, repetition, and the endings using the accompanying rubric. Record disagreements and review newly generated scenes after any revision.

## Gate to continue

Require two independent scorecards and zero unresolved mission-rule errors before moving PR #34 out of draft. Do not merge or deploy while the generated prose, setup, and treatment of the authored catalog remain undecided. The generator does not satisfy the authored catalog's `test:game-stories:complete` release gate.
