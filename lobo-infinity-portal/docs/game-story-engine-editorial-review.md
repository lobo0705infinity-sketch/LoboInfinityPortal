# Generated battle-story editorial review — 27 September 2026

**Decision: keep the pilot in draft.** The current generator corrects several mission mechanisms and avoids asserting specific objective successes from a game's aggregate result. These scenes are fictional previews of possible engagements, not accounts of observed game moves.

## What this revision establishes

| Check | Finding | Limit |
| --- | --- | --- |
| Structure | 22,770 canonical mission and army keys × four incidents × three hero roles pass the three-paragraph and ending checks. | This does not mean 273,240 stories were authored or approved. |
| Roster rendering | The objective hero in Outbreak must have Doctor, Paramedic, or Specialist Operative eligibility; synthetic games exercise all roles and outcomes. | Supporting actors and depicted actions are still narrative inventions, and actual-game suitability needs review. |
| Mission mechanics | Evacuation uses CivEvac and an Extraction Console; Last Launch uses an ID Scanner and tower checker; Neutralization carries tech into an area; The Dig requires console analysis and a player token before contact neutralization; Uplink Center controls the Tech-Coffin by sole contact; Battleground marks its sectors at the end; Data Harvest activates a harvester by depositing it wholly inside the enemy zone. | The Dig's token choices and historical mission editions are not simulated. |
| Results | Endings follow the reported winner, loser, or draw and name the contested mission stake. | Aggregate results do not identify which specific objectives either side completed. |
| Prose | A fresh seeded 110-scene packet has 156 repeated sentence appearances among 1,064 after excluding one deliberate reversal in each mission. | This exact-copy measure varies with the seed and does not judge literary quality; faction methods still recur. |
| Authored catalog | 1,300 written entries remain unchanged and retain routing priority. | Their mission fidelity needs separate editorial review; 22,770 individually authored entries remain the release requirement. |

**Akial Interference, Critical Intervention, and Double Bind** remain preview-only: the game feed does not provide the drawn Common Classified cards, attacker assignment, or chosen objective set. Corvus Belli's [24 September 2026 ITS 18 hotfix](https://infinityuniverse.com/en/news/its18-hotfix-september) governs relevant Dig, Crossing Lines, and Double Bind details. Scenario source links and editions are embedded in `src/data/generatedStoryScenarios.ts`.

Two independent readers should rate unseen generated scenes for mission correctness, faction voice, causality, prose, repetition, and all three endings under the [predeclared rubric](../scripts/prepare-story-editorial-review.mts). They should also review recorded games with linked decoded rosters. No independent editorial approval has been recorded.

## Eleven literal examples from the current generator

The cases below were selected from a 110-scene packet generated with seed `20260927pilotremediationnewseedZZZ` by `node --experimental-strip-types scripts/prepare-story-editorial-review.mts --output-dir <empty-directory> --seed 20260927pilotremediationnewseedZZZ`. Player A/B and “the operative” are illustrative stand-ins; a rendered game selects its roster hero and displays only the appropriate ending. The full packet includes all 22 mission families, one reversed pair and a mirror in each group, four incidents, and all three hero roles.


### 1. Area of Interest — Nomads vs. Bakunin Jurisdictional Command (objective)

Rule reference: https://infinitygeist.com/mission/s18_area_of_interest (ITS 18).

Player A: Nomads. Player B: Bakunin Jurisdictional Command.

A relay mast stood in a walled courtyard beside a collapsed arcade. Rain ran through the seams of its exposed control housing. Player A’s nomad field operators charted a route toward the arcade rubble. Player B’s Bakunin operatives concealed a watch post beside the breach in the far wall. The relay indicator blinked once before the panel went dark, leaving the contested ground without a clear signal.

A fallen brace trapped the antenna switch against the base of the mast. Water pooled beneath the panel, so a loose cable spat sparks whenever anyone reached for the switch. The defenders held fire on the decoy and waited for the quieter movement. An operator followed the control signal while a second fighter masked the crossing.

