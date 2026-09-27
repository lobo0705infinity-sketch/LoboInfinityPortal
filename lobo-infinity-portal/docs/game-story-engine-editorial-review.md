# Generated battle-story editorial review — 27 September 2026

**Decision: keep PR #34 in draft.** The engine composes fictional scenes; it cannot claim to have observed the individual moves or scored objectives in a submitted game.

## Findings after remediation

| Check | Result | Limit |
| --- | --- | --- |
| Objective hero | All 88 incident actions now make the selected hero attempt an objective or directly contest its scored position. The generated source check rejects preparation-only text. | A synthetic move still needs human review for each mission and submitted roster. |
| Faction decision | Each of 45 non-Area armies rotates four authored maneuvers across each mission's four incidents. The fixed army opener has been removed, and reversing the hero changes the middle decision and closing response. | A faction can still reuse one of its four ideas across enough missions; different nouns alone do not establish plot originality. |
| Results | Win, loss and draw refer to the incident's obstacle; Last Launch names ID downloads and access to the tower checker without asserting a completed extraction. | The game feed reports overall results, not an objective-by-objective ledger. |
| Repetition | A regenerated 110-scene packet has no repeated complete sentences across 1,179 sentence appearances after excluding 22 intentional faction reversals; its 88 checked scenes have 44–75 words per visible paragraph. All 22 reversed pairs now have different closing paragraphs. | This is one seed, and short patterns or decisions may still recur. |
| Structure | 22,770 canonical matchup keys × four incidents × three roles pass the template gate. The catalog and Game Center suites and TypeScript also pass. | This does not mean 273,240 stories were individually written or editorially approved. |
| Authored catalog | 1,300 authored entries remain untouched and retain routing priority. | Their mission fidelity needs separate editorial review; the 22,770 individual-story release gate is still separate. |

