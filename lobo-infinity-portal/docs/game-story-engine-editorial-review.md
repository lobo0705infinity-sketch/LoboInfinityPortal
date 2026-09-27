# Generated battle-story editorial review — 27 September 2026

**Decision: keep PR #34 in draft.** The engine composes fictional scenes; it cannot claim to have observed the individual moves or scored objectives in a submitted game.

## Follow-up repair after the fresh audit

- B-Pong incident zero no longer says its console is severed after reconnecting. The unresolved consequence now keeps the rival specialist and unattended beacon in play for either side.
- Twenty-one mission families now alternate the mission result lead with the incident's own win/draw beat. Three distinct winner leads appear across each family's five sampled scenes; Area of Interest already has five. The Akial draw no longer repeats “while.”
- Each army has three authored closing choices outside Area of Interest; mission openings rotate four approach/defense phrases by broad tactical style. Eleven gunfighting actions that began with the same guard-covering phrase now describe their individual missions. These changes preserve the four distinct faction maneuvers in the middle paragraph.
- In another seeded, generated-only 110-scene packet, the 330 visible paragraphs have **47–75 words**, all 22 faction reversals change the closing paragraph, and no complete sentence repeats across 1,180 appearances in the 88 scenes after deliberate reversals are removed. Short tactical phrases still recur. This is a mechanical sample, **not** the two independent editorial scorecards or mission-rule signoff.

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
node --experimental-strip-types scripts/prepare-story-editorial-review.mts --output-dir <empty-directory> --seed 20260927-fresh-after-editorial-fixes-1916
```

The packet includes five scenes per mission: one deliberate faction reversal, one mirror, four incidents and all three hero roles. Give it to two readers who have not seen the generator, score mission correctness, faction voice, causality, prose, repetition and each ending using the accompanying rubric. A passing template test alone does not authorize merging or deployment.

## Three literal examples from the current seed

Player A/B and “the operative” are illustrative placeholders; a rendered game selects an eligible roster hero and displays only its result’s ending.

### Outbreak · G04-1 (closeCombat · faction reversal)

Rule reference: https://infinitygeist.com/mission/s18_outbreak (ITS 18).

Player A: Ariadna. Player B: Caledonian Highlander Army.

An Infected patient moved behind a broken screen as both crews arrived with scanners. Player B’s highland fighters contested the lane beside the patient behind the screen. The medic could stabilize the patient in contact, whether or not a separate scan succeeded. Player A’s frontier patrols tested an unguarded line toward the infected containment lane.

A fallen stretcher blocked the medic’s path to contact for stabilization, while scanning remained a separate opportunity. A rival escort fired across the fallen stretcher as the medic raised a scanner. The defenders braced at the patient’s shelter with a shooter behind the front. Scouts read the terrain between their cover and the containment corridor for a quiet crossing. Player A’s frontier patrols cleared the stretcher from the medic’s path without abandoning the patient.

The screen slipped aside, showing the patient still close enough for the waiting medic to reach. The operative drove a defender away from the Infected and held the path open for a medic. The stretcher rolled toward the patient again while the medic worked to stabilize them. The stretcher moved, but the nearest Infected remained exposed. Hand signals moved the covering fighters closer to the containment corridor without exposing the patrol.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: The cleared contact route helped Player A’s crew dispute access to the patient; that crew came out ahead in the effort to scan and stabilize the Infected while its concealed approach survived the last search.
- Player B wins: The cleared contact route helped Player B’s crew dispute access to the patient; that crew came out ahead of Player A in the effort to scan and stabilize the Infected while its sudden breach split the opposing guard.
- Draw: The displaced stretcher exposed both teams’ approaches to the Infected; the efforts to scan and stabilize the Infected left both crews even while Player A’s crew held a quiet route across the ground and Player B’s crew pressed hard against the guarded entrance.

### Last Launch · G16-1 (objective · faction reversal)

Rule reference: https://infinitygeist.com/mission/s18_last_launch (ITS 18).

Player A: Force de Réponse Rapide Merovingienne. Player B: Kosmoflot.

A specialist approached an ID Scanner while an escort waited outside the Launching Tower. Player B’s cold-weather raiders kept a scout watching the ID Checker inside the Launching Tower. A specialist needed to download an ID Token at a scanner before its bearer could extract at the tower checker. Player A’s Merovingian response teams found a screened angle toward the ID Scanner approach.

A fallen stair rail exposed the scanner and delayed the WIP download for an ID Token. Shots struck the scanner housing while a specialist prepared the ID download. The outside fighter held an angle on the route into the checker. The patrol exchanged places with its sheltered relief squad before testing the gap at the central checker. Player A’s Merovingian response teams guarded the loose stair rail to open a path to the ID Scanner.

The rail pulled loose and offered a narrow approach before the patrol reached the scanner. The operative keyed a download request into the ID Scanner beneath the Launching Tower stairs. The stair rail dropped behind the specialist before an ID could be downloaded. The rail slid again as rival fighters reached the scanner steps. The reserve held its fallback line near the checker.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: The freed stair route kept Player A’s crew near the ID download; that crew finished ahead in the contest for ID downloads and access to the Launching Tower checker while its fallback position protected the last advance.
- Player B wins: The freed stair route kept Player B’s crew near the ID download; that crew finished ahead of Player A in the contest for ID downloads and access to the Launching Tower checker while its off-angle route remained open at the end.
- Draw: The unstable stairs left both crews contesting the ID Scanner approach; neither crew pulled ahead in the contest for ID downloads and access to the Launching Tower checker while Player A’s crew held a reserve within reach of the fight and Player B’s crew held a distant approach under fire.

### Uplink Center · G08-1 (objective · faction reversal)

Rule reference: https://infinitygeist.com/mission/s18_uplink_center (ITS 18).

Player A: Caledonian Highlander Army. Player B: Force de Réponse Rapide Merovingienne.

A communication antenna came alive beside the central Tech-Coffin as rival squads approached from opposite sides. Player B’s Merovingian response teams held the side approach near the contested Tech-Coffin. The activated antenna scored separately from sole silhouette contact with the Tech-Coffin. Player A’s highland fighters pressed through incoming fire toward the contested line between the communication antennas.

A fallen brace blocked the space needed to make sole contact with the coffin while an opposing specialist reached for the antenna. The defenders covered the return route from the disputed uplink as carefully as its approach. A charging fighter held the nearest gun at the disputed uplink while comrades made for the Tech-Coffin. Player A’s highland fighters cleared the brace from the Tech-Coffin base while the rival watched the antenna.

The brace moved and exposed a narrow route to the coffin base. The operative slid past the communication antenna and pressed toward sole contact at the Tech-Coffin. The brace shifted back as a rival fighter approached the coffin base. The opened contact route remained vulnerable to another rival model. The fighters kept the narrow breach open beside the disputed uplink.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: The freed coffin base gave Player A’s crew a better position to contest sole contact; that crew pulled ahead in the fight over the communication antennas and Tech-Coffin while its sudden breach split the opposing guard.
- Player B wins: The freed coffin base gave Player B’s crew a better position to contest sole contact; that crew pulled ahead of Player A in the fight over the communication antennas and Tech-Coffin while its fallback position protected the last advance.
- Draw: The fallen brace left both crews disputing the coffin and antenna separately; neither crew pulled ahead in the fight over the communication antennas and Tech-Coffin while Player A’s crew pressed hard against the guarded entrance and Player B’s crew held a reserve within reach of the fight.


## Gate to continue

Require two independent scorecards and zero unresolved mission-rule errors. Keep PR #34 draft and do not merge or deploy until the editorial decision and authored-story treatment are resolved. The generated engine cannot satisfy the authored catalog's `test:game-stories:complete` gate.
