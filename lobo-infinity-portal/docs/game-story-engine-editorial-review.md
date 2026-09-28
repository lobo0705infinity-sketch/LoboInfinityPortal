# Generated battle-story editorial review — 28 September 2026

**Decision: keep PR #34 in draft.** These scenes are fictional accounts assembled from a match's mission, armies, and result. The game feed does not establish the individual moves, objective activations, or scores described in the scenes.

## Corrections after the latest audit

- Defensive replies for Bakunin, Caledonia, Tohaa and Ikari now establish their own decoy, screen, shooter or reckless fighter. A Next Wave closing supplies its own feint. The counter no longer assumes the opposing army used one of those maneuvers. An explicit check covers all 45 Area responses and 45 other-mission defenses.
- The new-story gate reads the sentence containing `{{hero}}` and requires that actor's action to match the selected role. For objective heroes it also requires the mission anchor in the hero's own clause. All 264 inert-hero mutations in the audit were rejected for this reason. The 1,300 older authored rows are pinned by story-content hash: edits and additions must pass the new role and mission-objective gates. The optional full authored-catalog audit checks every row, including the pinned legacy versions.
- Several repeated army introductions, maneuvers and closings now put the mission's contested position inside the tactical decision or use a distinct faction action. Area of Interest rescue defenses vary by army. Repetition remains measurable in new unseen samples; the current generator still needs an editor's variety review.
- Scene composition now carries an explicit `aggregate-only` evidence contract for all 22 missions. The runtime checks all three endings for unsupported completed objectives and Area of Interest endings for a claimed switch, relay or panel. The Area army outcome beats now describe the tactical lead without assuming a particular activation or secure control.
- Each Dead Man’s Switch incident explicitly records an unclaimed Quantum Core; Last Launch records whether its ID Token has been downloaded. The unclaimed-item guard rejects a current bearer in the incident or ending. The third Core incident now follows a seeker toward the Core instead of describing a bearer before anyone has picked it up.
- Corporate Appropriation now records the prototype’s location in all four incidents. The transport wreck and moving lift each supply their own tactical referents and role actions; the guard rejects an abandoned cradle in either scene. Negative mutations exercise the objective, item and both location constraints before the exhaustive generator run.
- Uplink Center, Hardlock, Superiority, Data Harvest, Double Bind and Akial Interference no longer treat an unreported activation, deposit, or completed card as a known scored event. The incident presents a contested objective or an attempt; winning an aggregate game result does not certify a particular objective.
- Last Launch distinguishes scenes before an ID download from those with an existing ID bearer. Its gunfight and close combat actions now fit each incident's position in that sequence. Data Harvest no longer introduces an unexplained carrier beside an unattended device or places a harvester inside the designated zone solely because that side won the game.
- A repeated B-Pong console consequence and long reusable tactical phrases were revised. Closing tactics vary by matchup. These changes reduce examples of repetition; they do not give the engine the distinct plots and faction decisions that a human editor can establish.
- The regression check covers four incidents and three hero roles for the missions with identified objective-status errors, plus before/after ID scenes and the unsupported Data Harvest carrier and ending. It also checks the 22,770 canonical matchup keys and the resulting possible compositions. This is structural coverage, not an independent editorial verdict on 22,770 stories.

## Current limits

| Check | Observed result | Limit |
| --- | --- | --- |
| Mission and result | The composer checks declared objective evidence and relevant incident item or wreck facts for every generated matchup, incident and role; negative mutations prove the three identified contradictions fail. | Text checks cover named contradictions, not all possible factual or causal errors. The scenarios and match feed still need a rules editor to confirm each premise and version. |
| Prose variety | In one unchanged 88-scene sample, the current edits reduced distinct repeated ten-word spans from 59 to 32 and thirteen-word spans from 6 to 0. Two new seeds still yielded 66 and 72 repeated ten-word spans, and 9 and 7 repeated thirteen-word spans, respectively. Each packet contains 110 scenes before excluding the 22 deliberate faction reversals. | Reusable tactics remain visible. No new packet has received two independent editorial scorecards. A favorable single seed would misrepresent the variation. |
| Authored catalog | The 1,300 historical entries remain unchanged and pinned for catalog testing. The pilot bypasses them at runtime; submitted-game highlights still take priority. A conservative objective-text audit flagged all 1,300 for human review. | The optional complete authored-catalog audit fails on the first legacy row that lacks an actor-specific objective action. Another 21,470 authored pairings are absent, but production builds use the generator coverage gate and do not require them. Neither a text flag nor a structural pass is a human verdict. |
| Runtime | All 22 missions now route through the generator for games with linked, eligible rosters. Akial keeps cards anonymous; Critical Intervention gives either hero the shared Server Room objective; Double Bind does not say which selected plan scored. | The feed still lacks the drawn cards, attacker assignment, and chosen objective set. The fictional scene must never be read as a reconstruction of those details. |

The [24 September 2026 ITS 18 hotfix](https://infinityuniverse.com/en/news/its18-hotfix-september) affects Dig, Crossing Lines and Double Bind; the scenario sources and editions are recorded in `src/data/generatedStoryScenarios.ts`. The test suites and sampling do not replace a mission-rule signoff.

## Reproduce an editorial packet

From `lobo-infinity-portal`, run:

```bash
node --experimental-strip-types scripts/prepare-story-editorial-review.mts --output-dir <empty-directory> --seed 20260928-scene-facts-final-b
```

The packet labels all scenes as generated and substitutes Player A/B and “the operative” for an actual game and roster hero. Readers should examine all three alternative endings, although a game displays only the applicable one. Give separate packets to two readers who have not inspected the generator; have them score mission correctness, faction choice, causality, prose, repetition, and the endings using the accompanying rubric. Record disagreements and review newly generated scenes after any revision.

## Gate to continue

Require two independent scorecards and zero unresolved mission-rule errors before moving PR #34 out of draft. Production prebuilds now use `test:game-story-engine` for all 22,770 possible matchups; the optional authored-catalog completeness audit is outside the release path. Do not merge or deploy until generated prose and mission-rule review pass and the normal release checks are green.