Akial Interference, Critical Intervention, and Double Bind remain preview-only because the game feed lacks the selected mission setup. The [24 September 2026 ITS 18 hotfix](https://infinityuniverse.com/en/news/its18-hotfix-september) governs Dig, Crossing Lines, and Double Bind details; source links and editions are in `src/data/generatedStoryScenarios.ts`. No independent editorial approval has been recorded.

## Reproduce the reader packet

From `lobo-infinity-portal`, run:

```bash
node --experimental-strip-types scripts/prepare-story-editorial-review.mts --output-dir <empty-directory> --seed 20260927remediatedReaderPacket65433
```

The packet includes five scenes per mission: one deliberate faction reversal, one mirror, four incidents and all three hero roles. Give it to two readers who have not seen the generator, score mission correctness, faction voice, causality, prose, repetition and each ending using the accompanying rubric. A passing template test alone does not authorize merging or deployment.

## Three literal examples from the current seed

Player A/B and “the operative” are illustrative placeholders; a rendered game selects an eligible roster hero and displays only its result's ending.

### Outbreak · G07-5

Rule reference: https://infinitygeist.com/mission/s18_outbreak (ITS 18).

Player A: Torchlight Brigade. Player B: Japanese Secessionist Army.

The Alpha Infected reached the edge of the containment area while its escort stopped under fire. Player A’s brigade responders cleared a passage toward the infected containment lane. Player B’s secessionist fighters held the approach to the Alpha Infected position. The Alpha could be stabilized in contact even with its separate scan uncertain.

A damaged scanner obscured the Alpha while a medic sought a separate route to reach the patient in contact. A response team split between the line at the containment corridor and a relief position. The close threat held the guard away from the containment corridor as the rest crossed. Player A’s brigade responders sent a medic along the scanner’s blind side toward the Alpha.

The screen cleared long enough for the medic to read the patient’s condition from cover. The operative left cover to reach the Alpha Infected and attempted to stabilize the patient. The damaged scanner dimmed again while the medic worked to stabilize the Alpha. A second escort moved to bar any return to the Alpha. A relief fighter moved toward the containment corridor when the forward guard lost cover.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s crew came out ahead in the effort to scan and stabilize the Infected; the blind-side approach kept Player A’s crew in reach of the Alpha, while its relief line answered the final breach.
- Player B wins: Player B’s crew came out ahead of Player A in the effort to scan and stabilize the Infected; the blind-side approach kept Player B’s crew in reach of the Alpha, while its close feint opened a route past the guard.
- Draw: The efforts to scan and stabilize the Infected left both crews even; the failing scanner left both escorts facing the Alpha’s exposed route while Player A’s crew kept a relief position close to the front and Player B’s crew kept a fighter within reach of the guard.

### Last Launch · G05-1

Rule reference: https://infinitygeist.com/mission/s18_last_launch (ITS 18).

Player A: PanOceania. Player B: Military Orders.

A specialist approached an ID Scanner while an escort waited outside the Launching Tower. Player B’s armored knights set a shielded line beside the ID Checker inside the Launching Tower. A specialist needed to download an ID Token at a scanner before its bearer could extract at the tower checker. Player A’s armored survey troops charted a route toward the ID Scanner approach.

A fallen stair rail exposed the scanner and delayed the WIP download for an ID Token. The escort held the approach to the checker as another threat emerged. Two gunners measured the approach from the central checker, then moved their covering fire ahead of the specialist bound for the checker. Player A’s armored survey troops guarded the loose stair rail to open a path to the ID Scanner.

The rail pulled loose and offered a narrow approach before the patrol reached the scanner. The operative keyed a download request into the ID Scanner beneath the Launching Tower stairs. The stair rail dropped behind the specialist before an ID could be downloaded. The rail slid again as rival fighters reached the scanner steps. The covering line kept the checker in view as the forward fighters moved.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s crew finished ahead in the contest for ID downloads and access to the Launching Tower checker; the freed stair route kept Player A’s crew near the ID download, while its measured firing lane stayed covered through the last exchange.
- Player B wins: Player B’s crew finished ahead of Player A in the contest for ID downloads and access to the Launching Tower checker; the freed stair route kept Player B’s crew near the ID download, while its armored screen remained between the enemy and the advance.
- Draw: Neither crew pulled ahead in the contest for ID downloads and access to the Launching Tower checker; the unstable stairs left both crews contesting the ID Scanner approach while Player A’s crew held a surveyed lane under fire and Player B’s crew kept an armored escort at the front.

### Uplink Center · G08-1

Rule reference: https://infinitygeist.com/mission/s18_uplink_center (ITS 18).

Player A: Neoterra Capitaline Army. Player B: Shock Army of Acontecimento.

A communication antenna came alive beside the central Tech-Coffin as rival squads approached from opposite sides. Player B’s jungle campaign veterans watched the flanks of the contested Tech-Coffin. The activated antenna scored separately from sole silhouette contact with the Tech-Coffin. Player A’s capital security troops moved in formation toward the contested line between the communication antennas.

A fallen brace blocked the space needed to make sole contact with the coffin while an opposing specialist reached for the antenna. The defenders watched the breaks in cover near the disputed uplink instead of firing blindly. The security detail closed an outer gap before sending a small unit toward the Tech-Coffin. Player A’s capital security troops cleared the brace from the Tech-Coffin base while the rival watched the antenna.

The brace moved and exposed a narrow route to the coffin base. The operative slid past the communication antenna and pressed toward sole contact at the Tech-Coffin. The brace shifted back as a rival fighter approached the coffin base. The opened contact route remained vulnerable to another rival model. The outer guards moved with the line facing the Tech-Coffin, leaving no opening behind it.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s crew pulled ahead in the fight over the communication antennas and Tech-Coffin; the freed coffin base gave Player A’s crew a better position to contest sole contact, while its outer cordon closed around the decisive ground.
- Player B wins: Player B’s crew pulled ahead of Player A in the fight over the communication antennas and Tech-Coffin; the freed coffin base gave Player B’s crew a better position to contest sole contact, while its patrol secured successive pockets of cover.
- Draw: Neither crew pulled ahead in the fight over the communication antennas and Tech-Coffin; the fallen brace left both crews disputing the coffin and antenna separately while Player A’s crew maintained a cordon beyond the fighting and Player B’s crew kept advancing through broken cover.

## Gate to continue

Require two independent scorecards and zero unresolved mission-rule errors. Keep PR #34 draft and do not merge or deploy until the editorial decision and authored-story treatment are resolved. The generated engine cannot satisfy the authored catalog's `test:game-stories:complete` gate.