A burst of gunfire shifted the brace and briefly exposed the control face. The operative pulled the brace aside and keyed an activation request into the communication antenna. The activation light washed over the fallen stone at the mast’s base. The operator compared the flicker with the guard’s movement before calling the squad in. Rain hissed against the exposed wires while the relay clicked between channels.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s squad read the signal and secured the controls, taking the lead in the contest for the communication antenna and the courtyard.
- Player B wins: Player B’s squad turned a diversion into control of the panel, taking the lead over Player A in the contest for the communication antenna and the courtyard.
- Draw: Player A’s crew tracked each change in the relay signal while Player B’s crew kept a decoy between the guard and operator, leaving neither ahead in the contest for the communication antenna and the courtyard.


### 2. Akial Interference — Next Wave vs. Onyx Contact Force (gunfighting)

Rule reference: https://infinitygeist.com/mission/s18_akial_interference (ITS 18). These are **preview-only** scenes: game records lack the chosen setup.

Player A: Next Wave. Player B: Onyx Contact Force.

At the start of the round, both crews saw two new Common Classified cards as they approached the Akial Antenna. Player A’s Next Wave raiders slipped along the edge of the Akial Antenna. Player B’s Onyx assault teams set a shielded line beside the sheltered antenna approach. The new Common Classified cards could still be pursued while the antenna offered a chance to interfere.

A specialist could see the public cards, but gunfire blocked the antenna controls used to filter one of them. Shots struck the aerial guard as the new cards came into view. A raider disturbed the far cover before the real advance began elsewhere. The defenders contested the central lane instead of surrendering its angle.

A gap in the firing lane briefly opened access to the antenna controls. The operative fired at the guard beside the Akial Antenna and covered the operator watching the Common cards. The antenna answered with static; neither operator could confirm the interference attempt. The second route remained hidden until the lead fighters were close.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s crew came out ahead in the contest for classified objectives at the Akial Antenna; its diversion drew the last watch away.
- Player B wins: Player B’s crew came out ahead of Player A in the contest for classified objectives at the Akial Antenna; its controlled line held the center.
- Draw: Player A’s crew kept a second approach in reserve while Player B’s crew maintained pressure along the center; the rival crews finished even in the contest for classified objectives at the Akial Antenna.


### 3. B-Pong — Tartary Army Corps vs. Tartary Army Corps (objective, mirror)

Rule reference: https://infinitygeist.com/mission/s18_b_pong (ITS 18).

Player A: Tartary Army Corps. Player B: Tartary Army Corps.

A tracking beacon stood between two consoles as fresh smoke rolled over the central lane. Player A’s Tartary veterans moved in formation toward the tracking beacon lane. Player B’s Tartary veterans guarded the nearest console. The contact ring offered a direct relocation even without winning access to either console.

Smoke separated the specialist from the beacon while a guard watched the nearer console. Fire reached through the smoke as the approaching specialist left the console behind. Veterans pinned a guard in place before moving along the covered side. The defenders held their ground rather than chase the first moving fighter.

A gust exposed the beacon base and a clear route to its contact ring. The operative reached the tracking beacon in contact and prepared to relocate it toward the rival half. The exposed beacon remained within reach of either specialist after the smoke shifted. The pinned guard stayed occupied as the forward group changed position.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s crew gained the advantage in the struggle over the tracking beacon and consoles; its steady pressure kept the opposing guard fixed.
- Player B wins: Player B’s crew gained the advantage over Player A in the struggle over the tracking beacon and consoles; its steady pressure kept the opposing guard fixed.
- Draw: Each crew kept the nearest guard occupied; both crews found openings around the tracking beacon and consoles, but neither finished ahead.


### 4. Evacuation — Ramah Taskforce vs. Nomads (objective)

Rule reference: https://infinitygeist.com/mission/s18_evacuation (ITS 18).

Player A: Ramah Taskforce. Player B: Nomads.

An enemy HVT waited near the central corridor while both crews fought for an Extraction Console. Player A’s rescue-trained assault troops cleared a passage toward the approach to the Extraction Console. Player B’s nomad field operators tracked movement around the enemy HVT beside the corridor. Extracting the enemy HVT required a Specialist to CivEvac it into contact with the console.

Smoke hid the HVT as a specialist tried to reach it and begin CivEvac before approaching the controls. A patrol fired through the smoke between the HVT and the Extraction Console. A quick escort crossed first and signaled the rest through the opening. The defenders checked the first change before abandoning their post.

The smoke lifted and exposed the HVT, but a rival patrol still watched the console. The operative located the enemy HVT and mapped a route for CivEvac to the Extraction Console. The enemy HVT stood between rival escorts, still beyond CivEvac and the console. A fresh escort took the exposed place as the front moved again.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s crew gained the advantage in the race to bring civilians or enemy HVTs to the Extraction Consoles; its rotating escort preserved the opening.
- Player B wins: Player B’s crew gained the advantage over Player A in the race to bring civilians or enemy HVTs to the Extraction Consoles; its timed crossing carried the forward group through.
- Draw: Player A’s crew held its relief fighters near the front while Player B’s crew tracked each shift in the opposing line; the rival escorts disputed civilians, enemy HVTs, and Extraction Consoles without either crew pulling ahead.


### 5. Last Launch — Nomads vs. Bakunin Jurisdictional Command (objective)

Rule reference: https://infinitygeist.com/mission/s18_last_launch (ITS 18).

Player A: Nomads. Player B: Bakunin Jurisdictional Command.

A specialist approached an ID Scanner while an escort waited outside the Launching Tower. Player A’s nomad field operators charted a route toward the ID Scanner approach. A specialist needed to download an ID Token at a scanner before its bearer could extract at the tower checker. Player B’s Bakunin operatives concealed a watch post beside the ID Checker inside the Launching Tower.

A fallen stair rail exposed the scanner to the opposing crew and delayed the WIP download needed for an ID Token. Shots struck the scanner housing while a specialist prepared the ID download. The defenders held fire on the decoy and waited for quieter movement. An operator watched the guard’s movement and timed a crossing against it.

The rail pulled loose and offered a narrow approach before the patrol reached the scanner. The operative checked the ID Scanner and prepared to download an ID for the tower crossing. The stair rail dropped behind the specialist before an ID could be downloaded. The operator held back a signal until the crossing fighters were clear.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s crew won the overall contest to bring an ID to the Launching Tower checker; its timed crossing carried the forward group through.
- Player B wins: Player B’s crew won the overall contest over Player A to bring an ID to the Launching Tower checker; its noisy feint concealed the decisive crossing.
- Draw: Player A’s crew tracked each shift in the opposing line while Player B’s crew kept a decoy between the front and guard; the contest to bring an ID to the Launching Tower checker left both crews with equal ground.


### 6. Neutralization — Varuna Immediate Reaction Division vs. Yu Jing (gunfighting)

Rule reference: https://infinitygeist.com/mission/s18_neutralization (ITS 18).

Player A: Varuna Immediate Reaction Division. Player B: Yu Jing.

A specialist reached a Hyperthermal Tech Box while a Neutralization Area lay beyond the exposed crossing. Player A’s rapid-response marines cleared a passage toward the Hyperthermal Tech Box passage. Player B’s disciplined assault teams set a shielded line beside the nearest Neutralization Area. A specialist had to extract Hyperthermal Tech from the box before its bearer could enter a Neutralization Area.

Fire struck the box housing and delayed the WIP extraction needed before anyone could carry the tech. Gunfire struck the Tech Box between the specialist and the first Neutralization Area. A response team opened a safe exit before its forward element pushed in. The defenders met the movement with timed shifts of their firing line.

A damaged panel opened enough to reach the box as rival troops entered the lane. The operative fired at the guard between the Hyperthermal Tech Box and the Neutralization Area. The box remained unopened while the Neutralization Area was still out of reach. The open exit let the forward element return without losing its cover.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s crew earned the lead in the struggle to carry Hyperthermal Tech into a Neutralization Area; its protected exit survived the final counterpush.
- Player B wins: Player B’s crew earned the lead over Player A in the struggle to carry Hyperthermal Tech into a Neutralization Area; its staggered line held through the final exchange.
- Draw: Player A’s crew kept a guarded escape lane within reach while Player B’s crew maintained a disciplined line under pressure; neither crew pulled ahead in the struggle over Hyperthermal Tech and the Neutralization Areas.


### 7. Outbreak — ALEPH vs. ALEPH (objective, mirror)

Rule reference: https://infinitygeist.com/mission/s18_outbreak (ITS 18).

Player A: ALEPH. Player B: ALEPH.

The Alpha Infected stood in a dim corridor beyond a toppled examination cart. Player B’s algorithm-guided teams tracked movement around the Alpha Infected position. Finding the Alpha Infected was only the first step toward a confirmed scan and escort. Player A’s algorithm-guided teams charted a route toward the infected containment lane.

The cart hid the Alpha’s position whenever the scanning light passed across the doorway. The defenders adjusted whenever the opposing force found another timing window. Rounds struck the examination cart while the Alpha moved behind its shadow. An observer timed the guard’s turns and sent fighters through the shortest gap.

A handprint appeared against the glass as an opposing escort moved toward the corridor. The operative located the Alpha Infected and prepared to stabilize the patient in contact while the scan remained open. The Alpha moved behind the cart again as the scanning light crossed the doorway. The group moved again just before the predicted return of fire.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s crew came out ahead in the effort to scan and stabilize the Infected; its precise timing protected the decisive advance.
- Player B wins: Player B’s crew came out ahead of Player A in the effort to scan and stabilize the Infected; its precise timing protected the decisive advance.
- Draw: Each crew measured each opening beneath enemy fire; the efforts to scan and stabilize the Infected left both crews even.


### 8. Battleground — Ikari Company vs. StarCo (closeCombat)

Rule reference: https://infinitygeist.com/mission/s18_battleground (ITS 18).

Player A: Ikari Company. Player B: StarCo.

The far ground fell quiet while gunfire continued around the disputed center. Player B’s StarCo retrieval teams watched the far sector boundary. Abandoning the far sector to reinforce the center would leave a different claim open. Player A’s Ikari mercenaries pushed directly toward the contested central scoring sector.

A rival squad left its position to reinforce the center just as a barrier blocked the hero’s approach. The defenders watched the exit in case the opposing force slipped away. Fire reached the barrier from the far sector as reinforcements entered the center. A reckless fighter rushed one side and pulled the guard off the other.

The barrier broke open and revealed a route toward the area that would become the central sector. The operative drove a defender from the central sector and held the boundary for the squad. The open route narrowed as both squads advanced toward the center. The forward fighter kept the guard busy as the rest hurried through.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s force gained the advantage in the contest for the three scoring sectors; its sudden breach survived the counterattack.
- Player B wins: Player B’s force gained the advantage over Player A in the contest for the three scoring sectors; its retrieval route stayed protected to the end.
- Draw: Player A’s crew pressed ahead despite the exposed crossing while Player B’s crew held a marked path away from the fight; neither force finished ahead in the contest for the three scoring sectors.


### 9. Uplink Center — Druze Bayram Security vs. Ikari Company (objective)

Rule reference: https://infinitygeist.com/mission/s18_uplink_center (ITS 18).

Player A: Druze Bayram Security. Player B: Ikari Company.

A communication antenna came alive beside the central Tech-Coffin as rival squads approached from opposite sides. Player A’s Druze contract fighters moved to secure the contested line between the communication antennas. The activated antenna scored separately from sole silhouette contact with the Tech-Coffin. Player B’s Ikari mercenaries held the approach to the contested Tech-Coffin.

A fallen brace blocked the space needed to make sole contact with the coffin while an opposing specialist reached for the antenna. A rival gunner covered the coffin base while an operator approached the aerial. The defenders let the rush pass and waited for the fighters behind it. A contract team established a hard firing angle before committing the front.

The brace moved and exposed a narrow route to the coffin base. The operative checked the communication antenna status and guided a fighter into contact with the Tech-Coffin. The brace shifted back as a rival fighter approached the coffin base. The firing angle stayed fixed as the lead fighters crossed.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s crew pulled ahead in the fight over the communication antennas and Tech-Coffin; its contract line held against the final push.
- Player B wins: Player B’s crew pulled ahead of Player A in the fight over the communication antennas and Tech-Coffin; its sudden breach survived the counterattack.
- Draw: Player A’s crew kept a fixed angle on the approach while Player B’s crew pressed ahead despite the exposed crossing; neither crew pulled ahead in the fight over the communication antennas and Tech-Coffin.


### 10. The Dig — Neoterra Capitaline Army vs. Neoterra Capitaline Army (objective, mirror)

Rule reference: https://infinitygeist.com/mission/s18_the_dig (ITS 18).

Player A: Neoterra Capitaline Army. Player B: Neoterra Capitaline Army.

A buried tech signal lit the dig before either crew reached its analysis console. Player A’s capital security troops moved in formation toward the buried hyperthermal tech site. Player B’s capital security troops guarded the analysis console. The damaged console could stall analysis and leave the hyperthermal tech without a player token for contact neutralization.

A broken cable divided the console from the hyperthermal tech as an enemy squad crossed the shaft. Rounds struck the broken cable above the buried hyperthermal tech. A perimeter detail divided the approach into overlapping guarded sectors. The defenders tightened their cordon whenever a fighter tested its edge.

A loose contact emerged from the dust and exposed where the analysis had stopped. The operative reached the analysis console controls and began a reading of the buried hyperthermal tech. The console held a partial reading as the rival crew approached the cable break. The outer guards moved with the front line instead of leaving a gap.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s crew gained the edge in the struggle to analyze hyperthermal tech at the consoles and neutralize marked tech in contact; its outer cordon closed around the decisive ground.
- Player B wins: Player B’s crew gained the edge over Player A in the struggle to analyze hyperthermal tech at the consoles and neutralize marked tech in contact; its outer cordon closed around the decisive ground.
- Draw: Each crew maintained a cordon beyond the fighting; neither crew gained a lead in the effort to analyze hyperthermal tech at the consoles and neutralize marked tech in contact.


### 11. Data Harvest — Japanese Secessionist Army vs. Oban (closeCombat)

Rule reference: https://infinitygeist.com/mission/s18_data_harvest (ITS 18).

Player A: Japanese Secessionist Army. Player B: Oban.

A data-harvester carrier reached the enemy half while defenders held the designated zone. Player B’s Oban patrols watched the flanks of the active data-harvester. Depositing the inactive harvester wholly inside the designated zone would make it active. Player A’s secessionist fighters pushed directly toward the enemy designated zone.

The rival squad guarded the zone boundary and denied a clear place to deposit the inactive harvester. The defenders spread their watch to both ends of the front. The defenders fired at the carrier before the inactive harvester reached the zone. A close fighter threatened the guard while the others took its blind angle.

A gap opened beside their cover, exposing ground wholly inside the designated zone. The operative drove a defender from the designated zone and held space for the data-harvester carrier. The carrier waited outside the zone while defenders converged on the open passage. The close threat held the guard in place until the rest crossed.

**Alternative endings** (a game displays only its applicable result):

- Player A wins: Player A’s crew gained the advantage in the contest for active data-harvesters in the designated zones; its close feint opened a route past the guard.
- Player B wins: Player B’s crew gained the advantage over Player A in the contest for active data-harvesters in the designated zones; its split approach outlasted the nearest watch.
- Draw: Player A’s crew kept a fighter within reach of the guard while Player B’s crew held two approaches just outside the guard’s view; neither crew finished ahead in the contest for active data-harvesters in the designated zones.


## Gate to continue

The engine, catalog and Game Center tests must pass on each revision. The generated-only review needs two independent scorecards and zero unresolved mission-rule errors. Keep this pull request draft and do not merge or deploy until the editorial decision and treatment of existing authored stories are resolved. Passing an engine test does not satisfy the authored catalog's `test:game-stories:complete` gate.
